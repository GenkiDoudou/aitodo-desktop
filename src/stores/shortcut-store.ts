import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  SHORTCUT_ACTIONS,
  type ShortcutActionId,
  type ShortcutBindings,
  eventMatchesAccelerator,
  formatAcceleratorForDisplay,
  getDefaultShortcutBindings,
  isShortcutBound,
  mergeShortcutBindings
} from '@shared/shortcuts'
import { unwrapIpc } from '@/ipc/client'

export const useShortcutStore = defineStore('shortcuts', () => {
  const bindings = ref<ShortcutBindings>(getDefaultShortcutBindings())
  const loaded = ref(false)

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

  async function load() {
    bindings.value = mergeShortcutBindings(
      unwrapIpc(await window.api.app.getShortcuts())
    )
    loaded.value = true
  }

  async function save(next: ShortcutBindings) {
    bindings.value = unwrapIpc(await window.api.app.setShortcuts(next))
  }

  async function resetAll() {
    await save(getDefaultShortcutBindings())
  }

  async function resetOne(actionId: ShortcutActionId) {
    const defaults = getDefaultShortcutBindings()
    await save({ ...bindings.value, [actionId]: defaults[actionId] })
  }

  async function clearOne(actionId: ShortcutActionId) {
    await save({ ...bindings.value, [actionId]: '' })
  }

  function displayFor(actionId: ShortcutActionId): string {
    return formatAcceleratorForDisplay(bindings.value[actionId], isMac)
  }

  function labelFor(actionId: ShortcutActionId): string {
    return SHORTCUT_ACTIONS.find((a) => a.id === actionId)?.label ?? actionId
  }

  function isBound(actionId: ShortcutActionId): boolean {
    return isShortcutBound(bindings.value[actionId])
  }

  /** 窗口聚焦时：根据当前绑定匹配键盘事件（globalWhenHidden 由主进程 globalShortcut 处理） */
  function matchAction(event: KeyboardEvent): ShortcutActionId | null {
    for (const action of SHORTCUT_ACTIONS) {
      if (action.globalWhenHidden) continue
      const accel = bindings.value[action.id]
      if (!isShortcutBound(accel)) continue
      if (eventMatchesAccelerator(event, accel)) {
        return action.id
      }
    }
    return null
  }

  return {
    bindings,
    loaded,
    load,
    save,
    resetAll,
    resetOne,
    clearOne,
    displayFor,
    labelFor,
    isBound,
    matchAction
  }
})
