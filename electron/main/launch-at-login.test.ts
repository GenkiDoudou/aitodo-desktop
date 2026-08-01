import { describe, expect, it, vi } from 'vitest'
import { applyLaunchAtLoginToSystem, reconcileLaunchAtLoginPrefs } from './launch-at-login'

describe('launch-at-login main', () => {
  it('apply enables openAtLogin with hidden args for tray', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: true, startupMode: 'tray' },
      { setLoginItemSettings: set }
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden']
      })
    )
  })

  it('apply enables openAtLogin without hidden for window mode', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: true, startupMode: 'window' },
      { setLoginItemSettings: set }
    )
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        openAtLogin: true,
        openAsHidden: false,
        args: []
      })
    )
  })

  it('apply disables openAtLogin', () => {
    const set = vi.fn()
    applyLaunchAtLoginToSystem(
      { enabled: false, startupMode: 'tray' },
      { setLoginItemSettings: set }
    )
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ openAtLogin: false }))
  })

  it('reconcile prefers system openAtLogin', () => {
    const get = vi.fn(() => ({ openAtLogin: false, openAsHidden: false }))
    const local = { enabled: true, startupMode: 'tray' as const }
    const { prefs, changed } = reconcileLaunchAtLoginPrefs(local, {
      getLoginItemSettings: get
    })
    expect(changed).toBe(true)
    expect(prefs.enabled).toBe(false)
  })
})
