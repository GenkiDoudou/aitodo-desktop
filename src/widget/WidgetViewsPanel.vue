<template>
  <section class="views-panel">
    <template v-if="!fixedViewId && !selectedView">
      <header class="views-panel__head">
        <span>我的视图</span>
        <button type="button" class="views-panel__ghost" @click="reloadViews">刷新</button>
      </header>

      <div v-if="loadingViews && views.length === 0" class="views-panel__empty">视图加载中…</div>
      <div v-else-if="views.length === 0" class="views-panel__empty">暂无自定义视图</div>
      <div v-else class="views-panel__list">
        <button
          v-for="view in views"
          :key="view.id"
          type="button"
          class="views-panel__view"
          @click="selectView(view.id)"
        >
          <span class="views-panel__view-name">{{ view.name }}</span>
          <span class="views-panel__view-meta">{{ layoutLabel(view.layout) }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <header class="views-panel__head">
        <button v-if="!fixedViewId" type="button" class="views-panel__back" @click="backToViews">‹</button>
        <span class="views-panel__detail-title">{{ selectedView?.name ?? '视图' }}</span>
        <button type="button" class="views-panel__ghost" @click="reloadTasks">刷新</button>
      </header>

      <p v-if="selectedView && !hasActiveRule" class="views-panel__notice">
        该视图无筛选规则，显示全部未完成任务
      </p>
      <p v-else-if="!selectedView && fixedViewId" class="views-panel__notice views-panel__notice--warn">
        绑定的视图不存在或已删除
      </p>

      <div v-if="loadingTasks && tasks.length === 0" class="views-panel__empty">任务加载中…</div>
      <div v-else-if="!selectedView" class="views-panel__empty">无法加载视图</div>
      <div v-else-if="isKanbanView && filteredTasks.length === 0" class="views-panel__empty">暂无匹配任务</div>
      <div v-else-if="!isKanbanView && listRows.length === 0" class="views-panel__empty">暂无匹配任务</div>

      <WidgetKanbanView
        v-else-if="isKanbanView"
        class="views-panel__kanban"
        :tasks="filteredTasks"
        :board-mode="selectedView.kanbanBoardMode ?? 'group'"
        :sort-by="selectedView.sortBy"
        :hide-done-scope="viewHideDoneScope"
        :updating-ids="updatingIds"
        :categories="categories"
        @toggle-done="toggleDone"
        @open-task="openTask"
      />

      <div v-else class="views-panel__tasks">
        <div
          v-for="row in listRows"
          :key="row.task.id"
          class="views-panel__task"
          :style="row.depth > 0 ? { marginLeft: `${row.depth * 14}px` } : undefined"
        >
          <span
            class="views-panel__logo"
            :style="categoryLogoStyle(row.task)"
            :title="categoryName(row.task)"
          >
            {{ categoryLogo(row.task) }}
          </span>
          <input
            class="views-panel__check"
            type="checkbox"
            :disabled="updatingIds.has(row.task.id)"
            @change="toggleDone(row.task.id)"
          />
          <button type="button" class="views-panel__task-title" @click="openTask(row.task.id)">
            {{ row.task.title }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  filterTasksForViewWidget,
  flattenTasksForViewWidget,
  isFilterRuleActive
} from '@shared/apply-task-view'
import type { Category, Task, TaskView, TaskViewLayout } from '@shared/types'
import { nextTaskStatus } from '@shared/task-status-cycle'
import {
  categoryLogoInitial,
  WIDGET_KANBAN_DEFAULT_HEIGHT,
  WIDGET_KANBAN_DEFAULT_WIDTH
} from '@shared/widget-notes'
import { readViewDisplayPreferences } from '@/utils/view-display-preferences'
import WidgetKanbanView from './WidgetKanbanView.vue'

const props = defineProps<{
  fixedViewId?: string
  instanceId?: string
}>()

const fixedViewId = computed(() => props.fixedViewId?.trim() || null)

const views = ref<TaskView[]>([])
const tasks = ref<Task[]>([])
const categories = ref<Category[]>([])
const selectedViewId = ref<string | null>(null)
const loadingViews = ref(false)
const loadingTasks = ref(false)
const updatingIds = ref(new Set<string>())
const categoryMap = computed(() => new Map(categories.value.map((c) => [c.id, c])))
const kanbanWidthEnsured = ref(false)

const selectedView = computed(() => {
  const id = fixedViewId.value ?? selectedViewId.value
  if (!id) return null
  return views.value.find((view) => view.id === id) ?? null
})

const hasActiveRule = computed(() => isFilterRuleActive(selectedView.value?.filterRule))
const isKanbanView = computed(() => selectedView.value?.layout === 'kanban')

const viewHideDoneScope = computed(() => {
  const view = selectedView.value
  if (!view) return 'all' as const
  const kanbanMode = view.layout === 'kanban' ? view.kanbanBoardMode ?? 'group' : null
  return readViewDisplayPreferences(view.id, kanbanMode).hideDoneScope
})

const filteredTasks = computed(() => {
  const view = selectedView.value
  if (!view) return []
  return filterTasksForViewWidget(tasks.value, view, { hideDoneScope: viewHideDoneScope.value })
})

const listRows = computed(() => flattenTasksForViewWidget(filteredTasks.value))

function categoryName(task: Task): string {
  if (!task.categoryId) return '未分类'
  return categoryMap.value.get(task.categoryId)?.name ?? '未分类'
}

function categoryLogo(task: Task): string {
  return categoryLogoInitial(categoryName(task))
}

function categoryLogoStyle(task: Task): Record<string, string> {
  const color = task.categoryId ? categoryMap.value.get(task.categoryId)?.color : null
  if (color) {
    return { background: color, color: '#fff' }
  }
  return { background: 'rgba(255,255,255,0.12)', color: 'var(--widget-muted)' }
}

async function ensureKanbanWindowSize() {
  if (!props.instanceId || !isKanbanView.value || kanbanWidthEnsured.value) return
  kanbanWidthEnsured.value = true
  const res = await window.widgetApi.widget.getInstance(props.instanceId)
  if (!res.ok) return
  const current = res.data
  if (current.width >= WIDGET_KANBAN_DEFAULT_WIDTH - 8) return
  await window.widgetApi.widget.updateInstance(props.instanceId, {
    width: WIDGET_KANBAN_DEFAULT_WIDTH,
    height: Math.max(current.height, WIDGET_KANBAN_DEFAULT_HEIGHT)
  })
}

function setUpdating(id: string, updating: boolean) {
  const next = new Set(updatingIds.value)
  if (updating) next.add(id)
  else next.delete(id)
  updatingIds.value = next
}

function layoutLabel(layout: TaskViewLayout): string {
  if (layout === 'kanban') return '看板'
  if (layout === 'timeline') return '时间线'
  if (layout === 'quadrant') return '四象限'
  return '列表'
}

async function reloadCategories() {
  const res = await window.widgetApi.categories.list()
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  categories.value = res.data
}

async function reloadViews() {
  loadingViews.value = true
  const res = await window.widgetApi.taskViews.list()
  loadingViews.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  views.value = res.data
  if (selectedViewId.value && !views.value.some((view) => view.id === selectedViewId.value)) {
    selectedViewId.value = null
    tasks.value = []
  }
}

async function reloadTasks() {
  if (!selectedView.value) return
  loadingTasks.value = true
  const res = await window.widgetApi.tasks.list({ smartList: 'all', hideDone: false })
  loadingTasks.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  tasks.value = res.data
}

async function selectView(id: string) {
  selectedViewId.value = id
  await reloadTasks()
}

function backToViews() {
  selectedViewId.value = null
  tasks.value = []
}

async function toggleDone(id: string) {
  const task = tasks.value.find((t) => t.id === id)
  if (!task) return
  const next = nextTaskStatus(task.status)
  setUpdating(id, true)
  const res = await window.widgetApi.tasks.update(id, { status: next })
  setUpdating(id, false)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await reloadTasks()
}

async function openTask(taskId: string) {
  const base = selectedView.value
    ? `/?viewId=${encodeURIComponent(selectedView.value.id)}`
    : '/'
  const sep = base.includes('?') ? '&' : '?'
  await window.widgetApi.app.openMain(`${base}${sep}taskId=${encodeURIComponent(taskId)}`)
}

async function bootstrapFixedView() {
  if (!fixedViewId.value) return
  selectedViewId.value = fixedViewId.value
  await reloadTasks()
  await ensureKanbanWindowSize()
}

watch(fixedViewId, () => {
  kanbanWidthEnsured.value = false
  void bootstrapFixedView()
})

watch(isKanbanView, (kanban) => {
  if (kanban) {
    void ensureKanbanWindowSize()
  }
})

onMounted(async () => {
  await Promise.all([reloadViews(), reloadCategories()])
  await bootstrapFixedView()
})
</script>

<style scoped lang="scss">
.views-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.views-panel__head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--widget-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--widget-text);
  font-size: 12px;
  font-weight: 600;
}

