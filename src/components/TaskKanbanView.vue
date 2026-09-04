<template>
  <div class="task-kanban" v-loading="loading">
    <header class="task-kanban__toolbar">
      <div v-if="draggingTaskId" class="task-kanban__drag-indicator" title="正在拖动任务">
        正在拖动…
      </div>
      <button v-if="boardMode === 'group'" type="button" class="task-kanban__add-group" @click="onAddGroup">
        <el-icon><Plus /></el-icon>
        新分组
      </button>
    </header>

    <div
      v-if="!loading && rootTasks.length === 0 && (boardMode === 'status' || boardMode === 'priority' || boardMode === 'time' || boardMode === 'tag' || customGroups.length === 0)"
      class="task-kanban__empty"
    >
      暂无任务，点击列头 + 或「新分组」开始
    </div>

    <div v-else class="task-kanban__board">
      <section
        v-for="col in displayColumns"
        :key="col.id"
        class="task-kanban__col"
        :data-column-id="col.id"
        :class="{
          'is-column-selected': selectedColumnId === col.id,
          'is-drop-target': draggingTaskId && dropTargetColumnId === col.id,
          'is-done-col': boardMode === 'group' && col.id === DONE_COLUMN_ID
        }"
        @dragenter.prevent="onDragEnter(col.id)"
        @dragleave.prevent="onDragLeave(col.id)"
        @dragover.prevent="onDragOver"
        @drop.prevent="onDrop(col.id, $event)"
      >
        <header class="task-kanban__col-head">
          <div
            class="task-kanban__col-title-wrap"
            role="button"
            tabindex="0"
            :title="
              boardMode === 'status'
                ? selectedColumnId === col.id
                  ? '再次点击取消选中'
                  : '选中后，顶栏添加的任务将进入此状态列'
                : boardMode === 'priority'
                  ? selectedColumnId === col.id
                    ? '再次点击取消选中'
                    : '选中后，顶栏添加的任务将使用此级别'
                  : boardMode === 'time' || boardMode === 'tag'
                    ? selectedColumnId === col.id
                      ? '再次点击取消选中'
                      : '选中后，顶栏添加的任务将进入此列'
                    : selectedColumnId === col.id
                      ? '再次点击取消选中'
                      : '选中后，顶栏添加的任务将进入此分组'
            "
            @click="toggleColumnSelection(col.id)"
            @keydown.enter.prevent="toggleColumnSelection(col.id)"
          >
            <span class="task-kanban__col-title">{{ col.name }}</span>
            <span class="task-kanban__col-count-wrap">
              <span class="task-kanban__col-count">{{ columnTaskCount(col.id) }}</span>
            </span>
          </div>
          <div v-if="boardMode === 'group' && col.id !== DONE_COLUMN_ID" class="task-kanban__col-actions">
            <button
              type="button"
              class="task-kanban__icon-btn"
              title="添加任务"
              @click.stop="startQuickAdd(col.id)"
            >
              <el-icon><Plus /></el-icon>
            </button>
            <el-dropdown trigger="click" @command="(c) => onColumnCommand(c, col)">
              <button type="button" class="task-kanban__icon-btn" title="分组设置" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item v-if="col.id !== KANBAN_UNGROUPED_ID" command="add-left">
                    在左侧添加分组
                  </el-dropdown-item>
                  <el-dropdown-item command="add-right">在右侧添加分组</el-dropdown-item>
                  <el-dropdown-item v-if="col.id !== KANBAN_UNGROUPED_ID" command="delete" divided>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div
            v-else-if="boardMode === 'status' || boardMode === 'priority' || boardMode === 'time' || boardMode === 'tag'"
            class="task-kanban__col-actions"
          >
            <button
              type="button"
              class="task-kanban__icon-btn"
              title="添加任务"
              @click.stop="startQuickAdd(col.id)"
            >
              <el-icon><Plus /></el-icon>
            </button>
          </div>
        </header>

        <div class="task-kanban__cards">
          <div v-if="quickAddColumn === col.id" class="task-kanban__quick-add">
            <QuickAddInput
              ref="quickAddInputRef"
              v-model="quickAddText"
              placeholder="任务标题，可含日期/提醒/重复，回车保存"
              :categories="parseCategories"
              :show-meta="true"
              @enter="submitQuickAdd(col.id)"
              @escape="cancelQuickAdd"
              @blur="onQuickAddBlur"
            />
            <TaskPriorityFlagMenu
              v-if="boardMode !== 'priority'"
              v-model="quickAddPriority"
              class="task-kanban__quick-add-priority"
            />
          </div>

          <div
            v-if="!loading && columnRows(col.id).length === 0"
            class="task-kanban__drop-empty"
          >
            <span>拖到这里</span>
          </div>

          <article
            v-for="row in columnRows(col.id)"
            :key="row.task.id"
            class="task-kanban__card"
            :class="{
              'is-selected': selectedId === row.task.id,
              'is-dragging': draggingTaskId === row.task.id,
              'task-kanban__card--done': row.task.status === 'DONE',
              'task-kanban__card--child': row.depth > 0
            }"
            :style="row.depth > 0 ? { marginLeft: `${row.depth * 14}px` } : undefined"
            :draggable="row.isRoot && isCardDraggable(col.id, row.task)"
            @dragstart="onDragStart(row.task.id, $event)"
            @dragend="onDragEnd"
            @click="emit('select', row.task.id)"
          >
            <div class="task-kanban__card-top">
              <button
                v-if="childCount(row.task.id) > 0"
                type="button"
                class="task-kanban__expand"
                :aria-expanded="isExpanded(row.task.id)"
                :aria-label="isExpanded(row.task.id) ? '折叠子任务' : '展开子任务'"
                :title="isExpanded(row.task.id) ? '折叠子任务' : '展开子任务'"
                @click.stop="toggleExpand(row.task.id)"
              >
                <el-icon>
                  <ArrowDown v-if="isExpanded(row.task.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </button>
              <span v-else class="task-kanban__expand-placeholder" aria-hidden="true" />
              <TaskStatusCheckbox
                :status="row.task.status"
                @toggle="emit('toggle-status', row.task)"
              />
              <span class="task-kanban__card-title">{{ row.task.title }}</span>
              <span
                v-if="childCount(row.task.id) > 0 && !isExpanded(row.task.id)"
                class="task-kanban__child-count"
              >
                {{ childCount(row.task.id) }}
              </span>
            </div>
            <p v-if="descriptionPreview(row.task)" class="task-kanban__card-desc">
              {{ descriptionPreview(row.task) }}
            </p>
            <div v-if="hasCardMeta(row.task)" class="task-kanban__card-meta">
              <span v-if="categoryLabel(row.task)" class="task-kanban__meta-item" title="清单">
                {{ categoryLabel(row.task) }}
              </span>
              <span v-if="groupLabel(row.task)" class="task-kanban__meta-item" title="分组">
                {{ groupLabel(row.task) }}
              </span>
              <span
                v-if="createdLabel(row.task)"
                class="task-kanban__meta-item"
                title="创建时间"
              >
                创建 {{ createdLabel(row.task) }}
              </span>
              <span
                v-if="dueMetaLabel(row.task)"
                class="task-kanban__meta-item"
                :class="{ 'is-overdue': isOverdue(row.task) }"
                title="截止时间"
              >
                截止 {{ dueMetaLabel(row.task) }}
              </span>
            </div>
          </article>
        </div>

      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown, ArrowRight, MoreFilled, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import type { KanbanGroup, Task, TaskStatus } from '@shared/types'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import type { KanbanBoardMode } from '@shared/kanban-config'
