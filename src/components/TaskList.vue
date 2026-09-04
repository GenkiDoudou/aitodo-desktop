<template>
  <div class="task-list" v-loading="loading">
    <div v-if="!loading && layoutItems.length === 0" class="task-list__empty">
      <p>暂无任务</p>
      <p class="task-list__hint">在上方输入框回车，或按 Ctrl+N 新建</p>
    </div>
    <ul v-else class="task-list__ul">
      <template v-for="(item, idx) in displayItems" :key="itemKey(item, idx)">
        <li v-if="item.type === 'group'" class="task-list__group">
          <button
            type="button"
            class="task-list__group-toggle"
            :aria-expanded="!isGroupCollapsed(item.key)"
            @click="toggleGroup(item.key)"
          >
            <el-icon class="task-list__group-caret">
              <ArrowDown v-if="!isGroupCollapsed(item.key)" />
              <ArrowRight v-else />
            </el-icon>
            <span class="task-list__group-label">{{ item.label }}</span>
            <span class="task-list__group-count">{{ groupTaskCount(item.key) }}</span>
          </button>
        </li>
        <li v-else class="task-list__item">
          <el-dropdown
            trigger="contextmenu"
            class="task-list__dropdown"
            @command="(cmd: string) => onTaskCommand(cmd, item.task.id, item.depth)"
          >
            <div
              class="task-list__row"
              :class="{
                'is-selected': selectedId === item.task.id,
                'is-draggable': item.depth === 0,
                'is-dragging': taskDragId === item.task.id,
                'is-drag-over-before':
                  taskDropHint?.id === item.task.id && taskDropHint.place === 'before',
                'is-drag-over-after':
                  taskDropHint?.id === item.task.id && taskDropHint.place === 'after'
              }"
              :style="{ paddingLeft: `${12 + item.depth * 20}px` }"
              :draggable="item.depth === 0"
              @click="emit('select', item.task.id)"
              @dragstart="onTaskDragStart($event, item.task.id, item.depth)"
              @dragover="onTaskDragOver($event, item.task.id, item.depth)"
              @dragleave="onTaskDragLeave(item.task.id)"
              @drop="onTaskDrop($event, item.task.id, item.depth)"
              @dragend="onTaskDragEnd"
            >
              <button
                v-if="hasChildren(item.task.id)"
                type="button"
                class="task-list__expand"
                :aria-expanded="isExpanded(item.task.id)"
                :aria-label="isExpanded(item.task.id) ? '折叠子任务' : '展开子任务'"
                @click="toggleExpand(item.task.id, $event)"
              >
                <el-icon>
                  <ArrowDown v-if="isExpanded(item.task.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </button>
              <span v-else class="task-list__expand-placeholder" aria-hidden="true" />

              <TaskStatusCheckbox
                :status="item.task.status"
                @toggle="emit('toggle-status', item.task)"
              />

              <TaskPriorityBadge :priority="item.task.priority ?? 4" variant="text" />

              <span class="task-list__title" :class="{ 'is-done': item.task.status === 'DONE' }">
                {{ item.task.title }}
              </span>

              <span class="task-list__meta">
                <span
                  v-if="categoryLabel(item.task)"
                  class="task-list__tag task-list__tag--category"
                  title="清单"
                  :style="categoryTagStyle(item.task)"
                >
                  {{ categoryLabel(item.task) }}
                </span>
                <span v-if="primaryTag(item.task)" class="task-list__tag">{{ primaryTag(item.task) }}</span>
                <span v-if="showCreatedAt(item.task)" class="task-list__meta-inline" title="创建时间">
                  创建 {{ formatTaskCreatedAt(item.task.createdAt) }}
                </span>
                <span
                  v-if="showDueAt(item.task)"
                  class="task-list__meta-inline"
                  :class="{ 'is-overdue': isOverdue(item.task) }"
                  title="截止时间"
                >
                  截止 {{ formatTaskListTime(item.task.dueAt!) }}
                </span>
                <span v-if="showRemindAt(item.task)" class="task-list__meta-inline" title="提醒时间">
                  提醒 {{ remindDisplay(item.task) }}
                </span>
                <span v-if="showCompletedAt(item.task)" class="task-list__meta-inline" title="完成时间">
                  完成 {{ formatTaskListTime(item.task.completedAt!) }}
                </span>
                <span class="task-list__status" :class="statusClass(item.task.status)">
                  {{ statusText(item.task.status) }}
                </span>
              </span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="move-up"
                  :disabled="item.depth !== 0 || rootIndex(item.task.id) <= 0"
                >
                  上移
                </el-dropdown-item>
                <el-dropdown-item
                  command="move-down"
                  :disabled="
                    item.depth !== 0 || rootIndex(item.task.id) >= rootTaskIds.length - 1
                  "
                >
                  下移
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import { moveItemInOrder } from '@shared/list-order'
import type { TaskListLayoutItem } from '@shared/task-list-layout'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'
import { taskStatusLabel } from '@shared/task-status-cycle'
import { primaryTaskTag } from '@shared/task-tags'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'
import TaskStatusCheckbox from '@/components/TaskStatusCheckbox.vue'

