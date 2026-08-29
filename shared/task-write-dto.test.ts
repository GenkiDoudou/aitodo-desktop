import { describe, expect, it } from 'vitest'
import { toPlainCreateTaskDto, toPlainUpdateTaskDto } from './task-write-dto'

describe('task-write-dto', () => {
  it('toPlainUpdateTaskDto strips reactive-like wrappers', () => {
    const reactiveLike = {
      title: '任务',
      recurrence: { type: 'daily' },
      reminders: [{ remindAt: '2026-07-07T09:00:00', offsetMinutes: 0 }]
    }
    const plain = toPlainUpdateTaskDto(reactiveLike)
    expect(plain).toEqual(reactiveLike)
    expect(plain).not.toBe(reactiveLike)
  })

  it('toPlainCreateTaskDto clones nested fields', () => {
    const dto = toPlainCreateTaskDto({
      title: '新建',
      recurrence: { type: 'weekly' }
    })
    expect(dto.recurrence).toEqual({ type: 'weekly' })
  })
})
