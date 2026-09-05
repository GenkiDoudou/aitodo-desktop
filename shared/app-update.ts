/** 桌面自动更新：状态与安装形态（Main / Renderer 共享） */

export type InstallShape = 'nsis' | 'portable-dir' | 'mac'

export type UpdateFeedSource = 'github'

export type AppUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'applying'
  | 'up-to-date'
  | 'error'

export interface AppUpdateStatus {
  state: AppUpdateState
  currentVersion: string
  availableVersion: string | null
  installShape: InstallShape
  feedSource: UpdateFeedSource | null
  /** 0–100；未知时为 null */
  progress: number | null
  errorMessage: string | null
  message: string | null
}

export function createIdleUpdateStatus(
  currentVersion: string,
  installShape: InstallShape
): AppUpdateStatus {
  return {
    state: 'idle',
    currentVersion,
    availableVersion: null,
    installShape,
    feedSource: null,
    progress: null,
    errorMessage: null,
    message: null
  }
}

/** 关于页「更新日志」单条（来自公开仓 Release Body） */
export interface AppReleaseChangelogItem {
  tag: string
  title: string
  body: string
  publishedAt: string | null
  htmlUrl: string | null
}

export interface AppReleaseChangelogResult {
  source: UpdateFeedSource
  items: AppReleaseChangelogItem[]
}
