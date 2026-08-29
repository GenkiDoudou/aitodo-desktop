import dayjs from 'dayjs'
import type { Task } from './types'
import type { DueSmartList } from './smart-list'
import {
  dueCutoffIsoForSmartList,
  endOfDayIso,
  endOfWeekSunday,
  startOfWeekMonday
} from './smart-list'
import { resolveTaskCompletedAt } from './completed-task-groups'

/** 列表/日历按哪一列时间筛选 */
export type TaskDateField = 'dueAt' | 'createdAt' | 'completedAt'

/** 已完成页时间范围预设 */
export type DoneTimeRange = 'all' | 'today' | 'week' | 'month' | 'custom'

/** 日历时间尺度：同时决定网格视图与任务筛选区间 */
export type CalendarRangePreset = 'day' | 'week' | 'month' | 'year' | 'custom'

export const TASK_DATE_FIELD_LABELS: Record<TaskDateField, string> = {
  dueAt: '到期时间',
  createdAt: '创建时间',
  completedAt: '完成时间'
}

export const DONE_TIME_RANGE_LABELS: Record<DoneTimeRange, string> = {
  all: '全部',
  today: '本日',
  week: '本周',
  month: '本月',
  custom: '自定义'
}

export const CALENDAR_RANGE_PRESET_LABELS: Record<CalendarRangePreset, string> = {
  day: '日',
  week: '周',
  month: '月',
  year: '年',
  custom: '自定义'
}

export function startOfDayIso(d: dayjs.Dayjs): string {
  return `${d.format('YYYY-MM-DD')}T00:00:00`
}

/** 取任务上用于筛选的 ISO 时间（完成时间无 completedAt 时回退 updatedAt） */
export function resolveTaskDateIso(task: Task, field: TaskDateField): string | null {
  if (field === 'dueAt') return task.dueAt
  if (field === 'createdAt') return task.createdAt
  if (field === 'completedAt') return resolveTaskCompletedAt(task)
  return null
}

export interface DateRangeBounds {
  from: string
  to: string
}

/** 智能列表（今天/本周/最近7天）在指定 dateField 下的闭区间 [from, to]；dueAt 仅返回上界语义由调用方处理 */
export function smartListDateBounds(
  smart: DueSmartList,
  dateField: TaskDateField,
  base = dayjs()
): DateRangeBounds | { upperOnly: string } {
  if (dateField === 'dueAt') {
    return { upperOnly: dueCutoffIsoForSmartList(smart, base) }
  }

  if (smart === 'today') {
    return { from: startOfDayIso(base), to: endOfDayIso(base) }
  }
  if (smart === 'week') {
    const start = startOfWeekMonday(base)
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) }
  }
  // last7days：含今天起连续 7 个自然日
  return {
    from: startOfDayIso(base),
    to: endOfDayIso(base.add(6, 'day'))
  }
}

/** 已完成页时间范围 */
export function doneTimeRangeBounds(
  range: DoneTimeRange,
  base = dayjs(),
  custom?: { from?: string | null; to?: string | null }
): DateRangeBounds | null {
  if (range === 'all') return null
  if (range === 'today') {
    return { from: startOfDayIso(base), to: endOfDayIso(base) }
  }
  if (range === 'week') {
    const start = startOfWeekMonday(base)
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) }
  }
  if (range === 'month') {
    return {
      from: startOfDayIso(base.startOf('month')),
      to: endOfDayIso(base.endOf('month'))
    }
  }
  if (range === 'custom' && custom?.from && custom?.to) {
    const fromD = dayjs(custom.from.slice(0, 10))
    const toD = dayjs(custom.to.slice(0, 10))
    if (!fromD.isValid() || !toD.isValid()) return null
    return { from: startOfDayIso(fromD), to: endOfDayIso(toD) }
  }
  return null
}

/** 日历时间段（非 view 时与可见区间取交集由 UI 层处理） */
export function calendarPresetBounds(
  preset: CalendarRangePreset,
  base = dayjs(),
  custom?: { from?: string | null; to?: string | null }
): DateRangeBounds | null {
  if (preset === 'day') {
    return { from: startOfDayIso(base), to: endOfDayIso(base) }
  }
  if (preset === 'week') {
    const start = startOfWeekMonday(base)
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) }
  }
  if (preset === 'month') {
    return {
      from: startOfDayIso(base.startOf('month')),
      to: endOfDayIso(base.endOf('month'))
    }
  }
  if (preset === 'year') {
    return {
      from: startOfDayIso(base.startOf('year')),
      to: endOfDayIso(base.endOf('year'))
    }
  }
  if (preset === 'custom' && custom?.from && custom?.to) {
    const fromD = dayjs(custom.from.slice(0, 10))
    const toD = dayjs(custom.to.slice(0, 10))
    if (!fromD.isValid() || !toD.isValid()) return null
    return { from: startOfDayIso(fromD), to: endOfDayIso(toD) }
  }
  return null
}

function isoInClosedRange(iso: string, bounds: DateRangeBounds): boolean {
  return iso >= bounds.from && iso <= bounds.to
}

/**
 * 前端侧判断任务是否命中智能列表 + dateField（与 task-repository SQL 一致）。
 * completedAt 字段时仅匹配 DONE 且完成时间在范围内。
 */
export function taskMatchesSmartListDate(
  task: Task,
  smart: DueSmartList,
  dateField: TaskDateField = 'dueAt',
  base = dayjs()
): boolean {
  if (dateField === 'completedAt') {
    if (task.status !== 'DONE') return false
    const iso = resolveTaskDateIso(task, 'completedAt')
    if (!iso) return false
    const bounds = smartListDateBounds(smart, dateField, base)
    if (!('from' in bounds)) return false
    return isoInClosedRange(iso, bounds)
  }

  if (dateField === 'createdAt') {
    const iso = task.createdAt
    if (!iso) return false
    const bounds = smartListDateBounds(smart, dateField, base)
    if (!('from' in bounds)) return false
    if (!isoInClosedRange(iso, bounds)) return false
    return task.status !== 'DONE'
  }

  // dueAt：含已过期，截止日上界内；排除 DONE
  if (task.status === 'DONE') return false
  if (!task.dueAt) return false
  const bounds = smartListDateBounds(smart, 'dueAt', base)
  if ('upperOnly' in bounds) {
    return task.dueAt <= bounds.upperOnly
  }
  return false
}

/** 任务 ISO 是否落在 [from, to] 闭区间（按日比较时取 date 部分） */
export function taskDateIsoInRange(
  task: Task,
  field: TaskDateField,
  bounds: DateRangeBounds
): boolean {
  const iso = resolveTaskDateIso(task, field)
  if (!iso) return false
  return isoInClosedRange(iso, bounds)
}

/** 两段时间区间是否有重叠（按 ISO 字符串日粒度比较） */
export function rangesOverlap(a: DateRangeBounds, b: DateRangeBounds): boolean {
  return a.from <= b.to && b.from <= a.to
}
