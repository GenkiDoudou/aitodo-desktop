import type {
  TaskDetailStyle,
  TaskListMetaVisibility,
  TaskListViewMode
} from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import { kanbanScopeKey } from '@shared/kanban-scope'
import { readTaskGroupBy, readTaskSortBy } from './filter-preferences'
import {
  readTaskDetailStyle,
  readTaskListMetaVisibility,
  readTaskListViewMode
} from './list-view-preferences'

const NAV_PREFS_KEY = 'aitodo_nav_list_prefs'

export interface NavListPrefs {
  viewMode: 'list' | 'kanban'
  groupBy: TaskGroupBy
  sortBy: TaskSortBy
  hideDone: boolean
  detailStyle: TaskDetailStyle
  metaVisibility: TaskListMetaVisibility
}

function readHideDoneFallback(): boolean {
  try {
    const raw = localStorage.getItem('aitodo_hide_done')
    if (raw === 'true') return true
    if (raw === 'false') return false
  } catch {
    /* ignore */
  }
  return true
}

/** 全局键作默认（迁移） */
export function defaultNavListPrefs(): NavListPrefs {
  const mode = readTaskListViewMode()
  return {
    viewMode: mode === 'kanban' ? 'kanban' : 'list',
    groupBy: readTaskGroupBy(),
    sortBy: readTaskSortBy(),
    hideDone: readHideDoneFallback(),
    detailStyle: readTaskDetailStyle(),
    metaVisibility: readTaskListMetaVisibility()
  }
}

/** 全部 / 最近7天 / 清单；其它入口返回 null */
export function navListPrefsScopeKey(opts: {
  categoryId?: string | null | undefined
  smart?: string
}): string | null {
  if (opts.categoryId !== undefined) {
    return kanbanScopeKey({ categoryId: opts.categoryId })
  }
  if (opts.smart === 'all' || opts.smart === 'last7days') {
    return kanbanScopeKey({ smart: opts.smart })
  }
  return null
}

function readAllNavPrefs(): Record<string, NavListPrefs> {
  try {
    const raw = localStorage.getItem(NAV_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<NavListPrefs>>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, NavListPrefs>
  } catch {
    return {}
  }
}

function normalizePrefs(partial?: Partial<NavListPrefs> | null): NavListPrefs {
  const base = defaultNavListPrefs()
  if (!partial) return base
  const viewMode = partial.viewMode === 'kanban' ? 'kanban' : partial.viewMode === 'list' ? 'list' : base.viewMode
  const groupBy = partial.groupBy ?? base.groupBy
  const sortBy = partial.sortBy ?? base.sortBy
  return {
    viewMode,
    groupBy,
    sortBy,
    hideDone: partial.hideDone ?? base.hideDone,
    detailStyle: partial.detailStyle === 'dialog' ? 'dialog' : partial.detailStyle === 'sidebar' ? 'sidebar' : base.detailStyle,
    metaVisibility: {
      ...DEFAULT_TASK_LIST_META_VISIBILITY,
      ...base.metaVisibility,
      ...(partial.metaVisibility ?? {})
    }
  }
}

export function readNavListPrefs(scopeKey: string): NavListPrefs {
  const all = readAllNavPrefs()
  return normalizePrefs(all[scopeKey])
}

export function persistNavListPrefs(scopeKey: string, prefs: NavListPrefs): void {
  try {
    const all = readAllNavPrefs()
    all[scopeKey] = normalizePrefs(prefs)
    localStorage.setItem(NAV_PREFS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}
