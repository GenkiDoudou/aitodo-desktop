<template>
  <div class="settings">
    <header class="settings__header">
      <el-button text @click="router.push('/')">← 返回</el-button>
      <h1>设置</h1>
    </header>
    <section class="settings__section">
      <h2>数据存储</h2>
      <p class="settings__path">{{ info?.dataPath ?? '加载中…' }}</p>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="安装到 Program Files 等目录可能无法写入；卸载可能删除安装目录下的数据，请及时备份。"
        class="settings__alert"
      />
      <div class="settings__row">
        <el-input v-model="newPath" placeholder="输入新的数据目录绝对路径" />
        <el-button type="primary" @click="changePath">更改（重启后生效）</el-button>
      </div>
      <p v-if="info && !info.writable" class="settings__error">当前目录不可写，请尽快更改。</p>
    </section>
    <section class="settings__section settings__section--wide">
      <h2>快捷键</h2>
      <p class="settings__hint">窗口隐藏时，「新建任务」「显示主窗口」仍可通过全局快捷键触发。</p>
      <el-table :data="shortcutRows" size="small" class="settings__shortcut-table">
        <el-table-column prop="label" label="动作" min-width="120" />
        <el-table-column prop="description" label="说明" min-width="180" />
        <el-table-column label="快捷键" min-width="140">
          <template #default="{ row }">
            <kbd class="settings__kbd">{{ row.display }}</kbd>
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
      <el-button class="settings__reset-all" @click="resetAllShortcuts">全部恢复默认</el-button>
    </section>
    <section class="settings__section">
      <h2>关于</h2>
      <p>版本 {{ info?.version ?? '-' }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AppInfo } from '@shared/types'
import { SHORTCUT_ACTIONS, getDefaultShortcutBindings, type ShortcutActionId } from '@shared/shortcuts'
import ShortcutEditor from '@/components/ShortcutEditor.vue'
import { useShortcutStore } from '@/stores/shortcut-store'
import { unwrapIpc } from '@/ipc/client'

const router = useRouter()
const shortcutStore = useShortcutStore()
const info = ref<AppInfo | null>(null)
const newPath = ref('')

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

async function loadInfo() {
  info.value = await unwrapIpc(await window.api.app.getInfo())
}

async function changePath() {
  const path = newPath.value.trim()
  if (!path) {
    ElMessage.warning('请输入路径')
    return
  }
  const result = await unwrapIpc(await window.api.app.setDataPath(path))
  await ElMessageBox.alert(
    `新路径已保存：${result.pendingPath}\n请手动复制原 data 目录下的文件到新目录后重启应用。`,
    '需重启生效',
    { type: 'info' }
  )
}

onMounted(async () => {
  await loadInfo()
  if (!shortcutStore.loaded) {
    await shortcutStore.load()
  }
})
</script>

<style scoped lang="scss">
.settings {
  padding: 16px 20px;
  height: 100vh;
  overflow: auto;
  background: var(--desktop-bg);
}

.settings__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.settings__section {
  max-width: 640px;
  margin-bottom: 24px;

  h2 {
    font-size: 14px;
    margin: 0 0 8px;
  }
}

.settings__section--wide {
  max-width: 960px;
}

.settings__path {
  font-family: Consolas, monospace;
  font-size: 13px;
  word-break: break-all;
}

.settings__alert {
  margin: 12px 0;
}

.settings__row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings__error {
  color: var(--el-color-danger);
  font-size: 13px;
}

.settings__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0 0 12px;
}

.settings__shortcut-table {
  width: 100%;
}

.settings__kbd {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-panel);
  font-family: Consolas, monospace;
  font-size: 12px;
}

.settings__reset-all {
  margin-top: 12px;
}
</style>
