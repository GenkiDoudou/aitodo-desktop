import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import { getTaskPriorityMeta } from '@shared/task-priority'
import type {
  CreateTaskDto,
  Task,
  TaskActivity,
  TaskActivityType,
  TaskStatus,
  UpdateTaskDto
} from '@shared/types'
import type { CategoryRepository } from '../db/category-repository'
import type { KanbanGroupRepository } from '../db/kanban-group-repository'

function sameTagList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}

export interface TaskActivityRecordInput {
  taskId: string
  type: TaskActivityType
  summary: string
  createdAt?: string
}

export class TaskActivityRecorder {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly kanbanRepo: KanbanGroupRepository
  ) {}

  buildCreateEvents(task: Task, dto: CreateTaskDto): TaskActivityRecordInput[] {
    const ts = task.createdAt
    const events: TaskActivityRecordInput[] = [
      {
        taskId: task.id,
        type: 'created',
        summary: dto.parentId ? '创建了子任务' : '创建了任务',
        createdAt: ts
      }
    ]
    if (dto.parentId) {
      events.push({
        taskId: dto.parentId,
        type: 'subtask_added',
        summary: `添加子任务「${task.title}」`,
        createdAt: ts
      })
    }
    return events
  }

  buildUpdateEvents(existing: Task, updated: Task, dto: UpdateTaskDto): TaskActivityRecordInput[] {
    const ts = updated.updatedAt
    const events: TaskActivityRecordInput[] = []

    if (dto.title !== undefined && dto.title.trim() !== existing.title) {
      events.push({
        taskId: updated.id,
        type: 'title_updated',
        summary: '修改了标题',
        createdAt: ts
      })
    }

    if (dto.description !== undefined && (dto.description ?? null) !== existing.description) {
      events.push({
        taskId: updated.id,
        type: 'description_updated',
        summary: dto.description?.trim() ? '修改了正文' : '清空了正文',
        createdAt: ts
      })
    }

    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      events.push({
        taskId: updated.id,
        type: 'priority_updated',
        summary: `将优先级设为「${getTaskPriorityMeta(updated.priority).label}」`,
        createdAt: ts
      })
    }

    if (dto.categoryId !== undefined && (dto.categoryId ?? null) !== existing.categoryId) {
      events.push({
        taskId: updated.id,
        type: 'category_updated',
        summary: this.categorySummary(updated.categoryId),
        createdAt: ts
      })
    }

    if (dto.tags !== undefined && !sameTagList(existing.tags ?? [], updated.tags ?? [])) {
      events.push({
        taskId: updated.id,
        type: 'tags_updated',
        summary: this.tagsSummary(updated.tags ?? []),
        createdAt: ts
      })
    }

    if (dto.dueAt !== undefined && (dto.dueAt ?? null) !== existing.dueAt) {
      events.push({
        taskId: updated.id,
        type: 'due_updated',
        summary: updated.dueAt ? '设置了截止时间' : '清除了截止时间',
        createdAt: ts
      })
    }

    if (dto.startAt !== undefined && (dto.startAt ?? null) !== existing.startAt) {
      events.push({
        taskId: updated.id,
        type: 'start_updated',
        summary: updated.startAt ? '设置了开始时间' : '清除了开始时间',
        createdAt: ts
      })
    }

    if (this.remindersChanged(existing, dto)) {
      events.push({
        taskId: updated.id,
        type: 'reminders_updated',
        summary: '更新了提醒',
        createdAt: ts
      })
    }

    if (dto.recurrence !== undefined) {
      const prev = existing.recurrence ?? null
      const next = updated.recurrence ?? null
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        let summary = '修改了重复规则'
        if (!prev && next) summary = '设置了重复规则'
        else if (prev && !next) summary = '清除了重复规则'
        events.push({
          taskId: updated.id,
          type: 'recurrence_updated',
          summary,
          createdAt: ts
        })
      }
    }

    if (dto.kanbanGroupId !== undefined && (dto.kanbanGroupId ?? null) !== existing.kanbanGroupId) {
      events.push({
        taskId: updated.id,
        type: 'kanban_group_updated',
        summary: this.kanbanGroupSummary(updated.kanbanGroupId),
        createdAt: ts
      })
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      events.push(...this.statusEvents(existing, updated, dto.status, ts))
    }

    if (dto.completedOccurrenceDates !== undefined) {
      const prev = new Set(existing.completedOccurrenceDates ?? [])
      const next = new Set(updated.completedOccurrenceDates ?? [])
      for (const dateKey of next) {
        if (!prev.has(dateKey)) {
          events.push({
            taskId: updated.id,
            type: 'completed',
            summary: `完成了 ${dateKey} 的重复实例`,
            createdAt: ts
          })
        }
      }
      for (const dateKey of prev) {
        if (!next.has(dateKey)) {
          events.push({
            taskId: updated.id,
            type: 'reopened',
            summary: `取消了 ${dateKey} 的完成状态`,
            createdAt: ts
          })
        }
      }
    }

    return events
  }

  buildDeleteEvent(task: Task, ts: string): TaskActivityRecordInput {
    return {
      taskId: task.id,
      type: 'deleted',
      summary: '移入了垃圾桶',
      createdAt: ts
    }
  }

  buildRestoreEvent(taskId: string, ts: string): TaskActivityRecordInput {
    return {
      taskId,
      type: 'restored',
      summary: '从垃圾桶恢复',
      createdAt: ts
    }
  }

  buildPermanentDeleteEvent(taskId: string, ts: string): TaskActivityRecordInput {
    return {
      taskId,
      type: 'permanently_deleted',
      summary: '已彻底删除',
      createdAt: ts
    }
  }

  buildSubtaskParentEvents(
    parentId: string,
    child: Task,
    kind: 'removed' | 'completed' | 'reopened',
    ts: string
  ): TaskActivityRecordInput {
    const typeMap = {
      removed: 'subtask_removed' as const,
      completed: 'subtask_completed' as const,
      reopened: 'subtask_reopened' as const
    }
    const summaryMap = {
      removed: `删除子任务「${child.title}」`,
      completed: `完成子任务「${child.title}」`,
      reopened: `重新打开子任务「${child.title}」`
    }
    return {
      taskId: parentId,
      type: typeMap[kind],
      summary: summaryMap[kind],
      createdAt: ts
    }
  }

  toActivities(inputs: TaskActivityRecordInput[]): TaskActivity[] {
    return inputs.map((input) => ({
      id: uuidv4(),
      taskId: input.taskId,
      type: input.type,
      summary: input.summary,
      createdAt: input.createdAt ?? nowIso()
    }))
  }

  private statusEvents(
    existing: Task,
    updated: Task,
    nextStatus: TaskStatus,
    ts: string
  ): TaskActivityRecordInput[] {
    const events: TaskActivityRecordInput[] = []
    if (nextStatus === 'DONE' && existing.status !== 'DONE') {
      events.push({
        taskId: updated.id,
        type: 'completed',
        summary: '标记为已完成',
        createdAt: ts
      })
      if (updated.parentId) {
        events.push(this.buildSubtaskParentEvents(updated.parentId, updated, 'completed', ts))
      }
    } else if (existing.status === 'DONE' && nextStatus !== 'DONE') {
      events.push({
        taskId: updated.id,
        type: 'reopened',
        summary: '重新打开任务',
        createdAt: ts
      })
      if (updated.parentId) {
        events.push(this.buildSubtaskParentEvents(updated.parentId, updated, 'reopened', ts))
      }
    }
    return events
  }

  private remindersChanged(existing: Task, dto: UpdateTaskDto): boolean {
    if (dto.reminders === undefined && dto.remindAt === undefined) {
      return false
    }
    const prev = (existing.reminders ?? []).map((r) => ({
      remindAt: r.remindAt,
      offsetMinutes: r.offsetMinutes ?? null
    }))
    let next: { remindAt: string; offsetMinutes: number | null }[] = []
    if (dto.reminders !== undefined) {
      next = dto.reminders.map((r) => ({
        remindAt: r.remindAt,
        offsetMinutes: r.offsetMinutes ?? null
      }))
    } else if (dto.remindAt !== undefined) {
      next = dto.remindAt ? [{ remindAt: dto.remindAt, offsetMinutes: null }] : []
    }
    return JSON.stringify(prev) !== JSON.stringify(next)
  }

  private categorySummary(categoryId: string | null): string {
    if (!categoryId) {
      return '移出了清单'
    }
    const category = this.categoryRepo.findById(categoryId)
    return category ? `移至清单「${category.name}」` : '更改了清单'
  }

  private tagsSummary(tags: string[]): string {
    if (!tags.length) {
      return '清除了标签'
    }
    return `设置标签为 ${tags.map((t) => `#${t}`).join(' ')}`
  }

  private kanbanGroupSummary(kanbanGroupId: string | null): string {
    if (!kanbanGroupId) {
      return '移出了看板分组'
    }
    const group = this.kanbanRepo.findById(kanbanGroupId)
    return group ? `移至看板分组「${group.name}」` : '更改了看板分组'
  }
}
