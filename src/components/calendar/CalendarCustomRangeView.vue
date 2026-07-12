<template>
  <div class="cal-custom">
    <div v-if="days.length === 0" class="cal-custom__empty">请选择开始与结束日期</div>
    <section v-for="day in days" :key="day.format('YYYY-MM-DD')" class="cal-custom__day">
      <header class="cal-custom__day-head">
        <span class="cal-custom__day-date">{{ day.format('M月D日 dddd') }}</span>
        <span
          v-if="holidayOf(day)"
          class="cal-custom__mark"
          :class="holidayOf(day)!.kind === 'holiday' ? 'is-off' : 'is-work'"
        >
          {{ holidayOf(day)!.kind === 'holiday' ? '休' : '班' }}
        </span>
        <span class="cal-custom__count">{{ tasksOnDay(day).length }} 项</span>
      </header>
      <ul v-if="tasksOnDay(day).length" class="cal-custom__tasks">
        <li v-for="task in tasksOnDay(day)" :key="calendarTaskRowKey(task, dateField ?? 'dueAt')">
          <CalendarTaskChip
            :task="task"
            :category-color="colorOf(task)"
            :show-time="true"
            @select="emit('select', $event)"
            @toggle-status="emit('toggle-status', $event)"
          />
        </li>
      </ul>
      <div v-else class="cal-custom__no-task">无任务</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import type { Task } from '@shared/types'
import type { TaskDateField } from '@shared/date-filter'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { calendarTaskRowKey, groupTasksByDateField } from '@shared/calendar-tasks'
import CalendarTaskChip from '@/components/calendar/CalendarTaskChip.vue'

const props = defineProps<{
  from: string
  to: string
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
  holidayMarks?: Record<string, HolidayCalendarDay>
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

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

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'dueAt'))

function tasksOnDay(day: Dayjs) {
  return byDate.value.get(day.format('YYYY-MM-DD')) ?? []
}

function colorOf(task: Task) {
  if (!task.categoryId) return null
  return props.categoryColorMap.get(task.categoryId) ?? null
}

function holidayOf(day: Dayjs) {
  return props.holidayMarks?.[day.format('YYYY-MM-DD')]
}
</script>

<style scoped lang="scss">
.cal-custom {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cal-custom__empty {
  text-align: center;
  color: var(--desktop-muted);
  padding: 48px;
}

.cal-custom__day {
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: var(--desktop-panel);
  overflow: hidden;
}

.cal-custom__day-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--desktop-bg);
  border-bottom: 1px solid var(--desktop-border);
}

.cal-custom__day-date {
  font-size: 14px;
  font-weight: 600;
}

.cal-custom__mark {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 999px;
  line-height: 18px;

  &.is-off {
    background: rgba(245, 108, 108, 0.15);
    color: #f56c6c;
  }

  &.is-work {
    background: rgba(103, 194, 58, 0.15);
    color: #67c23a;
  }
}

.cal-custom__count {
  margin-left: auto;
  font-size: 12px;
  color: var(--desktop-muted);
}

.cal-custom__tasks {
  list-style: none;
  margin: 0;
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cal-custom__no-task {
  padding: 12px;
  font-size: 13px;
  color: var(--desktop-muted);
}
</style>
