<template>
  <section class="settings-section">
    <h2 class="settings-section__title">导入 / 导出</h2>
    <p class="settings-section__hint">
      导出或导入个人配置，包括快捷键、大模型、提示词及界面偏好（清单分组、视图模式等）。
      不包含任务数据与数据库内容。
    </p>

    <div class="settings-section__actions">
      <el-button type="primary" :loading="exporting" @click="onExport">导出配置</el-button>
      <el-button :loading="importing" @click="onImport">导入配置</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { unwrapIpc } from '@/ipc/client'
import { collectUiPreferences, applyUiPreferences } from '@/utils/ui-preferences-export'
import { useLlmStore } from '@/stores/llm-store'
import { useAiPromptStore } from '@/stores/ai-prompt-store'
import { useShortcutStore } from '@/stores/shortcut-store'

const exporting = ref(false)
const importing = ref(false)
const llmStore = useLlmStore()
const promptStore = useAiPromptStore()
const shortcutStore = useShortcutStore()

async function onExport() {
  exporting.value = true
  try {
    const path = unwrapIpc(
      await window.api.app.exportUserConfig(collectUiPreferences())
    )
    if (path) {
      ElMessage.success(`配置已导出至：${path}`)
    }
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    exporting.value = false
  }
}

async function onImport() {
  try {
    await ElMessageBox.confirm(
      '导入将覆盖当前快捷键、大模型与提示词设置，是否继续？',
      '导入配置',
      { type: 'warning', confirmButtonText: '继续导入', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  importing.value = true
  try {
    const result = unwrapIpc(await window.api.app.importUserConfig())
    if (!result) return

    applyUiPreferences(result.applied.uiPreferences)
    await Promise.all([
      shortcutStore.load(),
      llmStore.load(),
      promptStore.load()
    ])
    ElMessage.success('配置已导入，部分界面偏好需刷新页面后生效')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    importing.value = false
  }
}
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 720px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0 0 20px;
  line-height: 1.6;
}

.settings-section__actions {
  display: flex;
  gap: 8px;
}
</style>
