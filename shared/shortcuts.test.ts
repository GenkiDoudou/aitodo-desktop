import { describe, expect, it } from 'vitest'
import {
  eventMatchesAccelerator,
  findActionsUsingAccelerator,
  findShortcutConflicts,
  formatShortcutConflictMessage,
  getDefaultShortcutBindings,
  isShortcutBound,
  listShortcutConflicts,
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

  it('mergeShortcutBindings preserves cleared binding', () => {
    const merged = mergeShortcutBindings({ newTask: '' })
    expect(merged.newTask).toBe('')
    expect(merged.goHome).toBe('Mod+1')
  })

  it('findShortcutConflicts ignores cleared bindings', () => {
    const bindings = getDefaultShortcutBindings()
    bindings.newTask = ''
    bindings.focusSearch = ''
    const conflicts = findShortcutConflicts(bindings)
    expect(conflicts.size).toBe(0)
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

  it('listShortcutConflicts includes labels', () => {
    const bindings = getDefaultShortcutBindings()
    bindings.focusSearch = bindings.newTask
    const list = listShortcutConflicts(bindings)
    expect(list).toHaveLength(1)
    expect(list[0]?.labels).toEqual(expect.arrayContaining(['新建任务', '聚焦快捷添加']))
  })

  it('findActionsUsingAccelerator excludes self', () => {
    const bindings = getDefaultShortcutBindings()
    expect(findActionsUsingAccelerator(bindings, 'Mod+N', 'newTask')).toEqual([])
    expect(findActionsUsingAccelerator(bindings, 'Mod+N')).toEqual(['newTask'])
  })

  it('formatShortcutConflictMessage names occupied actions', () => {
    const msg = formatShortcutConflictMessage('Mod+N', ['newTask'], false)
    expect(msg).toContain('Ctrl+N')
    expect(msg).toContain('新建任务')
  })

  it('eventMatchesAccelerator ignores empty accelerator', () => {
    const e = {
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent
    expect(eventMatchesAccelerator(e, '')).toBe(false)
  })

  it('isShortcutBound detects empty', () => {
    expect(isShortcutBound('')).toBe(false)
    expect(isShortcutBound('Mod+N')).toBe(true)
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
