import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  assertValidSummaryFreeTemplate,
  parseSummaryTemplate,
  renderSummaryFreeTemplate,
  SummaryTemplateError
} from './summary-free-template'
import { normalizeReportConfigV2 } from './summary-report-config'
import type { Task } from './types'

function sampleTask(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    description: null,
    status: 'TODO',
    priority: 4,
    categoryId: 'c1',
    parentId: null,
    dueAt: '2026-07-08T09:00:00',
    remindAt: null,
    remindFiredAt: null,
    completedAt: null,
    sortOrder: 0,
    createdAt: '2026-07-01T08:00:00',
    updatedAt: '2026-07-01T08:00:00',
    deletedAt: null,
    syncVersion: 0,
    kanbanGroupId: null,
    ...partial
  }
}

describe('summary-free-template', () => {
  it('parses section and tasks', () => {
    const ast = parseSummaryTemplate(`{{#section status="pending" due="today"}}
{{#tasks}}- {{title}}
{{/tasks}}{{/section}}`)
    expect(ast[0].type).toBe('section')
  })

  it('reports line number for unclosed section', () => {
    expect(() => parseSummaryTemplate(`line1\n{{#section status="pending"}}\nx`)).toThrow(
      SummaryTemplateError
    )
    try {
      parseSummaryTemplate(`line1\n{{#section status="pending"}}\nx`)
    } catch (e) {
      expect((e as SummaryTemplateError).message).toMatch(/未闭合/)
    }
  })

  it('rejects unknown section attribute', () => {
    expect(() =>
      assertValidSummaryFreeTemplate(`{{#section status="pending" foo="1"}}{{/section}}`)
    ).toThrow(/未知属性/)
  })

  it('renders hideEmpty and due=today query wiring', () => {
    const body = `{{#section status="pending" due="today" list="工作" title="今日" hideEmpty="true"}}
【{{sectionTitle}}】{{count}}
{{#tasks}}- {{title}}
{{/tasks}}{{/section}}`

    const text = renderSummaryFreeTemplate(body, {
      scheduleType: 'daily',
      now: dayjs('2026-07-08T12:00:00'),
      lastSentAt: null,
      categoryNames: new Map([['c1', '工作']]),
      resolveListId: ({ listName, line }) => {
        if (listName === '工作') return 'c1'
        throw new SummaryTemplateError(line, `找不到清单「${listName}」`)
      },
      fetchTasks: ({ status, dueBetween, categoryIds }) => {
        expect(status).toBe('pending')
        expect(dueBetween?.from).toBe('2026-07-08T00:00:00')
        expect(categoryIds).toEqual(['c1'])
        return [sampleTask({ id: 't1', title: '开会' })]
      }
    })
    expect(text).toContain('今日')
    expect(text).toContain('开会')
  })

  it('hides empty section when hideEmpty=true', () => {
    const text = renderSummaryFreeTemplate(
      `{{#section status="pending" hideEmpty="true" title="空"}}x{{/section}}`,
      {
        scheduleType: 'daily',
        now: dayjs(),
        lastSentAt: null,
        categoryNames: new Map(),
        resolveListId: () => undefined,
        fetchTasks: () => []
      }
    )
    expect(text).toBe('')
  })
})

describe('normalizeReportConfigV2 dual mode', () => {
  it('defaults legacy config to mode=form with freeTemplate example', () => {
    const config = normalizeReportConfigV2({
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
    })
    expect(config.mode).toBe('form')
    expect(config.freeTemplate.body.length).toBeGreaterThan(0)
    expect(config.sections[0].query.status).toBe('completed')
  })

  it('keeps empty freeTemplate body when explicitly set', () => {
    const config = normalizeReportConfigV2({
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
      freeTemplate: { body: '', syntaxVersion: 1 }
    })
    expect(config.mode).toBe('template')
    expect(config.freeTemplate.body).toBe('')
  })
})
