import { describe, expect, it } from 'vitest'
import {
  applyTimelineMove,
  applyTimelineResizeLeft,
  applyTimelineResizeRight,
  resolveTimelineSpan,
  spanDayCount,
  spanToTaskDatetimes
} from './timeline-span'

describe('resolveTimelineSpan', () => {
  it('returns null without createdAt or dueAt', () => {
    expect(resolveTimelineSpan({ createdAt: null, dueAt: null })).toBeNull()
  })

  it('shows single day on createdAt when no dueAt', () => {
    expect(
      resolveTimelineSpan({ createdAt: '2026-07-01T09:00:00', dueAt: null })
    ).toEqual({ startKey: '2026-07-01', endKey: '2026-07-01' })
  })

  it('spans createdAt through dueAt', () => {
    expect(
      resolveTimelineSpan({
        createdAt: '2026-07-01T09:00:00',
        dueAt: '2026-07-03T18:00:00'
      })
    ).toEqual({ startKey: '2026-07-01', endKey: '2026-07-03' })
    expect(
      spanDayCount({ startKey: '2026-07-01', endKey: '2026-07-03' })
    ).toBe(3)
  })

  it('uses due day alone when createdAt missing', () => {
    expect(resolveTimelineSpan({ dueAt: '2026-07-10T18:00:00' })).toEqual({
      startKey: '2026-07-10',
      endKey: '2026-07-10'
    })
  })

  it('clamps when createdAt is after dueAt', () => {
    expect(
      resolveTimelineSpan({
        createdAt: '2026-07-05T09:00:00',
        dueAt: '2026-07-03T18:00:00'
      })
    ).toEqual({ startKey: '2026-07-03', endKey: '2026-07-03' })
  })
})

describe('spanToTaskDatetimes', () => {
  it('keeps dueAt null for point span without due', () => {
    expect(
      spanToTaskDatetimes(
        { startKey: '2026-07-02', endKey: '2026-07-02' },
        { createdAt: '2026-07-01T10:30:00', dueAt: null }
      )
    ).toEqual({ createdAt: '2026-07-02T10:30:00', dueAt: null })
  })

  it('sets dueAt when span extends beyond point', () => {
    expect(
      spanToTaskDatetimes(
        { startKey: '2026-07-01', endKey: '2026-07-03' },
        { createdAt: '2026-06-20T10:30:00', dueAt: null }
      )
    ).toEqual({ createdAt: '2026-07-01T10:30:00', dueAt: '2026-07-03T18:00:00' })
  })

  it('updates both ends when task has dueAt', () => {
    expect(
      spanToTaskDatetimes(
        { startKey: '2026-07-02', endKey: '2026-07-04' },
        { createdAt: '2026-07-01T09:15:00', dueAt: '2026-07-03T17:45:00' }
      )
    ).toEqual({
      createdAt: '2026-07-02T09:15:00',
      dueAt: '2026-07-04T17:45:00'
    })
  })
})

describe('timeline move/resize', () => {
  const span = { startKey: '2026-07-01', endKey: '2026-07-03' }

  it('moves both ends by delta days', () => {
    expect(applyTimelineMove(span, 2)).toEqual({
      startKey: '2026-07-03',
      endKey: '2026-07-05'
    })
    expect(applyTimelineMove(span, -1)).toEqual({
      startKey: '2026-06-30',
      endKey: '2026-07-02'
    })
  })

  it('resize left keeps end and min one day', () => {
    expect(applyTimelineResizeLeft(span, '2026-07-02')).toEqual({
      startKey: '2026-07-02',
      endKey: '2026-07-03'
    })
    expect(applyTimelineResizeLeft(span, '2026-07-10')).toEqual({
      startKey: '2026-07-03',
      endKey: '2026-07-03'
    })
  })

  it('resize right keeps start and min one day', () => {
    expect(applyTimelineResizeRight(span, '2026-07-05')).toEqual({
      startKey: '2026-07-01',
      endKey: '2026-07-05'
    })
    expect(applyTimelineResizeRight(span, '2026-06-20')).toEqual({
      startKey: '2026-07-01',
      endKey: '2026-07-01'
    })
  })
})
