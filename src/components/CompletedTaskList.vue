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
          <li
            v-for="task in group.tasks"
            :key="task.id"
            class="completed-list__row"
            :class="{ 'is-selected': selectedId === task.id }"
            @click="emit('select', task.id)"
          >
            <el-checkbox
              :model-value="true"
              @click.stop
              @change="() => emit('toggle-status', task)"
            />
            <div class="completed-list__body">
              <div class="completed-list__title-row">
                <span class="completed-list__title">{{ displayTitle(task) }}</span>
                <span class="completed-list__category">{{ categoryName(task) }}</span>
              </div>
              <div class="completed-list__meta">
                <span v-if="task.createdAt" class="completed-list__meta-item" title="创建时间">
                  创建 {{ formatTaskCreatedAt(task.createdAt) }}
                </span>
                <span v-if="task.completedAt" class="completed-list__meta-item" title="完成时间">
                  完成 {{ formatTaskListTime(task.completedAt) }}
                </span>
                <span v-if="task.dueAt" class="completed-list__meta-item" title="截止时间">
                  截止 {{ formatTaskListTime(task.dueAt) }}
                </span>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import type { Category, Task } from '@shared/types'
import { groupCompletedTasksByDate, completedTaskDisplayTitle } from '@shared/completed-task-groups'
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
  padding: 0 0 8px 28px;
}

.completed-list__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
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
