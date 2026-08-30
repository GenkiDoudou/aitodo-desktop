<template>
  <div class="calendar-page">
    <AppSidebar
      :active-smart="null"
      :active-category="undefined"
      :active-view-id="viewStore.selectedViewId"
      :calendar-active="true"
      :active-calendar-view="sidebarCalendarView"
      :trash-count="taskStore.trashCount"
      :done-count="taskStore.doneCount"
      @select-smart="goHomeSmart"
      @select-matrix="goHomeMatrix"
      @select-summary="goHomeSummary"
      @select-done="goHomeDone"
      @select-trash="goHomeTrash"
      @select-category="goHomeCategory"
      @select-view="goHomeView"
      @create-view="goHomeCreateView"
      @edit-view="goHomeEditView"
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
            @change="onCalendarCustomRangeChange"
          />
          <el-select
            :model-value="viewStore.selectedViewId"
            clearable
            size="small"
            class="calendar-page__filter calendar-page__filter--filter"
            placeholder="视图"
            @update:model-value="onCalendarViewChange"
          >
            <el-option
              v-for="v in viewStore.items"
              :key="v.id"
              :label="v.name"
              :value="v.id"
            />
          </el-select>
          <el-select
            v-model="visibleListsCalendar"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            size="small"
            class="calendar-page__filter calendar-page__filter--lists"
            placeholder="全部清单"
          >
            <el-option label="未分类" :value="UNCATEGORIZED_LIST_KEY"></el-option>
            <el-option
              v-for="cat in categoryStore.categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            ></el-option>
          </el-select>
        </div>
        <div class="calendar-page__head-actions">
          <el-button text circle title="新建任务" @click="goHomeNew">
            <el-icon><Plus /></el-icon>
          </el-button>
          <div class="calendar-page__nav">
            <el-button size="small" @click="shift(-1)">&lt;</el-button>
            <el-button size="small" @click="goToday">今天</el-button>
            <el-button size="small" @click="shift(1)">&gt;</el-button>
          </div>
        </div>
      </header>

      <div class="calendar-page__body">
        <CalendarYearView
          v-if="effectiveViewMode === 'year'"
          :anchor="anchor"
          :tasks="calendarTasks"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          @select-month="onSelectYearMonth"
        />
        <CalendarMonthView
          v-else-if="effectiveViewMode === 'month'"
          :anchor="anchor"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          @select="openTask"
          @toggle-status="onToggleStatus"
          @select-day="onSelectDay"
        />
        <CalendarWeekView
          v-else-if="effectiveViewMode === 'week'"
          :anchor="anchor"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          @select="openTask"
          @toggle-status="onToggleStatus"
        />
        <CalendarCustomRangeView
          v-else-if="effectiveViewMode === 'custom'"
          :from="customRangeFrom"
          :to="customRangeTo"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          @select="openTask"
          @toggle-status="onToggleStatus"
        />
        <CalendarDayView
          v-else
          :anchor="anchor"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          @select="openTask"
          @toggle-status="onToggleStatus"
        />
      </div>
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
import CalendarYearView from '@/components/calendar/CalendarYearView.vue'
import CalendarCustomRangeView from '@/components/calendar/CalendarCustomRangeView.vue'
import { useTaskStore } from '@/stores/task-store'
import { useCategoryStore } from '@/stores/category-store'
import { useViewStore } from '@/stores/view-store'
import { isFilterRuleActive } from '@shared/apply-task-view'
import type { Task, TaskStatus } from '@shared/types'
import { matchTask } from '@shared/task-filter-ast'
import { filterTasksBySelectedLists, UNCATEGORIZED_LIST_KEY } from '@shared/visible-lists'
import {
  CALENDAR_RANGE_PRESET_LABELS,
  TASK_DATE_FIELD_LABELS,
  calendarPresetBounds,
  type CalendarRangePreset,
  type TaskDateField
} from '@shared/date-filter'
import { startOfWeekMonday } from '@shared/smart-list'
import {
  calendarVisibleRange,
  expandTasksForCalendar,
  formatCalendarTitle,
  type CalendarViewMode
} from '@shared/calendar-tasks'
import type { HolidayCalendarDay } from '@shared/timor-holiday'
import { toggleCompletedOccurrenceDate } from '@shared/recurrence-occurrences'
import {
  persistCalendarDateField,
  persistCalendarCustomRange,
  persistCalendarRangePreset,
  readCalendarCustomRange,
  readCalendarDateField,
  readCalendarRangePreset
} from '@/utils/filter-preferences'
import {
  persistVisibleListIds,
  readVisibleListIds
} from '@/utils/visible-list-preferences'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()
const viewStore = useViewStore()

