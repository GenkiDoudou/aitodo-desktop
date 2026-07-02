import { defineStore } from 'pinia'
import { ref } from 'vue'
import dayjs from 'dayjs'
import type { Task, TaskListFilter } from '@shared/types'
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
  if (filter.smartList === 'today') {
    const today = dayjs().format('YYYY-MM-DD')
    if (task.status === 'DONE') {
      return false
    }
    if (!task.dueAt?.startsWith(today)) {
      return false
    }
  }
  if (filter.smartList === 'done' && task.status !== 'DONE') {
    return false
  }
  return true
}

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const filter = ref<TaskListFilter>({
    smartList: 'all',
    hideDone: readHideDonePreference()
  })

  /** 递增序号：仅应用最新一次 load 的响应，避免快速切换分类时列表被旧请求覆盖 */
  let loadSeq = 0

  async function load(patch?: TaskListFilter, options?: TaskListLoadOptions) {
    const seq = ++loadSeq
    filter.value = mergeFilter(filter.value, patch, options)
    loading.value = true
    try {
      const list = unwrapIpc(await window.api.tasks.list(filter.value))
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

  /**
   * 确保任务出现在内存列表（API 刷新失败时的兜底）。
   * 仅当任务符合当前 filter 时才插入，避免污染分类/智能列表视图。
   */
  function ensureTaskVisible(task: Task) {
    if (!taskMatchesFilter(task, filter.value)) {
      return
    }
    const idx = tasks.value.findIndex((t) => t.id === task.id)
    if (idx >= 0) {
      tasks.value[idx] = task
    } else {
      tasks.value = [task, ...tasks.value]
    }
  }

  /**
   * 新建保存后：切到任务所属分类（或未分类 + 全部列表），确保用户能看到刚创建的任务。
   * 编辑保存请直接 load() 保留当前侧栏筛选。
   */
  async function reloadAfterSave(created: Task) {
    const hideDone = created.status === 'DONE' ? false : filter.value.hideDone
    if (created.status === 'DONE') {
      persistHideDone(false)
    }

    const patch: TaskListFilter = { hideDone }
    const options: TaskListLoadOptions = { clearSearch: true }

    if (created.categoryId) {
      patch.categoryId = created.categoryId
      options.clearSmartList = true
    } else {
      patch.smartList = 'all'
      options.clearCategoryId = true
    }

    await load(patch, options)

    if (!tasks.value.some((t) => t.id === created.id)) {
      await load(
        { smartList: 'all', hideDone: false },
        { clearCategoryId: true, clearSearch: true, clearSmartList: false }
      )
    }

    if (!tasks.value.some((t) => t.id === created.id)) {
      ensureTaskVisible(created)
    }
  }

  async function setHideDone(hideDone: boolean) {
    persistHideDone(hideDone)
    await load({ hideDone })
  }

  async function create(title: string, parentId?: string | null) {
    const task = unwrapIpc(
      await window.api.tasks.create({
        title,
        parentId: parentId ?? null
      })
    )
    await reloadAfterSave(task)
    return task
  }

  async function update(id: string, patch: Parameters<typeof window.api.tasks.update>[1]) {
    unwrapIpc(await window.api.tasks.update(id, patch))
    await load()
  }

  async function remove(id: string) {
    unwrapIpc(await window.api.tasks.delete(id))
    await load()
  }

  return {
    tasks,
    loading,
    filter,
    load,
    reloadAfterSave,
    ensureTaskVisible,
    setHideDone,
    create,
    update,
    remove
  }
})
