<template>
  <div class="cal-day">
    <header class="cal-day__head">
      <span class="cal-day__weekday">{{ weekdayLabel(anchor) }}</span>
      <span class="cal-day__date" :class="{ 'is-today': anchor.isSame(today, 'day') }">
        {{ anchor.format('M月D日') }}
      </span>
      <span
        v-if="dayHoliday"
        class="cal-day__holiday-name"
        :class="dayHoliday.kind === 'holiday' ? 'is-off' : 'is-work'"
      >
        {{ dayHoliday.name }}
      </span>
      <span v-else-if="anchor.day() === 0 || anchor.day() === 6" class="cal-day__hint is-rest">
        周末
      </span>
      <span v-else class="cal-day__hint">工作日</span>
    </header>
  </div>
</template>

<script setup lang="ts">
/**
 * 日视图头：仅展示日期/节假日；任务列表由日历页下方统一展示。
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { weekdayLabel } from '@shared/calendar-tasks'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const today = dayjs()
const dayHoliday = computed(() => props.holidayMarks?.[props.anchor.format('YYYY-MM-DD')])
</script>

<style scoped lang="scss">
.cal-day {
  flex-shrink: 0;
  padding: 0 16px 8px;
}

.cal-day__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  background: #fff;
}

.cal-day__weekday {
  font-size: 13px;
  color: var(--desktop-muted);
}

.cal-day__date {
  font-size: 18px;
  font-weight: 700;

  &.is-today {
    color: var(--el-color-primary);
  }
}

.cal-day__holiday-name {
  font-size: 13px;
  font-weight: 600;

  &.is-off {
    color: #c45656;
  }

  &.is-work {
    color: #2f6fed;
  }
}

.cal-day__hint {
  font-size: 12px;
  color: #c0c4cc;

  &.is-rest {
    color: #d3a4a4;
  }
}
</style>
