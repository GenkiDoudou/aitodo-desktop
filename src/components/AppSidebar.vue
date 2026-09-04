<template>
  <!--
    小柒todo 侧栏：工作台 / 我的清单 / 视图 / 效率 / 设置。
    清单支持色点展示与新建/编辑/删除（CategoryEditDialog）。
  -->
  <aside class="sidebar" aria-label="侧栏导航">
    <button type="button" class="sidebar__brand" title="小柒todo" @click="emit('select-tasks')">
      <span class="sidebar__brand-logo" aria-hidden="true">✓</span>
      <span class="sidebar__brand-text">小柒todo</span>
    </button>

    <div class="sidebar__scroll">
      <p class="sidebar__group-title sidebar__group-title--blue">工作台</p>
      <nav class="sidebar__nav" aria-label="工作台">
        <button
          v-for="item in workbenchItems"
          :key="item.key"
          type="button"
          class="sidebar__row"
          :class="{ 'is-active': item.active }"
          @click="item.onClick()"
        >
          <span class="sidebar__icon-wrap" :class="`is-${item.tone}`">
            <el-icon class="sidebar__row-icon"><component :is="item.icon" /></el-icon>
          </span>
          <span class="sidebar__row-label">{{ item.label }}</span>
          <span v-if="item.count != null" class="sidebar__row-count">{{ item.count }}</span>
        </button>
      </nav>

      <!-- 我的清单：分类列表 + 维护 -->
      <div class="sidebar__section-head">
        <p class="sidebar__group-title sidebar__group-title--teal">我的清单</p>
        <button type="button" class="sidebar__section-add" title="新建清单" @click="openCreateCategory">
          <el-icon><Plus /></el-icon>
        </button>
      </div>
      <nav class="sidebar__nav" aria-label="我的清单">
        <button
          type="button"
          class="sidebar__row"
          :class="{ 'is-active': isUncategorizedActive }"
          @click="emit('select-category', null)"
        >
          <span class="sidebar__icon-wrap is-slate">
            <el-icon class="sidebar__row-icon"><Folder /></el-icon>
          </span>
          <span class="sidebar__row-label">未分类</span>
          <span class="sidebar__row-count">{{ uncategorizedCount ?? 0 }}</span>
        </button>

        <!--
          外层 trigger 固定撑满宽度，避免 el-dropdown 把行内 flex 挤成纵向堆叠。
        -->
        <el-dropdown
          v-for="cat in categoryStore.categories"
          :key="cat.id"
          trigger="contextmenu"
          class="sidebar__cat-dropdown"
          @command="(cmd: string) => onCategoryCommand(cmd, cat)"
        >
          <div
            class="sidebar__cat-trigger"
            role="button"
            tabindex="0"
            @click="emit('select-category', cat.id)"
            @keydown.enter.prevent="emit('select-category', cat.id)"
          >
            <div class="sidebar__row" :class="{ 'is-active': isCategoryActive(cat.id) }">
              <span class="sidebar__icon-wrap" :style="listIconStyle(cat.color)">
                <el-icon class="sidebar__row-icon"><Folder /></el-icon>
              </span>
              <span class="sidebar__row-label">
                {{ cat.name }}
                <span
                  v-if="cat.keywords?.length"
                  class="sidebar__row-keywords"
                  :title="cat.keywords.join('、')"
                >
                  · {{ cat.keywords.join(' · ') }}
                </span>
              </span>
              <span class="sidebar__row-count">{{ categoryCounts?.[cat.id] ?? 0 }}</span>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">编辑</el-dropdown-item>
              <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>

      <p class="sidebar__group-title sidebar__group-title--violet">视图</p>
      <nav class="sidebar__nav" aria-label="视图">
        <button
          v-for="item in viewItems"
          :key="item.key"
          type="button"
          class="sidebar__row"
          :class="{ 'is-active': item.active }"
          @click="item.onClick()"
        >
          <span class="sidebar__icon-wrap" :class="`is-${item.tone}`">
            <el-icon class="sidebar__row-icon"><component :is="item.icon" /></el-icon>
          </span>
          <span class="sidebar__row-label">{{ item.label }}</span>
        </button>
      </nav>

      <p class="sidebar__group-title sidebar__group-title--amber">效率</p>
      <nav class="sidebar__nav" aria-label="效率">
        <button
          type="button"
          class="sidebar__row"
          :class="{ 'is-active': summaryActive }"
          @click="emit('select-summary', 'config')"
        >
          <span class="sidebar__icon-wrap is-amber">
            <el-icon class="sidebar__row-icon"><Timer /></el-icon>
          </span>
          <span class="sidebar__row-label">定时汇总</span>
        </button>
      </nav>
    </div>

    <CategoryEditDialog
      v-model="categoryEditOpen"
      :category="editingCategory"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheck,
  Files,
  Folder,
  Grid,
  MessageBox,
  Plus,
  Timer,
  Calendar
} from '@element-plus/icons-vue'
import type { Category } from '@shared/types'
import { useCategoryStore } from '@/stores/category-store'
import CategoryEditDialog from '@/components/CategoryEditDialog.vue'

