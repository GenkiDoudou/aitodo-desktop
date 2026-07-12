import { describe, expect, it } from 'vitest'
import { DEFAULT_CLOSE_BEHAVIOR, mergeCloseBehavior } from './close-behavior'

describe('close-behavior', () => {
  it('mergeCloseBehavior accepts known behaviors', () => {
    expect(mergeCloseBehavior('ask')).toBe('ask')
    expect(mergeCloseBehavior('tray')).toBe('tray')
    expect(mergeCloseBehavior('quit')).toBe('quit')
  })

  it('mergeCloseBehavior falls back to ask for invalid or empty values', () => {
    expect(mergeCloseBehavior('invalid')).toBe(DEFAULT_CLOSE_BEHAVIOR)
    expect(mergeCloseBehavior(null)).toBe(DEFAULT_CLOSE_BEHAVIOR)
  })
})
