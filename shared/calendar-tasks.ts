import dayjs from 'dayjs'
import type { Task } from './types'
import { getTaskPriorityMeta, type TaskPriority } from './task-priority'
import { resolveTaskDateIso, type TaskDateField, type DateRangeBounds } from './date-filter'
import type { TaskRecurrenceRule } from './task-reminder'
import {
  isOccurrenceDateCompleted,
  isRecurringCalendarTask
} from './recurrence-occurrences'

export type CalendarViewMode = 'month' | 'week' | 'day'

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export function weekdayLabel(d: dayjs.Dayjs): string {
  return WEEKDAY_LABELS[d.day()]
}

/** 月视图标题：9月、2025年12月 */
export function formatCalendarTitle(anchor: dayjs.Dayjs, mode: CalendarViewMode): string {
  if (mode === 'month') {
    return anchor.format('M月')
  }
  if (mode === 'week') {
    const start = anchor.startOf('week')
    const end = anchor.endOf('week')
    if (start.year() !== end.year()) {
      return `${start.format('YYYY年M月D日')} – ${end.format('YYYY年M月D日')}`
    }
    if (start.month() !== end.month()) {
      return `${start.format('M月D日')} – ${end.format('M月D日')}`
    }
    return `${start.format('M月D日')} – ${end.format('D日')}`
  }
  return anchor.format('M月D日 dddd')
}

/** 可见区间（含起止日） */
export function calendarVisibleRange(anchor: dayjs.Dayjs, mode: CalendarViewMode) {
  if (mode === 'month') {
    const start = anchor.startOf('month').startOf('week')
    const end = anchor.endOf('month').endOf('week')
    return { start, end }
  }
  if (mode === 'week') {
    return { start: anchor.startOf('week'), end: anchor.endOf('week') }
  }
  return { start: anchor.startOf('day'), end: anchor.endOf('day') }
}

export function taskDueDateKey(task: Task): string | null {
  if (!task.dueAt) return null
  return task.dueAt.slice(0, 10)
}

/** 按指定时间列取日历格子的 YYYY-MM-DD */
export function taskDateKeyByField(task: Task, field: TaskDateField): string | null {
  const iso = resolveTaskDateIso(task, field)
  if (!iso) return null
  return iso.slice(0, 10)
}

/** 任务在指定 dateField 下是否落在可见日历区间内 */
export function isTaskInRangeByField(
  task: Task,
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
  field: TaskDateField = 'dueAt'
): boolean {
  const key = taskDateKeyByField(task, field)
  if (!key) return false
  const d = dayjs(key)
  return !d.isBefore(start, 'day') && !d.isAfter(end, 'day')
}

/** 任务 dateField 是否 additionally 落在预设时间段内（与可见区间取交集） */
export function isTaskInCalendarFilter(
  task: Task,
  visibleStart: dayjs.Dayjs,
  visibleEnd: dayjs.Dayjs,
  field: TaskDateField,
  presetBounds: DateRangeBounds | null
): boolean {
  if (!isTaskInRangeByField(task, visibleStart, visibleEnd, field)) {
    return false
  }
  if (!presetBounds) return true
  const iso = resolveTaskDateIso(task, field)
  if (!iso) return false
  return iso >= presetBounds.from && iso <= presetBounds.to
}

/** 判断某日期是否命中循环规则（相对锚点 dueAt） */
export function recurrenceMatchesDate(
  date: dayjs.Dayjs,
  anchor: dayjs.Dayjs,
  rule: TaskRecurrenceRule
): boolean {
  switch (rule.type) {
    case 'daily':
      return true
    case 'weekly':
      return date.day() === anchor.day()
    case 'monthly':
      return date.date() === anchor.date()
    case 'yearly':
      return date.month() === anchor.month() && date.date() === anchor.date()
    case 'workdays':
      return date.day() >= 1 && date.day() <= 5
    case 'weekend':
      return date.day() === 0 || date.day() === 6
    case 'custom': {
      const n = rule.interval ?? 1
      const unit = rule.unit ?? 'day'
      if (unit === 'day') {
        const diff = date.diff(anchor.startOf('day'), 'day')
        return diff >= 0 && diff % n === 0
      }
      if (unit === 'week') {
        if (date.day() !== anchor.day()) return false
        const diff = date.diff(anchor.startOf('day'), 'week')
        return diff >= 0 && diff % n === 0
      }
      if (unit === 'month') {
        if (date.date() !== anchor.date()) return false
        const diff = date.diff(anchor.startOf('day'), 'month')
        return diff >= 0 && diff % n === 0
      }
      if (unit === 'year') {
        if (date.month() !== anchor.month() || date.date() !== anchor.date()) return false
        const diff = date.diff(anchor.startOf('day'), 'year')
        return diff >= 0 && diff % n === 0
      }
      return false
    }
    default:
      return date.isSame(anchor, 'day')
  }
}

