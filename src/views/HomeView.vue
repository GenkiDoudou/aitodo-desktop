<template>

  <div class="home">

    <AppSidebar

      :active-smart="sidebarActiveSmart"

      :active-category="navCategoryId"
      :active-view-id="navViewId"

      :task-counts="taskCounts"
      :category-counts="sidebarListCounts.byId"
      :uncategorized-count="sidebarListCounts.uncategorized"
      :trash-count="taskStore.trashCount"
      :done-count="taskStore.doneCount"
      :summary-active="isSummaryView"
      :active-summary-section="navSummarySection"
      @select-smart="onSmart"
      @select-inbox="onInbox"
      @select-matrix="onMatrix"
      @select-summary="onSummary"
      @select-done="onDone"
      @select-trash="onTrash"
      @select-calendar="onCalendar"
      @select-tasks="onSelectTasks"
      @select-category="onCategory"
      @select-view="onView"
      @create-view="openCreateView"
      @create-view-from-template="onCreateViewFromTemplate"
      @edit-view="openEditView"
      @save-as-view="openSaveAsView"
      @open-settings="router.push('/settings')"
      @open-task="openTask"

    />



    <div class="home__workspace">

      <section
        class="home__list-pane"
        :class="{
          'is-detail-open':
            (detailOpen && taskDetailStyle === 'sidebar') || noteDetailOpen,
          'is-detail-expanded': detailPanelExpanded && taskDetailStyle === 'sidebar'
        }"
      >

        <header class="home__list-header">

          <div class="home__list-head-left">

            <h1 class="home__view-title">{{ viewTitle }}</h1>

            <span v-if="!isSpecialListView" class="home__view-count">
              ({{ headerTaskCounts.incomplete }}/{{ headerTaskCounts.total }})
            </span>

            <el-select
              v-if="showSmartDateFieldFilter"
              v-model="listDateField"
              size="small"
              class="home__date-field-filter"
              @change="onListDateFieldChange"
            >
              <el-option
                v-for="(label, key) in dateFieldLabels"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>

            <el-select
              v-if="isDoneView"
              v-model="doneTimeRange"
              size="small"
              class="home__done-time-filter"
              @change="onDoneTimeRangeChange"
            >
              <el-option
                v-for="(label, key) in doneTimeRangeLabels"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>

            <el-date-picker
              v-if="isDoneView && doneTimeRange === 'custom'"
              v-model="doneCustomRange"
              type="daterange"
              size="small"
              class="home__done-custom-range"
              range-separator="至"
              start-placeholder="开始"
              end-placeholder="结束"
              value-format="YYYY-MM-DD"
              @change="onDoneCustomRangeChange"
            />

            <el-select
              v-if="isDoneView"
              v-model="doneListCategory"
              size="small"
              class="home__done-category-filter"
            >
              <el-option label="所有清单" value="all" />
              <el-option label="未分类" value="uncategorized" />
              <el-option
                v-for="cat in categoryStore.categories"
                :key="cat.id"
                :label="cat.name"
                :value="cat.id"
              />
            </el-select>

          </div>

          <div class="home__list-actions">
            <QuadrantMatrixMenu
              v-if="isMatrixView || isQuadrantViewLayout"
              v-model:meta-visibility="taskListMetaVisibility"
              @change="onQuadrantPrefsChange"
            />
            <TaskListViewMenu
              v-else-if="showListViewSettingsMenu"
              v-model:hide-done="listHideDone"
              v-model:detail-style="taskDetailStyle"
              v-model:meta-visibility="taskListMetaVisibility"
              v-model:group-by="taskGroupBy"
              v-model:sort-by="taskSortBy"
              v-model:view-mode="gearViewMode"
            />
            <el-button
              v-if="isTrashView"
              text
              class="home__empty-trash"
              title="清空垃圾桶"
              @click="onEmptyTrash"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>

        </header>



        <div v-if="!isSpecialListView && !isMatrixView && !isInboxView && !isQuadrantViewLayout" class="home__quick-add">

          <el-icon class="home__quick-add-icon"><Plus /></el-icon>

          <QuickAddInput

            ref="quickAddInputRef"

            v-model="quickAddText"

            :placeholder="quickAddPlaceholder"

            :categories="parseCategoriesForMatch"

            @enter="onQuickAdd"

          />

          <TaskPriorityFlagMenu
            v-model="quickAddPriority"
            class="home__quick-add-priority"
          />

        </div>



        <TrashTaskList
          v-if="isTrashView"
          :tasks="taskStore.tasks"
          :categories="categoryStore.categories"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          @select="selectTrashTask"
          @restore="onRestoreTrash"
          @purge="onPurgeTrash"
        />

        <CompletedTaskList
          v-else-if="isDoneView"
          :tasks="taskStore.tasks"
          :categories="categoryStore.categories"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :category-filter="completedCategoryFilter"
          @select="openTask"
          @toggle-status="onToggleStatus"
        />

        <InboxView
          v-else-if="isInboxView"
          :notes="widgetNotes"
          :tasks="inboxTasks"
          :selected-note-id="activeNoteId"
          @convert-note="openInboxConvertNote"
          @delete-note="onInboxDeleteNote"
          @select-note="openInboxNote"
          @select-task="openTask"
          @triage-task="onInboxTriageTask"
        />

        <QuadrantMatrixView
          v-else-if="isMatrixView || isQuadrantViewLayout"
          :tasks="matrixDisplayTasks"
          :categories="categoryStore.categories"
          :loading="taskStore.loading"
          :layout-options="quadrantLayoutOptions"
          :meta-visibility="taskListMetaVisibility"
          @select="openTask"
          @toggle-status="onToggleStatus"
          @create="onQuadrantQuickCreate"
          @change-priority="onChangePriority"
        />

        <div v-else-if="isSummaryConfigView" class="home__summary-pane">
          <SettingsSummarySection embedded />
        </div>

        <SummaryResultsView v-else-if="isSummaryResultsView" />

        <TaskKanbanView
          v-else-if="listViewMode === 'kanban'"
          v-model:selected-column-id="kanbanSelectedColumnId"
          :board-mode="effectiveKanbanBoardMode"
          :sort-by="taskSortBy"
          :scope-key="kanbanScopeKeyValue"
          :tasks="kanbanDisplayTasks"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :hide-done="taskStore.filter.hideDone"
          :meta-visibility="taskListMetaVisibility"
          :default-category-id="kanbanDefaultCategoryId"
          :parse-categories="parseCategoriesForMatch"
          @select="openTask"
          @toggle-status="onToggleStatus"
          @changed="onKanbanChanged"
        />

        <TaskTimelineView
          v-else-if="listViewMode === 'timeline'"
          :tasks="listDisplayTasks"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :categories="parseCategoriesForMatch"
          :range-preset="timelineRangePreset"
          :range-between="timelineRangeBetween"
          @select="openTask"
          @schedule="onTimelineSchedule"
          @create-on-day="onTimelineCreateOnDay"
          @update-span="onTimelineUpdateSpan"
        />

        <TaskList
          v-else
          :layout-items="taskListLayout"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :meta-visibility="taskListMetaVisibility"
          :show-category="showTaskListCategory"
          :categories="parseCategoriesForMatch"
          @select="openTask"
          @toggle-status="onToggleStatus"
          @reorder-roots="onReorderRoots"
        />

      </section>



      <div
        v-if="(detailOpen && taskDetailStyle === 'sidebar') || noteDetailOpen"
        class="home__detail-scrim"
        @click="onDetailScrimClick"
      />

      <InboxNotePanel
        v-if="isInboxView"
        class="home__detail"
        :visible="noteDetailOpen"
        :note="activeNote"
        @close="closeNoteDetail"
        @changed="onInboxNoteChanged"
        @convert="openInboxConvertNote"
        @delete="onInboxDeleteNote"
      />

      <TaskDetailPanel
        v-if="taskDetailStyle === 'sidebar'"
        class="home__detail"
        :visible="detailOpen"
        variant="sidebar"
        :task-id="activeTaskId"
        :default-category-id="defaultCategoryForCreate"
        :default-priority="defaultPriorityForCreate"
        :emphasize-category="isMatrixView"
        @close="closeDetail"
        @saved="onTaskSaved"
        @panel-expanded-change="detailPanelExpanded = $event"
      />

      <el-dialog
        v-else
        :model-value="detailOpen"
        class="home__detail-dialog"
        width="640px"
        top="6vh"
        destroy-on-close
        :show-close="false"
        append-to-body
        @update:model-value="onDetailDialogVisible"
      >
        <TaskDetailPanel
          :visible="detailOpen"
          variant="dialog"
          :task-id="activeTaskId"
          :default-category-id="defaultCategoryForCreate"
          :default-priority="defaultPriorityForCreate"
          :emphasize-category="isMatrixView || isQuadrantViewLayout"
          @close="closeDetail"
          @saved="onTaskSaved"
        />
      </el-dialog>

      <TaskViewEditor
        v-model:visible="viewEditorVisible"
        :mode="viewEditorMode"
        :view-id="viewEditorId"
        :initial-name="viewEditorName"
        :initial-layout="viewEditorLayout"
        :initial-group-by="viewEditorGroupBy"
        :initial-sort-by="viewEditorSortBy"
        :initial-kanban-board-mode="viewEditorKanbanMode"
        :initial-quadrant-options="viewEditorQuadrantOptions"
        :initial-rule="viewEditorRule"
        :initial-scope-key="viewEditorScopeKey"
        :initial-hide-done="viewEditorHideDone"
        :initial-detail-style="viewEditorDetailStyle"
        :initial-meta-visibility="viewEditorMetaVisibility"
        :categories="categoryStore.categories"
        @saved="onViewEditorSaved"
      />

    </div>

  </div>

