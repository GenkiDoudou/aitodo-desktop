<template>
  <div class="task-list" v-loading="loading">
    <div v-if="!loading && tasks.length === 0" class="task-list__empty">
      <p>暂无任务</p>
      <p class="task-list__hint">在上方输入框回车，或按 Ctrl+N 新建</p>
    </div>
    <ul v-else class="task-list__ul">
      <li
        v-for="{ task, depth } in displayTasks"
        :key="task.id"
        class="task-list__row"
        :class="{ 'is-selected': selectedId === task.id }"
        :style="{ paddingLeft: `${12 + depth * 20}px` }"
        @click="emit('select', task.id)"
      >
        <button
          v-if="hasChildren(task.id)"
          type="button"
          class="task-list__expand"
          :aria-expanded="isExpanded(task.id)"
          :aria-label="isExpanded(task.id) ? '折叠子任务' : '展开子任务'"
          @click="toggleExpand(task.id, $event)"
        >
          <el-icon>
            <ArrowDown v-if="isExpanded(task.id)" />
            <ArrowRight v-else />
          </el-icon>
        </button>
        <span v-else class="task-list__expand-placeholder" aria-hidden="true" />

        <el-checkbox
          :model-value="task.status === 'DONE'"
          @click.stop
          @change="() => emit('toggle-status', task)"
        />

        <div class="task-list__body">
          <div class="task-list__title-row">
            <span class="task-list__title" :class="{ 'is-done': task.status === 'DONE' }">
              {{ task.title }}
            </span>
            <span
              v-if="task.priority && task.priority < 4"
              class="task-list__priority"
              :style="{ color: priorityColor(task.priority) }"
              :title="priorityLabel(task.priority)"
            >
              {{ priorityRoman(task.priority) }}
            </span>
            <span
              v-if="hasChildren(task.id) && !isExpanded(task.id)"
              class="task-list__child-count"
            >
              {{ childCount(task.id) }}
            </span>
          </div>
          <div v-if="hasMeta(task)" class="task-list__meta">
            <span v-if="task.createdAt" class="task-list__meta-item" title="创建时间">
              创建 {{ formatTaskCreatedAt(task.createdAt) }}
            </span>
            <span
              v-if="task.dueAt"
              class="task-list__meta-item"
              :class="{ 'is-overdue': isOverdue(task) }"
              title="截止时间"
            >
              截止 {{ formatTaskListTime(task.dueAt) }}
            </span>
            <span v-if="task.remindAt" class="task-list__meta-item" title="提醒时间">
              提醒 {{ formatTaskListTime(task.remindAt) }}
            </span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'
import { getTaskPriorityMeta } from '@shared/task-priority'
import type { TaskPriority } from '@shared/task-priority'

const props = defineProps<{
  tasks: { task: Task; depth: number }[]
  loading: boolean
  selectedId?: string | null
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

const expandedIds = ref<Set<string>>(new Set())

const taskById = computed(() => {
  const map = new Map<string, Task>()
  for (const { task } of props.tasks) {
    map.set(task.id, task)
  }
  return map
})

const childCountByParent = computed(() => {
  const counts = new Map<string, number>()
  for (const { task } of props.tasks) {
    if (!task.parentId) continue
    counts.set(task.parentId, (counts.get(task.parentId) ?? 0) + 1)
  }
  return counts
})

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

const displayTasks = computed(() =>
  props.tasks.filter(({ task, depth }) => isRowVisible(task, depth))
)

function hasMeta(task: Task): boolean {
  return Boolean(task.createdAt || task.dueAt || task.remindAt)
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
  () => props.tasks.map((t) => t.task.id).join('|'),
  () => {
    expandedIds.value = new Set()
    if (props.selectedId) expandAncestors(props.selectedId)
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

function priorityRoman(priority: TaskPriority) {
  return getTaskPriorityMeta(priority).roman
}

function priorityLabel(priority: TaskPriority) {
  return getTaskPriorityMeta(priority).label
}

function priorityColor(priority: TaskPriority) {
  return getTaskPriorityMeta(priority).color
}
</script>

<style scoped lang="scss">
.task-list {
  flex: 1;
  overflow: auto;
  padding: 4px 0 12px;
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

.task-list__row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 16px 10px 8px;
  cursor: pointer;
  font-size: 14px;
  min-height: 44px;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    background: var(--desktop-active);
    border-left-color: var(--el-color-primary);
  }
}

.task-list__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
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

.task-list__expand-placeholder {
  width: 22px;
  flex-shrink: 0;
}

.task-list__body {
  flex: 1;
  min-width: 0;
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

.task-list__priority {
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
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
}
</style>
