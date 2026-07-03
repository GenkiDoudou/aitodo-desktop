<template>
  <el-popover
    :visible="visible"
    placement="bottom-end"
    :width="300"
    trigger="click"
    popper-class="task-view-menu-popper"
    @update:visible="onVisibleChange"
  >
    <template #reference>
      <button type="button" class="task-view-menu-trigger" title="更多" @click.stop>
        <el-icon><MoreFilled /></el-icon>
      </button>
    </template>

    <div class="task-view-menu">
      <div class="task-view-menu__section-label">视图</div>
      <div class="task-view-menu__view-modes">
        <button
          v-for="m in viewModes"
          :key="m.value"
          type="button"
          class="task-view-menu__view-btn"
          :class="{ 'is-active': viewMode === m.value }"
          :title="m.label"
          @click="viewMode = m.value"
        >
          <el-icon><component :is="m.icon" /></el-icon>
        </button>
      </div>

      <button type="button" class="task-view-menu__row task-view-menu__row--static">
        <el-icon class="task-view-menu__row-icon"><CircleCheck /></el-icon>
        <span class="task-view-menu__row-label">隐藏已完成</span>
        <el-switch v-model="hideDone" size="small" @click.stop />
      </button>

      <button type="button" class="task-view-menu__row" @click="showDisplaySettings = !showDisplaySettings">
        <el-icon class="task-view-menu__row-icon"><Setting /></el-icon>
        <span class="task-view-menu__row-label">显示设置</span>
        <el-icon class="task-view-menu__chevron" :class="{ 'is-open': showDisplaySettings }">
          <ArrowRight />
        </el-icon>
      </button>

      <div v-show="showDisplaySettings" class="task-view-menu__sub">
        <div class="task-view-menu__sub-title">列表时间字段</div>
        <label v-for="opt in metaOptions" :key="opt.key" class="task-view-menu__check">
          <el-checkbox
            :model-value="metaVisibility[opt.key]"
            @change="(v: boolean) => updateMeta(opt.key, v)"
          />
          <span>{{ opt.label }}</span>
        </label>

        <div class="task-view-menu__sub-title">任务详情样式</div>
        <el-radio-group v-model="detailStyle" class="task-view-menu__radio-group" size="small">
          <el-radio value="sidebar">侧边栏</el-radio>
          <el-radio value="dialog">弹框详情</el-radio>
        </el-radio-group>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { ref, type Component } from 'vue'
import {
  ArrowRight,
  CircleCheck,
  List,
  MoreFilled,
  Setting,
  Grid,
  DataLine
} from '@element-plus/icons-vue'
import type { TaskDetailStyle, TaskListMetaVisibility, TaskListViewMode } from '@shared/list-view-preferences'

const viewMode = defineModel<TaskListViewMode>('viewMode', { required: true })
const hideDone = defineModel<boolean>('hideDone', { required: true })
const detailStyle = defineModel<TaskDetailStyle>('detailStyle', { required: true })
const metaVisibility = defineModel<TaskListMetaVisibility>('metaVisibility', { required: true })

const visible = ref(false)
const showDisplaySettings = ref(false)

const viewModes: { value: TaskListViewMode; label: string; icon: Component }[] = [
  { value: 'list', label: '列表视图', icon: List },
  { value: 'kanban', label: '看板视图', icon: Grid },
  { value: 'timeline', label: '时间线视图', icon: DataLine }
]

const metaOptions: { key: keyof TaskListMetaVisibility; label: string }[] = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'dueAt', label: '到期时间' },
  { key: 'remindAt', label: '提醒时间' },
  { key: 'completedAt', label: '完成时间' }
]

function onVisibleChange(v: boolean) {
  visible.value = v
  if (!v) showDisplaySettings.value = false
}

function updateMeta(key: keyof TaskListMetaVisibility, value: boolean) {
  metaVisibility.value = { ...metaVisibility.value, [key]: value }
}
</script>

<style scoped lang="scss">
.task-view-menu-trigger {
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

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.task-view-menu__section-label {
  font-size: 12px;
  color: var(--desktop-muted);
  padding: 4px 8px 8px;
}

.task-view-menu__view-modes {
  display: flex;
  gap: 8px;
  padding: 0 8px 12px;
}

.task-view-menu__view-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  background: #fff;
  color: #6b7280;
  font-size: 22px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #c0c4cc;
    color: var(--desktop-text);
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.08);
    color: var(--el-color-primary);
  }
}

.task-view-menu__row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--desktop-hover);
  }

  &--static {
    cursor: default;

    &:hover {
      background: transparent;
    }
  }
}

.task-view-menu__row-icon {
  font-size: 18px;
  color: #6b7280;
  flex-shrink: 0;
}

.task-view-menu__row-label {
  flex: 1;
  font-size: 14px;
  color: var(--desktop-text);
}

.task-view-menu__chevron {
  font-size: 14px;
  color: var(--desktop-muted);
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(90deg);
  }
}

.task-view-menu__sub {
  margin: 0 8px 8px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 10px;
}

.task-view-menu__sub-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
  margin: 8px 0 6px;

  &:first-child {
    margin-top: 0;
  }
}

.task-view-menu__check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;
}

.task-view-menu__radio-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
</style>

<style lang="scss">
.task-view-menu-popper.el-popper {
  padding: 8px !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
}
</style>
