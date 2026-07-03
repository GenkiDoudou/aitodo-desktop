import { describe, expect, it } from 'vitest'
import { groupTasksInQuadrant, layoutTasksInQuadrant, splitTasksByPriority } from './quadrant-tasks'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
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
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    deletedAt: null,
    syncVersion: 0,
    ...partial
  }
}

describe('quadrant-tasks', () => {
  it('splits top-level tasks by priority', () => {
    const buckets = splitTasksByPriority([
      task({ id: '1', title: 'a', priority: 1 }),
      task({ id: '2', title: 'b', priority: 2, parentId: 'x' }),
      task({ id: '3', title: 'c', priority: 3 })
    ])
    expect(buckets[1]).toHaveLength(1)
    expect(buckets[2]).toHaveLength(0)
    expect(buckets[3]).toHaveLength(1)
  })

  it('groups overdue and puts undated tasks in ungrouped', () => {
    const layout = layoutTasksInQuadrant(
      [
        task({ id: '1', title: 'done', status: 'DONE' }),
        task({ id: '2', title: 'late', dueAt: '2020-01-01T10:00:00' }),
        task({ id: '3', title: 'nodate' })
      ],
      true
    )
    expect(layout.ungrouped.map((t) => t.id)).toEqual(['3'])
    expect(layout.groups.map((g) => g.key)).toEqual(['overdue', 'completed'])
  })
})
