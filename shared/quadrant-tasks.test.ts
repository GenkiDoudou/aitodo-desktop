import { describe, expect, it } from 'vitest'
import { splitTasksByPriority } from './quadrant-tasks'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: 't',
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
    ...partial
  }
}

describe('splitTasksByPriority', () => {
  it('includes orphan subtasks when parent is absent', () => {
    const buckets = splitTasksByPriority([
      task({ id: 'child', parentId: 'missing', priority: 2, title: '子任务' })
    ])
    expect(buckets[2]).toHaveLength(1)
    expect(buckets[2][0].title).toBe('子任务')
  })

  it('skips child when parent is in the same list', () => {
    const buckets = splitTasksByPriority([
      task({ id: 'parent', priority: 1 }),
      task({ id: 'child', parentId: 'parent', priority: 3 })
    ])
    expect(buckets[1]).toHaveLength(1)
    expect(buckets[3]).toHaveLength(0)
  })
})