import { KANBAN_STATUS_COLUMNS, statusLabelFor } from '@shared/kanban-config'
import {
  KANBAN_TIME_COLUMNS,
  KANBAN_UNTAGGED_ID,
  dueAtForTimeColumn,
  isKanbanTimeColumnId,
  tagColumnIdForTask,
  tagColumnsForTasks,
  tagsForTagColumn,
  timeColumnIdForTask
} from '@shared/kanban-group-columns'
import { TASK_PRIORITIES, DEFAULT_TASK_PRIORITY, isValidTaskPriority, type TaskPriority } from '@shared/task-priority'
import { KANBAN_DONE_COLUMN_ID, KANBAN_UNGROUPED_ID } from '@shared/kanban-scope'
import {
  resolveHideDoneScope,
  shouldShowKanbanDoneColumn,
  type HideDoneScope
} from '@shared/hide-done-scope'
import { readKanbanConfig } from '@/utils/kanban-preferences'
import { taskDescriptionPreview } from '@shared/task-description'
import { buildQuickCreateTaskDtoFromDraft, toParseCategories } from '@shared/quick-create-task'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'
import QuickAddInput from '@/components/QuickAddInput.vue'
import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'
import TaskStatusCheckbox from '@/components/TaskStatusCheckbox.vue'
import { compareTasks } from '@shared/task-list-layout'
import type { TaskSortBy } from '@shared/task-list-layout'
import { unwrapIpc } from '@/ipc/client'

