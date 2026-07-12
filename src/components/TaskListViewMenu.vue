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
      <button type="button" class="task-view-menu-trigger" title="列表设置" @click.stop>
        <el-icon><Setting /></el-icon>
      </button>
    </template>

    <div class="task-view-menu">
      <button type="button" class="task-view-menu__row task-view-menu__row--static">
        <el-icon class="task-view-menu__row-icon"><CircleCheck /></el-icon>
        <span class="task-view-menu__row-label">隐藏已完成</span>
        <el-switch v-model="hideDone" size="small" @click.stop />
      </button>

      <button type="button" class="task-view-menu__row task-view-menu__row--static">
        <span class="task-view-menu__row-label">启用分组</span>
        <el-switch v-model="enableGrouping" size="small" @click.stop />
      </button>

      <div class="task-view-menu__sub">
        <div class="task-view-menu__sub-title">分组条件</div>
        <el-select
          v-model="groupBy"
          size="small"
          class="task-view-menu__select"
          :disabled="!enableGrouping"
          @change="onGroupByChange"
        >
          <el-option
            v-for="(label, key) in groupByLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>

        <div class="task-view-menu__sub-title">排序</div>
        <el-select v-model="sortBy" size="small" class="task-view-menu__select">
          <el-option
            v-for="(label, key) in sortByLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
      </div>

      <button type="button" class="task-view-menu__row" @click="showDisplaySettings = !showDisplaySettings">
        <el-icon class="task-view-menu__row-icon"><View /></el-icon>
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
import { computed, ref } from 'vue'
import { ArrowRight, CircleCheck, Setting, View } from '@element-plus/icons-vue'
import type { TaskDetailStyle, TaskListMetaVisibility } from '@shared/list-view-preferences'
import { TASK_GROUP_BY_LABELS, TASK_SORT_BY_LABELS, type TaskGroupBy, type TaskSortBy } from '@shared/task-list-layout'

const hideDone = defineModel<boolean>('hideDone', { required: true })
const detailStyle = defineModel<TaskDetailStyle>('detailStyle', { required: true })
const metaVisibility = defineModel<TaskListMetaVisibility>('metaVisibility', { required: true })
const groupBy = defineModel<TaskGroupBy>('groupBy', { required: true })
const sortBy = defineModel<TaskSortBy>('sortBy', { required: true })

const visible = ref(false)
const showDisplaySettings = ref(false)

const metaOptions: { key: keyof TaskListMetaVisibility; label: string }[] = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'dueAt', label: '到期时间' },
  { key: 'remindAt', label: '提醒时间' },
  { key: 'completedAt', label: '完成时间' }
]

const groupByLabels = TASK_GROUP_BY_LABELS
const sortByLabels = TASK_SORT_BY_LABELS

const enableGrouping = computed({
  get: () => groupBy.value !== 'none',
  set: (value: boolean) => {
    if (!value) {
      groupBy.value = 'none'
      return
    }
    if (groupBy.value === 'none') {
      groupBy.value = 'custom'
    }
  }
})

function onVisibleChange(v: boolean) {
  visible.value = v
  if (!v) showDisplaySettings.value = false
}

function onGroupByChange(value: TaskGroupBy) {
  if (value === 'none') {
    enableGrouping.value = false
  }
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

.task-view-menu__select {
  width: 100%;
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
