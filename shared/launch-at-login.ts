/**
 * 开机自启偏好：与 Electron `app.setLoginItemSettings` 对齐。
 * 真正生效依赖本机登录项；本地 config 用于 UI 与启动时是否隐藏主窗。
 */

export type LaunchStartupMode = 'window' | 'tray'

export type LaunchAtLoginPrefs = {
  /** 是否在系统登录后自动启动应用 */
  enabled: boolean
  /** 自启后：打开主窗口 / 静默到托盘（仅 enabled 时有意义） */
  startupMode: LaunchStartupMode
}

export const DEFAULT_LAUNCH_AT_LOGIN: LaunchAtLoginPrefs = {
  enabled: false,
  startupMode: 'tray'
}

/** 合并非法/缺失字段为合法偏好 */
export function mergeLaunchAtLoginPrefs(
  raw?: Partial<LaunchAtLoginPrefs> | null
): LaunchAtLoginPrefs {
  const enabled = raw?.enabled === true
  const startupMode: LaunchStartupMode =
    raw?.startupMode === 'window' || raw?.startupMode === 'tray'
      ? raw.startupMode
      : DEFAULT_LAUNCH_AT_LOGIN.startupMode
  return { enabled, startupMode }
}

/**
 * 是否应在启动时隐藏主窗口（仅登录项拉起 + 偏好为托盘时）。
 * 用户手动打开应用时 argv 通常无 --hidden，始终显示主窗。
 */
export function shouldStartHidden(
  argv: readonly string[],
  loginItem: { wasOpenedAsHidden?: boolean; wasOpenedAtLogin?: boolean },
  prefs: LaunchAtLoginPrefs
): boolean {
  if (!prefs.enabled || prefs.startupMode !== 'tray') {
    return false
  }
  if (argv.includes('--hidden')) {
    return true
  }
  if (loginItem.wasOpenedAsHidden === true) {
    return true
  }
  // Windows 部分版本只报 wasOpenedAtLogin
  return loginItem.wasOpenedAtLogin === true
}
