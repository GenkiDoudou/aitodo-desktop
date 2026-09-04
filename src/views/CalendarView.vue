<template>
  <AppShell>
    <template #sidebar>
      <AppSidebar
        :calendar-active="true"
        :task-counts="sidebarTaskCounts"
        :category-counts="sidebarListCounts.byId"
        :uncategorized-count="sidebarListCounts.uncategorized"
        :done-count="taskStore.doneCount"
        @select-smart="goHomeSmartAll"
        @select-inbox="goHomeInbox"
        @select-done="goHomeDone"
        @select-kanban="goHomeKanban"
        @select-calendar="onSidebarCalendarNav"
        @select-matrix="goHomeMatrix"
        @select-summary="goHomeSummary"
        @select-category="goHomeCategory"
        @select-tasks="goHomeTasks"
      />
    </template>
    <template #topbar>
      <AppTopBar title="日历" />
    </template>
    <div class="calendar-page" :class="{ 'is-detail-open': detailOpen }">
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
          :selected-date="selectedDateKey"
          @select-day="onSelectDay"
        />
        <CalendarWeekView
          v-else-if="effectiveViewMode === 'week'"
          :anchor="anchor"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          :selected-date="selectedDateKey"
          @select-day="onSelectDay"
        />
        <CalendarCustomRangeView
          v-else-if="effectiveViewMode === 'custom'"
          :from="customRangeFrom"
          :to="customRangeTo"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
          :selected-date="selectedDateKey"
          @select-day="onSelectDay"
        />
        <CalendarDayView
          v-else
          :anchor="selectedAnchor"
          :tasks="calendarTasks"
          :category-color-map="categoryColorMap"
          :date-field="calendarDateField"
          :holiday-marks="holidayMarks"
        />
      </div>

      <!-- 选中日任务：复用首页 TaskList 行样式与交互 -->
      <section v-if="effectiveViewMode !== 'year'" class="calendar-page__task-panel">
        <header class="calendar-page__task-head">
          <h2 class="calendar-page__task-title">{{ selectedDateLabel }}</h2>
          <span class="calendar-page__task-count">{{ selectedDayTasks.length }} 项</span>
        </header>
        <div class="calendar-page__task-body">
          <TaskList
            :layout-items="selectedDayLayout"
            :loading="false"
            :selected-id="activeTaskId"
            :meta-visibility="listMetaVisibility"
            :show-category="true"
            :categories="categoriesForList"
            @select="openTask"
            @toggle-status="onToggleStatus"
            @reorder-roots="onReorderRoots"
          />
        </div>
      </section>

      <div v-if="detailOpen" class="calendar-page__scrim" @click="closeDetail" />
      <TaskDetailPanel
        class="calendar-page__detail"
        :visible="detailOpen"
        :task-id="activeTaskId"
        @close="closeDetail"
        @saved="onTaskSaved"
      />
    </div>
  </AppShell>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import AppShell from '@/components/AppShell.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import AppTopBar from '@/components/AppTopBar.vue'
