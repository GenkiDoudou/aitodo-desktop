import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { buildCreateTaskDtoFromParsed, buildParseTextSegments, parseAiTaskInput } from './ai-task-parser'

const categories = [
  { id: 'c-work', name: '工作' },
  { id: 'c-life', name: '生活' }
]

const fixedNow = dayjs('2026-07-03T16:00:00')

describe('parseAiTaskInput', () => {
  it('parses due, remind, category and title from a full sentence', () => {
    const draft = parseAiTaskInput(
      '明天下午3点开会，提前30分钟提醒我，归到工作分类',
      { categories, now: fixedNow }
    )
    expect(draft.title).toBe('开会')
    expect(draft.dueAt).toBe('2026-07-04T15:00:00')
    expect(draft.reminders).toHaveLength(1)
    expect(draft.reminders[0]?.offsetMinutes).toBe(30)
    expect(draft.remindAt).toBe('2026-07-04T14:30:00')
    expect(draft.category?.id).toBe('c-work')
  })

  it('uses category name embedded in text', () => {
    const draft = parseAiTaskInput('买菜 生活', { categories, now: fixedNow })
    expect(draft.category?.name).toBe('生活')
    expect(draft.title).toContain('买菜')
  })

  it('returns warning when remind offset without due', () => {
    const draft = parseAiTaskInput('写周报，提前1小时提醒我', { categories, now: fixedNow })
    expect(draft.dueAt).toBeNull()
    expect(draft.reminders).toHaveLength(0)
    expect(draft.warnings.some((w) => w.includes('截止时间'))).toBe(true)
  })

  it('handles today with half hour', () => {
    const draft = parseAiTaskInput('今天下午4点半健身', { categories, now: fixedNow })
    expect(draft.dueAt).toBe('2026-07-03T16:30:00')
    expect(draft.title).toBe('健身')
  })

  it('keeps explicit 今天 even when the clock time has already passed', () => {
    const morning = dayjs('2026-07-11T10:00:00')
    const draft = parseAiTaskInput('今天早上9点半叫我起床吃早饭', {
      categories,
      now: morning
    })
    expect(draft.dueAt).toBe('2026-07-11T09:30:00')
    expect(draft.title).toContain('起床吃早饭')
  })

  it('rolls bare clock time to next day when already past and no day word', () => {
    const morning = dayjs('2026-07-11T10:00:00')
    const draft = parseAiTaskInput('9点半开会', { categories, now: morning })
    expect(draft.dueAt).toBe('2026-07-12T09:30:00')
  })

  it('resolves bare hour to nearest valid evening when afternoon', () => {
    const draft = parseAiTaskInput('9点提醒我开会', { categories, now: fixedNow })
    expect(draft.dueAt).toBe('2026-07-03T21:00:00')
    expect(draft.reminders[0]?.remindAt).toBe('2026-07-03T21:00:00')
    expect(draft.title).toBe('开会')
  })

  it('parses weekday and slash date', () => {
    const monday = parseAiTaskInput('周一下午3点站会', { categories, now: fixedNow })
    expect(monday.dueAt).toBe('2026-07-06T15:00:00')

    const slash = parseAiTaskInput('3/6交报告', { categories, now: fixedNow })
    expect(slash.dueAt).toBe('2027-03-06T09:00:00')
    expect(slash.title).toBe('交报告')
  })

  it('parses recurrence rules', () => {
    const daily = parseAiTaskInput('每天喝水', { categories, now: fixedNow })
    expect(daily.recurrence?.type).toBe('daily')
    expect(daily.dueAt).toBe('2026-07-03T09:00:00')

    const every2Days = parseAiTaskInput('每2天跑步', { categories, now: fixedNow })
    expect(every2Days.recurrence).toEqual({ type: 'custom', interval: 2, unit: 'day' })

    const weekly = parseAiTaskInput('每周写总结', { categories, now: fixedNow })
    expect(weekly.recurrence?.type).toBe('weekly')

    const workdays = parseAiTaskInput('每个工作日打卡', { categories, now: fixedNow })
    expect(workdays.recurrence?.type).toBe('workdays')
  })

  it('parses early remind offset only', () => {
    const draft = parseAiTaskInput('今天下午3点，提前3分钟提醒我', { categories, now: fixedNow })
    expect(draft.dueAt).toBe('2026-07-03T15:00:00')
    expect(draft.reminders.map((r) => r.offsetMinutes)).toEqual([3])
  })

  it('defaults early remind to 5 minutes', () => {
    const draft = parseAiTaskInput('今天下午3点，提前提醒我', { categories, now: fixedNow })
    expect(draft.reminders.map((r) => r.offsetMinutes)).toEqual([5])
  })

  it('only creates early remind when saying 提前10分钟, without on-time', () => {
    const draft = parseAiTaskInput('今天早上9点半叫我起床吃早饭，提前10分钟提醒我', {
      categories,
      now: dayjs('2026-07-11T08:00:00')
    })
    expect(draft.dueAt).toBe('2026-07-11T09:30:00')
    expect(draft.reminders).toHaveLength(1)
    expect(draft.reminders[0]?.offsetMinutes).toBe(10)
    expect(draft.remindAt).toBe('2026-07-11T09:20:00')
  })

  it('creates on-time remind only when saying 提醒我 without 提前', () => {
    const draft = parseAiTaskInput('明天下午3点开会提醒我', { categories, now: fixedNow })
    expect(draft.reminders).toHaveLength(1)
    expect(draft.reminders[0]?.offsetMinutes).toBe(0)
  })

  it('parses relative after duration', () => {
    const draft = parseAiTaskInput('30分钟后取快递', { categories, now: fixedNow })
    expect(draft.dueAt).toBe('2026-07-03T16:30:00')
    expect(draft.title).toBe('取快递')

    const compound = parseAiTaskInput('1小时30分钟后开会', { categories, now: fixedNow })
    expect(compound.dueAt).toBe('2026-07-03T17:30:00')
  })

  it('parses tonight and deadline phrases', () => {
    const tonight = parseAiTaskInput('今晚写总结', { categories, now: fixedNow })
    expect(tonight.dueAt).toBe('2026-07-03T20:00:00')
    expect(tonight.title).toBe('写总结')

    const deadline = parseAiTaskInput('截止明天下午3点交报告', { categories, now: fixedNow })
    expect(deadline.dueAt).toBe('2026-07-04T15:00:00')
    expect(deadline.title).toBe('交报告')
  })

  it('parses iso date and 号 suffix', () => {
    const iso = parseAiTaskInput('2026-07-10 团队复盘', { categories, now: fixedNow })
    expect(iso.dueAt).toBe('2026-07-10T09:00:00')
    expect(iso.title).toBe('团队复盘')

    const cn = parseAiTaskInput('7月10号提交', { categories, now: fixedNow })
    expect(cn.dueAt).toBe('2026-07-10T09:00:00')
    expect(cn.title).toBe('提交')
  })
})

