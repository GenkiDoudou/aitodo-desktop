import { describe, expect, it } from 'vitest'
import { inQuietHours, quietEnd } from './notify-quiet-hours'

describe('notify-quiet-hours', () => {
  const quiet = { enabled: true, start: '23:00', end: '08:00' }

  it('detects overnight quiet window', () => {
    expect(inQuietHours(new Date(2026, 6, 28, 23, 30), quiet)).toBe(true)
    expect(inQuietHours(new Date(2026, 6, 29, 7, 59), quiet)).toBe(true)
    expect(inQuietHours(new Date(2026, 6, 28, 22, 59), quiet)).toBe(false)
    expect(inQuietHours(new Date(2026, 6, 29, 8, 0), quiet)).toBe(false)
  })

  it('detects same-day quiet window', () => {
    const day = { enabled: true, start: '12:00', end: '14:00' }
    expect(inQuietHours(new Date(2026, 6, 28, 12, 0), day)).toBe(true)
    expect(inQuietHours(new Date(2026, 6, 28, 13, 59), day)).toBe(true)
    expect(inQuietHours(new Date(2026, 6, 28, 14, 0), day)).toBe(false)
  })

  it('quietEnd returns next morning for overnight window', () => {
    const end = quietEnd(new Date(2026, 6, 28, 23, 30), quiet)
    expect(end).not.toBeNull()
    expect(end!.getFullYear()).toBe(2026)
    expect(end!.getMonth()).toBe(6)
    expect(end!.getDate()).toBe(29)
    expect(end!.getHours()).toBe(8)
    expect(end!.getMinutes()).toBe(0)
  })

  it('disabled quiet never matches', () => {
    expect(inQuietHours(new Date(2026, 6, 28, 23, 30), { ...quiet, enabled: false })).toBe(false)
    expect(quietEnd(new Date(2026, 6, 28, 23, 30), { ...quiet, enabled: false })).toBeNull()
  })
})