const anchor = ref(dayjs())
const detailOpen = ref(false)
const activeTaskId = ref<string | null>(null)
/** 法定放假 / 调休上班标注；拉取失败时保持空对象，日历仍可用 */
const holidayMarks = ref<Record<string, HolidayCalendarDay>>({})
const loadedHolidayYears = ref<Set<number>>(new Set())

/** 按哪列时间落在日历格子上 */
const calendarDateField = ref<TaskDateField>(readCalendarDateField())
/** 额外时间段：view=仅当前月/周/日可见区 */
const calendarRangePreset = ref<CalendarRangePreset>(readCalendarRangePreset())
const calendarCustomRange = ref<[string, string] | null>(readCalendarCustomRange())
const visibleListsCalendar = ref<string[]>(readVisibleListIds('calendar'))

const effectiveViewMode = computed<CalendarViewMode>(() => {
  switch (calendarRangePreset.value) {
    case 'day':
      return 'day'
    case 'week':
      return 'week'
    case 'month':
      return 'month'
    case 'year':
      return 'year'
    case 'custom':
      return 'custom'
    default:
      return 'month'
  }
})

const customRangeFrom = computed(() => calendarCustomRange.value?.[0] ?? dayjs().format('YYYY-MM-DD'))
const customRangeTo = computed(() => calendarCustomRange.value?.[1] ?? dayjs().format('YYYY-MM-DD'))

const sidebarCalendarView = computed<'month' | 'week' | 'day'>(() => {
  if (effectiveViewMode.value === 'day') return 'day'
  if (effectiveViewMode.value === 'week') return 'week'
  return 'month'
})

const visibleRange = computed(() => {
  if (effectiveViewMode.value === 'custom' && calendarCustomRange.value) {
    return {
      start: dayjs(calendarCustomRange.value[0]).startOf('day'),
      end: dayjs(calendarCustomRange.value[1]).endOf('day')
    }
  }
  return calendarVisibleRange(anchor.value, effectiveViewMode.value)
})

const dateFieldLabels = TASK_DATE_FIELD_LABELS
const rangePresetLabels = CALENDAR_RANGE_PRESET_LABELS

const title = computed(() => formatCalendarTitle(anchor.value, effectiveViewMode.value))

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
  const { start, end } = visibleRange.value
  const active = taskStore.tasks.filter((t) => !t.deletedAt)
  const expanded = expandTasksForCalendar(
    active,
    start,
    end,
    calendarDateField.value,
    presetBounds.value
  )
  const rule = viewStore.selectedView?.filterRule
  let result = expanded
  if (isFilterRuleActive(rule)) {
    const hasSubtasksById = new Map<string, boolean>()
    for (const t of active) {
      if (t.parentId) hasSubtasksById.set(t.parentId, true)
    }
    result = expanded.filter((instance) => {
      const dateKey = instance.dueAt?.slice(0, 10) ?? undefined
      return matchTask(instance, rule!, {
        hasSubtasksById,
        instanceDateKey: dateKey
      })
    })
  }
  return filterTasksBySelectedLists(
    result,
    visibleListsCalendar.value,
    new Map(active.map((t) => [t.id, t]))
  )
})

function onCalendarViewChange(id: string | null | undefined) {
  viewStore.selectView(id ?? viewStore.selectedViewId)
}

function goHomeView(id: string) {
  void router.push({ path: '/', query: { viewId: id } })
}

function goHomeCreateView() {
  void router.push({ path: '/', query: { createView: '1' } })
}

function goHomeEditView(id: string) {
  void router.push({ path: '/', query: { viewId: id, editView: '1' } })
}

function shift(dir: -1 | 1) {
  const preset = calendarRangePreset.value
  if (preset === 'day') {
    anchor.value = anchor.value.add(dir, 'day')
    return
  }
  if (preset === 'week') {
    anchor.value = anchor.value.add(dir, 'week')
    return
  }
  if (preset === 'month') {
    anchor.value = anchor.value.add(dir, 'month')
    return
  }
  if (preset === 'year') {
    anchor.value = anchor.value.add(dir, 'year')
  }
}

function goToday() {
  syncCalendarAnchorToPreset(calendarRangePreset.value)
}

