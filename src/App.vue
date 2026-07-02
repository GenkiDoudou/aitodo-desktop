<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { ShortcutActionId } from '@shared/shortcuts'
import { useDesktopActions } from '@/composables/useDesktopActions'
import { useShortcutStore } from '@/stores/shortcut-store'

const shortcutStore = useShortcutStore()
const { dispatch } = useDesktopActions()

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

let cleanupNewTask: (() => void) | undefined
let cleanupAction: (() => void) | undefined

onMounted(async () => {
  await shortcutStore.load()
  window.addEventListener('keydown', onKeydown)
  cleanupNewTask = window.api.app.onNewTask(() => {
    void dispatch('newTask')
  })
  cleanupAction = window.api.app.onAction(onMainAction)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  cleanupNewTask?.()
  cleanupAction?.()
})
</script>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
</style>
