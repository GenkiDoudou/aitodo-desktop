import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import { DEFAULT_TASK_PRIORITY, coerceTaskPriority } from '@shared/task-priority'
import {
  assertRemindersBeforeDue,
  primaryRemindAt,
  type TaskReminderInput
} from '@shared/task-reminder'
import { normalizeCompletedOccurrenceDates } from '@shared/recurrence-occurrences'
import type {
  CreateTaskDto,
  Task,
  TaskListFilter,
  TaskStatus,
  UpdateTaskDto
} from '@shared/types'
import { AppError } from '@shared/types'
import type { TaskRepository } from '../db/task-repository'
import type { TaskReminderRepository } from '../db/task-reminder-repository'
import type { TagRepository } from '../db/tag-repository'
import type { SyncOutbox } from '../db/sync-outbox'
import type { TaskActivityService } from './task-activity-service'
import type { TaskActivityRecorder } from './task-activity-recorder'
import { normalizeTagNames } from '@shared/task-tags'

const VALID_STATUS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

/** 同步载荷：排除本机提醒已触发状态 */
function taskSyncPayload(task: Task): Record<string, unknown> {
  const { remindFiredAt: _omit, ...rest } = task
  return { ...rest }
}

/**
 * 任务业务规则：状态与 completed_at、父任务完成约束、删除时子任务级联。
 * 提醒支持多条（task_reminders）与循环配置（recurrence_rule）。
 */
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly reminderRepo: TaskReminderRepository,
    private readonly tagRepo: TagRepository,
    private readonly activityService?: TaskActivityService,
    private readonly activityRecorder?: TaskActivityRecorder,
    private readonly outbox?: SyncOutbox
  ) {}

  private withTx<T>(fn: () => T): T {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn()
  }

  private enqueueTaskUpsert(task: Task): void {
    this.outbox?.record({
      entityType: 'task',
      entityId: task.id,
      operation: 'upsert',
      payload: taskSyncPayload(task),
      clientSyncVersion: task.syncVersion
    })
  }

  private enqueueTaskDelete(task: Task, ts: string, syncVersion: number): void {
    this.outbox?.record({
      entityType: 'task',
      entityId: task.id,
      operation: 'delete',
      payload: {
        id: task.id,
        deletedAt: ts,
        updatedAt: ts,
        syncVersion
      },
      clientSyncVersion: syncVersion
    })
  }

  list(filter?: TaskListFilter): Task[] {
    const tasks = this.repo.list(filter ?? {})
    return this.attachTags(tasks)
  }

  get(id: string): Task {
    if (!id?.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务 id 不能为空')
    }
    const task = this.repo.findById(id)
    if (!task) {
      throw new AppError('NOT_FOUND', '任务不存在')
    }
    return this.enrichTask(task)
  }

  getInTrash(id: string): Task {
    if (!id?.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务 id 不能为空')
    }
    const task = this.repo.findByIdIncludingDeleted(id)
    if (!task?.deletedAt) {
      throw new AppError('NOT_FOUND', '任务不在垃圾桶中')
    }
    return this.enrichTask(task)
  }

  countTrash(): number {
    return this.repo.countTrash()
  }

  countDone(): number {
    return this.repo.countDone()
  }

  countInboxUntriaged(): number {
    return this.repo.countInboxUntriaged()
  }

  private enrichTask(task: Task): Task {
    const reminders = this.reminderRepo.listByTaskId(task.id)
    const tags = this.tagRepo.getTagsForTask(task.id)
    return {
      ...task,
      tags,
      reminders,
      remindAt: primaryRemindAt(reminders) ?? task.remindAt
    }
  }

  private attachTags(tasks: Task[]): Task[] {
    if (!tasks.length) {
      return tasks
    }
    const tagMap = this.tagRepo.getTagsByTaskIds(tasks.map((t) => t.id))
    return tasks.map((task) => ({
      ...task,
      tags: tagMap.get(task.id) ?? []
    }))
  }

  private normalizeReminderInputs(dto: CreateTaskDto | UpdateTaskDto, dueAt: string | null): TaskReminderInput[] {
    if (dto.reminders !== undefined) {
      return dto.reminders
    }
    if (dto.remindAt) {
      return [{ remindAt: dto.remindAt, offsetMinutes: null }]
    }
    return []
  }

  create(dto: CreateTaskDto): Task {
    const title = dto.title?.trim()
    if (!title) {
      throw new AppError('VALIDATION_ERROR', '任务标题不能为空')
    }

    let parent: Task | null = null
    if (dto.parentId) {
      parent = this.repo.findById(dto.parentId)
      if (!parent) {
        throw new AppError('NOT_FOUND', '父任务不存在')
      }
    }

    const status = dto.status ?? 'TODO'
    const ts = nowIso()
    const dueAt = dto.dueAt ?? null
    const reminderInputs = this.normalizeReminderInputs(dto, dueAt)
    const err = assertRemindersBeforeDue(reminderInputs, dueAt)
    if (err) {
      throw new AppError('VALIDATION_ERROR', err)
    }

    const recurrence = dto.recurrence ?? null
    if (recurrence && !dueAt) {
      throw new AppError('VALIDATION_ERROR', '设置重复规则需要先设置截止时间')
    }

    let categoryId = dto.categoryId ?? null
    if (!categoryId && parent?.categoryId) {
      categoryId = parent.categoryId
    }

    const task: Task = {
      id: uuidv4(),
      title,
      description: dto.description ?? null,
      status,
      priority: coerceTaskPriority(dto.priority, DEFAULT_TASK_PRIORITY),
      categoryId,
      parentId: dto.parentId ?? null,
      startAt: dto.startAt ?? null,
      dueAt,
      remindAt: primaryRemindAt(reminderInputs as import('@shared/task-reminder').TaskReminderItem[]),
      remindFiredAt: null,
      completedAt: status === 'DONE' ? ts : null,
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      syncVersion: 1,
      kanbanGroupId: dto.kanbanGroupId ?? null,
      recurrence,
      completedOccurrenceDates: [],
      remindContinuous: dto.remindContinuous ?? false,
      tags: dto.tags ? normalizeTagNames(dto.tags) : [],
      triagedAt: dto.triagedAt !== undefined ? (dto.triagedAt ?? null) : null
    }

    return this.withTx(() => {
      this.repo.insert(task)
      if (task.tags.length) {
        this.tagRepo.setTaskTags(task.id, task.tags, ts)
      }
      if (reminderInputs.length) {
        this.reminderRepo.replaceForTask(task.id, reminderInputs, ts)
      }
      this.enqueueTaskUpsert(task)
      this.recordActivities(this.activityRecorder?.buildCreateEvents(task, dto) ?? [])
      return this.enrichTask(task)
    })
  }

  update(id: string, dto: UpdateTaskDto): Task {
    if (!id?.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务 id 不能为空')
    }
    const existing = this.get(id)
    const nextStatus = dto.status ?? existing.status
    if (!VALID_STATUS.includes(nextStatus)) {
      throw new AppError('VALIDATION_ERROR', '无效的任务状态')
    }

    if (nextStatus === 'DONE' && existing.status !== 'DONE') {
      const openChildren = this.repo.countOpenChildren(id)
      if (openChildren > 0) {
        throw new AppError('PARENT_HAS_OPEN_CHILDREN', '存在未完成的子任务')
      }
    }

    const ts = nowIso()
    let completedAt = existing.completedAt
    if (nextStatus === 'DONE') {
      completedAt = ts
    } else if (existing.status === 'DONE' && nextStatus !== 'DONE') {
      completedAt = null
    }

    const dueAt = dto.dueAt !== undefined ? (dto.dueAt ?? null) : existing.dueAt
    const startAt = dto.startAt !== undefined ? (dto.startAt ?? null) : existing.startAt
    const remindersTouched = dto.reminders !== undefined || dto.remindAt !== undefined
    let reminderInputs: TaskReminderInput[] | undefined
    if (dto.reminders !== undefined) {
      reminderInputs = dto.reminders
    } else if (dto.remindAt !== undefined) {
      reminderInputs = dto.remindAt ? [{ remindAt: dto.remindAt, offsetMinutes: null }] : []
    }

    if (reminderInputs) {
      const err = assertRemindersBeforeDue(reminderInputs, dueAt)
      if (err) {
        throw new AppError('VALIDATION_ERROR', err)
      }
    }

    const nextRecurrence =
      dto.recurrence !== undefined ? (dto.recurrence ?? null) : existing.recurrence
    if (nextRecurrence && !dueAt) {
      throw new AppError('VALIDATION_ERROR', '设置重复规则需要先设置截止时间')
    }

    let nextCompletedOccurrences = existing.completedOccurrenceDates ?? []
    if (dto.completedOccurrenceDates !== undefined) {
      nextCompletedOccurrences = normalizeCompletedOccurrenceDates(dto.completedOccurrenceDates)
    } else if (dto.recurrence !== undefined && !nextRecurrence) {
      // 关闭重复时清空单日完成记录
      nextCompletedOccurrences = []
    }

    let remindFiredAt = existing.remindFiredAt
    if (remindersTouched) {
      remindFiredAt = null
    }

    const nextPriority = coerceTaskPriority(
      dto.priority ?? existing.priority,
      existing.priority
    )
    let triagedAt = existing.triagedAt ?? null
    if (dto.priority !== undefined && nextPriority !== existing.priority) {
      triagedAt = ts
    }

    const updated: Task = {
      ...existing,
      title: dto.title?.trim() ?? existing.title,
      description: dto.description !== undefined ? (dto.description ?? null) : existing.description,
      status: nextStatus,
      priority: nextPriority,
      categoryId: dto.categoryId !== undefined ? (dto.categoryId ?? null) : existing.categoryId,
      parentId: dto.parentId !== undefined ? (dto.parentId ?? null) : existing.parentId,
      startAt,
      dueAt,
      remindAt:
        reminderInputs !== undefined
          ? primaryRemindAt(reminderInputs as import('@shared/task-reminder').TaskReminderItem[])
          : existing.remindAt,
      remindFiredAt,
      completedAt,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      kanbanGroupId:
        dto.kanbanGroupId !== undefined ? (dto.kanbanGroupId ?? null) : existing.kanbanGroupId,
      recurrence: nextRecurrence,
      completedOccurrenceDates: nextCompletedOccurrences,
      remindContinuous:
        dto.remindContinuous !== undefined ? dto.remindContinuous : existing.remindContinuous,
      triagedAt,
      updatedAt: ts,
      syncVersion: existing.syncVersion + 1
    }

    if (!updated.title.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务标题不能为空')
    }

    let nextTags = existing.tags ?? []
    if (dto.tags !== undefined) {
      nextTags = normalizeTagNames(dto.tags)
    }
    updated.tags = nextTags

    return this.withTx(() => {
      this.repo.update(updated)
      if (dto.tags !== undefined) {
        this.tagRepo.setTaskTags(id, nextTags, ts)
      }
      if (reminderInputs !== undefined) {
        this.reminderRepo.replaceForTask(id, reminderInputs, ts)
      } else if (dto.dueAt !== undefined && dueAt && existing.reminders?.length) {
        // 截止变更时，按 offset 重算相对提醒
        this.reminderRepo.rebuildOffsetsForTask(id, dueAt)
      }
      this.enqueueTaskUpsert(updated)
      this.recordActivities(
        this.activityRecorder?.buildUpdateEvents(existing, updated, dto) ?? []
      )
      return this.enrichTask(updated)
    })
  }

  delete(id: string, options?: { cascadeChildren?: boolean }): void {
    const task = this.get(id)
    const ts = nowIso()
    const childCount = this.repo.countChildren(id)

    if (childCount > 0) {
      if (!options?.cascadeChildren) {
        throw new AppError(
          'HAS_CHILDREN',
          `该任务下有 ${childCount} 个子任务，请确认是否一并删除`
        )
      }
      this.softDeleteSubtree(task, ts)
      return
    }

    this.withTx(() => {
      const syncVersion = task.syncVersion + 1
      this.recordDelete(task, ts)
      this.repo.softDelete(id, ts, syncVersion)
      this.enqueueTaskDelete(task, ts, syncVersion)
    })
  }

  private recordDelete(task: Task, ts: string): void {
    if (!this.activityRecorder) return
    const events = []
    if (task.parentId) {
      events.push(
        this.activityRecorder.buildSubtaskParentEvents(task.parentId, task, 'removed', ts)
      )
    }
    events.push(this.activityRecorder.buildDeleteEvent(task, ts))
    this.recordActivities(events)
  }

  private softDeleteSubtree(task: Task, ts: string): void {
    this.withTx(() => {
      this.softDeleteSubtreeInTx(task, ts)
    })
  }

  private softDeleteSubtreeInTx(task: Task, ts: string): void {
    for (const child of this.repo.findChildrenByParentId(task.id)) {
      this.softDeleteSubtreeInTx(child, ts)
    }
    const syncVersion = task.syncVersion + 1
    this.recordDelete(task, ts)
    this.repo.softDelete(task.id, ts, syncVersion)
    this.enqueueTaskDelete(task, ts, syncVersion)
  }

  restore(id: string): Task {
    const task = this.repo.findByIdIncludingDeleted(id)
    if (!task?.deletedAt) {
      throw new AppError('NOT_FOUND', '任务不在垃圾桶中')
    }
    if (task.parentId) {
      const parent = this.repo.findByIdIncludingDeleted(task.parentId)
      if (parent?.deletedAt) {
        this.restore(task.parentId)
      } else if (!parent) {
        this.repo.clearParentOnDeleted(id, nowIso())
      }
    }
    const ts = nowIso()
    return this.withTx(() => {
      this.repo.restore(id, ts)
      if (this.activityRecorder) {
        this.recordActivities([this.activityRecorder.buildRestoreEvent(id, ts)])
      }
      const restored = this.get(id)
      const withVersion: Task = { ...restored, syncVersion: restored.syncVersion + 1, updatedAt: ts }
      this.repo.update(withVersion)
      this.enqueueTaskUpsert(withVersion)
      return this.enrichTask(withVersion)
    })
  }

  permanentDelete(id: string, options?: { cascadeChildren?: boolean }): void {
    const task = this.repo.findByIdIncludingDeleted(id)
    if (!task?.deletedAt) {
      throw new AppError('NOT_FOUND', '任务不在垃圾桶中')
    }
    const childCount = this.repo.findDeletedChildrenByParentId(id).length
    if (childCount > 0) {
      if (!options?.cascadeChildren) {
        throw new AppError(
          'HAS_CHILDREN',
          `该任务下有 ${childCount} 个子任务，请确认是否一并彻底删除`
        )
      }
      for (const child of this.repo.findDeletedChildrenByParentId(id)) {
        this.permanentDelete(child.id, { cascadeChildren: true })
      }
    }
    const ts = nowIso()
    this.reminderRepo.deleteByTaskId(id)
    this.activityService?.deleteByTaskId(id)
    this.repo.hardDelete(id)
  }

  emptyTrash(): number {
    this.activityService?.deleteForTrashedTasks()
    return this.repo.hardDeleteAllTrash()
  }

  /** 按 ids 顺序重写 sortOrder；未列出任务不变；未知 id 跳过；全非法报错；空数组 no-op */
  reorder(ids: string[]): Task[] {
    if (!ids.length) return []
    const existing = new Set(
      this.repo.list({}).map((t) => t.id)
    )
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const id of ids) {
      if (!existing.has(id) || seen.has(id)) continue
      seen.add(id)
      ordered.push(id)
    }
    if (!ordered.length) {
      throw new AppError('VALIDATION_ERROR', '没有可排序的任务')
    }
    const ts = nowIso()
    return this.withTx(() => {
      const result: Task[] = []
      ordered.forEach((id, index) => {
        const task = this.repo.findById(id)
        if (!task) return
        const next: Task = {
          ...task,
          sortOrder: index,
          updatedAt: ts,
          syncVersion: task.syncVersion + 1
        }
        this.repo.update(next)
        this.enqueueTaskUpsert(next)
        result.push(this.enrichTask(next))
      })
      return result
    })
  }

  private recordActivities(inputs: import('./task-activity-recorder').TaskActivityRecordInput[]): void {
    if (!this.activityService || !this.activityRecorder || !inputs.length) {
      return
    }
    this.activityService.recordMany(this.activityRecorder.toActivities(inputs))
  }
}
