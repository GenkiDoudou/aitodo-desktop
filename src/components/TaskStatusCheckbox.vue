<template>
  <el-checkbox
    :model-value="status === 'DONE'"
    :indeterminate="status === 'IN_PROGRESS'"
    :title="checkboxTitle"
    @click.stop
    @change="emit('toggle')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@shared/types'
import { taskStatusLabel } from '@shared/task-status-cycle'

const props = defineProps<{
  status: TaskStatus
}>()

const emit = defineEmits<{
  toggle: []
}>()

/** 悬停提示当前态；点击由父级按三态循环写入下一态 */
const checkboxTitle = computed(() => {
  const label = taskStatusLabel(props.status)
  return `${label}（点击切换）`
})
</script>