.views-panel__detail-title,
.views-panel__head > span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.views-panel__ghost,
.views-panel__back {
  border: none;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--widget-muted);
  cursor: pointer;
}

.views-panel__ghost {
  padding: 4px 7px;
  font-size: 11px;
}

.views-panel__back {
  width: 24px;
  height: 24px;
  font-size: 18px;
  line-height: 1;
}

.views-panel__ghost:hover,
.views-panel__back:hover {
  color: var(--widget-text);
  background: rgba(255, 255, 255, 0.14);
}

.views-panel__list,
.views-panel__tasks,
.views-panel__kanban {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.views-panel__kanban {
  overflow: auto;
}

.views-panel__list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.views-panel__view {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 9px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--widget-text);
  cursor: pointer;
  text-align: left;
}

.views-panel__view:hover {
  border-color: rgba(110, 168, 254, 0.45);
  background: rgba(110, 168, 254, 0.12);
}

.views-panel__view-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.views-panel__view-meta {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--widget-muted);
  font-size: 10px;
}

.views-panel__notice {
  flex: 0 0 auto;
  margin: 0;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--widget-muted);
  font-size: 11px;
}

.views-panel__notice--warn {
  color: #ffb4b4;
}

.views-panel__tasks {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.views-panel__task {
  display: grid;
  grid-template-columns: 18px 16px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 7px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.14);
}

.views-panel__logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.views-panel__check {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--widget-accent);
  cursor: pointer;
}

.views-panel__task-title {
  min-width: 0;
  border: none;
  padding: 0;
  overflow: hidden;
  background: transparent;
  color: var(--widget-text);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.views-panel__task-title:hover {
  color: var(--widget-accent);
}

.views-panel__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--widget-muted);
  font-size: 12px;
  text-align: center;
}
</style>
