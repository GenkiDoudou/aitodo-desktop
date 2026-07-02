<template>
  <div class="task-list" v-loading="loading">
    <div v-if="!loading && tasks.length === 0" class="task-list__empty">
      <p>暂无任务</p>
      <p class="task-list__hint">按 Ctrl+N 或点击「新建任务」开始</p>
      <p class="task-list__hint task-list__hint--muted">若刚保存了任务：请确认侧栏在「全部」，并打开「显示已完成」</p>
    </div>
    <ul v-else class="task-list__ul">
      <li
        v-for="{ task, depth } in tasks"
        :key="task.id"
        class="task-list__row"
        :style="{ paddingLeft: `${12 + depth * 16}px` }"
        @click="emit('select', task.id)"
      >
        <el-checkbox
          :model-value="task.status === 'DONE'"
          @click.stop
          @change="emit('toggle-status', task)"
        />
        <span class="task-list__title" :class="{ 'is-done': task.status === 'DONE' }">
          {{ task.title }}
        </span>
        <el-tag
          v-if="task.status === 'DONE'"
          size="small"
          type="success"
          class="task-list__tag task-list__tag--done"
        >
          已完成
        </el-tag>
        <el-tag v-else size="small" type="info" class="task-list__tag">
          {{ statusLabel(task.status) }}
        </el-tag>
        <span v-if="task.dueAt" class="task-list__due">{{ formatDue(task.dueAt) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Task, TaskStatus } from '@shared/types'

defineProps<{
  tasks: { task: Task; depth: number }[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
}>()

function statusLabel(s: TaskStatus) {
  const map: Record<TaskStatus, string> = {
    TODO: '待办',
    IN_PROGRESS: '进行中',
    DONE: '已完成'
  }
  return map[s]
}

function formatDue(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}
</script>

<style scoped lang="scss">
.task-list {
  flex: 1;
  overflow: auto;
  padding: 8px 0;
}

.task-list__empty {
  text-align: center;
  padding: 48px 16px;
  color: var(--desktop-muted);

  p {
    margin: 0 0 8px;
  }
}

.task-list__hint {
  font-size: 12px;

  &--muted {
    margin-top: 8px;
    color: var(--desktop-muted);
    font-size: 11px;
  }
}

.task-list__ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-list__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 12px;
  cursor: pointer;
  font-size: 13px;
  min-height: 32px;

  &:hover {
    background: var(--desktop-hover);
  }
}

.task-list__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-done {
    text-decoration: line-through;
    color: var(--desktop-muted);
  }
}

.task-list__tag {
  flex-shrink: 0;

  &--done {
    opacity: 0.85;
  }
}

.task-list__due {
  font-size: 12px;
  color: var(--desktop-muted);
  flex-shrink: 0;
}
</style>
