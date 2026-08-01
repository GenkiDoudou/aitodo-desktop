import type { LaunchAtLoginPrefs } from '@shared/launch-at-login'
import { mergeLaunchAtLoginPrefs } from '@shared/launch-at-login'

type LoginItemApi = {
  setLoginItemSettings: (s: {
    openAtLogin?: boolean
    openAsHidden?: boolean
    args?: string[]
  }) => void
  getLoginItemSettings: () => {
    openAtLogin: boolean
    openAsHidden: boolean
  }
}

export function applyLaunchAtLoginToSystem(
  prefs: LaunchAtLoginPrefs,
  api: Pick<LoginItemApi, 'setLoginItemSettings'>
): void {
  const p = mergeLaunchAtLoginPrefs(prefs)
  if (!p.enabled) {
    api.setLoginItemSettings({ openAtLogin: false, openAsHidden: false, args: [] })
    return
  }
  const hidden = p.startupMode === 'tray'
  api.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: hidden,
    args: hidden ? ['--hidden'] : []
  })
}

export function reconcileLaunchAtLoginPrefs(
  local: LaunchAtLoginPrefs,
  api: Pick<LoginItemApi, 'getLoginItemSettings'>
): { prefs: LaunchAtLoginPrefs; changed: boolean } {
  const sys = api.getLoginItemSettings()
  const next = mergeLaunchAtLoginPrefs({
    ...local,
    enabled: Boolean(sys.openAtLogin)
  })
  const changed = next.enabled !== local.enabled
  return { prefs: next, changed }
}
