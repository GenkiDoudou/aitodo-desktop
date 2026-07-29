import type Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import type {
  DesktopSyncStatus,
  SyncEntityType,
  SyncLoginRequest,
  SyncLoginResponse,
  SyncTestServerResult
} from '@shared/sync-protocol'
import { SYNC_ENTITY_TYPES } from '@shared/sync-protocol'
import {
  mergeSyncPreferences,
  type SyncPreferences
} from '@shared/sync-preferences'
import { isSyncEntityEnabled } from '@shared/sync-entity-filter'
import { SyncOutbox } from '../db/sync-outbox'
import {
  clearSyncCredentials,
  ensureSyncState,
  readSyncCredentials,
  updateSyncState,
  writeSyncCredentials
} from '../db/sync-state'
import {
  readSyncPreferences,
  writeSyncPreferences
} from '../db/sync-preferences-store'
import {
  readUiPreferencesSnapshot,
  writeUiPreferencesSnapshot
} from '../db/ui-preferences-snapshot'
import { TaskRepository } from '../db/task-repository'
import { WidgetNoteRepository } from '../db/widget-note-repository'
import { SyncApiClient, SyncApiError } from './sync-api-client'
import { applyRemoteChange, sortPullChanges } from './sync-apply'
import { enqueueMissingLocalEntities } from './sync-enqueue-missing'
import { enqueueAppSettingsUpsert } from './app-settings-sync'
import { IPC } from '@shared/ipc-channels'
import { getNotifyRuntime } from '../notify/notify-runtime'

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8088'

export class SyncEngine {
  private client: SyncApiClient
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  /** 登录/启动后做一次从 0 的对账；日常同步走增量，避免占死主进程导致回车添加卡住 */
  private needsFullReconcile = false

  constructor(
    private readonly getDb: () => Database.Database,
    private readonly getDataDir: () => string
  ) {
    this.client = new SyncApiClient(DEFAULT_SERVER_URL, null)
  }

  /** 应用启动：已登录则恢复 token 并开启定时同步 */
  start(): void {
    const db = this.getDb()
    const state = ensureSyncState(db)
    if (state.serverBaseUrl) {
      this.client.setBaseUrl(state.serverBaseUrl)
    }
    const creds = readSyncCredentials(this.getDataDir())
    if (creds) {
      this.client.setAccessToken(creds.accessToken)
      this.needsFullReconcile = true
      this.ensureTimer()
      getNotifyRuntime(this.getDb, this.getDataDir).onLoggedIn()
      void this.trigger().catch(() => undefined)
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private getPreferences(): SyncPreferences {
    return readSyncPreferences(this.getDataDir())
  }

  private ensureTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    const interval = this.getPreferences().syncIntervalMs
    this.timer = setInterval(() => {
      void this.trigger().catch(() => undefined)
    }, interval)
  }

  /** 登录态下重置定时器（改频率后调用） */
  private refreshTimerIfLoggedIn(): void {
    const creds = readSyncCredentials(this.getDataDir())
    if (!creds) return
    this.ensureTimer()
  }

  getStatus(): DesktopSyncStatus {
    const db = this.getDb()
    const state = ensureSyncState(db)
    const creds = readSyncCredentials(this.getDataDir())
    const outbox = new SyncOutbox(db)
    return {
      loggedIn: Boolean(creds?.accessToken),
      username: creds?.username ?? null,
      serverBaseUrl: state.serverBaseUrl || this.client.getBaseUrl(),
      deviceId: state.deviceId,
      lastPulledCursor: state.lastPulledCursor,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      pendingCount: outbox.countPending(),
      preferences: this.getPreferences()
    }
  }

  setPreferences(partial: Partial<SyncPreferences>): SyncPreferences {
    const next = writeSyncPreferences(
      this.getDataDir(),
      mergeSyncPreferences({ ...this.getPreferences(), ...partial })
    )
    this.refreshTimerIfLoggedIn()
    return next
  }

  reportUiPreferences(prefs: Record<string, string>): void {
    writeUiPreferencesSnapshot(this.getDataDir(), prefs)
    this.enqueueLocalAppSettings()
  }

  /** 本机配置变更后入队 app_settings（已登录且开启配置同步时） */
  enqueueLocalAppSettings(): void {
    const prefs = this.getPreferences()
    if (!isSyncEntityEnabled('app_settings', prefs)) return
    const creds = readSyncCredentials(this.getDataDir())
    if (!creds) return
    const db = this.getDb()
    const outbox = new SyncOutbox(db)
    const ui = readUiPreferencesSnapshot(this.getDataDir())
    enqueueAppSettingsUpsert(
      outbox,
      new WidgetNoteRepository(db),
      Object.keys(ui).length ? ui : undefined
    )
  }

  setServerUrl(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '')
    if (!trimmed) {
      throw new Error('服务器地址不能为空')
    }
    this.client.setBaseUrl(trimmed)
    updateSyncState(this.getDb(), { serverBaseUrl: trimmed })
    return trimmed
  }