interface DisplayColumn {
  id: string
  name: string
}

interface KanbanCardRow {
  task: Task
  depth: number
  isRoot: boolean
}

const DONE_COLUMN_ID = KANBAN_DONE_COLUMN_ID

const props = defineProps<{
  scopeKey: string
  tasks: Task[]
  loading: boolean
  selectedId?: string | null
  /** @deprecated 请使用 hideDoneScope */
  hideDone?: boolean
  hideDoneScope?: HideDoneScope
  metaVisibility?: TaskListMetaVisibility
  sortBy?: TaskSortBy
  /** 看板列分组方式（由视图配置决定，不在看板内切换） */
  boardMode?: KanbanBoardMode
  /** 快捷添加任务默认清单 */
  defaultCategoryId?: string | null
  /** 用于快捷识别中的分类名匹配 */
  parseCategories?: { id: string; name: string; keywords?: string[] }[]
}>()

const parseCategories = computed(() => props.parseCategories ?? [])

const effectiveHideDoneScope = computed(() =>
  props.hideDoneScope ?? resolveHideDoneScope({ hideDone: props.hideDone })
)

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
  changed: []
}>()

/** 当前选中的看板列：顶栏快捷添加会写入此列 */
const selectedColumnId = defineModel<string | null>('selectedColumnId', { default: null })

const boardMode = computed(() => props.boardMode ?? 'group')
const sortBy = computed(() => props.sortBy ?? 'custom')

const kanbanConfigTick = ref(0)
const kanbanConfig = computed(() => {
  kanbanConfigTick.value
  return readKanbanConfig()
})

const customGroups = ref<KanbanGroup[]>([])
const ungroupedName = ref('未分组')
const draggingTaskId = ref<string | null>(null)
const dropTargetColumnId = ref<string | null>(null)
const quickAddColumn = ref<string | null>(null)
const quickAddText = ref('')
const quickAddPriority = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)
const quickAddInputRef = ref<InstanceType<typeof QuickAddInput> | InstanceType<typeof QuickAddInput>[] | null>(null)
/** 已展开的父任务 id；默认全部折叠 */
const expandedIds = ref<Set<string>>(new Set())

const rootTasks = computed(() => props.tasks.filter((t) => !t.parentId))

const childrenByParent = computed(() => {
  const map = new Map<string, Task[]>()
  for (const t of props.tasks) {
    if (!t.parentId) continue
    if (!map.has(t.parentId)) map.set(t.parentId, [])
    map.get(t.parentId)!.push(t)
  }
  return map
})

function sortTaskList(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, sortBy.value))
}

