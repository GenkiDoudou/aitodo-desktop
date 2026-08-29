<template>
  <div class="cal-day">
    <header class="cal-day__head">
      <span class="cal-day__weekday">{{ weekdayLabel(anchor) }}</span>
      <span class="cal-day__date" :class="{ 'is-today': anchor.isSame(today, 'day') }">
        {{ anchor.date() }}
      </span>
      <span
        v-if="dayHoliday"
        class="cal-day__mark"
        :class="dayHoliday.kind === 'holiday' ? 'is-off' : 'is-work'"
        :title="dayHoliday.name"
      >
        {{ dayHoliday.kind === 'holiday' ? '休' : '班' }}
        <span class="cal-day__mark-name">{{ dayHoliday.name }}</span>
      </span>
    </header>
    <div class="cal-day__body">
      <div class="cal-day__time-col">
        <div v-for="h in hours" :key="h" class="cal-day__hour-label">{{ h }}:00</div>
      </div>
      <div class="cal-day__grid">
        <div v-for="h in hours" :key="h" class="cal-day__slot" />
        <div
          v-for="task in dayTasks"
          :key="calendarTaskRowKey(task, dateField ?? 'dueAt')"
          class="cal-day__event"
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
const SLOT_H = 56

const dayTasks = computed(() => {
  const map = groupTasksByDateField(props.tasks, props.dateField ?? 'dueAt')
  return map.get(props.anchor.format('YYYY-MM-DD')) ?? []
})

const dayHoliday = computed(() => props.holidayMarks?.[props.anchor.format('YYYY-MM-DD')])

function colorOf(task: Task) {
  if (!task.categoryId) return null
  return props.categoryColorMap.get(task.categoryId) ?? null
}

function eventStyle(task: Task) {
  const top = (taskMinutesOnField(task, props.dateField ?? 'dueAt') / 60) * SLOT_H
  return { top: `${top}px`, minHeight: `${SLOT_H - 4}px` }
}
</script>

<style scoped lang="scss">
.cal-day {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 16px 12px;
}

.cal-day__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--desktop-border);
}

.cal-day__weekday {
  font-size: 14px;
  color: var(--desktop-muted);
}

.cal-day__date {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 18px;
  font-weight: 700;

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
  }
}

.cal-day__mark {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;

  &.is-off {
    color: #c45656;
    background: rgba(196, 86, 86, 0.12);
  }

  &.is-work {
    color: #2f6fed;
    background: rgba(47, 111, 237, 0.12);
  }
}

.cal-day__mark-name {
  font-weight: 500;
  opacity: 0.9;
}

.cal-day__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 56px 1fr;
  overflow: auto;
}

.cal-day__hour-label {
  height: 56px;
  font-size: 12px;
  color: var(--desktop-muted);
  text-align: right;
  padding-right: 8px;
}

.cal-day__grid {
  position: relative;
  border-left: 1px solid var(--desktop-border);
  min-height: calc(56px * 24);
}

.cal-day__slot {
  height: 56px;
  border-bottom: 1px solid var(--desktop-border);
}

.cal-day__event {
  position: absolute;
  left: 8px;
  right: 8px;
  z-index: 1;
}
</style>
