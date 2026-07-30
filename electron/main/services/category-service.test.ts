import { describe, it, expect, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { CategoryRepository } from '../db/category-repository'
import { CategoryService } from './category-service'
import { AppError } from '@shared/types'

describe('CategoryService', () => {
  let service: CategoryService
  let repo: CategoryRepository

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    repo = new CategoryRepository(db)
    service = new CategoryService(repo)
  })

  it('create assigns maxSortOrder + 1', () => {
    const a = service.create({ name: 'A' })
    const b = service.create({ name: 'B' })
    expect(a.sortOrder).toBe(0)
    expect(b.sortOrder).toBe(1)
  })

  it('reorder permutes sortOrder', () => {
    const a = service.create({ name: 'A' })
    const b = service.create({ name: 'B' })
    const c = service.create({ name: 'C' })
    const list = service.reorder([c.id, a.id, b.id])
    expect(list.map((x) => x.id)).toEqual([c.id, a.id, b.id])
    expect(list.map((x) => x.sortOrder)).toEqual([0, 1, 2])
  })

  it('reorder empty is no-op', () => {
    const a = service.create({ name: 'A' })
    const before = service.list()
    const after = service.reorder([])
    expect(after).toEqual(before)
    expect(repo.findById(a.id)?.sortOrder).toBe(a.sortOrder)
  })

  it('reorder skips unknown ids', () => {
    const a = service.create({ name: 'A' })
    const b = service.create({ name: 'B' })
    const list = service.reorder(['missing', b.id, a.id, 'gone'])
    expect(list.map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('reorder all-invalid throws', () => {
    service.create({ name: 'A' })
    expect(() => service.reorder(['x', 'y'])).toThrowError(AppError)
  })
})
