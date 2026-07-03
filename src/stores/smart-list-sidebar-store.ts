import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  isSmartListSidebarItemVisible,
  type SmartListSidebarItemId,
  type SmartListSidebarPreferences,
  type SmartListSidebarVisibility
} from '@shared/smart-list-sidebar'
import {
  patchSmartListSidebarPreference,
  readSmartListSidebarPreferences
} from '@/utils/smart-list-sidebar-preferences'

/** 任务侧栏智能清单等菜单项的显示偏好（localStorage 持久化） */
export const useSmartListSidebarStore = defineStore('smartListSidebar', () => {
  const preferences = ref<SmartListSidebarPreferences>(readSmartListSidebarPreferences())

  function reload() {
    preferences.value = readSmartListSidebarPreferences()
  }

  function setVisibility(id: SmartListSidebarItemId, visibility: SmartListSidebarVisibility) {
    preferences.value = patchSmartListSidebarPreference(id, visibility)
  }

  function isVisible(id: SmartListSidebarItemId, contentCount: number): boolean {
    return isSmartListSidebarItemVisible(preferences.value[id], contentCount)
  }

  return { preferences, reload, setVisibility, isVisible }
})
