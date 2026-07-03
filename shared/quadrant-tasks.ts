import dayjs from 'dayjs'
import type { Task } from './types'
import type { TaskPriority } from './task-priority'
import { normalizeTaskPriority } from './task-priority'

/** 象限内任务分组（参考滴答四象限：已完成 / 已过期 / 无日期 / 已安排） */
export type QuadrantTaskGroupKey = 'completed' | 'overdue' | 'noDate' | 'scheduled'

export interface QuadrantTaskGroup {
  key: QuadrantTaskGroupKey
  label: string
  tasks: Task[]
}

export const QUADRANT_GROUP_LABELS: Record<QuadrantTaskGroupKey, string> = {
  completed: '已完成',
  overdue: '已过期',
  noDate: '无日期',
  scheduled: '已安排'
}

/** 将顶层任务按优先级拆入四个象限 */
export function splitTasksByPriority(tasks: Task[]): Record<TaskPriority, Task[]> {
  const buckets: Record<TaskPriority, Task[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const task of tasks) {
    if (task.parentId) continue
    const p = normalizeTaskPriority(task.priority)
    buckets[p].push(task)
  }
  return buckets
}

/** 象限内任务布局：无截止日的任务直接平铺，其余按分组折叠 */
export interface QuadrantTasksLayout {
  /** 未完成且未设置截止时间的任务，不显示「无日期」分组标题 */
  ungrouped: Task[]
  groups: QuadrantTaskGroup[]
}

/** 单个象限内按日期/完成状态分组 */
export function groupTasksInQuadrant(tasks: Task[], showCompleted: boolean): QuadrantTaskGroup[] {
  return layoutTasksInQuadrant(tasks, showCompleted).groups
}

/** 单个象限内布局（含无日期任务的平铺列表） */
export function layoutTasksInQuadrant(tasks: Task[], showCompleted: boolean): QuadrantTasksLayout {
  const now = dayjs()
  const buckets: Record<QuadrantTaskGroupKey, Task[]> = {
    completed: [],
    overdue: [],
    noDate: [],
    scheduled: []
  }

  for (const task of tasks) {
    if (task.status === 'DONE') {
      buckets.completed.push(task)
      continue
    }
    if (!task.dueAt) {
      buckets.noDate.push(task)
      continue
    }
    if (dayjs(task.dueAt).isBefore(now, 'minute')) {
      buckets.overdue.push(task)
    } else {
      buckets.scheduled.push(task)
    }
  }

  const order: QuadrantTaskGroupKey[] = ['overdue', 'scheduled', 'completed']
  const groups = order
    .filter((key) => key !== 'completed' || showCompleted)
    .map((key) => ({
      key,
      label: QUADRANT_GROUP_LABELS[key],
      tasks: buckets[key]
    }))
    .filter((g) => g.tasks.length > 0)

  return {
    ungrouped: buckets.noDate,
    groups
  }
}

/** 四象限任务行（含嵌套深度，供 UI 缩进与展开） */
export interface QuadrantTaskRow {
  task: Task
  depth: number
}

/** 统计每个父任务下的直接子任务数量 */
export function buildChildCountMap(allTasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of allTasks) {
    if (!t.parentId) continue
    counts.set(t.parentId, (counts.get(t.parentId) ?? 0) + 1)
  }
  return counts
}

/**
 * 将象限内顶层任务展开为带深度的平铺列表；子任务嵌套在父任务下，不参与象限分桶。
 */
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
