<template>

  <div class="home">

    <AppSidebar

      :active-smart="sidebarActiveSmart"

      :active-category="navCategoryId"

      :task-counts="taskCounts"
      :category-counts="sidebarListCounts.byId"
      :uncategorized-count="sidebarListCounts.uncategorized"
      :trash-count="taskStore.trashCount"
      :done-count="taskStore.doneCount"
      :summary-active="isSummaryView"
      :active-summary-section="navSummarySection"
      @select-smart="onSmart"
      @select-matrix="onMatrix"
      @select-summary="onSummary"
      @select-done="onDone"
      @select-trash="onTrash"
      @select-calendar="onCalendar"
      @select-tasks="onSelectTasks"
      @select-category="onCategory"

      @open-settings="router.push('/settings')"
      @open-task="openTask"

    />



    <div class="home__workspace">

      <section
        class="home__list-pane"
        :class="{
          'is-detail-open': detailOpen && taskDetailStyle === 'sidebar',
          'is-detail-expanded': detailPanelExpanded && taskDetailStyle === 'sidebar'
        }"
      >

        <header class="home__list-header">

          <div class="home__list-head-left">

            <h1 class="home__view-title">{{ viewTitle }}</h1>

            <span v-if="!isSpecialListView" class="home__view-count">{{ listDisplayCount }} 项</span>

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

            <TaskListGroupSortPopover
              v-if="showTaskListGroupSort"
              v-model:group-by="taskGroupBy"
              v-model:sort-by="taskSortBy"
            />

            <TaskListViewMenu
              v-if="showListViewMenu"
              v-model:view-mode="listViewMode"
              v-model:hide-done="hideDoneModel"
              v-model:detail-style="taskDetailStyle"
              v-model:meta-visibility="taskListMetaVisibility"
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



        <div v-if="!isSpecialListView && !isMatrixView" class="home__quick-add">

          <el-icon class="home__quick-add-icon"><Plus /></el-icon>

          <QuickAddInput

            ref="quickAddInputRef"

            v-model="quickAddText"

            :placeholder="quickAddPlaceholder"

            :categories="categoryStore.categories.map((c) => ({ id: c.id, name: c.name }))"

            @enter="onQuickAdd"

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

        <QuadrantMatrixView
          v-else-if="isMatrixView"
          :tasks="taskStore.tasks"
          :categories="categoryStore.categories"
          :loading="taskStore.loading"
          :show-completed="!taskStore.filter.hideDone"
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
          :scope-key="kanbanScopeKeyValue"
          :tasks="taskStore.tasks"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :hide-done="taskStore.filter.hideDone"
          :meta-visibility="taskListMetaVisibility"
          :default-category-id="kanbanDefaultCategoryId"
          :parse-categories="categoryStore.categories.map((c) => ({ id: c.id, name: c.name }))"
          @select="openTask"
          @toggle-status="onToggleStatus"
          @changed="onKanbanChanged"
        />

        <TaskTimelineView
          v-else-if="listViewMode === 'timeline'"
          :tasks="taskStore.tasks"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          @select="openTask"
        />

        <TaskList
          v-else
          :layout-items="taskListLayout"
          :loading="taskStore.loading"
          :selected-id="activeTaskId"
          :meta-visibility="taskListMetaVisibility"
          @select="openTask"
          @toggle-status="onToggleStatus"
        />

      </section>



      <div
        v-if="detailOpen && taskDetailStyle === 'sidebar'"
        class="home__detail-scrim"
        @click="closeDetail"
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
          :emphasize-category="isMatrixView"
          @close="closeDetail"
          @saved="onTaskSaved"
        />
      </el-dialog>

    </div>

  </div>

</template>



<script setup lang="ts">

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Plus, Delete } from '@element-plus/icons-vue'

import { useRoute, useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'

import AppSidebar from '@/components/AppSidebar.vue'

import TaskList from '@/components/TaskList.vue'
import TaskListGroupSortPopover from '@/components/TaskListGroupSortPopover.vue'
import TaskListViewMenu from '@/components/TaskListViewMenu.vue'
import TaskKanbanView from '@/components/TaskKanbanView.vue'
import QuickAddInput from '@/components/QuickAddInput.vue'
import TaskTimelineView from '@/components/TaskTimelineView.vue'

import CompletedTaskList from '@/components/CompletedTaskList.vue'

import TrashTaskList from '@/components/TrashTaskList.vue'

import QuadrantMatrixView from '@/components/QuadrantMatrixView.vue'
import SummaryResultsView from '@/components/SummaryResultsView.vue'
import SettingsSummarySection from '@/components/settings/SettingsSummarySection.vue'

import TaskDetailPanel from '@/components/TaskDetailPanel.vue'

import type { TaskSavePayload } from '@/components/TaskDetailPanel.vue'

import { useTaskStore } from '@/stores/task-store'

import { useCategoryStore } from '@/stores/category-store'

import type { Task, TaskStatus } from '@shared/types'

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
  readTaskDetailStyle,
  readTaskListMetaVisibility,
  readTaskListViewMode,
  persistTaskDetailStyle,
  persistTaskListMetaVisibility,
  persistTaskListViewMode
} from '@/utils/list-view-preferences'
import type { CalendarViewMode } from '@shared/calendar-tasks'



