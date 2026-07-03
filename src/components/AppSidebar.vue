<template>
  <aside class="sidebar">
    <!-- 一级：左侧图标栏（参考 TickTick 式窄轨导航） -->
    <nav class="sidebar__rail" aria-label="主导航">
      <button type="button" class="sidebar__rail-brand" title="aiTodo" @click="selectPrimary('tasks')">
        <span class="sidebar__rail-logo" aria-hidden="true" />
      </button>

      <div class="sidebar__rail-main">
        <button
          v-for="item in primaryItems"
          :key="item.key"
          type="button"
          class="sidebar__rail-btn"
          :class="{ 'is-active': activePrimary === item.key }"
          :title="item.label"
          @click="selectPrimary(item.key)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
        </button>
      </div>

      <div class="sidebar__rail-footer">
        <el-popover
          v-model:visible="messagePopoverOpen"
          placement="right-end"
          :width="384"
          trigger="click"
          popper-class="sidebar-message-popover"
          :show-arrow="true"
        >
          <template #reference>
            <button
              type="button"
              class="sidebar__rail-btn sidebar__rail-btn--message"
              :class="{ 'is-active': messagePopoverOpen }"
              title="消息"
            >
              <el-icon><Bell /></el-icon>
              <span v-if="messageStore.totalUnread > 0" class="sidebar__rail-badge" />
            </button>
          </template>
          <AppMessagePanel @open-task="onMessageOpenTask" />
        </el-popover>
        <button type="button" class="sidebar__rail-btn" title="设置" @click="emit('open-settings')">
          <el-icon><Setting /></el-icon>
        </button>
      </div>
    </nav>

    <!-- 二级：右侧子菜单（随一级切换内容） -->
    <div class="sidebar__panel">
      <!-- 任务 -->
      <template v-if="activePrimary === 'tasks'">
        <div class="sidebar__panel-scroll">
          <button
            v-for="item in visibleSmartItems"
            :key="item.key"
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': isSmartActive(item.key) }"
            @click="selectSmart(item.key)"
          >
            <el-icon class="sidebar__row-icon"><component :is="item.icon" /></el-icon>
            <span class="sidebar__row-label">{{ item.label }}</span>
            <span v-if="taskCounts && item.key in taskCounts" class="sidebar__row-count">
              {{ taskCounts[item.key] }}
            </span>
          </button>

          <div class="sidebar__section-head">
            <span class="sidebar__section-title">清单</span>
            <button type="button" class="sidebar__section-add" title="新建清单" @click="promptCategory">
              <el-icon><Plus /></el-icon>
            </button>
          </div>

          <nav class="sidebar__list">
            <button
              v-if="showUncategorized"
              type="button"
              class="sidebar__row"
              :class="{ 'is-active': isUncategorizedActive() }"
              @click="selectCategory(null)"
            >
              <el-icon class="sidebar__row-icon"><Folder /></el-icon>
              <span class="sidebar__row-label">未分类</span>
              <span v-if="uncategorizedCount != null" class="sidebar__row-count">{{ uncategorizedCount }}</span>
            </button>
            <el-dropdown
              v-for="cat in categoryStore.categories"
              :key="cat.id"
              trigger="contextmenu"
              @command="(cmd: string) => onCategoryCommand(cmd, cat.id, cat.name)"
            >
              <button
                type="button"
                class="sidebar__row"
                :class="{ 'is-active': isCategoryActive(cat.id) }"
                @click="selectCategory(cat.id)"
              >
                <span class="sidebar__row-dot" :style="{ background: cat.color ?? '#909399' }" />
                <span class="sidebar__row-label">{{ cat.name }}</span>
                <span v-if="categoryCounts?.[cat.id] != null" class="sidebar__row-count">
                  {{ categoryCounts[cat.id] }}
                </span>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </nav>

          <div v-if="showFilters" class="sidebar__section-head sidebar__section-head--filter">
            <span class="sidebar__section-title">过滤器</span>
          </div>
          <div v-if="showFilters" class="sidebar__filter-hint">
            根据清单、时间、优先级等过滤任务（开发中）
          </div>
        </div>

        <div v-if="showDone || showTrash" class="sidebar__panel-bottom">
          <button
            v-if="showDone"
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': isDoneActive() }"
            @click="selectDone"
          >
            <el-icon class="sidebar__row-icon"><CircleCheck /></el-icon>
            <span class="sidebar__row-label">已完成</span>
          </button>
          <button
            v-if="showTrash"
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': isTrashActive() }"
            @click="selectTrash"
          >
            <el-icon class="sidebar__row-icon"><Delete /></el-icon>
            <span class="sidebar__row-label">垃圾桶</span>
            <span v-if="trashCount > 0" class="sidebar__row-count">{{ trashCount }}</span>
          </button>
        </div>
      </template>

      <!-- 日历 -->
      <template v-else-if="activePrimary === 'calendar'">
        <div class="sidebar__panel-scroll">
          <button
            v-for="v in calendarViews"
            :key="v.value"
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': calendarActive && activeCalendarView === v.value }"
            @click="selectCalendarView(v.value)"
          >
            <el-icon class="sidebar__row-icon"><component :is="v.icon" /></el-icon>
            <span class="sidebar__row-label">{{ v.label }}</span>
          </button>
        </div>
      </template>

      <!-- 四象限 -->
      <template v-else>
        <div class="sidebar__panel-scroll">
          <button
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': isMatrixActive() }"
            @click="selectMatrix"
          >
            <el-icon class="sidebar__row-icon"><Grid /></el-icon>
            <span class="sidebar__row-label">四象限视图</span>
          </button>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  Bell,
  Calendar,
  CircleCheck,
  Delete,
  Files,
  Folder,
  Grid,
  Plus,
  Setting,
  Sunny,
  Finished,
  View,
  Clock
} from '@element-plus/icons-vue'
import type { CalendarViewMode } from '@shared/calendar-tasks'
import { useCategoryStore } from '@/stores/category-store'
import { useSmartListSidebarStore } from '@/stores/smart-list-sidebar-store'
import { useMessageStore } from '@/stores/message-store'
import AppMessagePanel from '@/components/AppMessagePanel.vue'