</template>



<script setup lang="ts">

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Plus, Delete } from '@element-plus/icons-vue'

import { useRoute, useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'

import AppSidebar from '@/components/AppSidebar.vue'
import TaskViewEditor from '@/components/TaskViewEditor.vue'

import TaskList from '@/components/TaskList.vue'
import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'
import TaskKanbanView from '@/components/TaskKanbanView.vue'
import QuickAddInput from '@/components/QuickAddInput.vue'
import TaskTimelineView from '@/components/TaskTimelineView.vue'

import CompletedTaskList from '@/components/CompletedTaskList.vue'

import TrashTaskList from '@/components/TrashTaskList.vue'

import InboxView from '@/components/InboxView.vue'
import InboxNotePanel from '@/components/InboxNotePanel.vue'
import QuadrantMatrixView from '@/components/QuadrantMatrixView.vue'
import QuadrantMatrixMenu from '@/components/QuadrantMatrixMenu.vue'
import TaskListViewMenu from '@/components/TaskListViewMenu.vue'
import SummaryResultsView from '@/components/SummaryResultsView.vue'
import SettingsSummarySection from '@/components/settings/SettingsSummarySection.vue'

import TaskDetailPanel from '@/components/TaskDetailPanel.vue'

import type { TaskSavePayload } from '@/components/TaskDetailPanel.vue'

import { useTaskStore } from '@/stores/task-store'

import { useCategoryStore } from '@/stores/category-store'
import { useViewStore } from '@/stores/view-store'

import type { Task, TaskStatus, TaskViewLayout } from '@shared/types'
import { matchTask, type FilterNode } from '@shared/task-filter-ast'
import { toParseCategories } from '@shared/quick-create-task'
import {
  inferTimelineBetweenRange,
  inferTimelineCalendarPreset,
  type TimelineCalendarPreset
} from '@shared/timeline-range'
import { deriveAppliedViewState, isFilterRuleActive } from '@shared/apply-task-view'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { groupByToKanbanBoardMode } from '@shared/kanban-group-columns'

import type { TaskPriority } from '@shared/task-priority'

import { DEFAULT_TASK_PRIORITY, getTaskPriorityMeta } from '@shared/task-priority'
import { isMatrixListFilter } from '@shared/task-list-filter'
import { isDueSmartList } from '@shared/smart-list'
import { taskMatchesSmartListDate } from '@shared/date-filter'
import {
  DONE_TIME_RANGE_LABELS,
  TASK_DATE_FIELD_LABELS,
  type DoneTimeRange,
  type TaskDateField
} from '@shared/date-filter'
import { buildTaskListLayout } from '@shared/task-list-layout'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import type { TaskDetailStyle, TaskListViewMode } from '@shared/list-view-preferences'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import { kanbanScopeKey, KANBAN_UNGROUPED_ID } from '@shared/kanban-scope'
import type { SmartList } from '@shared/types'
import {
  persistDoneTimeRange,
  persistListDateField,
  readDoneTimeRange,
  readListDateField,
  readTaskGroupBy,
  readTaskSortBy,
  persistTaskGroupBy,
  persistTaskSortBy
} from '@/utils/filter-preferences'
import {
  readQuadrantViewPreferences,
  type QuadrantViewPreferences
} from '@/utils/quadrant-preferences'
import { isUntriagedInboxTask } from '@shared/inbox-tasks'
import type { WidgetNote } from '@shared/widget-notes'
import { nowIso } from '@shared/datetime'
import {
  readTaskDetailStyle,
  readTaskListMetaVisibility,
  readTaskListViewMode,
  persistTaskDetailStyle,
  persistTaskListMetaVisibility,
  persistTaskListViewMode
} from '@/utils/list-view-preferences'
import {
  navListPrefsScopeKey,
  persistNavListPrefs,
  readNavListPrefs,
  type NavListPrefs
} from '@/utils/nav-list-preferences'
import { readKanbanBoardMode, persistKanbanBoardMode } from '@/utils/kanban-preferences'
import {
  defaultViewDisplayPreferences,
  readViewDisplayPreferences
} from '@/utils/view-display-preferences'
import type { CalendarViewMode } from '@shared/calendar-tasks'



const router = useRouter()
const route = useRoute()

const taskStore = useTaskStore()

const categoryStore = useCategoryStore()
const viewStore = useViewStore()



const quickAddText = ref('')
const quickAddPriority = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)
/** 时间线双击空白：下一次快捷添加带上该日 dueAt */
const pendingTimelineDateKey = ref<string | null>(null)

const quickAddInputRef = ref<InstanceType<typeof QuickAddInput>>()

const detailOpen = ref(false)
const noteDetailOpen = ref(false)
const activeNoteId = ref<string | null>(null)
const activeTaskId = ref<string | null>(null)

const detailPanelExpanded = ref(false)

const defaultPriorityForCreate = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)



const navCategoryId = ref<string | null | undefined>(undefined)
/** 视图导航：选中则与 smart/清单互斥 */
const navViewId = ref<string | null>(null)

const navSmart = ref<'inbox' | 'all' | 'last7days' | 'matrix' | 'done' | 'trash'>('all')
const navSummaryActive = ref(false)
const widgetNotes = ref<WidgetNote[]>([])
type SummarySection = 'config' | 'results'
const navSummarySection = ref<SummarySection>('config')

/** 已完成页「所有清单」筛选：all=不过滤；uncategorized=未分类；否则为清单 id */
const doneListCategory = ref<'all' | 'uncategorized' | string>('all')

/** 今天/本周/最近7天：按哪列时间筛选（默认到期时间） */
const listDateField = ref<TaskDateField>(readListDateField())

/** 已完成页时间范围 */
const doneTimeRange = ref<DoneTimeRange>(readDoneTimeRange())
const doneCustomRange = ref<[string, string] | null>(null)

