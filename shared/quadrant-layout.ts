import dayjs from 'dayjs'
import type { Task } from './types'
import { compareTasks, timeGroupKey, type TaskSortBy } from './task-list-layout'
import { primaryTaskTag } from './task-tags'

/** 象限内分组方式 */
export type QuadrantGroupBy = 'status' | 'time' | 'tag' | 'none'

export const QUADRANT_GROUP_BY_LABELS: Record<QuadrantGroupBy, string> = {
  status: '按状态（过期/已安排/已完成）',
  time: '按时间（今天/明天/本周…）',
  tag: '按标签',
  none: '不分组'
}

export interface QuadrantLayoutOptions {
  showCompleted: boolean
  enableGrouping: boolean
  groupBy: QuadrantGroupBy
  sortBy: TaskSortBy
}

export type QuadrantTaskGroupKey = 'completed' | 'overdue' | 'noDate' | 'scheduled'

export interface QuadrantTaskGroup {
  key: string
  label: string
  tasks: Task[]
}

export interface QuadrantTasksLayout {
  ungrouped: Task[]
  groups: QuadrantTaskGroup[]
}

function visibleTasks(tasks: Task[], showCompleted: boolean): Task[] {
  if (showCompleted) return tasks
  return tasks.filter((t) => t.status !== 'DONE')
}

function sortQuadrantTasks(tasks: Task[], sortBy: TaskSortBy): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, sortBy))
}

function layoutByStatus(tasks: Task[], showCompleted: boolean): QuadrantTasksLayout {
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
      label:
        key === 'completed'
          ? '已完成'
          : key === 'overdue'
            ? '已过期'
            : key === 'scheduled'
              ? '已安排'
              : '无日期',
      tasks: buckets[key]
    }))
    .filter((g) => g.tasks.length > 0)

  return { ungrouped: buckets.noDate, groups }
}

function layoutByTime(tasks: Task[], showCompleted: boolean, base = dayjs()): QuadrantTasksLayout {
  const map = new Map<string, QuadrantTaskGroup>()
  const noDate: Task[] = []

  for (const task of visibleTasks(tasks, showCompleted)) {
    if (!task.dueAt) {
      noDate.push(task)
      continue
    }
    const meta = timeGroupKey(task, base)
    if (!map.has(meta.key)) {
      map.set(meta.key, { key: meta.key, label: meta.label, tasks: [] })
    }
    map.get(meta.key)!.tasks.push(task)
  }

  const groups = [...map.values()].sort((a, b) => {
    const order = (key: string) => {
      if (key === 'overdue') return 0
      if (key === 'today') return 10
      if (key === 'tomorrow') return 20
      if (key === 'this-week') return 30
      if (key === 'later') return 40
      if (key === 'no-date') return 50
      return 35
    }
    const diff = order(a.key) - order(b.key)
    return diff !== 0 ? diff : a.label.localeCompare(b.label, 'zh-CN')
  })

  return { ungrouped: noDate, groups }
}

function layoutByTag(tasks: Task[], showCompleted: boolean): QuadrantTasksLayout {
  const map = new Map<string, QuadrantTaskGroup>()
  const untagged: Task[] = []

  for (const task of visibleTasks(tasks, showCompleted)) {
    const tag = primaryTaskTag(task)
    if (!tag) {
      untagged.push(task)
      continue
    }
    if (!map.has(tag)) {
      map.set(tag, { key: tag, label: `#${tag}`, tasks: [] })
    }
    map.get(tag)!.tasks.push(task)
  }

  const groups = [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  return { ungrouped: untagged, groups }
}

/** 单个象限内布局 */
export function layoutTasksInQuadrant(tasks: Task[], options: QuadrantLayoutOptions): QuadrantTasksLayout {
  const sorted = sortQuadrantTasks(tasks, options.sortBy)
  if (!options.enableGrouping || options.groupBy === 'none') {
    return { ungrouped: visibleTasks(sorted, options.showCompleted), groups: [] }
  }
  if (options.groupBy === 'time') {
    return layoutByTime(sorted, options.showCompleted)
  }
  if (options.groupBy === 'tag') {
    return layoutByTag(sorted, options.showCompleted)
  }
  return layoutByStatus(sorted, options.showCompleted)
}
