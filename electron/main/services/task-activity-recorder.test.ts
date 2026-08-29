import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { CategoryRepository } from '../db/category-repository'
import { KanbanGroupRepository } from '../db/kanban-group-repository'
import { TaskActivityRecorder } from './task-activity-recorder'
import type { Task } from '@shared/types'

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '写报告',
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: null,
    parentId: null,
    dueAt: null,
    remindAt: null,
    remindFiredAt: null,
    completedAt: null,
    sortOrder: 0,
    createdAt: '2026-07-09T10:00:00',
    updatedAt: '2026-07-09T10:00:00',
    deletedAt: null,
    syncVersion: 0,
    kanbanGroupId: null,
    recurrence: null,
    completedOccurrenceDates: [],
    remindContinuous: false,
    ...overrides
  }
}

describe('TaskActivityRecorder', () => {
  let recorder: TaskActivityRecorder

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    recorder = new TaskActivityRecorder(new CategoryRepository(db), new KanbanGroupRepository(db))
  })

  it('builds fine-grained update events', () => {
    const existing = baseTask()
    const updated = baseTask({ title: '写周报', updatedAt: '2026-07-09T11:00:00' })
    const events = recorder.buildUpdateEvents(existing, updated, { title: '写周报' })
    expect(events).toEqual([
      expect.objectContaining({ type: 'title_updated', summary: '修改了标题' })
    ])
  })

  it('records parent subtask_added on create', () => {
    const task = baseTask({ id: 'child-1', title: '子项', parentId: 'parent-1' })
    const events = recorder.buildCreateEvents(task, { title: '子项', parentId: 'parent-1' })
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'parent-1', type: 'subtask_added' }),
        expect.objectContaining({ taskId: 'child-1', type: 'created' })
      ])
    )
  })
})
