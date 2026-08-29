<template>
  <div class="quadrant-matrix" v-loading="loading">
    <div class="quadrant-matrix__grid">
      <section
        v-for="meta in TASK_PRIORITIES"
        :key="meta.value"
        class="quadrant-matrix__card"
        :class="{
          'is-drop-target': dropTargetPriority === meta.value,
          'is-drag-source': dragSourcePriority === meta.value
        }"
        @dragover.prevent="onCardDragOver(meta.value)"
        @dragleave="onCardDragLeave(meta.value)"
        @drop.prevent="onCardDrop($event, meta.value)"
      >
        <header class="quadrant-matrix__card-head">
          <span class="quadrant-matrix__badge" :style="{ background: meta.color }">{{ meta.roman }}</span>
          <h3 class="quadrant-matrix__card-title" :style="{ color: meta.color }">{{ meta.quadrantTitle }}</h3>
          <button
            type="button"
            class="quadrant-matrix__add"
            :title="`在「${meta.quadrantTitle}」添加任务`"
            @click="emit('create', meta.value)"
          >
            +
          </button>
        </header>

        <div
          v-if="!hasTasks(meta.value)"
          class="quadrant-matrix__empty"
        >
          没有任务
          <span v-if="dropTargetPriority === meta.value" class="quadrant-matrix__drop-hint">松开放置到此象限</span>
        </div>

        <div v-else class="quadrant-matrix__groups">
          <ul v-if="layoutFor(meta.value).ungrouped.length" class="quadrant-matrix__tasks quadrant-matrix__tasks--flat">
            <li
              v-for="{ task, depth } in tasksWithChildren(layoutFor(meta.value).ungrouped)"
              :key="task.id"
              class="quadrant-matrix__task"
              :class="{ 'is-dragging': draggingTaskId === task.id }"
              :style="{ paddingLeft: `${6 + depth * 18}px` }"
              :draggable="depth === 0"
              @dragstart="depth === 0 && onDragStart($event, task, meta.value)"
              @dragend="onDragEnd"
              @click="onTaskClick(task.id)"
            >
              <button
                v-if="hasChildren(task.id)"
                type="button"
                class="quadrant-matrix__expand"
                :aria-expanded="isExpanded(task.id)"
                @click.stop="toggleExpand(task.id, $event)"
              >
                <el-icon>
                  <ArrowDown v-if="isExpanded(task.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </button>
              <span v-else class="quadrant-matrix__expand-placeholder" aria-hidden="true" />

              <el-checkbox
                :model-value="task.status === 'DONE'"
                @click.stop
                @change="() => emit('toggle-status', task)"
              />
              <div class="quadrant-matrix__task-body">
                <div class="quadrant-matrix__title-row">
                  <TaskPriorityBadge :priority="task.priority ?? 4" />
                  <span class="quadrant-matrix__task-title" :class="{ 'is-done': task.status === 'DONE' }">
                    {{ task.title }}
                  </span>
                  <span
                    v-if="hasChildren(task.id) && !isExpanded(task.id)"
                    class="quadrant-matrix__child-count"
                  >
                    {{ childCount(task.id) }}
                  </span>
                </div>
                <div v-if="depth === 0 && hasTaskMeta(task)" class="quadrant-matrix__task-meta">
                  <span v-if="categoryName(task)" class="quadrant-matrix__category">
                    <span class="quadrant-matrix__folder" aria-hidden="true">📁</span>
                    {{ categoryName(task) }}
                  </span>
                  <span v-if="showCompletedAt(task)" class="quadrant-matrix__meta-item quadrant-matrix__meta-item--completed">
                    完成 {{ formatTaskListTime(task.completedAt!) }}
                  </span>
                  <span v-if="showCreatedAt(task)" class="quadrant-matrix__meta-item">
                    创建 {{ formatTaskCreatedAt(task.createdAt) }}
                  </span>
                  <span
                    v-if="showDueAt(task)"
                    class="quadrant-matrix__meta-item"
                    :class="{ 'is-overdue': isOverdue(task) }"
                  >
                    截止 {{ formatTaskListTime(task.dueAt!) }}
                  </span>
                  <span v-if="showRemindAt(task)" class="quadrant-matrix__meta-item">
                    提醒 {{ formatTaskListTime(task.remindAt!) }}
                  </span>
                </div>
              </div>
            </li>
          </ul>

          <div
            v-for="group in layoutFor(meta.value).groups"
            :key="group.key"
            class="quadrant-matrix__group"
          >
            <button
              type="button"
              class="quadrant-matrix__group-head"
              @click="toggleGroup(meta.value, group.key)"
            >
              <el-icon class="quadrant-matrix__chevron" :class="{ 'is-open': isGroupOpen(meta.value, group.key) }">
                <ArrowRight />
              </el-icon>
              <span>{{ group.label }}</span>
              <span class="quadrant-matrix__group-count">{{ group.tasks.length }}</span>
            </button>

            <ul v-show="isGroupOpen(meta.value, group.key)" class="quadrant-matrix__tasks">
              <li
                v-for="{ task, depth } in tasksWithChildren(group.tasks)"
                :key="task.id"
                class="quadrant-matrix__task"
                :class="{ 'is-dragging': draggingTaskId === task.id }"
                :style="{ paddingLeft: `${6 + depth * 18}px` }"
                :draggable="depth === 0"
                @dragstart="depth === 0 && onDragStart($event, task, meta.value)"
                @dragend="onDragEnd"
                @click="onTaskClick(task.id)"
              >
                <button
                  v-if="hasChildren(task.id)"
                  type="button"
                  class="quadrant-matrix__expand"
                  :aria-expanded="isExpanded(task.id)"
                  @click.stop="toggleExpand(task.id, $event)"
                >
                  <el-icon>
                    <ArrowDown v-if="isExpanded(task.id)" />
                    <ArrowRight v-else />
                  </el-icon>
                </button>
                <span v-else class="quadrant-matrix__expand-placeholder" aria-hidden="true" />

                <el-checkbox
                  :model-value="task.status === 'DONE'"
                  @click.stop
                  @change="() => emit('toggle-status', task)"
                />
                <div class="quadrant-matrix__task-body">
                  <div class="quadrant-matrix__title-row">
                    <TaskPriorityBadge :priority="task.priority ?? 4" />
                    <span class="quadrant-matrix__task-title" :class="{ 'is-done': task.status === 'DONE' }">
                      {{ task.title }}
                    </span>
                    <span
                      v-if="hasChildren(task.id) && !isExpanded(task.id)"
                      class="quadrant-matrix__child-count"
                    >
                      {{ childCount(task.id) }}
                    </span>
                  </div>
                  <div v-if="depth === 0 && hasTaskMeta(task)" class="quadrant-matrix__task-meta">
                    <span v-if="categoryName(task)" class="quadrant-matrix__category">
                      <span class="quadrant-matrix__folder" aria-hidden="true">📁</span>
                      {{ categoryName(task) }}
                    </span>
                    <span v-if="showCompletedAt(task)" class="quadrant-matrix__meta-item quadrant-matrix__meta-item--completed">
                      完成 {{ formatTaskListTime(task.completedAt!) }}
                    </span>
                    <span v-if="showCreatedAt(task)" class="quadrant-matrix__meta-item">
                      创建 {{ formatTaskCreatedAt(task.createdAt) }}
                    </span>
                    <span
                      v-if="showDueAt(task)"
                      class="quadrant-matrix__meta-item"
                      :class="{ 'is-overdue': isOverdue(task) }"
                    >
                      截止 {{ formatTaskListTime(task.dueAt!) }}
                    </span>
                    <span v-if="showRemindAt(task)" class="quadrant-matrix__meta-item">
                      提醒 {{ formatTaskListTime(task.remindAt!) }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Category, Task } from '@shared/types'
