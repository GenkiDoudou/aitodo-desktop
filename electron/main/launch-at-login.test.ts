import { describe, expect, it, vi } from 'vitest'
import { applyLaunchAtLoginToSystem, reconcileLaunchAtLoginPrefs } from './launch-at-login'

describe('launch-at-login main', () => {
  it('apply enables openAtLogin with hidden args for tray', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: true, startupMode: 'tray' },
      { setLoginItemSettings: set, getLoginItemSettings: () => ({ openAtLogin: false }) }
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden']
      })
    )
  })

  it('apply disables login item', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: false, startupMode: 'tray' },
      { setLoginItemSettings: set, getLoginItemSettings: () => ({ openAtLogin: true }) }
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: false,
        args: []
      })
    )
  })

  it('apply window mode without hidden', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: true, startupMode: 'window' },
      { setLoginItemSettings: set, getLoginItemSettings: () => ({ openAtLogin: false }) }
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: false,
        args: []
      })
    )
  })

  it('reconcile syncs enabled from system', () => {
    const result = reconcileLaunchAtLoginPrefs(
      { enabled: true, startupMode: 'tray' },
      { getLoginItemSettings: () => ({ openAtLogin: false }) }
    )
    expect(result.syncedFromSystem).toBe(true)
    expect(result.prefs.enabled).toBe(false)
  })
})
