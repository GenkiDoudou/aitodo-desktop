import { describe, expect, it, beforeEach } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'
import { initDatabaseForTest, closeDatabase } from '../db/database'
import { ScheduledSummaryRepository } from '../db/scheduled-summary-repository'
import { TaskRepository } from '../db/task-repository'
import { CategoryRepository } from '../db/category-repository'
import { ScheduledSummaryService } from './scheduled-summary-service'

describe('ScheduledSummaryService', () => {
  let service: ScheduledSummaryService

  beforeEach(() => {
    closeDatabase()
    const db = new BetterSqlite3(':memory:')
    initDatabaseForTest(db)
    service = new ScheduledSummaryService(
      new ScheduledSummaryRepository(db),
      new TaskRepository(db),
      new CategoryRepository(db)
    )
  })

  it('creates daily summary with HH:mm send time', () => {
    const created = service.create({
      name: '每日回顾',
      scheduleType: 'daily',
      sendTime: '09:00'
    })
    expect(created.id).toBeTruthy()
    expect(created.sendTime).toBe('09:00')
    expect(service.list()).toHaveLength(1)
  })

  it('rejects empty name', () => {
    expect(() =>
      service.create({
        name: '   ',
        scheduleType: 'daily',
        sendTime: '09:00'
      })
    ).toThrow('汇总名称不能为空')
  })

  it('accepts Date-like send time from time picker', () => {
    const created = service.create({
      name: '测试',
      scheduleType: 'daily',
      sendTime: new Date('2026-07-07T14:30:00') as unknown as string
    })
    expect(created.sendTime).toBe('14:30')
  })

  it('creates summary with report config', () => {
    const created = service.create({
      name: '本周全景',
      scheduleType: 'weekly',
      sendTime: '09:00',
      sendWeekday: 1,
      reportConfig: {
        templateId: 'weekly_overview',
        sections: [
          {
            id: 's1',
            title: '本周已完成',
            taskFilter: 'completed',
            timeScope: 'this_week',
            enabled: true
          }
        ]
      } as never
    })
    expect(created.reportConfig.templateId).toBe('weekly_overview')
    expect(created.reportConfig.sections).toHaveLength(1)
    expect(created.reportConfig.sections[0].query.status).toBe('completed')
  })

  it('previewSummaryBody returns text without persisting', async () => {
    const before = service.list().length
    const text = await service.previewSummaryBody({
      name: '预览',
      scheduleType: 'daily',
      sendTime: '09:00',
      categoryIds: [],
      useLlm: false,
      reportConfig: {
        templateId: 'custom',
        sections: [
          {
            id: 's1',
            title: '已完成',
            taskFilter: 'completed',
            timeScope: 'today',
            enabled: true
          }
        ]
      } as never
    })
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
    expect(service.list()).toHaveLength(before)
  })

  it('rejects invalid free template on create', () => {
    expect(() =>
      service.create({
        name: '坏模板',
        scheduleType: 'daily',
        sendTime: '09:00',
        reportConfig: {
          mode: 'template',
          templateId: 'custom',
          sections: [
            {
              id: 's1',
              title: '已完成',
              taskFilter: 'completed',
              timeScope: 'today',
              enabled: true
            }
          ],
          freeTemplate: {
            body: '{{#section status="pending"}}\n未闭合',
            syntaxVersion: 1
          }
        } as never
      })
    ).toThrow(/未闭合|第 \d+ 行/)
  })

  it('preview free template without side effects', async () => {
    const before = service.list().length
    const text = await service.previewSummaryBody({
      name: '模板预览',
      scheduleType: 'daily',
      sendTime: '09:00',
      useLlm: false,
      reportConfig: {
        mode: 'template',
        templateId: 'custom',
        sections: [
          {
            id: 's1',
            title: '已完成',
            taskFilter: 'completed',
            timeScope: 'today',
            enabled: true
          }
        ],
        freeTemplate: {
          body: '{{#section status="completed" time="today" title="完成" hideEmpty="false"}}【{{sectionTitle}}】{{count}}{{/section}}',
          syntaxVersion: 1
        }
      } as never
    })
    expect(text).toContain('完成')
    expect(service.list()).toHaveLength(before)
  })
})
