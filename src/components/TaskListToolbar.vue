<template>
  <div class="task-list-toolbar">
    <el-popover placement="bottom-end" :width="280" trigger="click">
      <template #reference>
        <button type="button" class="task-list-toolbar__btn">
          <el-icon><Filter /></el-icon>
          筛选
        </button>
      </template>
      <p class="task-list-toolbar__hint">在列表设置中配置视图筛选与清单范围</p>
    </el-popover>

    <el-dropdown trigger="click" @command="onSortCommand">
      <button type="button" class="task-list-toolbar__btn">
        <el-icon><Sort /></el-icon>
        排序
        <el-icon class="task-list-toolbar__caret"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="(label, key) in sortByLabels"
            :key="key"
            :command="key"
          >
            {{ label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-dropdown trigger="click" @command="onGroupCommand">
      <button type="button" class="task-list-toolbar__btn task-list-toolbar__btn--group">
        分组：{{ groupByLabels[groupBy] }}
        <el-icon class="task-list-toolbar__caret"><ArrowDown /></el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="(label, key) in groupByLabels"
            :key="key"
            :command="key"
          >
            {{ label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <slot name="extra" />
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, Filter, Sort } from '@element-plus/icons-vue'
import {
  TASK_GROUP_BY_LABELS,
  TASK_SORT_BY_LABELS,
  type TaskGroupBy,
  type TaskSortBy
} from '@shared/task-list-layout'

const groupBy = defineModel<TaskGroupBy>('groupBy', { required: true })
const sortBy = defineModel<TaskSortBy>('sortBy', { required: true })

const groupByLabels = TASK_GROUP_BY_LABELS
const sortByLabels = TASK_SORT_BY_LABELS

function onSortCommand(key: TaskSortBy) {
  sortBy.value = key
}

function onGroupCommand(key: TaskGroupBy) {
  groupBy.value = key
}
</script>

<style scoped lang="scss">
.task-list-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.task-list-toolbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--desktop-border);
  border-radius: 6px;
  background: var(--desktop-bg);
  color: #4b5563;
  font-size: 12px;
  cursor: pointer;

  .el-icon {
    font-size: 14px;
    color: #9ca3af;
  }

  &:hover {
    border-color: #d1d5db;
    color: var(--desktop-text);
  }

  &--group {
    min-width: 140px;
    justify-content: space-between;
  }
}

.task-list-toolbar__caret {
  font-size: 12px;
  color: var(--desktop-muted);
}

.task-list-toolbar__hint {
  margin: 0;
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.5;
}
</style>
