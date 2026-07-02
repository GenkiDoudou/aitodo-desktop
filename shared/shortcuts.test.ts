import { describe, expect, it } from 'vitest'
import {
  eventMatchesAccelerator,
  findShortcutConflicts,
  getDefaultShortcutBindings,
  mergeShortcutBindings,
  normalizeAccelerator,
  parseAccelerator,
  toElectronAccelerator
} from './shortcuts'

describe('shortcuts', () => {
  it('mergeShortcutBindings fills defaults', () => {
    const merged = mergeShortcutBindings({ newTask: 'Mod+T' })
    expect(merged.newTask).toBe('Mod+T')
    expect(merged.openSettings).toBe('Mod+,')
  })

  it('normalizeAccelerator normalizes tokens', () => {
    expect(normalizeAccelerator(' mod + n ')).toBe('Mod+N')
    expect(normalizeAccelerator('ctrl+shift+a')).toBe('Ctrl+Shift+A')
  })

  it('parseAccelerator extracts modifiers', () => {
    expect(parseAccelerator('Mod+Shift+N')).toEqual({
      mod: true,
      ctrl: false,
      alt: false,
      shift: true,
      key: 'n'
    })
  })

  it('toElectronAccelerator converts Mod', () => {
    expect(toElectronAccelerator('Mod+N')).toBe('CommandOrControl+N')
    expect(toElectronAccelerator('Mod+,')).toBe('CommandOrControl+Comma')
  })

  it('findShortcutConflicts detects duplicates', () => {
    const bindings = getDefaultShortcutBindings()
    bindings.focusSearch = bindings.newTask
    const conflicts = findShortcutConflicts(bindings)
    expect(conflicts.get('Mod+N')?.length).toBe(2)
  })

  it('eventMatchesAccelerator matches Mod+N', () => {
    const e = {
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(eventMatchesAccelerator(e, 'Mod+N')).toBe(true)
  })
})
