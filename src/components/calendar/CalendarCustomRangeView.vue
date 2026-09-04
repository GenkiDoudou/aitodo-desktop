<template>
  <div class="cal-custom">
    <div v-if="days.length === 0" class="cal-custom__empty">请选择开始与结束日期</div>
    <div v-else class="cal-custom__strip">
      <button
        v-for="day in days"
        :key="day.format('YYYY-MM-DD')"
        type="button"
        class="cal-custom__day"
        :class="{
          'is-selected': day.format('YYYY-MM-DD') === selectedDate,
          'is-today': day.isSame(today, 'day'),
          'is-holiday': holidayOf(day)?.kind === 'holiday',
          'is-makeup': holidayOf(day)?.kind === 'workday'
        }"
        @click="emit('select-day', day.format('YYYY-MM-DD'))"
      >
        <span class="cal-custom__day-date">{{ day.format('M/D') }}</span>
        <span class="cal-custom__day-wd">{{ weekdayShort(day) }}</span>
        <span
          v-if="holidayOf(day)"
          class="cal-custom__holiday-name"
          :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
        >
          {{ holidayOf(day)!.name }}
        </span>
        <span v-else-if="day.day() === 0 || day.day() === 6" class="cal-custom__hint is-rest">周末</span>
        <span v-else class="cal-custom__hint">工作日</span>
        <span v-if="taskCount(day) > 0" class="cal-custom__badge">{{ taskCount(day) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 自定义区间：仅日期条 + 节假日名；任务在日历页下方统一列表。
 */
import { computed } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { groupTasksByDateField } from '@shared/calendar-tasks'

const props = defineProps<{
  from: string
  to: string
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
const WD = ['日', '一', '二', '三', '四', '五', '六'] as const

const days = computed(() => {
  const start = dayjs(props.from.slice(0, 10))
  const end = dayjs(props.to.slice(0, 10))
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return [] as Dayjs[]
  const result: Dayjs[] = []
  let cursor = start.startOf('day')
  while (!cursor.isAfter(end, 'day')) {
    result.push(cursor)
    cursor = cursor.add(1, 'day')
  }
  return result
})

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'createdAt'))

function taskCount(day: Dayjs) {
  return (byDate.value.get(day.format('YYYY-MM-DD')) ?? []).length
}

function holidayOf(day: Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}

function weekdayShort(day: Dayjs) {
  return WD[day.day()]
}
</script>

<style scoped lang="scss">
.cal-custom {
  flex-shrink: 0;
  padding: 0 12px 8px;
}

.cal-custom__empty {
  padding: 24px;
  text-align: center;
  color: var(--desktop-muted);
}

.cal-custom__strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.cal-custom__day {
  flex: 0 0 96px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 96px;
  padding: 10px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;

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
}

.cal-custom__day-date {
  font-size: 16px;
  font-weight: 700;
}

.cal-custom__day-wd {
  font-size: 12px;
  color: var(--desktop-muted);
}

.cal-custom__holiday-name {
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

.cal-custom__hint {
  font-size: 11px;
  color: #c0c4cc;

  &.is-rest {
    color: #d3a4a4;
  }
}

.cal-custom__badge {
  margin-top: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #409eff;
  background: rgba(64, 158, 255, 0.14);
}
</style>