type PrimaryKey = 'tasks' | 'calendar' | 'matrix'

const props = withDefaults(
  defineProps<{
    activeSmart?: 'all' | 'today' | 'week' | 'last7days' | 'matrix' | 'done' | 'trash' | null
    activeCategory?: string | null | undefined
    taskCounts?: { all: number; today: number; week: number; last7days: number }
    categoryCounts?: Record<string, number>
    uncategorizedCount?: number
    trashCount?: number
    /** 已完成任务数，用于「有内容时显示」 */
    doneCount?: number
    calendarActive?: boolean
    activeCalendarView?: CalendarViewMode
  }>(),
  { trashCount: 0, doneCount: 0, calendarActive: false, activeCalendarView: 'month' }
)

const emit = defineEmits<{
  'select-smart': ['all' | 'today' | 'week' | 'last7days']
  'select-matrix': []
  'select-done': []
  'select-trash': []
  'select-calendar': [CalendarViewMode]
  'select-category': [string | null]
  'select-tasks': []
  'open-settings': []
  'open-task': [string]
}>()

const messagePopoverOpen = ref(false)
const messageStore = useMessageStore()
let unsubscribeMessagePush: (() => void) | null = null

const categoryStore = useCategoryStore()

/** 当前一级导航：日历页 / 四象限 / 默认任务 */
const activePrimary = computed<PrimaryKey>(() => {
  if (props.calendarActive) return 'calendar'
  if (props.activeSmart === 'matrix') return 'matrix'
  return 'tasks'
})

const primaryItems: { key: PrimaryKey; label: string; icon: Component }[] = [
  { key: 'tasks', label: '任务', icon: Finished },
  { key: 'calendar', label: '日历', icon: Calendar },
  { key: 'matrix', label: '四象限', icon: Grid }
]

const smartItems: {
  key: 'all' | 'today' | 'week' | 'last7days'
  label: string
  icon: Component
}[] = [
  { key: 'all', label: '全部', icon: Files },
  { key: 'today', label: '今天', icon: Sunny },
  { key: 'week', label: '本周', icon: Calendar },
  { key: 'last7days', label: '最近7天', icon: Clock }
]

const sidebarVisStore = useSmartListSidebarStore()

const visibleSmartItems = computed(() =>
  smartItems.filter((item) =>
    sidebarVisStore.isVisible(item.key, props.taskCounts?.[item.key] ?? 0)
  )
)

const showUncategorized = computed(() =>
  sidebarVisStore.isVisible('uncategorized', props.uncategorizedCount ?? 0)
)

/** 过滤器尚未实现，内容数恒为 0；仅「显示」策略下可见 */
const showFilters = computed(() => sidebarVisStore.isVisible('filters', 0))

const showDone = computed(() => sidebarVisStore.isVisible('done', props.doneCount ?? 0))