/** 将任务克隆到指定日期（保留锚点时间）；循环任务按单日完成列表设置 status */
function cloneTaskOnCalendarDate(
  task: Task,
  field: TaskDateField,
  date: dayjs.Dayjs,
  anchorIso: string
): Task {
  const anchor = dayjs(anchorIso)
  const merged = date.hour(anchor.hour()).minute(anchor.minute()).second(anchor.second())
  const iso = merged.format('YYYY-MM-DDTHH:mm:ss')
  const dateKey = date.format('YYYY-MM-DD')
  let status = task.status
  let completedAt = task.completedAt
  if (isRecurringCalendarTask(task.recurrence) && field === 'dueAt') {
    if (task.status === 'DONE') {
      status = 'DONE'
    } else if (isOccurrenceDateCompleted(task.completedOccurrenceDates, dateKey)) {
      status = 'DONE'
      completedAt = iso
    } else {
      status = 'TODO'
      completedAt = null
    }
  }
  const base = {
    ...task,
    status,
    completedAt
  }
  if (field === 'dueAt') {
    return { ...base, dueAt: iso }
  }
  if (field === 'remindAt') {
    return { ...base, remindAt: iso }
  }
  if (field === 'completedAt') {
    return { ...base, completedAt: iso }
  }
  return { ...base, createdAt: iso }
}

/** 展开单条任务在可见区间内的日历实例（含循环） */
export function expandTaskCalendarInstances(
  task: Task,
  visibleStart: dayjs.Dayjs,
  visibleEnd: dayjs.Dayjs,
  field: TaskDateField
): Task[] {
  const baseIso = resolveTaskDateIso(task, field)
  if (!baseIso) return []

  const rule = task.recurrence
  const canRecur = field === 'dueAt' && rule && rule.type !== 'none' && rule.type !== 'legal_holidays'

  if (!canRecur) {
    return isTaskInRangeByField(task, visibleStart, visibleEnd, field) ? [task] : []
  }

  const anchor = dayjs(baseIso)
  const instances: Task[] = []
  let cursor = visibleStart.startOf('day')
  const end = visibleEnd.endOf('day')

  while (!cursor.isAfter(end, 'day')) {
    if (recurrenceMatchesDate(cursor, anchor, rule)) {
      instances.push(cloneTaskOnCalendarDate(task, field, cursor, baseIso))
    }
    cursor = cursor.add(1, 'day')
  }

  return instances
}

/** 展开循环任务并应用日历筛选 */
export function expandTasksForCalendar(
  tasks: Task[],
  visibleStart: dayjs.Dayjs,
  visibleEnd: dayjs.Dayjs,
  field: TaskDateField,
  presetBounds: DateRangeBounds | null
): Task[] {
  const expanded: Task[] = []
  for (const task of tasks) {
    if (task.deletedAt) continue
    const instances = expandTaskCalendarInstances(task, visibleStart, visibleEnd, field)
    for (const inst of instances) {
      if (isTaskInCalendarFilter(inst, visibleStart, visibleEnd, field, presetBounds)) {
        expanded.push(inst)
      }
    }
  }
  return expanded
}

/** 日历列表项唯一 key（同一任务可能在多个日期出现） */
export function calendarTaskRowKey(task: Task, field: TaskDateField = 'dueAt'): string {
  const iso = resolveTaskDateIso(task, field)
  const dateKey = iso?.slice(0, 10) ?? 'none'
  return `${task.id}@${dateKey}`
}

export function taskDueMinutes(task: Task): number {
  if (!task.dueAt || task.dueAt.length < 16) return 9 * 60
  const d = dayjs(task.dueAt)
  return d.hour() * 60 + d.minute()
}

export function formatTaskDueHm(task: Task): string {
  if (!task.dueAt) return ''
  const d = dayjs(task.dueAt)
  if (!d.isValid()) return ''
  return d.format('H:mm')
}

/** 任务是否落在可见日历区间内 */
export function isTaskInRange(task: Task, start: dayjs.Dayjs, end: dayjs.Dayjs): boolean {
  const key = taskDueDateKey(task)
  if (!key) return false
  const d = dayjs(key)
  return !d.isBefore(start, 'day') && !d.isAfter(end, 'day')
}

/** 按 dateField 分组；同日内按该列时间升序 */
export function groupTasksByDateField(
  tasks: Task[],
  field: TaskDateField = 'dueAt'
): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = taskDateKeyByField(task, field)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(task)
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ia = resolveTaskDateIso(a, field) ?? ''
      const ib = resolveTaskDateIso(b, field) ?? ''
      return ia.localeCompare(ib)
    })
  }
  return map
}

export function taskMinutesOnField(task: Task, field: TaskDateField = 'dueAt'): number {
  const iso = resolveTaskDateIso(task, field)
  if (!iso || iso.length < 16) return 9 * 60
  const d = dayjs(iso)
  return d.hour() * 60 + d.minute()
}

export function formatTaskTimeHm(task: Task, field: TaskDateField = 'dueAt'): string {
  const iso = resolveTaskDateIso(task, field)
  if (!iso) return ''
  const d = dayjs(iso)
  if (!d.isValid()) return ''
  return d.format('H:mm')
}

/** @deprecated 使用 groupTasksByDateField */
export function groupTasksByDueDate(tasks: Task[]): Map<string, Task[]> {
  return groupTasksByDateField(tasks, 'dueAt')
}

/** 日历任务条背景：清单色优先，否则按优先级浅色 */
export function calendarTaskColors(
  task: Task,
  categoryColor?: string | null
): { bg: string; border: string; text: string } {
  const base =
    categoryColor ??
    getTaskPriorityMeta((task.priority ?? 4) as TaskPriority).color ??
    '#909399'
  return {
    bg: `${base}22`,
    border: `${base}55`,
    text: '#303133'
  }
}

/** 月视图单元格最多展示条数，超出显示 +N */
export const CALENDAR_MONTH_CELL_MAX = 5
