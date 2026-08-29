<template>
  <div class="task-recurrence-picker">
    <el-dropdown trigger="click" :hide-on-click="true" @command="onCommand">
      <button type="button" class="task-recurrence-picker__trigger">
        <el-icon class="task-recurrence-picker__icon"><Refresh /></el-icon>
        <span>{{ displayLabel }}</span>
        <el-icon class="task-recurrence-picker__arrow"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu class="task-recurrence-picker__menu">
          <el-dropdown-item command="daily">每天</el-dropdown-item>
          <el-dropdown-item :command="'weekly'">{{ weeklyLabel }}</el-dropdown-item>
          <el-dropdown-item :command="'monthly'">{{ monthlyLabel }}</el-dropdown-item>
          <el-dropdown-item :command="'yearly'">{{ yearlyLabel }}</el-dropdown-item>
          <el-dropdown-item command="workdays">工作日</el-dropdown-item>
          <el-dropdown-item command="weekend">每周末</el-dropdown-item>
          <el-dropdown-item command="legal_holidays">法定节假日</el-dropdown-item>
          <el-dropdown-item command="custom">自定义</el-dropdown-item>
          <el-dropdown-item divided command="none">不重复</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-dialog
      v-model="customDialogVisible"
      title="自定义重复"
      width="360px"
      append-to-body
      :close-on-click-modal="false"
      destroy-on-close
      @closed="onCustomDialogClosed"
    >
      <TaskRecurrenceCustomPanel
        :due-at="dueAt"
        :initial="modelValue"
        @confirm="onCustomConfirm"
        @cancel="customDialogVisible = false"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  recurrenceLabel,
  type RecurrenceType,
  type TaskRecurrenceRule
} from '@shared/task-reminder'
import TaskRecurrenceCustomPanel from './TaskRecurrenceCustomPanel.vue'

const props = defineProps<{
  dueAt?: string | null
}>()

const modelValue = defineModel<TaskRecurrenceRule | null>({ default: null })

const customDialogVisible = ref(false)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const base = computed(() => (props.dueAt ? dayjs(props.dueAt) : dayjs()))

const weeklyLabel = computed(() => `每周（周${weekdays[base.value.day()]}）`)
const monthlyLabel = computed(() => `每月（${base.value.date()}日）`)
const yearlyLabel = computed(() => `每年（${base.value.month() + 1}月${base.value.date()}日）`)

const displayLabel = computed(() => recurrenceLabel(modelValue.value, props.dueAt))

function onCommand(cmd: string) {
  if (cmd === 'none') {
    modelValue.value = null
    return
  }
  if (cmd === 'custom') {
    customDialogVisible.value = true
    return
  }
  if (cmd === 'workdays') {
    modelValue.value = { type: 'workdays' }
    return
  }
  if (cmd === 'weekend') {
    modelValue.value = { type: 'weekend' }
    return
  }
  modelValue.value = { type: cmd as RecurrenceType }
}

function onCustomConfirm(rule: TaskRecurrenceRule) {
  modelValue.value = rule
  customDialogVisible.value = false
}

function onCustomDialogClosed() {
  /* destroy-on-close 已重置子面板状态 */
}
</script>

<style scoped lang="scss">
.task-recurrence-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }
}

.task-recurrence-picker__icon {
  font-size: 14px;
  color: var(--desktop-muted);
}

.task-recurrence-picker__arrow {
  font-size: 12px;
  color: var(--desktop-muted);
  margin-left: auto;
}
</style>
