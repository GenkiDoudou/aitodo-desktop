<template>
  <div class="remind-multi-picker">
    <div class="remind-multi-picker__trigger-row">
      <el-button size="small" round @click="openDialog">设置提醒</el-button>
      <el-button v-if="hasReminders" size="small" text type="info" @click="clearAll">清除</el-button>
    </div>

    <ul v-if="summaryLines.length" class="remind-multi-picker__summary">
      <li v-for="(line, i) in summaryLines" :key="i">{{ line }}</li>
    </ul>
    <p v-if="modelContinuous" class="remind-multi-picker__continuous-tag">持续提醒已开启</p>

    <el-dialog
      v-model="dialogOpen"
      title="提醒"
      width="340px"
      append-to-body
      align-center
      destroy-on-close
      modal-class="schedule-picker-overlay"
      class="schedule-picker-dialog"
      @open="onDialogOpen"
    >
      <RemindMultiOffsetPanel
        v-if="dueAt"
        :due-at="dueAt"
        :initial-minutes="draftMinutes"
        :initial-continuous="draftContinuous"
        @confirm="onOffsetConfirm"
        @cancel="dialogOpen = false"
      />
      <SchedulePickerPanel
        v-else
        :key="pickerSession"
        :initial-iso="draftAbsolute"
        @confirm="onAbsoluteConfirm"
        @clear="clearAll"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  REMIND_OFFSET_PRESETS,
  buildRemindersFromOffsets,
  type TaskReminderInput
} from '@shared/task-reminder'
import { formatIsoReadable } from '@/utils/datetime'
import RemindMultiOffsetPanel from '@/components/RemindMultiOffsetPanel.vue'
import SchedulePickerPanel from '@/components/SchedulePickerPanel.vue'

export interface RemindMultiPickerValue {
  reminders: TaskReminderInput[]
  continuous: boolean
}

const props = defineProps<{
  dueAt: string | null
}>()

const modelValue = defineModel<RemindMultiPickerValue>({
  default: () => ({ reminders: [], continuous: false })
})

const dialogOpen = ref(false)
const draftMinutes = ref<number[]>([])
const draftContinuous = ref(false)
const draftAbsolute = ref<string | null>(null)
const pickerSession = ref(0)

const hasReminders = computed(() => modelValue.value.reminders.length > 0)
const modelContinuous = computed(() => modelValue.value.continuous)

const summaryLines = computed(() => {
  if (!props.dueAt) {
    return modelValue.value.reminders.map((r) => formatIsoReadable(r.remindAt))
  }
  const presetMap = new Map(REMIND_OFFSET_PRESETS.map((p) => [p.minutes, p.label]))
  return modelValue.value.reminders.map((r) => {
    if (r.offsetMinutes != null && presetMap.has(r.offsetMinutes)) {
      return presetMap.get(r.offsetMinutes)!
    }
    if (r.offsetMinutes != null) {
      return `提前 ${r.offsetMinutes} 分钟`
    }
    return formatIsoReadable(r.remindAt)
  })
})

watch(
  () => props.dueAt,
  (due, prev) => {
    if (due !== prev && prev != null) {
      // 截止变更后由父级或保存时重算；此处清空相对偏移避免错位
      if (modelValue.value.reminders.some((r) => r.offsetMinutes != null)) {
        modelValue.value = { ...modelValue.value, reminders: [] }
      }
    }
  }
)

function openDialog() {
  dialogOpen.value = true
}

function onDialogOpen() {
  if (props.dueAt) {
    draftMinutes.value = modelValue.value.reminders
      .map((r) => r.offsetMinutes)
      .filter((m): m is number => m != null)
    draftContinuous.value = modelValue.value.continuous
  } else {
    draftAbsolute.value = modelValue.value.reminders[0]?.remindAt ?? null
    pickerSession.value += 1
  }
}

function onOffsetConfirm(minutes: number[], continuous: boolean) {
  if (!props.dueAt) return
  const reminders = buildRemindersFromOffsets(props.dueAt, minutes)
  modelValue.value = { reminders, continuous }
  dialogOpen.value = false
}

function onAbsoluteConfirm(iso: string) {
  modelValue.value = {
    reminders: [{ remindAt: iso, offsetMinutes: null }],
    continuous: modelValue.value.continuous
  }
  dialogOpen.value = false
}

function clearAll() {
  modelValue.value = { reminders: [], continuous: false }
  dialogOpen.value = false
}
</script>

<style scoped lang="scss">
.remind-multi-picker__trigger-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.remind-multi-picker__summary {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 500;
  line-height: 1.5;
}

.remind-multi-picker__continuous-tag {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>

<style lang="scss">
.schedule-picker-overlay {
  z-index: 5200 !important;
}

.schedule-picker-dialog {
  .el-dialog__header {
    padding-bottom: 8px;
    margin-right: 0;
  }

  .el-dialog__body {
    padding: 8px 16px 16px;
  }

  .el-dialog__title {
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
