import { describe, expect, it } from 'vitest'
import { isMatrixListFilter } from './task-list-filter'

describe('task-list-filter', () => {
  it('detects matrix list filter', () => {
    expect(isMatrixListFilter({ hideDone: true })).toBe(true)
    expect(isMatrixListFilter({ hideDone: true, parentId: null })).toBe(false)
    expect(isMatrixListFilter({ hideDone: true, smartList: 'all' })).toBe(false)
    expect(isMatrixListFilter({ hideDone: true, categoryId: null })).toBe(false)
  })
})