const displayColumns = computed<DisplayColumn[]>(() => {
  if (boardMode.value === 'status') {
    const labels = kanbanConfig.value.statusColumnLabels
    return KANBAN_STATUS_COLUMNS.map((status) => ({
      id: status,
      name: statusLabelFor(status, labels)
    }))
  }
  if (boardMode.value === 'priority') {
    return TASK_PRIORITIES.map((p) => ({
      id: String(p.value),
      name: `${p.code} · ${p.label}`
    }))
  }
  if (boardMode.value === 'time') {
    return KANBAN_TIME_COLUMNS.map((col) => ({ id: col.id, name: col.label }))
  }
  if (boardMode.value === 'tag') {
    return tagColumnsForTasks(rootTasks.value)
  }
  const cols: DisplayColumn[] = [{ id: KANBAN_UNGROUPED_ID, name: ungroupedName.value }]
  for (const g of customGroups.value) {
    cols.push({ id: g.id, name: g.name })
  }
  if (shouldShowKanbanDoneColumn(effectiveHideDoneScope.value)) {
    cols.push({ id: DONE_COLUMN_ID, name: '已完成' })
  }
  return cols
})

const groupIdSet = computed(() => new Set(customGroups.value.map((g) => g.id)))

function columnTaskCount(columnId: string): number {
  return tasksInColumn(columnId).length
}

function childCount(taskId: string): number {
  return childrenByParent.value.get(taskId)?.length ?? 0
}

function isExpanded(taskId: string): boolean {
  return expandedIds.value.has(taskId)
}

