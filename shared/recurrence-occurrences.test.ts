import { describe, expect, it } from 'vitest'
import {
  isOccurrenceDateCompleted,
  normalizeCompletedOccurrenceDates,
  parseCompletedOccurrenceDates,
  serializeCompletedOccurrenceDates,
  toggleCompletedOccurrenceDate
} from './recurrence-occurrences'

describe('recurrence-occurrences', () => {
  it('normalizes and dedupes dates', () => {
    expect(normalizeCompletedOccurrenceDates(['2026-09-07', 'bad', '2026-09-07', '2026-09-06'])).toEqual([
      '2026-09-06',
      '2026-09-07'
    ])
  })

  it('parses and serializes json', () => {
    expect(parseCompletedOccurrenceDates('["2026-09-06"]')).toEqual(['2026-09-06'])
    expect(serializeCompletedOccurrenceDates(['2026-09-06'])).toBe('["2026-09-06"]')
    expect(serializeCompletedOccurrenceDates([])).toBeNull()
  })

  it('toggles a single day', () => {
    const added = toggleCompletedOccurrenceDate([], '2026-09-06', true)
    expect(added).toEqual(['2026-09-06'])
    expect(isOccurrenceDateCompleted(added, '2026-09-06')).toBe(true)
    expect(toggleCompletedOccurrenceDate(added, '2026-09-06', false)).toEqual([])
  })
})
