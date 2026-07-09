import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { TaskViewRepository } from '../db/task-view-repository'
import { TaskRepository } from '../db/task-repository'
import { TaskViewService } from './task-view-service'
import type { FilterNode } from '@shared/task-filter-ast'

const validRule: FilterNode = {
  type: 'group',
  op: 'and',
  children: [{ type: 'cond', field: 'priority', op: 'eq', value: 1 }]
}

describe('TaskViewService', () => {
  let service: TaskViewService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new TaskViewService(new TaskViewRepository(db), new TaskRepository(db))
  })

  it('creates and lists views', () => {
    const v = service.create({
      name: '我的看板',
      layout: 'kanban',
      kanbanBoardMode: 'status',
      filterRule: validRule
    })
    expect(v.name).toBe('我的看板')
    expect(service.list().length).toBeGreaterThanOrEqual(1)
  })

  it('rejects invalid AST', () => {
    expect(() =>
      service.create({
        name: '坏',
        layout: 'list',
        filterRule: { type: 'group', op: 'and', children: [] }
      })
    ).toThrow('条件组不能为空')
  })

  it('createFromPreset avoids duplicate names', () => {
    const preset = { name: 'Kanban', layout: 'kanban' as const, kanbanBoardMode: 'status' as const }
    const first = service.createFromPreset(preset)
    const second = service.createFromPreset(preset)
    expect(first?.name).toBe('Kanban')
    expect(second?.name).toBe('Kanban (2)')
  })

  it('deletes view', () => {
    const v = service.create({ name: '临时', layout: 'list' })
    const before = service.list().length
    service.delete(v.id)
    expect(service.list().length).toBe(before - 1)
  })
})
