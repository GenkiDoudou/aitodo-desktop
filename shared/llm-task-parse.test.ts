import { describe, expect, it } from 'vitest'
import { draftFromLlmTaskResponse } from './llm-task-parse'

describe('draftFromLlmTaskResponse', () => {
  const cats = [
    { id: 'c1', name: '工作', keywords: [] },
    { id: 'c2', name: '生活', keywords: [] }
  ]

  it('parses plain JSON', () => {
    const draft = draftFromLlmTaskResponse(
      JSON.stringify({
        title: '开会',
        dueAt: '2026-07-21T15:00:00',
        remindAt: '2026-07-21T14:30:00',
        categoryName: '工作'
      }),
      cats,
      '原始输入'
    )
    expect(draft.title).toBe('开会')
    expect(draft.dueAt).toBe('2026-07-21T15:00:00')
    expect(draft.remindAt).toBe('2026-07-21T14:30:00')
    expect(draft.category?.id).toBe('c1')
    expect(draft.reminders.length).toBe(1)
  })

  it('strips markdown fence and falls back title', () => {
    const draft = draftFromLlmTaskResponse(
      '```json\n{"title":null,"dueAt":null,"remindAt":null,"categoryName":null}\n```',
      cats,
      '明天买菜'
    )
    expect(draft.title).toBe('明天买菜')
    expect(draft.dueAt).toBeNull()
    expect(draft.category).toBeNull()
  })

  it('throws on invalid JSON', () => {
    expect(() => draftFromLlmTaskResponse('not-json', cats, 'x')).toThrow(/JSON/)
  })
})