const viewEditorVisible = ref(false)
const viewEditorMode = ref<'create' | 'edit' | 'save-as'>('create')
const viewEditorId = ref<string | null>(null)
const viewEditorName = ref('')
const viewEditorLayout = ref<TaskViewLayout>('list')
const viewEditorGroupBy = ref<TaskGroupBy>('none')
const viewEditorSortBy = ref<TaskSortBy>('custom')
const viewEditorKanbanMode = ref<KanbanBoardMode>('group')
const viewEditorQuadrantOptions = ref<import('@shared/quadrant-layout').QuadrantLayoutOptions | null>(null)
const viewEditorRule = ref<FilterNode | null>(null)
const viewEditorScopeKey = ref<string | null>(null)

const dateFieldLabels = TASK_DATE_FIELD_LABELS
const doneTimeRangeLabels = DONE_TIME_RANGE_LABELS

const showSmartDateFieldFilter = computed(
  () =>
    !navViewId.value &&
    navCategoryId.value === undefined &&
    navSmart.value === 'last7days'
)

/** 全部 / 视图 / 智能列表等跨清单场景显示清单名；进入具体清单时不显示 */
const showTaskListCategory = computed(
  () =>
    navCategoryId.value === undefined &&
    !isSpecialListView.value &&
    !isMatrixView.value &&
    !isInboxView.value &&
    !isQuadrantViewLayout.value &&
    !isSummaryView.value
)

const showListViewSettingsMenu = computed(
  () =>
    !isSpecialListView.value &&
    !isMatrixView.value &&
    !isInboxView.value &&
    !isQuadrantViewLayout.value &&
    !navViewId.value
)

const listHideDone = computed({
  get: () => taskStore.filter.hideDone,
  set: (value: boolean) => {
    void taskStore.setHideDone(value).then(() => saveCurrentNavListPrefs())
  }
})

const listViewMode = ref<TaskListViewMode>(readTaskListViewMode())
const taskDetailStyle = ref<TaskDetailStyle>(readTaskDetailStyle())
const taskListMetaVisibility = ref<TaskListMetaVisibility>(readTaskListMetaVisibility())

watch(listViewMode, (v) => {
  persistTaskListViewMode(v)
  saveCurrentNavListPrefs()
})
watch(taskDetailStyle, (v) => {
  persistTaskDetailStyle(v)
  saveCurrentNavListPrefs()
})
watch(taskListMetaVisibility, (v) => {
  persistTaskListMetaVisibility(v)
  saveCurrentNavListPrefs()
}, { deep: true })

const taskGroupBy = ref<TaskGroupBy>(readTaskGroupBy())
const taskSortBy = ref<TaskSortBy>(readTaskSortBy())
const quadrantPrefs = ref<QuadrantViewPreferences>(readQuadrantViewPreferences())

const quadrantLayoutOptions = computed(() => {
  const fromView = activeNavView.value?.quadrantOptions
  if (isQuadrantViewLayout.value && fromView) {
    return fromView
  }
  return {
    showCompleted: quadrantPrefs.value.showCompleted,
    enableGrouping: quadrantPrefs.value.enableGrouping,
    groupBy: quadrantPrefs.value.groupBy,
    sortBy: quadrantPrefs.value.sortBy
  }
})

function onQuadrantPrefsChange(prefs: QuadrantViewPreferences) {
  quadrantPrefs.value = prefs
}

watch(taskSortBy, (v) => {
  persistTaskSortBy(v)
  saveCurrentNavListPrefs()
})

/** 应用分组/排序后的列表行（含分组标题） */
const taskListLayout = computed(() =>
  buildTaskListLayout(listDisplayTasks.value, taskGroupBy.value, taskSortBy.value)
)

/** 看板自定义分组作用域：命名视图可固定 scopeKey，否则随侧栏导航 */
const kanbanScopeKeyValue = computed(() => {
  const fixed = viewStore.selectedView?.scopeKey?.trim()
  if (fixed) return fixed
  return kanbanScopeKey({
    categoryId: navViewId.value ? undefined : navCategoryId.value,
    smart: navViewId.value
      ? 'all'
      : navCategoryId.value === undefined
        ? navSmart.value
        : undefined
  })
})

/** 看板列内快捷添加默认清单 */
const kanbanDefaultCategoryId = computed(() => {
  if (typeof navCategoryId.value === 'string') return navCategoryId.value
  if (navCategoryId.value === null) return null
  return null
})

/** 看板选中的列：顶栏快捷添加写入该列；未选中则归入未分组 / 默认未开始 */
const kanbanSelectedColumnId = ref<string | null>(null)
const kanbanBoardMode = ref(readKanbanBoardMode())

/** 齿轮展示模式：仅 list/kanban（时间线仍仅命名视图） */
const gearViewMode = computed({
  get: (): 'list' | 'kanban' => (listViewMode.value === 'kanban' ? 'kanban' : 'list'),
  set: (mode: 'list' | 'kanban') => {
    listViewMode.value = mode
    if (mode === 'kanban') {
      const allowed: TaskGroupBy[] = ['time', 'tag', 'priority', 'status']
      if (!allowed.includes(taskGroupBy.value)) {
        taskGroupBy.value = 'status'
      }
      kanbanBoardMode.value = groupByToKanbanBoardMode(taskGroupBy.value)
    }
  }
})

/** 非命名视图：看板列跟分组条件；命名视图：用视图配置的 boardMode */
const effectiveKanbanBoardMode = computed<KanbanBoardMode>(() => {
  if (navViewId.value) return kanbanBoardMode.value
  return groupByToKanbanBoardMode(taskGroupBy.value)
})

watch(kanbanBoardMode, (mode) => {
  persistKanbanBoardMode(mode)
  kanbanSelectedColumnId.value = null
})

watch(
  taskGroupBy,
  (groupBy) => {
    persistTaskGroupBy(groupBy)
    if (!navViewId.value && listViewMode.value === 'kanban') {
      kanbanBoardMode.value = groupByToKanbanBoardMode(groupBy)
    }
    saveCurrentNavListPrefs()
  }
)

watch(kanbanSelectedColumnId, (colId) => {
  if (listViewMode.value !== 'kanban' || effectiveKanbanBoardMode.value !== 'priority') return
  const n = colId != null ? Number(colId) : NaN
  if (n === 1 || n === 2 || n === 3 || n === 4) {
    quickAddPriority.value = n
  }
})

watch(kanbanScopeKeyValue, () => {
  kanbanSelectedColumnId.value = null
})

/** 看板模式下顶栏快捷添加的目标分组（仅分组看板） */
function kanbanGroupIdForQuickAdd(): string | null | undefined {
  if (listViewMode.value !== 'kanban' || effectiveKanbanBoardMode.value !== 'group') return undefined
  const sel = kanbanSelectedColumnId.value
  if (!sel || sel === '__DONE__') return null
  if (sel === KANBAN_UNGROUPED_ID) return null
  return sel
}

/** 看板模式下顶栏快捷添加的初始状态（仅状态看板） */
function kanbanStatusForQuickAdd(): import('@shared/types').TaskStatus | undefined {
  if (listViewMode.value !== 'kanban' || effectiveKanbanBoardMode.value !== 'status') return undefined
  const sel = kanbanSelectedColumnId.value
  if (sel === 'IN_PROGRESS' || sel === 'DONE') return sel
  return 'TODO'
}

/** 看板级别列选中时，顶栏快捷添加使用该级别；否则用快捷栏选择的级别 */
function priorityForQuickAdd(): TaskPriority {
  if (listViewMode.value === 'kanban' && effectiveKanbanBoardMode.value === 'priority') {
    const sel = kanbanSelectedColumnId.value
    const n = sel != null ? Number(sel) : NaN
    if (n === 1 || n === 2 || n === 3 || n === 4) return n
  }
  return quickAddPriority.value
}

async function onKanbanChanged() {
  await taskStore.load()
}



const sidebarActiveSmart = computed<'inbox' | 'all' | 'last7days' | 'matrix' | 'done' | 'trash' | null>(() => {
  if (isSummaryView.value) return null
  if (navViewId.value) return null
  return navCategoryId.value !== undefined ? null : navSmart.value
})

