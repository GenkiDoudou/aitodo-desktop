import { describe, expect, it } from 'vitest'
import {
  buildHolidayCalendarMap,
  buildLegalHolidayDateMap,
  findNextLegalHolidayDueAfter
} from './timor-holiday'

describe('timor-holiday', () => {
  it('buildHolidayCalendarMap keeps holidays and makeup workdays', () => {
    const map = buildHolidayCalendarMap(
      {
        code: 0,
        holiday: {
          '10-01': { holiday: true, name: '国庆节' },
          '10-07': { holiday: false, name: '国庆后补班' }
        }
      },
      2026
    )
    expect(map.get('2026-10-01')).toEqual({
      date: '2026-10-01',
      kind: 'holiday',
      name: '国庆节'
    })
    expect(map.get('2026-10-07')).toEqual({
      date: '2026-10-07',
      kind: 'workday',
      name: '国庆后补班'
    })
  })

  it('buildLegalHolidayDateMap keeps only legal holidays', () => {
    const map = buildLegalHolidayDateMap(
      {
        code: 0,
        holiday: {
          '10-01': { holiday: true, name: '国庆节' },
          '10-07': { holiday: false, name: '国庆后补班' }
        }
      },
      2026
    )
    expect(map.has('2026-10-01')).toBe(true)
    expect(map.has('2026-10-07')).toBe(false)
  })

  it('findNextLegalHolidayDueAfter finds next holiday date', () => {
    const yearMaps = new Map([
      [
        2026,
        new Map([
          ['2026-10-01', { holiday: true, name: '国庆节' }],
          ['2026-10-02', { holiday: true, name: '国庆节' }]
        ])
      ]
    ])
    const next = findNextLegalHolidayDueAfter('2026-09-28T09:00:00', yearMaps)
    expect(next).toBe('2026-10-01T09:00:00')
  })
})
