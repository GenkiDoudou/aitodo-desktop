import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'
import {
  doneTimeRangeBounds,
  taskDateIsoInRange,
  taskMatchesSmartListDate
} from '@shared/date-filter'
import { isDueSmartList } from '@shared/smart-list'
import type { CreateTaskDto, DeleteTaskOptions, Task, TaskListFilter } from '@shared/types'
import type { TaskPriority } from '@shared/task-priority'
import type { AiParseCategoryRef } from '@shared/ai-task-parser'
import { buildQuickCreateTaskDtoFromDraft, toParseCategories } from '@shared/quick-create-task'
import { cloneTaskListFilter, isMatrixListFilter } from '@shared/task-list-filter'
import { unwrapIpc } from '@/ipc/client'

/** 与《待办需求》一致：true 表示隐藏已完成（开关默认关 = 隐藏） */
export const HIDE_DONE_STORAGE_KEY = 'aitodo_hide_done'

/** load 时显式清除的筛选项（undefined 无法覆盖旧值，需单独标记） */
export interface TaskListLoadOptions {
  clearSmartList?: boolean
  clearCategoryId?: boolean
  clearSearch?: boolean
}

function readHideDonePreference(): boolean {
  try {
    const raw = localStorage.getItem(HIDE_DONE_STORAGE_KEY)
    if (raw === null) {
      return true
    }
    return raw === 'true'
  } catch {
    return true
  }
}

function persistHideDone(hideDone: boolean): void {
  try {
    localStorage.setItem(HIDE_DONE_STORAGE_KEY, String(hideDone))
  } catch {
    /* 极端环境无 localStorage 时仅内存生效 */
  }
}

function mergeFilter(
  current: TaskListFilter,
  patch?: TaskListFilter,
  options?: TaskListLoadOptions
): TaskListFilter {
  const next: TaskListFilter = { ...current }
  if (options?.clearSmartList) delete next.smartList
  if (options?.clearCategoryId) delete next.categoryId
  if (options?.clearSearch) delete next.search
  if (patch) {
    Object.assign(next, patch)
  }
  return next
}

/** 判断任务是否会被当前列表筛选条件包含 */
export function taskMatchesFilter(task: Task, filter: TaskListFilter): boolean {
  if (filter.smartList === 'trash') {
    return Boolean(task.deletedAt)
  }
  if (task.deletedAt) {
    return false
  }
  if (filter.hideDone && task.status === 'DONE') {
    return false
  }
  if (filter.categoryId !== undefined && task.categoryId !== filter.categoryId) {
    return false
  }
  if (filter.search?.trim()) {
    const q = filter.search.trim().toLowerCase()
    if (!task.title.toLowerCase().includes(q)) {
      return false
    }
  }
  if (isDueSmartList(filter.smartList)) {
    return taskMatchesSmartListDate(task, filter.smartList, filter.dateField ?? 'dueAt')
  }
  if (filter.smartList === 'done' && task.status !== 'DONE') {
    return false
  }
  if (filter.smartList === 'done' && filter.doneTimeRange && filter.doneTimeRange !== 'all') {
    const bounds = doneTimeRangeBounds(filter.doneTimeRange, dayjs(), {
      from: filter.dateFrom,
      to: filter.dateTo
    })
    if (bounds && !taskDateIsoInRange(task, 'completedAt', bounds)) {
      return false
    }
  }
  if (filter.parentId !== undefined && filter.parentId === null && task.parentId) {
    return false
  }
  return true
}