const isSummaryView = computed(() => navSummaryActive.value)
const isSummaryConfigView = computed(() => navSummaryActive.value && navSummarySection.value === 'config')
const isSummaryResultsView = computed(() => navSummaryActive.value && navSummarySection.value === 'results')



const isDoneView = computed(
  () => navSmart.value === 'done' && navCategoryId.value === undefined && !navViewId.value
)

const isTrashView = computed(
  () => navSmart.value === 'trash' && navCategoryId.value === undefined && !navViewId.value
)

const isSpecialListView = computed(
  () => isDoneView.value || isTrashView.value || isSummaryView.value || isInboxView.value
)

const isInboxView = computed(
  () =>
    !navSummaryActive.value &&
    navSmart.value === 'inbox' &&
    navCategoryId.value === undefined &&
    !navViewId.value
)

const isMatrixView = computed(
  () =>
    !navSummaryActive.value &&
    navSmart.value === 'matrix' &&
    navCategoryId.value === undefined &&
    !navViewId.value
)

const isQuadrantViewLayout = computed(
  () => isViewNav.value && activeNavView.value?.layout === 'quadrant'
)

const isViewNav = computed(() => Boolean(navViewId.value) && !navSummaryActive.value)

const activeNavView = computed(() =>
  navViewId.value ? viewStore.items.find((v) => v.id === navViewId.value) ?? null : null
)

/** 时间线日历：按视图筛选的本周/本月（或 between）对齐，避免本周/本月共用滚动窗 */
const timelineRangePreset = computed<TimelineCalendarPreset>(() => {
  return inferTimelineCalendarPreset(activeNavView.value?.filterRule ?? null) ?? 'rolling'
})

const timelineRangeBetween = computed(() => {
  const between = inferTimelineBetweenRange(activeNavView.value?.filterRule ?? null)
  if (!between) return null
  return {
    start: between.start.format('YYYY-MM-DD'),
    end: between.end.format('YYYY-MM-DD')
  }
})

const completedCategoryFilter = computed(() => {
  if (doneListCategory.value === 'all') return undefined
  if (doneListCategory.value === 'uncategorized') return null
  return doneListCategory.value
})



const defaultCategoryForCreate = computed(() => {

  if (typeof navCategoryId.value === 'string') {

    return navCategoryId.value

  }

  return null

})

const parseCategoriesForMatch = computed(() => toParseCategories(categoryStore.categories))



const viewTitle = computed(() => {
  if (isSummaryConfigView.value) return '定时汇总配置'
  if (isSummaryResultsView.value) return '汇总结果'

  if (navViewId.value) {
    return viewStore.items.find((v) => v.id === navViewId.value)?.name ?? '视图'
  }

  if (navCategoryId.value === undefined) {

    if (navSmart.value === 'inbox') return '收件箱'

    if (navSmart.value === 'matrix') return '四象限'

    if (navSmart.value === 'done') return '已完成'

    if (navSmart.value === 'trash') return '垃圾桶'

    if (navSmart.value === 'last7days') return '最近7天'

    return '全部'

  }

  if (navCategoryId.value === null) {

    return '未分类'

  }

  const cat = categoryStore.categories.find((c) => c.id === navCategoryId.value)

  return cat?.name ?? '分类'

})



const quickAddPlaceholder = computed(
  () => `输入任务，可含「明天下午3点」「每天」「30分钟后」等，回车添加至「${viewTitle.value}」`
)



/** 侧栏展示用任务计数（仅顶层、与智能列表筛选规则一致） */
const taskCounts = computed(() => {
  const roots = taskStore.tasks.filter((t) => !t.parentId)
  const last7days = roots.filter((t) =>
    taskMatchesSmartListDate(t, 'last7days', listDateField.value)
  ).length
  return {
    all: roots.length,
    last7days,
    inbox: widgetNotes.value.length + taskStore.inboxCount
  }
})

const inboxTasks = computed(() => taskStore.tasks.filter(isUntriagedInboxTask))

/** 侧栏清单计数（基于当前列表数据，与智能列表计数同源） */
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



function buildHasSubtasksMap(tasks: Task[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const t of tasks) {
    if (t.parentId && !t.deletedAt) {
      map.set(t.parentId, true)
    }
  }
  return map
}

/** 在当前任务集上套用当前导航视图的 filterRule */
const listDisplayTasks = computed(() => {
  const all = taskStore.tasks
  if (isSpecialListView.value) return all
  const rule = activeNavView.value?.filterRule ?? null
  if (!isFilterRuleActive(rule)) return all
  const hasSubtasksById = buildHasSubtasksMap(all)
  return all.filter((t) => matchTask(t, rule!, { hasSubtasksById }))
})

/** 看板：在筛选结果上补齐已展示根任务的子任务 */
const kanbanDisplayTasks = computed(() => {
  const base = listDisplayTasks.value
  const rootIds = new Set(base.filter((t) => !t.parentId).map((t) => t.id))
  if (rootIds.size === 0) return base
  const idSet = new Set(base.map((t) => t.id))
  const extras = taskStore.tasks.filter(
    (t) => t.parentId && rootIds.has(t.parentId) && !idSet.has(t.id) && !t.deletedAt
  )
  return extras.length ? [...base, ...extras] : base
})

/** 四象限：与列表一致，仅在命名视图导航时应用 filterRule */
const matrixDisplayTasks = computed(() => {
  if (!isMatrixView.value && !isQuadrantViewLayout.value) {
    return taskStore.tasks
  }
  const all = taskStore.tasks
  const rule = activeNavView.value?.filterRule ?? null
  if (!isFilterRuleActive(rule)) {
    return all
  }
  const hasSubtasksById = buildHasSubtasksMap(all)
  const matchedIds = new Set(
    all.filter((t) => !t.parentId && matchTask(t, rule!, { hasSubtasksById })).map((t) => t.id)
  )
  return all.filter((t) => matchedIds.has(t.id) || (t.parentId != null && matchedIds.has(t.parentId)))
})

const visibleTasks = computed(() => {

  const all = listDisplayTasks.value

  const idSet = new Set(all.map((t) => t.id))

  const byParent = new Map<string | null, Task[]>()

  for (const t of all) {

    const key = t.parentId

    if (!byParent.has(key)) byParent.set(key, [])

    byParent.get(key)!.push(t)

  }



  const result: { task: Task; depth: number }[] = []

  const listed = new Set<string>()



  function walk(parentId: string | null, depth: number) {

    const children = byParent.get(parentId) ?? []

    for (const task of children) {

      result.push({ task, depth })

      listed.add(task.id)

      walk(task.id, depth + 1)

    }

  }

  walk(null, 0)



  for (const task of all) {

    if (listed.has(task.id)) continue

    if (task.parentId && !idSet.has(task.parentId)) {

      result.push({ task, depth: 0 })

      listed.add(task.id)

    }

  }



  return result

})

/** 列表标题旁计数：(未完成/全部)，顶层；分母不受 hideDone 影响 */
const headerTaskCounts = ref({ incomplete: 0, total: 0 })
let headerCountSeq = 0

function countRootTasks(tasks: Task[]): Task[] {
  const idSet = new Set(tasks.map((t) => t.id))
  return tasks.filter((t) => !t.parentId || !idSet.has(t.parentId))
}

