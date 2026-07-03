import { describe, expect, it } from 'vitest'
import { coerceTaskPriority } from './task-priority'

describe('task-priority', () => {
  it('coerces string priority from IPC payload', () => {
    expect(coerceTaskPriority('1')).toBe(1)
    expect(coerceTaskPriority('3')).toBe(3)
    expect(coerceTaskPriority(2)).toBe(2)
    expect(coerceTaskPriority('9')).toBe(4)
  })
})