import TaskDetailPanel from '@/components/TaskDetailPanel.vue'
import type { TaskSavePayload } from '@/components/TaskDetailPanel.vue'
import CalendarMonthView from '@/components/calendar/CalendarMonthView.vue'
import CalendarWeekView from '@/components/calendar/CalendarWeekView.vue'
import CalendarDayView from '@/components/calendar/CalendarDayView.vue'
import CalendarYearView from '@/components/calendar/CalendarYearView.vue'
import CalendarCustomRangeView from '@/components/calendar/CalendarCustomRangeView.vue'
import TaskList from '@/components/TaskList.vue'
import { useTaskStore } from '@/stores/task-store'
import { useCategoryStore } from '@/stores/category-store'
import { useViewStore } from '@/stores/view-store'
import { isFilterRuleActive } from '@shared/apply-task-view'
import type { Task } from '@shared/types'
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
  groupTasksByDateField,
  type CalendarViewMode
} from '@shared/calendar-tasks'
import { buildTaskListLayout } from '@shared/task-list-layout'
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
import { readTaskListMetaVisibility } from '@/utils/list-view-preferences'
import {
  persistVisibleListIds,
  readVisibleListIds
} from '@/utils/visible-list-preferences'
import { resolveRootTaskId } from '@/utils/resolve-root-task-id'
const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()
const viewStore = useViewStore()
const anchor = ref(dayjs())
/** 下方任务列表绑定的选中日；默认今天 */
const selectedDateKey = ref(dayjs().format('YYYY-MM-DD'))
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
/** 侧栏「全部任务」计数 */
const sidebarTaskCounts = computed(() => ({
  all: taskStore.tasks.filter((t) => !t.parentId && !t.deletedAt).length
}))
/** 侧栏清单计数 */
const sidebarListCounts = computed(() => {
  const roots = taskStore.tasks.filter((t) => !t.parentId && !t.deletedAt)
  const byId: Record<string, number> = {}
  let uncategorized = 0
  for (const t of roots) {
    if (!t.categoryId) uncategorized++
    else byId[t.categoryId] = (byId[t.categoryId] ?? 0) + 1
  }
  return { byId, uncategorized }
})
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
/** 当前视图区间内、且命中 dateField + 时间段筛选的任务（含循环展开；不含子任务） */
const calendarTasks = computed(() => {
  const { start, end } = visibleRange.value
  /** 日历统计/列表只计根任务，子任务不单独占格子与选中日计数 */
  const active = taskStore.tasks.filter((t) => !t.deletedAt && !t.parentId)
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
    for (const t of taskStore.tasks) {
      if (!t.deletedAt && t.parentId) hasSubtasksById.set(t.parentId, true)
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

const selectedAnchor = computed(() => dayjs(selectedDateKey.value))

const selectedDateLabel = computed(() => {
  const d = selectedAnchor.value
  const holiday = holidayMarks.value[selectedDateKey.value]
  const base = d.format('YYYY年M月D日 dddd')
  if (holiday?.name) return `${base} · ${holiday.name}`
  if (d.day() === 0 || d.day() === 6) return `${base} · 周末`
  return `${base} · 工作日`
})

const selectedDayTasks = computed(() => {
  const map = groupTasksByDateField(calendarTasks.value, calendarDateField.value)
  return map.get(selectedDateKey.value) ?? []
})

/** 与首页列表同一套分组/排序布局（日历选中日不做分组） */
const selectedDayLayout = computed(() =>
  buildTaskListLayout(selectedDayTasks.value, 'none', 'time')
)

const categoriesForList = computed(() =>
  categoryStore.categories.map((c) => ({ id: c.id, name: c.name }))
)

/** 行内时间 meta 与首页列表偏好一致 */
const listMetaVisibility = readTaskListMetaVisibility()

function onCalendarViewChange(id: string | null | undefined) {
  viewStore.selectView(id ?? viewStore.selectedViewId)
}
function shift(dir: -1 | 1) {
  const preset = calendarRangePreset.value
  if (preset === 'day') {
    anchor.value = anchor.value.add(dir, 'day')
    selectedDateKey.value = anchor.value.format('YYYY-MM-DD')
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
  selectedDateKey.value = dayjs().format('YYYY-MM-DD')
}
function onSelectDay(dateKey: string) {
  selectedDateKey.value = dateKey
  if (calendarRangePreset.value === 'day') {
    anchor.value = dayjs(dateKey)
  }
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
function onSidebarCalendarNav() {
  onSidebarCalendar('month')
}
function openTask(id: string) {
  const rootId = resolveRootTaskId(id, taskStore.tasks)
  activeTaskId.value = rootId
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

async function onReorderRoots(ids: string[]) {
  try {
    await taskStore.reorder(ids)
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
function goHomeSmartAll() {
  void router.push({ path: '/', query: { smart: 'all' } })
}
function goHomeInbox() {
  void router.push({ path: '/', query: { view: 'inbox' } })
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
function goHomeKanban() {
  void router.push({ path: '/', query: { listView: 'kanban' } })
}
function goHomeTasks() {
  void router.push('/')
}
/** 从日历侧栏跳转首页并筛选清单 */
function goHomeCategory(id: string | null) {
  void router.push({
    path: '/',
    query: { category: id === null ? 'uncategorized' : id }
  })
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
  selectedDateKey.value = dayjs().format('YYYY-MM-DD')
  await categoryStore.load()
  await viewStore.load()
  await taskStore.load({ smartList: 'all', hideDone: false })
  await taskStore.refreshSidebarCounts()
  void loadHolidayMarks()
})
</script>
<style scoped lang="scss">
.calendar-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: auto;
  background: var(--desktop-panel);
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
  flex: 0 0 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.calendar-page__task-panel {
  flex: 1;
  min-height: 220px;
  margin: 0 12px 16px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--desktop-panel);
  border-top: 1px solid var(--desktop-border);
}
.calendar-page__task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 8px 8px;
  flex-shrink: 0;
}
.calendar-page__task-title {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--desktop-text);
}
.calendar-page__task-count {
  font-size: 12px;
  color: var(--desktop-muted);
}
.calendar-page__task-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.calendar-page__task-body :deep(.task-list__empty) {
  padding: 32px 16px;
}

.calendar-page__task-body :deep(.task-list__hint) {
  display: none;
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


