import type { TaskActivity, TaskActivityRetentionPolicy } from '@shared/types'
import { AppError } from '@shared/types'
import {
  mergeTaskActivityRetention,
  validateTaskActivityRetention
} from '@shared/task-activity-retention'
import {
  readTaskActivityRetention,
  saveTaskActivityRetention
} from '../data-path'
import type { TaskActivityRepository } from '../db/task-activity-repository'

export class TaskActivityService {
  constructor(
    private readonly repo: TaskActivityRepository,
    private readonly getPolicy: () => TaskActivityRetentionPolicy = readTaskActivityRetention
  ) {}

  listByTask(taskId: string, limit = 100, before?: string): TaskActivity[] {
    if (!taskId?.trim()) {
      throw new AppError('VALIDATION_ERROR', '任务 id 不能为空')
    }
    return this.repo.listByTask(taskId, limit, before)
  }

  countAll(): number {
    return this.repo.countAll()
  }

  recordMany(activities: TaskActivity[]): void {
    if (!activities.length) return
    this.repo.insertMany(activities)
    this.purgeByCurrentPolicy()
  }

  getRetentionPolicy(): TaskActivityRetentionPolicy {
    return this.getPolicy()
  }

  updateRetentionPolicy(policy: TaskActivityRetentionPolicy): TaskActivityRetentionPolicy {
    const merged = mergeTaskActivityRetention(policy)
    const err = validateTaskActivityRetention(merged)
    if (err) {
      throw new AppError('VALIDATION_ERROR', err)
    }
    saveTaskActivityRetention(merged)
    return merged
  }

  purgeByCurrentPolicy(): number {
    return this.repo.purgeByPolicy(this.getPolicy())
  }

  purgeByPolicy(policy: TaskActivityRetentionPolicy): number {
    const merged = mergeTaskActivityRetention(policy)
    const err = validateTaskActivityRetention(merged)
    if (err) {
      throw new AppError('VALIDATION_ERROR', err)
    }
    return this.repo.purgeByPolicy(merged)
  }

  deleteAll(): number {
    return this.repo.deleteAll()
  }

  deleteForTrashedTasks(): number {
    return this.repo.deleteForTrashedTasks()
  }

  deleteByTaskId(taskId: string): number {
    return this.repo.deleteByTaskId(taskId)
  }
}
