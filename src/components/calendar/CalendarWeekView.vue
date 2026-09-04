<template>
  <div class="cal-week">
    <div class="cal-week__head">
      <button
        v-for="day in weekDays"
        :key="day.format('YYYY-MM-DD')"
        type="button"
        class="cal-week__head-cell"
        :class="{
          'is-today': day.isSame(today, 'day'),
          'is-selected': day.format('YYYY-MM-DD') === selectedDate,
          'is-weekend': day.day() === 0 || day.day() === 6,
          'is-holiday': holidayOf(day)?.kind === 'holiday',
          'is-makeup': holidayOf(day)?.kind === 'workday'
        }"
        @click="emit('select-day', day.format('YYYY-MM-DD'))"
      >
        <span class="cal-week__weekday">{{ weekdayLabel(day) }}</span>
        <span class="cal-week__date" :class="{ 'is-today': day.isSame(today, 'day') }">
          {{ day.date() }}
        </span>
        <span
          v-if="holidayOf(day)"
          class="cal-week__holiday-name"
          :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
          :title="holidayOf(day)!.name"
        >
          {{ holidayOf(day)!.name }}
        </span>
        <span v-else-if="day.day() === 0 || day.day() === 6" class="cal-week__hint is-rest">周末</span>
        <span v-else class="cal-week__hint">工作日</span>
        <span v-if="taskCount(day) > 0" class="cal-week__badge">{{ taskCount(day) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 周视图：仅日期头 + 节假日名；任务列表由日历页下方统一展示。
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { groupTasksByDateField, weekdayLabel } from '@shared/calendar-tasks'
import { startOfWeekMonday } from '@shared/smart-list'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
  selectedDate?: string
}>()

const emit = defineEmits<{
  'select-day': [string]
}>()

const today = dayjs()

const weekDays = computed(() => {
  const start = startOfWeekMonday(props.anchor)
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
})

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'createdAt'))

function taskCount(day: dayjs.Dayjs) {
  return (byDate.value.get(day.format('YYYY-MM-DD')) ?? []).length
}

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}
</script>

<style scoped lang="scss">
.cal-week {
  flex-shrink: 0;
  padding: 0 12px 8px;
}

.cal-week__head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.cal-week__head-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 88px;
  padding: 10px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;

  &:hover {
    border-color: rgba(64, 158, 255, 0.35);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }

  &.is-holiday {
    background: rgba(245, 108, 108, 0.06);
  }

  &.is-makeup {
    background: rgba(64, 158, 255, 0.05);
  }

  &.is-weekend:not(.is-holiday):not(.is-makeup) {
    background: #fafbfc;
  }
}

.cal-week__weekday {
  font-size: 12px;
  color: var(--desktop-muted);
}

.cal-week__date {
  font-size: 18px;
  font-weight: 700;
  color: var(--desktop-text);

  &.is-today {
    color: var(--el-color-primary);
  }
}

.cal-week__holiday-name {
  font-size: 11px;
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-off {
    color: #c45656;
  }

  &.is-work {
    color: #2f6fed;
  }
}

.cal-week__hint {
  font-size: 11px;
  color: #c0c4cc;

  &.is-rest {
    color: #d3a4a4;
  }
}

.cal-week__badge {
  margin-top: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #409eff;
  background: rgba(64, 158, 255, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
