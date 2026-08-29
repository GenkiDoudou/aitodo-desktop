import type { AiPromptConfig } from './ai-prompt-config'
import type { LlmConfig } from './llm-config'
import type { ShortcutBindings } from './shortcuts'

/** 个人配置导出文件格式 */
export interface UserConfigExport {
  version: 1
  exportedAt: string
  shortcuts?: ShortcutBindings
  llm?: LlmConfig
  aiPrompt?: AiPromptConfig
  /** 渲染进程 localStorage 中的 UI 偏好（aitodo_* 键） */
  uiPreferences?: Record<string, string>
}

export const USER_CONFIG_EXPORT_VERSION = 1 as const

export function buildUserConfigExport(payload: {
  shortcuts: ShortcutBindings
  llm: LlmConfig
  aiPrompt: AiPromptConfig
  uiPreferences?: Record<string, string>
}): UserConfigExport {
  return {
    version: USER_CONFIG_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    shortcuts: payload.shortcuts,
    llm: payload.llm,
    aiPrompt: payload.aiPrompt,
    uiPreferences: payload.uiPreferences
  }
}

export function parseUserConfigExport(raw: string): UserConfigExport {
  const parsed = JSON.parse(raw) as UserConfigExport
  if (parsed.version !== USER_CONFIG_EXPORT_VERSION) {
    throw new Error('不支持的配置文件版本')
  }
  if (!parsed.exportedAt) {
    throw new Error('配置文件格式无效')
  }
  return parsed
}

export interface UserConfigImportResult {
  applied: UserConfigExport
}