const router = useRouter()
const route = useRoute()

const taskStore = useTaskStore()

const categoryStore = useCategoryStore()



const quickAddText = ref('')

const quickAddInputRef = ref<InstanceType<typeof QuickAddInput>>()

const detailOpen = ref(false)

const detailPanelExpanded = ref(false)

const activeTaskId = ref<string | null>(null)

const defaultPriorityForCreate = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)



const navCategoryId = ref<string | null | undefined>(undefined)

const navSmart = ref<'all' | 'today' | 'week' | 'last7days' | 'matrix' | 'done' | 'trash'>('all')
const navSummaryActive = ref(false)
type SummarySection = 'config' | 'results'
const navSummarySection = ref<SummarySection>('config')

/** 已完成页「所有清单」筛选：all=不过滤；uncategorized=未分类；否则为清单 id */
const doneListCategory = ref<'all' | 'uncategorized' | string>('all')

/** 今天/本周/最近7天：按哪列时间筛选（默认到期时间） */
const listDateField = ref<TaskDateField>(readListDateField())

/** 已完成页时间范围 */
const doneTimeRange = ref<DoneTimeRange>(readDoneTimeRange())
const doneCustomRange = ref<[string, string] | null>(null)

const dateFieldLabels = TASK_DATE_FIELD_LABELS
const doneTimeRangeLabels = DONE_TIME_RANGE_LABELS

const showSmartDateFieldFilter = computed(
  () =>
    navCategoryId.value === undefined &&
    (navSmart.value === 'today' || navSmart.value === 'week' || navSmart.value === 'last7days')
)

/** 普通任务列表顶栏：分组/排序、三点菜单（已完成/垃圾桶/四象限不展示） */
const showTaskListGroupSort = computed(
  () => !isSpecialListView.value && !isMatrixView.value && !isSummaryView.value
)
const showListViewMenu = showTaskListGroupSort

const listViewMode = ref<TaskListViewMode>(readTaskListViewMode())
const taskDetailStyle = ref<TaskDetailStyle>(readTaskDetailStyle())
const taskListMetaVisibility = ref<TaskListMetaVisibility>(readTaskListMetaVisibility())

watch(listViewMode, (v) => persistTaskListViewMode(v))
watch(taskDetailStyle, (v) => persistTaskDetailStyle(v))
watch(taskListMetaVisibility, (v) => persistTaskListMetaVisibility(v), { deep: true })

/** 与 store hideDone 同步：true=隐藏已完成 */
const hideDoneModel = computed({
  get: () => taskStore.filter.hideDone,
  set: (v: boolean) => {
    void taskStore.setHideDone(v)
  }
})

const taskGroupBy = ref<TaskGroupBy>(readTaskGroupBy())
const taskSortBy = ref<TaskSortBy>(readTaskSortBy())

watch(taskGroupBy, (v) => persistTaskGroupBy(v))
watch(taskSortBy, (v) => persistTaskSortBy(v))

/** 应用分组/排序后的列表行（含分组标题） */
const taskListLayout = computed(() =>
  buildTaskListLayout(taskStore.tasks, taskGroupBy.value, taskSortBy.value)
)

/** 看板自定义分组作用域（随侧栏导航变化） */
const kanbanScopeKeyValue = computed(() =>
  kanbanScopeKey({
    categoryId: navCategoryId.value,
    smart: navCategoryId.value === undefined ? navSmart.value : undefined
  })
)

/** 看板列内快捷添加默认清单 */
const kanbanDefaultCategoryId = computed(() => {
  if (typeof navCategoryId.value === 'string') return navCategoryId.value
  if (navCategoryId.value === null) return null
  return null
})

/** 看板选中的列：顶栏快捷添加写入该列；未选中则归入未分组 */
const kanbanSelectedColumnId = ref<string | null>(null)

watch(kanbanScopeKeyValue, () => {
  kanbanSelectedColumnId.value = null
})

/** 看板模式下顶栏快捷添加的目标分组 */
function kanbanGroupIdForQuickAdd(): string | null | undefined {
  if (listViewMode.value !== 'kanban') return undefined
  const sel = kanbanSelectedColumnId.value
  if (!sel) return null
  if (sel === KANBAN_UNGROUPED_ID) return null
  return sel
}

async function onKanbanChanged() {
  await taskStore.load()
}



const sidebarActiveSmart = computed<'all' | 'today' | 'week' | 'last7days' | 'matrix' | 'done' | 'trash' | null>(() => {
  if (isSummaryView.value) return null
  return navCategoryId.value !== undefined ? null : navSmart.value
})

