import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import dayjs from 'dayjs'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { AppMessageRepository } from '../db/app-message-repository'
import { AppMessageService } from './app-message-service'
import { SummarySchedulerService } from './summary-scheduler-service'
import type { ScheduledSummaryService } from './scheduled-summary-service'
import type { ScheduledSummary } from '@shared/scheduled-summary'
import { shouldSendSummaryNow } from '@shared/scheduled-summary'
import { DEFAULT_REPORT_CONFIG } from '@shared/summary-report-config'

function sampleSummary(overrides: Partial<ScheduledSummary> = {}): ScheduledSummary {
  const ts = '2026-07-01T00:00:00'
  return {
    id: 'sum-1',
    name: '日报',
    categoryIds: [],
    scheduleType: 'daily',
    sendTime: '09:00',
    sendWeekday: null,
    sendDay: null,
    useLlm: false,
    promptText: null,
    reportConfig: DEFAULT_REPORT_CONFIG,
    enabled: true,
    lastSentAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...overrides
  }
}

describe('SummarySchedulerService runNow vs auto', () => {
  let db: BetterSqlite3.Database
  let summaryRepo: ScheduledSummaryRepository
  let messageService: AppMessageService
  let scheduler: SummarySchedulerService
  let buildSummaryBody: ReturnType<typeof vi.fn>

  beforeEach(() => {
    closeDatabase()
    db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    summaryRepo = new ScheduledSummaryRepository(db)
    messageService = new AppMessageService(new AppMessageRepository(db))
    buildSummaryBody = vi.fn(async () => '汇总正文')
    const summaryService = {
      buildSummaryBody,
      markSent: (id: string, sentAt: string) => summaryRepo.markSent(id, sentAt)
    } as unknown as ScheduledSummaryService
    scheduler = new SummarySchedulerService(summaryRepo, summaryService, messageService)
    summaryRepo.insert(sampleSummary())
  })

  afterEach(() => {
    closeDatabase()
  })

  it('runNow twice creates two messages and does not set lastSentAt', async () => {
    await scheduler.runNow('sum-1')
    await scheduler.runNow('sum-1')
    const msgs = messageService.list('notification', 'scheduled_summary')
    expect(msgs).toHaveLength(2)
    expect(summaryRepo.findById('sum-1')!.lastSentAt).toBeNull()
    expect(
      shouldSendSummaryNow(summaryRepo.findById('sum-1')!, dayjs('2026-07-07T09:05:00'))
    ).toBe(true)
  })

  it('tick still marks lastSentAt so same-day auto does not repeat', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T09:05:00'))
    try {
      await (scheduler as unknown as { tick: () => Promise<void> }).tick()
      const after = summaryRepo.findById('sum-1')!
      expect(after.lastSentAt).toBeTruthy()
      expect(messageService.list('notification', 'scheduled_summary')).toHaveLength(1)
      expect(shouldSendSummaryNow(after, dayjs('2026-07-07T10:00:00'))).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
