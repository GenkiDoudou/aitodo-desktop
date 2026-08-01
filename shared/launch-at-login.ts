export type LaunchStartupMode = 'window' | 'tray'

export interface LaunchAtLoginPrefs {
  enabled: boolean
  startupMode: LaunchStartupMode
}

export const DEFAULT_LAUNCH_AT_LOGIN: LaunchAtLoginPrefs = {
  enabled: false,
  startupMode: 'tray'
}

export function mergeLaunchAtLoginPrefs(raw?: unknown): LaunchAtLoginPrefs {
  const base = { ...DEFAULT_LAUNCH_AT_LOGIN }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : base.enabled,
    startupMode: o.startupMode === 'window' || o.startupMode === 'tray' ? o.startupMode : base.startupMode
  }
}

export function shouldStartHidden(input: {
  prefs: LaunchAtLoginPrefs
  argv: string[]
  wasOpenedAsHidden?: boolean
  wasOpenedAtLogin?: boolean
}): boolean {
  if (!input.prefs.enabled || input.prefs.startupMode !== 'tray') return false
  if (input.argv.includes('--hidden')) return true
  if (input.wasOpenedAsHidden) return true
  if (input.wasOpenedAtLogin) return true
  return false
}
