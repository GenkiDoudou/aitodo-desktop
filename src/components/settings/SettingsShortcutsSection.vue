<template>
  <section class="settings-section settings-section--wide">
    <h2 class="settings-section__title">快捷键</h2>
    <p class="settings-section__hint">窗口隐藏时，「新建任务」「显示主窗口」仍可通过全局快捷键触发。</p>
    <el-table :data="shortcutRows" size="small" class="settings-section__table">
      <el-table-column prop="label" label="动作" min-width="120" />
      <el-table-column prop="description" label="说明" min-width="180" />
      <el-table-column label="快捷键" min-width="140">
        <template #default="{ row }">
          <kbd class="settings-section__kbd">{{ row.display }}</kbd>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="180">
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
    <el-button class="settings-section__reset" @click="resetAllShortcuts">全部恢复默认</el-button>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SHORTCUT_ACTIONS, getDefaultShortcutBindings, type ShortcutActionId } from '@shared/shortcuts'
import ShortcutEditor from '@/components/ShortcutEditor.vue'
import { useShortcutStore } from '@/stores/shortcut-store'

const shortcutStore = useShortcutStore()

const shortcutRows = computed(() => {
  const defaults = getDefaultShortcutBindings()
  return SHORTCUT_ACTIONS.map((action) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    display: shortcutStore.displayFor(action.id),
    isDefault: shortcutStore.bindings[action.id] === defaults[action.id]
  }))
})

async function onShortcutChange(actionId: ShortcutActionId, accelerator: string) {
  try {
    await shortcutStore.save({ ...shortcutStore.bindings, [actionId]: accelerator })
    ElMessage.success('快捷键已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

async function onShortcutReset(actionId: ShortcutActionId) {
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
  margin: 0 0 12px;
}

.settings-section__table {
  width: 100%;
}

.settings-section__kbd {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-panel);
  font-family: Consolas, monospace;
  font-size: 12px;
}

.settings-section__reset {
  margin-top: 12px;
}
</style>