const TASK_REORDER_MIME = 'application/x-ai-todo-list-task-reorder'

const props = withDefaults(
  defineProps<{
    layoutItems: TaskListLayoutItem[]
    loading: boolean
    selectedId?: string | null
    /** 列表行内展示哪些时间字段 */
    metaVisibility?: TaskListMetaVisibility
    /** 是否在行内显示清单名（全部/视图等跨清单场景） */
    showCategory?: boolean
    categories?: { id: string; name: string }[]
  }>(),
  {
    showCategory: false,
    categories: () => []
  }
)

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
  /** 当前渲染扁平顶层任务的新顺序 */
  'reorder-roots': [string[]]
}>()

const expandedIds = ref<Set<string>>(new Set())
/** 折叠的分组 key（贴稿可折叠分组头） */
const collapsedGroupIds = ref<Set<string>>(new Set())
const taskDragId = ref<string | null>(null)
const taskDropHint = ref<{ id: string; place: 'before' | 'after' } | null>(null)

const taskById = computed(() => {
  const map = new Map<string, Task>()
  for (const item of props.layoutItems) {
    if (item.type === 'task') map.set(item.task.id, item.task)
  }
  return map
})

const childCountByParent = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.layoutItems) {
    if (item.type !== 'task' || !item.task.parentId) continue
    counts.set(item.task.parentId, (counts.get(item.task.parentId) ?? 0) + 1)
  }
  return counts
})

function itemKey(item: TaskListLayoutItem, idx: number): string {
  if (item.type === 'group') return `g-${item.key}-${idx}`
  return item.task.id
}

function hasChildren(taskId: string): boolean {
  return (childCountByParent.value.get(taskId) ?? 0) > 0
}

function childCount(taskId: string): number {
  return childCountByParent.value.get(taskId) ?? 0
}

function isExpanded(taskId: string): boolean {
  return expandedIds.value.has(taskId)
}

function isRowVisible(task: Task, depth: number): boolean {
  if (depth === 0) return true
  let parentId = task.parentId
  while (parentId) {
    if (!expandedIds.value.has(parentId)) return false
    const parent = taskById.value.get(parentId)
    if (!parent) break
    parentId = parent.parentId
  }
  return true
}

/** 分组标题始终展示；折叠分组下的任务与折叠子任务一并隐藏 */
const displayItems = computed(() => {
  let currentGroup: string | null = null
  return props.layoutItems.filter((item) => {
    if (item.type === 'group') {
      currentGroup = item.key
      return true
    }
    if (currentGroup && collapsedGroupIds.value.has(currentGroup)) return false
    return isRowVisible(item.task, item.depth)
  })
})

/** 各分组下顶层任务数（用于灰圆计数） */
const groupRootCounts = computed(() => {
  const counts = new Map<string, number>()
  let current: string | null = null
  for (const item of props.layoutItems) {
    if (item.type === 'group') {
      current = item.key
      if (!counts.has(current)) counts.set(current, 0)
      continue
    }
    if (current && item.depth === 0) {
      counts.set(current, (counts.get(current) ?? 0) + 1)
    }
  }
  return counts
})

function isGroupCollapsed(key: string): boolean {
  return collapsedGroupIds.value.has(key)
}

function toggleGroup(key: string) {
  const next = new Set(collapsedGroupIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroupIds.value = next
}

function groupTaskCount(key: string): number {
  return groupRootCounts.value.get(key) ?? 0
}

const rootTaskIds = computed(() =>
  displayItems.value
    .filter((item): item is Extract<TaskListLayoutItem, { type: 'task' }> =>
      item.type === 'task' && item.depth === 0
    )
    .map((item) => item.task.id)
)

function rootIndex(id: string): number {
  return rootTaskIds.value.indexOf(id)
}

function onTaskDragStart(e: DragEvent, id: string, depth: number) {
  if (depth !== 0) {
    e.preventDefault()
    return
  }
  taskDragId.value = id
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TASK_REORDER_MIME, id)
  e.dataTransfer.effectAllowed = 'move'
}

