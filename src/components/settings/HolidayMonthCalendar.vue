<template>
  <div class="holiday-month">
    <div class="holiday-month__weekdays">
      <span v-for="w in weekdays" :key="w" class="holiday-month__weekday">{{ w }}</span>
    </div>
    <div class="holiday-month__grid">
      <div
        v-for="day in days"
        :key="day.format('YYYY-MM-DD')"
        class="holiday-month__cell"
        :class="{
          'is-other-month': !day.isSame(anchorMonth, 'month'),
          'is-today': day.isSame(today, 'day'),
          'is-weekend': day.day() === 0 || day.day() === 6,
          'is-holiday': holidayOf(day)?.kind === 'holiday',
          'is-makeup': holidayOf(day)?.kind === 'workday'
        }"
      >
        <div class="holiday-month__date">
          <span class="holiday-month__date-num" :class="{ 'is-today': day.isSame(today, 'day') }">
            {{ day.date() }}
          </span>
          <span
            v-if="holidayOf(day)"
            class="holiday-month__mark"
            :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
            :title="holidayOf(day)!.name"
          >
            {{ holidayOf(day)!.kind === 'holiday' ? '休' : '班' }}
          </span>
        </div>
        <div
          v-if="holidayOf(day)?.name"
          class="holiday-month__name"
          :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
          :title="holidayOf(day)!.name"
        >
          {{ holidayOf(day)!.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { buildCalendarDays } from '@/utils/schedule-picker'

const props = defineProps<{
  anchor: dayjs.Dayjs
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const today = dayjs()
const anchorMonth = computed(() => props.anchor.startOf('month'))
const days = computed(() => buildCalendarDays(anchorMonth.value))
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}
</script>

<style scoped lang="scss">
.holiday-month {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--desktop-panel);
}

.holiday-month__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 0;
  border-bottom: 1px solid var(--desktop-border);
  background: var(--desktop-bg);
}

.holiday-month__weekday {
  text-align: center;
  font-size: 13px;
  color: var(--desktop-muted);
  font-weight: 500;
}

.holiday-month__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(72px, auto);
}

.holiday-month__cell {
  border-right: 1px solid var(--desktop-border);
  border-bottom: 1px solid var(--desktop-border);
  padding: 8px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &:nth-child(7n) {
    border-right: none;
  }

  &.is-other-month {
    background: #fafafa;

    .holiday-month__date-num,
    .holiday-month__name {
      color: var(--desktop-muted);
      opacity: 0.7;
    }
  }

  &.is-weekend:not(.is-other-month) {
    background: rgba(0, 0, 0, 0.015);
  }

  &.is-holiday:not(.is-other-month) {
    background: rgba(196, 86, 86, 0.06);
  }

  &.is-makeup:not(.is-other-month) {
    background: rgba(47, 111, 237, 0.05);
  }
}

.holiday-month__date {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 24px;
}

.holiday-month__date-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
  }
}

.holiday-month__mark {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;

  &.is-off {
    color: #c45656;
    background: rgba(196, 86, 86, 0.12);
  }

  &.is-work {
    color: #2f6fed;
    background: rgba(47, 111, 237, 0.12);
  }
}

.holiday-month__name {
  font-size: 11px;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;

  &.is-off {
    color: #c45656;
  }

  &.is-work {
    color: #2f6fed;
  }
}
</style>
