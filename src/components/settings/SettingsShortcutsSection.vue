<template>
  <section class="settings-section settings-section--wide">
    <h2 class="settings-section__title">快捷键</h2>
    <p class="settings-section__hint">
      点击「设置」或「更改」录入快捷键，按 Esc 取消录入。「清除」可禁用该动作；「全局」类在窗口隐藏时仍可通过系统级快捷键触发。
      同一快捷键不可绑定多个动作，保存前会自动检测冲突。
    </p>

    <el-alert
      v-if="conflictInfos.length"
      type="error"
      :closable="false"
      show-icon
      class="settings-section__conflict-alert"
      title="检测到快捷键冲突"
    >
      <ul class="settings-section__conflict-list">
        <li v-for="item in conflictInfos" :key="item.accelerator">
          <kbd class="settings-section__kbd is-conflict">{{
            formatAcceleratorForDisplay(item.accelerator, isMac)
          }}</kbd>
          被占用：{{ item.labels.join('、') }}
        </li>
      </ul>
    </el-alert>

    <div class="settings-section__toolbar">
      <el-button size="small" @click="runConflictCheck">检测冲突</el-button>
      <el-button class="settings-section__reset" size="small" @click="resetAllShortcuts">
        全部恢复默认
      </el-button>
    </div>

    <div v-for="category in categories" :key="category" class="settings-section__group">
      <h3 class="settings-section__group-title">{{ SHORTCUT_CATEGORY_LABELS[category] }}</h3>
      <el-table :data="rowsFor(category)" size="small" class="settings-section__table" row-class-name="shortcut-row">
        <el-table-column prop="label" label="动作" min-width="120">
          <template #default="{ row }">
            <span :class="{ 'is-conflict-label': row.hasConflict }">{{ row.label }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="180" />
        <el-table-column label="快捷键" min-width="160">
          <template #default="{ row }">
            <div class="settings-section__key-cell">
              <kbd
                class="settings-section__kbd"
                :class="{ 'is-empty': !row.bound, 'is-conflict': row.hasConflict }"
              >
                {{ row.display }}
              </kbd>
              <span v-if="row.hasConflict" class="settings-section__conflict-tag">冲突</span>
            </div>
            <p v-if="row.conflictHint" class="settings-section__conflict-hint">{{ row.conflictHint }}</p>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200">
          <template #default="{ row }">
            <ShortcutEditor
              :value="shortcutStore.bindings[row.id]"
              :is-default="row.isDefault"
              @change="(accel) => onShortcutChange(row.id, accel)"
              @reset="() => onShortcutReset(row.id)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  findActionsUsingAccelerator,
  formatAcceleratorForDisplay,
  formatShortcutConflictMessage,
  getDefaultShortcutBindings,
  isShortcutBound,
  listShortcutConflicts,
  type ShortcutActionCategory,
  type ShortcutActionId
} from '@shared/shortcuts'
import ShortcutEditor from '@/components/ShortcutEditor.vue'
import { useShortcutStore } from '@/stores/shortcut-store'

const shortcutStore = useShortcutStore()
const categories = SHORTCUT_CATEGORY_ORDER
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

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
    const peers = hasConflict
      ? conflictInfos.value.find((c) => c.actionIds.includes(action.id))?.labels.filter(
          (l) => l !== action.label
        ) ?? []
      : []
    return {
      id: action.id,
      category: action.category,
      label: action.label,
      description: action.description,
      display: shortcutStore.displayFor(action.id),
      bound: isShortcutBound(shortcutStore.bindings[action.id]),
      isDefault: shortcutStore.bindings[action.id] === defaults[action.id],
      hasConflict,
      conflictHint: peers.length ? `与「${peers.join('、')}」冲突` : ''
    }
  })
})

function rowsFor(category: ShortcutActionCategory) {
  return shortcutRows.value.filter((row) => row.category === category)
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
    /* 用户取消 */
  }
}

onMounted(async () => {
  if (!shortcutStore.loaded) {
    await shortcutStore.load()
  }
})
</script>

<style scoped lang="scss">
.settings-section--wide {
  max-width: 960px;
}

.settings-section__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0 0 16px;
  line-height: 1.5;
}

.settings-section__conflict-alert {
  margin-bottom: 12px;
}

.settings-section__conflict-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
}

.settings-section__toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.settings-section__group {
  margin-bottom: 20px;
}

.settings-section__group-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
}

.settings-section__table {
  width: 100%;
}

.settings-section__key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-section__kbd {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-panel);
  font-family: Consolas, monospace;
  font-size: 12px;

  &.is-empty {
    color: var(--desktop-muted);
    border-style: dashed;
    font-family: inherit;
  }

  &.is-conflict {
    border-color: var(--el-color-danger);
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}

.settings-section__conflict-tag {
  font-size: 12px;
  color: var(--el-color-danger);
  font-weight: 600;
}

.settings-section__conflict-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-color-danger);
}

.is-conflict-label {
  color: var(--el-color-danger);
  font-weight: 600;
}
</style>
