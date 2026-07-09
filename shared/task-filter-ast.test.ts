import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  andCombine,
  createEmptyAndGroup,
  matchTask,
  normalizeFilterNode,
  validateFilterNode,
  type FilterNode
} from './task-filter-ast'
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

describe('task-filter-ast', () => {
  it('rejects empty group on validate', () => {
    expect(validateFilterNode(createEmptyAndGroup())).toBe('条件组不能为空')
  })

  it('validates category in requires values', () => {
    const node: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'category', op: 'in', value: [] }]
    }
    expect(validateFilterNode(node)).toBe('请选择至少一个清单')
  })

  it('matches nested AND/OR/NOT', () => {
    const t = task({ id: '1', priority: 1, status: 'TODO', categoryId: 'c1' })
    const tree: FilterNode = {
      type: 'group',
      op: 'and',
      children: [
        { type: 'cond', field: 'priority', op: 'eq', value: 1 },
        {
          type: 'group',
          op: 'or',
          not: true,
          children: [
            { type: 'cond', field: 'status', op: 'eq', value: 'DONE' },
            { type: 'cond', field: 'category', op: 'eq', value: 'missing' }
          ]
        }
      ]
    }
    // NOT (DONE or missing cat) → true because neither matches
    expect(matchTask(t, tree)).toBe(true)
  })

  it('missing category id does not match in list', () => {
    const t = task({ id: '1', categoryId: 'c1' })
    const tree: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'category', op: 'in', value: ['deleted-id'] }]
    }
    expect(matchTask(t, tree)).toBe(false)
  })

  it('andCombine merges trees', () => {
    const a: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'priority', op: 'eq', value: 1 }]
    }
    const b: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'status', op: 'eq', value: 'TODO' }]
    }
    const merged = andCombine(a, b)
    expect(normalizeFilterNode(merged).type).toBe('group')
    const hit = task({ id: '1', priority: 1, status: 'TODO' })
    const miss = task({ id: '2', priority: 1, status: 'DONE' })
    expect(matchTask(hit, merged)).toBe(true)
    expect(matchTask(miss, merged)).toBe(false)
  })

  it('evaluates dueAt relative presets on calendar instance date', () => {
    const series = task({
      id: 'daily',
      dueAt: '2026-09-01T09:00:00',
      recurrence: { type: 'daily' }
    })
    const tree: FilterNode = {
      type: 'group',
      op: 'and',
      children: [{ type: 'cond', field: 'dueAt', op: 'rel', value: 'today' }]
    }
    const now = dayjs('2026-09-07T12:00:00')
    // 母任务锚点不是今天 → false
    expect(matchTask(series, tree, { now })).toBe(false)
    // 实例落在今天 → true
    expect(matchTask(series, tree, { now, instanceDateKey: '2026-09-07' })).toBe(true)
  })
})