import type { TaskPriority } from '@shared/task-priority'
import { TASK_PRIORITIES } from '@shared/task-priority'
import {
  buildChildCountMap,
  flattenQuadrantTaskTree,
  layoutTasksInQuadrant,
  splitTasksByPriority,
  type QuadrantLayoutOptions
} from '@shared/quadrant-tasks'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'

const DRAG_MIME = 'application/x-aitodo-task'

const props = defineProps<{
  tasks: Task[]
  categories: Category[]
  loading: boolean
  layoutOptions: QuadrantLayoutOptions
  metaVisibility?: TaskListMetaVisibility
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
  create: [TaskPriority]
  'change-priority': [taskId: string, priority: TaskPriority]
}>()

const buckets = computed(() => splitTasksByPriority(props.tasks))

const groupOpen = reactive<Record<string, boolean>>({})
const expandedIds = ref<Set<string>>(new Set())
const draggingTaskId = ref<string | null>(null)
const dragSourcePriority = ref<TaskPriority | null>(null)
const dropTargetPriority = ref<TaskPriority | null>(null)
/** 区分拖拽结束后的 click，避免误开详情 */
let suppressClickUntil = 0

function groupKey(priority: TaskPriority, group: string) {
  return `${priority}-${group}`
}

function isGroupOpen(priority: TaskPriority, group: string) {
  const key = groupKey(priority, group)
  return groupOpen[key] !== false
}