function toggleExpand(taskId: string) {
  const next = new Set(expandedIds.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedIds.value = next
}

function expandAncestors(taskId: string) {
  const byId = new Map(props.tasks.map((t) => [t.id, t]))
  const next = new Set(expandedIds.value)
  let changed = false
  let current = byId.get(taskId)
  while (current?.parentId) {
    if (!next.has(current.parentId)) {
      next.add(current.parentId)
      changed = true
    }
    current = byId.get(current.parentId)
  }
  if (changed) expandedIds.value = next
}

function resolveColumnId(task: Task): string {
  if (task.kanbanGroupId && groupIdSet.value.has(task.kanbanGroupId)) {
    return task.kanbanGroupId
  }
  return KANBAN_UNGROUPED_ID
}

function activeInColumn(columnId: string) {
  return rootTasks.value.filter((t) => t.status !== 'DONE' && resolveColumnId(t) === columnId)
}

function doneTasks() {
  return rootTasks.value.filter((t) => t.status === 'DONE')
}

function tasksInColumn(columnId: string): Task[] {
  if (boardMode.value === 'status') {
    return rootTasks.value.filter((t) => t.status === columnId)
  }
  if (boardMode.value === 'priority') {
    const priority = Number(columnId)
    if (!isValidTaskPriority(priority)) return []
    return rootTasks.value.filter((t) => {
      const p = typeof t.priority === 'number' ? t.priority : Number(t.priority)
      return (Number.isFinite(p) ? p : 4) === priority
    })
  }
  if (boardMode.value === 'time') {
    return rootTasks.value.filter((t) => timeColumnIdForTask(t) === columnId)
  }
  if (boardMode.value === 'tag') {
    return rootTasks.value.filter((t) => tagColumnIdForTask(t) === columnId)
  }
  if (columnId === DONE_COLUMN_ID) {
    return doneTasks()
  }
  return activeInColumn(columnId)
}

function columnRows(columnId: string): KanbanCardRow[] {
  const rows: KanbanCardRow[] = []

  function walk(task: Task, depth: number) {
    rows.push({ task, depth, isRoot: depth === 0 })
    if (!isExpanded(task.id)) return
    const children = sortTaskList(childrenByParent.value.get(task.id) ?? [])
    for (const child of children) {
      walk(child, depth + 1)
    }
  }

  for (const root of sortTaskList(tasksInColumn(columnId))) {
    walk(root, 0)
  }
  return rows
}

function isCardDraggable(columnId: string, task: Task): boolean {
  if (
    boardMode.value === 'status' ||
    boardMode.value === 'priority' ||
    boardMode.value === 'time' ||
    boardMode.value === 'tag'
  ) {
    return true
  }
  return columnId !== DONE_COLUMN_ID && task.status !== 'DONE'
}

function isStatusColumn(columnId: string): columnId is TaskStatus {
  return columnId === 'TODO' || columnId === 'IN_PROGRESS' || columnId === 'DONE'
}

function descriptionPreview(task: Task) {
  return taskDescriptionPreview(task.description, 48)
}

function metaVis() {
  return props.metaVisibility ?? DEFAULT_TASK_LIST_META_VISIBILITY
}

function categoryName(categoryId: string | null | undefined): string {
  if (!categoryId) return ''
  return parseCategories.value.find((c) => c.id === categoryId)?.name ?? ''
}

/** 清单（分类） */
function categoryLabel(task: Task): string {
  const name = categoryName(task.categoryId)
  if (name) return name
  if (task.categoryId === null) return '未分类'
  return ''
}

/** 看板自定义分组名（仅有分组时显示） */
function groupLabel(task: Task): string {
  if (task.kanbanGroupId && groupIdSet.value.has(task.kanbanGroupId)) {
    return customGroups.value.find((g) => g.id === task.kanbanGroupId)?.name ?? ''
  }
  return ''
}

function createdLabel(task: Task): string {
  if (!metaVis().createdAt || !task.createdAt) return ''
  return formatTaskCreatedAt(task.createdAt)
}

function dueMetaLabel(task: Task): string {
  if (!metaVis().dueAt || !task.dueAt) return ''
  return formatTaskListTime(task.dueAt)
}

function isOverdue(task: Task): boolean {
  if (task.status === 'DONE' || !task.dueAt) return false
  return dayjs(task.dueAt).isBefore(dayjs(), 'minute')
}

function hasCardMeta(task: Task): boolean {
  return Boolean(
    categoryLabel(task) || groupLabel(task) || createdLabel(task) || dueMetaLabel(task)
  )
}

async function loadGroups() {
  try {
    const board = unwrapIpc(await window.api.kanbanGroups.list(props.scopeKey))
    customGroups.value = board.groups
    ungroupedName.value = board.ungroupedName || '未分组'
  } catch {
    customGroups.value = []
    ungroupedName.value = '未分组'
  }
}

watch(() => props.scopeKey, () => {
  selectedColumnId.value = null
  void loadGroups()
}, { immediate: true })

watch(selectedColumnId, (columnId) => {
  if (!columnId) return
  void nextTick(() => {
    const el = document.querySelector(
      `.task-kanban__col[data-column-id="${CSS.escape(columnId)}"]`
    ) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  })
})

watch(
  () => props.selectedId,
  (id) => {
    if (!id) return
    expandAncestors(id)
  },
  { immediate: true }
)

function toggleColumnSelection(columnId: string) {
  selectedColumnId.value = selectedColumnId.value === columnId ? null : columnId
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDragStart(taskId: string, e: DragEvent) {
  const task = rootTasks.value.find((t) => t.id === taskId)
  if (!task) {
    e.preventDefault()
    return
  }
  if (boardMode.value === 'group' && task.status === 'DONE') {
    e.preventDefault()
    return
  }
  draggingTaskId.value = taskId
  if (!e.dataTransfer) return
  e.dataTransfer.setData('application/x-ai-todo-task-drag', JSON.stringify({ id: taskId }))
  e.dataTransfer.setData('text/plain', taskId)
  e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggingTaskId.value = null
  dropTargetColumnId.value = null
}

function onDragEnter(columnId: string) {
  if (draggingTaskId.value) {
    dropTargetColumnId.value = columnId
  }
}

function onDragLeave(columnId: string) {
  if (dropTargetColumnId.value === columnId) {
    dropTargetColumnId.value = null
  }
}

async function onDrop(columnId: string, e: DragEvent) {
  if (boardMode.value === 'group' && columnId === DONE_COLUMN_ID) {
    draggingTaskId.value = null
    dropTargetColumnId.value = null
    return
  }
  const raw = e.dataTransfer?.getData('application/x-ai-todo-task-drag')
  const taskId =
    draggingTaskId.value ??
    (raw ? safeParseDraggedId(raw) : null) ??
    e.dataTransfer?.getData('text/plain') ??
    null
  draggingTaskId.value = null
  dropTargetColumnId.value = null
  if (!taskId) return
  const task = rootTasks.value.find((t) => t.id === taskId)
  if (!task) return

  if (boardMode.value === 'status') {
    if (!isStatusColumn(columnId) || task.status === columnId) return
    try {
      unwrapIpc(await window.api.tasks.update(taskId, { status: columnId }))
      emit('changed')
    } catch {
      /* unwrapIpc 已提示 */
    }
    return
  }

  if (boardMode.value === 'priority') {
    const priority = Number(columnId)
    if (!isValidTaskPriority(priority) || task.priority === priority) return
    try {
      unwrapIpc(await window.api.tasks.update(taskId, { priority: priority as TaskPriority }))
      emit('changed')
    } catch {
      /* unwrapIpc 已提示 */
    }
    return
  }

  if (boardMode.value === 'time') {
    if (!isKanbanTimeColumnId(columnId)) return
    if (timeColumnIdForTask(task) === columnId) return
    try {
      unwrapIpc(await window.api.tasks.update(taskId, { dueAt: dueAtForTimeColumn(columnId) }))
      emit('changed')
    } catch {
      /* unwrapIpc 已提示 */
    }
    return
  }

  if (boardMode.value === 'tag') {
    if (tagColumnIdForTask(task) === columnId) return
    try {
      unwrapIpc(await window.api.tasks.update(taskId, { tags: tagsForTagColumn(task, columnId) }))
      emit('changed')
    } catch {
      /* unwrapIpc 已提示 */
    }
    return
  }

  if (task.status === 'DONE') return
  if (resolveColumnId(task) === columnId) return
  const nextGroupId = columnId === KANBAN_UNGROUPED_ID ? null : columnId
  try {
    unwrapIpc(await window.api.tasks.update(taskId, { kanbanGroupId: nextGroupId }))
    emit('changed')
  } catch {
    /* unwrapIpc 已提示 */
  }
}

function safeParseDraggedId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { id?: unknown }
    return typeof parsed.id === 'string' && parsed.id ? parsed.id : null
  } catch {
    return null
  }
}