function onSelectDay(dateKey: string) {
  anchor.value = dayjs(dateKey)
  calendarRangePreset.value = 'day'
  persistCalendarRangePreset('day')
}

function onSelectYearMonth(month1to12: number) {
  anchor.value = anchor.value.month(month1to12 - 1).startOf('month')
  calendarRangePreset.value = 'month'
  persistCalendarRangePreset('month')
}

function onCalendarCustomRangeChange(range: [string, string] | null) {
  calendarCustomRange.value = range
  persistCalendarCustomRange(range)
}

function syncCalendarAnchorToPreset(preset: CalendarRangePreset) {
  const now = dayjs()
  switch (preset) {
    case 'day':
      anchor.value = now
      break
    case 'week':
      anchor.value = startOfWeekMonday(now)
      break
    case 'month':
      anchor.value = now.startOf('month')
      break
    case 'year':
      anchor.value = now.startOf('year')
      break
    case 'custom':
      if (!calendarCustomRange.value) {
        calendarCustomRange.value = [now.format('YYYY-MM-DD'), now.add(6, 'day').format('YYYY-MM-DD')]
        persistCalendarCustomRange(calendarCustomRange.value)
      }
      anchor.value = dayjs(calendarCustomRange.value[0])
      break
    default:
      break
  }
}

function onCalendarDateFieldChange(field: TaskDateField) {
  persistCalendarDateField(field)
}

function onCalendarRangePresetChange(preset: CalendarRangePreset) {
  persistCalendarRangePreset(preset)
  syncCalendarAnchorToPreset(preset)
}

function onSidebarCalendar(mode: CalendarViewMode) {
  const map: Partial<Record<CalendarViewMode, CalendarRangePreset>> = {
    day: 'day',
    week: 'week',
    month: 'month'
  }
  const preset = map[mode]
  if (!preset) return
  calendarRangePreset.value = preset
  onCalendarRangePresetChange(preset)
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
  try {
    const rule = task.recurrence
    const isRecurring = Boolean(rule && rule.type !== 'none')
    const dateKey = task.dueAt?.slice(0, 10)
    // 循环任务：只标记当天实例，不改整条 status
    if (isRecurring && dateKey && calendarDateField.value === 'dueAt') {
      const master = taskStore.tasks.find((t) => t.id === task.id)
      const current = master?.completedOccurrenceDates ?? task.completedOccurrenceDates ?? []
      const markingDone = task.status !== 'DONE'
      await taskStore.update(task.id, {
        completedOccurrenceDates: toggleCompletedOccurrenceDate(current, dateKey, markingDone)
      })
      return
    }
    await taskStore.cycleStatus(task.id)
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
    onSidebarCalendar(q)
  }
}

watch(() => route.query.view, syncViewFromRoute)

/** 月历格子可能跨年；周/日按锚点年份，保险再取前后年 */
function yearsNeededForView(): number[] {
  const { start, end } = calendarVisibleRange(anchor.value, effectiveViewMode.value)
  const years = new Set<number>([start.year(), end.year(), anchor.value.year()])
  return [...years].sort((a, b) => a - b)
}

async function loadHolidayMarks() {
  const needed = yearsNeededForView().filter((y) => !loadedHolidayYears.value.has(y))
  if (needed.length === 0) return
  try {
    const result = await window.api.holidays.calendarMarks(needed)
    if (!result.ok) return
    holidayMarks.value = { ...holidayMarks.value, ...result.data }
    for (const y of needed) loadedHolidayYears.value.add(y)
  } catch {
    /* 网络/服务失败时静默，不打断日历 */
  }
}

watch(visibleListsCalendar, (ids) => persistVisibleListIds('calendar', ids), { deep: true })

watch([anchor, effectiveViewMode], () => {
  void loadHolidayMarks()
})

onMounted(async () => {
  syncViewFromRoute()
  syncCalendarAnchorToPreset(calendarRangePreset.value)
  await categoryStore.load()
  await viewStore.load()
  await taskStore.load({ smartList: 'all', hideDone: false })
  await taskStore.refreshSidebarCounts()
  void loadHolidayMarks()
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

.calendar-page__filter--filter {
  width: 140px;
}

.calendar-page__filter--lists {
  min-width: 160px;
  width: 200px;
}

.calendar-page__custom-range {
  max-width: 260px;
}

.calendar-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calendar-page__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.calendar-page__nav {
  display: flex;
  gap: 4px;
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
