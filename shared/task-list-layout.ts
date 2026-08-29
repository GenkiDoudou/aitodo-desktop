import dayjs from 'dayjs'
import type { Task } from './types'
import { getTaskPriorityMeta } from './task-priority'
import type { TaskPriority } from './task-priority'
import { primaryTaskTag } from './task-tags'
import { startOfWeekMonday, endOfWeekSunday } from './smart-list'

/** 分组方式（与产品参考图一致） */
export type TaskGroupBy = 'custom' | 'time' | 'tag' | 'priority' | 'status' | 'none'

/** 排序方式 */
export type TaskSortBy =
  | 'custom'
  | 'time'
  | 'createdAt'
  | 'completedAt'
  | 'remindAt'
  | 'priority'
  | 'title'
  | 'tag'

export const TASK_GROUP_BY_LABELS: Record<TaskGroupBy, string> = {
  custom: '自定义',
  time: '时间',
  tag: '标签',
  priority: '任务级别',
  status: '任务状态',
  none: '无'
}

export const TASK_SORT_BY_LABELS: Record<TaskSortBy, string> = {
  custom: '自定义',
  time: '截止时间',
  createdAt: '创建时间',
  completedAt: '完成时间',
  remindAt: '提醒时间',
  priority: '任务级别',
  title: '标题',
  tag: '标签'
}

export interface TaskListGroupHeader {
  type: 'group'
  key: string
  label: string
}

export interface TaskListRow {
  type: 'task'
  task: Task
  depth: number
}

export type TaskListLayoutItem = TaskListGroupHeader | TaskListRow

/** 列表展示用时间键：优先截止日，无则创建日 */
export function taskSortTimeIso(task: Task): string | null {
  return task.dueAt ?? task.createdAt ?? null
}

function compareByTimeField(
  a: Task,
  b: Task,
  field: 'dueAt' | 'createdAt' | 'completedAt' | 'remindAt'
): number {
  const ia = a[field] ?? null
  const ib = b[field] ?? null
  if (!ia && !ib) return a.title.localeCompare(b.title, 'zh-CN')
  if (!ia) return 1
  if (!ib) return -1
  const cmp = ia.localeCompare(ib)
  if (cmp !== 0) return cmp
  return a.title.localeCompare(b.title, 'zh-CN')
}

export function compareTasks(a: Task, b: Task, sortBy: TaskSortBy): number {
  if (sortBy === 'custom') {
    const so = a.sortOrder - b.sortOrder
    if (so !== 0) return so
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  }
  if (sortBy === 'title') {
    return a.title.localeCompare(b.title, 'zh-CN')
  }
  if (sortBy === 'priority') {
    const pa = a.priority ?? 4
    const pb = b.priority ?? 4
    if (pa !== pb) return pa - pb
    return a.title.localeCompare(b.title, 'zh-CN')
  }
  if (sortBy === 'tag') {
    const ta = primaryTaskTag(a)
    const tb = primaryTaskTag(b)
    if (ta !== tb) {
      if (!ta) return 1
      if (!tb) return -1
      return ta.localeCompare(tb, 'zh-CN')
    }
    return a.title.localeCompare(b.title, 'zh-CN')
  }
  if (sortBy === 'createdAt') {
    return -compareByTimeField(a, b, 'createdAt')
  }
  if (sortBy === 'completedAt') {
    return compareByTimeField(a, b, 'completedAt')
  }
  if (sortBy === 'remindAt') {
    return compareByTimeField(a, b, 'remindAt')
  }
  // time：截止时间优先，无则创建时间
  const ia = taskSortTimeIso(a)
  const ib = taskSortTimeIso(b)
  if (!ia && !ib) return a.title.localeCompare(b.title, 'zh-CN')
  if (!ia) return 1
  if (!ib) return -1
  const cmp = ia.localeCompare(ib)
  if (cmp !== 0) return cmp
  return a.title.localeCompare(b.title, 'zh-CN')
}

/** 时间分组桶 key + 中文标题 */
export function timeGroupKey(task: Task, base = dayjs()): { key: string; label: string; order: number } {
  if (!task.dueAt) {
    return { key: 'no-date', label: '无日期', order: 50 }
  }
  const due = dayjs(task.dueAt)
  if (!due.isValid()) {
    return { key: 'no-date', label: '无日期', order: 50 }
  }
  const today = base.startOf('day')
  const dueDay = due.startOf('day')
  if (task.status !== 'DONE' && dueDay.isBefore(today)) {
    return { key: 'overdue', label: '已过期', order: 0 }
  }
  if (dueDay.isSame(today, 'day')) {
    return { key: 'today', label: '今天', order: 10 }
  }
  if (dueDay.isSame(today.add(1, 'day'), 'day')) {
    return { key: 'tomorrow', label: '明天', order: 20 }
  }
  const weekStart = startOfWeekMonday(base)
  const weekEnd = endOfWeekSunday(base)
  if (!dueDay.isBefore(weekStart, 'day') && !dueDay.isAfter(weekEnd, 'day')) {
    return { key: 'this-week', label: '本周', order: 30 }
  }
  if (dueDay.isAfter(weekEnd, 'day')) {
    return { key: 'later', label: '以后', order: 40 }
  }
  return { key: dueDay.format('YYYY-MM-DD'), label: dueDay.format('M月D日'), order: 35 }
}

