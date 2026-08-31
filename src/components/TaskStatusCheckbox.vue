<template>
  <!--
    任务三态圆圈（对齐 quick-h5 TaskListCard）：
    待办 = 空圈；进行中 = 左半蓝填充；已完成 = 绿实心 + 内白环。
    点击由父级按 待办→进行中→已完成→待办 循环写入。
  -->
  <button
    type="button"
    class="task-status-check"
    :class="{
      'is-progress': status === 'IN_PROGRESS',
      'is-done': status === 'DONE'
    }"
    :title="checkboxTitle"
    :aria-label="checkboxTitle"
    @click.stop="emit('toggle')"
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

/** 悬停 / 无障碍：展示当前态，并提示可点击切换 */
const checkboxTitle = computed(() => {
  const label = taskStatusLabel(props.status)
  return `${label}（点击切换）`
})
</script>

<style scoped>
.task-status-check {
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0;
  flex-shrink: 0;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
  box-sizing: border-box;
  background: transparent;
  cursor: pointer;
  vertical-align: middle;
}

.task-status-check:hover {
  border-color: #94a3b8;
}

.task-status-check.is-progress {
  border-color: #3b82f6;
  /* 左半实心蓝、右半透明 = 「进行中」半圆 */
  background: linear-gradient(90deg, #3b82f6 50%, transparent 50%);
}

.task-status-check.is-progress:hover {
  border-color: #2563eb;
}

.task-status-check.is-done {
  /* 对齐 H5 --qb-primary：绿实心 + inset 白环，视觉为「全圆完成」 */
  border-color: #059669;
  background: #059669;
  box-shadow: inset 0 0 0 3px #fff;
}

.task-status-check.is-done:hover {
  border-color: #047857;
  background: #047857;
}
</style>
