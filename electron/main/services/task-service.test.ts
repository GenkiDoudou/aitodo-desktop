import { describe, it, expect, beforeEach } from 'vitest'
import dayjs from 'dayjs'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { TaskReminderRepository } from '../db/task-reminder-repository'
import { TaskRepository } from '../db/task-repository'
import { TaskService } from './task-service'
import { AppError } from '@shared/types'

describe('TaskService', () => {
  let service: TaskService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new TaskService(new TaskRepository(db), new TaskReminderRepository(db))
  })

  it('creates task with TODO status', () => {
    const task = service.create({ title: '测试任务' })
    expect(task.title).toBe('测试任务')
    expect(task.status).toBe('TODO')
    expect(task.priority).toBe(4)
    expect(task.completedAt).toBeNull()
  })

  it('creates task with multiple reminders', () => {
    const due = dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm:ss')
    const task = service.create({
      title: '多提醒',
      dueAt: due,
      reminders: [
        { remindAt: due, offsetMinutes: 0 },
        { remindAt: dayjs(due).subtract(30, 'minute').format('YYYY-MM-DDTHH:mm:ss'), offsetMinutes: 30 }
      ]
    })
    const loaded = service.get(task.id)
    expect(loaded.reminders).toHaveLength(2)
  })

  it('creates task with explicit priority', () => {
    const task = service.create({ title: '紧急', priority: 1 })
    expect(task.priority).toBe(1)
  })

  it('coerces string priority on create (IPC JSON)', () => {
    const task = service.create({ title: '紧急', priority: '1' as unknown as 1 })
    expect(task.priority).toBe(1)
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

  it('rejects delete parent when children exist without cascade', () => {
    const parent = service.create({ title: '父' })
    service.create({ title: '子', parentId: parent.id })
    expect(() => service.delete(parent.id)).toThrowError(AppError)
    expect(() => service.delete(parent.id, { cascadeChildren: false })).toThrowError(AppError)
  })

  it('cascade deletes children when parent deleted with cascadeChildren', () => {
    const parent = service.create({ title: '父' })
    const child = service.create({ title: '子', parentId: parent.id })
    service.delete(parent.id, { cascadeChildren: true })
    const list = service.list({})
    expect(list.find((t) => t.id === parent.id)).toBeUndefined()
    expect(list.find((t) => t.id === child.id)).toBeUndefined()
  })

  it('cascade deletes nested descendants', () => {
    const parent = service.create({ title: '父' })
    const child = service.create({ title: '子', parentId: parent.id })
    const grand = service.create({ title: '孙', parentId: child.id })
    service.delete(parent.id, { cascadeChildren: true })
    const list = service.list({})
    expect(list.map((t) => t.id)).not.toContain(parent.id)
    expect(list.map((t) => t.id)).not.toContain(child.id)
    expect(list.map((t) => t.id)).not.toContain(grand.id)
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

  it('lists tasks filtered by categoryId', () => {
    const catA = 'cat-a-1111'
    const catB = 'cat-b-2222'
    service.create({ title: 'A1', categoryId: catA })
    service.create({ title: 'A2', categoryId: catA })
    service.create({ title: 'B1', categoryId: catB })
    service.create({ title: '无分类' })

    const listA = service.list({ categoryId: catA })
    expect(listA.map((t) => t.title).sort()).toEqual(['A1', 'A2'])

    const listB = service.list({ categoryId: catB })
    expect(listB.map((t) => t.title)).toEqual(['B1'])

    const listUncat = service.list({ categoryId: null })
    expect(listUncat.map((t) => t.title)).toEqual(['无分类'])
  })

  it('rejects remind after due on update', () => {
    const task = service.create({ title: '更新校验', dueAt: '2026-07-02T10:00:00' })
    expect(() =>
      service.update(task.id, { remindAt: '2026-07-02T12:00:00', dueAt: '2026-07-02T11:00:00' })
    ).toThrowError(AppError)
  })

  it('creates with title only (quick add)', () => {
    const task = service.create({ title: '快捷添加' })
    expect(task.title).toBe('快捷添加')
    expect(task.categoryId).toBeNull()
    expect(task.parentId).toBeNull()
  })

  it('inherits parent category for subtasks', () => {
    const parent = service.create({ title: '父', categoryId: 'cat-a' })
    const child = service.create({ title: '子', parentId: parent.id })
    expect(child.categoryId).toBe('cat-a')
  })

  it('lists subtasks when filtering by parent category', () => {
    const parent = service.create({ title: '父', categoryId: 'cat-a' })
    service.create({ title: '子', parentId: parent.id })
    const list = service.list({ categoryId: 'cat-a' })
    expect(list.map((t) => t.title).sort()).toEqual(['子', '父'])
  })

  it('rejects empty task id on get/update', () => {
    expect(() => service.get('')).toThrowError(AppError)
    expect(() => service.update('', { title: 'x' })).toThrowError(AppError)
  })

  it('creates subtask under parent without SQL bind errors', () => {
    const parent = service.create({ title: '父', categoryId: null })
    const child = service.create({ title: '子', parentId: parent.id })
    expect(child.parentId).toBe(parent.id)
    const list = service.list({ smartList: 'all', hideDone: true })
    expect(list.some((t) => t.id === child.id)).toBe(true)
  })

  it('filters last7days by due cutoff', () => {
    const base = dayjs()
    const inRange = service.create({
      title: '7天内',
      dueAt: `${base.add(2, 'day').format('YYYY-MM-DD')}T10:00:00`
    })
    const outRange = service.create({
      title: '超出7天',
      dueAt: `${base.add(8, 'day').format('YYYY-MM-DD')}T10:00:00`
    })
    const list = service.list({ smartList: 'last7days', hideDone: true })
    expect(list.some((t) => t.id === inRange.id)).toBe(true)
    expect(list.some((t) => t.id === outRange.id)).toBe(false)
  })

  it('filters week by due cutoff through Sunday', () => {
    const base = dayjs()
    const inWeek = service.create({
      title: '本周内',
      dueAt: `${base.endOf('week').format('YYYY-MM-DD')}T18:00:00`
    })
    const nextWeek = service.create({
      title: '下周',
      dueAt: `${base.add(8, 'day').format('YYYY-MM-DD')}T10:00:00`
    })
    const list = service.list({ smartList: 'week', hideDone: true })
    expect(list.some((t) => t.id === inWeek.id)).toBe(true)
    expect(list.some((t) => t.id === nextWeek.id)).toBe(false)
  })

  it('filters done list by doneTimeRange today', () => {
    const todayDone = service.create({ title: '今日完成' })
    service.update(todayDone.id, { status: 'DONE' })
    const list = service.list({ smartList: 'done', doneTimeRange: 'today' })
    expect(list.some((t) => t.id === todayDone.id)).toBe(true)
  })

  it('filters smart list by createdAt', () => {
    const inToday = service.create({ title: '今日创建' })
    const list = service.list({
      smartList: 'today',
      dateField: 'createdAt',
      hideDone: true
    })
    expect(list.some((t) => t.id === inToday.id)).toBe(true)
  })

  it('lists soft-deleted tasks in trash smart list', () => {
    const task = service.create({ title: '待删' })
    service.delete(task.id)
    const active = service.list({ smartList: 'all' })
    const trash = service.list({ smartList: 'trash' })
    expect(active.some((t) => t.id === task.id)).toBe(false)
    expect(trash.some((t) => t.id === task.id)).toBe(true)
  })

  it('restores task from trash', () => {
    const task = service.create({ title: '恢复' })
    service.delete(task.id)
    const restored = service.restore(task.id)
    expect(restored.deletedAt).toBeNull()
    expect(service.list({ smartList: 'trash' })).toHaveLength(0)
  })

  it('permanently deletes task in trash', () => {
    const task = service.create({ title: '清除' })
    service.delete(task.id)
    service.permanentDelete(task.id)
    expect(service.list({ smartList: 'trash' })).toHaveLength(0)
    expect(service.countTrash()).toBe(0)
  })

  it('empties trash', () => {
    const a = service.create({ title: 'a' })
    const b = service.create({ title: 'b' })
    service.delete(a.id)
    service.delete(b.id)
    expect(service.emptyTrash()).toBe(2)
    expect(service.countTrash()).toBe(0)
  })
})
