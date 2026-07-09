import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  applySummaryReportTemplate,
  buildReportSummaryText,
  createReportSectionV2,
  describeReportConfig,
  localDayBounds,
  normalizeReportConfig,
  normalizeReportConfigV2,
  resolveSectionTimeBounds
} from './summary-report-config'
import type { Task } from './types'

describe('summary-report-config', () => {
  it('applies weekly overview template with three sections', () => {
    const config = applySummaryReportTemplate('weekly_overview')
    expect(config.sections).toHaveLength(3)
    expect(config.sections.map((s) => s.query.status)).toEqual(['completed', 'pending', 'overdue'])
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
    const bounds = resolveSectionTimeBounds(section.time.preset, 'daily', dayjs('2026-07-07T10:00:00'), null)
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
    expect(config.sections[0].query.status).toBe('completed')
  })

  it('normalizeReportConfigV2 maps legacy V1 sections', () => {
    const config = normalizeReportConfigV2({
      templateId: 'custom',
      sections: [
        {
          id: 's1',
          title: '旧区块',
          taskFilter: 'pending',
          timeScope: 'today',
          enabled: true
        }
      ]
    })
    expect(config.sections[0].query.status).toBe('pending')
    expect(config.sections[0].time.preset).toBe('today')
    expect(config.sections[0].group.by).toBe('category')
    expect(config.sections[0].render.style).toBe('bullets')
  })

  it('normalizeReportConfigV2 keeps V2 due_today_only and list scope', () => {
    const config = normalizeReportConfigV2({
      templateId: 'custom',
      sections: [
        createReportSectionV2({
          title: '今日到期',
          taskFilter: 'pending',
          timeScope: 'today',
          query: {
            status: 'pending',
            listScope: { mode: 'only_list', listId: 'list-1' },
            dueScope: 'due_today_only'
          }
        })
      ]
    })
    expect(config.sections[0].query.dueScope).toBe('due_today_only')
    expect(config.sections[0].query.listScope).toEqual({ mode: 'only_list', listId: 'list-1' })
  })

  it('hideEmptySection omits empty blocks from report', () => {
    const section = createReportSectionV2({
      title: '空区',
      taskFilter: 'pending',
      timeScope: 'today',
      render: {
        style: 'bullets',
        showCount: true,
        showDueAt: true,
        showCompletedAt: false,
        limit: null,
        hideEmptySection: true
      }
    })
    const text = buildReportSummaryText(
      [
        {
          section,
          bounds: { from: 'a', to: 'b', label: '今天' },
          tasks: []
        }
      ],
      new Map()
    )
    expect(text).toBe('本周期暂无相关任务。')
  })

  it('localDayBounds covers full local day', () => {
    const bounds = localDayBounds(dayjs('2026-07-08T15:30:00'))
    expect(bounds.from).toBe('2026-07-08T00:00:00')
    expect(bounds.to).toBe('2026-07-08T23:59:59')
  })
})
