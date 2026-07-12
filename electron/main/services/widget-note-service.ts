import { buildQuickCreateTaskDto } from '@shared/quick-create-task'
import { AppError } from '@shared/types'
import type { Task } from '@shared/types'
import type {
  ConvertWidgetNoteToTaskDto,
  CreateWidgetNoteDto,
  UpdateWidgetNoteDto,
  WidgetNote
} from '@shared/widget-notes'
import type { WidgetNoteRepository } from '../db/widget-note-repository'
import type { TaskService } from './task-service'
import type { CategoryRepository } from '../db/category-repository'

export class WidgetNoteService {
  constructor(
    private readonly repo: WidgetNoteRepository,
    private readonly taskService: TaskService,
    private readonly categoryRepo: CategoryRepository
  ) {}

  list(): WidgetNote[] {
    return this.repo.listNotes()
  }

  create(dto: CreateWidgetNoteDto = {}): WidgetNote {
    return this.repo.createNote(dto)
  }

  update(id: string, dto: UpdateWidgetNoteDto): WidgetNote {
    return this.repo.updateNote(id, dto)
  }

  delete(id: string): void {
    this.repo.deleteNote(id)
  }

  /** 将便签转为任务：与快捷添加相同解析逻辑，默认进收件箱（triagedAt = null） */
  convertToTask(noteId: string, dto: ConvertWidgetNoteToTaskDto = {}): Task {
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
      this.repo.deleteNote(noteId)
    }
    return task
  }
}
