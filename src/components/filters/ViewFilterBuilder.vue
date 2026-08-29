<template>
  <div class="view-filter-builder">
    <div class="view-filter-builder__toolbar">
      <div class="view-filter-builder__match">
        <span class="view-filter-builder__match-label">匹配规则</span>
        <div class="view-filter-builder__match-pills" role="radiogroup" aria-label="匹配规则">
          <button
            type="button"
            class="view-filter-builder__pill"
            :class="{ 'is-active': matchOp === 'and' }"
            role="radio"
            :aria-checked="matchOp === 'and'"
            @click="matchOp = 'and'"
          >
            全部条件
          </button>
          <button
            type="button"
            class="view-filter-builder__pill"
            :class="{ 'is-active': matchOp === 'or' }"
            role="radio"
            :aria-checked="matchOp === 'or'"
            @click="matchOp = 'or'"
          >
            任一条件
          </button>
        </div>
      </div>
      <button
        v-if="hasConditions"
        type="button"
        class="view-filter-builder__clear"
        @click="clearAll"
      >
        清除
      </button>
    </div>

    <div v-if="!hasConditions" class="view-filter-builder__empty">
      <div class="view-filter-builder__empty-icon" aria-hidden="true">
        <el-icon><Filter /></el-icon>
      </div>
      <p class="view-filter-builder__empty-title">暂无筛选</p>
      <p class="view-filter-builder__empty-desc">不添加条件时，视图将展示当前范围内的全部任务</p>
    </div>

    <div v-else class="view-filter-builder__list">
      <div
        v-for="(child, index) in conditions"
        :key="childKey(child, index)"
        class="view-filter-builder__row"
      >
        <span class="view-filter-builder__row-index">{{ index + 1 }}</span>
        <FilterCondRow
          v-if="child.type === 'cond'"
          :cond="child"
          :categories="categories"
          :allowed-fields="filterFields"
          variant="github"
          @change="(c) => replaceChild(index, c)"
          @remove="removeChild(index)"
        />
      </div>
    </div>

    <button type="button" class="view-filter-builder__add" @click="addFilter">
      <el-icon><Plus /></el-icon>
      <span>添加筛选条件</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Filter, Plus } from '@element-plus/icons-vue'
import type { Category } from '@shared/types'
import {
  createEmptyAndGroup,
  normalizeFilterNode,
  type FilterNode
} from '@shared/task-filter-ast'
import { VIEW_EDITOR_FILTER_FIELDS } from '@shared/view-editor-config'
import FilterCondRow from '@/components/filters/FilterCondRow.vue'

const filterFields = VIEW_EDITOR_FILTER_FIELDS

const props = defineProps<{
  modelValue: FilterNode
  categories: Category[]
}>()

const emit = defineEmits<{
  'update:modelValue': [FilterNode]
}>()

const root = computed(() => {
  const n = normalizeFilterNode(props.modelValue)
  return n.type === 'group' ? n : createEmptyAndGroup()
})

const matchOp = computed({
  get: () => root.value.op,
  set: (op: 'and' | 'or') => emitRoot({ ...root.value, op })
})

const conditions = computed(() =>
  root.value.children.filter((c): c is Extract<FilterNode, { type: 'cond' }> => c.type === 'cond')
)

const hasConditions = computed(() => conditions.value.length > 0)

function emitRoot(next: Extract<FilterNode, { type: 'group' }>) {
  emit('update:modelValue', normalizeFilterNode(next))
}

function addFilter() {
  emitRoot({
    ...root.value,
    children: [
      ...root.value.children,
      { type: 'cond', field: 'priority', op: 'in', value: [1] }
    ]
  })
}

function replaceChild(index: number, next: FilterNode) {
  const children = root.value.children.slice()
  children[index] = next
  emitRoot({ ...root.value, children })
}

function removeChild(index: number) {
  const children = root.value.children.filter((_, i) => i !== index)
  emitRoot({ ...root.value, children })
}

function clearAll() {
  emitRoot({ type: 'group', op: root.value.op, children: [] })
}

function childKey(child: FilterNode, index: number) {
  if (child.type === 'cond') return `c-${index}-${child.field}-${child.op}`
  return `g-${index}`
}
</script>

<style scoped lang="scss">
.view-filter-builder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 40%);
}

.view-filter-builder__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.view-filter-builder__match {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.view-filter-builder__match-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--desktop-muted);
}

.view-filter-builder__match-pills {
  display: inline-flex;
  padding: 3px;
  border-radius: 9px;
  background: var(--desktop-hover);
  gap: 2px;
}

.view-filter-builder__pill {
  padding: 5px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--desktop-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(.is-active) {
    color: var(--desktop-text);
  }

  &.is-active {
    background: #fff;
    color: var(--desktop-text);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
}

.view-filter-builder__clear {
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-danger);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(245, 108, 108, 0.08);
  }
}

.view-filter-builder__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px 8px;
  text-align: center;
}

.view-filter-builder__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  border-radius: 10px;
  background: var(--desktop-hover);
  color: var(--desktop-muted);
  font-size: 18px;
}

.view-filter-builder__empty-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--desktop-text);
}

.view-filter-builder__empty-desc {
  margin: 0;
  max-width: 280px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--desktop-muted);
}

.view-filter-builder__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-filter-builder__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--desktop-border);
  background: #fff;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: var(--el-color-primary-light-7);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  }
}

.view-filter-builder__row-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--desktop-hover);
  font-size: 11px;
  font-weight: 600;
  color: var(--desktop-muted);
  flex-shrink: 0;
}

.view-filter-builder__add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  align-self: center;
  margin-top: 2px;
  padding: 8px 16px;
  border: 1px dashed var(--desktop-border);
  border-radius: 9px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-color-primary);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: rgba(64, 158, 255, 0.04);
  }
}
</style>
