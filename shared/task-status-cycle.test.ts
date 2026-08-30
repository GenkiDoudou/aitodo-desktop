import { describe, expect, it } from 'vitest'
import { nextTaskStatus, taskStatusLabel } from './task-status-cycle'

describe('taskStatusCycle', () => {
  it('三态循环：待办 → 进行中 → 已完成 → 待办', () => {
    expect(nextTaskStatus('TODO')).toBe('IN_PROGRESS')
    expect(nextTaskStatus('IN_PROGRESS')).toBe('DONE')
    expect(nextTaskStatus('DONE')).toBe('TODO')
  })

  it('taskStatusLabel', () => {
    expect(taskStatusLabel('TODO')).toBe('待办')
    expect(taskStatusLabel('IN_PROGRESS')).toBe('进行中')
    expect(taskStatusLabel('DONE')).toBe('已完成')
  })
})
