import fs from 'fs'
import { dialog, type BrowserWindow } from 'electron'
import { mergeAiPromptConfig } from '@shared/ai-prompt-config'
import { mergeLlmConfig } from '@shared/llm-config'
import { mergeShortcutBindings } from '@shared/shortcuts'
import {
  buildUserConfigExport,
  parseUserConfigExport,
  type UserConfigExport,
  type UserConfigImportResult
} from '@shared/user-config-export'
import {
  readAiPromptConfig,
  readLlmConfig,
  readShortcutBindings,
  saveAiPromptConfig,
  saveLlmConfig,
  saveShortcutBindings
} from '../data-path'

export function buildCurrentUserConfigExport(
  uiPreferences?: Record<string, string>
): UserConfigExport {
  return buildUserConfigExport({
    shortcuts: readShortcutBindings(),
    llm: readLlmConfig(),
    aiPrompt: readAiPromptConfig(),
    uiPreferences
  })
}

export async function exportUserConfigToFile(
  parent: BrowserWindow | undefined,
  uiPreferences?: Record<string, string>
): Promise<string | null> {
  if (parent && !parent.isDestroyed()) {
    parent.focus()
  }
  const result = await dialog.showSaveDialog(parent ?? undefined, {
    title: '导出个人配置',
    defaultPath: `ai-todo-config-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) {
    return null
  }
  const payload = buildCurrentUserConfigExport(uiPreferences)
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return result.filePath
}

export async function importUserConfigFromFile(
  parent: BrowserWindow | undefined
): Promise<UserConfigImportResult | null> {
  if (parent && !parent.isDestroyed()) {
    parent.focus()
  }
  const result = await dialog.showOpenDialog(parent ?? undefined, {
    title: '导入个人配置',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths[0]) {
    return null
  }
  const raw = fs.readFileSync(result.filePaths[0], 'utf-8')
  const parsed = parseUserConfigExport(raw)
  applyUserConfigImport(parsed)
  return { applied: parsed }
}

export function applyUserConfigImport(data: UserConfigExport): void {
  if (data.shortcuts) {
    saveShortcutBindings(mergeShortcutBindings(data.shortcuts))
  }
  if (data.llm) {
    saveLlmConfig(mergeLlmConfig(data.llm))
  }
  if (data.aiPrompt) {
    saveAiPromptConfig(mergeAiPromptConfig(data.aiPrompt))
  }
}
