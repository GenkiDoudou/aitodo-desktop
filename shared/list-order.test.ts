import { describe, expect, it } from 'vitest'
import { moveItemInOrder } from './list-order'

describe('moveItemInOrder', () => {
  it('moves item forward', () => {
    expect(moveItemInOrder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves item backward', () => {
    expect(moveItemInOrder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('no-ops when from equals to', () => {
    expect(moveItemInOrder(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('returns copy for out-of-range indexes', () => {
    expect(moveItemInOrder(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
    expect(moveItemInOrder(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })
})
