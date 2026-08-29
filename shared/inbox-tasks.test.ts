import { describe, expect, it } from 'vitest'
import { countUntriagedInboxTasks, inboxBadgeCount, isUntriagedInboxTask } from './inbox-tasks'
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

describe('inbox-tasks', () => {
  it('isUntriagedInboxTask matches triaged_at null open roots', () => {
    expect(isUntriagedInboxTask(task({ id: '1', title: 'a' }))).toBe(true)
    expect(isUntriagedInboxTask(task({ id: '2', title: 'b', triagedAt: '2026-01-02T00:00:00' }))).toBe(false)
    expect(isUntriagedInboxTask(task({ id: '3', title: 'c', status: 'DONE' }))).toBe(false)
    expect(isUntriagedInboxTask(task({ id: '4', title: 'd', parentId: 'p' }))).toBe(false)
  })

  it('inboxBadgeCount sums notes and untriaged tasks', () => {
    const tasks = [
      task({ id: '1', title: 'a' }),
      task({ id: '2', title: 'b', triagedAt: '2026-01-02T00:00:00' })
    ]
    expect(countUntriagedInboxTasks(tasks)).toBe(1)
    expect(
      inboxBadgeCount(
        [
          {
            id: 'n1',
            content: 'x',
            color: 'yellow',
            pinned: false,
            createdAt: '',
            updatedAt: ''
          }
        ],
        tasks
      )
    ).toBe(2)
  })
})
