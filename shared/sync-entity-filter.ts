import type { SyncEntityType } from '@shared/sync-protocol'
import type { SyncPreferences } from '@shared/sync-preferences'

/** 按本机同步开关判断实体是否应 Push / Pull / 补齐 */
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
    default:
      return false
  }
}
