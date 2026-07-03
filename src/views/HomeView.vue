<template>

  <div class="home">

    <AppSidebar

      :active-smart="sidebarActiveSmart"

      :active-category="navCategoryId"

      :task-counts="taskCounts"

      @select-smart="onSmart"

      @select-matrix="onMatrix"

      @select-category="onCategory"

      @open-settings="router.push('/settings')"

    />



    <div class="home__workspace">

      <section class="home__list-pane" :class="{ 'is-detail-open': detailOpen, 'is-detail-expanded': detailPanelExpanded }">

        <header class="home__list-header">

          <div class="home__list-head-left">

            <h1 class="home__view-title">{{ viewTitle }}</h1>

            <span class="home__view-count">{{ listDisplayCount }} 项</span>

          </div>

          <div class="home__list-actions">

            <label class="home__show-done">

              <span>显示已完成</span>

              <el-switch

                :model-value="!taskStore.filter.hideDone"

                @change="onShowCompletedChange"

              />

            </label>

            <el-button class="home__ai" @click="aiDialogOpen = true">

              <el-icon class="home__ai-icon"><MagicStick /></el-icon>

              AI

            </el-button>

            <el-button type="primary" @click="openNewTask">新建</el-button>

          </div>

        </header>



        <div class="home__quick-add">

          <el-icon class="home__quick-add-icon"><Plus /></el-icon>

          <input

            ref="quickAddInputRef"

            v-model="quickAddText"

            class="home__quick-add-input"

            :placeholder="quickAddPlaceholder"

            @keydown.enter.prevent="onQuickAdd"

          />

        </div>



        <TaskList

          v-if="!isMatrixView"

          :tasks="visibleTasks"

          :loading="taskStore.loading"

          :selected-id="activeTaskId"

          @select="openTask"

          @toggle-status="onToggleStatus"

        />

        <QuadrantMatrixView

          v-else

          :tasks="taskStore.tasks"

          :categories="categoryStore.categories"

          :loading="taskStore.loading"

          :show-completed="!taskStore.filter.hideDone"

          @select="openTask"

          @toggle-status="onToggleStatus"

          @create="onQuadrantQuickCreate"

          @change-priority="onChangePriority"

        />

      </section>



      <div v-if="detailOpen" class="home__detail-scrim" @click="closeDetail" />



      <TaskDetailPanel
        class="home__detail"
        :visible="detailOpen"
        :task-id="activeTaskId"
        :default-category-id="defaultCategoryForCreate"
        :default-priority="defaultPriorityForCreate"
        :emphasize-category="isMatrixView"
        @close="closeDetail"
        @saved="onTaskSaved"
        @panel-expanded-change="detailPanelExpanded = $event"
      />

    </div>



    <AiTaskDialog

      v-model="aiDialogOpen"

      :categories="categoryStore.categories"

      @created="onAiTaskCreated"

    />

  </div>

</template>



<script setup lang="ts">

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import { MagicStick, Plus } from '@element-plus/icons-vue'

import { useRouter } from 'vue-router'

import { ElMessage, ElMessageBox } from 'element-plus'

import AppSidebar from '@/components/AppSidebar.vue'

import TaskList from '@/components/TaskList.vue'

import QuadrantMatrixView from '@/components/QuadrantMatrixView.vue'

import TaskDetailPanel from '@/components/TaskDetailPanel.vue'

import AiTaskDialog from '@/components/AiTaskDialog.vue'

import type { TaskSavePayload } from '@/components/TaskDetailPanel.vue'

import { useTaskStore } from '@/stores/task-store'

import { useCategoryStore } from '@/stores/category-store'

import type { Task, TaskStatus } from '@shared/types'

import type { TaskPriority } from '@shared/task-priority'

import { DEFAULT_TASK_PRIORITY, getTaskPriorityMeta } from '@shared/task-priority'



const router = useRouter()

const taskStore = useTaskStore()

const categoryStore = useCategoryStore()



const quickAddText = ref('')

