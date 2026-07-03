import dayjs from 'dayjs'
import type { Task } from './types'
import { getTaskPriorityMeta, type TaskPriority } from './task-priority'
import { resolveTaskDateIso, type TaskDateField, type DateRangeBounds } from './date-filter'

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
