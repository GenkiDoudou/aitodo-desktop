<template>
  <div class="trash-list" v-loading="loading">
    <div v-if="!loading && tasks.length === 0" class="trash-list__empty">
      <p>垃圾桶是空的</p>
      <p class="trash-list__hint">删除的任务会保留在这里，可恢复或彻底删除</p>
    </div>

    <ul v-else class="trash-list__ul">
      <li
        v-for="task in tasks"
        :key="task.id"
        class="trash-list__row"
        :class="{ 'is-selected': selectedId === task.id }"
        @click="emit('select', task.id)"
      >
        <el-checkbox
          :model-value="task.status === 'DONE'"
          disabled
          class="trash-list__checkbox"
        />
        <span class="trash-list__title" :class="{ 'is-done': task.status === 'DONE' }">
          {{ task.title }}
        </span>
        <span class="trash-list__category">{{ categoryName(task) }}</span>
        <span
          v-if="displayDate(task)"
          class="trash-list__date"
          :class="{ 'is-overdue': isOverdue(task) }"
        >
          {{ displayDate(task) }}
        </span>
        <div class="trash-list__actions" @click.stop>
          <el-button text size="small" title="恢复" @click="emit('restore', task)">
            恢复
          </el-button>
          <el-button text size="small" type="danger" title="彻底删除" @click="emit('purge', task)">
            删除
          </el-button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Category, Task } from '@shared/types'
import { formatTrashTaskDate } from '@/utils/format-task-time'

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

const categoryMap = computed(() => {
  const map = new Map<string, string>()
  for (const c of props.categories) {
    map.set(c.id, c.name)
  }
  return map
})

function categoryName(task: Task) {
  if (!task.categoryId) return '未分类'
  return categoryMap.value.get(task.categoryId) ?? '未分类'
}

/** 右侧日期：有截止日用截止日，否则用删除时间 */
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
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 1px solid var(--desktop-border);
  border-left: 3px solid transparent;

  &:hover {
    background: var(--desktop-hover);

    .trash-list__actions {
      opacity: 1;
    }
  }

  &.is-selected {
    background: var(--desktop-active);
    border-left-color: var(--el-color-primary);
  }
}

.trash-list__checkbox {
  flex-shrink: 0;
  pointer-events: none;
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
  max-width: 28%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--desktop-muted);
}

.trash-list__date {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--desktop-muted);

  &.is-overdue {
    color: var(--el-color-danger);
  }
}

.trash-list__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}
</style>
