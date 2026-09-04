<template>
  <!--
    快捷键：贴 preview.html 全局 / 应用分组 + shortcut-key 行。
    点击键位按钮开始录制，保留冲突检测与恢复默认。
  -->
  <section class="settings-section">
    <el-alert
      v-if="conflictInfos.length"
      type="error"
      :closable="false"
      show-icon
      class="settings-shortcuts__alert"
      title="检测到快捷键冲突"
    >
      <ul class="settings-shortcuts__conflict-list">
        <li v-for="item in conflictInfos" :key="item.accelerator">
          <span class="settings-shortcut-key is-conflict">{{
            formatAcceleratorForDisplay(item.accelerator, isMac)
          }}</span>
          被占用：{{ item.labels.join('、') }}
        </li>
      </ul>
    </el-alert>

    <div class="settings-panel">
      <h2 class="settings-panel__title">全局快捷键</h2>
      <div class="settings-panel__body">
        <div v-for="row in globalRows" :key="row.id" class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">{{ row.label }}</div>
            <div class="settings-row__label-desc">{{ row.description }}</div>
          </div>
          <div class="settings-row__control">
            <button
              type="button"
              class="settings-shortcuts__key-btn"
              :class="{ 'is-capturing': capturingId === row.id, 'is-conflict': row.hasConflict }"
              @click="startCapture(row.id)"
            >
              <span class="settings-shortcut-key">{{
                capturingId === row.id ? '按下组合键…' : row.display
              }}</span>
            </button>
            <ShortcutEditor
              :value="shortcutStore.bindings[row.id]"
              :is-default="row.isDefault"
              @change="(accel) => onShortcutChange(row.id, accel)"
              @reset="() => onShortcutReset(row.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">应用快捷键</h2>
      <div class="settings-panel__body">
        <div v-for="row in appRows" :key="row.id" class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">{{ row.label }}</div>
            <div class="settings-row__label-desc">{{ row.description }}</div>
          </div>
          <div class="settings-row__control">
            <button
              type="button"
              class="settings-shortcuts__key-btn"
              :class="{ 'is-capturing': capturingId === row.id, 'is-conflict': row.hasConflict }"
              @click="startCapture(row.id)"
            >
              <span class="settings-shortcut-key">{{
                capturingId === row.id ? '按下组合键…' : row.display
              }}</span>
            </button>
            <ShortcutEditor
              :value="shortcutStore.bindings[row.id]"
              :is-default="row.isDefault"
              @change="(accel) => onShortcutChange(row.id, accel)"
              @reset="() => onShortcutReset(row.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-notice">
      点击快捷键后即可重新录制，录制时按下组合键即可保存。Esc 取消录入。
    </div>

    <div class="settings-shortcuts__toolbar">
      <el-button size="small" @click="runConflictCheck">检测冲突</el-button>
      <el-button size="small" @click="resetAllShortcuts">全部恢复默认</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  SHORTCUT_ACTIONS,
  findActionsUsingAccelerator,
  formatAcceleratorForDisplay,
  formatShortcutConflictMessage,
  getDefaultShortcutBindings,
  isShortcutBound,
  listShortcutConflicts,
  normalizeAccelerator,
  type ShortcutActionId
} from '@shared/shortcuts'
import ShortcutEditor from '@/components/ShortcutEditor.vue'
import { useShortcutStore } from '@/stores/shortcut-store'

const shortcutStore = useShortcutStore()
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
const capturingId = ref<ShortcutActionId | null>(null)

const conflictInfos = computed(() => listShortcutConflicts(shortcutStore.bindings))

const conflictActionIds = computed(() => {
  const ids = new Set<ShortcutActionId>()
  for (const item of conflictInfos.value) {
    for (const id of item.actionIds) ids.add(id)
  }
  return ids
})

const shortcutRows = computed(() => {
  const defaults = getDefaultShortcutBindings()
  return SHORTCUT_ACTIONS.map((action) => {
    const hasConflict = conflictActionIds.value.has(action.id)
    return {
      id: action.id,
      category: action.category,
      label: action.label,
      description: action.description,
      display: isShortcutBound(shortcutStore.bindings[action.id])
        ? shortcutStore.displayFor(action.id)
        : '未设置',
      isDefault: shortcutStore.bindings[action.id] === defaults[action.id],
      hasConflict
    }
  })
})

const globalRows = computed(() => shortcutRows.value.filter((r) => r.category === 'global'))
const appRows = computed(() => shortcutRows.value.filter((r) => r.category !== 'global'))

function buildAccelerator(e: KeyboardEvent): string | null {
  if (e.key === 'Escape' || ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key === ',' ? ',' : e.key.length === 1 ? e.key.toUpperCase() : e.key
  parts.push(key)
  return normalizeAccelerator(parts.join('+'))
}

function onCaptureKeydown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') {
    stopCapture()
    return
  }
  const accel = buildAccelerator(e)
  if (!accel || !capturingId.value) return
  const id = capturingId.value
  stopCapture()
  void onShortcutChange(id, accel)
}

function startCapture(id: ShortcutActionId) {
  stopCapture()
  capturingId.value = id
  window.addEventListener('keydown', onCaptureKeydown, true)
}

function stopCapture() {
  capturingId.value = null
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

function runConflictCheck() {
  const list = conflictInfos.value
  if (!list.length) {
    ElMessage.success('未检测到快捷键冲突')
    return
  }
  const detail = list
    .map(
      (item) =>
        `${formatAcceleratorForDisplay(item.accelerator, isMac)} → ${item.labels.join('、')}`
    )
    .join('；')
  ElMessage.warning(`发现 ${list.length} 处冲突：${detail}`)
}

async function onShortcutChange(actionId: ShortcutActionId, accelerator: string) {
  if (accelerator) {
    const occupied = findActionsUsingAccelerator(shortcutStore.bindings, accelerator, actionId)
    if (occupied.length) {
      ElMessage.warning(formatShortcutConflictMessage(accelerator, occupied, isMac))
      return
    }
  }
  try {
    await shortcutStore.save({ ...shortcutStore.bindings, [actionId]: accelerator })
    ElMessage.success(accelerator ? '快捷键已保存' : '已清除快捷键')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

async function onShortcutReset(actionId: ShortcutActionId) {
  const defaults = getDefaultShortcutBindings()
  const nextAccel = defaults[actionId]
  if (nextAccel) {
    const occupied = findActionsUsingAccelerator(shortcutStore.bindings, nextAccel, actionId)
    if (occupied.length) {
      ElMessage.warning(formatShortcutConflictMessage(nextAccel, occupied, isMac))
      return
    }
  }
  try {
    await shortcutStore.resetOne(actionId)
    ElMessage.success('已恢复默认')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

async function resetAllShortcuts() {
  try {
    await ElMessageBox.confirm('确定将所有快捷键恢复为默认值？', '恢复默认', { type: 'warning' })
    await shortcutStore.resetAll()
    ElMessage.success('已全部恢复默认')
  } catch {
    /* 取消 */
  }
}

onMounted(async () => {
  if (!shortcutStore.loaded) await shortcutStore.load()
})

onUnmounted(stopCapture)
</script>

<style scoped lang="scss">
.settings-shortcuts__alert {
  margin-bottom: 12px;
}

.settings-shortcuts__conflict-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}

.settings-shortcuts__key-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;

  &.is-capturing .settings-shortcut-key {
    border-color: #409eff;
    color: #409eff;
  }

  &.is-conflict .settings-shortcut-key {
    border-color: #f56c6c;
    color: #f56c6c;
  }
}

.settings-shortcuts__toolbar {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
