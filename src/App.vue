<template>
  <router-view />
  <CloseBehaviorDialog v-model="closeDialogVisible" @confirm="confirmClose" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { ShortcutActionId } from '@shared/shortcuts'
import type { ConfirmClosePayload } from '@shared/close-behavior'
import CloseBehaviorDialog from '@/components/CloseBehaviorDialog.vue'
import { useDesktopActions } from '@/composables/useDesktopActions'
import { useShortcutStore } from '@/stores/shortcut-store'
import { unwrapIpc } from '@/ipc/client'
import { initDesktopTheme } from '@/utils/theme-preferences'
import { applyUiPreferences, collectUiPreferences } from '@/utils/ui-preferences-export'

const router = useRouter()
const shortcutStore = useShortcutStore()
const { dispatch } = useDesktopActions()
const closeDialogVisible = ref(false)

/** 输入框/文本域内不拦截单键快捷键，避免与系统编辑操作冲突 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) {
    return
  }
  const action = shortcutStore.matchAction(e)
  if (!action) return
  e.preventDefault()
  void dispatch(action)
}

function onMainAction(action: ShortcutActionId) {
  void dispatch(action)
}

function onNavigate(route: string) {
  void router.push(route)
}

function onCloseRequest() {
  if (closeDialogVisible.value) return
  closeDialogVisible.value = true
}

async function confirmClose(payload: ConfirmClosePayload) {
  try {
    unwrapIpc(await window.api.app.confirmClose(payload))
    closeDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '关闭操作失败')
  }
}

let cleanupNewTask: (() => void) | undefined
let cleanupAction: (() => void) | undefined
let cleanupNavigate: (() => void) | undefined
let cleanupCloseRequest: (() => void) | undefined
let cleanupUiPrefs: (() => void) | undefined

onMounted(async () => {
  initDesktopTheme()
  await shortcutStore.load()
  window.addEventListener('keydown', onKeydown)
  cleanupNewTask = window.api.app.onNewTask(() => {
    void dispatch('newTask')
  })
  cleanupAction = window.api.app.onAction(onMainAction)
  cleanupNavigate = window.api.app.onNavigate(onNavigate)
  cleanupCloseRequest = window.api.app.onCloseRequest(onCloseRequest)
  cleanupUiPrefs = window.api.sync.onUiPreferencesApplied((prefs) => {
    applyUiPreferences(prefs)
  })
  try {
    unwrapIpc(await window.api.sync.reportUiPreferences(collectUiPreferences()))
  } catch {
    /* ignore */
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  cleanupNewTask?.()
  cleanupAction?.()
  cleanupNavigate?.()
  cleanupCloseRequest?.()
  cleanupUiPrefs?.()
})
</script>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  overflow: hidden;
}
</style>