function onTaskDragOver(e: DragEvent, id: string, depth: number) {
  if (depth !== 0 || !taskDragId.value || taskDragId.value === id) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const place = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  taskDropHint.value = { id, place }
}

function onTaskDragLeave(id: string) {
  if (taskDropHint.value?.id === id) taskDropHint.value = null
}

function onTaskDrop(e: DragEvent, targetId: string, depth: number) {
  e.preventDefault()
  const fromId = taskDragId.value ?? e.dataTransfer?.getData(TASK_REORDER_MIME)
  const place = taskDropHint.value?.id === targetId ? taskDropHint.value.place : 'after'
  taskDropHint.value = null
  taskDragId.value = null
  if (depth !== 0 || !fromId || fromId === targetId) return
  const ids = [...rootTaskIds.value]
  const from = ids.indexOf(fromId)
  const target = ids.indexOf(targetId)
  if (from < 0 || target < 0) return
  let insertAt = place === 'before' ? target : target + 1
  if (from < insertAt) insertAt--
  const next = moveItemInOrder(ids, from, insertAt)
  if (next.every((id, i) => id === ids[i])) return
  emit('reorder-roots', next)
}

function onTaskDragEnd() {
  taskDragId.value = null
  taskDropHint.value = null
}

function onTaskCommand(command: string, id: string, depth: number) {
  if (depth !== 0) return
  const ids = [...rootTaskIds.value]
  const from = ids.indexOf(id)
  if (from < 0) return
  if (command === 'move-up') {
    if (from <= 0) return
    emit('reorder-roots', moveItemInOrder(ids, from, from - 1))
  } else if (command === 'move-down') {
    if (from >= ids.length - 1) return
    emit('reorder-roots', moveItemInOrder(ids, from, from + 1))
  }
}

function metaVis() {
  return props.metaVisibility ?? DEFAULT_TASK_LIST_META_VISIBILITY
}

function categoryLabel(task: Task): string {
  if (!props.showCategory) return ''
  if (task.categoryId) {
    return props.categories.find((c) => c.id === task.categoryId)?.name ?? ''
  }
  if (task.categoryId === null) return '未分类'
  return ''
}

/** 清单色点标签：用分类色作边框与浅底 */
function categoryTagStyle(task: Task): Record<string, string> | undefined {
  if (!task.categoryId) return undefined
  const color = props.categories.find((c) => c.id === task.categoryId)?.color
  if (!color) return undefined
  return {
    color,
    background: `${color}18`,
    borderColor: `${color}55`
  }
}

function showCreatedAt(task: Task) {
  return metaVis().createdAt && Boolean(task.createdAt)
}

function showDueAt(task: Task) {
  return metaVis().dueAt && Boolean(task.dueAt)
}

function showRemindAt(task: Task) {
  if (!metaVis().remindAt) return false
  if (task.remindAt) return true
  return (task.reminders?.length ?? 0) > 0
}

function remindDisplay(task: Task): string {
  if (task.remindAt) return formatTaskListTime(task.remindAt)
  const offset = task.reminders?.find((r) => r.offsetMinutes != null)?.offsetMinutes
  if (offset != null) return `提前 ${offset} 分钟`
  if (task.reminders?.length) return formatTaskListTime(task.reminders[0].remindAt)
  return ''
}

function showCompletedAt(task: Task) {
  return metaVis().completedAt && task.status === 'DONE' && Boolean(task.completedAt)
}

function hasMeta(task: Task): boolean {
  return (
    Boolean(categoryLabel(task)) ||
    showCreatedAt(task) ||
    showDueAt(task) ||
    showRemindAt(task) ||
    showCompletedAt(task)
  )
}

