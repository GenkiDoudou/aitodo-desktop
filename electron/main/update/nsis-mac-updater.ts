import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateFeedSource } from '@shared/app-update'
import type { FeedResolver } from './feed-resolver'
import { compareSemver } from './update-yml'

export interface NsisMacUpdaterHooks {
  onChecking?: () => void
  onAvailable?: (version: string, source: UpdateFeedSource) => void
  onProgress?: (percent: number) => void
  onDownloaded?: (version: string) => void
  onUpToDate?: () => void
  onError?: (message: string) => void
}

/**
 * 封装 electron-updater：NSIS / macOS（generic feed + 双源由 FeedResolver 选定）。
 */
export class NsisMacUpdater {
  private readonly feedResolver: FeedResolver
  private readonly kind: 'nsis' | 'mac'
  private readonly getCurrentVersion: () => string
  private hooks: NsisMacUpdaterHooks = {}
  private bound = false

  constructor(options: {
    feedResolver: FeedResolver
    kind: 'nsis' | 'mac'
    getCurrentVersion: () => string
  }) {
    this.feedResolver = options.feedResolver
    this.kind = options.kind
    this.getCurrentVersion = options.getCurrentVersion
  }

  setHooks(hooks: NsisMacUpdaterHooks): void {
    this.hooks = hooks
  }

  private ensureListeners(): void {
    if (this.bound) return
    this.bound = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowDowngrade = false

    autoUpdater.on('checking-for-update', () => this.hooks.onChecking?.())
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.hooks.onAvailable?.(info.version, this.lastSource)
    })
    autoUpdater.on('update-not-available', () => this.hooks.onUpToDate?.())
    autoUpdater.on('download-progress', (p) => {
      this.hooks.onProgress?.(Math.round(p.percent))
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.hooks.onDownloaded?.(info.version)
    })
    autoUpdater.on('error', (err) => {
      this.hooks.onError?.(err instanceof Error ? err.message : String(err))
    })
  }

  private lastSource: UpdateFeedSource = 'gitee'

  async checkAndDownload(): Promise<void> {
    this.ensureListeners()
    const feed = await this.feedResolver.resolve(this.kind)
    this.lastSource = feed.source
    if (compareSemver(feed.manifest.version, this.getCurrentVersion()) <= 0) {
      this.hooks.onUpToDate?.()
      return
    }
    this.hooks.onAvailable?.(feed.manifest.version, feed.source)
    autoUpdater.setFeedURL({ provider: 'generic', url: feed.baseUrl })
    await autoUpdater.checkForUpdates()
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }
}
