<template>
  <section class="settings-section">
    <h2 class="settings-section__title">导入 / 导出</h2>

    <h3 class="settings-section__subtitle">个人配置</h3>
    <p class="settings-section__hint">
      导出或导入个人配置，包括快捷键、大模型、提示词及界面偏好（清单分组、视图模式等）。
      不包含任务数据与数据库内容。
    </p>
    <div class="settings-section__actions">
      <el-button type="primary" :loading="exportingConfig" @click="onExportConfig">导出配置</el-button>
      <el-button :loading="importingConfig" @click="onImportConfig">导入配置</el-button>
    </div>

    <h3 class="settings-section__subtitle">任务数据</h3>
    <p class="settings-section__hint">
      导出全部未删除任务（含清单、标签、提醒等）；支持 JSON 备份与 Markdown 阅读。
      JSON 导入为合并模式：相同 id 的任务会更新，新 id 会新增。
    </p>
    <div class="settings-section__actions settings-section__actions--wrap">
      <el-button :loading="exportingTasksJson" @click="onExportTasksJson">导出任务 JSON</el-button>
      <el-button :loading="exportingTasksMd" @click="onExportTasksMarkdown">导出任务 Markdown</el-button>
      <el-button :loading="importingTasks" @click="onImportTasksJson">导入任务 JSON</el-button>
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
import { useTaskStore } from '@/stores/task-store'
import { useCategoryStore } from '@/stores/category-store'

const exportingConfig = ref(false)
const importingConfig = ref(false)
const exportingTasksJson = ref(false)
const exportingTasksMd = ref(false)
const importingTasks = ref(false)

const llmStore = useLlmStore()
const promptStore = useAiPromptStore()
const shortcutStore = useShortcutStore()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()

async function onExportConfig() {
  exportingConfig.value = true
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
    exportingConfig.value = false
  }
}

async function onImportConfig() {
  try {
    await ElMessageBox.confirm(
      '导入将覆盖当前快捷键、大模型与提示词设置，是否继续？',
      '导入配置',
      { type: 'warning', confirmButtonText: '继续导入', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  importingConfig.value = true
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
    importingConfig.value = false
  }
}

async function onExportTasksJson() {
  exportingTasksJson.value = true
  try {
    const path = unwrapIpc(await window.api.app.exportTasksJson())
    if (path) ElMessage.success(`任务 JSON 已导出至：${path}`)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    exportingTasksJson.value = false
  }
}

async function onExportTasksMarkdown() {
  exportingTasksMd.value = true
  try {
    const path = unwrapIpc(await window.api.app.exportTasksMarkdown())
    if (path) ElMessage.success(`任务 Markdown 已导出至：${path}`)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    exportingTasksMd.value = false
  }
}

async function onImportTasksJson() {
  try {
    await ElMessageBox.confirm(
      '导入将合并 JSON 中的任务与清单（相同 id 会更新），是否继续？',
      '导入任务',
      { type: 'warning', confirmButtonText: '继续导入', cancelButtonText: '取消' }
    )
  } catch {
    return
  }

  importingTasks.value = true
  try {
    const result = unwrapIpc(await window.api.app.importTasksJson())
    if (!result) return
    await Promise.all([
      categoryStore.load(),
      taskStore.load(),
      taskStore.refreshSidebarCounts()
    ])
    ElMessage.success(
      `导入完成：新增 ${result.importedTasks} 条，更新 ${result.updatedTasks} 条，清单 ${result.importedCategories} 条`
    )
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    importingTasks.value = false
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

.settings-section__subtitle {
  margin: 24px 0 8px;
  font-size: 15px;
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

  &--wrap {
    flex-wrap: wrap;
  }
}
</style>
