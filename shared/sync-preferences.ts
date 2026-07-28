/** 本机同步偏好（不同步到云端） */

export const SYNC_INTERVAL_OPTIONS_MS = [30_000, 60_000, 120_000, 300_000] as const
export type SyncIntervalMs = (typeof SYNC_INTERVAL_OPTIONS_MS)[number]

export interface SyncPreferences {
  /** 同步分类与任务（含任务内嵌标签/提醒） */
  syncTasks: boolean
  /** 同步个人配置、视图、挂件偏好等 */
  syncConfig: boolean
  /** 同步便签 */
  syncNotes: boolean
  /** 全局同步间隔（毫秒） */
  syncIntervalMs: SyncIntervalMs
}

export const DEFAULT_SYNC_PREFERENCES: SyncPreferences = {
  syncTasks: true,
  syncConfig: true,
  syncNotes: true,
  syncIntervalMs: 30_000
}

export function isSyncIntervalMs(value: unknown): value is SyncIntervalMs {
  return (
    typeof value === 'number' &&
    (SYNC_INTERVAL_OPTIONS_MS as readonly number[]).includes(value)
  )
}

export function mergeSyncPreferences(partial?: Partial<SyncPreferences> | null): SyncPreferences {
  const base = { ...DEFAULT_SYNC_PREFERENCES }
  if (!partial) return base
  return {
    syncTasks: partial.syncTasks ?? base.syncTasks,
    syncConfig: partial.syncConfig ?? base.syncConfig,
    syncNotes: partial.syncNotes ?? base.syncNotes,
    syncIntervalMs: isSyncIntervalMs(partial.syncIntervalMs)
      ? partial.syncIntervalMs
      : base.syncIntervalMs
  }
}

export function syncIntervalLabel(ms: SyncIntervalMs): string {
  switch (ms) {
    case 30_000:
      return '30 秒'
    case 60_000:
      return '1 分钟'
    case 120_000:
      return '2 分钟'
    case 300_000:
      return '5 分钟'
    default:
      return `${ms} ms`
  }
}
