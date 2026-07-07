import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  buildCompletedTasksSummaryText,
  normalizeSendTime,
  shouldSendSummaryNow,
  summaryPeriodBounds,
  toPlainScheduledSummaryDto
} from './scheduled-summary'
import type { Task } from './types'

describe('scheduled-summary', () => {
  it('shouldSendSummaryNow for daily at configured time', () => {
    const now = dayjs('2026-07-07T09:05:00')
    expect(
      shouldSendSummaryNow(
        {
          scheduleType: 'daily',
          sendTime: '09:00',
          sendWeekday: null,
          sendDay: null,
          lastSentAt: null,
          enabled: true
        },
        now
      )
    ).toBe(true)
  })

  it('should not resend daily on same day', () => {
    const now = dayjs('2026-07-07T10:00:00')
    expect(
      shouldSendSummaryNow(
        {
          scheduleType: 'daily',
          sendTime: '09:00',
          sendWeekday: null,
          sendDay: null,
          lastSentAt: '2026-07-07T09:01:00',
          enabled: true
        },
        now
      )
    ).toBe(false)
  })

  it('builds summary text grouped by category', () => {
    const tasks: Task[] = [
      {
        id: '1',
        title: '写报告',
        description: null,
        status: 'DONE',
        priority: 4,
        categoryId: 'c1',
        parentId: null,
        dueAt: null,
        remindAt: null,
        remindFiredAt: null,
        completedAt: '2026-07-07T08:00:00',
        sortOrder: 0,
        createdAt: '2026-07-06T08:00:00',
        updatedAt: '2026-07-07T08:00:00',
        deletedAt: null,
        syncVersion: 0,
        kanbanGroupId: null
      }
    ]
    const text = buildCompletedTasksSummaryText(tasks, new Map([['c1', '工作']]))
    expect(text).toContain('【工作】')
    expect(text).toContain('写报告')
  })

  it('summaryPeriodBounds uses lastSentAt when present', () => {
    const now = dayjs('2026-07-07T09:00:00')
    const bounds = summaryPeriodBounds('daily', now, '2026-07-06T09:00:00')
    expect(bounds.from).toBe('2026-07-06T09:00:00')
    expect(bounds.to).toBe('2026-07-07T09:00:00')
  })

  it('normalizeSendTime accepts HH:mm and Date', () => {
    expect(normalizeSendTime('9:05')).toBe('09:05')
    expect(normalizeSendTime(new Date('2026-07-07T18:30:00'))).toBe('18:30')
    expect(normalizeSendTime('2026-07-07T09:15:00')).toBe('09:15')
  })

  it('toPlainScheduledSummaryDto strips reactive-like wrappers', () => {
    const reactiveLike = {
      name: '每日',
      categoryIds: ['c1'],
      scheduleType: 'daily',
      sendTime: '09:00'
    }
    const plain = toPlainScheduledSummaryDto(reactiveLike)
    expect(plain).toEqual(reactiveLike)
    expect(plain).not.toBe(reactiveLike)
  })
})
