import type { TaskView } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import type { TaskListViewMode } from '@shared/list-view-preferences'
import type { FilterNode } from '@shared/task-filter-ast'
import { matchTask } from '@shared/task-filter-ast'
import {
  resolveHideDoneScope,
  taskMatchesHideDoneScope,
  type HideDoneScope
} from '@shared/hide-done-scope'
import type { TaskViewLayout, Task } from '@shared/types'
import type { QuadrantLayoutOptions } from '@shared/quadrant-layout'
import type { Dayjs } from 'dayjs'

export interface TaskViewAppliedState {
  viewLayout: TaskViewLayout
  layout: TaskListViewMode
  groupBy: TaskGroupBy
  sortBy: TaskSortBy
  kanbanBoardMode: KanbanBoardMode | null
  filterRule: FilterNode | null
  quadrantOptions: QuadrantLayoutOptions | null
}

/** 从 TaskView 推导应写入 UI 的状态（纯函数，便于单测） */
export function deriveAppliedViewState(view: {
  layout: TaskViewLayout
  groupBy: TaskGroupBy
  sortBy: TaskSortBy
  kanbanBoardMode?: KanbanBoardMode | null
  filterRule: FilterNode | null
  quadrantOptions?: QuadrantLayoutOptions | null
}): TaskViewAppliedState {
  if (view.layout === 'quadrant') {
    return {
      viewLayout: 'quadrant',
      layout: 'list',
      groupBy: view.groupBy,
      sortBy: view.sortBy,
      kanbanBoardMode: null,
      filterRule: view.filterRule,
      quadrantOptions: view.quadrantOptions ?? null
    }
  }
  return {
    viewLayout: view.layout,
    layout: view.layout,
    groupBy: view.groupBy,
    sortBy: view.sortBy,
    kanbanBoardMode: view.layout === 'kanban' ? (view.kanbanBoardMode ?? 'group') : null,
    filterRule: view.filterRule,
    quadrantOptions: null
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

function buildHasSubtasksMap(tasks: readonly Task[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const task of tasks) {
    if (task.parentId && !task.deletedAt) {
      map.set(task.parentId, true)
    }
  }
  return map
}

export interface FilterTasksForViewOptions {
  /** @deprecated 请使用 hideDoneScope */
  hideDone?: boolean
  hideDoneScope?: HideDoneScope
  now?: Dayjs
}

export interface WidgetTaskRow {
  task: Task
  depth: number
}

/**
 * 与主窗口视图一致的筛选结果（含子任务），供挂件等紧凑 UI 使用。
 */
export function filterTasksForViewWidget(
  allTasks: readonly Task[],
  view: Pick<TaskView, 'filterRule' | 'layout' | 'kanbanBoardMode' | 'quadrantOptions'>,
  options: FilterTasksForViewOptions = {}
): Task[] {
  const scope = options.hideDoneScope ?? resolveHideDoneScope({ hideDone: options.hideDone })
  const alive = allTasks.filter((task) => !task.deletedAt)
  const pool = alive.filter((task) => taskMatchesHideDoneScope(task, scope, options.now))
  const rule = view.filterRule
  const hasSubtasksById = buildHasSubtasksMap(alive)
  const ctx = { hasSubtasksById, now: options.now }

  if (view.layout === 'quadrant') {
    if (!isFilterRuleActive(rule)) {
      return pool
    }
    const matchedRootIds = new Set(
      pool.filter((task) => !task.parentId && matchTask(task, rule!, ctx)).map((task) => task.id)
    )
    return pool.filter(
      (task) =>
        matchedRootIds.has(task.id) ||
        (task.parentId != null && matchedRootIds.has(task.parentId))
    )
  }

  if (!isFilterRuleActive(rule)) {
    return pool
  }

  const base = pool.filter((task) => matchTask(task, rule!, ctx))
  if (view.layout !== 'kanban') {
    return base
  }

  const rootIds = new Set(base.filter((task) => !task.parentId).map((task) => task.id))
  const idSet = new Set(base.map((task) => task.id))
  const extras = pool.filter(
    (task) => task.parentId && rootIds.has(task.parentId) && !idSet.has(task.id)
  )
  return extras.length ? [...base, ...extras] : base
}

/** 列表/时间线挂件：按父子层级展开，与主窗口列表一致 */
export function flattenTasksForViewWidget(tasks: readonly Task[]): WidgetTaskRow[] {
  const idSet = new Set(tasks.map((task) => task.id))
  const byParent = new Map<string | null, Task[]>()
  for (const task of tasks) {
    const key = task.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(task)
  }

  const result: WidgetTaskRow[] = []
  const listed = new Set<string>()

  function walk(parentId: string | null, depth: number) {
    for (const task of byParent.get(parentId) ?? []) {
      result.push({ task, depth })
      listed.add(task.id)
      walk(task.id, depth + 1)
    }
  }

  walk(null, 0)

  for (const task of tasks) {
    if (listed.has(task.id)) continue
    if (task.parentId && !idSet.has(task.parentId)) {
      result.push({ task, depth: 0 })
    }
  }

  return result
}
