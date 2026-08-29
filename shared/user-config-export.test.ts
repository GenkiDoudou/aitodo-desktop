import { describe, expect, it } from 'vitest'
import {
  buildUserConfigExport,
  parseUserConfigExport,
  USER_CONFIG_EXPORT_VERSION
} from './user-config-export'
import { getDefaultAiPromptConfig } from './ai-prompt-config'
import { getDefaultLlmConfig } from './llm-config'
import { mergeShortcutBindings } from './shortcuts'

describe('user-config-export', () => {
  it('builds and parses export payload', () => {
    const payload = buildUserConfigExport({
      shortcuts: mergeShortcutBindings(),
      llm: getDefaultLlmConfig(),
      aiPrompt: getDefaultAiPromptConfig(),
      uiPreferences: { aitodo_hide_done: 'true' }
    })
    expect(payload.version).toBe(USER_CONFIG_EXPORT_VERSION)
    const parsed = parseUserConfigExport(JSON.stringify(payload))
    expect(parsed.uiPreferences?.aitodo_hide_done).toBe('true')
  })

  it('rejects unsupported version', () => {
    expect(() =>
      parseUserConfigExport(JSON.stringify({ version: 99, exportedAt: 'x' }))
    ).toThrow('不支持的配置文件版本')
  })
})
