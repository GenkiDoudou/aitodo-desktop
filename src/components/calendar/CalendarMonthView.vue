<template>
  <div class="cal-month">
    <div class="cal-month__weekdays">
      <span
        v-for="w in weekdays"
        :key="w.label"
        class="cal-month__weekday"
        :class="{ 'is-weekend': w.weekend }"
      >
        {{ w.label }}
      </span>
    </div>
    <div class="cal-month__grid">
      <button
        v-for="day in days"
        :key="day.format('YYYY-MM-DD')"
        type="button"
        class="cal-month__cell"
        :class="{
          'is-other-month': !day.isSame(anchorMonth, 'month'),
          'is-today': day.isSame(today, 'day'),
          'is-selected': day.format('YYYY-MM-DD') === selectedDate,
          'is-weekend': day.day() === 0 || day.day() === 6,
          'is-holiday': holidayOf(day)?.kind === 'holiday',
          'is-makeup': holidayOf(day)?.kind === 'workday'
        }"
        @click="emit('select-day', day.format('YYYY-MM-DD'))"
      >
        <div class="cal-month__date">
          <span class="cal-month__date-num" :class="{ 'is-today': day.isSame(today, 'day') }">
            {{ day.date() }}
          </span>
          <span v-if="taskCount(day) > 0" class="cal-month__badge">{{ taskCount(day) }}</span>
        </div>
        <span
          v-if="holidayOf(day)"
          class="cal-month__holiday-name"
          :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
          :title="holidayOf(day)!.name"
        >
          {{ holidayOf(day)!.name }}
        </span>
        <span v-else-if="day.day() === 0 || day.day() === 6" class="cal-month__workday-hint is-rest">
          周末
        </span>
        <span v-else class="cal-month__workday-hint">工作日</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 月历格子：不内嵌任务列表（任务在日历页下方统一展示），仅选中日期 + 节假日名称。
 */
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { groupTasksByDateField } from '@shared/calendar-tasks'
import { buildCalendarDays } from '@/utils/schedule-picker'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
  /** 当前选中日期 YYYY-MM-DD */
  selectedDate?: string
}>()

const emit = defineEmits<{
  'select-day': [string]
}>()

const today = dayjs()
const anchorMonth = computed(() => props.anchor.startOf('month'))
const days = computed(() => buildCalendarDays(anchorMonth.value))
/** 周一至周日，周末弱化样式 */
const weekdays = [
  { label: '一', weekend: false },
  { label: '二', weekend: false },
  { label: '三', weekend: false },
  { label: '四', weekend: false },
  { label: '五', weekend: false },
  { label: '六', weekend: true },
  { label: '日', weekend: true }
]

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'createdAt'))

function taskCount(day: dayjs.Dayjs) {
  return (byDate.value.get(day.format('YYYY-MM-DD')) ?? []).length
}

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}
</script>

<style scoped lang="scss">
.cal-month {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 12px 8px;
}

.cal-month__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  padding: 8px 0;
  border-bottom: 1px solid var(--desktop-border);
}

.cal-month__weekday {
  text-align: center;
  font-size: 13px;
  color: var(--desktop-muted);
  font-weight: 500;

  &.is-weekend {
    color: #c0c4cc;
  }
}

.cal-month__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(72px, 1fr);
  overflow: auto;
}

.cal-month__cell {
  border-right: 1px solid var(--desktop-border);
  border-bottom: 1px solid var(--desktop-border);
  border-left: none;
  border-top: none;
  padding: 6px 6px 8px;
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  background: #fff;
  cursor: pointer;
  text-align: left;

  &:nth-child(7n) {
    border-right: none;
  }

  &:hover {
    background: rgba(64, 158, 255, 0.04);
  }

  &.is-other-month {
    background: #fafafa;

    .cal-month__date-num {
      color: var(--desktop-muted);
    }
  }

  &.is-weekend:not(.is-other-month):not(.is-holiday):not(.is-makeup) {
    background: #fafbfc;
  }

  &.is-holiday:not(.is-other-month) {
    background: rgba(245, 108, 108, 0.06);
  }

  &.is-makeup:not(.is-other-month) {
    background: rgba(64, 158, 255, 0.05);
  }

  &.is-selected {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
    z-index: 1;
  }
}

.cal-month__date {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  min-height: 24px;
}

.cal-month__date-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--desktop-text);

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
  }
}

.cal-month__badge {
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

.cal-month__holiday-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
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

.cal-month__workday-hint {
  font-size: 11px;
  color: #c0c4cc;

  &.is-rest {
    color: #d3a4a4;
  }
}
</style>
