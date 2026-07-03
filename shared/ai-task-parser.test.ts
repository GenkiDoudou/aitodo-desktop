import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import { parseAiTaskInput } from './ai-task-parser'

const categories = [
  { id: 'c-work', name: '工作' },
  { id: 'c-life', name: '生活' }
]

const fixedNow = dayjs('2026-07-03T10:00:00')

describe('parseAiTaskInput', () => {
  it('parses due, remind, category and title from a full sentence', () => {
    const draft = parseAiTaskInput(
      '明天下午3点开会，提前30分钟提醒我，归到工作分类',
      { categories, now: fixedNow }
    )
    expect(draft.title).toBe('开会')
    expect(draft.dueAt).toBe('2026-07-04T15:00:00')
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
    expect(draft.remindAt).toBeNull()
    expect(draft.warnings.some((w) => w.includes('截止时间'))).toBe(true)
  })

  it('handles today with half hour', () => {
    const draft = parseAiTaskInput('今天下午4点半健身', { categories, now: fixedNow })
    expect(draft.dueAt).toBe('2026-07-03T16:30:00')
    expect(draft.title).toBe('健身')
  })
})
