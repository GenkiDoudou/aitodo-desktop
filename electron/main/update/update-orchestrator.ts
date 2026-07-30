import { app, BrowserWindow, Notification } from 'electron'
import { IPC } from '@shared/ipc-channels'
import {
  createIdleUpdateStatus,
  type AppUpdateStatus,
  type AppUpdateState,
  type InstallShape
} from '@shared/app-update'
import { FeedResolver } from './feed-resolver'
import { detectInstallShape } from './install-shape-detector'
import { NsisMacUpdater } from './nsis-mac-updater'
import { PortableZipUpdater } from './portable-zip-updater'

const AUTO_CHECK_DELAY_MS = 8_000

export type UpdateStatusListener = (status: AppUpdateStatus) => void

/**
 * 统一更新编排：形态检测、双源、状态机、dev no-op。
 */
export class UpdateOrchestrator {
  private status: AppUpdateStatus
  private readonly listeners = new Set<UpdateStatusListener>()
  private readonly feedResolver: FeedResolver
  private readonly installShape: InstallShape
  private nsisMac: NsisMacUpdater | null = null
  private portable: PortableZipUpdater | null = null
  private autoCheckTimer: ReturnType<typeof setTimeout> | null = null
  private busy = false
  private getMainWindow: () => BrowserWindow | null = () => null

  constructor(options?: { feedResolver?: FeedResolver }) {
    this.feedResolver = options?.feedResolver ?? new FeedResolver()
    this.installShape = detectInstallShape({
      platform: process.platform,
      isPackaged: app.isPackaged,
      execPath: process.execPath
    })
    this.status = createIdleUpdateStatus(app.getVersion(), this.installShape)
    this.initBackends()
  }

  private initBackends(): void {
    if (this.installShape === 'portable-dir') {
      this.portable = new PortableZipUpdater({
        feedResolver: this.feedResolver,
        getCurrentVersion: () => app.getVersion(),
        getExecPath: () => process.execPath
      })
      this.portable.setHooks({
        onChecking: () => this.patch({ state: 'checking', errorMessage: null, message: '正在检查更新…' }),
        onAvailable: (version, source) =>
          this.patch({
            state: 'available',
            availableVersion: version,
            feedSource: source,
            message: `发现新版本 ${version}`
          }),
        onProgress: (progress) => this.patch({ state: 'downloading', progress }),
        onReady: (version, source) => {
          this.patch({
            state: 'ready',
            availableVersion: version,
            feedSource: source,
            progress: 100,
            message: '更新已下载，重启后生效'
          })
          this.notifyReady()
        },
        onUpToDate: () =>
          this.patch({
            state: 'up-to-date',
            availableVersion: null,
            progress: null,
            message: '已是最新版本'
          }),
        onError: (errorMessage) => this.patch({ state: 'error', errorMessage, message: null })
      })
      return
    }

    this.nsisMac = new NsisMacUpdater({
      feedResolver: this.feedResolver,
      kind: this.installShape === 'mac' ? 'mac' : 'nsis',
      getCurrentVersion: () => app.getVersion()
    })
    this.nsisMac.setHooks({
      onChecking: () => this.patch({ state: 'checking', errorMessage: null, message: '正在检查更新…' }),
      onAvailable: (version, source) =>
        this.patch({
          state: 'available',
          availableVersion: version,
          feedSource: source,
          message: `发现新版本 ${version}`
        }),
      onProgress: (progress) => this.patch({ state: 'downloading', progress }),
      onDownloaded: (version) => {
        this.patch({
          state: 'ready',
          availableVersion: version,
          progress: 100,
          message: '更新已下载，重启后生效'
        })
        this.notifyReady()
      },
      onUpToDate: () =>
        this.patch({
          state: 'up-to-date',
          availableVersion: null,
          progress: null,
          message: '已是最新版本'
        }),
      onError: (errorMessage) => this.patch({ state: 'error', errorMessage, message: null })
    })
  }

  setMainWindowGetter(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter
  }

  getStatus(): AppUpdateStatus {
    return { ...this.status }
  }

  subscribe(listener: UpdateStatusListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => this.listeners.delete(listener)
  }

  /** 启动后延迟自动检查；dev / 未打包不下载 */
  scheduleAutoCheck(): void {
    if (!app.isPackaged) return
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer)
    this.autoCheckTimer = setTimeout(() => {
      void this.checkForUpdates({ manual: false })
    }, AUTO_CHECK_DELAY_MS)
  }

  async checkForUpdates(options?: { manual?: boolean }): Promise<AppUpdateStatus> {
    const manual = options?.manual === true
    if (!app.isPackaged) {
      this.patch({
        state: 'up-to-date',
        message: manual ? '开发模式不检查线上更新' : null,
        errorMessage: null
      })
      return this.getStatus()
    }
    if (this.busy) return this.getStatus()
    this.busy = true
    try {
      if (this.portable) {
        await this.portable.checkAndDownload()
      } else if (this.nsisMac) {
        await this.nsisMac.checkAndDownload()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.patch({ state: 'error', errorMessage, message: null })
      if (!manual) {
        console.warn('[aiTodo] 自动检查更新失败', errorMessage)
      }
    } finally {
      this.busy = false
    }
    return this.getStatus()
  }

  quitAndInstall(): void {
    if (this.status.state !== 'ready') {
      throw new Error('当前没有待安装的更新')
    }
    this.patch({ state: 'applying', message: '正在应用更新…' })
    if (this.installShape === 'portable-dir') {
      app.relaunch()
      app.exit(0)
      return
    }
    this.nsisMac?.quitAndInstall()
  }

  private notifyReady(): void {
    try {
      if (Notification.isSupported()) {
        const n = new Notification({
          title: '小柒todo',
          body: `新版本 ${this.status.availableVersion ?? ''} 已就绪，可重启更新`
        })
        n.on('click', () => {
          const win = this.getMainWindow()
          win?.show()
          win?.focus()
          win?.webContents.send(IPC.APP_NAVIGATE, '/settings?section=about')
        })
        n.show()
      }
    } catch {
      /* 通知失败忽略 */
    }
  }

  private patch(partial: Partial<AppUpdateStatus> & { state?: AppUpdateState }): void {
    this.status = { ...this.status, ...partial }
    const snap = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(snap)
      } catch {
        /* ignore */
      }
    }
    const win = this.getMainWindow()
    win?.webContents.send(IPC.APP_UPDATE_STATUS, snap)
  }
}

let singleton: UpdateOrchestrator | null = null

export function getUpdateOrchestrator(): UpdateOrchestrator {
  if (!singleton) singleton = new UpdateOrchestrator()
  return singleton
}

/** 测试用：重置单例 */
export function resetUpdateOrchestratorForTests(): void {
  singleton = null
}

/** 尽早应用免解压 pending（应在 app ready 后、创建窗口前调用） */
export function applyPortableUpdateIfPending(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return
  try {
    const result = PortableZipUpdater.applyPendingIfAny(process.execPath)
    if (result.applied) {
      console.log('[aiTodo] 已应用免解压更新', result.version)
    }
  } catch (err) {
    console.error('[aiTodo] 免解压更新应用失败，继续使用当前版本', err)
  }
}
