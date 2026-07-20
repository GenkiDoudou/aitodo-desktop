import { describe, expect, it } from 'vitest'
import { mergeAiPromptConfig, renderAiUserPrompt } from './ai-prompt-config'

describe('ai-prompt-config', () => {
  it('renderAiUserPrompt replaces placeholders', () => {
    const text = renderAiUserPrompt('输入：{input} 今天：{today} 分类：{categories}', {
      input: '明天开会',
      today: '2026-07-03',
      categories: '工作,生活'
    })
    expect(text).toContain('明天开会')
    expect(text).toContain('2026-07-03')
    expect(text).toContain('工作,生活')
  })

  it('mergeAiPromptConfig keeps defaults for empty strings', () => {
    const cfg = mergeAiPromptConfig({ systemPrompt: '  ' })
    expect(cfg.systemPrompt.length).toBeGreaterThan(20)
    expect(cfg.taskPromptName).toBe('任务提示词')
    expect(cfg.customPrompts).toEqual([])
  })

  it('mergeAiPromptConfig defaults taskParseMode to local', () => {
    const cfg = mergeAiPromptConfig({})
    expect(cfg.taskParseMode).toBe('local')
  })

  it('mergeAiPromptConfig accepts llm mode', () => {
    const cfg = mergeAiPromptConfig({ taskParseMode: 'llm' })
    expect(cfg.taskParseMode).toBe('llm')
  })
})
