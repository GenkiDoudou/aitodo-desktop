<template>
  <div class="home">
    <AppSidebar
      :active-smart="sidebarActiveSmart"
      :active-category="navCategoryId"
      @select-smart="onSmart"
      @select-category="onCategory"
      @open-settings="router.push('/settings')"
    />
    <main class="home__main">
      <header class="home__header">
        <el-input
          v-model="search"
          class="home__search"
          placeholder="搜索任务标题…"
          clearable
          @input="onSearch"
        />
        <div class="home__actions">
          <label class="home__show-done">
            <span>显示已完成</span>
            <el-switch
              :model-value="!taskStore.filter.hideDone"
              @change="onShowCompletedChange"
            />
          </label>
          <el-tooltip content="即将推出" placement="bottom">
            <el-button disabled class="home__ai">AI 一句话</el-button>
          </el-tooltip>
          <el-button type="primary" @click="openNewTask">新建任务</el-button>
        </div>
      </header>
      <TaskList
        :tasks="visibleTasks"
        :loading="taskStore.loading"
        @select="openTask"
        @toggle-status="onToggleStatus"
      />
    </main>
    <TaskDrawer
      v-model="drawerOpen"
      :task-id="activeTaskId"
      :parent-id-for-create="createParentId"
      :default-category-id="defaultCategoryForCreate"
      @saved="onTaskSaved"
      @new-subtask="openNewSubtask"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import TaskList from '@/components/TaskList.vue'
import TaskDrawer from '@/components/TaskDrawer.vue'
import type { TaskSavePayload } from '@/components/TaskDrawer.vue'
import { useTaskStore } from '@/stores/task-store'
import { useCategoryStore } from '@/stores/category-store'
import type { Task, TaskStatus } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const router = useRouter()
const taskStore = useTaskStore()
const categoryStore = useCategoryStore()

const search = ref('')
const drawerOpen = ref(false)
const activeTaskId = ref<string | null>(null)
const createParentId = ref<string | null>(null)

/** undefined=智能列表；null=未分类；string=某分类 */
const navCategoryId = ref<string | null | undefined>(undefined)
const navSmart = ref<'all' | 'today'>('all')

const sidebarActiveSmart = computed<'all' | 'today' | null>(() =>
  navCategoryId.value !== undefined ? null : navSmart.value
)

const defaultCategoryForCreate = computed(() => {
  if (typeof navCategoryId.value === 'string') {
    return navCategoryId.value
  }
  return null
})

/**
 * 树形列表：顶层 parentId=null。
 * 若父任务被筛选掉，子任务提升为顶层展示，避免「保存了但看不见」。
 */
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

function syncNavFromFilter() {
  const f = taskStore.filter
  if (f.categoryId !== undefined) {
    navCategoryId.value = f.categoryId
    return
  }
  navCategoryId.value = undefined
  navSmart.value = f.smartList === 'today' ? 'today' : 'all'
}

function onSmart(smart: 'all' | 'today') {
  navSmart.value = smart
  navCategoryId.value = undefined
  taskStore.load({ smartList: smart }, { clearCategoryId: true })
}

function onCategory(id: string | null) {
  navCategoryId.value = id
  taskStore.load({ categoryId: id }, { clearSmartList: true })
}

function onShowCompletedChange(show: boolean | string | number) {
  taskStore.setHideDone(!Boolean(show))
}

function onSearch() {
  const q = search.value.trim()
  taskStore.load(q ? { search: q } : {}, q ? undefined : { clearSearch: true })
}

async function onTaskSaved({ task }: TaskSavePayload) {
  createParentId.value = null
  search.value = ''

  if (task) {
    await taskStore.reloadAfterSave(task)
  } else {
    await taskStore.load({}, { clearSearch: true })
  }
  syncNavFromFilter()
}

function openNewTask() {
  activeTaskId.value = null
  createParentId.value = null
  drawerOpen.value = true
}

function openTask(id: string) {
  createParentId.value = null
  activeTaskId.value = id
  drawerOpen.value = true
}

function openNewSubtask(parentId: string) {
  activeTaskId.value = null
  createParentId.value = parentId
  drawerOpen.value = true
}

async function onToggleStatus(task: Task) {
  const order: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']
  const idx = order.indexOf(task.status)
  const next = order[(idx + 1) % order.length]
  try {
    await unwrapIpc(await window.api.tasks.update(task.id, { status: next }))
    await taskStore.load()
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

onMounted(async () => {
  await categoryStore.load()
  await taskStore.load()
  syncNavFromFilter()
  window.addEventListener('desktop:new-task', openNewTask)
})
</script>

<style scoped lang="scss">
.home {
  display: flex;
  height: 100vh;
  background: var(--desktop-bg);
}

.home__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.home__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--desktop-border);
  background: var(--desktop-panel);
}

.home__search {
  max-width: 280px;
}

.home__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
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
  opacity: 0.55;
}
</style>
