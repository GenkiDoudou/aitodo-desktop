import { describe, expect, it } from 'vitest'
import { shouldOfferCompleteParent } from './offer-complete-parent'
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
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    deletedAt: null,
    syncVersion: 0,
    kanbanGroupId: null,
    triagedAt: null,
    ...partial
  }
}

describe('shouldOfferCompleteParent', () => {
  const parent = task({ id: 'p', title: '父任务' })

  it('returns true when every alive child is DONE and parent is open', () => {
    const children = [
      task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' }),
      task({ id: 'c2', title: '子2', parentId: 'p', status: 'DONE' })
    ]
    expect(shouldOfferCompleteParent({ parent, children })).toBe(true)
  })

  it('returns true when parent is IN_PROGRESS and all children are DONE', () => {
    const inProgress = task({ id: 'p', title: '父任务', status: 'IN_PROGRESS' })
    const children = [task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' })]
    expect(shouldOfferCompleteParent({ parent: inProgress, children })).toBe(true)
  })

  it('returns false when any alive child is not DONE', () => {
    const children = [
      task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' }),
      task({ id: 'c2', title: '子2', parentId: 'p', status: 'TODO' })
    ]
    expect(shouldOfferCompleteParent({ parent, children })).toBe(false)
  })

  it('returns false when parent is already DONE', () => {
    const doneParent = task({ id: 'p', title: '父任务', status: 'DONE' })
    const children = [task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' })]
    expect(shouldOfferCompleteParent({ parent: doneParent, children })).toBe(false)
  })

  it('returns false when parent is missing or deleted', () => {
    const children = [task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' })]
    expect(shouldOfferCompleteParent({ parent: null, children })).toBe(false)
    expect(
      shouldOfferCompleteParent({
        parent: task({ id: 'p', title: '父', deletedAt: '2026-01-02T00:00:00' }),
        children
      })
    ).toBe(false)
  })

  it('returns false when there are no alive children', () => {
    expect(shouldOfferCompleteParent({ parent, children: [] })).toBe(false)
    expect(
      shouldOfferCompleteParent({
        parent,
        children: [task({ id: 'c1', title: '已删', parentId: 'p', status: 'DONE', deletedAt: '2026-01-02T00:00:00' })]
      })
    ).toBe(false)
  })

  it('ignores tasks that are not direct children of the parent', () => {
    const children = [
      task({ id: 'c1', title: '子1', parentId: 'p', status: 'DONE' }),
      task({ id: 'other', title: '别人的', parentId: 'x', status: 'TODO' })
    ]
    expect(shouldOfferCompleteParent({ parent, children })).toBe(true)
  })
})
