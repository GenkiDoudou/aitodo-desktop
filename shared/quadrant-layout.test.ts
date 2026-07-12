import { describe, expect, it } from 'vitest'
import { layoutTasksInQuadrant } from './quadrant-layout'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: 't',
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: null,
    parentId: null,
    dueAt: null,
    startAt: null,
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

describe('quadrant-layout', () => {
  it('groups by tag without import errors', () => {
    const layout = layoutTasksInQuadrant(
      [task({ id: '1', tags: ['工作'] }), task({ id: '2', tags: ['生活'] })],
      {
        showCompleted: true,
        enableGrouping: true,
        groupBy: 'tag',
        sortBy: 'title'
      }
    )
    expect(layout.groups.length).toBe(2)
  })
})