const showTrash = computed(() => sidebarVisStore.isVisible('trash', props.trashCount ?? 0))

const calendarViews: { value: CalendarViewMode; label: string; icon: Component }[] = [
  { value: 'month', label: '月视图', icon: Calendar },
  { value: 'week', label: '周视图', icon: View },
  { value: 'day', label: '日视图', icon: Sunny }
]

function selectPrimary(key: PrimaryKey) {
  if (key === 'tasks') {
    if (props.calendarActive || props.activeSmart === 'matrix') {
      emit('select-tasks')
    }
    return
  }
  if (key === 'calendar') {
    emit('select-calendar', props.activeCalendarView ?? 'month')
    return
  }
  emit('select-matrix')
}

function isMatrixActive() {
  return props.activeSmart === 'matrix'
}

function isDoneActive() {
  return props.activeSmart === 'done'
}

function isTrashActive() {
  return props.activeSmart === 'trash'
}

function selectDone() {
  emit('select-done')
}

function selectTrash() {
  emit('select-trash')
}

function selectMatrix() {
  emit('select-matrix')
}

function selectCalendarView(mode: CalendarViewMode) {
  emit('select-calendar', mode)
}

function isSmartActive(key: 'all' | 'today' | 'week' | 'last7days') {
  return props.activeSmart === key
}

function isUncategorizedActive() {
  return props.activeCategory === null && props.activeSmart === null
}

function isCategoryActive(id: string) {
  return props.activeCategory === id
}

function selectSmart(key: 'all' | 'today' | 'week' | 'last7days') {
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

function onMessageOpenTask(taskId: string) {
  messagePopoverOpen.value = false
  emit('open-task', taskId)
}

onMounted(() => {
  sidebarVisStore.reload()
  void messageStore.refreshUnread()
  unsubscribeMessagePush = messageStore.subscribePush()
})

onUnmounted(() => {
  unsubscribeMessagePush?.()
})
</script>

<style scoped lang="scss">
.sidebar {
  display: flex;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--desktop-border);
  background: var(--desktop-sidebar-panel);
}

/* —— 左侧图标轨 —— */
.sidebar__rail {
  width: 52px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 10px;
  background: var(--desktop-sidebar-rail);
  border-right: 1px solid var(--desktop-border);
}

.sidebar__rail-brand {
  border: none;
  background: transparent;
  padding: 4px;
  margin-bottom: 12px;
  cursor: pointer;
  border-radius: 10px;

  &:hover .sidebar__rail-logo {
    transform: scale(1.05);
  }
}

.sidebar__rail-logo {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #409eff 55%, var(--desktop-ai) 100%);
  transition: transform 0.15s ease;
}

.sidebar__rail-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.sidebar__rail-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
}

.sidebar__rail-btn--message {
  position: relative;
}

.sidebar__rail-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
  border: 1.5px solid var(--desktop-sidebar-rail);
  pointer-events: none;
}

.sidebar__rail-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #5c6370;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--desktop-text);
  }

  &.is-active {
    background: var(--el-color-primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.35);
  }
}

/* —— 右侧子面板 —— */
.sidebar__panel {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--desktop-sidebar-panel);
}

.sidebar__panel-scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
  padding: 10px 10px 8px;
}

.sidebar__panel-bottom {
  flex-shrink: 0;
  padding: 8px 10px 12px;
  border-top: 1px solid var(--desktop-border);
}

.sidebar__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 8px 10px;
  margin-bottom: 2px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;
  line-height: 1.3;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-active {
    background: var(--desktop-sidebar-item-active);
    font-weight: 600;
  }
}

.sidebar__row-icon {
  font-size: 16px;
  color: #6b7280;
  flex-shrink: 0;

  .is-active & {
    color: var(--desktop-text);
  }
}

.sidebar__row-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 4px;
}

.sidebar__row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__row-count {
  font-size: 12px;
  color: var(--desktop-muted);
  flex-shrink: 0;
  min-width: 1.2em;
  text-align: right;

  .is-active & {
    color: #6b7280;
  }
}

.sidebar__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 6px 6px 10px;

  &--filter {
    padding-top: 12px;
  }
}

.sidebar__section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
}

.sidebar__section-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.sidebar__list {
  display: flex;
  flex-direction: column;

  :deep(.el-dropdown) {
    display: block;
  }
}

.sidebar__filter-hint {
  margin: 0 10px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f6f8;
  font-size: 11px;
  line-height: 1.45;
  color: var(--desktop-muted);
}
</style>
