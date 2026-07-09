<template>
  <div class="filter-cond">
    <el-select :model-value="cond.field" class="filter-cond__field" size="small" @change="onField">
      <el-option v-for="f in fieldOptions" :key="f.value" :label="f.label" :value="f.value" />
    </el-select>

    <el-select
      v-if="showOpSelect"
      :model-value="cond.op"
      class="filter-cond__op"
      size="small"
      @change="onOp"
    >
      <el-option v-for="o in opOptions" :key="o.value" :label="o.label" :value="o.value" />
    </el-select>

    <!-- 清单 -->
    <el-select
      v-if="cond.field === 'category' && cond.op === 'in'"
      :model-value="asStringArray(cond.value)"
      multiple
      collapse-tags
      collapse-tags-tooltip
      class="filter-cond__value"
      size="small"
      placeholder="选择清单"
      @change="(v: string[]) => patch({ value: v })"
    >
      <el-option label="未分类" value="__uncategorized__" />
      <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
    </el-select>

    <!-- 优先级 -->
    <el-select
      v-else-if="cond.field === 'priority' && cond.op === 'in'"
      :model-value="asNumberArray(cond.value)"
      multiple
      collapse-tags
      class="filter-cond__value"
      size="small"
      placeholder="优先级"
      @change="(v: number[]) => patch({ value: v })"
    >
      <el-option v-for="p in TASK_PRIORITIES" :key="p.value" :label="p.label" :value="p.value" />
    </el-select>

    <!-- 状态 -->
    <el-select
      v-else-if="cond.field === 'status' && cond.op === 'in'"
      :model-value="asStringArray(cond.value)"
      multiple
      collapse-tags
      class="filter-cond__value"
      size="small"
      placeholder="状态"
      @change="(v: string[]) => patch({ value: v })"
    >
      <el-option label="待办" value="TODO" />
      <el-option label="进行中" value="IN_PROGRESS" />
      <el-option label="已完成" value="DONE" />
    </el-select>

    <!-- 时间相对 -->
    <el-select
      v-else-if="isTimeField && cond.op === 'rel'"
      :model-value="String(cond.value ?? '')"
      class="filter-cond__value"
      size="small"
      placeholder="时间"
      @change="(v: string) => patch({ value: v })"
    >
      <el-option v-for="r in timeRelOptions" :key="r.value" :label="r.label" :value="r.value" />
    </el-select>

    <!-- 时间区间 -->
    <el-date-picker
      v-else-if="isTimeField && cond.op === 'between'"
      :model-value="betweenTuple"
      type="daterange"
      size="small"
      class="filter-cond__value filter-cond__value--range"
      range-separator="至"
      start-placeholder="开始"
      end-placeholder="结束"
      value-format="YYYY-MM-DD"
      @update:model-value="onBetween"
    />

    <!-- 标题 -->
    <el-input
      v-else-if="cond.field === 'title'"
      :model-value="String(cond.value ?? '')"
      size="small"
      class="filter-cond__value"
      placeholder="关键词"
      @update:model-value="(v: string) => patch({ value: v })"
    />

    <!-- 子任务 / 重复：有 / 无 -->
    <el-select
      v-else-if="cond.field === 'hasSubtasks' || cond.field === 'hasRecurrence'"
      :model-value="boolSelectValue"
      class="filter-cond__value"
      size="small"
      @change="onBool"
    >
      <el-option label="有" value="true" />
      <el-option label="无" value="false" />
    </el-select>

    <!-- 看板分组：未分组或任意 id 文本 -->
    <el-select
      v-else-if="cond.field === 'kanbanGroup' && cond.op === 'eq'"
      :model-value="kanbanSelectValue"
      class="filter-cond__value"
      size="small"
      allow-create
      filterable
      default-first-option
      placeholder="分组 id 或未分组"
      @change="onKanban"
    >
      <el-option label="未分组" value="__ungrouped__" />
    </el-select>

    <el-button size="small" text type="danger" title="删除条件" @click="emit('remove')">
      <el-icon><Delete /></el-icon>
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { Category } from '@shared/types'
import { TASK_PRIORITIES } from '@shared/task-priority'
import type { FilterField, FilterNode, FilterOp, FilterTimeRel } from '@shared/task-filter-ast'

type CondNode = Extract<FilterNode, { type: 'cond' }>

const props = defineProps<{
  cond: CondNode
  categories: Category[]
}>()

const emit = defineEmits<{
  change: [CondNode]
  remove: []
}>()

const fieldOptions: { value: FilterField; label: string }[] = [
  { value: 'category', label: '清单' },
  { value: 'priority', label: '优先级' },
  { value: 'status', label: '状态' },
  { value: 'dueAt', label: '截止时间' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'completedAt', label: '完成时间' },
  { value: 'title', label: '标题' },
  { value: 'hasSubtasks', label: '子任务' },
  { value: 'hasRecurrence', label: '重复' },
  { value: 'kanbanGroup', label: '看板分组' }
]

