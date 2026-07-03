import {
  DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES,
  normalizeSmartListSidebarPreferences,
  SMART_LIST_SIDEBAR_ITEM_IDS,
  SMART_LIST_SIDEBAR_VISIBILITY_OPTIONS,
  type SmartListSidebarItemId,
  type SmartListSidebarPreferences,
  type SmartListSidebarVisibility
} from '@shared/smart-list-sidebar'

const STORAGE_KEY = 'aitodo_smart_list_sidebar'

export function readSmartListSidebarPreferences(): SmartListSidebarPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<SmartListSidebarPreferences>
    const normalized = normalizeSmartListSidebarPreferences(parsed)
    for (const id of SMART_LIST_SIDEBAR_ITEM_IDS) {
      const v = normalized[id]
      if (!SMART_LIST_SIDEBAR_VISIBILITY_OPTIONS.includes(v)) {
        normalized[id] = DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES[id]
      }
    }
    return normalized
  } catch {
    return { ...DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES }
  }
}

export function persistSmartListSidebarPreferences(prefs: SmartListSidebarPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    /* 无 localStorage 时仅内存生效 */
  }
}

export function patchSmartListSidebarPreference(
  id: SmartListSidebarItemId,
  visibility: SmartListSidebarVisibility
): SmartListSidebarPreferences {
  const next = { ...readSmartListSidebarPreferences(), [id]: visibility }
  persistSmartListSidebarPreferences(next)
  return next
}
