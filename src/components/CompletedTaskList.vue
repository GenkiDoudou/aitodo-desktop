<template>
  <div class="completed-list" v-loading="loading">
    <div v-if="!loading && groups.length === 0" class="completed-list__empty">
      <p>暂无已完成任务</p>
      <p class="completed-list__hint">完成任务后，会按完成日期显示在这里</p>
    </div>

    <div v-else class="completed-list__groups">
      <section v-for="group in groups" :key="group.key" class="completed-list__group">
        <button
          type="button"
          class="completed-list__group-head"
          @click="toggleGroup(group.key)"
        >
          <el-icon class="completed-list__chevron" :class="{ 'is-open': isGroupOpen(group.key) }">
            <ArrowRight />
          </el-icon>
          <span class="completed-list__group-label">{{ group.label }}</span>
          <span class="completed-list__group-count">{{ group.tasks.length }}</span>
        </button>

        <ul v-show="isGroupOpen(group.key)" class="completed-list__ul">
          <template
            v-for="(item, idx) in layoutItemsForGroup(group.tasks)"
            :key="itemKey(group.key, item, idx)"
          >
            <li
              v-if="item.type === 'task' && isRowVisible(item.task, item.depth)"
              class="completed-list__row"
              :class="{ 'is-selected': selectedId === item.task.id }"
              :style="{ paddingLeft: `${8 + item.depth * 20}px` }"
              @click="emit('select', item.task.id)"
            >
              <button
                v-if="hasChildrenInGroup(group.tasks, item.task.id)"
                type="button"
                class="completed-list__expand"
                @click="toggleExpand(item.task.id, $event)"
              >
                <el-icon>
                  <ArrowDown v-if="isExpanded(item.task.id)" />
                  <ArrowRight v-else />
                </el-icon>
              </button>
              <span v-else class="completed-list__expand-placeholder" />

              <el-checkbox
                :model-value="true"
                @click.stop
                @change="() => emit('toggle-status', item.task)"
              />
              <div class="completed-list__body">
                <div class="completed-list__title-row">
                  <span class="completed-list__title">{{ displayTitle(item.task) }}</span>
                  <span class="completed-list__category">{{ categoryName(item.task) }}</span>
                </div>
                <div class="completed-list__meta">
                  <span v-if="item.task.createdAt" class="completed-list__meta-item" title="创建时间">
                    创建 {{ formatTaskCreatedAt(item.task.createdAt) }}
                  </span>
                  <span
                    v-if="item.task.completedAt"
                    class="completed-list__meta-item"
                    title="完成时间"
                  >
                    完成 {{ formatTaskListTime(item.task.completedAt) }}
                  </span>
                  <span v-if="item.task.dueAt" class="completed-list__meta-item" title="截止时间">
                    截止 {{ formatTaskListTime(item.task.dueAt) }}
                  </span>
                </div>
              </div>
            </li>
          </template>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import type { Category, Task } from '@shared/types'
import { groupCompletedTasksByDate, completedTaskDisplayTitle } from '@shared/completed-task-groups'
import { buildTaskListLayout, type TaskListLayoutItem } from '@shared/task-list-layout'
import { formatTaskCreatedAt, formatTaskListTime } from '@/utils/format-task-time'
import { unwrapIpc } from '@/ipc/client'

const props = defineProps<{
  tasks: Task[]
  categories: Category[]
  loading: boolean
  selectedId?: string | null
  /** undefined=所有清单；null=未分类；string=指定清单 id */
  categoryFilter?: string | null
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

const groupOpen = reactive<Record<string, boolean>>({})
const expandedIds = ref<Set<string>>(new Set())
const parentCache = ref<Map<string, Task>>(new Map())

const groups = computed(() =>
  groupCompletedTasksByDate(props.tasks, props.categoryFilter)
)

const taskById = computed(() => {
  const map = new Map<string, Task>()
  for (const t of props.tasks) {
    map.set(t.id, t)
  }
  for (const [id, t] of parentCache.value) {
    map.set(id, t)
  }
  return map
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
        /* 父任务可能已删除 */
      }
    }
  },
  { immediate: true }
)

const categoryMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of props.categories) {
    map.set(c.id, c.name)
  }
  return map
})

function layoutItemsForGroup(tasks: Task[]) {
  return buildTaskListLayout(tasks, 'none', 'completedAt')
}

function itemKey(groupKey: string, item: TaskListLayoutItem, idx: number) {
  if (item.type === 'task') return `${groupKey}-${item.task.id}`
  return `${groupKey}-g-${idx}`
}

function hasChildrenInGroup(groupTasks: Task[], taskId: string) {
  return groupTasks.some((t) => t.parentId === taskId)
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

function displayTitle(task: Task) {
  return completedTaskDisplayTitle(task, taskById.value)
}

function categoryName(task: Task) {
  if (!task.categoryId) return '未分类'
  return categoryMap.value.get(task.categoryId) ?? '未分类'
}

function isGroupOpen(key: string) {
  return groupOpen[key] !== false
}

function toggleGroup(key: string) {
  groupOpen[key] = !isGroupOpen(key)
}
</script>

<style scoped lang="scss">
.completed-list {
  flex: 1;
  overflow: auto;
  padding: 4px 0 12px;
}

.completed-list__empty {
  text-align: center;
  padding: 56px 16px;
  color: var(--desktop-muted);

  p {
    margin: 0 0 8px;
  }
}

.completed-list__hint {
  font-size: 12px;
}

.completed-list__groups {
  padding: 0 8px;
}

.completed-list__group {
  margin-bottom: 4px;
}

.completed-list__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 8px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--desktop-hover);
    border-radius: 8px;
  }
}

.completed-list__chevron {
  font-size: 12px;
  color: var(--desktop-muted);
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(90deg);
  }
}

.completed-list__group-label {
  flex: 1;
  min-width: 0;
}

.completed-list__group-count {
  font-size: 13px;
  font-weight: 400;
  color: var(--desktop-muted);
}

.completed-list__ul {
  list-style: none;
  margin: 0;
  padding: 0 0 8px 8px;
}

.completed-list__row {
  display: flex;
  align-items: flex-start;
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

.completed-list__expand,
.completed-list__expand-placeholder {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.completed-list__expand {
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  padding: 0;
}

.completed-list__body {
  flex: 1;
  min-width: 0;
}

.completed-list__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.completed-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--desktop-muted);
  text-decoration: line-through;
}

.completed-list__category {
  flex-shrink: 0;
  max-width: 36%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--desktop-muted);
}

.completed-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 4px;
}

.completed-list__meta-item {
  font-size: 11px;
  color: var(--desktop-muted);
  white-space: nowrap;
}
</style>
