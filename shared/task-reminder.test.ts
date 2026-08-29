import { describe, expect, it } from 'vitest'
import {
  buildRemindersFromOffsets,
  customOffsetToMinutes,
  nextDueAfterRecurrence,
  remindAtFromDueOffset
} from './task-reminder'

describe('task-reminder', () => {
  it('remindAtFromDueOffset subtracts minutes', () => {
    expect(remindAtFromDueOffset('2026-07-03T22:30:00', 30)).toBe('2026-07-03T22:00:00')
  })

  it('buildRemindersFromOffsets dedupes offsets', () => {
    const list = buildRemindersFromOffsets('2026-07-03T10:00:00', [0, 5, 5, 60])
    expect(list).toHaveLength(3)
  })

  it('customOffsetToMinutes converts units', () => {
    expect(customOffsetToMinutes(2, 'hour')).toBe(120)
    expect(customOffsetToMinutes(1, 'week')).toBe(7 * 24 * 60)
  })

  it('nextDueAfterRecurrence advances daily', () => {
    const next = nextDueAfterRecurrence('2026-07-03T10:00:00', { type: 'daily' })
    expect(next).toBe('2026-07-04T10:00:00')
  })

  it('nextDueAfterRecurrence custom interval', () => {
    const next = nextDueAfterRecurrence('2026-07-03T10:00:00', {
      type: 'custom',
      interval: 2,
      unit: 'week'
    })
    expect(next).toBe('2026-07-17T10:00:00')
  })

  it('nextDueAfterRecurrence legal_holidays returns null for async path', () => {
    const next = nextDueAfterRecurrence('2026-07-03T10:00:00', { type: 'legal_holidays' })
    expect(next).toBeNull()
  })
})
