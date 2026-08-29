<template>
  <div class="cal-year">
    <button
      v-for="monthIndex in 12"
      :key="monthIndex"
      type="button"
      class="cal-year__month"
      :class="{ 'is-current': isCurrentMonth(monthIndex) }"
      @click="emit('select-month', monthIndex)"
    >
      <div class="cal-year__month-title">{{ monthIndex }}月</div>
      <div class="cal-year__weekdays">
        <span v-for="w in weekdayShort" :key="w" class="cal-year__weekday">{{ w }}</span>
      </div>
      <div class="cal-year__days">
        <span
          v-for="day in daysOfMonth(monthIndex)"
          :key="day.format('YYYY-MM-DD')"
          class="cal-year__day"
          :class="dayClass(day, monthIndex)"
          :title="dayTitle(day)"
        >
          {{ day.date() }}
        </span>
      </div>
      <div v-if="monthTaskCount(monthIndex) > 0" class="cal-year__count">
        {{ monthTaskCount(monthIndex) }} 项
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { taskDateKeyByField } from '@shared/calendar-tasks'
import { buildCalendarDays } from '@/utils/schedule-picker'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const emit = defineEmits<{
  'select-month': [month1to12: number]
}>()

const today = dayjs()
const weekdayShort = ['一', '二', '三', '四', '五', '六', '日']
const year = computed(() => props.anchor.year())

function monthAnchor(month1to12: number) {
  return dayjs(`${year.value}-${String(month1to12).padStart(2, '0')}-01`)
}

function daysOfMonth(month1to12: number) {
  return buildCalendarDays(monthAnchor(month1to12))
}

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}

function isCurrentMonth(month1to12: number) {
  return today.year() === year.value && today.month() + 1 === month1to12
}

function dayClass(day: dayjs.Dayjs, month1to12: number) {
  const mark = holidayOf(day)
  const anchor = monthAnchor(month1to12)
  const inMonth = day.year() === anchor.year() && day.month() === anchor.month()
  return {
    'is-other-month': !inMonth,
    'is-today': day.isSame(today, 'day'),
    'is-weekend': inMonth && (day.day() === 0 || day.day() === 6),
    'is-holiday': inMonth && mark?.kind === 'holiday',
    'is-makeup': inMonth && mark?.kind === 'workday',
    'has-task': inMonth && tasksOnDay(day).length > 0
  }
}

function dayTitle(day: dayjs.Dayjs) {
  const mark = holidayOf(day)
  const count = tasksOnDay(day).length
  const parts = [day.format('YYYY-MM-DD')]
  if (mark?.name) parts.push(mark.name)
  if (count) parts.push(`${count} 项任务`)
  return parts.join(' · ')
}

function tasksOnDay(day: dayjs.Dayjs) {
  const key = day.format('YYYY-MM-DD')
  return props.tasks.filter((t) => taskDateKeyByField(t, props.dateField ?? 'dueAt') === key)
}

function monthTaskCount(month1to12: number) {
  const start = monthAnchor(month1to12)
  const end = start.endOf('month')
  let count = 0
  for (const task of props.tasks) {
    const key = taskDateKeyByField(task, props.dateField ?? 'dueAt')
    if (!key) continue
    const d = dayjs(key)
    if (!d.isBefore(start, 'day') && !d.isAfter(end, 'day')) count += 1
  }
  return count
}
</script>

<style scoped lang="scss">
.cal-year {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.cal-year__month {
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: var(--desktop-panel);
  padding: 10px;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-current {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 25%, transparent);
  }
}

.cal-year__month-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.cal-year__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.cal-year__weekday {
  font-size: 10px;
  color: var(--desktop-muted);
  text-align: center;
}

.cal-year__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-year__day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  border-radius: 6px;
  color: var(--desktop-text);

  &.is-other-month {
    opacity: 0.25;
  }

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    font-weight: 600;
  }

  &.is-weekend:not(.is-today) {
    color: #e6a23c;
  }

  &.is-holiday:not(.is-today) {
    background: rgba(245, 108, 108, 0.12);
  }

  &.is-makeup:not(.is-today) {
    background: rgba(103, 194, 58, 0.12);
  }

  &.has-task:not(.is-today) {
    font-weight: 600;
  }
}

.cal-year__count {
  margin-top: 6px;
  font-size: 11px;
  color: var(--desktop-muted);
}
</style>
