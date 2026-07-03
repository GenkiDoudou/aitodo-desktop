import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { KANBAN_UNGROUPED_ID } from '@shared/kanban-scope'
import { KanbanGroupRepository } from '../db/kanban-group-repository'
import { KanbanGroupService } from './kanban-group-service'

describe('KanbanGroupService', () => {
  let service: KanbanGroupService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new KanbanGroupService(new KanbanGroupRepository(db))
  })

  it('creates and lists groups by scope', () => {
    const g = service.create({ scopeKey: 'scope:cat:a', name: '222' })
    const board = service.listBoard('scope:cat:a')
    expect(board.groups).toHaveLength(1)
    expect(board.groups[0].id).toBe(g.id)
    expect(board.groups[0].name).toBe('222')
    expect(board.ungroupedName).toBe('未分组')
  })

  it('renames ungrouped column per scope', () => {
    service.update(KANBAN_UNGROUPED_ID, { scopeKey: 'scope:test', name: '收件箱' })
    const board = service.listBoard('scope:test')
    expect(board.ungroupedName).toBe('收件箱')
    expect(board.groups).toHaveLength(0)
  })

  it('inserts group before reference', () => {
    const first = service.create({ scopeKey: 'scope:test', name: 'A' })
    service.create({
      scopeKey: 'scope:test',
      name: 'B',
      position: 'before',
      refGroupId: first.id
    })
    const names = service.listBoard('scope:test').groups.map((g) => g.name)
    expect(names).toEqual(['B', 'A'])
  })
})