  async testServerUrl(url?: string): Promise<SyncTestServerResult> {
    const target = (url ?? this.getStatus().serverBaseUrl).trim().replace(/\/+$/, '')
    if (!target) {
      return { ok: false, message: '请先填写服务器地址' }
    }
    try {
      const res = await fetch(`${target}/api/auth/login`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: '', password: '' }),
        signal: AbortSignal.timeout(8_000)
      })
      // 任意 HTTP 响应即视为可达（业务校验失败也说明服务在线）
      await res.text().catch(() => undefined)
      return { ok: true, message: `连接成功（HTTP ${res.status}）` }
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TimeoutError'
          ? '连接超时'
          : err instanceof Error
            ? `无法连接：${err.message}`
            : '无法连接'
      return { ok: false, message }
    }
  }

  async login(dto: SyncLoginRequest): Promise<SyncLoginResponse> {
    const state = ensureSyncState(this.getDb())
    if (state.serverBaseUrl) {
      this.client.setBaseUrl(state.serverBaseUrl)
    }
    const result = await this.client.login(dto)
    this.client.setAccessToken(result.accessToken)
    writeSyncCredentials(this.getDataDir(), {
      accessToken: result.accessToken,
      userId: result.userId,
      username: result.username,
      savedAt: nowIso()
    })
    updateSyncState(this.getDb(), {
      userId: result.userId,
      lastError: null
    })
    this.needsFullReconcile = true
    this.ensureTimer()
    getNotifyRuntime(this.getDb, this.getDataDir).onLoggedIn()
    try {
      await this.trigger()
    } catch {
      /* 登录成功后首次同步失败不阻断登录；错误写入 sync_state.lastError */
    }
    return result
  }

  logout(): void {
    getNotifyRuntime(this.getDb, this.getDataDir).onLoggedOut()
    this.stop()
    clearSyncCredentials(this.getDataDir())
    this.client.setAccessToken(null)
    updateSyncState(this.getDb(), {
      userId: null,
      lastError: null
    })
  }

  async trigger(opts?: { fullReconcile?: boolean }): Promise<DesktopSyncStatus> {
    if (this.running) {
      return this.getStatus()
    }
    const creds = readSyncCredentials(this.getDataDir())
    if (!creds) {
      return this.getStatus()
    }

    // trigger 是“主线程定时/手动拉起”的统一入口。
    // running 作为进程内互斥锁，避免 push/pull 交错导致 outbox 状态与 cursor 更新错乱。
    this.running = true
    const db = this.getDb()
    const prefs = this.getPreferences()
    try {
      this.client.setAccessToken(creds.accessToken)
      const state = ensureSyncState(db)
      if (state.serverBaseUrl) {
        this.client.setBaseUrl(state.serverBaseUrl)
      }

      // 将本地已有但从未成功入队/推送过的实体补进 outbox（仍然受 prefs 开关过滤）。
      enqueueMissingLocalEntities(db, prefs, this.getDataDir())

      // 先 Push 再 Pull：减少“本机刚写入但对端尚未看到”的窗口。
      await this.pushPending(db, state.deviceId, prefs)

      const doFull = this.needsFullReconcile || Boolean(opts?.fullReconcile)
      if (doFull) {
        // fullReconcile：从最早 cursor 开始重放，用于登录首次/异常风险下的纠偏。
        await this.pullChanges(db, state.deviceId, '0', prefs)
        this.needsFullReconcile = false
      } else {
        const cursor = ensureSyncState(db).lastPulledCursor || '0'
        // 增量 Pull：从上次记录的 cursor 继续分页拉取。
        await this.pullChanges(db, state.deviceId, cursor, prefs)
      }

      updateSyncState(db, {
        lastSyncAt: nowIso(),
        lastError: null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      updateSyncState(db, { lastError: message })
      if (err instanceof SyncApiError && err.code === 401) {
        this.logout()
      }
    } finally {
      this.running = false
    }
    return this.getStatus()
  }

  private async pushPending(
    db: Database.Database,
    deviceId: string,
    prefs: SyncPreferences
  ): Promise<void> {
    const outbox = new SyncOutbox(db)
    // 根据本机偏好开关筛出允许同步的实体类型，避免“关闭同步”但 still 推队列里旧数据。
    const enabledTypes = SYNC_ENTITY_TYPES.filter((t) =>
      isSyncEntityEnabled(t, prefs)
    ) as SyncEntityType[]
    for (;;) {
      const pending = outbox.listPendingOfTypes(enabledTypes, 200)
      if (!pending.length) break

      const result = await this.client.push({
        deviceId,
        changes: pending.map((row) => ({
          clientChangeId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          operation: row.operation,
          payload: row.payload,
          clientUpdatedAt: String(row.payload.updatedAt ?? row.createdAt),
          clientSyncVersion: row.clientSyncVersion
        }))
      })

      outbox.markMany(result.accepted, 'pushed')

      for (const rej of result.rejected) {
        outbox.markStatus(rej.clientChangeId, 'rejected')
      }

      for (const conflict of result.conflicts) {
        // 冲突处理策略：直接按服务端 payload 应用，并标记本地变更丢弃。
        // 该做法可避免重复冲突来回导致的死循环。
        outbox.markStatus(conflict.clientChangeId, 'discarded')
        applyRemoteChange(
          db,
          {
            revision: conflict.serverRevision,
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            operation: 'upsert',
            payload: conflict.serverPayload,
            serverUpdatedAt: conflict.serverUpdatedAt,
            originDeviceId: null
          },
          {
            deviceId,
            dataDir: this.getDataDir(),
            onUiPreferencesApplied: (p) => this.broadcastUiPreferences(p)
          }
        )
        db.prepare(
          `INSERT INTO sync_conflicts (
            id, entity_type, entity_id, local_payload_json, server_payload_json, resolved_at, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?)`
        ).run(
          uuidv4(),
          conflict.entityType,
          conflict.entityId,
          JSON.stringify(conflict.serverPayload),
          nowIso(),
          nowIso()
        )
      }

      updateSyncState(db, { lastPushedAt: nowIso() })

      if (
        result.accepted.length + result.rejected.length + result.conflicts.length === 0
      ) {
        break
      }
    }
  }

  /**
   * 增量或全量 Pull：按条应用并定期让出主线程，避免长时间占死 IPC。
   * @param startCursor `"0"` 表示从最早重放；否则为上次 cursor
   */
  private async pullChanges(
    db: Database.Database,
    deviceId: string,
    startCursor: string,
    prefs: SyncPreferences
  ): Promise<void> {
    let cursor = startCursor
    let appliedInPage = 0
    for (;;) {
      const page = await this.client.pull(cursor, 200)
      const sorted = sortPullChanges(page.changes)
      for (const change of sorted) {
        if (!isSyncEntityEnabled(change.entityType, prefs)) {
          continue
        }
        // task 可能需要包含 deletedAt / syncVersion：用于 applyRemoteChange 的 LWW 与 echo 过滤。
        const localTask =
          change.entityType === 'task'
            ? new TaskRepository(db).findByIdIncludingDeleted(change.entityId)
            : null
        applyRemoteChange(db, change, {
          deviceId,
          localSyncVersion: localTask?.syncVersion,
          dataDir: this.getDataDir(),
          onUiPreferencesApplied: (p) => this.broadcastUiPreferences(p)
        })
        appliedInPage += 1
        if (appliedInPage % 8 === 0) {
          // 分页内每 8 条让出一次主线程，避免长同步占死 IPC。
          await yieldToMain()
        }
      }
      cursor = page.nextCursor
      updateSyncState(db, { lastPulledCursor: cursor })
      await yieldToMain()
      if (!page.hasMore) break
    }
  }

  private broadcastUiPreferences(prefs: Record<string, string>): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.SYNC_UI_PREFERENCES_APPLIED, prefs)
    }
  }
}

/** 让出主线程，使 tasks.create 等 IPC 可在同步间隙执行 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

let engineSingleton: SyncEngine | null = null

export function getSyncEngine(
  getDb: () => Database.Database,
  getDataDir: () => string
): SyncEngine {
  if (!engineSingleton) {
    engineSingleton = new SyncEngine(getDb, getDataDir)
  }
  return engineSingleton
}

export function resetSyncEngineForTests(): void {
  engineSingleton?.stop()
  engineSingleton = null
}

/** 配置变更后尝试入队（引擎未启动则忽略） */
export function notifyAppSettingsChanged(): void {
  engineSingleton?.enqueueLocalAppSettings()
}
