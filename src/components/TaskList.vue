<template>
  <div class="task-list" v-loading="loading">
    <div v-if="!loading && layoutItems.length === 0" class="task-list__empty">
      <p>暂无任务</p>
      <p class="task-list__hint">在上方输入框回车，或按 Ctrl+N 新建</p>
    </div>
    <ul v-else class="task-list__ul">
      <template v-for="(item, idx) in displayItems" :key="itemKey(item, idx)">
        <li v-if="item.type === 'group'" class="task-list__group">
          {{ item.label }}
        </li>
        <li
          v-else
          class="task-list__row"
          :class="{ 'is-selected': selectedId === item.task.id }"
          :style="{ paddingLeft: `${12 + item.depth * 20}px` }"
          @click="emit('select', item.task.id)"
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

          <el-checkbox
            :model-value="item.task.status === 'DONE'"
            @click.stop
            @change="() => emit('toggle-status', item.task)"
          />

          <div class="task-list__body">
            <div class="task-list__title-row">
              <TaskPriorityBadge :priority="item.task.priority ?? 4" />
              <span class="task-list__title" :class="{ 'is-done': item.task.status === 'DONE' }">
                {{ item.task.title }}
              </span>
              <span
                v-if="hasChildren(item.task.id) && !isExpanded(item.task.id)"
                class="task-list__child-count"
              >
                {{ childCount(item.task.id) }}
              </span>
            </div>
            <div v-if="hasMeta(item.task)" class="task-list__meta">
              <span
                v-if="categoryLabel(item.task)"
                class="task-list__meta-item task-list__meta-item--category"
                title="清单"
              >
                {{ categoryLabel(item.task) }}
              </span>
              <span
                v-if="showCompletedAt(item.task)"
                class="task-list__meta-item task-list__meta-item--completed"
                title="完成时间"
              >
                完成 {{ formatTaskListTime(item.task.completedAt!) }}
              </span>
              <span v-if="showCreatedAt(item.task)" class="task-list__meta-item" title="创建时间">
                创建 {{ formatTaskCreatedAt(item.task.createdAt) }}
              </span>
              <span
                v-if="showDueAt(item.task)"
                class="task-list__meta-item"
                :class="{ 'is-overdue': isOverdue(item.task) }"
                title="截止时间"
              >
                截止 {{ formatTaskListTime(item.task.dueAt!) }}
              </span>
              <span v-if="showRemindAt(item.task)" class="task-list__meta-item" title="提醒时间">
                提醒 {{ formatTaskListTime(item.task.remindAt!) }}
              </span>
            </div>
          </div>
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
import type { TaskListLayoutItem } from '@shared/task-list-layout'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'

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
}>()

const expandedIds = ref<Set<string>>(new Set())

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

/** 分组标题始终展示；子任务仍受折叠控制 */
const displayItems = computed(() =>
  props.layoutItems.filter((item) => {
    if (item.type === 'group') return true
    return isRowVisible(item.task, item.depth)
  })
)

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

.task-list__group {
  padding: 12px 16px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
  letter-spacing: 0.02em;
  user-select: none;
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
