import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import type { FilterNode } from './task-filter-ast'
import {
  inferTimelineCalendarPreset,
  resolveTimelineCalendarRange
} from './timeline-range'

describe('timeline-range', () => {
  it('infers week/month from filter rel', () => {
    const week: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'dueAt', op: 'rel', value: 'week' }]
    }
    const month: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'createdAt', op: 'rel', value: 'month' }]
    }
    expect(inferTimelineCalendarPreset(week)).toBe('week')
    expect(inferTimelineCalendarPreset(month)).toBe('month')
    expect(inferTimelineCalendarPreset(null)).toBe(null)
  })

  it('resolves week as Monday–Sunday and month as full calendar month', () => {
    // 2026-07-10 周五
    const now = dayjs('2026-07-10T12:00:00')
    const week = resolveTimelineCalendarRange('week', now)
    expect(week.start.format('YYYY-MM-DD')).toBe('2026-07-06')
    expect(week.end.format('YYYY-MM-DD')).toBe('2026-07-12')
    expect(week.dayCount).toBe(7)

    const month = resolveTimelineCalendarRange('month', now)
    expect(month.start.format('YYYY-MM-DD')).toBe('2026-07-01')
    expect(month.end.format('YYYY-MM-DD')).toBe('2026-07-31')
    expect(month.dayCount).toBe(31)
  })
})