function priorityGroup(task: Task): { key: string; label: string; order: number } {
  const p = (task.priority ?? 4) as TaskPriority
  const meta = getTaskPriorityMeta(p)
  return { key: `p${p}`, label: meta.label, order: p }
}

function tagGroup(task: Task): { key: string; label: string; order: number } {
  const tag = primaryTaskTag(task)
  if (!tag) return { key: '__none__', label: '无标签', order: 9999 }
  return { key: tag, label: `#${tag}`, order: 0 }
}

/** 状态分组：待办 → 进行中 → 已完成 */
function statusGroup(task: Task): { key: string; label: string; order: number } {
  if (task.status === 'IN_PROGRESS') {
    return { key: 'IN_PROGRESS', label: '进行中', order: 1 }
  }
  if (task.status === 'DONE') {
    return { key: 'DONE', label: '已完成', order: 2 }
  }
  return { key: 'TODO', label: '待办', order: 0 }
}

function sortTaskList(tasks: Task[], sortBy: TaskSortBy): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, sortBy))
}

interface GroupBucket {
  key: string
  label: string
  order: number
  tasks: Task[]
}

function bucketRoots(roots: Task[], groupBy: TaskGroupBy, base = dayjs()): GroupBucket[] {
  const map = new Map<string, GroupBucket>()
  for (const task of roots) {
    let meta: { key: string; label: string; order: number }
    if (groupBy === 'time') meta = timeGroupKey(task, base)
    else if (groupBy === 'priority') meta = priorityGroup(task)
    else if (groupBy === 'tag') meta = tagGroup(task)
    else if (groupBy === 'status') meta = statusGroup(task)
    else continue
    if (!map.has(meta.key)) {
      map.set(meta.key, { key: meta.key, label: meta.label, order: meta.order, tasks: [] })
    }
    map.get(meta.key)!.tasks.push(task)
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'zh-CN'))
}

/**
 * 将扁平任务列表排布为「分组标题 + 树形任务行」。
 * 仅对顶层任务分组/排序，子任务仍挂在父任务下按原深度展开。
 */
export function buildTaskListLayout(
  allTasks: Task[],
  groupBy: TaskGroupBy,
  sortBy: TaskSortBy,
  base = dayjs()
): TaskListLayoutItem[] {
  const idSet = new Set(allTasks.map((t) => t.id))
  const byParent = new Map<string | null, Task[]>()
  for (const t of allTasks) {
    const key = t.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(t)
  }

  let roots = byParent.get(null) ?? []
  // 父任务不在当前列表中的子任务视为顶层 orphan
  const orphans = allTasks.filter((t) => t.parentId && !idSet.has(t.parentId))
  roots = [...roots, ...orphans.filter((o) => !roots.some((r) => r.id === o.id))]

  const result: TaskListLayoutItem[] = []
  const listed = new Set<string>()

  function walk(task: Task, depth: number) {
    result.push({ type: 'task', task, depth })
    listed.add(task.id)
    const children = sortTaskList(byParent.get(task.id) ?? [], sortBy)
    for (const child of children) {
      walk(child, depth + 1)
    }
  }

  const shouldGroup =
    groupBy === 'time' || groupBy === 'tag' || groupBy === 'priority' || groupBy === 'status'

  if (!shouldGroup) {
    const sortedRoots = sortTaskList(roots, sortBy)
    for (const root of sortedRoots) {
      walk(root, 0)
    }
  } else {
    const buckets = bucketRoots(roots, groupBy, base)
    for (const bucket of buckets) {
      result.push({ type: 'group', key: bucket.key, label: bucket.label })
      const sorted = sortTaskList(bucket.tasks, sortBy)
      for (const root of sorted) {
        walk(root, 0)
      }
    }
  }

  // 未挂到树上的孤立任务
  for (const task of allTasks) {
    if (listed.has(task.id)) continue
    if (task.parentId && !idSet.has(task.parentId)) {
      walk(task, 0)
    }
  }

  return result
}
