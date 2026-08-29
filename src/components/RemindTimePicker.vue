<template>
  <DatetimeShortcutPicker
    v-model="modelValue"
    :shortcuts="visibleShortcuts"
    :picker-mode="dueAt ? 'remind-offset' : 'datetime'"
    :due-at="dueAt"
    dialog-title="选择提醒时间"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import DatetimeShortcutPicker, { type DatetimeShortcut } from '@/components/DatetimeShortcutPicker.vue'
import { isoAt } from '@/utils/datetime'

const props = defineProps<{
  dueAt: string | null
}>()

const modelValue = defineModel<string | null>({ default: null })

const relativeShortcuts = computed<DatetimeShortcut[]>(() => {
  if (!props.dueAt) return []
  const due = dayjs(props.dueAt)
  if (!due.isValid()) return []
  return [
    { key: 'atDue', label: '到期时', value: () => props.dueAt! },
    { key: 'm15', label: '提前 15 分', value: () => isoAt(due.subtract(15, 'minute')) },
    { key: 'h1', label: '提前 1 小时', value: () => isoAt(due.subtract(1, 'hour')) },
    { key: 'd1', label: '提前 1 天', value: () => isoAt(due.subtract(1, 'day')) }
  ]
})

const absoluteShortcuts: DatetimeShortcut[] = [
  { key: 'h1later', label: '1 小时后', value: () => isoAt(dayjs().add(1, 'hour')) },
  {
    key: 'tonight20',
    label: '今晚 20:00',
    value: () => {
      const t = dayjs().hour(20).minute(0).second(0)
      return isoAt(t.isBefore(dayjs()) ? t.add(1, 'day') : t)
    }
  },
  {
    key: 'tomorrow9',
    label: '明天 09:00',
    value: () => isoAt(dayjs().add(1, 'day').hour(9).minute(0).second(0))
  }
]

const visibleShortcuts = computed(() =>
  props.dueAt ? relativeShortcuts.value : absoluteShortcuts
)
</script>