/** 侧栏导航：整页替换筛选，避免 merge 残留 smartList/categoryId/search */
export type TaskNavView =
  | { kind: 'smart'; smart: 'all' | 'today' | 'week' | 'last7days'; dateField?: import('@shared/date-filter').TaskDateField }
  | { kind: 'done'; doneTimeRange?: import('@shared/date-filter').DoneTimeRange; dateFrom?: string | null; dateTo?: string | null }
  | { kind: 'trash' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'uncategorized' }
  | { kind: 'matrix' }

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const trashCount = ref(0)
  const doneCount = ref(0)
  const filter = ref<TaskListFilter>({
    smartList: 'all',
    hideDone: readHideDonePreference()
  })

  let loadSeq = 0

  async function fetchWithCurrentFilter() {
    const seq = ++loadSeq
    loading.value = true
    try {
      const list = unwrapIpc(
        await window.api.tasks.list(cloneTaskListFilter(filter.value))
      )
      if (seq !== loadSeq) {
        return
      }
      tasks.value = list
    } catch (err) {
      if (seq === loadSeq) {
        console.error('[task-store] load failed', err)
      }
    } finally {
      if (seq === loadSeq) {
        loading.value = false
      }
    }
  }

  async function load(patch?: TaskListFilter, options?: TaskListLoadOptions) {
    filter.value = mergeFilter(filter.value, patch, options)
    await fetchWithCurrentFilter()
  }

  /** 侧栏切换：用全新 filter 拉列表，确保分类/全部/今天互斥 */
  async function navigate(view: TaskNavView) {
    const hideDone = filter.value.hideDone
    if (view.kind === 'smart') {
      const next: TaskListFilter = { hideDone, smartList: view.smart }
      if (view.dateField && isDueSmartList(view.smart)) {
        next.dateField = view.dateField
      } else if (isDueSmartList(view.smart)) {
        next.dateField = filter.value.dateField ?? 'dueAt'
      }
      filter.value = next
    } else if (view.kind === 'done') {
      /** 已完成：仅 DONE，按 completed_at 倒序（见 task-repository） */
      filter.value = {
        hideDone: false,
        smartList: 'done',
        doneTimeRange: view.doneTimeRange ?? filter.value.doneTimeRange ?? 'all',
        dateFrom: view.dateFrom ?? filter.value.dateFrom,
        dateTo: view.dateTo ?? filter.value.dateTo
      }
    } else if (view.kind === 'trash') {
      filter.value = { smartList: 'trash' }
    } else if (view.kind === 'category') {
      filter.value = { hideDone, categoryId: view.categoryId }
    } else if (view.kind === 'uncategorized') {
      filter.value = { hideDone, categoryId: null }
    } else {
      /** 四象限：拉取含已完成任务，展示由象限选项控制 */
      filter.value = { hideDone: false }
    }
    await fetchWithCurrentFilter()
  }

  /**
   * 将单条任务同步进当前列表（编辑保存后立即反映标题/状态/分类变更）。
   * 若不再符合当前筛选则从列表移除。
   */
  function syncTaskInList(task: Task) {
    const visible = taskMatchesFilter(task, filter.value)
    const idx = tasks.value.findIndex((t) => t.id === task.id)
    if (!visible) {
      if (idx >= 0) {
        tasks.value = tasks.value.filter((t) => t.id !== task.id)
      }
      return
    }
    if (idx >= 0) {
      tasks.value = tasks.value.map((t) => (t.id === task.id ? { ...task } : t))
    } else {
      tasks.value = [{ ...task }, ...tasks.value]
    }
  }

  function removeTaskFromList(taskId: string) {
    tasks.value = tasks.value.filter((t) => t.id !== taskId)
  }

  /**
   * 保存后的统一入口：create / update / delete。
   */
  async function afterSave(task: Task | null, mode: 'create' | 'update' | 'delete') {
    if (mode === 'delete') {
      if (task?.id) {
        removeTaskFromList(task.id)
      }
      await fetchWithCurrentFilter()
      await refreshSidebarCounts()
      return
    }
    if (!task) {
      await fetchWithCurrentFilter()
      await refreshSidebarCounts()
      return
    }

    if (mode === 'create') {
      await reloadAfterSave(task)
      await refreshSidebarCounts()
      return
    }

    // update：先拉最新列表，再强制合并刚保存的任务（防止 IPC 竞态或缓存导致 UI 滞后）
    await fetchWithCurrentFilter()
    syncTaskInList(task)
    await refreshSidebarCounts()
  }

  async function reloadAfterSave(created: Task) {
    const hideDone = created.status === 'DONE' ? false : filter.value.hideDone
    if (created.status === 'DONE') {
      persistHideDone(false)
    }

    const wasMatrix = isMatrixListFilter(filter.value)

    if (wasMatrix) {
      /** 四象限内新建/保存：保持 matrix 筛选，避免跳回「全部」列表 */
      filter.value = { hideDone }
    } else if (created.categoryId) {
      filter.value = { hideDone, categoryId: created.categoryId }
    } else {
      filter.value = { hideDone, smartList: 'all' }
    }
    await fetchWithCurrentFilter()

    if (!tasks.value.some((t) => t.id === created.id) && !wasMatrix) {
      filter.value = { hideDone: false, smartList: 'all' }
      await fetchWithCurrentFilter()
    }
    syncTaskInList(created)
  }

  async function setHideDone(hideDone: boolean) {
    persistHideDone(hideDone)
    filter.value = { ...filter.value, hideDone }
    await fetchWithCurrentFilter()
  }

  async function create(
    title: string,
    options?: { parentId?: string | null; categoryId?: string | null }
  ) {
    const trimmed = title.trim()
    if (!trimmed) {
      throw new Error('title required')
    }
    // 仅传有值字段，避免 IPC 序列化后 undefined 导致 SQLite 绑定异常
    const dto: CreateTaskDto = { title: trimmed }
    if (options?.parentId) {
      dto.parentId = options.parentId
    }
    if (options?.categoryId) {
      dto.categoryId = options.categoryId
    }
    const task = unwrapIpc(await window.api.tasks.create(dto))
    await reloadAfterSave(task)
    return task
  }

  /**
   * 快捷添加：按设置走本地或 LLM 解析后创建，保持当前侧栏筛选不变。
   */
  async function quickCreate(
    rawInput: string,
    options?: {
      categoryId?: string | null
      priority?: TaskPriority
      kanbanGroupId?: string | null
      status?: TaskStatus
      parseCategories?: AiParseCategoryRef[]
      startAt?: string | null
      dueAt?: string | null
      triagedAt?: string | null
    }
  ) {
    const trimmed = rawInput.trim()
    if (!trimmed) {
      throw new Error('title required')
    }
    const cats = toParseCategories(options?.parseCategories ?? [])
    const parsed = unwrapIpc(await window.api.app.parseTaskInput(trimmed, cats))
    const dto = buildQuickCreateTaskDtoFromDraft(parsed.draft, trimmed, cats, {
      categoryId: options?.categoryId ?? null,
      ...(options?.priority !== undefined ? { priority: options.priority } : {}),
      ...(options?.kanbanGroupId !== undefined ? { kanbanGroupId: options.kanbanGroupId } : {}),
      ...(options?.status !== undefined ? { status: options.status } : {}),
      ...(options?.triagedAt !== undefined ? { triagedAt: options.triagedAt } : {})
    })
    if (options?.startAt !== undefined) dto.startAt = options.startAt
    if (options?.dueAt !== undefined) dto.dueAt = options.dueAt
    if (!dto.title.trim()) {
      throw new Error('title required')
    }
    const task = unwrapIpc(await window.api.tasks.create(dto))
    syncTaskInList(task)
    await fetchWithCurrentFilter()
    await refreshSidebarCounts()
    return task
  }

  async function update(id: string, patch: Parameters<typeof window.api.tasks.update>[1]) {
    try {
      const task = unwrapIpc(await window.api.tasks.update(id, patch))
      await fetchWithCurrentFilter()
      syncTaskInList(task)
      await refreshSidebarCounts()
      return task
    } catch {
      throw new Error('update failed')
    }
  }

  async function reorder(ids: string[]) {
    const updated = unwrapIpc(await window.api.tasks.reorder(ids))
    const byId = new Map(updated.map((t) => [t.id, t]))
    tasks.value = tasks.value.map((t) => byId.get(t.id) ?? t)
    await fetchWithCurrentFilter()
    return updated
  }

  async function remove(id: string, options?: DeleteTaskOptions) {
    unwrapIpc(await window.api.tasks.delete(id, options))
    removeTaskFromList(id)
    await fetchWithCurrentFilter()
    await refreshSidebarCounts()
  }

  async function refreshSidebarCounts() {
    try {
      trashCount.value = unwrapIpc(await window.api.tasks.countTrash())
    } catch {
      trashCount.value = 0
    }
    try {
      doneCount.value = unwrapIpc(await window.api.tasks.countDone())
    } catch {
      doneCount.value = 0
    }
  }

  /** @deprecated 使用 refreshSidebarCounts */
  async function refreshTrashCount() {
    await refreshSidebarCounts()
  }

  async function restoreFromTrash(id: string) {
    const task = unwrapIpc(await window.api.tasks.restore(id))
    removeTaskFromList(id)
    await fetchWithCurrentFilter()
    await refreshSidebarCounts()
    return task
  }

  async function purgeFromTrash(id: string, options?: DeleteTaskOptions) {
    unwrapIpc(await window.api.tasks.permanentDelete(id, options))
    removeTaskFromList(id)
    await fetchWithCurrentFilter()
    await refreshSidebarCounts()
  }

  async function emptyTrashBin() {
    const n = unwrapIpc(await window.api.tasks.emptyTrash())
    tasks.value = []
    await refreshSidebarCounts()
    return n
  }

  return {
    tasks,
    loading,
    trashCount,
    doneCount,
    filter,
    load,
    navigate,
    afterSave,
    syncTaskInList,
    reloadAfterSave,
    setHideDone,
    create,
    quickCreate,
    update,
    reorder,
    remove,
    refreshTrashCount,
    refreshSidebarCounts,
    restoreFromTrash,
    purgeFromTrash,
    emptyTrashBin
  }
})
