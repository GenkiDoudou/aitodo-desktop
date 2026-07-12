import type { Task } from './types'
import type { TaskPriority } from './task-priority'
import { normalizeTaskPriority } from './task-priority'

export type {
  QuadrantGroupBy,
  QuadrantLayoutOptions,
  QuadrantTaskGroup,
  QuadrantTaskGroupKey,
  QuadrantTasksLayout
} from './quadrant-layout'
export { QUADRANT_GROUP_BY_LABELS, layoutTasksInQuadrant } from './quadrant-layout'

/** 将顶层任务（含父不在列表中的 orphan 子任务）按优先级拆入四个象限 */
export function splitTasksByPriority(tasks: Task[]): Record<TaskPriority, Task[]> {
  const idSet = new Set(tasks.map((t) => t.id))
  const buckets: Record<TaskPriority, Task[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const task of tasks) {
    if (task.parentId && idSet.has(task.parentId)) continue
    const p = normalizeTaskPriority(task.priority)
    buckets[p].push(task)
  }
  return buckets
}

export interface QuadrantTaskRow {
  task: Task
  depth: number
}

export function buildChildCountMap(allTasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of allTasks) {
    if (!t.parentId) continue
    counts.set(t.parentId, (counts.get(t.parentId) ?? 0) + 1)
  }
  return counts
}

export function flattenQuadrantTaskTree(
  roots: Task[],
  allTasks: Task[],
  expandedIds: ReadonlySet<string>
): QuadrantTaskRow[] {
  const byParent = new Map<string, Task[]>()
  for (const t of allTasks) {
    if (!t.parentId) continue
    if (!byParent.has(t.parentId)) byParent.set(t.parentId, [])
    byParent.get(t.parentId)!.push(t)
  }

  const result: QuadrantTaskRow[] = []
  const walk = (items: Task[], depth: number) => {
    for (const task of items) {
      result.push({ task, depth })
      if (expandedIds.has(task.id)) {
        walk(byParent.get(task.id) ?? [], depth + 1)
      }
    }
  }
  walk(roots, 0)
  return result
}
