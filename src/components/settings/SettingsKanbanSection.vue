<template>
  <section class="settings-section">
    <h2 class="settings-section__title">看板</h2>
    <p class="settings-section__hint">
      配置看板默认模式与状态列名。在任务列表的看板视图中可随时切换「分组 / 状态」模式。
    </p>

    <div class="kanban-settings__card">
      <h3 class="kanban-settings__subtitle">默认看板模式</h3>
      <el-radio-group v-model="defaultMode">
        <el-radio value="group">分组看板（自定义列 + 已完成列）</el-radio>
        <el-radio value="status">状态看板（未开始 / 进行中 / 已完成）</el-radio>
      </el-radio-group>
    </div>

    <div class="kanban-settings__card">
      <h3 class="kanban-settings__subtitle">状态看板列名</h3>
      <p class="settings-section__hint">仅在「状态看板」模式下使用；拖动卡片会改变任务状态。</p>
      <div class="kanban-settings__labels">
        <el-form-item label="未开始">
          <el-input v-model="statusLabels.todo" maxlength="20" />
        </el-form-item>
        <el-form-item label="进行中">
          <el-input v-model="statusLabels.inProgress" maxlength="20" />
        </el-form-item>
        <el-form-item label="已完成">
          <el-input v-model="statusLabels.done" maxlength="20" />
        </el-form-item>
      </div>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { DEFAULT_KANBAN_STATUS_LABELS } from '@shared/kanban-config'
import { persistKanbanConfig, readKanbanConfig } from '@/utils/kanban-preferences'

const defaultMode = ref<KanbanBoardMode>('group')
const statusLabels = reactive({
  todo: DEFAULT_KANBAN_STATUS_LABELS.todo,
  inProgress: DEFAULT_KANBAN_STATUS_LABELS.inProgress,
  done: DEFAULT_KANBAN_STATUS_LABELS.done
})
const saving = ref(false)

function load() {
  const cfg = readKanbanConfig()
  defaultMode.value = cfg.defaultMode
  statusLabels.todo = cfg.statusColumnLabels.todo
  statusLabels.inProgress = cfg.statusColumnLabels.inProgress
  statusLabels.done = cfg.statusColumnLabels.done
}

function save() {
  saving.value = true
  try {
    const current = readKanbanConfig()
    persistKanbanConfig({
      ...current,
      defaultMode: defaultMode.value,
      statusColumnLabels: {
        todo: statusLabels.todo,
        inProgress: statusLabels.inProgress,
        done: statusLabels.done
      }
    })
    ElMessage.success('看板设置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(load)
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

.kanban-settings__card {
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  background: var(--desktop-panel);
}

.kanban-settings__subtitle {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.kanban-settings__labels {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}
</style>