const isSummaryView = computed(() => navSummaryActive.value)
const isSummaryConfigView = computed(() => navSummaryActive.value && navSummarySection.value === 'config')
const isSummaryResultsView = computed(() => navSummaryActive.value && navSummarySection.value === 'results')



const isDoneView = computed(() => navSmart.value === 'done' && navCategoryId.value === undefined)

const isTrashView = computed(() => navSmart.value === 'trash' && navCategoryId.value === undefined)

const isSpecialListView = computed(
  () => isDoneView.value || isTrashView.value || isSummaryView.value
)

const isMatrixView = computed(
  () =>
    !navSummaryActive.value &&
    navSmart.value === 'matrix' &&
    navCategoryId.value === undefined
)

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



const viewTitle = computed(() => {
  if (isSummaryConfigView.value) return '定时汇总配置'
  if (isSummaryResultsView.value) return '汇总结果'

  if (navCategoryId.value === undefined) {

    if (navSmart.value === 'matrix') return '四象限'

    if (navSmart.value === 'done') return '已完成'

    if (navSmart.value === 'trash') return '垃圾桶'

    if (navSmart.value === 'week') return '本周'

    if (navSmart.value === 'last7days') return '最近7天'

    return navSmart.value === 'today' ? '今天' : '全部'

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
  const countSmart = (smart: 'today' | 'week' | 'last7days') =>
    roots.filter((t) => taskMatchesSmartListDate(t, smart, listDateField.value)).length
  return {
    all: roots.length,
    today: countSmart('today'),
    week: countSmart('week'),
    last7days: countSmart('last7days')
  }
})

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



const visibleTasks = computed(() => {

  const all = taskStore.tasks

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

/** 列表标题旁计数 */
const listDisplayCount = computed(() => {
  if (isDoneView.value) {
    return taskStore.tasks.filter((t) => t.status === 'DONE').length
  }
  if (isTrashView.value) {
    return taskStore.tasks.length
  }
  if (isMatrixView.value) {
    return taskStore.tasks.filter((t) => !t.parentId).length
  }
  return visibleTasks.value.filter(({ depth }) => depth === 0).length
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



async function onSmart(smart: 'all' | 'today' | 'week' | 'last7days') {
  navSummaryActive.value = false
  navSmart.value = smart
  navCategoryId.value = undefined
  await taskStore.navigate({
    kind: 'smart',
    smart,
    dateField: isDueSmartList(smart) ? listDateField.value : undefined
  })
}



async function onMatrix() {
  navSummaryActive.value = false
  navSmart.value = 'matrix'

  navCategoryId.value = undefined

  await taskStore.navigate({ kind: 'matrix' })

}



async function onSummary(section: SummarySection) {
  navSummaryActive.value = true
  navSummarySection.value = section
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
  navSmart.value = 'done'
  navCategoryId.value = undefined
  doneListCategory.value = 'all'
  detailOpen.value = false
  await taskStore.navigate(doneNavigatePayload())
}

function onCalendar(mode: CalendarViewMode) {
  void router.push({ path: '/calendar', query: { view: mode } })
}

async function onSelectTasks() {
  await onSmart('all')
}

async function onTrash() {
  navSummaryActive.value = false
  navSmart.value = 'trash'
  navCategoryId.value = undefined
  detailOpen.value = false
  activeTaskId.value = null
  await taskStore.navigate({ kind: 'trash' })
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
  navCategoryId.value = id

  if (id === null) {

    await taskStore.navigate({ kind: 'uncategorized' })

  } else {

    await taskStore.navigate({ kind: 'category', categoryId: id })

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

    await taskStore.quickCreate(title, {

      categoryId: defaultCategoryForCreate.value ?? null,

      kanbanGroupId: kanbanGid !== undefined ? kanbanGid : undefined,

      parseCategories: categoryStore.categories.map((c) => ({ id: c.id, name: c.name }))

    })

    quickAddText.value = ''

    ElMessage.success('任务已添加')

  } catch {

    /* store 内 unwrapIpc 已 Toast */

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

    await taskStore.quickCreate(title, { priority })

    ElMessage.success('任务已添加')

  } catch {

    /* 用户取消 */

  }

}



function openTask(id: string) {

  activeTaskId.value = id

  detailOpen.value = true

}



function closeDetail() {
  detailOpen.value = false
  activeTaskId.value = null
  void taskStore.fetchWithCurrentFilter()
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



onMounted(async () => {
  await categoryStore.load()
  await taskStore.load()
  await taskStore.refreshSidebarCounts()
  syncNavFromFilter()
  syncSummaryFromRoute()
  window.addEventListener('desktop:new-task', openNewTask)
  window.addEventListener('desktop:focus-search', onFocusQuickAdd)
})

function syncSummaryFromRoute() {
  if (route.query.view !== 'summary') return
  navSummaryActive.value = true
  const section = route.query.section
  navSummarySection.value = section === 'results' ? 'results' : 'config'
}

watch(
  () => [route.query.view, route.query.section],
  () => syncSummaryFromRoute()
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

</style>


