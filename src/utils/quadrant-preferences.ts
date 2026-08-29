import type { QuadrantGroupBy } from '@shared/quadrant-layout'
import type { TaskSortBy } from '@shared/task-list-layout'

export interface QuadrantViewPreferences {
  showCompleted: boolean
  enableGrouping: boolean
  groupBy: QuadrantGroupBy
  sortBy: TaskSortBy
}

const STORAGE_KEY = 'aitodo_quadrant_view_prefs'

const DEFAULTS: QuadrantViewPreferences = {
  showCompleted: false,
  enableGrouping: true,
  groupBy: 'status',
  sortBy: 'createdAt'
}

function readEnum<T extends string>(key: keyof QuadrantViewPreferences, allowed: readonly T[], fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Record<string, string>>
    const value = raw[key as string]
    if (value && (allowed as readonly string[]).includes(value)) {
      return value as T
    }
  } catch {
    /* ignore */
  }
  return fallback
}

function readBool(key: keyof QuadrantViewPreferences, fallback: boolean): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Record<string, boolean>>
    const value = raw[key as string]
    if (typeof value === 'boolean') return value
  } catch {
    /* ignore */
  }
  return fallback
}

export function readQuadrantViewPreferences(): QuadrantViewPreferences {
  return {
    showCompleted: readBool('showCompleted', DEFAULTS.showCompleted),
    enableGrouping: readBool('enableGrouping', DEFAULTS.enableGrouping),
    groupBy: readEnum('groupBy', ['status', 'time', 'tag', 'none'] as const, DEFAULTS.groupBy),
    sortBy: readEnum(
      'sortBy',
      ['custom', 'time', 'createdAt', 'completedAt', 'remindAt', 'title', 'tag', 'priority'] as const,
      DEFAULTS.sortBy
    )
  }
}

export function persistQuadrantViewPreferences(prefs: QuadrantViewPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}
