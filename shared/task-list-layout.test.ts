import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { buildTaskListLayout, compareTasks, timeGroupKey } from './task-list-layout'
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

describe('task-list-layout', () => {
  const base = dayjs('2026-07-03T12:00:00')

  it('groups by priority with headers', () => {
    const items = buildTaskListLayout(
      [
        task({ id: '1', title: '低', priority: 4 }),
        task({ id: '2', title: '高', priority: 1 })
      ],
      'priority',
      'title'
    )
    expect(items.filter((i) => i.type === 'group').map((g) => g.label)).toContain('重要且紧急')
    const titles = items.filter((i) => i.type === 'task').map((i) => i.task.title)
    expect(titles).toEqual(['高', '低'])
  })

  it('sorts by title within flat list', () => {
    const items = buildTaskListLayout(
      [task({ id: '1', title: 'B' }), task({ id: '2', title: 'A' })],
      'none',
      'title'
    )
    expect(items.map((i) => (i.type === 'task' ? i.task.title : '')).filter(Boolean)).toEqual(['A', 'B'])
  })

  it('keeps children under parent when grouping', () => {
    const items = buildTaskListLayout(
      [
        task({ id: 'p', title: '父', priority: 2 }),
        task({ id: 'c', title: '子', parentId: 'p', priority: 4 })
      ],
      'priority',
      'title'
    )
    const rows = items.filter((i) => i.type === 'task')
    expect(rows).toHaveLength(2)
    expect(rows[1].depth).toBe(1)
  })

  it('timeGroupKey marks overdue', () => {
    const g = timeGroupKey(
      task({ id: '1', dueAt: '2026-07-01T10:00:00', status: 'TODO' }),
      base
    )
    expect(g.label).toBe('已过期')
  })

  it('compareTasks custom uses sortOrder', () => {
    expect(
      compareTasks(task({ id: '1', sortOrder: 2 }), task({ id: '2', sortOrder: 1 }), 'custom')
    ).toBeGreaterThan(0)
  })

  it('compareTasks createdAt sorts newest first', () => {
    expect(
      compareTasks(
        task({ id: '1', createdAt: '2026-07-02T10:00:00' }),
        task({ id: '2', createdAt: '2026-07-03T10:00:00' }),
        'createdAt'
      )
    ).toBeGreaterThan(0)
  })
})
