import { buildQuickCreateTaskDto } from '@shared/quick-create-task'
import { nowIso } from '@shared/datetime'
import { AppError } from '@shared/types'
import type { Task } from '@shared/types'
import type {
  ConvertWidgetNoteToTaskDto,
  CreateWidgetNoteDto,
  UpdateWidgetNoteDto,
  WidgetNote
} from '@shared/widget-notes'
import type { WidgetNoteRepository } from '../db/widget-note-repository'
import type { SyncOutbox } from '../db/sync-outbox'
import type { TaskService } from './task-service'
import type { CategoryRepository } from '../db/category-repository'

function notePayload(note: WidgetNote): Record<string, unknown> {
  return {
    id: note.id,
    content: note.content,
    color: note.color,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  }
}

export class WidgetNoteService {
  constructor(
    private readonly repo: WidgetNoteRepository,
    private readonly taskService: TaskService,
    private readonly categoryRepo: CategoryRepository,
    private readonly outbox?: SyncOutbox
  ) {}

  private tx<T>(fn: () => T): T {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn()
  }

  private enqueueUpsert(note: WidgetNote): void {
    this.outbox?.record({
      entityType: 'widget_note',
      entityId: note.id,
      operation: 'upsert',
      payload: notePayload(note),
      clientSyncVersion: 1
    })
  }

  private enqueueDelete(note: WidgetNote, ts: string): void {
    this.outbox?.record({
      entityType: 'widget_note',
      entityId: note.id,
      operation: 'delete',
      payload: { ...notePayload(note), updatedAt: ts, deletedAt: ts },
      clientSyncVersion: 1
    })
  }

  list(): WidgetNote[] {
    return this.repo.listNotes()
  }

  create(dto: CreateWidgetNoteDto = {}): WidgetNote {
    return this.tx(() => {
      const note = this.repo.createNote(dto)
      this.enqueueUpsert(note)
      return note
    })
  }

  update(id: string, dto: UpdateWidgetNoteDto): WidgetNote {
    return this.tx(() => {
      const note = this.repo.updateNote(id, dto)
      this.enqueueUpsert(note)
      return note
    })
  }

  delete(id: string): void {
    this.tx(() => {
      const note = this.repo.findNote(id)
      if (!note) {
        throw new AppError('NOT_FOUND', '便签不存在')
      }
      const ts = nowIso()
      this.repo.deleteNote(id)
      this.enqueueDelete(note, ts)
    })
  }

  /** 将便签转为任务：与快捷添加相同解析逻辑，默认进收件箱（triagedAt = null） */
  convertToTask(noteId: string, dto: ConvertWidgetNoteToTaskDto = {}): Task {
    return this.tx(() => {
      const note = this.repo.findNote(noteId)
      if (!note) {
        throw new AppError('NOT_FOUND', '便签不存在')
      }
      const categories = this.categoryRepo.list()
      const createDto = buildQuickCreateTaskDto(note.content, categories, {
        description: note.content.trim() || null,
        triagedAt: null
      })
      if (!createDto.title.trim()) {
        createDto.title = '便签任务'
      }
      const task = this.taskService.create(createDto)
      if (dto.deleteNote !== false) {
        const ts = nowIso()
        this.repo.deleteNote(noteId)
        this.enqueueDelete(note, ts)
      }
      return task
    })
  }
}