function toggleGroup(priority: TaskPriority, group: string) {
  const key = groupKey(priority, group)
  groupOpen[key] = !isGroupOpen(priority, group)
}

function layoutFor(priority: TaskPriority) {
  return layoutTasksInQuadrant(buckets.value[priority], props.layoutOptions)
}

function hasTasks(priority: TaskPriority) {
  const layout = layoutFor(priority)
  return layout.ungrouped.length > 0 || layout.groups.length > 0
}

const childCountMap = computed(() => buildChildCountMap(props.tasks))

function hasChildren(taskId: string) {
  return (childCountMap.value.get(taskId) ?? 0) > 0
}

function childCount(taskId: string) {
  return childCountMap.value.get(taskId) ?? 0
}

function isExpanded(taskId: string) {
  return expandedIds.value.has(taskId)
}

function toggleExpand(taskId: string, event: Event) {
  event.stopPropagation()
  const next = new Set(expandedIds.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedIds.value = next
}

/** 象限内顶层任务 + 已展开子任务，平铺为带 depth 的行 */
function tasksWithChildren(roots: Task[]) {
  return flattenQuadrantTaskTree(roots, props.tasks, expandedIds.value)
}

const categoryMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of props.categories) {
    map.set(c.id, c.name)
  }
  return map
})

function categoryName(task: Task) {
  if (!task.categoryId) return ''
  return categoryMap.value.get(task.categoryId) ?? ''
}

function metaVis() {
  return props.metaVisibility ?? DEFAULT_TASK_LIST_META_VISIBILITY
}

function showCreatedAt(task: Task) {
  return metaVis().createdAt && Boolean(task.createdAt)
}

function showDueAt(task: Task) {
  return metaVis().dueAt && Boolean(task.dueAt)
}

function showRemindAt(task: Task) {
  return metaVis().remindAt && Boolean(task.remindAt)
}

function showCompletedAt(task: Task) {
  return metaVis().completedAt && Boolean(task.completedAt)
}

function hasTaskMeta(task: Task) {
  return (
    Boolean(categoryName(task)) ||
    showCreatedAt(task) ||
    showDueAt(task) ||
    showRemindAt(task) ||
    showCompletedAt(task)
  )
}

function isOverdue(task: Task) {
  if (task.status === 'DONE' || !task.dueAt) return false
  return dayjs(task.dueAt).isBefore(dayjs(), 'minute')
}

