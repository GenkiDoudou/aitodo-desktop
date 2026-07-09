import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { TaskActivityRepository } from '../db/task-activity-repository'
import { TaskActivityService } from './task-activity-service'
import type { TaskActivity } from '@shared/types'

function activity(taskId: string, summary: string, createdAt: string): TaskActivity {
  return {
    id: uuidv4(),
    taskId,
    type: 'created',
    summary,
    createdAt
  }
}

describe('TaskActivityService', () => {
  let service: TaskActivityService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new TaskActivityService(new TaskActivityRepository(db), () => ({ mode: 'forever' }))
  })

  it('lists activities by task', () => {
    const taskId = uuidv4()
    service.recordMany([
      activity(taskId, '创建了任务', '2026-07-09T10:00:00'),
      activity(taskId, '修改了标题', '2026-07-09T11:00:00')
    ])
    expect(service.listByTask(taskId)).toHaveLength(2)
  })

  it('purges by max_count policy', () => {
    const taskId = uuidv4()
    const rows = Array.from({ length: 5 }, (_, i) =>
      activity(taskId, `事件 ${i}`, `2026-07-09T10:0${i}:00`)
    )
    service.recordMany(rows)
    const removed = service.purgeByPolicy({ mode: 'max_count', maxCount: 2 })
    expect(removed).toBe(3)
    expect(service.countAll()).toBe(2)
  })

  it('deletes all activities', () => {
    service.recordMany([activity(uuidv4(), 'a', '2026-07-09T10:00:00')])
    expect(service.deleteAll()).toBe(1)
    expect(service.countAll()).toBe(0)
  })
})
