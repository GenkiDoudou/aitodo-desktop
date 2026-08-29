<template>
  <el-dropdown trigger="click" @command="onCommand">
    <button
      type="button"
      class="priority-flag-menu__trigger"
      :title="`${currentMeta.code} · ${currentMeta.label}`"
      :aria-label="`任务级别：${currentMeta.code} ${currentMeta.label}`"
    >
      <TaskPriorityFlagIcon :color="currentMeta.flagColor" :outline="currentMeta.flagOutline" />
    </button>
    <template #dropdown>
      <el-dropdown-menu class="priority-flag-menu__dropdown">
        <el-dropdown-item
          v-for="p in TASK_PRIORITIES"
          :key="p.value"
          :command="p.value"
          :class="{ 'is-selected': modelValue === p.value }"
        >
          <span class="priority-flag-menu__item">
            <TaskPriorityFlagIcon :color="p.flagColor" :outline="p.flagOutline" />
            <span class="priority-flag-menu__label">
              <span class="priority-flag-menu__code">{{ p.code }}</span>
              <span class="priority-flag-menu__desc">{{ p.label }}</span>
            </span>
            <el-icon v-if="modelValue === p.value" class="priority-flag-menu__check">
              <Check />
            </el-icon>
          </span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { TASK_PRIORITIES, getTaskPriorityMeta, type TaskPriority } from '@shared/task-priority'
import TaskPriorityFlagIcon from '@/components/TaskPriorityFlagIcon.vue'

const modelValue = defineModel<TaskPriority>({ required: true })

const currentMeta = computed(() => getTaskPriorityMeta(modelValue.value))

function onCommand(value: TaskPriority) {
  modelValue.value = value
}
</script>

<style scoped lang="scss">
.priority-flag-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--desktop-muted);

  &:hover {
    background: var(--desktop-hover);
  }
}

.priority-flag-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 140px;
}

.priority-flag-menu__label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.priority-flag-menu__code {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.priority-flag-menu__desc {
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.2;
}

.priority-flag-menu__check {
  color: var(--el-color-primary);
  font-size: 16px;
}

:deep(.el-dropdown-menu__item.is-selected) {
  .priority-flag-menu__label {
    color: var(--el-color-primary);
  }
}
</style>