const timeRelOptions: { value: FilterTimeRel; label: string }[] = [
  { value: 'today', label: '今天' },
  { value: 'tomorrow', label: '明天' },
  { value: 'week', label: '本周' },
  { value: 'overdue', label: '已逾期' },
  { value: 'noDate', label: '无日期' },
  { value: 'hasDate', label: '有日期' }
]

const isTimeField = computed(() =>
  props.cond.field === 'dueAt' ||
  props.cond.field === 'createdAt' ||
  props.cond.field === 'completedAt'
)

const showOpSelect = computed(() => {
  const f = props.cond.field
  return f !== 'hasSubtasks' && f !== 'hasRecurrence'
})

const opOptions = computed(() => {
  const f = props.cond.field
  if (f === 'category') return [{ value: 'in' as FilterOp, label: '属于' }]
  if (f === 'priority' || f === 'status') return [{ value: 'in' as FilterOp, label: '属于' }]
  if (isTimeField.value) {
    return [
      { value: 'rel' as FilterOp, label: '相对' },
      { value: 'between' as FilterOp, label: '区间' },
      { value: 'isEmpty' as FilterOp, label: '为空' },
      { value: 'isNotEmpty' as FilterOp, label: '非空' }
    ]
  }
  if (f === 'title') {
    return [
      { value: 'contains' as FilterOp, label: '包含' },
      { value: 'notContains' as FilterOp, label: '不包含' }
    ]
  }
  if (f === 'kanbanGroup') {
    return [
      { value: 'eq' as FilterOp, label: '等于' },
      { value: 'isEmpty' as FilterOp, label: '为空' },
      { value: 'isNotEmpty' as FilterOp, label: '非空' }
    ]
  }
  return []
})

const betweenTuple = computed<[string, string] | null>(() => {
  const v = props.cond.value as { from?: string; to?: string } | null
  if (v?.from && v?.to) return [v.from.slice(0, 10), v.to.slice(0, 10)]
  return null
})

const kanbanSelectValue = computed(() => {
  if (props.cond.value === null || props.cond.value === '__ungrouped__') return '__ungrouped__'
  return typeof props.cond.value === 'string' ? props.cond.value : ''
})

const boolSelectValue = computed(() => {
  if (props.cond.op === 'isFalse' || props.cond.value === false) return 'false'
  return 'true'
})

function patch(partial: Partial<CondNode>) {
  emit('change', { ...props.cond, ...partial })
}

function defaultForField(field: FilterField): Pick<CondNode, 'op' | 'value'> {
  switch (field) {
    case 'category':
      return { op: 'in', value: [] }
    case 'priority':
      return { op: 'in', value: [1] }
    case 'status':
      return { op: 'in', value: ['TODO', 'IN_PROGRESS'] }
    case 'dueAt':
    case 'createdAt':
    case 'completedAt':
      return { op: 'rel', value: 'today' }
    case 'title':
      return { op: 'contains', value: '' }
    case 'hasSubtasks':
    case 'hasRecurrence':
      return { op: 'isTrue', value: true }
    case 'kanbanGroup':
      return { op: 'eq', value: null }
    default:
      return { op: 'eq', value: null }
  }
}

function onField(field: FilterField) {
  const d = defaultForField(field)
  patch({ field, op: d.op, value: d.value })
}

function onOp(op: FilterOp) {
  if (isTimeField.value && op === 'rel') {
    patch({ op, value: 'today' })
    return
  }
  if (isTimeField.value && op === 'between') {
    patch({ op, value: { from: '', to: '' } })
    return
  }
  if (op === 'isEmpty' || op === 'isNotEmpty') {
    patch({ op, value: undefined })
    return
  }
  patch({ op })
}

function onBetween(val: [string, string] | null) {
  if (!val || val.length !== 2) {
    patch({ value: { from: '', to: '' } })
    return
  }
  patch({ value: { from: `${val[0]}T00:00:00`, to: `${val[1]}T23:59:59` } })
}

function onKanban(v: string) {
  patch({ value: v === '__ungrouped__' ? null : v })
}

function onBool(v: string) {
  if (v === 'false') {
    patch({ op: 'isFalse', value: false })
  } else {
    patch({ op: 'isTrue', value: true })
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number) : []
}
</script>

<style scoped lang="scss">
.filter-cond {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.filter-cond__field {
  width: 112px;
}

.filter-cond__op {
  width: 96px;
}

.filter-cond__value {
  flex: 1;
  min-width: 140px;
}

.filter-cond__value--range {
  max-width: 260px;
}
</style>
