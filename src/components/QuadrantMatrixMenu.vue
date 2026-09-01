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
      <button type="button" class="task-view-menu-trigger" title="四象限设置" @click.stop>
        <el-icon><Setting /></el-icon>
      </button>
    </template>

    <div class="task-view-menu">
      <button type="button" class="task-view-menu__row task-view-menu__row--static">
        <span class="task-view-menu__row-label">显示已完成</span>
        <el-switch v-model="prefs.showCompleted" size="small" @change="emitPrefs" />
      </button>

      <button type="button" class="task-view-menu__row task-view-menu__row--static">
        <span class="task-view-menu__row-label">启用分组</span>
        <el-switch v-model="prefs.enableGrouping" size="small" @change="emitPrefs" />
      </button>

      <div class="task-view-menu__sub">
        <div class="task-view-menu__sub-title">分组条件</div>
        <el-select
          v-model="prefs.groupBy"
          size="small"
          class="quadrant-menu__select"
          :teleported="false"
          :disabled="!prefs.enableGrouping"
          @change="emitPrefs"
        >
          <el-option
            v-for="(label, key) in groupByLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>

        <div class="task-view-menu__sub-title">排序</div>
        <el-select
          v-model="prefs.sortBy"
          size="small"
          class="quadrant-menu__select"
          :teleported="false"
          @change="emitPrefs"
        >
          <el-option
            v-for="(label, key) in sortByLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>

        <template v-if="showListFilter">
          <div class="task-view-menu__sub-title">显示清单</div>
          <el-select
            v-model="visibleListIds"
            multiple
            clearable
            collapse-tags
            collapse-tags-tooltip
            size="small"
            class="quadrant-menu__select"
            :teleported="false"
            placeholder="全部清单"
            @click.stop
          >
            <el-option label="未分类" :value="UNCATEGORIZED_LIST_KEY"></el-option>
            <el-option
              v-for="cat in categories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            ></el-option>
          </el-select>
        </template>
      </div>

      <button type="button" class="task-view-menu__row" @click="showDisplaySettings = !showDisplaySettings">
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
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ArrowRight, Setting } from '@element-plus/icons-vue'
import { QUADRANT_GROUP_BY_LABELS, type QuadrantGroupBy } from '@shared/quadrant-layout'
import { TASK_SORT_BY_LABELS, type TaskSortBy } from '@shared/task-list-layout'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import type { Category } from '@shared/types'
import { UNCATEGORIZED_LIST_KEY } from '@shared/visible-lists'
import {
  persistQuadrantViewPreferences,
  readQuadrantViewPreferences,
  type QuadrantViewPreferences
} from '@/utils/quadrant-preferences'

const metaVisibility = defineModel<TaskListMetaVisibility>('metaVisibility', { required: true })
const visibleListIds = defineModel<string[]>('visibleListIds', { default: () => [] })

withDefaults(
  defineProps<{
    showListFilter?: boolean
    categories?: Category[]
  }>(),
  {
    showListFilter: false,
    categories: () => []
  }
)

const emit = defineEmits<{
  change: [QuadrantViewPreferences]
}>()

const visible = ref(false)
const showDisplaySettings = ref(false)
const prefs = reactive<QuadrantViewPreferences>(readQuadrantViewPreferences())

const metaOptions: { key: keyof TaskListMetaVisibility; label: string }[] = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'dueAt', label: '到期时间' },
  { key: 'remindAt', label: '提醒时间' },
  { key: 'completedAt', label: '完成时间' }
]

const groupByLabels = QUADRANT_GROUP_BY_LABELS
const sortByLabels: Record<TaskSortBy, string> = TASK_SORT_BY_LABELS

watch(
  () => ({ ...prefs }),
  () => emit('change', { ...prefs }),
  { deep: true }
)

function onVisibleChange(v: boolean) {
  visible.value = v
  if (!v) showDisplaySettings.value = false
}

function updateMeta(key: keyof TaskListMetaVisibility, value: boolean) {
  metaVisibility.value = { ...metaVisibility.value, [key]: value }
}

function emitPrefs() {
  persistQuadrantViewPreferences({ ...prefs })
  emit('change', { ...prefs })
}

emit('change', { ...prefs })
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
  cursor: default;
  text-align: left;

  &--static {
    justify-content: space-between;
  }
}

.task-view-menu__row-label {
  flex: 1;
  font-size: 14px;
  color: var(--desktop-text);
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

.task-view-menu__chevron {
  font-size: 14px;
  color: var(--desktop-muted);
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(90deg);
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

.quadrant-menu__select {
  width: 100%;
}
</style>

<style lang="scss">
.task-view-menu-popper.el-popper {
  padding: 8px !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
  overflow: visible !important;
}
</style>
