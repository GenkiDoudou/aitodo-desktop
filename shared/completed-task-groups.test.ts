import { describe, expect, it } from 'vitest'
import {
  formatCompletedGroupLabel,
  groupCompletedTasksByDate,
  resolveTaskCompletedAt
} from './completed-task-groups'
import type { Task } from './types'

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    description: null,
    status: 'DONE',
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
    kanbanGroupId: null,
    ...partial
  }
}

describe('completed-task-groups', () => {
  it('groups by completedAt date descending', () => {
    const groups = groupCompletedTasksByDate([
      task({ id: '1', title: 'a', completedAt: '2026-04-10T10:00:00' }),
      task({ id: '2', title: 'b', completedAt: '2026-04-12T09:00:00' }),
      task({ id: '3', title: 'todo', status: 'TODO' })
    ])
    expect(groups.map((g) => g.key)).toEqual(['2026-04-12', '2026-04-10'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['2'])
  })

  it('filters by category when provided', () => {
    const groups = groupCompletedTasksByDate(
      [
        task({ id: '1', title: 'a', categoryId: 'c1', completedAt: '2026-04-10T10:00:00' }),
        task({ id: '2', title: 'b', categoryId: null, completedAt: '2026-04-10T11:00:00' })
      ],
      'c1'
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].tasks).toHaveLength(1)
    expect(groups[0].tasks[0].id).toBe('1')
  })

  it('falls back to updatedAt when completedAt missing', () => {
    const t = task({ id: '1', title: 'a', completedAt: null, updatedAt: '2026-03-01T08:00:00' })
    expect(resolveTaskCompletedAt(t)).toBe('2026-03-01T08:00:00')
  })

  it('formats today label with weekday', () => {
    const today = new Date().toISOString().slice(0, 10)
    const label = formatCompletedGroupLabel(today)
    expect(label.startsWith('今天 ')).toBe(true)
  })
})
