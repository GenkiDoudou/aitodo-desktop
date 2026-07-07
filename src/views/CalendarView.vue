<template>
  <div class="calendar-page">
    <AppSidebar
      :active-smart="null"
      :active-category="undefined"
      :calendar-active="true"
      :active-calendar-view="viewMode"
      :trash-count="taskStore.trashCount"
      :done-count="taskStore.doneCount"
      @select-smart="goHomeSmart"
      @select-matrix="goHomeMatrix"
      @select-summary="goHomeSummary"
      @select-done="goHomeDone"
      @select-trash="goHomeTrash"
      @select-category="goHomeCategory"
      @select-calendar="onSidebarCalendar"
      @select-tasks="goHomeTasks"
      @open-settings="router.push('/settings')"
      @open-task="openTask"
    />

    <div class="calendar-page__main" :class="{ 'is-detail-open': detailOpen }">
      <header class="calendar-page__header">
        <div class="calendar-page__head-left">
          <h1 class="calendar-page__title">{{ title }}</h1>
          <el-select
            v-model="calendarDateField"
            size="small"
            class="calendar-page__filter"
            @change="onCalendarDateFieldChange"
          >
            <el-option
              v-for="(label, key) in dateFieldLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
          <el-select
            v-model="calendarRangePreset"
            size="small"
            class="calendar-page__filter"
            @change="onCalendarRangePresetChange"
          >
            <el-option
              v-for="(label, key) in rangePresetLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
          <el-date-picker
            v-if="calendarRangePreset === 'custom'"
            v-model="calendarCustomRange"
            type="daterange"
            size="small"
            class="calendar-page__custom-range"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
          />
        </div>
        <div class="calendar-page__head-actions">
          <el-button text circle title="新建任务" @click="goHomeNew">
            <el-icon><Plus /></el-icon>
          </el-button>
          <el-select v-model="viewMode" size="small" class="calendar-page__view-select">
            <el-option label="月" value="month" />
            <el-option label="周" value="week" />
            <el-option label="日" value="day" />
          </el-select>
          <div class="calendar-page__nav">
            <el-button size="small" @click="shift(-1)">&lt;</el-button>
            <el-button size="small" @click="goToday">今天</el-button>
            <el-button size="small" @click="shift(1)">&gt;</el-button>
          </div>
        </div>
      </header>

      <CalendarMonthView
        v-if="viewMode === 'month'"
        :anchor="anchor"
        :tasks="calendarTasks"
        :category-color-map="categoryColorMap"
        :date-field="calendarDateField"
        @select="openTask"
        @toggle-status="onToggleStatus"
        @select-day="onSelectDay"
      />
      <CalendarWeekView
        v-else-if="viewMode === 'week'"
        :anchor="anchor"
        :tasks="calendarTasks"
        :category-color-map="categoryColorMap"
        :date-field="calendarDateField"
        @select="openTask"
        @toggle-status="onToggleStatus"
      />
      <CalendarDayView
        v-else
        :anchor="anchor"
        :tasks="calendarTasks"
        :category-color-map="categoryColorMap"
        :date-field="calendarDateField"
        @select="openTask"
        @toggle-status="onToggleStatus"
      />

      <nav class="calendar-page__view-bar">
        <button
          v-for="m in viewModes"
          :key="m.value"
          type="button"
          class="calendar-page__view-btn"
          :class="{ 'is-active': viewMode === m.value }"
          @click="viewMode = m.value"
        >
          {{ m.label }}
        </button>
      </nav>
    </div>

    <div v-if="detailOpen" class="calendar-page__scrim" @click="closeDetail" />

    <TaskDetailPanel
      class="calendar-page__detail"
      :visible="detailOpen"
      :task-id="activeTaskId"
      @close="closeDetail"
      @saved="onTaskSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import AppSidebar from '@/components/AppSidebar.vue'
import TaskDetailPanel from '@/components/TaskDetailPanel.vue'
import type { TaskSavePayload } from '@/components/TaskDetailPanel.vue'
import CalendarMonthView from '@/components/calendar/CalendarMonthView.vue'
import CalendarWeekView from '@/components/calendar/CalendarWeekView.vue'
import CalendarDayView from '@/components/calendar/CalendarDayView.vue'
import { useTaskStore } from '@/stores/task-store'
import { useCategoryStore } from '@/stores/category-store'
import type { Task, TaskStatus } from '@shared/types'
import {
  CALENDAR_RANGE_PRESET_LABELS,
  TASK_DATE_FIELD_LABELS,
  calendarPresetBounds,
  type CalendarRangePreset,
  type TaskDateField
} from '@shared/date-filter'
import {
  calendarVisibleRange,
  expandTasksForCalendar,
  formatCalendarTitle,
  type CalendarViewMode
} from '@shared/calendar-tasks'
import {
  persistCalendarDateField,
  persistCalendarRangePreset,
  readCalendarDateField,
  readCalendarRangePreset
} from '@/utils/filter-preferences'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()

