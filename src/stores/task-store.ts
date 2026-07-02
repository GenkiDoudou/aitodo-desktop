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

  async function load(patch?: TaskListFilter, options?: TaskListLoadOptions) {
    filter.value = mergeFilter(filter.value, patch, options)
    loading.value = true
    try {
      tasks.value = unwrapIpc(await window.api.tasks.list(filter.value))
    } catch {
      /* unwrapIpc 已 Toast；保留原列表避免闪空 */
    } finally {
      loading.value = false
    }
  }

  /**
   * 新建/保存后刷新：若当前筛选会排除该任务，自动切换到能看到的视图。
   * 典型场景：在「未分类」下新建了带分类的任务、在「今天」下新建了无今日截止的任务、搜索框有残留关键字。
   */
  async function reloadAfterSave(created: Task) {
    const current = filter.value
    const options: TaskListLoadOptions = { clearSearch: true }
    let patch: TaskListFilter = {}

    if (created.status === 'DONE' && current.hideDone) {
      patch.hideDone = false
      persistHideDone(false)
    }

    const probe: TaskListFilter = { ...current, ...patch }
    if (!taskMatchesFilter(created, probe)) {
      if (created.parentId) {
        patch = {
          hideDone: patch.hideDone ?? current.hideDone,
          smartList: 'all'
        }
        options.clearCategoryId = true
      } else if (created.categoryId) {
        patch = {
          hideDone: patch.hideDone ?? current.hideDone,
          categoryId: created.categoryId
        }
        options.clearSmartList = true
      } else {
        patch = {
          hideDone: patch.hideDone ?? current.hideDone,
          smartList: 'all'
        }
        options.clearCategoryId = true
      }
    }

    await load(patch, options)

    if (!tasks.value.some((t) => t.id === created.id)) {
      await load(
        {
          smartList: 'all',
          hideDone: created.status === 'DONE' ? false : filter.value.hideDone
        },
        { clearCategoryId: true, clearSearch: true, clearSmartList: false }
      )
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

  return { tasks, loading, filter, load, reloadAfterSave, setHideDone, create, update, remove }
})
