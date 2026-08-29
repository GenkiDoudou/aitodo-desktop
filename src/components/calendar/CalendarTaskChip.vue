<template>
  <div
    class="cal-task"
    :class="{ 'is-done': task.status === 'DONE' }"
    :style="{
      background: colors.bg,
      borderColor: colors.border
    }"
    @click="emit('select', task.id)"
  >
    <el-checkbox
      :model-value="task.status === 'DONE'"
      class="cal-task__check"
      @click.stop
      @change="() => emit('toggle-status', task)"
    />
    <span class="cal-task__title">{{ task.title }}</span>
    <span v-if="timeLabel" class="cal-task__time">{{ timeLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@shared/types'
import { calendarTaskColors, formatTaskTimeHm } from '@shared/calendar-tasks'
import type { TaskDateField } from '@shared/date-filter'

const props = defineProps<{
  task: Task
  categoryColor?: string | null
  showTime?: boolean
  /** 展示哪一列时间，默认到期时间 */
  dateField?: TaskDateField
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

const colors = computed(() => calendarTaskColors(props.task, props.categoryColor))

const timeLabel = computed(() =>
  props.showTime === false ? '' : formatTaskTimeHm(props.task, props.dateField ?? 'dueAt')
)
</script>

<style scoped lang="scss">
.cal-task {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  font-size: 12px;
  cursor: pointer;
  overflow: hidden;

  &:hover {
    filter: brightness(0.97);
  }

  &.is-done {
    opacity: 0.65;

    .cal-task__title {
      text-decoration: line-through;
    }
  }
}

.cal-task__check {
  flex-shrink: 0;
  height: auto;

  :deep(.el-checkbox__inner) {
    width: 14px;
    height: 14px;
  }
}

.cal-task__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-task__time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--desktop-muted);
}
</style>
