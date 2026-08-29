import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from '../db/migrations'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { nowIso } from '@shared/datetime'
import { normalizeReportConfig } from '@shared/summary-report-config'

describe('ScheduledSummaryRepository', () => {
  let repo: ScheduledSummaryRepository

  beforeEach(() => {
    const db = new BetterSqlite3(':memory:')
    runMigrations(db)
    repo = new ScheduledSummaryRepository(db)
  })

  it('inserts and lists summary row', () => {
    const ts = nowIso()
    repo.insert({
      id: 'sum-1',
      name: '每日回顾',
      categoryIds: ['c1'],
      scheduleType: 'daily',
      sendTime: '09:00',
      sendWeekday: null,
      sendDay: null,
      useLlm: false,
      promptText: null,
      reportConfig: normalizeReportConfig(null),
      enabled: true,
      lastSentAt: null,
      createdAt: ts,
      updatedAt: ts
    })

    const list = repo.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('每日回顾')
    expect(list[0].categoryIds).toEqual(['c1'])
  })
})
