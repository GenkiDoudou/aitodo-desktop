import dayjs, { type Dayjs } from 'dayjs'
import { endOfWeekSunday, startOfWeekMonday } from './smart-list'
import {
  normalizeFilterNode,
  type FilterNode,
  type FilterTimeRel
} from './task-filter-ast'

export type TimelineCalendarPreset = 'week' | 'month' | 'rolling'

export interface TimelineCalendarRange {
  start: Dayjs
  /** 含当日 */
  end: Dayjs
  dayCount: number
  preset: TimelineCalendarPreset
}

const TIME_FIELDS = new Set(['dueAt', 'createdAt', 'completedAt'])

/**
 * 从视图筛选推断时间线日历跨度：
 * - rel=week → 本周（周一至周日）
 * - rel=month → 本月
 * - between → 起止日（按天数归为 week/month/rolling 仅用于展示，实际用 between 边界）
 */
export function inferTimelineCalendarPreset(
  node: FilterNode | null | undefined
): TimelineCalendarPreset | null {
  if (!node) return null
  const n = normalizeFilterNode(node)
  if (n.type === 'cond') {
    if (!TIME_FIELDS.has(n.field)) return null
    if (n.op === 'rel') {
      const rel = n.value as FilterTimeRel
      if (rel === 'week') return 'week'
      if (rel === 'month') return 'month'
      return null
    }
    if (n.op === 'between') {
      const v = n.value as { from?: string; to?: string } | null
      if (!v?.from || !v?.to) return null
      const from = dayjs(v.from.slice(0, 10))
      const to = dayjs(v.to.slice(0, 10))
      if (!from.isValid() || !to.isValid()) return null
      const days = to.startOf('day').diff(from.startOf('day'), 'day') + 1
      if (days <= 7) return 'week'
      if (days <= 31) return 'month'
      return 'rolling'
    }
    return null
  }
  for (const child of n.children) {
    const hit = inferTimelineCalendarPreset(child)
    if (hit) return hit
  }
  return null
}

/** 若筛选含 between，优先用其起止作为日历边界 */
export function inferTimelineBetweenRange(
  node: FilterNode | null | undefined
): { start: Dayjs; end: Dayjs } | null {
  if (!node) return null
  const n = normalizeFilterNode(node)
  if (n.type === 'cond') {
    if (!TIME_FIELDS.has(n.field) || n.op !== 'between') return null
    const v = n.value as { from?: string; to?: string } | null
    if (!v?.from || !v?.to) return null
    const start = dayjs(v.from.slice(0, 10)).startOf('day')
    const end = dayjs(v.to.slice(0, 10)).startOf('day')
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) return null
    return { start, end }
  }
  for (const child of n.children) {
    const hit = inferTimelineBetweenRange(child)
    if (hit) return hit
  }
  return null
}

export function resolveTimelineCalendarRange(
  preset: TimelineCalendarPreset,
  now: Dayjs = dayjs(),
  between?: { start: Dayjs; end: Dayjs } | null
): TimelineCalendarRange {
  if (between) {
    const start = between.start.startOf('day')
    const end = between.end.startOf('day')
    return {
      start,
      end,
      dayCount: Math.max(1, end.diff(start, 'day') + 1),
      preset
    }
  }
  if (preset === 'week') {
    const start = startOfWeekMonday(now)
    const end = endOfWeekSunday(now).startOf('day')
    return { start, end, dayCount: 7, preset: 'week' }
  }
  if (preset === 'month') {
    const start = now.startOf('month')
    const end = now.endOf('month').startOf('day')
    return {
      start,
      end,
      dayCount: end.diff(start, 'day') + 1,
      preset: 'month'
    }
  }
  // 默认滚动窗：今天前 3 天起共 28 天（无本周/本月筛选时）
  const start = now.startOf('day').subtract(3, 'day')
  const end = start.add(27, 'day')
  return { start, end, dayCount: 28, preset: 'rolling' }
}
