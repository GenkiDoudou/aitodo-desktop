/** 可随个人配置导出/导入的 localStorage 键（aitodo_*） */
export const UI_PREFERENCE_STORAGE_KEYS = [
  'aitodo_hide_done',
  'aitodo_list_date_field',
  'aitodo_done_time_range',
  'aitodo_calendar_date_field',
  'aitodo_calendar_range_preset',
  'aitodo_task_group_by',
  'aitodo_task_sort_by',
  'aitodo_list_view_mode',
  'aitodo_task_detail_style',
  'aitodo_task_list_meta_visibility',
  'aitodo_smart_list_sidebar',
  'aitodo_kanban_config',
  'aitodo_kanban_board_mode',
  'aitodo_selected_view_id'
] as const

export function collectUiPreferences(): Record<string, string> {
  const prefs: Record<string, string> = {}
  for (const key of UI_PREFERENCE_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key)
      if (value != null) {
        prefs[key] = value
      }
    } catch {
      /* ignore */
    }
  }
  return prefs
}

export function applyUiPreferences(prefs: Record<string, string> | undefined): void {
  if (!prefs) return
  for (const key of UI_PREFERENCE_STORAGE_KEYS) {
    const value = prefs[key]
    if (value == null) continue
    try {
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  }
}
