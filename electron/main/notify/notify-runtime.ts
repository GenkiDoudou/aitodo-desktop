import { ensureSyncState, readSyncCredentials } from '../db/sync-state'
import { readNotificationConfig, writeNotificationConfig } from '../db/notification-config-store'
import {
  applyServerChannelConfig,
  mergeNotificationConfig,
  type NotificationConfig
} from '@shared/notification-config'
import type { AppMessage, AppMessageSource } from '@shared/types'
import type Database from 'better-sqlite3'
import { AppMessageRepository } from '../db/app-message-repository'
import { AppMessageService } from '../services/app-message-service'
import { SyncOutbox } from '../db/sync-outbox'
import { readSyncPreferences } from '../db/sync-preferences-store'
import { NotifyApiClient } from './notify-api-client'
import { NotifyLeaseHeartbeat } from './notify-lease-heartbeat'
import {
  getNotificationDispatcher,
  type NotificationDispatcher
} from './notification-dispatcher'
import type { NotifyDispatchPayload } from '@shared/notification-config'

type InAppPush = (message: AppMessage, opts?: { skipExternalNotify?: boolean }) => void

/**
 * 通知运行时：代发客户端、租约心跳、Dispatcher（登录后 relay）。
 */
export class NotifyRuntime {
  private client: NotifyApiClient | null = null
  private heartbeat: NotifyLeaseHeartbeat | null = null
  private onInAppPush: InAppPush | null = null
  private deferredTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly getDb: () => Database.Database,
    private readonly getDataDir: () => string
  ) {}

  /** 由 index 注入，避免与 handlers 循环依赖 */
  setOnInAppPush(fn: InAppPush): void {
    this.onInAppPush = fn
  }

  /** 启动本机免打扰延后冲刷（登录与否都需要） */
  ensureDeferredFlush(): void {
    if (this.deferredTimer) return
    void this.flushDeferred().catch(() => undefined)
    this.deferredTimer = setInterval(() => {
      void this.flushDeferred().catch((err) => console.warn('[notify] flush deferred', err))
    }, 60_000)
  }

  dispatcher(): NotificationDispatcher {
    return getNotificationDispatcher({
      getDataDir: this.getDataDir,
      isLoggedIn: () => Boolean(readSyncCredentials(this.getDataDir())?.accessToken),
      relayIfLoggedIn: (payload) => this.relayIfLoggedIn(payload)
    })
  }

  /** 登录成功或启动已登录时调用 */
  onLoggedIn(): void {
    const creds = readSyncCredentials(this.getDataDir())
    const state = ensureSyncState(this.getDb())
    if (!creds?.accessToken || !state.serverBaseUrl) {
      this.onLoggedOut()
      return
    }
    this.client = new NotifyApiClient(state.serverBaseUrl, creds.accessToken)
    // 登录只拉取，避免空本地 token 覆盖服务端；显式保存时再 putConfig
    void this.pullConfigFromServer().catch((err) =>
      console.warn('[notify] pull config failed', err)
    )
    this.heartbeat = new NotifyLeaseHeartbeat(
      () => this.client,
      () => ensureSyncState(this.getDb()).deviceId,
      () => readNotificationConfig(this.getDataDir()).lease.leaseTtlMs,
      () => readNotificationConfig(this.getDataDir()).lease.heartbeatIntervalMs
    )
    this.heartbeat.start()
    void this.backfillUnacked().catch((err) =>
      console.warn('[notify] backfill unacked failed', err)
    )
  }

  /**
   * 拉取关端调度成功但未确认的投递，补写站内消息（不弹托盘、不重外发），再 ack。
   */
  async backfillUnacked(): Promise<void> {
    if (!this.client || !this.onInAppPush) return
    const rows = await this.client.listUnacked()
    if (!rows.length) return

    const groups = new Map<string, typeof rows>()
    for (const row of rows) {
      // 同一条投递在不同端可能会“重复未 ack”。用 event/entityId/title/body
      // 做幂等分组，保证只补写一次站内消息。
      const key = `${row.event}|${row.entityId}|${row.title}|${row.body}`
      const list = groups.get(key) ?? []
      list.push(row)
      groups.set(key, list)
    }

    const db = this.getDb()
    const messages = new AppMessageService(
      new AppMessageRepository(db),
      new SyncOutbox(db),
      () => readSyncPreferences(this.getDataDir())
    )
    const ackIds: string[] = []

    for (const group of groups.values()) {
      const sample = group[0]!
      const source: AppMessageSource | null =
        sample.event === 'task_reminder'
          ? 'task_reminder'
          : sample.event === 'scheduled_summary'
            ? 'scheduled_summary'
            : null
      const msg = messages.create({
        kind: 'notification',
        title: sample.title || '通知',
        body: sample.body || null,
        taskId: sample.event === 'task_reminder' ? sample.entityId || null : null,
        source
      })
      // skipExternalNotify：只补站内，不再次向外发渠道发送。
      this.onInAppPush(msg, { skipExternalNotify: true })
      for (const r of group) ackIds.push(r.id)
    }

    if (ackIds.length) {
      await this.client.ack(ackIds)
    }
  }

  onLoggedOut(): void {
    void this.heartbeat?.release()
    this.heartbeat = null
    this.client = null
  }

  async saveConfig(config: NotificationConfig): Promise<NotificationConfig> {
    const saved = writeNotificationConfig(this.getDataDir(), mergeNotificationConfig(config))
    if (this.client) {
      try {
        await this.client.putConfig(saved)
      } catch (err) {
        console.warn('[notify] push config failed', err)
      }
    }
    return saved
  }

  async listDeliveries() {
    if (this.client) {
      try {
        return await this.client.listDeliveries(50)
      } catch {
        /* fall through */
      }
    }
    const { readLocalDeliveryLog } = await import('../db/notification-config-store')
    return readLocalDeliveryLog(this.getDataDir())
  }

  async listPending() {
    const { listLocalPending, mergePendingLists } = await import('./notify-pending')
    const local = listLocalPending(this.getDb(), this.getDataDir())
    if (!this.client) return local
    try {
      const server = await this.client.listPending(50)
      return mergePendingLists(local, server)
    } catch {
      return local
    }
  }

  /** 到点冲刷本机免打扰延后队列 */
  async flushDeferred(): Promise<void> {
    const { readDeferredNotifies, removeDeferredNotify } = await import(
      '../db/notification-deferred-store'
    )
    const now = Date.now()
    for (const item of readDeferredNotifies(this.getDataDir())) {
      if (new Date(item.deferredTo).getTime() > now) continue
      await this.dispatcher().dispatch({
        event: item.event,
        title: item.title,
        body: item.body,
        entityId: item.entityId,
        fireAt: item.fireAt,
        skipTray: true
      })
      removeDeferredNotify(this.getDataDir(), item.event, item.entityId, item.fireAt)
    }
  }

  /** 从服务端拉取渠道配置写入本机（不上传） */
  private async pullConfigFromServer(): Promise<void> {
    if (!this.client) return
    const remote = await this.client.getConfig()
    const local = readNotificationConfig(this.getDataDir())
    writeNotificationConfig(this.getDataDir(), applyServerChannelConfig(local, remote))
  }

  private async relayIfLoggedIn(payload: NotifyDispatchPayload): Promise<boolean> {
    const creds = readSyncCredentials(this.getDataDir())
    if (!creds?.accessToken || !this.client) {
      // 尝试从状态恢复 client
      const state = ensureSyncState(this.getDb())
      if (!creds?.accessToken || !state.serverBaseUrl) return false
      this.client = new NotifyApiClient(state.serverBaseUrl, creds.accessToken)
    }
    const key = `${payload.event}#${payload.entityId}#${payload.firedAt}`
    await this.client.dispatch(payload, key)
    return true
  }
}

let runtime: NotifyRuntime | null = null

export function getNotifyRuntime(
  getDb: () => Database.Database,
  getDataDir: () => string
): NotifyRuntime {
  if (!runtime) {
    runtime = new NotifyRuntime(getDb, getDataDir)
  }
  return runtime
}

export function resetNotifyRuntimeForTests(): void {
  runtime = null
}
