import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import extractZip from 'extract-zip'
import type { UpdateFeedSource } from '@shared/app-update'
import type { FeedResolver } from './feed-resolver'
import {
  portablePendingPath,
  portableStagingPath,
  resolveAppRootDir
} from './install-shape-detector'
import {
  applyPortableStaging,
  assertSha512Match,
  ensureEmptyDir,
  removeDirForce,
  sha512FileBase64,
  withNoAsarAsync,
  writePendingMarker,
  type PortablePendingMarker
} from './portable-fs'
import { compareSemver } from './update-yml'

export interface PortableZipUpdaterHooks {
  onChecking?: () => void
  onAvailable?: (version: string, source: UpdateFeedSource) => void
  onProgress?: (percent: number) => void
  onReady?: (version: string, source: UpdateFeedSource) => void
  onUpToDate?: () => void
  onError?: (message: string) => void
}

export type DownloadToFile = (
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
) => Promise<void>

/**
 * Windows 免解压：下载完整 zip → sha512 → staging → pending。
 */
export class PortableZipUpdater {
  private readonly feedResolver: FeedResolver
  private readonly getCurrentVersion: () => string
  private readonly getExecPath: () => string
  private readonly downloadToFile: DownloadToFile
  private hooks: PortableZipUpdaterHooks = {}

  constructor(options: {
    feedResolver: FeedResolver
    getCurrentVersion: () => string
    getExecPath: () => string
    downloadToFile?: DownloadToFile
  }) {
    this.feedResolver = options.feedResolver
    this.getCurrentVersion = options.getCurrentVersion
    this.getExecPath = options.getExecPath
    this.downloadToFile = options.downloadToFile ?? defaultDownloadToFile
  }

  setHooks(hooks: PortableZipUpdaterHooks): void {
    this.hooks = hooks
  }

  async checkAndDownload(): Promise<void> {
    this.hooks.onChecking?.()
    const feed = await this.feedResolver.resolve('portable')
    if (compareSemver(feed.manifest.version, this.getCurrentVersion()) <= 0) {
      this.hooks.onUpToDate?.()
      return
    }
    this.hooks.onAvailable?.(feed.manifest.version, feed.source)

    const appRoot = resolveAppRootDir(this.getExecPath())
    const stagingDir = portableStagingPath(appRoot)
    ensureEmptyDir(stagingDir)
    const zipPath = join(stagingDir, feed.manifest.path)

    try {
      await this.downloadToFile(feed.assetUrl, zipPath, (p) => this.hooks.onProgress?.(p))
      const actual = sha512FileBase64(zipPath, (p) => readFileSync(p))
      assertSha512Match(actual, feed.manifest.sha512)
      const extractDir = join(stagingDir, '_extracted')
      ensureEmptyDir(extractDir)
      // Electron 会拦截对 .asar 的 fs 写入；解压免解压包内 app.asar 必须临时 noAsar
      await withNoAsarAsync(() => extractZip(zipPath, { dir: extractDir }))
      rmSync(zipPath, { force: true })
      const marker: PortablePendingMarker = {
        version: feed.manifest.version,
        stagingDir: extractDir,
        createdAt: new Date().toISOString()
      }
      writePendingMarker(portablePendingPath(appRoot), marker)
      this.hooks.onReady?.(feed.manifest.version, feed.source)
    } catch (err) {
      try {
        removeDirForce(stagingDir)
        rmSync(portablePendingPath(appRoot), { force: true })
      } catch {
        /* ignore cleanup */
      }
      throw err
    }
  }

  /** 启动时若有 pending，则应用并清理；失败抛错且不删用户 data */
  static applyPendingIfAny(execPath: string): { applied: boolean; version?: string } {
    const appRoot = resolveAppRootDir(execPath)
    const pendingFile = portablePendingPath(appRoot)
    if (!existsSync(pendingFile)) return { applied: false }
    let marker: PortablePendingMarker
    try {
      marker = JSON.parse(readFileSync(pendingFile, 'utf8')) as PortablePendingMarker
    } catch {
      rmSync(pendingFile, { force: true })
      return { applied: false }
    }
    applyPortableStaging(appRoot, marker.stagingDir)
    rmSync(pendingFile, { force: true })
    const stagingParent = portableStagingPath(appRoot)
    removeDirForce(stagingParent)
    return { applied: true, version: marker.version }
  }
}

async function defaultDownloadToFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': 'ai-todo-desktop-updater' } })
  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status}`)
  }
  onProgress?.(10)
  const buf = Buffer.from(await res.arrayBuffer())
  mkdirSync(join(destPath, '..'), { recursive: true })
  writeFileSync(destPath, buf)
  onProgress?.(100)
}
