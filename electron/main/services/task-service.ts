import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import { DEFAULT_TASK_PRIORITY, coerceTaskPriority } from '@shared/task-priority'
import type {
  CreateTaskDto,
  Task,
  TaskListFilter,
  TaskStatus,
  UpdateTaskDto
} from '@shared/types'
import { AppError } from '@shared/types'
import type { TaskRepository } from '../db/task-repository'

const VALID_STATUS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

/** 两者均有值时，提醒不得晚于到期（ISO 字符串字典序比较） */
function assertRemindBeforeDue(remindAt: string | null, dueAt: string | null): void {
  if (remindAt && dueAt && remindAt > dueAt) {
    throw new AppError('VALIDATION_ERROR', '提醒时间不能晚于到期时间')
  }
}

/**
 * 任务业务规则：状态与 completed_at、父任务完成约束、删除时子任务级联。
 */
export class TaskService {
  constructor(private readonly repo: TaskRepository) {}

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
    return task
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
    const remindAt = dto.remindAt ?? null
    assertRemindBeforeDue(remindAt, dueAt)

    // 子任务默认继承父任务清单，避免在分类视图下子任务脱离父任务无法折叠展示
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
      remindAt,
      remindFiredAt: null,
      completedAt: status === 'DONE' ? ts : null,
      sortOrder: dto.sortOrder ?? 0,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      syncVersion: 0
    }
    this.repo.insert(task)
    return task
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

    let remindFiredAt = existing.remindFiredAt
    if (dto.remindAt !== undefined && dto.remindAt !== existing.remindAt) {
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
      dueAt: dto.dueAt !== undefined ? (dto.dueAt ?? null) : existing.dueAt,
      remindAt: dto.remindAt !== undefined ? (dto.remindAt ?? null) : existing.remindAt,
      remindFiredAt,
      completedAt,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: ts
    }

    assertRemindBeforeDue(updated.remindAt, updated.dueAt)

    if (!updated.title.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务标题不能为空')
    }

    this.repo.update(updated)
    return updated
  }

  /**
   * 删除任务。
   * - 无子任务：直接软删除
   * - 有子任务且 cascadeChildren=false：拒绝删除（须 UI 确认后传 true）
   * - cascadeChildren=true：递归软删除全部子孙任务后删除自身
   */
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

  /** 后序遍历：先删子孙，再删当前节点 */
  private softDeleteSubtree(id: string, ts: string): void {
    for (const child of this.repo.findChildrenByParentId(id)) {
      this.softDeleteSubtree(child.id, ts)
    }
    this.repo.softDelete(id, ts)
  }
}