type SummarySectionKey = 'config' | 'results'
type ActiveWorkbenchKey = 'all' | 'inbox' | 'done' | null
type ActiveViewKey = 'kanban' | 'calendar' | 'matrix' | null

const props = withDefaults(
  defineProps<{
    activeWorkbench?: ActiveWorkbenchKey
    activeView?: ActiveViewKey
    /** 当前选中清单；undefined=未进清单导航 */
    activeCategory?: string | null | undefined
    summaryActive?: boolean
    calendarActive?: boolean
    taskCounts?: { all?: number; inbox?: number }
    categoryCounts?: Record<string, number>
    uncategorizedCount?: number
    doneCount?: number
  }>(),
  {
    activeWorkbench: null,
    activeView: null,
    activeCategory: undefined,
    summaryActive: false,
    calendarActive: false,
    doneCount: 0,
    uncategorizedCount: 0
  }
)

const emit = defineEmits<{
  'select-smart': ['all']
  'select-inbox': []
  'select-done': []
  'select-kanban': []
  'select-calendar': []
  'select-matrix': []
  'select-summary': [SummarySectionKey]
  'select-category': [string | null]
  'select-tasks': []
}>()

const categoryStore = useCategoryStore()
const categoryEditOpen = ref(false)
const editingCategory = ref<Category | null>(null)

const isUncategorizedActive = computed(
  () =>
    props.activeCategory === null &&
    !props.activeView &&
    !props.summaryActive &&
    !props.calendarActive
)

function isCategoryActive(id: string) {
  return (
    props.activeCategory === id &&
    !props.activeView &&
    !props.summaryActive &&
    !props.calendarActive
  )
}

/** 清单色块图标：与工作台 icon-wrap 同尺寸，背景/前景取清单色 */
function listIconStyle(color: string | null | undefined): Record<string, string> {
  const c = (color && color.trim()) || '#909399'
  return {
    background: `color-mix(in srgb, ${c} 18%, transparent)`,
    color: c
  }
}

function openCreateCategory() {
  editingCategory.value = null
  categoryEditOpen.value = true
}

