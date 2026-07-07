<template>
  <div class="cal-month">
    <div class="cal-month__weekdays">
      <span v-for="w in weekdays" :key="w" class="cal-month__weekday">{{ w }}</span>
    </div>
    <div class="cal-month__grid">
      <div
        v-for="day in days"
        :key="day.format('YYYY-MM-DD')"
        class="cal-month__cell"
        :class="{
          'is-other-month': !day.isSame(anchorMonth, 'month'),
          'is-today': day.isSame(today, 'day')
        }"
      >
        <div class="cal-month__date">
          <span class="cal-month__date-num" :class="{ 'is-today': day.isSame(today, 'day') }">
            {{ day.date() }}
          </span>
        </div>
        <div class="cal-month__tasks">
          <CalendarTaskChip
            v-for="task in visibleTasks(day)"
            :key="calendarTaskRowKey(task, dateField ?? 'dueAt')"
            :task="task"
            :category-color="colorOf(task)"
            @select="emit('select', $event)"
            @toggle-status="emit('toggle-status', $event)"
          />
          <button
            v-if="overflowCount(day) > 0"
            type="button"
            class="cal-month__more"
            @click.stop="emit('select-day', day.format('YYYY-MM-DD'))"
          >
            还有 {{ overflowCount(day) }} 项
          </button>
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
import { CALENDAR_MONTH_CELL_MAX, calendarTaskRowKey, groupTasksByDateField } from '@shared/calendar-tasks'
import { buildCalendarDays } from '@/utils/schedule-picker'
import CalendarTaskChip from '@/components/calendar/CalendarTaskChip.vue'

const props = defineProps<{
  anchor: dayjs.Dayjs
  tasks: Task[]
  categoryColorMap: Map<string, string>
  dateField?: TaskDateField
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
  'select-day': [string]
}>()

const today = dayjs()
const anchorMonth = computed(() => props.anchor.startOf('month'))
const days = computed(() => buildCalendarDays(anchorMonth.value))
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const byDate = computed(() => groupTasksByDateField(props.tasks, props.dateField ?? 'dueAt'))

function tasksOn(day: dayjs.Dayjs) {
  return byDate.value.get(day.format('YYYY-MM-DD')) ?? []
}

function visibleTasks(day: dayjs.Dayjs) {
  return tasksOn(day).slice(0, CALENDAR_MONTH_CELL_MAX)
}

function overflowCount(day: dayjs.Dayjs) {
  const n = tasksOn(day).length
  return n > CALENDAR_MONTH_CELL_MAX ? n - CALENDAR_MONTH_CELL_MAX : 0
}

function colorOf(task: Task) {
  if (!task.categoryId) return null
  return props.categoryColorMap.get(task.categoryId) ?? null
}
</script>

<style scoped lang="scss">
.cal-month {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 12px 12px;
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
}

.cal-month__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-auto-rows: minmax(100px, 1fr);
  overflow: auto;
}

.cal-month__cell {
  border-right: 1px solid var(--desktop-border);
  border-bottom: 1px solid var(--desktop-border);
  padding: 4px 4px 6px;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:nth-child(7n) {
    border-right: none;
  }

  &.is-other-month {
    background: #fafafa;

    .cal-month__date-num {
      color: var(--desktop-muted);
    }
  }
}

.cal-month__date {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 4px;
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

  &.is-today {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
  }
}

.cal-month__tasks {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.cal-month__more {
  border: none;
  background: transparent;
  font-size: 11px;
  color: var(--el-color-primary);
  cursor: pointer;
  text-align: left;
  padding: 2px 4px;
}
</style>
