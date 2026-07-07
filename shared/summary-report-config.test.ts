import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  applySummaryReportTemplate,
  buildReportSummaryText,
  describeReportConfig,
  normalizeReportConfig,
  resolveSectionTimeBounds
} from './summary-report-config'
import type { Task } from './types'

describe('summary-report-config', () => {
  it('applies weekly overview template with three sections', () => {
    const config = applySummaryReportTemplate('weekly_overview')
    expect(config.sections).toHaveLength(3)
    expect(config.sections.map((s) => s.taskFilter)).toEqual(['completed', 'pending', 'overdue'])
  })

  it('describeReportConfig lists enabled sections', () => {
    const config = applySummaryReportTemplate('weekly_completed')
    expect(describeReportConfig(config)).toContain('本周已完成')
  })

  it('resolveSectionTimeBounds for this_week uses monday start', () => {
    const now = dayjs('2026-07-03T10:00:00')
    const bounds = resolveSectionTimeBounds('this_week', 'daily', now, null)
    expect(bounds.from).toBe('2026-06-29T00:00:00')
    expect(bounds.to).toBe('2026-07-03T10:00:00')
  })

  it('buildReportSummaryText renders multiple sections', () => {
    const task: Task = {
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
    const config = applySummaryReportTemplate('weekly_completed')
    const section = config.sections[0]
    const bounds = resolveSectionTimeBounds(section.timeScope, 'daily', dayjs('2026-07-07T10:00:00'), null)
    const text = buildReportSummaryText(
      [{ section, bounds, tasks: [task] }],
      new Map([['c1', '工作']])
    )
    expect(text).toContain('本周已完成')
    expect(text).toContain('写报告')
  })

  it('normalizeReportConfig falls back when invalid', () => {
    const config = normalizeReportConfig({ sections: [{ taskFilter: 'bad' }] })
    expect(config.templateId).toBe('daily_completed')
    expect(config.sections[0].taskFilter).toBe('completed')
  })
})
