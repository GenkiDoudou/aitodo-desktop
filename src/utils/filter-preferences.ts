import type { TaskDateField, DoneTimeRange, CalendarRangePreset } from '@shared/date-filter'

const LIST_DATE_FIELD_KEY = 'aitodo_list_date_field'
const DONE_TIME_RANGE_KEY = 'aitodo_done_time_range'
const CALENDAR_DATE_FIELD_KEY = 'aitodo_calendar_date_field'
const CALENDAR_RANGE_PRESET_KEY = 'aitodo_calendar_range_preset'
const CALENDAR_CUSTOM_RANGE_KEY = 'aitodo_calendar_custom_range'

function migrateCalendarPreset(raw: string | null): import('@shared/date-filter').CalendarRangePreset | null {
  if (raw === 'today') return 'day'
  if (raw === 'view') return 'month'
  if (raw === 'last7days') return 'week'
  return null
}

export function readCalendarRangePreset(): import('@shared/date-filter').CalendarRangePreset {
  try {
    const raw = localStorage.getItem(CALENDAR_RANGE_PRESET_KEY)
    const migrated = migrateCalendarPreset(raw)
    if (migrated) return migrated
    if (raw && ['day', 'week', 'month', 'year', 'custom'].includes(raw)) {
      return raw as import('@shared/date-filter').CalendarRangePreset
    }
  } catch {
    /* ignore */
  }
  return 'month'
}

export function persistCalendarRangePreset(preset: import('@shared/date-filter').CalendarRangePreset): void {
  try {
    localStorage.setItem(CALENDAR_RANGE_PRESET_KEY, preset)
  } catch {
    /* ignore */
  }
}

export function readCalendarCustomRange(): [string, string] | null {
  try {
    const raw = localStorage.getItem(CALENDAR_CUSTOM_RANGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as [string, string]
    if (Array.isArray(parsed) && parsed.length === 2) return parsed
  } catch {
    /* ignore */
  }
  return null
}

export function persistCalendarCustomRange(range: [string, string] | null): void {
  try {
    if (!range) {
      localStorage.removeItem(CALENDAR_CUSTOM_RANGE_KEY)
      return
    }
    localStorage.setItem(CALENDAR_CUSTOM_RANGE_KEY, JSON.stringify(range))
  } catch {
    /* ignore */
  }
}

function readEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw && (allowed as readonly string[]).includes(raw)) {
      return raw as T
    }
  } catch {
    /* ignore */
  }
  return fallback
}

export function readListDateField(): TaskDateField {
  return readEnum(LIST_DATE_FIELD_KEY, ['dueAt', 'createdAt', 'completedAt'] as const, 'dueAt')
}

export function persistListDateField(field: TaskDateField): void {
  try {
    localStorage.setItem(LIST_DATE_FIELD_KEY, field)
  } catch {
    /* ignore */
  }
}

export function readDoneTimeRange(): DoneTimeRange {
  return readEnum(
    DONE_TIME_RANGE_KEY,
    ['all', 'today', 'week', 'month', 'custom'] as const,
    'all'
  )
}

export function persistDoneTimeRange(range: DoneTimeRange): void {
  try {
    localStorage.setItem(DONE_TIME_RANGE_KEY, range)
  } catch {
    /* ignore */
  }
}

export function readCalendarDateField(): TaskDateField {
  return readEnum(CALENDAR_DATE_FIELD_KEY, ['dueAt', 'createdAt', 'completedAt'] as const, 'createdAt')
}

export function persistCalendarDateField(field: TaskDateField): void {
  try {
    localStorage.setItem(CALENDAR_DATE_FIELD_KEY, field)
  } catch {
    /* ignore */
  }
}

const TASK_GROUP_BY_KEY = 'aitodo_task_group_by'
const TASK_SORT_BY_KEY = 'aitodo_task_sort_by'

export function readTaskGroupBy(): import('@shared/task-list-layout').TaskGroupBy {
  const value = readEnum(
    TASK_GROUP_BY_KEY,
    ['custom', 'time', 'tag', 'priority', 'status', 'none'] as const,
    'none'
  )
  // custom 不会生成分组标题，与关闭分组等价；归一为 none 避免开关误显开启
  return value === 'custom' ? 'none' : value
}

export function persistTaskGroupBy(value: import('@shared/task-list-layout').TaskGroupBy): void {
  try {
    localStorage.setItem(TASK_GROUP_BY_KEY, value)
  } catch {
    /* ignore */
  }
}

export function readTaskSortBy(): import('@shared/task-list-layout').TaskSortBy {
  return readEnum(
    TASK_SORT_BY_KEY,
    ['custom', 'time', 'createdAt', 'completedAt', 'remindAt', 'title', 'tag', 'priority'] as const,
    'createdAt'
  )
}

export function persistTaskSortBy(value: import('@shared/task-list-layout').TaskSortBy): void {
  try {
    localStorage.setItem(TASK_SORT_BY_KEY, value)
  } catch {
    /* ignore */
  }
}
