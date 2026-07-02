<template>
  <aside class="sidebar">
    <div class="sidebar__brand">aiTodo</div>
    <nav class="sidebar__nav">
      <button
        v-for="item in smartItems"
        :key="item.key"
        class="sidebar__item"
        :class="{ 'is-active': isSmartActive(item.key) }"
        @click="selectSmart(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>
    <div class="sidebar__section-title">分类</div>
    <nav class="sidebar__nav">
      <button
        class="sidebar__item"
        :class="{ 'is-active': isUncategorizedActive() }"
        @click="selectCategory(null)"
      >
        未分类
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
          {{ cat.name }}
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
      <el-button size="small" @click="promptCategory">+ 分类</el-button>
      <el-button size="small" text @click="emit('open-settings')">设置</el-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { useCategoryStore } from '@/stores/category-store'

const props = defineProps<{
  /** 由 HomeView 驱动高亮，与列表筛选保持一致 */
  activeSmart?: 'all' | 'today' | null
  activeCategory?: string | null | undefined
}>()

const emit = defineEmits<{
  'select-smart': ['all' | 'today']
  'select-category': [string | null]
  'open-settings': []
}>()

const categoryStore = useCategoryStore()

const smartItems = [
  { key: 'all' as const, label: '全部' },
  { key: 'today' as const, label: '今天' }
]

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
  const { value } = await ElMessageBox.prompt('分类名称', '新建分类', {
    confirmButtonText: '创建',
    cancelButtonText: '取消'
  })
  if (value?.trim()) {
    await categoryStore.create(value.trim())
  }
}

async function onCategoryCommand(command: string, id: string, name: string) {
  if (command === 'edit') {
    const { value } = await ElMessageBox.prompt('分类名称', '编辑分类', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: name
    })
    if (value?.trim() && value.trim() !== name) {
      await categoryStore.update(id, value.trim())
    }
  } else if (command === 'delete') {
    await ElMessageBox.confirm(`确定删除分类「${name}」？其下任务将变为未分类。`, '删除分类', {
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
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--desktop-border);
  background: var(--desktop-sidebar);
  padding: 12px 8px;
}

.sidebar__brand {
  font-weight: 700;
  font-size: 15px;
  padding: 4px 8px 12px;
}

.sidebar__section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--desktop-muted);
  padding: 12px 8px 4px;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;

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
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: inherit;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-active {
    background: var(--desktop-active);
    font-weight: 600;
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
