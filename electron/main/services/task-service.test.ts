import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { TaskRepository } from '../db/task-repository'
import { TaskService } from './task-service'
import { AppError } from '@shared/types'

describe('TaskService', () => {
  let service: TaskService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new TaskService(new TaskRepository(db))
  })

  it('creates task with TODO status', () => {
    const task = service.create({ title: '测试任务' })
    expect(task.title).toBe('测试任务')
    expect(task.status).toBe('TODO')
    expect(task.completedAt).toBeNull()
  })

  it('sets completed_at when marked DONE', () => {
    const task = service.create({ title: '完成测试' })
    const done = service.update(task.id, { status: 'DONE' })
    expect(done.status).toBe('DONE')
    expect(done.completedAt).not.toBeNull()
  })

  it('blocks parent DONE when child is open', () => {
    const parent = service.create({ title: '父任务' })
    service.create({ title: '子任务', parentId: parent.id })
    expect(() => service.update(parent.id, { status: 'DONE' })).toThrowError(AppError)
  })

  it('promotes children when parent deleted', () => {
    const parent = service.create({ title: '父' })
    const child = service.create({ title: '子', parentId: parent.id })
    service.delete(parent.id)
    const list = service.list({})
    const updatedChild = list.find((t) => t.id === child.id)
    expect(updatedChild?.parentId).toBeNull()
  })

  it('rejects remind after due on create', () => {
    expect(() =>
      service.create({
        title: '时间校验',
        dueAt: '2026-07-02T15:00:00',
        remindAt: '2026-07-02T16:00:00'
      })
    ).toThrowError(AppError)
  })

  it('allows remind without due on create', () => {
    const task = service.create({
      title: '仅提醒',
      remindAt: '2026-07-02T16:00:00'
    })
    expect(task.remindAt).toBe('2026-07-02T16:00:00')
    expect(task.dueAt).toBeNull()
  })

  it('lists new task under hideDone all filter', () => {
    const task = service.create({ title: '列表可见' })
    const list = service.list({ smartList: 'all', hideDone: true })
    expect(list.some((t) => t.id === task.id)).toBe(true)
  })

  it('rejects remind after due on update', () => {
    const task = service.create({ title: '更新校验', dueAt: '2026-07-02T10:00:00' })
    expect(() =>
      service.update(task.id, { remindAt: '2026-07-02T12:00:00', dueAt: '2026-07-02T11:00:00' })
    ).toThrowError(AppError)
  })
})
