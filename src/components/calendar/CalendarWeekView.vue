<template>
  <div class="cal-week">
    <div class="cal-week__head">
      <div class="cal-week__time-gutter" />
      <div
        v-for="day in weekDays"
        :key="day.format('YYYY-MM-DD')"
        class="cal-week__head-cell"
        :class="{ 'is-today': day.isSame(today, 'day') }"
      >
        <span class="cal-week__weekday">{{ weekdayLabel(day) }}</span>
        <div class="cal-week__date-row">
          <span class="cal-week__date" :class="{ 'is-today': day.isSame(today, 'day') }">
            {{ day.date() }}
          </span>
          <span
            v-if="holidayOf(day)"
            class="cal-week__mark"
            :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
            :title="holidayOf(day)!.name"
          >
            {{ holidayOf(day)!.kind === 'holiday' ? '休' : '班' }}
          </span>
        </div>
      </div>
    </div>
    <div class="cal-week__body" ref="bodyRef">
      <div class="cal-week__time-col">
        <div v-for="h in hours" :key="h" class="cal-week__hour-label">{{ h }}:00</div>
      </div>
      <div class="cal-week__grid">
        <div v-for="day in weekDays" :key="day.format('YYYY-MM-DD')" class="cal-week__day-col">
          <div v-for="h in hours" :key="h" class="cal-week__slot" />
          <div
            v-for="task in tasksOnDay(day)"
            :key="calendarTaskRowKey(task, dateField ?? 'dueAt')"
            class="cal-week__event"
            :style="eventStyle(task)"
          >
            <CalendarTaskChip
              :task="task"
              :category-color="colorOf(task)"
              :show-time="true"
              @select="emit('select', $event)"
              @toggle-status="emit('toggle-status', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { calendarTaskRowKey, groupTasksByDateField, taskMinutesOnField, weekdayLabel } from '@shared/calendar-tasks'
import CalendarTaskChip from '@/components/calendar/CalendarTaskChip.vue'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

const today = dayjs()
const hours = Array.from({ length: 24 }, (_, i) => i)
const SLOT_H = 48

const weekDays = computed(() => {
  const start = props.anchor.startOf('week')
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
})

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'dueAt'))

function tasksOnDay(day: dayjs.Dayjs) {
  return byDate.value.get(day.format('YYYY-MM-DD')) ?? []
}

function colorOf(task: Task) {
  if (!task.categoryId) return null
  return props.categoryColorMap.get(task.categoryId) ?? null
}

function holidayOf(day: dayjs.Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}

function eventStyle(task: Task) {
  const top = (taskMinutesOnField(task, props.dateField ?? 'dueAt') / 60) * SLOT_H
  return { top: `${top}px`, minHeight: `${SLOT_H - 4}px` }
}
</script>

<style scoped lang="scss">
.cal-week {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
}

.cal-week__head {
  display: grid;
  grid-template-columns: 52px repeat(7, 1fr);
  border-bottom: 1px solid var(--desktop-border);
}

.cal-week__head-cell {
  padding: 8px 4px;
  text-align: center;
  border-left: 1px solid var(--desktop-border);

  &.is-today .cal-week__date.is-today {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
  }
}

.cal-week__weekday {
  display: block;
  font-size: 12px;
  color: var(--desktop-muted);
}

.cal-week__date-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
  min-height: 26px;
}

.cal-week__date {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 14px;
  font-weight: 600;
}

.cal-week__mark {
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

.cal-week__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 52px 1fr;
  overflow: auto;
}

.cal-week__time-col {
  border-right: 1px solid var(--desktop-border);
}

.cal-week__hour-label {
  height: 48px;
  font-size: 11px;
  color: var(--desktop-muted);
  text-align: right;
  padding-right: 6px;
  box-sizing: border-box;
}

.cal-week__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  position: relative;
}

.cal-week__day-col {
  position: relative;
  border-left: 1px solid var(--desktop-border);
  min-height: calc(48px * 24);
}

.cal-week__slot {
  height: 48px;
  border-bottom: 1px solid var(--desktop-border);
  box-sizing: border-box;
}

.cal-week__event {
  position: absolute;
  left: 2px;
  right: 2px;
  z-index: 1;
}
</style>
