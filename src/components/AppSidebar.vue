<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="sidebar__brand-mark" aria-hidden="true" />
      aiTodo
    </div>
    <nav class="sidebar__nav">
      <button
        v-for="item in smartItems"
        :key="item.key"
        class="sidebar__item"
        :class="{ 'is-active': isSmartActive(item.key) }"
        @click="selectSmart(item.key)"
      >
        <span class="sidebar__item-label">{{ item.label }}</span>
        <span v-if="taskCounts && item.key !== 'matrix'" class="sidebar__count">{{ taskCounts[item.key] }}</span>
      </button>
      <button
        class="sidebar__item"
        :class="{ 'is-active': isMatrixActive() }"
        @click="selectMatrix"
      >
        <span class="sidebar__item-label">四象限</span>
      </button>
    </nav>
    <div class="sidebar__section-title">清单</div>
    <nav class="sidebar__nav sidebar__nav--scroll">
      <button
        class="sidebar__item"
        :class="{ 'is-active': isUncategorizedActive() }"
        @click="selectCategory(null)"
      >
        <span class="sidebar__item-label">未分类</span>
      </button>
      <el-dropdown
        v-for="cat in categoryStore.categories"
        :key="cat.id"
        trigger="contextmenu"
        @command="(cmd: string) => onCategoryCommand(cmd, cat.id, cat.name)"
      >
        <button
          class="sidebar__item"
          :class="{ 'is-active': isCategoryActive(cat.id) }"
          @click="selectCategory(cat.id)"
        >
          <span class="sidebar__dot" :style="{ background: cat.color ?? '#909399' }" />
          <span class="sidebar__item-label">{{ cat.name }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="edit">编辑</el-dropdown-item>
            <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </nav>
    <div class="sidebar__footer">
      <el-button size="small" @click="promptCategory">+ 清单</el-button>
      <el-button size="small" text @click="emit('open-settings')">设置</el-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { useCategoryStore } from '@/stores/category-store'

const props = defineProps<{
  activeSmart?: 'all' | 'today' | 'matrix' | null
  activeCategory?: string | null | undefined
  taskCounts?: { all: number; today: number }
}>()

const emit = defineEmits<{
  'select-smart': ['all' | 'today']
  'select-matrix': []
  'select-category': [string | null]
  'open-settings': []
}>()

const categoryStore = useCategoryStore()

const smartItems = [
  { key: 'all' as const, label: '全部' },
  { key: 'today' as const, label: '今天' }
]

function isMatrixActive() {
  return props.activeSmart === 'matrix'
}

function selectMatrix() {
  emit('select-matrix')
}

function isSmartActive(key: 'all' | 'today') {
  return props.activeSmart === key
}

function isUncategorizedActive() {
  return props.activeCategory === null && props.activeSmart === null
}

function isCategoryActive(id: string) {
  return props.activeCategory === id
}

function selectSmart(key: 'all' | 'today') {
  emit('select-smart', key)
}

function selectCategory(id: string | null) {
  emit('select-category', id)
}

async function promptCategory() {
  const { value } = await ElMessageBox.prompt('清单名称', '新建清单', {
    confirmButtonText: '创建',
    cancelButtonText: '取消'
  })
  if (value?.trim()) {
    await categoryStore.create(value.trim())
  }
}

async function onCategoryCommand(command: string, id: string, name: string) {
  if (command === 'edit') {
    const { value } = await ElMessageBox.prompt('清单名称', '编辑清单', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: name
    })
    if (value?.trim() && value.trim() !== name) {
      await categoryStore.update(id, value.trim())
    }
  } else if (command === 'delete') {
    await ElMessageBox.confirm(`确定删除清单「${name}」？其下任务将变为未分类。`, '删除清单', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await categoryStore.remove(id)
    if (props.activeCategory === id) {
      selectCategory(null)
    }
  }
}
</script>

<style scoped lang="scss">
.sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--desktop-border);
  background: var(--desktop-sidebar);
  padding: 16px 10px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
  padding: 4px 10px 16px;
}

.sidebar__brand-mark {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(135deg, #409eff 55%, var(--desktop-ai) 100%);
  flex-shrink: 0;
}

.sidebar__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
  padding: 14px 10px 6px;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &--scroll {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  :deep(.el-dropdown) {
    display: block;
  }
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: inherit;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-active {
    background: var(--desktop-active);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.sidebar__item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__count {
  font-size: 12px;
  color: var(--desktop-muted);
  flex-shrink: 0;

  .is-active & {
    color: var(--el-color-primary);
  }
}

.sidebar__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar__footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
}
</style>
