import type { SyncEntityType } from '@shared/sync-protocol'
import type { SyncPreferences } from '@shared/sync-preferences'

/**
 * 将协议实体类型映射到设置页「同步范围」开关。
 *
 * Push / Pull / enqueueMissing 共用此函数，保证关开关后：
 * - 不会再推该类 pending；
 * - 也不会应用远端该类变更。
 *
 * 特例：app_message 只对应「定时汇总结果」，不跟 syncConfig 绑在一起。
 */
export function isSyncEntityEnabled(
  entityType: SyncEntityType,
  prefs: SyncPreferences
): boolean {
  switch (entityType) {
    case 'category':
    case 'task':
    case 'task_reminder':
    case 'tag':
    case 'task_tag':
      return prefs.syncTasks
    case 'widget_note':
      return prefs.syncNotes
    case 'app_settings':
    case 'task_view':
    case 'scheduled_summary':
      return prefs.syncConfig
    case 'app_message':
      return prefs.syncSummaryResults
    default:
      return false
  }
}
