<template>
  <div class="filter-group" :class="{ 'filter-group--nested': depth > 0 }">
    <div class="filter-group__toolbar">
      <el-radio-group :model-value="node.op" size="small" @change="onOp">
        <el-radio-button value="and">且</el-radio-button>
        <el-radio-button value="or">或</el-radio-button>
      </el-radio-group>
      <el-checkbox :model-value="Boolean(node.not)" @change="onNot">非</el-checkbox>
      <div class="filter-group__actions">
        <el-button size="small" text type="primary" @click="addCond">+ 条件</el-button>
        <el-button size="small" text type="primary" @click="addGroup">+ 分组</el-button>
        <el-button v-if="depth > 0" size="small" text type="danger" @click="emit('remove')">
          删除组
        </el-button>
      </div>
    </div>

    <div v-for="(child, index) in node.children" :key="childKey(child, index)" class="filter-group__child">
      <FilterGroupNode
        v-if="child.type === 'group'"
        :node="child"
        :depth="depth + 1"
        :categories="categories"
        @change="(n) => replaceChild(index, n)"
        @remove="removeChild(index)"
      />
      <FilterCondRow
        v-else
        :cond="child"
        :categories="categories"
        @change="(c) => replaceChild(index, c)"
        @remove="removeChild(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Category } from '@shared/types'
import type { FilterNode } from '@shared/task-filter-ast'
import FilterCondRow from './FilterCondRow.vue'

const props = defineProps<{
  node: Extract<FilterNode, { type: 'group' }>
  depth: number
  categories: Category[]
}>()

const emit = defineEmits<{
  change: [FilterNode]
  remove: []
}>()

function patch(partial: Partial<Extract<FilterNode, { type: 'group' }>>) {
  emit('change', { ...props.node, ...partial })
}

function onOp(op: string | number | boolean | undefined) {
  patch({ op: op === 'or' ? 'or' : 'and' })
}

function onNot(val: string | number | boolean) {
  patch({ not: Boolean(val) || undefined })
}

function addCond() {
  patch({
    children: [
      ...props.node.children,
      { type: 'cond', field: 'status', op: 'in', value: ['TODO', 'IN_PROGRESS'] }
    ]
  })
}

function addGroup() {
  patch({
    children: [
      ...props.node.children,
      {
        type: 'group',
        op: 'and',
        children: [{ type: 'cond', field: 'priority', op: 'in', value: [1, 2] }]
      }
    ]
  })
}

function replaceChild(index: number, next: FilterNode) {
  const children = props.node.children.slice()
  children[index] = next
  patch({ children })
}

function removeChild(index: number) {
  const children = props.node.children.filter((_, i) => i !== index)
  patch({ children })
}

function childKey(child: FilterNode, index: number) {
  if (child.type === 'cond') return `c-${index}-${child.field}-${child.op}`
  return `g-${index}-${child.op}-${child.children.length}`
}
</script>

<style scoped lang="scss">
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.filter-group--nested {
  margin-left: 8px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--desktop-border);
  background: #f8f9fb;
}

.filter-group__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-group__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.filter-group__child {
  min-width: 0;
}
</style>