describe('buildCreateTaskDtoFromParsed', () => {
  it('maps reminders and recurrence to dto', () => {
    const draft = parseAiTaskInput('每天下午3点复盘', { categories, now: fixedNow })
    const dto = buildCreateTaskDtoFromParsed(draft, { kanbanGroupId: null })
    expect(dto.recurrence?.type).toBe('daily')
    expect(dto.dueAt).toBeTruthy()
    expect(dto.title).toBe('复盘')
  })

  it('falls back to keyword match when no parsed category or nav default', () => {
    const draft = parseAiTaskInput('下午周例会讨论', { categories, now: fixedNow })
    const dto = buildCreateTaskDtoFromParsed(
      draft,
      { categoryId: null },
      {
        rawInput: '下午周例会讨论',
        parseCategories: [{ id: 'c-work', name: '工作', keywords: ['周例会'] }]
      }
    )
    expect(dto.categoryId).toBe('c-work')
  })
})

describe('buildParseTextSegments', () => {
  it('splits source text by highlight ranges', () => {
    const draft = parseAiTaskInput('明天下午3点开会，提前30分钟提醒我', {
      categories,
      now: fixedNow
    })
    const segments = buildParseTextSegments('明天下午3点开会，提前30分钟提醒我', draft.highlights)
    const highlighted = segments.filter((s) => s.kind !== 'plain').map((s) => s.text).join('|')
    expect(highlighted).toContain('明天下午3点')
    expect(highlighted).toContain('提前30分钟')
  })
})
