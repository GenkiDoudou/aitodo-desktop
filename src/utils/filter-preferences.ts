import type { TaskDateField, DoneTimeRange, CalendarRangePreset } from '@shared/date-filter'

const LIST_DATE_FIELD_KEY = 'aitodo_list_date_field'
const DONE_TIME_RANGE_KEY = 'aitodo_done_time_range'
const CALENDAR_DATE_FIELD_KEY = 'aitodo_calendar_date_field'
const CALENDAR_RANGE_PRESET_KEY = 'aitodo_calendar_range_preset'

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
  return readEnum(CALENDAR_DATE_FIELD_KEY, ['dueAt', 'createdAt', 'completedAt'] as const, 'dueAt')
}

export function persistCalendarDateField(field: TaskDateField): void {
  try {
    localStorage.setItem(CALENDAR_DATE_FIELD_KEY, field)
  } catch {
    /* ignore */
  }
}

export function readCalendarRangePreset(): CalendarRangePreset {
  return readEnum(
    CALENDAR_RANGE_PRESET_KEY,
    ['view', 'week', 'month', 'last7days', 'custom'] as const,
    'view'
  )
}

export function persistCalendarRangePreset(preset: CalendarRangePreset): void {
  try {
    localStorage.setItem(CALENDAR_RANGE_PRESET_KEY, preset)
  } catch {
    /* ignore */
  }
}

const TASK_GROUP_BY_KEY = 'aitodo_task_group_by'
const TASK_SORT_BY_KEY = 'aitodo_task_sort_by'

export function readTaskGroupBy(): import('@shared/task-list-layout').TaskGroupBy {
  return readEnum(
    TASK_GROUP_BY_KEY,
    ['custom', 'time', 'tag', 'priority', 'none'] as const,
    'custom'
  )
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
    ['custom', 'time', 'title', 'tag', 'priority'] as const,
    'custom'
  )
}

export function persistTaskSortBy(value: import('@shared/task-list-layout').TaskSortBy): void {
  try {
    localStorage.setItem(TASK_SORT_BY_KEY, value)
  } catch {
    /* ignore */
  }
}