async function onAddGroup() {
  const { value } = await ElMessageBox.prompt('分组名称', '新分组', {
    confirmButtonText: '创建',
    cancelButtonText: '取消'
  })
  if (!value?.trim()) return
  try {
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'end'
      })
    )
    await loadGroups()
  } catch {
  }
}

async function onColumnCommand(command: string, col: DisplayColumn) {
  if (command === 'rename') {
    const { value } = await ElMessageBox.prompt('分组名称', '重命名', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: col.name
    })
    if (!value?.trim() || value.trim() === col.name) return
    if (col.id === KANBAN_UNGROUPED_ID) {
      unwrapIpc(
        await window.api.kanbanGroups.update(KANBAN_UNGROUPED_ID, {
          name: value.trim(),
          scopeKey: props.scopeKey
        })
      )
    } else {
      unwrapIpc(await window.api.kanbanGroups.update(col.id, { name: value.trim() }))
    }
    await loadGroups()
    return
  }
  if (command === 'add-left') {
    const { value } = await ElMessageBox.prompt('分组名称', '在左侧添加分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    if (!value?.trim()) return
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'before',
        refGroupId: col.id
      })
    )
    await loadGroups()
    return
  }
  if (command === 'add-right') {
    const { value } = await ElMessageBox.prompt('分组名称', '在右侧添加分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    if (!value?.trim()) return
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'after',
        refGroupId: col.id
      })
    )
    await loadGroups()
    return
  }
  if (command === 'delete') {
    await ElMessageBox.confirm(
      `确定删除分组「${col.name}」？其下任务将移入「${ungroupedName.value}」。`,
      '删除分组', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    unwrapIpc(await window.api.kanbanGroups.delete(col.id))
    await loadGroups()
    emit('changed')
  }
}

