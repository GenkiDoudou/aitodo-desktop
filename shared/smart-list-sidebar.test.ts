import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES,
  isSmartListSidebarItemVisible,
  normalizeSmartListSidebarPreferences
} from './smart-list-sidebar'

describe('smart-list-sidebar', () => {
  it('isSmartListSidebarItemVisible respects show/hide/when_nonempty', () => {
    expect(isSmartListSidebarItemVisible('show', 0)).toBe(true)
    expect(isSmartListSidebarItemVisible('hide', 5)).toBe(false)
    expect(isSmartListSidebarItemVisible('when_nonempty', 0)).toBe(false)
    expect(isSmartListSidebarItemVisible('when_nonempty', 2)).toBe(true)
  })

  it('normalizeSmartListSidebarPreferences fills missing keys', () => {
    const merged = normalizeSmartListSidebarPreferences({ all: 'show' })
    expect(merged.all).toBe('show')
    expect(merged.today).toBe(DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES.today)
  })
})
