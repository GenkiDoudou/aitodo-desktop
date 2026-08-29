<template>
  <section class="settings-section">
    <h2 class="settings-section__title">任务动态</h2>
    <p class="settings-section__hint">
      记录任务从创建到完成过程中的关键操作（不含字段差异）。保留策略对所有任务全局生效。
    </p>

    <div class="task-activity-settings__card">
      <h3 class="task-activity-settings__subtitle">保留策略</h3>
      <el-radio-group v-model="mode" class="task-activity-settings__modes">
        <el-radio value="forever">永久保留</el-radio>
        <el-radio value="max_count">最多保留 N 条</el-radio>
        <el-radio value="max_days">保留最近 N 天</el-radio>
      </el-radio-group>

      <div v-if="mode === 'max_count'" class="task-activity-settings__field">
        <span>最多保留</span>
        <el-input-number v-model="maxCount" :min="1" :max="100000" />
        <span>条</span>
      </div>
      <div v-else-if="mode === 'max_days'" class="task-activity-settings__field">
        <span>保留最近</span>
        <el-input-number v-model="maxDays" :min="1" :max="3650" />
        <span>天</span>
      </div>

      <div class="task-activity-settings__actions">
        <el-button type="primary" :loading="saving" @click="savePolicy">保存策略</el-button>
      </div>
    </div>

    <div class="task-activity-settings__card">
      <h3 class="task-activity-settings__subtitle">清理与删除</h3>
      <p class="settings-section__hint">
        当前共 {{ totalCount ?? '…' }} 条动态记录。
      </p>
      <div class="task-activity-settings__actions">
        <el-button :loading="purging" @click="onPurge">按策略立即清理</el-button>
        <el-button :loading="deletingTrashed" @click="onDeleteTrashed">
          删除垃圾桶任务的动态
        </el-button>
        <el-button type="danger" plain :loading="deletingAll" @click="onDeleteAll">
          删除全部动态
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TaskActivityRetentionMode, TaskActivityRetentionPolicy } from '@shared/types'
import {
  DEFAULT_TASK_ACTIVITY_MAX_COUNT,
  DEFAULT_TASK_ACTIVITY_MAX_DAYS
} from '@shared/task-activity-retention'
import { unwrapIpc } from '@/ipc/client'

const mode = ref<TaskActivityRetentionMode>('forever')
const maxCount = ref(DEFAULT_TASK_ACTIVITY_MAX_COUNT)
const maxDays = ref(DEFAULT_TASK_ACTIVITY_MAX_DAYS)
const totalCount = ref<number | null>(null)
const saving = ref(false)
const purging = ref(false)
const deletingAll = ref(false)
const deletingTrashed = ref(false)

function applyPolicy(policy: TaskActivityRetentionPolicy) {
  mode.value = policy.mode
  if (policy.maxCount) maxCount.value = policy.maxCount
  if (policy.maxDays) maxDays.value = policy.maxDays
}

function buildPolicy(): TaskActivityRetentionPolicy {
  if (mode.value === 'max_count') {
    return { mode: 'max_count', maxCount: maxCount.value }
  }
  if (mode.value === 'max_days') {
    return { mode: 'max_days', maxDays: maxDays.value }
  }
  return { mode: 'forever' }
}

async function refreshCount() {
  try {
    totalCount.value = unwrapIpc(await window.api.taskActivities.count())
  } catch {
    totalCount.value = null
  }
}

async function load() {
  try {
    applyPolicy(unwrapIpc(await window.api.taskActivities.getRetention()))
  } catch {
    /* unwrapIpc 已 Toast */
  }
  await refreshCount()
}

async function savePolicy() {
  saving.value = true
  try {
    applyPolicy(unwrapIpc(await window.api.taskActivities.setRetention(buildPolicy())))
    ElMessage.success('保留策略已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

async function onPurge() {
  purging.value = true
  try {
    const removed = unwrapIpc(await window.api.taskActivities.purge())
    ElMessage.success(removed > 0 ? `已清理 ${removed} 条动态` : '无需清理')
    await refreshCount()
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    purging.value = false
  }
}

async function onDeleteTrashed() {
  try {
    await ElMessageBox.confirm(
      '将删除所有仍在垃圾桶中的任务所关联的动态记录，是否继续？',
      '删除垃圾桶任务动态',
      { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  deletingTrashed.value = true
  try {
    const removed = unwrapIpc(await window.api.taskActivities.deleteTrashed())
    ElMessage.success(removed > 0 ? `已删除 ${removed} 条动态` : '没有可删除的记录')
    await refreshCount()
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    deletingTrashed.value = false
  }
}

async function onDeleteAll() {
  try {
    await ElMessageBox.confirm(
      '将永久删除全部任务动态，且不可恢复。是否继续？',
      '删除全部动态',
      { type: 'error', confirmButtonText: '全部删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  deletingAll.value = true
  try {
    const removed = unwrapIpc(await window.api.taskActivities.deleteAll())
    ElMessage.success(`已删除 ${removed} 条动态`)
    await refreshCount()
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    deletingAll.value = false
  }
}

onMounted(() => {
  void load()
})
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

.task-activity-settings__card {
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  background: var(--desktop-panel);
}

.task-activity-settings__subtitle {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.task-activity-settings__modes {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.task-activity-settings__field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
}

.task-activity-settings__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
</style>
