import { nowIso } from '@shared/datetime'
import { mergeAiPromptConfig } from '@shared/ai-prompt-config'
import { mergeLlmConfig } from '@shared/llm-config'
import { mergeShortcutBindings } from '@shared/shortcuts'
import { mergeCloseBehavior, type CloseBehavior } from '@shared/close-behavior'
import { mergeTaskActivityRetention } from '@shared/task-activity-retention'
import type { TaskActivityRetentionPolicy } from '@shared/types'
import type { SyncOutbox } from '../db/sync-outbox'
import {
  readAiPromptConfig,
  readCloseBehavior,
  readLlmConfig,
  readShortcutBindings,
  readTaskActivityRetention,
  saveAiPromptConfig,
  saveCloseBehavior,
  saveLlmConfig,
  saveShortcutBindings,
  saveTaskActivityRetention
} from '../data-path'
import type { WidgetNoteRepository } from '../db/widget-note-repository'
import { writeUiPreferencesSnapshot } from '../db/ui-preferences-snapshot'

export const APP_SETTINGS_ENTITY_ID = 'default'

export interface AppSettingsSyncPayload {
  id: typeof APP_SETTINGS_ENTITY_ID
  updatedAt: string
  shortcuts: ReturnType<typeof readShortcutBindings>
  llm: ReturnType<typeof readLlmConfig>
  aiPrompt: ReturnType<typeof readAiPromptConfig>
  closeBehavior: CloseBehavior
  taskActivityRetention: TaskActivityRetentionPolicy
  widget: { openOnStartup: boolean }
  /** 渲染进程 UI 偏好（可选，定时同步时可能为空） */
  uiPreferences?: Record<string, string>
}

export function buildAppSettingsPayload(
  widgetNoteRepo: WidgetNoteRepository,
  uiPreferences?: Record<string, string>
): AppSettingsSyncPayload {
  const settings = widgetNoteRepo.getSettings()
  return {
    id: APP_SETTINGS_ENTITY_ID,
    updatedAt: nowIso(),
    shortcuts: readShortcutBindings(),
    llm: readLlmConfig(),
    aiPrompt: readAiPromptConfig(),
    closeBehavior: readCloseBehavior(),
    taskActivityRetention: readTaskActivityRetention(),
    widget: { openOnStartup: settings.openOnStartup },
    ...(uiPreferences ? { uiPreferences } : {})
  }
}

export function enqueueAppSettingsUpsert(
  outbox: SyncOutbox,
  widgetNoteRepo: WidgetNoteRepository,
  uiPreferences?: Record<string, string>
): void {
  const payload = buildAppSettingsPayload(widgetNoteRepo, uiPreferences)
  outbox.record({
    entityType: 'app_settings',
    entityId: APP_SETTINGS_ENTITY_ID,
    operation: 'upsert',
    payload: payload as unknown as Record<string, unknown>,
    clientSyncVersion: 1
  })
}

export function applyAppSettingsPayload(
  payload: Record<string, unknown>,
  widgetNoteRepo: WidgetNoteRepository,
  dataDir?: string
): Record<string, string> | null {
  if (payload.shortcuts && typeof payload.shortcuts === 'object') {
    saveShortcutBindings(mergeShortcutBindings(payload.shortcuts as never))
  }
  if (payload.llm && typeof payload.llm === 'object') {
    saveLlmConfig(mergeLlmConfig(payload.llm as never))
  }
  if (payload.aiPrompt && typeof payload.aiPrompt === 'object') {
    saveAiPromptConfig(mergeAiPromptConfig(payload.aiPrompt as never))
  }
  if (payload.closeBehavior && typeof payload.closeBehavior === 'object') {
    saveCloseBehavior(mergeCloseBehavior(payload.closeBehavior as never))
  }
  if (payload.taskActivityRetention && typeof payload.taskActivityRetention === 'object') {
    saveTaskActivityRetention(mergeTaskActivityRetention(payload.taskActivityRetention as never))
  }
  const widget = payload.widget as { openOnStartup?: boolean } | undefined
  if (widget && typeof widget.openOnStartup === 'boolean') {
    widgetNoteRepo.updateSettings({ openOnStartup: widget.openOnStartup })
  }

  const ui = payload.uiPreferences
  if (ui && typeof ui === 'object' && !Array.isArray(ui) && dataDir) {
    const prefs: Record<string, string> = {}
    for (const [k, v] of Object.entries(ui as Record<string, unknown>)) {
      if (typeof v === 'string') prefs[k] = v
    }
    writeUiPreferencesSnapshot(dataDir, prefs)
    return prefs
  }
  return null
}
