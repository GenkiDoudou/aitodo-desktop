<template>
  <span
    class="priority-badge"
    :class="`is-p${meta.value}`"
    :title="`${meta.code} · ${meta.label}`"
  >
    {{ meta.code }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTaskPriorityMeta, type TaskPriority } from '@shared/task-priority'

const props = defineProps<{
  priority: TaskPriority
}>()

const meta = computed(() => getTaskPriorityMeta(props.priority))
</script>

<style scoped lang="scss">
.priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 28px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: transparent;
  border: 1.5px solid;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;

  &.is-p1 {
    color: #f56c6c;
    border-color: #f3a6a6;
  }

  &.is-p2 {
    color: #e6a23c;
    border-color: #f0c78a;
  }

  &.is-p3 {
    color: #409eff;
    border-color: #a0cfff;
  }

  &.is-p4 {
    color: #909399;
    border-color: #d3d4d6;
  }
}
</style>
