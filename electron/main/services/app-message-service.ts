import { v4 as uuidv4 } from 'uuid'
import { nowIso } from '@shared/datetime'
import type { AppMessage, AppMessageKind, CreateAppMessageDto, Task } from '@shared/types'
import { AppError } from '@shared/types'
import type { SyncPreferences } from '@shared/sync-preferences'
import type { AppMessageRepository } from '../db/app-message-repository'
import type { SyncOutbox } from '../db/sync-outbox'

function messageSyncPayload(message: AppMessage): Record<string, unknown> {
  return {
    id: message.id,
    kind: message.kind,
    title: message.title,
    body: message.body,
    taskId: message.taskId,
    source: message.source,
    readAt: message.readAt,
    createdAt: message.createdAt,
    updatedAt: message.readAt ?? message.createdAt
  }
}

export class AppMessageService {
  constructor(
    private readonly repo: AppMessageRepository,
    private readonly outbox?: SyncOutbox,
    private readonly getSyncPrefs?: () => SyncPreferences
  ) {}

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
    this.enqueueIfSummaryResult(message)
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
    const updated = this.repo.findById(id)!
    this.enqueueIfSummaryResult(updated)
    return updated
  }

  markAllRead(kind?: AppMessageKind): number {
    const pendingRead =
      this.outbox && this.getSyncPrefs?.().syncSummaryResults
        ? this.repo
            .list('notification', 200, 'scheduled_summary')
            .filter((m) => !m.readAt)
            .map((m) => m.id)
        : []
    const n = this.repo.markAllRead(kind, nowIso())
    for (const id of pendingRead) {
      const updated = this.repo.findById(id)
      if (updated) this.enqueueIfSummaryResult(updated)
    }
    return n
  }

  private enqueueIfSummaryResult(message: AppMessage): void {
    if (!this.outbox || !this.getSyncPrefs) return
    if (!this.getSyncPrefs().syncSummaryResults) return
    if (message.kind !== 'notification' || message.source !== 'scheduled_summary') return
    this.outbox.record({
      entityType: 'app_message',
      entityId: message.id,
      operation: 'upsert',
      payload: messageSyncPayload(message),
      clientSyncVersion: 1
    })
  }
}
