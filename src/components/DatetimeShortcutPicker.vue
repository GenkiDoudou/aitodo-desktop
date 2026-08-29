<template>
  <div class="datetime-picker">
    <div class="datetime-picker__shortcuts">
      <el-button
        v-for="item in shortcuts"
        :key="item.key"
        size="small"
        round
        :type="activeKey === item.key ? 'primary' : 'default'"
        @click="applyShortcut(item)"
      >
        {{ item.label }}
      </el-button>
      <el-button size="small" round :type="activeKey === 'custom' ? 'primary' : 'default'" @click="openCustom">
        自定义
      </el-button>
      <el-button v-if="modelValue" size="small" text type="info" @click="clear">清除</el-button>
    </div>

    <p v-if="modelValue" class="datetime-picker__summary">
      {{ formatIsoReadable(modelValue) }}
    </p>

    <!-- 使用居中 Dialog 替代 Popover，避免在 Drawer 内被裁切/遮挡 -->
    <el-dialog
      v-model="customOpen"
      :title="dialogTitle"
      width="340px"
      append-to-body
      align-center
      destroy-on-close
      modal-class="schedule-picker-overlay"
      class="schedule-picker-dialog"
      @open="onCustomShow"
    >
      <RemindOffsetPanel
        v-if="customPanel === 'remind-offset' && dueAt"
        :due-at="dueAt"
        :initial-iso="modelValue"
        @confirm="onPanelConfirm"
        @clear="onPanelClear"
        @custom="cameFromRemindOffset = true; customPanel = 'datetime'"
      />
      <SchedulePickerPanel
        v-else
        :key="pickerSession"
        :initial-iso="draftIso"
        :show-back="cameFromRemindOffset"
        @confirm="onPanelConfirm"
        @clear="onPanelClear"
        @back="customPanel = 'remind-offset'; cameFromRemindOffset = false"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  formatIsoReadable,
  isoAt,
  nextMondayMorning,
  nextWeekendEvening
} from '@/utils/datetime'
import dayjs from 'dayjs'
import SchedulePickerPanel from '@/components/SchedulePickerPanel.vue'
import RemindOffsetPanel from '@/components/RemindOffsetPanel.vue'

export interface DatetimeShortcut {
  key: string
  label: string
  value: () => string
}

const props = withDefaults(
  defineProps<{
    shortcuts?: DatetimeShortcut[]
    pickerMode?: 'datetime' | 'remind-offset'
    dueAt?: string | null
    dialogTitle?: string
  }>(),
  {
    shortcuts: undefined,
    pickerMode: 'datetime',
    dueAt: null,
    dialogTitle: '选择时间'
  }
)

const modelValue = defineModel<string | null>({ default: null })

const defaultShortcuts: DatetimeShortcut[] = [
  {
    key: 'today18',
    label: '今天 18:00',
    value: () => isoAt(dayjs().hour(18).minute(0).second(0))
  },
  {
    key: 'tomorrow9',
    label: '明天 09:00',
    value: () => isoAt(dayjs().add(1, 'day').hour(9).minute(0).second(0))
  },
  {
    key: 'weekend',
    label: '本周末',
    value: () => nextWeekendEvening()
  },
  {
    key: 'nextMon',
    label: '下周一 09:00',
    value: () => nextMondayMorning()
  }
]

const shortcuts = props.shortcuts ?? defaultShortcuts

const customOpen = ref(false)
const activeKey = ref<string | null>(null)
const customPanel = ref<'remind-offset' | 'datetime'>('datetime')
const draftIso = ref<string | null>(null)
const pickerSession = ref(0)
const cameFromRemindOffset = ref(false)

watch(
  () => modelValue.value,
  (v) => {
    if (!v) {
      activeKey.value = null
      return
    }
    const matched = shortcuts.find((s) => s.value() === v)
    activeKey.value = matched?.key ?? 'custom'
  },
  { immediate: true }
)

function openCustom() {
  customOpen.value = true
}

function onCustomShow() {
  draftIso.value = modelValue.value
  pickerSession.value += 1
  cameFromRemindOffset.value = false
  if (props.pickerMode === 'remind-offset' && props.dueAt) {
    customPanel.value = 'remind-offset'
  } else {
    customPanel.value = 'datetime'
  }
}

function applyShortcut(item: DatetimeShortcut) {
  modelValue.value = item.value()
  activeKey.value = item.key
  customOpen.value = false
}

function onPanelConfirm(iso: string) {
  modelValue.value = iso
  activeKey.value = 'custom'
  customOpen.value = false
}

function onPanelClear() {
  clear()
}

function clear() {
  modelValue.value = null
  activeKey.value = null
  customOpen.value = false
}
</script>

<style scoped lang="scss">
.datetime-picker__shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.datetime-picker__summary {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-color-primary);
  font-weight: 500;
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
