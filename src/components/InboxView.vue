<template>
  <div class="inbox-view">
    <section v-if="notes.length" class="inbox-view__section">
      <header class="inbox-view__section-head">
        <h2 class="inbox-view__section-title">便签</h2>
        <span class="inbox-view__section-count">{{ notes.length }}</span>
      </header>
      <ul class="inbox-view__note-list">
        <li v-for="note in notes" :key="note.id" class="inbox-view__note" :class="`is-${note.color}`">
          <p class="inbox-view__note-text">{{ notePreview(note.content) }}</p>
          <div class="inbox-view__note-actions">
            <el-button size="small" type="primary" plain @click="emit('convert-note', note)">
              转任务
            </el-button>
            <el-button size="small" type="danger" plain @click="emit('delete-note', note.id)">
              删除
            </el-button>
          </div>
        </li>
      </ul>
    </section>

    <section class="inbox-view__section">
      <header class="inbox-view__section-head">
        <h2 class="inbox-view__section-title">未排优任务</h2>
        <span class="inbox-view__section-count">{{ tasks.length }}</span>
      </header>
      <p v-if="tasks.length === 0" class="inbox-view__empty">暂无待排优任务</p>
      <ul v-else class="inbox-view__task-list">
        <li v-for="task in tasks" :key="task.id" class="inbox-view__task">
          <button type="button" class="inbox-view__task-title" @click="emit('select-task', task.id)">
            {{ task.title }}
          </button>
          <TaskPriorityFlagMenu
            :model-value="task.priority"
            @update:model-value="(p) => emit('triage-task', task.id, p)"
          />
        </li>
      </ul>
    </section>

    <p v-if="notes.length === 0 && tasks.length === 0" class="inbox-view__all-clear">
      收件箱已清空 — 便签已处理、任务已排优
    </p>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '@shared/types'
import type { TaskPriority } from '@shared/task-priority'
import type { WidgetNote } from '@shared/widget-notes'
import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'

defineProps<{
  notes: WidgetNote[]
  tasks: Task[]
}>()

const emit = defineEmits<{
  'convert-note': [WidgetNote]
  'delete-note': [string]
  'select-task': [string]
  'triage-task': [string, TaskPriority]
}>()

function notePreview(content: string): string {
  const line = content.split(/\r?\n/).find((s) => s.trim())
  return (line ?? '空白便签').slice(0, 120)
}
</script>

<style scoped lang="scss">
.inbox-view {
  padding: 8px 0 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.inbox-view__section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.inbox-view__section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.inbox-view__section-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.inbox-view__note-list,
.inbox-view__task-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inbox-view__note {
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.inbox-view__note.is-yellow { background: #fff9db; }
.inbox-view__note.is-green { background: #e8f8ef; }
.inbox-view__note.is-blue { background: #e8f4ff; }
.inbox-view__note.is-pink { background: #ffe8f0; }
.inbox-view__note.is-gray { background: #f2f3f5; }

.inbox-view__note-text {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.inbox-view__note-actions {
  display: flex;
  gap: 8px;
}

.inbox-view__task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
}

.inbox-view__task-title {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-view__task-title:hover {
  color: var(--el-color-primary);
}

.inbox-view__empty,
.inbox-view__all-clear {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
