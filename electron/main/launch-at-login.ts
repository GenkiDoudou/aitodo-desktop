import type { LaunchAtLoginPrefs } from '@shared/launch-at-login'
import { mergeLaunchAtLoginPrefs } from '@shared/launch-at-login'

/** 可注入的 Electron app 子集，便于单测 mock */
export type LoginItemApp = {
  setLoginItemSettings: (settings: {
    openAtLogin: boolean
    openAsHidden?: boolean
    args?: string[]
  }) => void
  getLoginItemSettings: () => {
    openAtLogin: boolean
    wasOpenedAsHidden?: boolean
    wasOpenedAtLogin?: boolean
  }
}

/**
 * 将偏好写入系统登录项。
 * 托盘模式：mac 用 openAsHidden；Win 等用启动参数 --hidden。
 */
export function applyLaunchAtLoginToSystem(prefs: LaunchAtLoginPrefs, electronApp: LoginItemApp): void {
  const merged = mergeLaunchAtLoginPrefs(prefs)
  if (!merged.enabled) {
    electronApp.setLoginItemSettings({
      openAtLogin: false,
      openAsHidden: false,
      args: []
    })
    return
  }
  const hidden = merged.startupMode === 'tray'
  electronApp.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: hidden,
    args: hidden ? ['--hidden'] : []
  })
}

/**
 * 打开设置时对读系统登录项：以系统 openAtLogin 为准纠偏本地 enabled。
 * @returns syncedFromSystem=true 表示本地与系统不一致已纠偏
 */
export function reconcileLaunchAtLoginPrefs(
  local: LaunchAtLoginPrefs,
  electronApp: Pick<LoginItemApp, 'getLoginItemSettings'>
): { prefs: LaunchAtLoginPrefs; syncedFromSystem: boolean } {
  const merged = mergeLaunchAtLoginPrefs(local)
  let systemOpen = false
  try {
    systemOpen = Boolean(electronApp.getLoginItemSettings().openAtLogin)
  } catch {
    return { prefs: merged, syncedFromSystem: false }
  }
  if (systemOpen === merged.enabled) {
    return { prefs: merged, syncedFromSystem: false }
  }
  return {
    prefs: { ...merged, enabled: systemOpen },
    syncedFromSystem: true
  }
}
