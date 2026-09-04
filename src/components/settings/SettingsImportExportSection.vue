<template>
  <!--
    导入导出：贴 preview.html 双栏导出/导入 + 第三方导入。
    真实：Todo Backup(配置)/JSON/Markdown 导出导入；第三方仅 Toast。
  -->
  <section class="settings-section">
    <div class="settings-import-grid">
      <div class="settings-panel">
        <h2 class="settings-panel__title">导出数据</h2>
        <div class="settings-panel__body">
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">Todo Backup</div>
              <div class="settings-row__label-desc">个人配置备份（快捷键、大模型、提示词与界面偏好）</div>
            </div>
            <div class="settings-row__control">
              <el-button type="primary" :loading="exportingConfig" @click="onExportConfig">
                导出
              </el-button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">JSON</div>
              <div class="settings-row__label-desc">适合开发者和数据迁移（全部任务）</div>
            </div>
            <div class="settings-row__control">
              <el-button :loading="exportingTasksJson" @click="onExportTasksJson">导出</el-button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">Markdown</div>
              <div class="settings-row__label-desc">适合阅读与归档</div>
            </div>
            <div class="settings-row__control">
              <el-button :loading="exportingTasksMd" @click="onExportTasksMarkdown">导出</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-panel">
        <h2 class="settings-panel__title">导入数据</h2>
        <div class="settings-panel__body">
          <button
            type="button"
            class="settings-dropbox"
            :disabled="importingConfig || importingTasks"
            @click="onImportPick"
          >
            <span>点击选择文件</span>
            <span class="settings-dropbox__muted">支持 Todo Backup / JSON</span>
          </button>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">导入配置</div>
              <div class="settings-row__label-desc">覆盖快捷键、大模型与提示词</div>
            </div>
            <div class="settings-row__control">
              <el-button :loading="importingConfig" @click="onImportConfig">导入配置</el-button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">导入任务 JSON</div>
              <div class="settings-row__label-desc">合并模式：同 id 更新，新 id 新增</div>
            </div>
            <div class="settings-row__control">
              <el-button :loading="importingTasks" @click="onImportTasksJson">导入任务</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">第三方导入</h2>
      <div class="settings-panel__body">
        <div v-for="name in thirdParties" :key="name" class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">{{ name }}</div>
          </div>
          <div class="settings-row__control">
            <el-button @click="onThirdParty(name)">导入</el-button>
          </div>
        </div>
      </div>
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

const thirdParties = ['Microsoft To Do', 'Todoist', '滴答清单']

const llmStore = useLlmStore()
const promptStore = useAiPromptStore()
const shortcutStore = useShortcutStore()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()

async function onExportConfig() {
  exportingConfig.value = true
  try {
    const path = unwrapIpc(await window.api.app.exportUserConfig(collectUiPreferences()))
    if (path) ElMessage.success(`配置已导出至：${path}`)
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
    await Promise.all([shortcutStore.load(), llmStore.load(), promptStore.load()])
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

function onImportPick() {
  void ElMessageBox.confirm('请选择导入类型', '导入数据', {
    distinguishCancelAndClose: true,
    confirmButtonText: '导入任务 JSON',
    cancelButtonText: '导入配置',
    type: 'info'
  })
    .then(() => onImportTasksJson())
    .catch((action) => {
      if (action === 'cancel') void onImportConfig()
    })
}

function onThirdParty(name: string) {
  ElMessage.info(`已进入「${name}」导入流程（即将支持）`)
}
</script>

<style scoped lang="scss">
.settings-dropbox__muted {
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