function startQuickAdd(columnId: string) {
  quickAddColumn.value = columnId
  quickAddText.value = ''
  quickAddPriority.value = DEFAULT_TASK_PRIORITY
  void nextTick(() => {
    const el = quickAddInputRef.value
    const input = Array.isArray(el) ? el[0] : el
    input?.focus()
  })
}

function cancelQuickAdd() {
  quickAddColumn.value = null
  quickAddText.value = ''
  quickAddPriority.value = DEFAULT_TASK_PRIORITY
}

function onQuickAddBlur() {
  window.setTimeout(() => {
    if (!quickAddText.value.trim()) cancelQuickAdd()
  }, 120)
}

async function submitQuickAdd(columnId: string) {
  const title = quickAddText.value.trim()
  if (!title) {
    cancelQuickAdd()
    return
  }
  try {
    const cats = toParseCategories(props.parseCategories ?? [])
    const parsed = unwrapIpc(await window.api.app.parseTaskInput(title, cats))
    const baseOverrides =
      boardMode.value === 'status' && isStatusColumn(columnId)
        ? {
            categoryId: props.defaultCategoryId ?? null,
            status: columnId as import('@shared/types').TaskStatus,
            priority: quickAddPriority.value
          }
        : boardMode.value === 'priority' && isValidTaskPriority(Number(columnId))
          ? {
              categoryId: props.defaultCategoryId ?? null,
              priority: Number(columnId) as TaskPriority
            }
          : boardMode.value === 'time' && isKanbanTimeColumnId(columnId)
            ? {
                categoryId: props.defaultCategoryId ?? null,
                dueAt: dueAtForTimeColumn(columnId),
                priority: quickAddPriority.value
              }
            : boardMode.value === 'tag'
              ? {
                  categoryId: props.defaultCategoryId ?? null,
                  tags: columnId === KANBAN_UNTAGGED_ID ? [] : [columnId],
                  priority: quickAddPriority.value
                }
              : {
                  categoryId: props.defaultCategoryId ?? null,
                  kanbanGroupId: columnId === KANBAN_UNGROUPED_ID ? null : columnId,
                  priority: quickAddPriority.value
                }
    const dto = buildQuickCreateTaskDtoFromDraft(parsed.draft, title, cats, baseOverrides)
    unwrapIpc(await window.api.tasks.create(dto))
    cancelQuickAdd()
    emit('changed')
  } catch {
  }
}
</script>

<style scoped lang="scss">
.task-kanban {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
  overflow: hidden;
}

.task-kanban__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 16px 0;
  flex-shrink: 0;
  gap: 10px;
}

.task-kanban__mode {
  display: inline-flex;
  margin-right: auto;
  padding: 2px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  gap: 2px;
}

