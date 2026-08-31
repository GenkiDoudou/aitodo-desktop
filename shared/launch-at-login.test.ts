import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAUNCH_AT_LOGIN,
  mergeLaunchAtLoginPrefs,
  shouldStartHidden
} from './launch-at-login'

describe('launch-at-login', () => {
  it('mergeLaunchAtLoginPrefs 默认关闭且托盘模式', () => {
    expect(mergeLaunchAtLoginPrefs(null)).toEqual(DEFAULT_LAUNCH_AT_LOGIN)
    expect(mergeLaunchAtLoginPrefs({})).toEqual(DEFAULT_LAUNCH_AT_LOGIN)
    expect(mergeLaunchAtLoginPrefs({ enabled: true, startupMode: 'window' })).toEqual({
      enabled: true,
      startupMode: 'window'
    })
  })

  it('mergeLaunchAtLoginPrefs 忽略非法 startupMode', () => {
    expect(mergeLaunchAtLoginPrefs({ enabled: true, startupMode: 'x' as never })).toEqual({
      enabled: true,
      startupMode: 'tray'
    })
  })

  it('shouldStartHidden：托盘自启 + --hidden', () => {
    expect(
      shouldStartHidden(['--hidden'], {}, { enabled: true, startupMode: 'tray' })
    ).toBe(true)
  })

  it('shouldStartHidden：未开启或窗口模式不隐藏', () => {
    expect(
      shouldStartHidden(['--hidden'], {}, { enabled: false, startupMode: 'tray' })
    ).toBe(false)
    expect(
      shouldStartHidden(['--hidden'], {}, { enabled: true, startupMode: 'window' })
    ).toBe(false)
  })

  it('shouldStartHidden：wasOpenedAsHidden / wasOpenedAtLogin', () => {
    expect(
      shouldStartHidden([], { wasOpenedAsHidden: true }, { enabled: true, startupMode: 'tray' })
    ).toBe(true)
    expect(
      shouldStartHidden([], { wasOpenedAtLogin: true }, { enabled: true, startupMode: 'tray' })
    ).toBe(true)
  })
})
