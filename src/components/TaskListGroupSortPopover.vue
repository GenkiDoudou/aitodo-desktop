<template>
  <el-popover
    :visible="visible"
    placement="bottom-end"
    :width="280"
    trigger="click"
    popper-class="task-gs-popper"
    @update:visible="onVisibleChange"
  >
    <template #reference>
      <button
        type="button"
        class="task-gs-trigger"
        :class="{ 'is-active': visible }"
        title="分组排序"
        @click.stop
      >
        <el-icon><Sort /></el-icon>
      </button>
    </template>

    <div class="task-gs-panel">
      <div class="task-gs-row" @click="openGroup = !openGroup">
        <el-icon class="task-gs-row-icon"><Operation /></el-icon>
        <span class="task-gs-row-label">分组</span>
        <span class="task-gs-row-value">
          {{ groupLabels[groupBy] }}
          <el-icon class="task-gs-row-chevron" :class="{ 'is-open': openGroup }"><ArrowDown /></el-icon>
        </span>
      </div>
      <ul v-show="openGroup" class="task-gs-menu">
        <li
          v-for="(label, key) in groupLabels"
          :key="key"
          class="task-gs-menu-item"
          :class="{ 'is-active': groupBy === key }"
          @click="selectGroup(key as TaskGroupBy)"
        >
          {{ label }}
          <el-icon v-if="groupBy === key" class="task-gs-check"><Check /></el-icon>
        </li>
      </ul>

      <div class="task-gs-row" @click="openSort = !openSort">
        <el-icon class="task-gs-row-icon"><Sort /></el-icon>
        <span class="task-gs-row-label">排序</span>
        <span class="task-gs-row-value">
          {{ sortLabels[sortBy] }}
          <el-icon class="task-gs-row-chevron" :class="{ 'is-open': openSort }"><ArrowDown /></el-icon>
        </span>
      </div>
      <ul v-show="openSort" class="task-gs-menu">
        <li
          v-for="(label, key) in sortLabels"
          :key="key"
          class="task-gs-menu-item"
          :class="{ 'is-active': sortBy === key }"
          @click="selectSort(key as TaskSortBy)"
        >
          {{ label }}
          <el-icon v-if="sortBy === key" class="task-gs-check"><Check /></el-icon>
        </li>
      </ul>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, Check, Operation, Sort } from '@element-plus/icons-vue'
import {
  TASK_GROUP_BY_LABELS,
  TASK_SORT_BY_LABELS,
  type TaskGroupBy,
  type TaskSortBy
} from '@shared/task-list-layout'

const groupBy = defineModel<TaskGroupBy>('groupBy', { required: true })
const sortBy = defineModel<TaskSortBy>('sortBy', { required: true })

const visible = ref(false)
const openGroup = ref(true)
const openSort = ref(false)

const groupLabels = TASK_GROUP_BY_LABELS
const sortLabels = TASK_SORT_BY_LABELS

function onVisibleChange(v: boolean) {
  visible.value = v
  if (v) {
    openGroup.value = true
    openSort.value = false
  }
}

function selectGroup(key: TaskGroupBy) {
  groupBy.value = key
  openGroup.value = false
}

function selectSort(key: TaskSortBy) {
  sortBy.value = key
  openSort.value = false
}
</script>

<style scoped lang="scss">
.task-gs-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 18px;
  cursor: pointer;

  &:hover,
  &.is-active {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.task-gs-panel {
  padding: 4px 0;
}

.task-gs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  margin: 0 4px;

  &:hover {
    background: var(--desktop-hover);
  }
}

.task-gs-row-icon {
  font-size: 16px;
  color: #6b7280;
  flex-shrink: 0;
}

.task-gs-row-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--desktop-text);
}

.task-gs-row-value {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.task-gs-row-chevron {
  font-size: 12px;
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(180deg);
  }
}

.task-gs-menu {
  list-style: none;
  margin: 0 4px 6px;
  padding: 4px 0;
  background: #fafbfc;
  border-radius: 8px;
}

.task-gs-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 8px 36px;
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;
  border-radius: 6px;
  margin: 0 4px;

  &:hover {
    background: #fff;
  }

  &.is-active {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.task-gs-check {
  font-size: 14px;
  color: var(--el-color-primary);
}
</style>

<style lang="scss">
.task-gs-popper.el-popper {
  padding: 6px !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
}
</style>
