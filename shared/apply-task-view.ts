import type { TaskView } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import type { TaskListViewMode } from '@shared/list-view-preferences'
import type { FilterNode } from '@shared/task-filter-ast'
import type { TaskViewLayout } from '@shared/types'

export interface TaskViewAppliedState {
  layout: TaskListViewMode
  groupBy: TaskGroupBy
  sortBy: TaskSortBy
  kanbanBoardMode: KanbanBoardMode | null
  filterRule: FilterNode | null
}

/** 从 TaskView 推导应写入 UI 的状态（纯函数，便于单测） */
export function deriveAppliedViewState(view: {
  layout: TaskViewLayout
  groupBy: TaskGroupBy
  sortBy: TaskSortBy
  kanbanBoardMode?: KanbanBoardMode | null
  filterRule: FilterNode | null
}): TaskViewAppliedState {
  return {
    layout: view.layout,
    groupBy: view.groupBy,
    sortBy: view.sortBy,
    kanbanBoardMode: view.layout === 'kanban' ? (view.kanbanBoardMode ?? 'group') : null,
    filterRule: view.filterRule
  }
}

export function isFilterRuleActive(rule: FilterNode | null | undefined): boolean {
  if (!rule) return false
  if (rule.type === 'group' && rule.children.length === 0) return false
  return true
}

/** 种子默认视图 id（migration 写入） */
export const DEFAULT_TASK_VIEW_ALL_ID = 'view-default-all'
export const DEFAULT_TASK_VIEW_KANBAN_ID = 'view-default-kanban'

export function findFallbackViewId(views: TaskView[], excludeId?: string): string | null {
  const ordered = [...views].sort((a, b) => a.sortOrder - b.sortOrder)
  const pick = ordered.find((v) => v.id !== excludeId)
  return pick?.id ?? null
}