async function onCategoryCommand(command: string, cat: Category) {
  if (command === 'edit') {
    editingCategory.value = cat
    categoryEditOpen.value = true
    return
  }
  if (command === 'delete') {
    try {
      await ElMessageBox.confirm(`确定删除清单「${cat.name}」？其下任务将变为未分类。`, '删除清单', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
      await categoryStore.remove(cat.id)
      if (props.activeCategory === cat.id) {
        emit('select-category', null)
      }
    } catch (err) {
      if (err === 'cancel' || (err && typeof err === 'object' && 'action' in err)) return
      ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
  }
}

const workbenchItems = computed(() => {
  const items: {
    key: string
    label: string
    icon: Component
    tone: string
    count: number | null
    active: boolean
    onClick: () => void
  }[] = [
    {
      key: 'all',
      label: '全部任务',
      icon: Files,
      tone: 'blue',
      count: props.taskCounts?.all ?? null,
      active:
        props.activeWorkbench === 'all' &&
        props.activeCategory === undefined &&
        !props.activeView &&
        !props.summaryActive,
      onClick: () => emit('select-smart', 'all')
    },
    {
      key: 'inbox',
      label: '收集箱',
      icon: MessageBox,
      tone: 'orange',
      count: props.taskCounts?.inbox ?? null,
      active: props.activeWorkbench === 'inbox',
      onClick: () => emit('select-inbox')
    },
    {
      key: 'done',
      label: '已完成',
      icon: CircleCheck,
      tone: 'green',
      count: props.doneCount > 0 ? props.doneCount : null,
      active: props.activeWorkbench === 'done',
      onClick: () => emit('select-done')
    }
  ]
  return items
})

const viewItems = computed(() => [
  {
    key: 'kanban',
    label: '看板',
    icon: Grid,
    tone: 'violet',
    active: props.activeView === 'kanban',
    onClick: () => emit('select-kanban')
  },
  {
    key: 'calendar',
    label: '日历',
    icon: Calendar,
    tone: 'cyan',
    active: props.calendarActive || props.activeView === 'calendar',
    onClick: () => emit('select-calendar')
  },
  {
    key: 'matrix',
    label: '四象限',
    icon: Grid,
    tone: 'rose',
    active: props.activeView === 'matrix',
    onClick: () => emit('select-matrix')
  }
])

onMounted(() => {
  void categoryStore.load()
})
</script>

<style scoped lang="scss">
.sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 220px;
  height: 100%;
  min-height: 0;
  border-right: 1px solid #e4e7ed;
  background: linear-gradient(180deg, #fbfcfe 0%, #f5f8fc 55%, #f8fafc 100%);
  padding: 16px 10px;
}

.sidebar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0 10px 12px;
  cursor: pointer;
  text-align: left;
}

.sidebar__brand-logo {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409eff 0%, #79bbff 55%, #67c23a 140%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(64, 158, 255, 0.35);
}

.sidebar__brand-text {
  font-size: 15px;
  font-weight: 650;
  background: linear-gradient(90deg, #303133, #409eff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.sidebar__scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.sidebar__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 4px;
  margin-top: 2px;
}

.sidebar__group-title {
  margin: 0;
  padding: 14px 10px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #a8abb2;

  &--blue {
    color: #79bbff;
  }
  &--teal {
    color: #13c2c2;
  }
  &--violet {
    color: #b37feb;
  }
  &--amber {
    color: #e6a23c;
  }
}

.sidebar__section-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 8px;
  border: none;
  border-radius: 6px;
  background: rgba(54, 207, 201, 0.12);
  color: #13c2c2;
  cursor: pointer;

  &:hover {
    background: rgba(54, 207, 201, 0.22);
  }
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 4px;
}

/** 清单右键菜单：触发器必须撑满一行，否则内部横向 flex 会塌成纵向 */
.sidebar__cat-dropdown {
  display: block;
  width: 100%;

  :deep(.el-tooltip__trigger),
  :deep(.el-dropdown__trigger) {
    display: block !important;
    width: 100% !important;
    max-width: 100%;
  }
}

.sidebar__cat-trigger {
  display: block;
  width: 100%;
  outline: none;
}

.sidebar__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 36px;
  border: none;
  background: transparent;
  text-align: left;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  box-sizing: border-box;

  &:hover {
    background: rgba(64, 158, 255, 0.06);
  }

  &.is-active {
    background: #ecf5ff;
    color: #409eff;
    font-weight: 600;
  }
}

.sidebar__row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.25;
}

.sidebar__row-keywords {
  font-size: 11px;
  font-weight: 400;
  color: #a8abb2;

  .sidebar__row.is-active & {
    color: #79bbff;
  }
}

.sidebar__icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;

  &.is-blue {
    background: rgba(64, 158, 255, 0.14);
    color: #409eff;
  }
  &.is-orange {
    background: rgba(230, 162, 60, 0.16);
    color: #e6a23c;
  }
  &.is-green {
    background: rgba(103, 194, 58, 0.16);
    color: #67c23a;
  }
  &.is-violet {
    background: rgba(179, 127, 235, 0.16);
    color: #9254de;
  }
  &.is-cyan {
    background: rgba(54, 207, 201, 0.16);
    color: #13c2c2;
  }
  &.is-rose {
    background: rgba(245, 108, 108, 0.14);
    color: #f56c6c;
  }
  &.is-amber {
    background: rgba(230, 162, 60, 0.16);
    color: #e6a23c;
  }
  &.is-slate {
    background: rgba(144, 147, 153, 0.14);
    color: #606266;
  }
}

.sidebar__row-icon {
  font-size: 14px;
}

.sidebar__row-count {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  color: #909399;
  background: rgba(144, 147, 153, 0.12);
  flex-shrink: 0;

  .is-active & {
    color: #409eff;
    background: rgba(64, 158, 255, 0.15);
  }
}
</style>