async function refreshHeaderTaskCounts() {
  if (
    isSpecialListView.value ||
    isMatrixView.value ||
    isQuadrantViewLayout.value ||
    isSummaryView.value
  ) {
    return
  }
  const seq = ++headerCountSeq
  try {
    const filter = { ...taskStore.filter, hideDone: false }
    const res = await window.api.tasks.list(filter)
    if (!res.ok || seq !== headerCountSeq) return
    let tasks = res.data
    const rule = activeNavView.value?.filterRule ?? null
    if (isFilterRuleActive(rule)) {
      const hasSubtasksById = buildHasSubtasksMap(tasks)
      const matchedIds = new Set(
        tasks
          .filter((t) => !t.parentId && matchTask(t, rule!, { hasSubtasksById }))
          .map((t) => t.id)
      )
      tasks = tasks.filter(
        (t) => matchedIds.has(t.id) || (t.parentId != null && matchedIds.has(t.parentId))
      )
    }
    const roots = countRootTasks(tasks)
    if (seq !== headerCountSeq) return
    headerTaskCounts.value = {
      incomplete: roots.filter((t) => t.status !== 'DONE').length,
      total: roots.length
    }
  } catch {
    /* ignore */
  }
}

/** 列表标题旁计数（特殊页仍可能用到） */
const listDisplayCount = computed(() => {
  if (isDoneView.value) {
    return taskStore.tasks.filter((t) => t.status === 'DONE').length
  }
  if (isTrashView.value) {
    return taskStore.tasks.length
  }
  if (isMatrixView.value || isQuadrantViewLayout.value) {
    return matrixDisplayTasks.value.filter((t) => !t.parentId).length
  }
  if (isInboxView.value) {
    return widgetNotes.value.length + taskStore.inboxCount
  }
  return headerTaskCounts.value.total
})

function syncNavFromFilter() {
  const f = taskStore.filter

  if (f.smartList === 'done') {

    navCategoryId.value = undefined

    navSmart.value = 'done'

    return

  }

  if (f.smartList === 'trash') {

    navCategoryId.value = undefined

    navSmart.value = 'trash'

    return

  }

  if (isMatrixListFilter(f)) {

    navCategoryId.value = undefined

    navSmart.value = 'matrix'

    return

  }

  if (f.categoryId !== undefined) {

    navCategoryId.value = f.categoryId

    return

  }

  navCategoryId.value = undefined

  navSmart.value = smartListToNav(f.smartList)

  if (f.dateField) {
    listDateField.value = f.dateField
  }
  if (f.doneTimeRange) {
    doneTimeRange.value = f.doneTimeRange
  }
  if (f.doneTimeRange === 'custom' && f.dateFrom && f.dateTo) {
    doneCustomRange.value = [f.dateFrom.slice(0, 10), f.dateTo.slice(0, 10)]
  }

}



function smartListToNav(smart?: SmartList): 'all' | 'today' | 'week' | 'last7days' {
  if (smart === 'today') return 'today'
  if (smart === 'week') return 'week'
  if (smart === 'last7days') return 'last7days'
  return 'all'
}



let applyingNavListPrefs = false

function currentNavListPrefsKey(): string | null {
  if (navViewId.value) return null
  if (navSummaryActive.value) return null
  if (navCategoryId.value !== undefined) {
    return navListPrefsScopeKey({ categoryId: navCategoryId.value })
  }
  if (navSmart.value === 'all' || navSmart.value === 'last7days') {
    return navListPrefsScopeKey({ smart: navSmart.value })
  }
  return null
}

function applyNavListPrefs() {
  const key = currentNavListPrefsKey()
  if (!key) return
  const prefs = readNavListPrefs(key)
  applyingNavListPrefs = true
  listViewMode.value = prefs.viewMode
  taskGroupBy.value = prefs.groupBy
  taskSortBy.value = prefs.sortBy
  taskDetailStyle.value = prefs.detailStyle
  taskListMetaVisibility.value = { ...prefs.metaVisibility }
  if (prefs.viewMode === 'kanban') {
    kanbanBoardMode.value = groupByToKanbanBoardMode(prefs.groupBy)
  }
  void taskStore.setHideDone(prefs.hideDone)
  applyingNavListPrefs = false
}

function saveCurrentNavListPrefs() {
  if (applyingNavListPrefs) return
  const key = currentNavListPrefsKey()
  if (!key) return
  const prefs: NavListPrefs = {
    viewMode: listViewMode.value === 'kanban' ? 'kanban' : 'list',
    groupBy: taskGroupBy.value,
    sortBy: taskSortBy.value,
    hideDone: taskStore.filter.hideDone,
    detailStyle: taskDetailStyle.value,
    metaVisibility: { ...taskListMetaVisibility.value }
  }
  persistNavListPrefs(key, prefs)
  persistTaskListViewMode(prefs.viewMode)
  persistTaskGroupBy(prefs.groupBy)
  persistTaskSortBy(prefs.sortBy)
  persistTaskDetailStyle(prefs.detailStyle)
  persistTaskListMetaVisibility(prefs.metaVisibility)
}

/** @deprecated 用 applyNavListPrefs；保留给命名视图离开时的兜底 */
function restoreListPrefsFromStorage() {
  applyNavListPrefs()
}

function applySelectedViewToUi() {
  const view = viewStore.selectedView
  if (!view) return
  if (view.layout === 'quadrant') {
    const opts = view.quadrantOptions ?? readQuadrantViewPreferences()
    quadrantPrefs.value = { ...opts }
    persistQuadrantViewPreferences(quadrantPrefs.value)
  } else {
    viewStore.applyViewToRefs({ listViewMode, taskGroupBy, taskSortBy, kanbanBoardMode })
    const applied = deriveAppliedViewState(view)
    persistTaskListViewMode(applied.layout)
    persistTaskGroupBy(applied.groupBy)
    persistTaskSortBy(applied.sortBy)
    if (applied.kanbanBoardMode) {
      persistKanbanBoardMode(applied.kanbanBoardMode)
    }
  }

  const applied = deriveAppliedViewState(view)
  const kanbanMode = view.layout === 'kanban' ? view.kanbanBoardMode ?? 'group' : null
  const display = readViewDisplayPreferences(view.id, kanbanMode)
  taskDetailStyle.value = display.detailStyle
  taskListMetaVisibility.value = { ...display.metaVisibility }
  void taskStore.setHideDone(display.hideDone)
}

async function onView(id: string) {
  if (!viewStore.items.some((v) => v.id === id)) {
    await onSmart('all')
    return
  }
  navSummaryActive.value = false
  navViewId.value = id
  viewStore.selectView(id)
  applySelectedViewToUi()
  navCategoryId.value = undefined
  navSmart.value = 'all'
  detailOpen.value = false
  await taskStore.load({ smartList: 'all', hideDone: taskStore.filter.hideDone })
  void router.replace({ path: '/', query: { viewId: id } })
}

const viewEditorHideDone = ref(true)
const viewEditorDetailStyle = ref<TaskDetailStyle>('sidebar')
const viewEditorMetaVisibility = ref<TaskListMetaVisibility>({
  ...DEFAULT_TASK_LIST_META_VISIBILITY
})

function seedViewEditorFrom(view = viewStore.selectedView) {
  viewEditorName.value = view?.name ?? ''
  viewEditorLayout.value = view?.layout ?? 'list'
  viewEditorGroupBy.value = view?.groupBy ?? 'none'
  viewEditorSortBy.value = view?.sortBy ?? 'custom'
  viewEditorKanbanMode.value = view?.kanbanBoardMode ?? 'group'
  viewEditorQuadrantOptions.value = view?.quadrantOptions ?? null
  viewEditorRule.value = view?.filterRule ?? null
  viewEditorScopeKey.value = view?.scopeKey ?? null
  const mode = view?.layout === 'kanban' ? view.kanbanBoardMode ?? 'group' : null
  const display = view?.id
    ? readViewDisplayPreferences(view.id, mode)
    : defaultViewDisplayPreferences(mode)
  viewEditorHideDone.value = display.hideDone
  viewEditorDetailStyle.value = display.detailStyle
  viewEditorMetaVisibility.value = { ...display.metaVisibility }
}

