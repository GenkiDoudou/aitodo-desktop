import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAUNCH_AT_LOGIN,
  mergeLaunchAtLoginPrefs,
  shouldStartHidden
} from './launch-at-login'

describe('launch-at-login', () => {
  it('merge defaults and rejects invalid', () => {
    expect(mergeLaunchAtLoginPrefs(undefined)).toEqual(DEFAULT_LAUNCH_AT_LOGIN)
    expect(mergeLaunchAtLoginPrefs({ enabled: true, startupMode: 'window' })).toEqual({
      enabled: true,
      startupMode: 'window'
    })
    expect(mergeLaunchAtLoginPrefs({ enabled: true, startupMode: 'nope' as never }).startupMode).toBe(
      'tray'
    )
  })

  it('shouldStartHidden only for login-item tray launches', () => {
    const trayOn = { enabled: true, startupMode: 'tray' as const }
    expect(
      shouldStartHidden({
        prefs: trayOn,
        argv: ['--hidden'],
        wasOpenedAsHidden: false,
        wasOpenedAtLogin: false
      })
    ).toBe(true)
    expect(
      shouldStartHidden({
        prefs: trayOn,
        argv: [],
        wasOpenedAsHidden: true,
        wasOpenedAtLogin: true
      })
    ).toBe(true)
    expect(
      shouldStartHidden({
        prefs: trayOn,
        argv: [],
        wasOpenedAsHidden: false,
        wasOpenedAtLogin: true
      })
    ).toBe(true)
    expect(
      shouldStartHidden({
        prefs: trayOn,
        argv: [],
        wasOpenedAsHidden: false,
        wasOpenedAtLogin: false
      })
    ).toBe(false)
    expect(
      shouldStartHidden({
        prefs: { enabled: true, startupMode: 'window' },
        argv: ['--hidden'],
        wasOpenedAsHidden: true,
        wasOpenedAtLogin: true
      })
    ).toBe(false)
    expect(
      shouldStartHidden({
        prefs: { enabled: false, startupMode: 'tray' },
        argv: ['--hidden'],
        wasOpenedAsHidden: true,
        wasOpenedAtLogin: true
      })
    ).toBe(false)
  })
})