const anchor = ref(dayjs())
const viewMode = ref<CalendarViewMode>('month')
const detailOpen = ref(false)
const activeTaskId = ref<string | null>(null)

/** 按哪列时间落在日历格子上 */
const calendarDateField = ref<TaskDateField>(readCalendarDateField())
/** 额外时间段：view=仅当前月/周/日可见区 */
const calendarRangePreset = ref<CalendarRangePreset>(readCalendarRangePreset())
const calendarCustomRange = ref<[string, string] | null>(null)

const dateFieldLabels = TASK_DATE_FIELD_LABELS
const rangePresetLabels = CALENDAR_RANGE_PRESET_LABELS

const viewModes = [
  { value: 'month' as const, label: '月视图' },
  { value: 'week' as const, label: '周视图' },
  { value: 'day' as const, label: '日视图' }
]

const title = computed(() => formatCalendarTitle(anchor.value, viewMode.value))

const categoryColorMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of categoryStore.categories) {
    if (c.color) map.set(c.id, c.color)
  }
  return map
})

const presetBounds = computed(() => {
  if (calendarRangePreset.value === 'custom' && calendarCustomRange.value?.length === 2) {
    return calendarPresetBounds('custom', anchor.value, {
      from: calendarCustomRange.value[0],
      to: calendarCustomRange.value[1]
    })
  }
  return calendarPresetBounds(calendarRangePreset.value, anchor.value)
})

/** 当前视图区间内、且命中 dateField + 时间段筛选的任务（含循环展开） */
const calendarTasks = computed(() => {
  const { start, end } = calendarVisibleRange(anchor.value, viewMode.value)
  const active = taskStore.tasks.filter((t) => !t.deletedAt)
  return expandTasksForCalendar(
    active,
    start,
    end,
    calendarDateField.value,
    presetBounds.value
  )
})

function shift(dir: -1 | 1) {
  const unit = viewMode.value === 'month' ? 'month' : viewMode.value === 'week' ? 'week' : 'day'
  anchor.value = anchor.value.add(dir, unit)
}

function goToday() {
  anchor.value = dayjs()
}

function onSelectDay(dateKey: string) {
  anchor.value = dayjs(dateKey)
  viewMode.value = 'day'
}

function onCalendarDateFieldChange(field: TaskDateField) {
  persistCalendarDateField(field)
}

function onCalendarRangePresetChange(preset: CalendarRangePreset) {
  persistCalendarRangePreset(preset)
}

function onSidebarCalendar(mode: CalendarViewMode) {
  viewMode.value = mode
  void router.replace({ path: '/calendar', query: { view: mode } })
}

function openTask(id: string) {
  activeTaskId.value = id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  activeTaskId.value = null
}

async function onToggleStatus(task: Task) {
  const next: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'
  try {
    await taskStore.update(task.id, { status: next })
  } catch {
    /* store 已 Toast */
  }
}

async function onTaskSaved(payload: TaskSavePayload) {
  await taskStore.afterSave(payload.task, payload.mode)
  if (payload.mode === 'delete') {
    closeDetail()
  }
}

function goHomeSmart(smart: 'all' | 'today' | 'week' | 'last7days') {
  void router.push({ path: '/', query: { smart } })
}

function goHomeMatrix() {
  void router.push({ path: '/', query: { view: 'matrix' } })
}

function goHomeSummary(section: 'config' | 'results' = 'config') {
  void router.push({ path: '/', query: { view: 'summary', section } })
}

function goHomeDone() {
  void router.push({ path: '/', query: { view: 'done' } })
}

function goHomeTrash() {
  void router.push({ path: '/', query: { view: 'trash' } })
}

function goHomeCategory(id: string | null) {
  void router.push({ path: '/', query: id ? { category: id } : { category: 'uncategorized' } })
}

function goHomeTasks() {
  void router.push('/')
}

function goHomeNew() {
  void router.push('/')
}

function syncViewFromRoute() {
  const q = route.query.view
  if (q === 'month' || q === 'week' || q === 'day') {
    viewMode.value = q
  }
}

watch(() => route.query.view, syncViewFromRoute)

onMounted(async () => {
  syncViewFromRoute()
  await categoryStore.load()
  await taskStore.load({ smartList: 'all', hideDone: false })
  await taskStore.refreshSidebarCounts()
})
</script>

<style scoped lang="scss">
.calendar-page {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--desktop-bg);
}

.calendar-page__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;

  &.is-detail-open {
    margin-right: 0;
  }
}

.calendar-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.calendar-page__head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.calendar-page__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.calendar-page__filter {
  width: 120px;
}

.calendar-page__custom-range {
  max-width: 260px;
}

.calendar-page__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.calendar-page__view-select {
  width: 72px;
}

.calendar-page__nav {
  display: flex;
  gap: 4px;
}

.calendar-page__view-bar {
  display: none;
}

.calendar-page__scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 90;
}

.calendar-page__detail {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}
</style>