function toggleExpand(taskId: string, event: Event) {
  event.stopPropagation()
  const next = new Set(expandedIds.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedIds.value = next
}

function expandAncestors(taskId: string) {
  const next = new Set(expandedIds.value)
  let current = taskById.value.get(taskId)
  let changed = false
  while (current?.parentId) {
    if (!next.has(current.parentId)) {
      next.add(current.parentId)
      changed = true
    }
    current = taskById.value.get(current.parentId)
  }
  if (changed) expandedIds.value = next
}

watch(
  () =>
    props.layoutItems
      .filter((i) => i.type === 'task')
      .map((i) => `${i.task.id}:${i.task.parentId ?? ''}`)
      .join('|'),
  () => {
    const next = new Set(expandedIds.value)
    for (const id of [...next]) {
      if (!hasChildren(id)) next.delete(id)
    }
    expandedIds.value = next
    if (props.selectedId) {
      expandAncestors(props.selectedId)
      if (hasChildren(props.selectedId)) {
        expandedIds.value = new Set([...expandedIds.value, props.selectedId])
      }
    }
  }
)

watch(
  () => props.selectedId,
  (id) => {
    if (id) expandAncestors(id)
  },
  { immediate: true }
)

function isOverdue(task: Task) {
  if (task.status === 'DONE' || !task.dueAt) return false
  return dayjs(task.dueAt).isBefore(dayjs(), 'minute')
}

function statusText(status: Task['status']) {
  return taskStatusLabel(status)
}

function statusClass(status: Task['status']) {
  if (status === 'IN_PROGRESS') return 'is-running'
  if (status === 'DONE') return 'is-done'
  return ''
}

function primaryTag(task: Task) {
  return primaryTaskTag(task)
}
</script>

<style scoped lang="scss">
.task-list {
  flex: 1;
  overflow: auto;
  padding: 0 0 28px;
}

.task-list__empty {
  text-align: center;
  padding: 56px 16px;
  color: var(--desktop-muted);

  p {
    margin: 0 0 8px;
  }
}

.task-list__hint {
  font-size: 12px;
}

.task-list__ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-list__group {
  padding: 4px 12px 2px;
  user-select: none;
  list-style: none;
}

.task-list__group-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 34px;
  border: none;
  background: transparent;
  padding: 0 4px;
  border-radius: 0;
  cursor: pointer;
  color: var(--desktop-text);
  font-weight: 600;

  &:hover {
    background: transparent;
  }
}

.task-list__group-caret {
  font-size: 12px;
  color: var(--desktop-muted);
}

.task-list__group-label {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  text-align: left;
}

.task-list__group-count {
  min-width: auto;
  height: auto;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 12px;
  line-height: 1;
  text-align: center;
}

.task-list__item {
  list-style: none;
}

.task-list__dropdown {
  display: block;
  width: 100%;
}

.task-list__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  cursor: pointer;
  font-size: 14px;
  height: 54px;
  border-top: 1px solid #f0f2f5;

  &:hover {
    background: #fafcff;
  }

  &.is-selected {
    background: var(--desktop-active);
  }

  &.is-draggable {
    cursor: grab;
  }

  &.is-dragging {
    opacity: 0.45;
  }

  &.is-drag-over-before {
    box-shadow: inset 0 2px 0 0 var(--el-color-primary);
  }

  &.is-drag-over-after {
    box-shadow: inset 0 -2px 0 0 var(--el-color-primary);
  }
}

.task-list__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--desktop-text);
  }
}

.task-list__expand-placeholder {
  width: 0;
  flex-shrink: 0;
}

.task-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;

  &.is-done {
    text-decoration: line-through;
    color: #a8abb2;
  }
}

.task-list__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 55%;
  color: #a8abb2;
  font-size: 12px;
}

.task-list__tag {
  display: inline-flex;
  padding: 1px 6px;
  background: #f4f4f5;
  border-radius: 3px;
  border: 1px solid transparent;
  color: #909399;
  font-size: 11px;
  flex-shrink: 0;

  &--category {
    font-weight: 500;
  }
}

.task-list__meta-inline {
  font-size: 12px;
  color: #a8abb2;
  flex-shrink: 0;

  &.is-overdue {
    color: var(--desktop-danger);
  }
}

.task-list__status {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;

  &.is-running {
    color: #409eff;
  }

  &.is-done {
    color: #67c23a;
  }
}

.task-list__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.task-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;

  &.is-done {
    text-decoration: line-through;
    color: var(--desktop-muted);
  }
}

.task-list__child-count {
  font-size: 11px;
  color: var(--desktop-muted);
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  padding: 0 6px;
  line-height: 18px;
  flex-shrink: 0;
}

.task-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 4px;
}

.task-list__meta-item {
  font-size: 11px;
  color: var(--desktop-muted);
  white-space: nowrap;

  &.is-overdue {
    color: var(--el-color-danger);
    font-weight: 500;
  }

  &--completed {
    color: var(--el-color-success);
  }

  &--category {
    color: var(--desktop-text);
    background: var(--desktop-bg);
    border: 1px solid var(--desktop-border);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 18px;
  }
}
</style>
