import type { Task } from './types'
import type { WidgetNote } from './widget-notes'

/** 收件箱中的未排优顶层任务 */
export function isUntriagedInboxTask(task: Task): boolean {
  return !task.triagedAt && task.status !== 'DONE' && !task.parentId && !task.deletedAt
}

export function countUntriagedInboxTasks(tasks: readonly Task[]): number {
  return tasks.filter(isUntriagedInboxTask).length
}

export function inboxBadgeCount(notes: readonly WidgetNote[], tasks: readonly Task[]): number {
  return notes.length + countUntriagedInboxTasks(tasks)
}