const quickAddInputRef = ref<HTMLInputElement>()

const detailOpen = ref(false)

const detailPanelExpanded = ref(false)

const aiDialogOpen = ref(false)

const activeTaskId = ref<string | null>(null)

const defaultPriorityForCreate = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)



const navCategoryId = ref<string | null | undefined>(undefined)

const navSmart = ref<'all' | 'today' | 'matrix'>('all')



const sidebarActiveSmart = computed<'all' | 'today' | 'matrix' | null>(() =>

  navCategoryId.value !== undefined ? null : navSmart.value

)



const isMatrixView = computed(() => navSmart.value === 'matrix' && navCategoryId.value === undefined)



const defaultCategoryForCreate = computed(() => {

  if (typeof navCategoryId.value === 'string') {

    return navCategoryId.value

  }

  return null

})



const viewTitle = computed(() => {

  if (navCategoryId.value === undefined) {

    if (navSmart.value === 'matrix') return '四象限'

    return navSmart.value === 'today' ? '今天' : '全部'

  }

  if (navCategoryId.value === null) {

    return '未分类'

  }

  const cat = categoryStore.categories.find((c) => c.id === navCategoryId.value)

  return cat?.name ?? '分类'

})



const quickAddPlaceholder = computed(() => `输入标题回车即可添加至「${viewTitle.value}」`)



/** 侧栏展示用任务计数（不含子任务层级，仅顶层） */

const taskCounts = computed(() => {

  const all = taskStore.tasks.filter((t) => !t.parentId)

  const today = new Date().toISOString().slice(0, 10)

  const todayCount = all.filter(

    (t) => t.status !== 'DONE' && t.dueAt?.startsWith(today)

  ).length

  return { all: all.length, today: todayCount }

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

/** 列表标题旁计数：仅统计顶层任务，与子任务折叠展示一致 */
const listDisplayCount = computed(() => {
  if (isMatrixView.value) {
    return taskStore.tasks.filter((t) => !t.parentId).length
  }
  return visibleTasks.value.filter(({ depth }) => depth === 0).length
})

function syncNavFromFilter() {

  const f = taskStore.filter

  if (f.parentId === null && f.categoryId === undefined && !f.smartList) {

    navCategoryId.value = undefined

    navSmart.value = 'matrix'

    return

  }

  if (f.categoryId !== undefined) {

    navCategoryId.value = f.categoryId

    return

  }

  navCategoryId.value = undefined

  navSmart.value = f.smartList === 'today' ? 'today' : 'all'

}



async function onSmart(smart: 'all' | 'today') {

  navSmart.value = smart

  navCategoryId.value = undefined

  await taskStore.navigate({ kind: 'smart', smart })

}



async function onMatrix() {

  navSmart.value = 'matrix'

  navCategoryId.value = undefined

  await taskStore.navigate({ kind: 'matrix' })

}



async function onCategory(id: string | null) {

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

    const opts: { categoryId?: string | null } = {}

    if (defaultCategoryForCreate.value) {

      opts.categoryId = defaultCategoryForCreate.value

    }

    await taskStore.quickCreate(title, Object.keys(opts).length ? opts : undefined)

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



async function onAiTaskCreated(task: Task) {

  await taskStore.afterSave(task, 'create')

  syncNavFromFilter()

  openTask(task.id)

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

}



async function onToggleStatus(task: Task) {

  const order: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

  const idx = order.indexOf(task.status)

  const next = order[(idx + 1) % order.length]

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

  syncNavFromFilter()

  window.addEventListener('desktop:new-task', openNewTask)

  window.addEventListener('desktop:focus-search', onFocusQuickAdd)

})



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

  align-items: center;

  gap: 8px;

  margin: 12px 16px;

  padding: 0 14px;

  height: 40px;

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

}



.home__quick-add-input {

  flex: 1;

  border: none;

  outline: none;

  background: transparent;

  font-size: 14px;

  color: var(--desktop-text);



  &::placeholder {

    color: var(--desktop-muted);

  }

}

</style>


