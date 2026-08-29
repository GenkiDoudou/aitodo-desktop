import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CreateTaskViewDto, TaskView, UpdateTaskViewDto } from '@shared/types'
import type { FilterNode } from '@shared/task-filter-ast'
import {
  DEFAULT_TASK_VIEW_ALL_ID,
  deriveAppliedViewState,
  findFallbackViewId
} from '@shared/apply-task-view'
import type { TaskListViewMode } from '@shared/list-view-preferences'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { unwrapIpc } from '@/ipc/client'

const SELECTED_VIEW_KEY = 'aitodo_selected_view_id'

function readSelectedViewId(): string | null {
  try {
    return localStorage.getItem(SELECTED_VIEW_KEY)
  } catch {
    return null
  }
}

function persistSelectedViewId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_VIEW_KEY, id)
    else localStorage.removeItem(SELECTED_VIEW_KEY)
  } catch {
    /* ignore */
  }
}

export const useViewStore = defineStore('taskViews', () => {
  const items = ref<TaskView[]>([])
  const selectedViewId = ref<string | null>(readSelectedViewId())
  const loading = ref(false)

  const selectedView = computed(
    () => items.value.find((v) => v.id === selectedViewId.value) ?? null
  )

  async function load() {
    loading.value = true
    try {
      items.value = unwrapIpc(await window.api.taskViews.list())
      ensureValidSelection()
    } finally {
      loading.value = false
    }
  }

  function ensureValidSelection() {
    if (selectedViewId.value && items.value.some((v) => v.id === selectedViewId.value)) {
      return
    }
    const fallback =
      items.value.find((v) => v.id === DEFAULT_TASK_VIEW_ALL_ID)?.id ??
      findFallbackViewId(items.value) ??
      items.value[0]?.id ??
      null
    selectedViewId.value = fallback
    persistSelectedViewId(fallback)
  }

  async function create(dto: CreateTaskViewDto) {
    const created = unwrapIpc(await window.api.taskViews.create(dto))
    items.value = [...items.value, created].sort((a, b) => a.sortOrder - b.sortOrder)
    return created
  }

  async function update(id: string, dto: UpdateTaskViewDto) {
    const updated = unwrapIpc(await window.api.taskViews.update(id, dto))
    items.value = items.value.map((v) => (v.id === id ? updated : v))
    return updated
  }

  async function remove(id: string) {
    unwrapIpc(await window.api.taskViews.delete(id))
    items.value = items.value.filter((v) => v.id !== id)
    if (selectedViewId.value === id) {
      const next = findFallbackViewId(items.value) ?? items.value[0]?.id ?? null
      selectView(next)
    }
  }

  function selectView(id: string | null) {
    selectedViewId.value = id
    persistSelectedViewId(id)
  }

  async function previewCount(rule: FilterNode) {
    return unwrapIpc(await window.api.taskViews.previewCount(rule))
  }

  async function createFromTemplate(templateId: import('@shared/view-templates').ViewTemplateId) {
    const created = unwrapIpc(await window.api.taskViews.createFromTemplate(templateId))
    items.value = [...items.value, created].sort((a, b) => a.sortOrder - b.sortOrder)
    return created
  }

  /** 将 View 配置写入 UI refs */
  function applyViewToRefs(refs: {
    listViewMode: { value: TaskListViewMode }
    taskGroupBy: { value: TaskGroupBy }
    taskSortBy: { value: TaskSortBy }
    kanbanBoardMode: { value: KanbanBoardMode }
  }, view?: TaskView | null) {
    const target = view ?? selectedView.value
    if (!target) return
    const applied = deriveAppliedViewState(target)
    refs.listViewMode.value = applied.layout
    refs.taskGroupBy.value = applied.groupBy
    refs.taskSortBy.value = applied.sortBy
    if (applied.layout === 'kanban' && applied.kanbanBoardMode) {
      refs.kanbanBoardMode.value = applied.kanbanBoardMode
    }
  }

  return {
    items,
    selectedViewId,
    loading,
    selectedView,
    load,
    create,
    update,
    remove,
    selectView,
    previewCount,
    createFromTemplate,
    applyViewToRefs,
    ensureValidSelection
  }
})
