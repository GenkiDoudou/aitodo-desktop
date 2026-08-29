<template>
  <div class="trash-list" v-loading="loading">
    <div v-if="!loading && layoutItems.length === 0" class="trash-list__empty">
      <p>垃圾桶是空的</p>
      <p class="trash-list__hint">删除的任务会保留在这里，可恢复或彻底删除</p>
    </div>

    <ul v-else class="trash-list__ul">
      <template v-for="(item, idx) in displayItems" :key="itemKey(item, idx)">
        <li
          v-if="item.type === 'task'"
          class="trash-list__row"
          :class="{ 'is-selected': selectedId === item.task.id }"
          :style="{ paddingLeft: `${12 + item.depth * 20}px` }"
          @click="emit('select', item.task.id)"
        >
          <button
            v-if="hasChildren(item.task.id)"
            type="button"
            class="trash-list__expand"
            @click="toggleExpand(item.task.id, $event)"
          >
            <el-icon>
              <ArrowDown v-if="isExpanded(item.task.id)" />
              <ArrowRight v-else />
            </el-icon>
          </button>
          <span v-else class="trash-list__expand-placeholder" />

          <el-checkbox
            :model-value="item.task.status === 'DONE'"
            disabled
            class="trash-list__checkbox"
          />
          <span class="trash-list__title" :class="{ 'is-done': item.task.status === 'DONE' }">
            {{ displayTitle(item.task) }}
          </span>
          <span class="trash-list__category">{{ categoryName(item.task) }}</span>
          <span
            v-if="displayDate(item.task)"
            class="trash-list__date"
            :class="{ 'is-overdue': isOverdue(item.task) }"
          >
            {{ displayDate(item.task) }}
          </span>
          <div class="trash-list__actions" @click.stop>
            <el-button text size="small" title="恢复" @click="emit('restore', item.task)">
              恢复
            </el-button>
            <el-button
              text
              size="small"
              type="danger"
              title="彻底删除"
              @click="emit('purge', item.task)"
            >
              删除
            </el-button>
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
import type { Category, Task } from '@shared/types'
import { buildTaskListLayout, type TaskListLayoutItem } from '@shared/task-list-layout'
import { completedTaskDisplayTitle } from '@shared/completed-task-groups'
import { formatTrashTaskDate } from '@/utils/format-task-time'
import { unwrapIpc } from '@/ipc/client'

const props = defineProps<{
  tasks: Task[]
  categories: Category[]
  loading: boolean
  selectedId?: string | null
}>()

const emit = defineEmits<{
  select: [string]
  restore: [Task]
  purge: [Task]
}>()

const expandedIds = ref<Set<string>>(new Set())
const parentCache = ref<Map<string, Task>>(new Map())

const layoutItems = computed(() => buildTaskListLayout(props.tasks, 'none', 'custom'))

const taskById = computed(() => {
  const map = new Map<string, Task>()
  for (const t of props.tasks) map.set(t.id, t)
  for (const [id, t] of parentCache.value) map.set(id, t)
  return map
})

const childCountByParent = computed(() => {
  const counts = new Map<string, number>()
  for (const item of layoutItems.value) {
    if (item.type !== 'task' || !item.task.parentId) continue
    counts.set(item.task.parentId, (counts.get(item.task.parentId) ?? 0) + 1)
  }
  return counts
})

watch(
  () => props.tasks,
  async (tasks) => {
    const ids = new Set<string>()
    for (const t of tasks) {
      if (t.parentId && !tasks.some((x) => x.id === t.parentId) && !parentCache.value.has(t.parentId)) {
        ids.add(t.parentId)
      }
    }
    for (const id of ids) {
      try {
        const parent = unwrapIpc(await window.api.tasks.get(id))
        parentCache.value = new Map(parentCache.value).set(id, parent)
      } catch {
        /* 父任务可能已彻底删除 */
      }
    }
  },
  { immediate: true }
)

const categoryMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of props.categories) map.set(c.id, c.name)
  return map
})

function itemKey(item: TaskListLayoutItem, idx: number) {
  return item.type === 'task' ? item.task.id : `g-${idx}`
}

function hasChildren(taskId: string) {
  return (childCountByParent.value.get(taskId) ?? 0) > 0
}

function isExpanded(taskId: string) {
  return expandedIds.value.has(taskId)
}

function toggleExpand(taskId: string, e: Event) {
  e.stopPropagation()
  const next = new Set(expandedIds.value)
  if (next.has(taskId)) next.delete(taskId)
  else next.add(taskId)
  expandedIds.value = next
}

function isRowVisible(task: Task, depth: number) {
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

const displayItems = computed(() =>
  layoutItems.value.filter((item) => item.type === 'task' && isRowVisible(item.task, item.depth))
)

function displayTitle(task: Task) {
  return completedTaskDisplayTitle(task, taskById.value)
}

function categoryName(task: Task) {
  if (!task.categoryId) return '未分类'
  return categoryMap.value.get(task.categoryId) ?? '未分类'
}

function displayDate(task: Task) {
  if (task.dueAt) return formatTrashTaskDate(task.dueAt)
  if (task.deletedAt) return formatTrashTaskDate(task.deletedAt)
  return ''
}

function isOverdue(task: Task) {
  if (task.status === 'DONE' || !task.dueAt) return false
  return dayjs(task.dueAt).isBefore(dayjs(), 'minute')
}
</script>

<style scoped lang="scss">
.trash-list {
  flex: 1;
  overflow: auto;
  padding: 4px 0 12px;
}

.trash-list__empty {
  text-align: center;
  padding: 56px 16px;
  color: var(--desktop-muted);

  p {
    margin: 0 0 8px;
  }
}

.trash-list__hint {
  font-size: 12px;
}

.trash-list__ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.trash-list__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 10px 0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  border-left: 3px solid transparent;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    background: var(--desktop-active);
    border-left-color: var(--el-color-primary);
  }
}

.trash-list__expand,
.trash-list__expand-placeholder {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.trash-list__expand {
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  padding: 0;
}

.trash-list__checkbox {
  flex-shrink: 0;
}

.trash-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-done {
    color: var(--desktop-muted);
    text-decoration: line-through;
  }
}

.trash-list__category {
  flex-shrink: 0;
  max-width: 20%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--desktop-muted);
}

.trash-list__date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--desktop-muted);

  &.is-overdue {
    color: var(--el-color-danger);
  }
}

.trash-list__actions {
  flex-shrink: 0;
  display: flex;
  gap: 2px;
}
</style>