function openCreateView() {
  viewEditorMode.value = 'create'
  viewEditorId.value = null
  viewEditorName.value = ''
  viewEditorLayout.value = 'list'
  viewEditorGroupBy.value = 'none'
  viewEditorSortBy.value = 'custom'
  viewEditorKanbanMode.value = 'group'
  viewEditorQuadrantOptions.value = null
  viewEditorRule.value = null
  viewEditorScopeKey.value = null
  const display = defaultViewDisplayPreferences(null)
  viewEditorHideDone.value = display.hideDone
  viewEditorDetailStyle.value = taskDetailStyle.value
  viewEditorMetaVisibility.value = { ...taskListMetaVisibility.value }
  viewEditorVisible.value = true
}

async function onCreateViewFromTemplate(templateId: import('@shared/view-templates').ViewTemplateId) {
  try {
    const created = await viewStore.createFromTemplate(templateId)
    await onView(created.id)
    ElMessage.success(`已从模板创建：${created.name}`)
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

function openEditView(id?: string) {
  const targetId = id ?? viewStore.selectedViewId
  const item = viewStore.items.find((v) => v.id === targetId)
  if (!item) return
  viewEditorMode.value = 'edit'
  viewEditorId.value = item.id
  seedViewEditorFrom(item)
  viewEditorVisible.value = true
}

function openSaveAsView(id?: string) {
  const targetId = id ?? viewStore.selectedViewId
  const item = viewStore.items.find((v) => v.id === targetId) ?? viewStore.selectedView
  viewEditorMode.value = 'save-as'
  viewEditorId.value = null
  seedViewEditorFrom(item)
  viewEditorName.value = `${item?.name ?? '视图'} 副本`
  viewEditorVisible.value = true
}

async function onViewEditorSaved(savedId?: string) {
  await viewStore.load()
  if (savedId) {
    navViewId.value = savedId
    viewStore.selectView(savedId)
    applySelectedViewToUi()
    await taskStore.load({ smartList: 'all', hideDone: taskStore.filter.hideDone })
  }
}

async function onSmart(smart: 'all' | 'last7days') {
  navSummaryActive.value = false
  navViewId.value = null
  navSmart.value = smart
  navCategoryId.value = undefined
  applyNavListPrefs()
  await taskStore.navigate({
    kind: 'smart',
    smart,
    dateField: isDueSmartList(smart) ? listDateField.value : undefined
  })
  void router.replace({
    path: '/',
    query: smart === 'all' ? {} : { smart }
  })
}



async function onInbox() {
  navSummaryActive.value = false
  navViewId.value = null
  navSmart.value = 'inbox'
  navCategoryId.value = undefined
  detailOpen.value = false
  closeNoteDetail()
  await loadWidgetNotes()
  await taskStore.load({ smartList: 'all', hideDone: false })
  void router.replace({ path: '/', query: { view: 'inbox' } })
}

async function loadWidgetNotes() {
  const res = await window.api.widgetNotes.list()
  if (res.ok) {
    widgetNotes.value = res.data
  }
}

async function openInboxConvertNote(note: WidgetNote) {
  const res = await window.api.widgetNotes.convertToTask(note.id, { deleteNote: true })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  if (activeNoteId.value === note.id) closeNoteDetail()
  ElMessage.success(`已加入收件箱：${res.data.title}`)
  await loadWidgetNotes()
  await taskStore.load()
}

async function onInboxDeleteNote(noteId: string) {
  const res = await window.api.widgetNotes.delete(noteId)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  if (activeNoteId.value === noteId) closeNoteDetail()
  await loadWidgetNotes()
}

async function onInboxTriageTask(taskId: string, priority: TaskPriority) {
  try {
    await taskStore.update(taskId, { priority })
    ElMessage.success(`已设为 ${getTaskPriorityMeta(priority).code}`)
  } catch {
    /* store 已 Toast */
  }
}

async function onMatrix() {
  navSummaryActive.value = false
  navViewId.value = null
  navSmart.value = 'matrix'
  navCategoryId.value = undefined
  await taskStore.navigate({ kind: 'matrix' })
  void router.replace({ path: '/', query: { view: 'matrix' } })
}



async function onSummary(section: SummarySection) {
  navSummaryActive.value = true
  navSummarySection.value = section
  navViewId.value = null
  navCategoryId.value = undefined
  detailOpen.value = false
  activeTaskId.value = null
  void router.replace({ path: '/', query: { view: 'summary', section } })
}

async function onListDateFieldChange(field: TaskDateField) {
  persistListDateField(field)
  if (showSmartDateFieldFilter.value) {
    await taskStore.load({ dateField: field })
  }
}

function doneNavigatePayload() {
  const payload: {
    kind: 'done'
    doneTimeRange: DoneTimeRange
    dateFrom?: string | null
    dateTo?: string | null
  } = { kind: 'done', doneTimeRange: doneTimeRange.value }
  if (doneTimeRange.value === 'custom' && doneCustomRange.value?.length === 2) {
    payload.dateFrom = `${doneCustomRange.value[0]}T00:00:00`
    payload.dateTo = `${doneCustomRange.value[1]}T23:59:59`
  }
  return payload
}

async function onDoneTimeRangeChange(range: DoneTimeRange) {
  persistDoneTimeRange(range)
  if (!isDoneView.value) return
  if (range === 'custom') {
    if (doneCustomRange.value?.length === 2) {
      await taskStore.navigate(doneNavigatePayload())
    }
    return
  }
  await taskStore.navigate({ kind: 'done', doneTimeRange: range, dateFrom: null, dateTo: null })
}

async function onDoneCustomRangeChange(val: [string, string] | null) {
  if (!isDoneView.value || !val || val.length !== 2) return
  await taskStore.navigate({
    kind: 'done',
    doneTimeRange: 'custom',
    dateFrom: `${val[0]}T00:00:00`,
    dateTo: `${val[1]}T23:59:59`
  })
}

async function onDone() {
  navSummaryActive.value = false
  navViewId.value = null
  navSmart.value = 'done'
  navCategoryId.value = undefined
  doneListCategory.value = 'all'
  detailOpen.value = false
  await taskStore.navigate(doneNavigatePayload())
  void router.replace({ path: '/', query: { view: 'done' } })
}

function onCalendar(mode: CalendarViewMode) {
  void router.push({ path: '/calendar', query: { view: mode } })
}

async function onSelectTasks() {
  await onSmart('all')
}

async function onTrash() {
  navSummaryActive.value = false
  navViewId.value = null
  navSmart.value = 'trash'
  navCategoryId.value = undefined
  detailOpen.value = false
  activeTaskId.value = null
  await taskStore.navigate({ kind: 'trash' })
  void router.replace({ path: '/', query: { view: 'trash' } })
}

function selectTrashTask(id: string) {

  activeTaskId.value = id

}



async function onRestoreTrash(task: Task) {

  try {

    await taskStore.restoreFromTrash(task.id)

    if (activeTaskId.value === task.id) {

      activeTaskId.value = null

    }

    ElMessage.success('任务已恢复')

  } catch {

    /* unwrapIpc 已 Toast */

  }

}



async function onPurgeTrash(task: Task) {

  const childCount = taskStore.tasks.filter((t) => t.parentId === task.id).length

  try {

    if (childCount > 0) {

      await ElMessageBox.confirm(

        `任务「${task.title}」下有 ${childCount} 个子任务，确定一并彻底删除吗？`,

        '彻底删除',

        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }

      )

      await taskStore.purgeFromTrash(task.id, { cascadeChildren: true })

    } else {

      await taskStore.purgeFromTrash(task.id)

    }

    if (activeTaskId.value === task.id) {

      activeTaskId.value = null

    }

    ElMessage.success('已彻底删除')

  } catch {

    /* 用户取消或 unwrapIpc 已 Toast */

  }

}



async function onEmptyTrash() {

  if (taskStore.tasks.length === 0) {

    ElMessage.info('垃圾桶已是空的')

    return

  }

  try {

    await ElMessageBox.confirm(

      `确定清空垃圾桶中的 ${taskStore.tasks.length} 项任务？此操作不可恢复。`,

      '清空垃圾桶',

      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' }

    )

    const n = await taskStore.emptyTrashBin()

    activeTaskId.value = null

    ElMessage.success(`已清空 ${n} 项`)

  } catch {

    /* 用户取消 */

  }

}



async function onCategory(id: string | null) {
  navSummaryActive.value = false
  navViewId.value = null
  navCategoryId.value = id
  applyNavListPrefs()

  if (id === null) {
    await taskStore.navigate({ kind: 'uncategorized' })
    void router.replace({ path: '/', query: { category: 'uncategorized' } })
  } else {
    await taskStore.navigate({ kind: 'category', categoryId: id })
    void router.replace({ path: '/', query: { category: id } })
  }
}



function onShowCompletedChange(show: boolean | string | number) {

  taskStore.setHideDone(!Boolean(show))

}



async function onQuickAdd() {

  const title = quickAddText.value.trim()

  if (!title) return

  try {

    const kanbanGid = kanbanGroupIdForQuickAdd()
    const kanbanStatus = kanbanStatusForQuickAdd()
    const timelineDay = pendingTimelineDateKey.value

    const quickOpts: Parameters<typeof taskStore.quickCreate>[1] = {
      categoryId: defaultCategoryForCreate.value ?? null,
      priority: quickAddPriority.value,
      kanbanGroupId: kanbanGid !== undefined ? kanbanGid : undefined,
      status: kanbanStatus,
      parseCategories: parseCategoriesForMatch.value,
      ...(timelineDay ? { dueAt: `${timelineDay}T18:00:00` } : {})
    }

    if (listViewMode.value === 'kanban' && effectiveKanbanBoardMode.value === 'priority') {
      const sel = kanbanSelectedColumnId.value
      const n = sel != null ? Number(sel) : NaN
      if (n === 1 || n === 2 || n === 3 || n === 4) {
        quickOpts.priority = n as TaskPriority
        quickOpts.triagedAt = nowIso()
      }
    }

    const created = await taskStore.quickCreate(title, quickOpts)

    pendingTimelineDateKey.value = null

    quickAddText.value = ''

    // 级别看板：选中目标列，方便确认任务落在哪一列
    if (listViewMode.value === 'kanban' && effectiveKanbanBoardMode.value === 'priority' && created?.priority) {
      kanbanSelectedColumnId.value = String(created.priority)
      quickAddPriority.value = created.priority
    } else {
      quickAddPriority.value = DEFAULT_TASK_PRIORITY
    }

    ElMessage.success('任务已添加')

  } catch (err) {

    ElMessage.error(err instanceof Error ? err.message : '添加任务失败')

  }

}

async function onTimelineSchedule(taskId: string, dateKey: string) {
  try {
    await taskStore.update(taskId, {
      dueAt: `${dateKey}T18:00:00`
    })
  } catch {
    /* store 已 Toast */
  }
}

function onTimelineCreateOnDay(dateKey: string) {
  pendingTimelineDateKey.value = dateKey
  void nextTick(() => quickAddInputRef.value?.focus())
  ElMessage.info(`将创建到 ${dateKey}，请输入标题后回车`)
}

async function onTimelineUpdateSpan(
  taskId: string,
  span: { createdAt: string; dueAt: string | null }
) {
  try {
    await taskStore.update(taskId, { createdAt: span.createdAt, dueAt: span.dueAt })
  } catch {
    /* store 已 Toast；时间线组件会在下次 props 刷新时回滚预览 */
  }
}



async function onTaskSaved({ task, mode }: TaskSavePayload) {

  const stayOnMatrix = isMatrixView.value

  await taskStore.afterSave(task, mode)

  if (stayOnMatrix) {

    navSmart.value = 'matrix'

    navCategoryId.value = undefined

  } else {

    syncNavFromFilter()

  }



  if (mode === 'delete') {

    activeTaskId.value = null

    detailOpen.value = false

    detailPanelExpanded.value = false

    ElMessage.success('任务已删除')

    return

  }



  if (task) {

    activeTaskId.value = task.id

  }

  detailOpen.value = false

  detailPanelExpanded.value = false

  ElMessage.success(mode === 'create' ? '任务已创建' : '任务已保存')

}



function openNewTask() {

  defaultPriorityForCreate.value = DEFAULT_TASK_PRIORITY
  quickAddPriority.value = DEFAULT_TASK_PRIORITY

  void nextTick(() => quickAddInputRef.value?.focus())

}



async function onQuadrantQuickCreate(priority: TaskPriority) {

  const meta = getTaskPriorityMeta(priority)

  try {

    const { value } = await ElMessageBox.prompt('输入标题即可添加，详情可稍后点击任务补充', `添加到「${meta.quadrantTitle}」`, {

      confirmButtonText: '添加',

      cancelButtonText: '取消',

      inputPlaceholder: '任务标题',

      inputValidator: (v) => (v?.trim() ? true : '请输入标题')

    })

    const title = value?.trim()

    if (!title) return

    await taskStore.quickCreate(title, { priority, parseCategories: parseCategoriesForMatch.value })

    ElMessage.success('任务已添加')

  } catch {

    /* 用户取消 */

  }

}



function openTask(id: string) {
  closeNoteDetail()
  activeTaskId.value = id
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  activeTaskId.value = null
  void taskStore.fetchWithCurrentFilter()
}

const activeNote = computed(() =>
  activeNoteId.value ? widgetNotes.value.find((n) => n.id === activeNoteId.value) ?? null : null
)

function openInboxNote(noteId: string) {
  closeDetail()
  activeNoteId.value = noteId
  noteDetailOpen.value = true
}

function closeNoteDetail() {
  noteDetailOpen.value = false
  activeNoteId.value = null
}

function onDetailScrimClick() {
  if (noteDetailOpen.value) {
    closeNoteDetail()
    return
  }
  closeDetail()
}

async function onInboxNoteChanged() {
  await loadWidgetNotes()
}

function onDetailDialogVisible(visible: boolean) {
  if (!visible) closeDetail()
}



async function onToggleStatus(task: Task) {

  // 列表复选框为二态：非 DONE 视为未完成，点击后在 TODO/DONE 间切换（不再经 IN_PROGRESS 循环）
  const next: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE'

  try {

    await taskStore.update(task.id, { status: next })

  } catch {

    /* store 内 unwrapIpc 已 Toast */

  }

}

async function onReorderRoots(ids: string[]) {
  taskSortBy.value = 'custom'
  persistTaskSortBy('custom')
  try {
    await taskStore.reorder(ids)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '任务排序失败')
    await taskStore.load()
  }
}

