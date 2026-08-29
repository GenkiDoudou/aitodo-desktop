<template>
  <section v-if="attachments.length" class="task-attachments">
    <h4 class="task-attachments__title">附件（{{ attachments.length }}）</h4>
    <ul class="task-attachments__list">
      <li v-for="(item, index) in attachments" :key="item.uri" class="task-attachments__row">
        <span class="task-attachments__icon" aria-hidden="true">📎</span>
        <button type="button" class="task-attachments__name" :title="item.name" @click="emit('open', item)">
          {{ item.name }}
        </button>
        <div class="task-attachments__actions">
          <button type="button" class="task-attachments__btn" @click="emit('open', item)">打开</button>
          <button type="button" class="task-attachments__btn" @click="emit('download', item)">下载</button>
          <button type="button" class="task-attachments__btn task-attachments__btn--danger" @click="emit('remove', index)">
            删除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { TaskFileAttachment } from '@shared/task-description'

defineProps<{
  attachments: TaskFileAttachment[]
}>()

const emit = defineEmits<{
  open: [TaskFileAttachment]
  download: [TaskFileAttachment]
  remove: [number]
}>()
</script>

<style scoped lang="scss">
.task-attachments {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.task-attachments__title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
}

.task-attachments__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-attachments__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  min-width: 0;
}

.task-attachments__icon {
  flex-shrink: 0;
  font-size: 14px;
}

.task-attachments__name {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.task-attachments__actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.task-attachments__btn {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid var(--desktop-border);
  border-radius: 6px;
  background: var(--desktop-surface, #fff);
  color: var(--desktop-text);
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary);
  }

  &--danger:hover {
    border-color: var(--el-color-danger-light-5);
    color: var(--el-color-danger);
  }
}
</style>