function onDragStart(e: DragEvent, task: Task, fromPriority: TaskPriority) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id: task.id, fromPriority }))
  e.dataTransfer.effectAllowed = 'move'
  draggingTaskId.value = task.id
  dragSourcePriority.value = fromPriority
}

function onDragEnd() {
  draggingTaskId.value = null
  dragSourcePriority.value = null
  dropTargetPriority.value = null
  suppressClickUntil = Date.now() + 200
}

function onCardDragOver(priority: TaskPriority) {
  dropTargetPriority.value = priority
}

function onCardDragLeave(priority: TaskPriority) {
  if (dropTargetPriority.value === priority) {
    dropTargetPriority.value = null
  }
}

function onCardDrop(e: DragEvent, toPriority: TaskPriority) {
  dropTargetPriority.value = null
  const raw = e.dataTransfer?.getData(DRAG_MIME)
  if (!raw) return
  try {
    const { id, fromPriority } = JSON.parse(raw) as { id: string; fromPriority: TaskPriority }
    if (!id || fromPriority === toPriority) return
    emit('change-priority', id, toPriority)
  } catch {
    /* 忽略非法拖拽数据 */
  }
  suppressClickUntil = Date.now() + 200
}

function onTaskClick(taskId: string) {
  if (Date.now() < suppressClickUntil) return
  emit('select', taskId)
}
</script>

<style scoped lang="scss">
.quadrant-matrix {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
}

.quadrant-matrix__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.quadrant-matrix__card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  padding: 12px 12px 8px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid var(--desktop-border);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &.is-drop-target {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-primary) 25%, transparent);
  }

  &.is-drag-source {
    opacity: 0.92;
  }
}

.quadrant-matrix__card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.quadrant-matrix__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.quadrant-matrix__card-title {
  margin: 0;
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quadrant-matrix__add {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
    color: var(--el-color-primary);
  }
}

.quadrant-matrix__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--desktop-muted);
  font-size: 13px;
  min-height: 0;
  overflow: auto;
}

.quadrant-matrix__drop-hint {
  font-size: 12px;
  color: var(--el-color-primary);
}

.quadrant-matrix__groups {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.quadrant-matrix__group {
  margin-bottom: 6px;
}

.quadrant-matrix__group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 4px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--desktop-muted);
  cursor: pointer;
  text-align: left;

  &:hover {
    color: var(--desktop-text);
  }
}

.quadrant-matrix__chevron {
  transition: transform 0.15s ease;
  font-size: 12px;

  &.is-open {
    transform: rotate(90deg);
  }
}

.quadrant-matrix__group-count {
  margin-left: auto;
  font-size: 12px;
}

.quadrant-matrix__tasks {
  margin: 0;
  padding: 0 0 4px 4px;
  list-style: none;

  &--flat {
    padding-bottom: 8px;
  }
}

.quadrant-matrix__task {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-dragging {
    opacity: 0.45;
    cursor: grabbing;
  }

  &[draggable='true'] {
    cursor: grab;
  }
}

.quadrant-matrix__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 2px;
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

.quadrant-matrix__expand-placeholder {
  width: 20px;
  flex-shrink: 0;
}

.quadrant-matrix__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.quadrant-matrix__child-count {
  font-size: 11px;
  color: var(--desktop-muted);
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  padding: 0 6px;
  line-height: 18px;
  flex-shrink: 0;
}

.quadrant-matrix__task-body {
  flex: 1;
  min-width: 0;
}

.quadrant-matrix__task-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;

  &.is-done {
    color: var(--desktop-muted);
    text-decoration: line-through;
  }
}

.quadrant-matrix__task-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--desktop-muted);
}

.quadrant-matrix__meta-item {
  &.is-overdue {
    color: var(--el-color-danger);
    font-weight: 600;
  }

  &--completed {
    color: #67c23a;
  }
}

.quadrant-matrix__category {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quadrant-matrix__due {
  flex-shrink: 0;

  &.is-overdue {
    color: var(--el-color-danger);
  }
}
</style>