.task-kanban__mode-btn {
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;

  &.is-active {
    background: #fff;
    color: var(--el-color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

.task-kanban__drag-indicator {
  margin-right: auto;
  align-self: center;
  font-size: 12px;
  color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.12);
  border: 1px solid rgba(64, 158, 255, 0.32);
  border-radius: 999px;
  padding: 4px 10px;
}

.task-kanban__add-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.task-kanban__empty {
  text-align: center;
  padding: 48px;
  color: var(--desktop-muted);
}

.task-kanban__board {
  --kanban-col-min: 260px;
  /* 紧凑卡片约 7～8 条可见；两行列在默认窗口高度下都能露出来 */
  --kanban-col-body-height: 340px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: flex-start;
  gap: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px 14px;
}

.task-kanban__col {
  /* 放不下时换到下一行，不横向滚动 */
  flex: 1 1 var(--kanban-col-min);
  min-width: var(--kanban-col-min);
  max-width: 100%;
  width: auto;
  height: calc(34px + var(--kanban-col-body-height));
  max-height: calc(34px + var(--kanban-col-body-height));
  display: flex;
  flex-direction: column;
  background: #eef0f3;
  border-radius: 10px;
  padding: 6px 6px 8px;
  box-sizing: border-box;
  transition: background 0.15s ease, box-shadow 0.15s ease;

  &.is-column-selected {
    background: rgba(64, 158, 255, 0.08);
  }

  &.is-drop-target {
    background: rgba(64, 158, 255, 0.12);
    box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.55);
  }

  &.is-wip-warning .task-kanban__col-head {
    .task-kanban__col-count,
    .task-kanban__col-wip {
      color: #e6a23c;
    }
  }
}

.task-kanban__count-mode {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  gap: 2px;
  flex-shrink: 0;
}

.task-kanban__count-mode-btn {
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;

  &.is-active {
    background: #fff;
    color: var(--el-color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

.task-kanban__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 6px;
  flex-shrink: 0;
}

.task-kanban__col-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.task-kanban__col-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-kanban__col-count-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.task-kanban__col-count {
  font-size: 12px;
  color: var(--desktop-muted);
  font-weight: 600;
}

.task-kanban__col-wip {
  font-size: 10px;
  color: var(--desktop-muted);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 999px;
  padding: 0 5px;

  &.is-over {
    color: #e6a23c;
    border-color: rgba(230, 162, 60, 0.45);
    background: rgba(230, 162, 60, 0.1);
  }
}

.task-kanban__col-count-badge {
  font-size: 10px;
  color: var(--el-color-primary);
  border: 1px solid rgba(64, 158, 255, 0.28);
  background: rgba(64, 158, 255, 0.08);
  border-radius: 999px;
  padding: 0 5px;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-kanban__col-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.task-kanban__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--desktop-text);
  }
}

.task-kanban__cards {
  flex: 1;
  min-height: 0;
  height: var(--kanban-col-body-height);
  max-height: var(--kanban-col-body-height);
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 1px 2px;
}

.task-kanban__drop-empty {
  border: 1px dashed rgba(64, 158, 255, 0.55);
  background: rgba(64, 158, 255, 0.06);
  border-radius: 8px;
  min-height: 72px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  font-size: 12px;
}

.task-kanban__quick-add {
  background: #fff;
  border: 1px solid var(--el-color-primary);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 6px;

  :deep(.quick-add-input) {
    flex: 1;
    min-width: 0;
  }
}

.task-kanban__quick-add-priority {
  flex-shrink: 0;
  margin-top: 2px;
}

.task-kanban__card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }

  &.is-dragging {
    opacity: 0.55;
    cursor: grabbing;
  }

  &[draggable='true'] {
    cursor: grab;
  }

  &--done {
    opacity: 0.72;
  }

  &--child {
    border-style: dashed;
    box-shadow: none;
  }
}

.task-kanban__card-top {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.task-kanban__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 11px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--desktop-text);
  }
}

.task-kanban__expand-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.task-kanban__child-count {
  flex-shrink: 0;
  margin-top: 1px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--desktop-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

.task-kanban__card-title {
  flex: 1;
  font-size: 13px;
  line-height: 1.35;
  word-break: break-word;
  color: var(--desktop-text);

  &.is-done {
    text-decoration: line-through;
    color: var(--desktop-muted);
  }
}

.task-kanban__card-desc {
  margin: 3px 0 0 40px;
  font-size: 11px;
  color: var(--desktop-muted);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-kanban__card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 4px 0 0 40px;
}

.task-kanban__meta-item {
  font-size: 11px;
  color: var(--desktop-muted);
  line-height: 1.3;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;

  &.is-overdue {
    color: #e03e3e;
    font-weight: 500;
  }
}

.task-kanban__done {
  flex-shrink: 0;
  border-top: 1px solid #e8eaed;
  padding-top: 8px;
  margin-top: 4px;
}

.task-kanban__done-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 4px;
  font-size: 12px;
  color: var(--desktop-muted);
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.task-kanban__done-chevron {
  font-size: 12px;
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(0deg);
  }

  &:not(.is-open) {
    transform: rotate(-90deg);
  }
}

.task-kanban__done-count {
  margin-left: auto;
}

.task-kanban__done-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  max-height: 240px;
  overflow-y: auto;
}
</style>
