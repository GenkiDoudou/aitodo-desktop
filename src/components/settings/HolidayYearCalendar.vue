<template>
  <div class="holiday-year">
    <button
      v-for="monthIndex in 12"
      :key="monthIndex"
      type="button"
      class="holiday-year__month"
      :class="{
        'is-current': isCurrentMonth(monthIndex),
        'is-selected': isSelectedMonth(monthIndex)
      }"
      @click="emit('select-month', monthIndex)"
    >
      <div class="holiday-year__month-title">{{ monthLabels[monthIndex - 1] }}</div>
      <div class="holiday-year__weekdays">
        <span v-for="w in weekdayShort" :key="w" class="holiday-year__weekday">{{ w }}</span>
      </div>
      <div class="holiday-year__days">
        <span
          v-for="day in daysOfMonth(monthIndex)"
          :key="day.format('YYYY-MM-DD')"
          class="holiday-year__day"
          :class="dayClass(day, monthIndex)"
          :title="dayTitle(day)"
        >
          {{ day.date() }}
        </span>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { buildCalendarDays } from '@/utils/schedule-picker'

const props = defineProps<{
  year: number
  selectedMonth?: number
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const emit = defineEmits<{
  'select-month': [month1to12: number]
}>()

const today = dayjs()
const weekdayShort = ['日', '一', '二', '三', '四', '五', '六']
const monthLabels = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月'
]

const yearAnchor = computed(() => dayjs(`${props.year}-01-01`))

function monthAnchor(month1to12: number) {
  return yearAnchor.value.month(month1to12 - 1).startOf('month')
}

function daysOfMonth(month1to12: number) {
  return buildCalendarDays(monthAnchor(month1to12))
}

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}

function isCurrentMonth(month1to12: number) {
  return today.year() === props.year && today.month() + 1 === month1to12
}

function isSelectedMonth(month1to12: number) {
  return props.selectedMonth === month1to12
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
    'is-makeup': inMonth && mark?.kind === 'workday'
  }
}

function dayTitle(day: dayjs.Dayjs) {
  const mark = holidayOf(day)
  if (!mark) return day.format('YYYY-MM-DD')
  return `${day.format('YYYY-MM-DD')} ${mark.name}`
}
</script>

<style scoped lang="scss">
.holiday-year {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 20px;
  padding: 8px 4px 16px;
}

.holiday-year__month {
  border: 1px solid transparent;
  background: transparent;
  border-radius: 10px;
  padding: 8px 10px 12px;
  text-align: left;
  cursor: pointer;
  color: inherit;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.06);
  }

  &.is-current:not(.is-selected) .holiday-year__month-title {
    color: var(--el-color-primary);
  }
}

.holiday-year__month-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.holiday-year__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 2px;
}

.holiday-year__weekday {
  text-align: center;
  font-size: 10px;
  color: var(--desktop-muted);
  line-height: 18px;
}

.holiday-year__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px 0;
}

.holiday-year__day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  font-size: 11px;
  border-radius: 4px;
  color: var(--desktop-text);

  &.is-other-month {
    color: var(--desktop-muted);
    opacity: 0.45;
  }

  &.is-weekend:not(.is-other-month):not(.is-holiday):not(.is-makeup) {
    background: rgba(0, 0, 0, 0.03);
  }

  &.is-holiday:not(.is-other-month) {
    background: rgba(196, 86, 86, 0.18);
    color: #c45656;
    font-weight: 600;
  }

  &.is-makeup:not(.is-other-month) {
    background: rgba(47, 111, 237, 0.14);
    color: #2f6fed;
    font-weight: 600;
  }

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    font-weight: 700;
  }
}
</style>