async function onChangePriority(taskId: string, priority: TaskPriority) {

  try {

    await taskStore.update(taskId, { priority })

  } catch {

    /* store 内 unwrapIpc 已 Toast */

  }

}



function onFocusQuickAdd() {

  quickAddInputRef.value?.focus()

}



function hasHomeRouteDestination(): boolean {
  const view = route.query.view
  const smart = route.query.smart
  const category = route.query.category
  const viewId = route.query.viewId
  const listView = route.query.listView
  return (
    view === 'matrix' ||
    view === 'inbox' ||
    view === 'summary' ||
    view === 'done' ||
    view === 'trash' ||
    smart === 'today' ||
    smart === 'week' ||
    smart === 'last7days' ||
    smart === 'all' ||
    listView === 'list' ||
    listView === 'kanban' ||
    listView === 'timeline' ||
    typeof category === 'string' ||
    typeof viewId === 'string'
  )
}

onMounted(async () => {
  await categoryStore.load()
  await viewStore.load()
  // 有路由目标时先按路由恢复，避免先落到「全部」再跳四象限
  if (hasHomeRouteDestination()) {
    await syncHomeFromRoute()
  } else {
    navViewId.value = null
    applyNavListPrefs()
    await taskStore.load({ smartList: 'all', hideDone: taskStore.filter.hideDone })
    syncNavFromFilter()
  }
  await taskStore.refreshSidebarCounts()
  await loadWidgetNotes()
  void refreshHeaderTaskCounts()
  window.addEventListener('desktop:new-task', openNewTask)
  window.addEventListener('desktop:focus-search', onFocusQuickAdd)
})

