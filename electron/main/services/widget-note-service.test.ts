import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { WidgetNoteRepository } from '../db/widget-note-repository'
import { TaskRepository } from '../db/task-repository'
import { TaskReminderRepository } from '../db/task-reminder-repository'
import { TagRepository } from '../db/tag-repository'
import { CategoryRepository } from '../db/category-repository'
import { TaskService } from './task-service'
import { WidgetNoteService } from './widget-note-service'
import { AppError } from '@shared/types'

describe('WidgetNoteService', () => {
  let service: WidgetNoteService
  let categoryRepo: CategoryRepository
  let repo: WidgetNoteRepository
  let db: BetterSqlite3.Database

  beforeEach(() => {
    closeDatabase()
    db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    repo = new WidgetNoteRepository(db)
    categoryRepo = new CategoryRepository(db)
    const taskService = new TaskService(
      new TaskRepository(db),
      new TaskReminderRepository(db),
      new TagRepository(db)
    )
    service = new WidgetNoteService(repo, taskService, categoryRepo)
  })

  it('sorts pinned notes before others', () => {
    const a = service.create({ content: 'A' })
    const b = service.create({ content: 'B' })
    service.update(b.id, { pinned: true })
    const list = service.list()
    expect(list[0]?.id).toBe(b.id)
    expect(list.some((n) => n.id === a.id)).toBe(true)
  })

  it('convertToTask throws when note missing', () => {
    expect(() => service.convertToTask('missing-id')).toThrowError(AppError)
  })

  it('convertToTask creates inbox task and deletes note by default', () => {
    const note = service.create({ content: '买牛奶\n第二行' })
    const task = service.convertToTask(note.id)
    expect(task.title).toContain('买牛奶')
    expect(task.description).toBe('买牛奶\n第二行')
    expect(task.triagedAt).toBeNull()
    expect(service.list().some((n) => n.id === note.id)).toBe(false)
  })

  it('convertToTask parses due date when present in text', () => {
    const note = service.create({ content: '明天下午3点买牛奶' })
    const task = service.convertToTask(note.id, { deleteNote: false })
    expect(task.title).toContain('买牛奶')
    expect(task.dueAt).not.toBeNull()
    expect(service.list().some((n) => n.id === note.id)).toBe(true)
  })

  it('convertToTask assigns category by keyword', () => {
    const now = '2026-07-11T09:00:00'
    categoryRepo.insert({
      id: 'cat-study',
      name: '学习',
      color: null,
      sortOrder: 0,
      keywords: ['阅读'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const note = service.create({ content: '阅读 TypeScript 手册' })
    const task = service.convertToTask(note.id, { deleteNote: false })
    expect(task.categoryId).toBe('cat-study')
  })

  it('persists open on startup preference', () => {
    expect(repo.updateSettings({ openOnStartup: true }).openOnStartup).toBe(true)
    expect(repo.getSettings().openOnStartup).toBe(true)

    expect(repo.updateSettings({ openOnStartup: false }).openOnStartup).toBe(false)
    expect(repo.getSettings().openOnStartup).toBe(false)
  })
})
