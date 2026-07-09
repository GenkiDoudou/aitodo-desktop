import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import dayjs from 'dayjs'
import { runMigrations } from '../db/migrations'
import { TaskRepository } from '../db/task-repository'
import { localDayBounds } from '@shared/summary-report-config'

describe('TaskRepository.listForSummaryReport', () => {
  let repo: TaskRepository
  let db: BetterSqlite3.Database

  beforeEach(() => {
    db = new BetterSqlite3(':memory:')
    runMigrations(db)
    repo = new TaskRepository(db)
    db.prepare(
      `INSERT INTO categories (id, name, sort_order, created_at, updated_at)
       VALUES ('c1', '工作', 0, '2026-07-01T00:00:00', '2026-07-01T00:00:00'),
              ('c2', '生活', 1, '2026-07-01T00:00:00', '2026-07-01T00:00:00')`
    ).run()
  })

  function insertTask(row: {
    id: string
    title: string
    status?: string
    categoryId?: string | null
    dueAt?: string | null
    completedAt?: string | null
    createdAt?: string
  }) {
    const created = row.createdAt ?? '2026-07-01T08:00:00'
    db.prepare(
      `INSERT INTO tasks (
        id, title, description, status, priority, category_id, parent_id,
        due_at, remind_at, remind_fired_at, completed_at, sort_order,
        created_at, updated_at, deleted_at, sync_version
      ) VALUES (
        @id, @title, null, @status, 4, @categoryId, null,
        @dueAt, null, null, @completedAt, 0,
        @createdAt, @createdAt, null, 0
      )`
    ).run({
      id: row.id,
      title: row.title,
      status: row.status ?? 'TODO',
      categoryId: row.categoryId ?? null,
      dueAt: row.dueAt ?? null,
      completedAt: row.completedAt ?? null,
      createdAt: created
    })
  }

  it('filters by category and due_today_only bounds', () => {
    const day = localDayBounds(dayjs('2026-07-08T12:00:00'))
    insertTask({
      id: 't1',
      title: '今天到期-工作',
      categoryId: 'c1',
      dueAt: '2026-07-08T09:00:00'
    })
    insertTask({
      id: 't2',
      title: '今天到期-生活',
      categoryId: 'c2',
      dueAt: '2026-07-08T10:00:00'
    })
    insertTask({
      id: 't3',
      title: '明天到期',
      categoryId: 'c1',
      dueAt: '2026-07-09T09:00:00'
    })
    insertTask({
      id: 't4',
      title: '昨天到期边界外',
      categoryId: 'c1',
      dueAt: '2026-07-07T23:59:59'
    })

    const list = repo.listForSummaryReport(
      'pending',
      '2026-07-01T00:00:00',
      '2026-07-08T23:59:59',
      ['c1'],
      { dueBetween: day }
    )
    expect(list.map((t) => t.id)).toEqual(['t1'])
  })
})
