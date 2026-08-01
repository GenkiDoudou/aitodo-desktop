import { app } from 'electron'
import { nowIso } from '@shared/datetime'
import { mergeAiPromptConfig } from '@shared/ai-prompt-config'
import { mergeLlmConfig } from '@shared/llm-config'
import { mergeShortcutBindings } from '@shared/shortcuts'
import { mergeCloseBehavior, type CloseBehavior } from '@shared/close-behavior'
import type { LaunchAtLoginPrefs } from '@shared/launch-at-login'
import { mergeLaunchAtLoginPrefs } from '@shared/launch-at-login'
import { mergeTaskActivityRetention } from '@shared/task-activity-retention'
import type { TaskActivityRetentionPolicy } from '@shared/types'
import type { SyncOutbox } from '../db/sync-outbox'
import {
  readAiPromptConfig,
  readCloseBehavior,
  readLaunchAtLoginPrefs,
  readLlmConfig,
  readShortcutBindings,
  readTaskActivityRetention,
  saveAiPromptConfig,
  saveCloseBehavior,
  saveLaunchAtLoginPrefs,
  saveLlmConfig,
  saveShortcutBindings,
  saveTaskActivityRetention
} from '../data-path'
import { applyLaunchAtLoginToSystem } from '../launch-at-login'
import type { WidgetNoteRepository } from '../db/widget-note-repository'
import { writeUiPreferencesSnapshot } from '../db/ui-preferences-snapshot'

/**
 * 个人配置在同步协议中的单实体 id。
 * 本机只有一份「默认配置袋」，多设备互相覆盖时靠 updatedAt / 服务端冲突策略。
 */
export const APP_SETTINGS_ENTITY_ID = 'default'

/**
 * app_settings 载荷：把分散在本机文件/SQLite 的配置打成一份可 push/pull 的快照。
 * 注意：含 LLM API Key，仅在用户开启 syncConfig 且已登录时入队。
 */
export interface AppSettingsSyncPayload {
  id: typeof APP_SETTINGS_ENTITY_ID
  updatedAt: string
  shortcuts: ReturnType<typeof readShortcutBindings>
  llm: ReturnType<typeof readLlmConfig>
  aiPrompt: ReturnType<typeof readAiPromptConfig>
  closeBehavior: CloseBehavior
  launchAtLogin: LaunchAtLoginPrefs
  taskActivityRetention: TaskActivityRetentionPolicy
  widget: { openOnStartup: boolean }
  /** 渲染进程 UI 偏好（可选，定时同步时可能为空） */
  uiPreferences?: Record<string, string>
}

/** 从本机各配置源组装 push 载荷。 */
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
    launchAtLogin: readLaunchAtLoginPrefs(),
    taskActivityRetention: readTaskActivityRetention(),
    widget: { openOnStartup: settings.openOnStartup },
    ...(uiPreferences ? { uiPreferences } : {})
  }
}

/** 将当前本机配置 upsert 进 outbox（由 SyncEngine / 配置变更钩子调用）。 */
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

/**
 * 应用远端 app_settings：字段缺失则跳过，避免半包覆盖。
 * 各子配置经 merge* 与默认值合并后再落盘。
 * @returns 若写入了 uiPreferences，返回该 map 供渲染进程广播；否则 null。
 */
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
  if (payload.launchAtLogin !== undefined) {
    const prefs = mergeLaunchAtLoginPrefs(payload.launchAtLogin as LaunchAtLoginPrefs)
    saveLaunchAtLoginPrefs(prefs)
    try {
      applyLaunchAtLoginToSystem(prefs, app)
    } catch {
      /* 登录项失败不阻断其它配置 */
    }
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
