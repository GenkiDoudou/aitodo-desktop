import { describe, expect, it } from 'vitest'
import { getDefaultLlmConfig, mergeLlmConfig } from './llm-config'

describe('llm-config', () => {
  it('mergeLlmConfig applies provider defaults', () => {
    const cfg = mergeLlmConfig({ provider: 'deepseek', apiKey: 'sk-test' })
    expect(cfg.provider).toBe('deepseek')
    expect(cfg.model).toBe('deepseek-chat')
    expect(cfg.baseUrl).toContain('deepseek.com')
  })

  it('getDefaultLlmConfig uses alibaba', () => {
    const cfg = getDefaultLlmConfig()
    expect(cfg.provider).toBe('alibaba')
    expect(cfg.model).toBe('qwen-plus')
  })
})
