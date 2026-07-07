import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import type { AppMessage, AppMessageKind, CreateAppMessageDto, Task } from '@shared/types'
import { AppError } from '@shared/types'
import type { AppMessageRepository } from '../db/app-message-repository'

export class AppMessageService {
  constructor(private readonly repo: AppMessageRepository) {}

  list(kind?: AppMessageKind, source?: AppMessage['source']): AppMessage[] {
    return this.repo.list(kind, 100, source)
  }

  countUnread(kind?: AppMessageKind): number {
    return this.repo.countUnread(kind)
  }

  create(dto: CreateAppMessageDto): AppMessage {
    const title = dto.title?.trim()
    if (!title) {
      throw new AppError('VALIDATION_ERROR', '消息标题不能为空')
    }
    const ts = nowIso()
    const message: AppMessage = {
      id: uuidv4(),
      kind: dto.kind,
      title,
      body: dto.body?.trim() ? dto.body.trim() : null,
      taskId: dto.taskId ?? null,
      source: dto.source ?? null,
      readAt: null,
      createdAt: ts
    }
    this.repo.insert(message)
    return message
  }

  /** 任务提醒触发时写入应用内通知 */
  createTaskReminder(task: Task): AppMessage {
    return this.create({
      kind: 'notification',
      title: '任务提醒',
      body: task.title,
      taskId: task.id,
      source: 'task_reminder'
    })
  }

  markRead(id: string): AppMessage {
    const existing = this.repo.findById(id)
    if (!existing) {
      throw new AppError('NOT_FOUND', '消息不存在')
    }
    if (!existing.readAt) {
      this.repo.markRead(id, nowIso())
    }
    return this.repo.findById(id)!
  }

  markAllRead(kind?: AppMessageKind): number {
    return this.repo.markAllRead(kind, nowIso())
  }
}
