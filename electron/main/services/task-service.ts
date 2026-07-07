import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import { DEFAULT_TASK_PRIORITY, coerceTaskPriority } from '@shared/task-priority'
import {
  assertRemindersBeforeDue,
  primaryRemindAt,
  type TaskReminderInput
} from '@shared/task-reminder'
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

const VALID_STATUS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

/**
 * 任务业务规则：状态与 completed_at、父任务完成约束、删除时子任务级联。
 * 提醒支持多条（task_reminders）与循环配置（recurrence_rule）。
 */
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly reminderRepo: TaskReminderRepository
  ) {}

  list(filter?: TaskListFilter): Task[] {
    return this.repo.list(filter ?? {})
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

  private enrichTask(task: Task): Task {
    const reminders = this.reminderRepo.listByTaskId(task.id)
    return {
      ...task,
      reminders,
      remindAt: primaryRemindAt(reminders) ?? task.remindAt
    }
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
      dueAt,
      remindAt: primaryRemindAt(reminderInputs as import('@shared/task-reminder').TaskReminderItem[]),
      remindFiredAt: null,
      completedAt: status === 'DONE' ? ts : null,
      sortOrder: dto.sortOrder ?? 0,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      syncVersion: 0,
      kanbanGroupId: dto.kanbanGroupId ?? null,
      recurrence,
      remindContinuous: dto.remindContinuous ?? false
    }

    this.repo.insert(task)
    if (reminderInputs.length) {
      this.reminderRepo.replaceForTask(task.id, reminderInputs, ts)
    }
    return this.enrichTask(task)
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

    let remindFiredAt = existing.remindFiredAt
    if (remindersTouched) {
      remindFiredAt = null
    }

    const updated: Task = {
      ...existing,
      title: dto.title?.trim() ?? existing.title,
      description: dto.description !== undefined ? (dto.description ?? null) : existing.description,
      status: nextStatus,
      priority: coerceTaskPriority(dto.priority ?? existing.priority, existing.priority),
      categoryId: dto.categoryId !== undefined ? (dto.categoryId ?? null) : existing.categoryId,
      parentId: dto.parentId !== undefined ? (dto.parentId ?? null) : existing.parentId,
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
      remindContinuous:
        dto.remindContinuous !== undefined ? dto.remindContinuous : existing.remindContinuous,
      updatedAt: ts
    }

    if (!updated.title.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务标题不能为空')
    }

    this.repo.update(updated)
    if (reminderInputs !== undefined) {
      this.reminderRepo.replaceForTask(id, reminderInputs, ts)
    } else if (dto.dueAt !== undefined && dueAt && existing.reminders?.length) {
      // 截止变更时，按 offset 重算相对提醒
      this.reminderRepo.rebuildOffsetsForTask(id, dueAt)
    }
    return this.enrichTask(updated)
  }

  delete(id: string, options?: { cascadeChildren?: boolean }): void {
    this.get(id)
    const ts = nowIso()
    const childCount = this.repo.countChildren(id)

    if (childCount > 0) {
      if (!options?.cascadeChildren) {
        throw new AppError(
          'HAS_CHILDREN',
          `该任务下有 ${childCount} 个子任务，请确认是否一并删除`
        )
      }
      this.softDeleteSubtree(id, ts)
      return
    }

    this.repo.softDelete(id, ts)
  }

  private softDeleteSubtree(id: string, ts: string): void {
    for (const child of this.repo.findChildrenByParentId(id)) {
      this.softDeleteSubtree(child.id, ts)
    }
    this.repo.softDelete(id, ts)
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
    this.repo.restore(id, ts)
    return this.get(id)
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
    this.reminderRepo.deleteByTaskId(id)
    this.repo.hardDelete(id)
  }

  emptyTrash(): number {
    return this.repo.hardDeleteAllTrash()
  }
}
