import { describe, expect, it } from 'vitest'
import {
  cancelDeferredHideNativeDesktopIcons,
  isHideIconsDeferGenerationCurrent,
  nextHideIconsDeferGeneration,
  __testShellOpGeneration
} from './desktop-shell'

describe('desktop-shell hideIcons defer generation', () => {
  it('cancelInvalidatesPendingDeferGeneration', () => {
    const gen = nextHideIconsDeferGeneration()
    expect(isHideIconsDeferGenerationCurrent(gen)).toBe(true)
    cancelDeferredHideNativeDesktopIcons()
    expect(isHideIconsDeferGenerationCurrent(gen)).toBe(false)
  })

  it('newDeferGenerationIsCurrent', () => {
    cancelDeferredHideNativeDesktopIcons()
    const gen = nextHideIconsDeferGeneration()
    expect(isHideIconsDeferGenerationCurrent(gen)).toBe(true)
    expect(isHideIconsDeferGenerationCurrent(gen - 1)).toBe(false)
  })
})

describe('desktop-shell shell op generation', () => {
  it('cancelInvalidatesInFlightShellOps', () => {
    const { invalidateShellOps, isShellOpGenerationCurrent } = __testShellOpGeneration()
    const gen = invalidateShellOps()
    expect(isShellOpGenerationCurrent(gen)).toBe(true)
    cancelDeferredHideNativeDesktopIcons()
    expect(isShellOpGenerationCurrent(gen)).toBe(false)
  })
})
