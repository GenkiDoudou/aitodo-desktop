import { describe, expect, it } from 'vitest'
import { layoutSummaryTaskTree } from './summary-task-tree'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: null,
    parentId: null,
    startAt: null,
    dueAt: null,
    remindAt: null,
    remindFiredAt: null,
    completedAt: null,
    sortOrder: 0,
    createdAt: '2026-07-01T00:00:00',
    updatedAt: '2026-07-01T00:00:00',
    deletedAt: null,
    syncVersion: 0,
    kanbanGroupId: null,
    triagedAt: null,
    ...partial
  }
}

describe('layoutSummaryTaskTree', () => {
  it('shows incomplete parent as anchor above completed child', () => {
    const parent = task({ id: 'p', title: '父', status: 'TODO' })
    const child = task({
      id: 'c',
      title: '子',
      status: 'DONE',
      parentId: 'p',
      completedAt: '2026-07-07T08:00:00'
    })
    const { rows, matchedCount } = layoutSummaryTaskTree([child], {
      resolveById: (id) => (id === 'p' ? parent : null)
    })
    expect(matchedCount).toBe(1)
    expect(rows.map((r) => ({ id: r.task.id, depth: r.depth, matched: r.matched }))).toEqual([
      { id: 'p', depth: 0, matched: false },
      { id: 'c', depth: 1, matched: true }
    ])
  })

  it('marks both parent and child matched when both in set', () => {
    const parent = task({ id: 'p', title: '父', status: 'DONE', completedAt: '2026-07-07T07:00:00' })
    const child = task({
      id: 'c',
      title: '子',
      status: 'DONE',
      parentId: 'p',
      completedAt: '2026-07-07T08:00:00'
    })
    const { rows } = layoutSummaryTaskTree([parent, child], {
      resolveById: () => null
    })
    expect(rows).toEqual([
      expect.objectContaining({ task: parent, depth: 0, matched: true }),
      expect.objectContaining({ task: child, depth: 1, matched: true })
    ])
  })

  it('fills multi-level missing ancestors', () => {
    const root = task({ id: 'r', title: '根' })
    const mid = task({ id: 'm', title: '中', parentId: 'r' })
    const leaf = task({ id: 'l', title: '叶', parentId: 'm', status: 'DONE' })
    const byId = new Map([
      [root.id, root],
      [mid.id, mid]
    ])
    const { rows } = layoutSummaryTaskTree([leaf], {
      resolveById: (id) => byId.get(id) ?? null
    })
    expect(rows.map((r) => r.task.id)).toEqual(['r', 'm', 'l'])
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2])
    expect(rows.map((r) => r.matched)).toEqual([false, false, true])
  })

  it('applies limit before enriching ancestors', () => {
    const parent = task({ id: 'p', title: '父' })
    const c1 = task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' })
    const c2 = task({ id: 'c2', title: '子2', parentId: 'p', status: 'DONE' })
    const { rows, matchedCount } = layoutSummaryTaskTree([c1, c2], {
      limit: 1,
      resolveById: (id) => (id === 'p' ? parent : null)
    })
    expect(matchedCount).toBe(1)
    expect(rows.map((r) => r.task.id)).toEqual(['p', 'c1'])
    expect(rows.some((r) => r.task.id === 'c2')).toBe(false)
  })

  it('keeps flat order for root-only tasks', () => {
    const a = task({ id: 'a', title: 'A' })
    const b = task({ id: 'b', title: 'B' })
    const { rows } = layoutSummaryTaskTree([a, b], { resolveById: () => null })
    expect(rows.map((r) => ({ id: r.task.id, depth: r.depth, matched: r.matched }))).toEqual([
      { id: 'a', depth: 0, matched: true },
      { id: 'b', depth: 0, matched: true }
    ])
  })

  it('treats missing parent as orphan root', () => {
    const child = task({ id: 'c', title: '子', parentId: 'gone' })
    const { rows } = layoutSummaryTaskTree([child], { resolveById: () => null })
    expect(rows).toEqual([{ task: child, depth: 0, matched: true }])
  })
})