watch(
  [
    () => taskStore.tasks,
    () => taskStore.filter,
    () => navViewId.value,
    () => navCategoryId.value,
    () => navSmart.value,
    () => activeNavView.value?.id
  ],
  () => {
    void refreshHeaderTaskCounts()
  }
)

/**
 * 从路由恢复首页视图（日历等页跳回时会带 query）。
 * 覆盖 matrix / summary / done / trash / smart / category。
 */
async function syncHomeFromRoute() {
  try {
  const view = route.query.view
  const smart = route.query.smart
  const category = route.query.category
  const viewId = route.query.viewId
  const listView = route.query.listView
  const createView = route.query.createView
  const editView = route.query.editView

  if (listView === 'list' || listView === 'kanban' || listView === 'timeline') {
    if (listViewMode.value !== listView) {
      listViewMode.value = listView
      persistTaskListViewMode(listView)
    }
    if (listView === 'kanban' && (typeof viewId !== 'string' || !viewId)) {
      kanbanBoardMode.value = readKanbanBoardMode()
    }
  }

  if (createView === '1') {
    openCreateView()
    void router.replace({ path: '/', query: {} })
    return
  }

  if (typeof viewId === 'string' && viewId) {
    if (navViewId.value !== viewId || navSummaryActive.value) {
      await onView(viewId)
    }
    if (editView === '1') {
      openEditView(viewId)
      void router.replace({ path: '/', query: { viewId } })
    }
    return
  }

  if (view === 'inbox') {
    if (navSmart.value !== 'inbox' || navSummaryActive.value) {
      await onInbox()
    }
    return
  }
  if (view === 'matrix') {
    if (!(navSmart.value === 'matrix' && !navSummaryActive.value && navCategoryId.value === undefined)) {
      await onMatrix()
    }
    return
  }
  if (view === 'summary') {
    const section = route.query.section === 'results' ? 'results' : 'config'
    if (!(navSummaryActive.value && navSummarySection.value === section)) {
      await onSummary(section)
    }
    return
  }
  if (view === 'done') {
    if (navSmart.value !== 'done' || navSummaryActive.value) {
      await onDone()
    }
    return
  }
  if (view === 'trash') {
    if (navSmart.value !== 'trash' || navSummaryActive.value) {
      await onTrash()
    }
    return
  }
  if (smart === 'today' || smart === 'week') {
    await onSmart('all')
    void router.replace({ path: '/', query: {} })
    return
  }
  if (smart === 'last7days' || smart === 'all') {
    if (navSmart.value !== smart || navSummaryActive.value || navCategoryId.value !== undefined) {
      await onSmart(smart)
    }
    return
  }
  if (typeof category === 'string') {
    const id = category === 'uncategorized' ? null : category
    if (navCategoryId.value !== id || navSummaryActive.value) {
      await onCategory(id)
    }
  }
  } finally {
    const taskId = route.query.taskId
    if (typeof taskId === 'string' && taskId.trim() && route.query.createView !== '1') {
      openTask(taskId.trim())
    }
  }
}

watch(
  () => [
    route.query.view,
    route.query.section,
    route.query.smart,
    route.query.category,
    route.query.viewId,
    route.query.listView,
    route.query.taskId
  ],
  () => {
    void syncHomeFromRoute()
  }
)


watch(
  () => viewStore.selectedViewId,
  (id) => {
    if (id && navViewId.value && navViewId.value !== id) {
      navViewId.value = id
      applySelectedViewToUi()
    }
  }
)

onUnmounted(() => {

  window.removeEventListener('desktop:new-task', openNewTask)

  window.removeEventListener('desktop:focus-search', onFocusQuickAdd)

})

</script>



<style scoped lang="scss">

.home {

  display: flex;

  height: 100vh;

  background: var(--desktop-bg);

}



.home__workspace {

  position: relative;

  flex: 1;

  display: flex;

  min-width: 0;

  overflow: hidden;

}



.home__list-pane {

  flex: 1;

  display: flex;

  flex-direction: column;

  width: 100%;

  min-width: 0;

  min-height: 0;

  overflow: hidden;

  background: var(--desktop-panel);

  transition: padding-right 0.2s ease;



  &.is-detail-open {

    padding-right: min(400px, 92vw);

  }



  &.is-detail-open.is-detail-expanded {

    padding-right: min(720px, 62vw);

  }

}



.home__summary-pane {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* 点击列表区域关闭详情；详情面板 z-index 更高且 @click.stop */
.home__detail-scrim {
  position: absolute;
  inset: 0;
  z-index: 15;
  background: transparent;
}



/* 详情面板浮于列表之上，避免挤压任务列表与标题 */
.home__detail {

  position: absolute;

  top: 0;

  right: 0;

  bottom: 0;

  z-index: 20;

  box-shadow: -6px 0 24px rgba(15, 23, 42, 0.08);

}



.home__detail-dialog {
  :deep(.el-dialog__header) {
    display: none;
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.home__list-header {

  display: flex;

  align-items: flex-end;

  justify-content: space-between;

  gap: 16px;

  padding: 20px 20px 12px;

  border-bottom: 1px solid var(--desktop-border);

}



.home__list-head-left {

  display: flex;

  align-items: baseline;

  gap: 10px;

  flex: 1;

  min-width: 0;

  overflow: hidden;

}



.home__view-title {

  margin: 0;

  font-size: 22px;

  font-weight: 700;

  color: var(--desktop-text);

  min-width: 0;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.home__view-count {

  font-size: 13px;

  color: var(--desktop-muted);

  flex-shrink: 0;

}



.home__done-category-filter,
.home__date-field-filter,
.home__done-time-filter {
  width: 128px;
  flex-shrink: 0;
}

.home__done-custom-range {
  flex-shrink: 0;
  max-width: 260px;
}



.home__empty-trash {
  font-size: 18px;
  color: var(--desktop-muted);

  &:hover {
    color: var(--el-color-danger);
  }
}



.home__list-actions {

  display: flex;

  align-items: center;

  gap: 10px;

  flex-shrink: 0;

}



.home__show-done {

  display: flex;

  align-items: center;

  gap: 8px;

  font-size: 13px;

  color: var(--desktop-muted);

  cursor: pointer;

  user-select: none;

}



.home__ai {

  --el-button-text-color: var(--desktop-ai);

  --el-button-border-color: var(--desktop-ai-border);

  --el-button-bg-color: var(--desktop-ai-light);

  --el-button-hover-text-color: var(--desktop-ai-hover-solid);

  --el-button-hover-border-color: var(--desktop-ai);

  --el-button-hover-bg-color: var(--desktop-ai-hover);

  --el-button-active-text-color: var(--desktop-ai-active);

  --el-button-active-border-color: var(--desktop-ai-active);

  --el-button-active-bg-color: var(--desktop-ai-hover);

}



.home__ai-icon {

  margin-right: 2px;

  font-size: 14px;

}



.home__quick-add {

  display: flex;

  align-items: flex-start;

  gap: 8px;

  margin: 12px 16px;

  padding: 8px 14px;

  min-height: 40px;

  border-radius: 20px;

  background: var(--desktop-bg);

  border: 1px solid transparent;

  transition: border-color 0.15s, box-shadow 0.15s;



  &:focus-within {

    border-color: var(--el-color-primary-light-5);

    box-shadow: 0 0 0 2px var(--desktop-active);

  }

}



.home__quick-add-icon {

  color: var(--desktop-muted);

  font-size: 16px;

  flex-shrink: 0;

  margin-top: 3px;

}

.home__quick-add-priority {
  flex-shrink: 0;
  align-self: center;
}
</style>


