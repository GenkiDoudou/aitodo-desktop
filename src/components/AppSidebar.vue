<template>
  <aside class="sidebar">
    <!-- 一级：左侧图标栏（参考 TickTick 式窄轨导航） -->
    <nav class="sidebar__rail" aria-label="主导航">
      <button type="button" class="sidebar__rail-brand" title="小柒todo" @click="selectPrimary('tasks')">
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

    <!-- 二级：右侧子菜单（仅任务模块展示） -->
    <div v-if="activePrimary === 'tasks'" class="sidebar__panel">
      <div class="sidebar__panel-scroll">
          <div class="sidebar__all-block">
            <div class="sidebar__all-head">
              <button
                type="button"
                class="sidebar__row"
                :class="{ 'is-active': isAllActive() }"
                @click="selectSmart('all')"
              >
                <el-icon class="sidebar__row-icon"><Files /></el-icon>
                <span class="sidebar__row-label">全部</span>
                <span v-if="taskCounts?.all != null" class="sidebar__row-count">{{ taskCounts.all }}</span>
              </button>
              <el-dropdown trigger="click" @command="onCreateViewCommand">
                <button type="button" class="sidebar__section-add" title="新建视图">
                  <el-icon><Plus /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="blank">新建空白视图</el-dropdown-item>
                    <el-dropdown-item disabled divided>从模板</el-dropdown-item>
                    <el-dropdown-item
                      v-for="tpl in viewTemplates"
                      :key="tpl.id"
                      :command="`tpl:${tpl.id}`"
                    >
                      {{ tpl.title }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <nav class="sidebar__view-list">
              <p v-if="sidebarViews.length === 0" class="sidebar__filter-hint sidebar__filter-hint--nested">
                保存布局、筛选与分组，点击 + 新建
              </p>
              <el-dropdown
                v-for="v in sidebarViews"
                :key="v.id"
                trigger="contextmenu"
                @command="(cmd: string) => onViewCommand(cmd, v.id, v.name)"
              >
                <button
                  type="button"
                  class="sidebar__row sidebar__row--nested"
                  :class="{ 'is-active': isViewActive(v.id) }"
                  @click="selectView(v.id)"
                >
                  <el-icon class="sidebar__row-icon"><Grid /></el-icon>
                  <span class="sidebar__row-label">{{ v.name }}</span>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="save-as">另存为</el-dropdown-item>
                    <el-dropdown-item
                      v-if="!isSystemView(v.id)"
                      command="delete"
                      divided
                    >
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </nav>
          </div>

          <button
            v-if="showInbox"
            type="button"
            class="sidebar__row"
            :class="{ 'is-active': isInboxActive() }"
            @click="selectInbox"
          >
            <el-icon class="sidebar__row-icon"><MessageBox /></el-icon>
            <span class="sidebar__row-label">收件箱</span>
            <span v-if="taskCounts?.inbox != null && taskCounts.inbox > 0" class="sidebar__row-count">
              {{ taskCounts.inbox }}
            </span>
          </button>

          <button
            v-for="item in visibleOtherSmartItems"
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
              v-for="{ cat, keywordDisplay } in sidebarCategories"
              :key="cat.id"
              trigger="contextmenu"
              @command="(cmd: string) => onCategoryCommand(cmd, cat.id, cat.name)"
            >
              <button
                type="button"
                class="sidebar__row"
                :class="{
                  'is-active': isCategoryActive(cat.id),
                  'has-keywords': cat.keywords?.length,
                  'is-drag-over-before':
                    categoryDropHint?.id === cat.id && categoryDropHint.place === 'before',
                  'is-drag-over-after':
                    categoryDropHint?.id === cat.id && categoryDropHint.place === 'after',
                  'is-dragging': categoryDragId === cat.id
                }"
                draggable="true"
                @click="selectCategory(cat.id)"
                @dragstart="onCategoryDragStart($event, cat.id)"
                @dragover="onCategoryDragOver($event, cat.id)"
                @dragleave="onCategoryDragLeave(cat.id)"
                @drop="onCategoryDrop($event, cat.id)"
                @dragend="onCategoryDragEnd"
              >
                <span class="sidebar__row-dot" :style="{ background: cat.color ?? '#909399' }" />
                <span class="sidebar__row-body">
                  <span class="sidebar__row-label">{{ cat.name }}</span>
                  <el-tooltip
                    v-if="cat.keywords?.length"
                    :content="categoryKeywordsTitle(cat.keywords)"
                    placement="right"
                    :show-after="280"
                  >
                    <span class="sidebar__row-tags">
                      <span
                        v-for="kw in keywordDisplay.visible"
                        :key="kw"
                        class="sidebar__keyword-tag"
                      >{{ kw }}</span>
                      <span v-if="keywordDisplay.overflow > 0" class="sidebar__keyword-tag is-more">
                        +{{ keywordDisplay.overflow }}
                      </span>
                    </span>
                  </el-tooltip>
                </span>
                <span v-if="categoryCounts?.[cat.id] != null" class="sidebar__row-count">
                  {{ categoryCounts[cat.id] }}
                </span>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    command="move-up"
                    :disabled="categoryIndex(cat.id) <= 0"
                  >
                    上移
                  </el-dropdown-item>
                  <el-dropdown-item
                    command="move-down"
                    :disabled="categoryIndex(cat.id) >= categoryStore.categories.length - 1"
                  >
                    下移
                  </el-dropdown-item>
                  <el-dropdown-item command="edit" divided>编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </nav>
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
    </div>

    <div v-else-if="activePrimary === 'summary'" class="sidebar__panel">
      <div class="sidebar__panel-scroll">
        <button
          v-for="item in summaryItems"
          :key="item.key"
          type="button"
          class="sidebar__row"
          :class="{ 'is-active': activeSummarySection === item.key }"
          @click="selectSummarySection(item.key)"
        >
          <el-icon class="sidebar__row-icon"><component :is="item.icon" /></el-icon>
          <span class="sidebar__row-label">{{ item.label }}</span>
        </button>
      </div>
    </div>
    <CategoryEditDialog
      v-model="categoryEditOpen"
      :category="editingCategory"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, type Component } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
  MessageBox,
  Finished,
  Clock,
  Timer,
  Document,
  List
} from '@element-plus/icons-vue'
import type { CalendarViewMode } from '@shared/calendar-tasks'
import { useCategoryStore } from '@/stores/category-store'
import { useViewStore } from '@/stores/view-store'
import { useMessageStore } from '@/stores/message-store'
import {
  DEFAULT_TASK_VIEW_ALL_ID,
  DEFAULT_TASK_VIEW_KANBAN_ID
} from '@shared/apply-task-view'
import type { Category } from '@shared/types'
import { moveItemInOrder } from '@shared/list-order'
import { VIEW_TEMPLATES, type ViewTemplateId } from '@shared/view-templates'
import AppMessagePanel from '@/components/AppMessagePanel.vue'
import CategoryEditDialog from '@/components/CategoryEditDialog.vue'

type PrimaryKey = 'tasks' | 'calendar' | 'matrix' | 'summary'
type SummarySectionKey = 'config' | 'results'

const props = withDefaults(
  defineProps<{
    activeSmart?: 'inbox' | 'all' | 'last7days' | 'matrix' | 'done' | 'trash' | null
    activeCategory?: string | null | undefined
    activeViewId?: string | null
    summaryActive?: boolean
    activeSummarySection?: SummarySectionKey | null
    taskCounts?: { all: number; last7days: number; inbox?: number }
    categoryCounts?: Record<string, number>
    uncategorizedCount?: number
    trashCount?: number
    /** 已完成任务数，用于「有内容时显示」 */
    doneCount?: number
    calendarActive?: boolean
    activeCalendarView?: CalendarViewMode
  }>(),
  {
    trashCount: 0,
    doneCount: 0,
    calendarActive: false,
    activeCalendarView: 'month',
    activeViewId: null
  }
)

const emit = defineEmits<{
  'select-smart': ['all' | 'last7days']
  'select-inbox': []
  'select-matrix': []
  'select-summary': [SummarySectionKey]
  'select-done': []
  'select-trash': []
  'select-calendar': [CalendarViewMode]
  'select-category': [string | null]
  'select-view': [string]
  'create-view': []
  'create-view-from-template': [ViewTemplateId]
  'edit-view': [string]
  'save-as-view': [string]
  'select-tasks': []
  'open-settings': []
  'open-task': [string]
}>()

const messagePopoverOpen = ref(false)
const messageStore = useMessageStore()
let unsubscribeMessagePush: (() => void) | null = null

const categoryStore = useCategoryStore()
const viewStore = useViewStore()
const viewTemplates = VIEW_TEMPLATES
const categoryEditOpen = ref(false)
const editingCategory = ref<Category | null>(null)

const CATEGORY_DRAG_MIME = 'application/x-ai-todo-category-reorder'
const categoryDragId = ref<string | null>(null)
const categoryDropHint = ref<{ id: string; place: 'before' | 'after' } | null>(null)

function categoryIndex(id: string): number {
  return categoryStore.categories.findIndex((c) => c.id === id)
}

function onCategoryDragStart(e: DragEvent, id: string) {
  categoryDragId.value = id
  if (!e.dataTransfer) return
  e.dataTransfer.setData(CATEGORY_DRAG_MIME, id)
  e.dataTransfer.effectAllowed = 'move'
}

function onCategoryDragOver(e: DragEvent, id: string) {
  if (!categoryDragId.value || categoryDragId.value === id) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const place = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  categoryDropHint.value = { id, place }
}

function onCategoryDragLeave(id: string) {
  if (categoryDropHint.value?.id === id) categoryDropHint.value = null
}

async function onCategoryDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  const fromId = categoryDragId.value ?? e.dataTransfer?.getData(CATEGORY_DRAG_MIME)
  const place = categoryDropHint.value?.id === targetId ? categoryDropHint.value.place : 'after'
  categoryDropHint.value = null
  categoryDragId.value = null
  if (!fromId || fromId === targetId) return
  const ids = categoryStore.categories.map((c) => c.id)
  const from = ids.indexOf(fromId)
  const target = ids.indexOf(targetId)
  if (from < 0 || target < 0) return
  let insertAt = place === 'before' ? target : target + 1
  if (from < insertAt) insertAt--
  const next = moveItemInOrder(ids, from, insertAt)
  if (next.every((id, i) => id === ids[i])) return
  try {
    await categoryStore.reorder(next)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '清单排序失败')
    await categoryStore.load()
  }
}

function onCategoryDragEnd() {
  categoryDragId.value = null
  categoryDropHint.value = null
}

/** 「全部」已由顶部入口承担，侧栏不再重复展示默认「全部任务」视图 */
const sidebarViews = computed(() =>
  viewStore.items.filter((v) => v.id !== DEFAULT_TASK_VIEW_ALL_ID)
)

function isSystemView(id: string) {
  return id === DEFAULT_TASK_VIEW_ALL_ID || id === DEFAULT_TASK_VIEW_KANBAN_ID
}

/** 当前一级导航：日历页 / 四象限 / 默认任务 */
const activePrimary = computed<PrimaryKey>(() => {
  if (props.calendarActive) return 'calendar'
  if (props.summaryActive) return 'summary'
  if (props.activeSmart === 'matrix') return 'matrix'
  return 'tasks'
})

const primaryItems: { key: PrimaryKey; label: string; icon: Component }[] = [
  { key: 'tasks', label: '任务', icon: Finished },
  { key: 'calendar', label: '日历', icon: Calendar },
  { key: 'matrix', label: '四象限', icon: Grid },
  { key: 'summary', label: '定时汇总', icon: Timer }
]

const summaryItems: { key: SummarySectionKey; label: string; icon: Component }[] = [
  { key: 'config', label: '定时汇总配置', icon: List },
  { key: 'results', label: '汇总结果', icon: Document }
]

const otherSmartItems: { key: 'last7days'; label: string; icon: Component }[] = [
  { key: 'last7days', label: '最近7天', icon: Clock }
]

const visibleOtherSmartItems = computed(() => otherSmartItems)

const showInbox = computed(() => (props.taskCounts?.inbox ?? 0) > 0)

const showUncategorized = computed(() => true)

const showDone = computed(() => true)

const showTrash = computed(() => true)

function selectPrimary(key: PrimaryKey) {
  if (key === 'tasks') {
    if (props.calendarActive || props.activeSmart === 'matrix' || props.summaryActive) {
      emit('select-tasks')
    }
    return
  }
  if (key === 'calendar') {
    emit('select-calendar', props.activeCalendarView ?? 'month')
    return
  }
  if (key === 'summary') {
    emit('select-summary', props.activeSummarySection ?? 'config')
    return
  }
  emit('select-matrix')
}

function selectSummarySection(key: SummarySectionKey) {
  emit('select-summary', key)
}

function isInboxActive() {
  return props.activeSmart === 'inbox' && !props.activeViewId && props.activeCategory === undefined
}

function selectInbox() {
  emit('select-inbox')
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

function isAllActive() {
  return (
    props.activeSmart === 'all' &&
    !props.activeViewId &&
    props.activeCategory === undefined
  )
}

function isSmartActive(key: 'last7days') {
  return (
    props.activeSmart === key &&
    !props.activeViewId &&
    props.activeCategory === undefined
  )
}

function isUncategorizedActive() {
  return (
    props.activeCategory === null &&
    props.activeSmart === null &&
    !props.activeViewId
  )
}

function isCategoryActive(id: string) {
  return props.activeCategory === id && !props.activeViewId
}

const CATEGORY_KEYWORD_VISIBLE_MAX = 2

function categoryKeywordDisplay(keywords: string[]) {
  if (keywords.length <= CATEGORY_KEYWORD_VISIBLE_MAX) {
    return { visible: keywords, overflow: 0 }
  }
  return {
    visible: keywords.slice(0, CATEGORY_KEYWORD_VISIBLE_MAX),
    overflow: keywords.length - CATEGORY_KEYWORD_VISIBLE_MAX
  }
}

function categoryKeywordsTitle(keywords: string[]) {
  return keywords.join(' · ')
}

const sidebarCategories = computed(() =>
  categoryStore.categories.map((cat) => ({
    cat,
    keywordDisplay: categoryKeywordDisplay(cat.keywords ?? [])
  }))
)

function isViewActive(id: string) {
  return props.activeViewId === id
}

function selectSmart(key: 'all' | 'last7days') {
  emit('select-smart', key)
}

function selectCategory(id: string | null) {
  emit('select-category', id)
}

function selectView(id: string) {
  emit('select-view', id)
}

function onCreateViewCommand(command: string) {
  if (command === 'blank') {
    emit('create-view')
    return
  }
  if (command.startsWith('tpl:')) {
    const id = command.slice(4) as ViewTemplateId
    emit('create-view-from-template', id)
  }
}

async function onViewCommand(command: string, id: string, name: string) {
  if (command === 'rename') {
    const { value } = await ElMessageBox.prompt('视图名称', '重命名', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: name
    })
    if (value?.trim() && value.trim() !== name) {
      await viewStore.update(id, { name: value.trim() })
    }
    return
  }
  if (command === 'edit') {
    emit('edit-view', id)
    return
  }
  if (command === 'save-as') {
    emit('save-as-view', id)
    return
  }
  if (command === 'delete') {
    if (isSystemView(id)) return
    await ElMessageBox.confirm(`确定删除视图「${name}」？`, '删除视图', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const wasActive = props.activeViewId === id
    await viewStore.remove(id)
    if (wasActive) {
      emit('select-smart', 'all')
    }
  }
}

async function promptCategory() {
  editingCategory.value = null
  categoryEditOpen.value = true
}

async function onCategoryCommand(command: string, id: string, name: string) {
  if (command === 'move-up' || command === 'move-down') {
    const ids = categoryStore.categories.map((c) => c.id)
    const from = ids.indexOf(id)
    const to = command === 'move-up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= ids.length) return
    try {
      await categoryStore.reorder(moveItemInOrder(ids, from, to))
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : '清单排序失败')
      await categoryStore.load()
    }
    return
  }
  if (command === 'edit') {
    const cat = categoryStore.categories.find((c) => c.id === id)
    if (!cat) return
    editingCategory.value = cat
    categoryEditOpen.value = true
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
  void viewStore.load()
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

  &.has-keywords {
    align-items: flex-start;

    .sidebar__row-count {
      margin-top: 2px;
    }
  }

  &.is-dragging {
    opacity: 0.45;
  }

  &.is-drag-over-before {
    box-shadow: inset 0 2px 0 0 var(--el-color-primary);
  }

  &.is-drag-over-after {
    box-shadow: inset 0 -2px 0 0 var(--el-color-primary);
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
  margin-top: 5px;

  .sidebar__row:not(.has-keywords) & {
    margin-top: 0;
  }
}

.sidebar__row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar__row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__row-tags {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.sidebar__keyword-tag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 1;
  min-width: 0;
  max-width: 72px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  font-weight: 500;
  color: var(--desktop-muted);
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-more {
    flex-shrink: 0;
    max-width: none;
    padding-inline: 5px;
    color: var(--desktop-muted);
    background: color-mix(in srgb, var(--desktop-muted) 10%, var(--desktop-bg));
  }

  .is-active & {
    color: #6b7280;
    background: color-mix(in srgb, var(--desktop-sidebar-item-active) 60%, var(--desktop-bg));
    border-color: color-mix(in srgb, var(--desktop-border) 80%, transparent);

    &.is-more {
      background: color-mix(in srgb, var(--desktop-muted) 14%, var(--desktop-sidebar-item-active));
    }
  }
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

.sidebar__all-block {
  margin-bottom: 2px;
}

.sidebar__all-head {
  display: flex;
  align-items: center;
  gap: 2px;

  .sidebar__row {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;
  }
}

.sidebar__view-list {
  display: flex;
  flex-direction: column;

  :deep(.el-dropdown) {
    display: block;
  }
}

.sidebar__row--nested {
  padding-left: 30px;
  font-size: 12px;
}

.sidebar__filter-hint {
  margin: 0 10px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f6f8;
  font-size: 11px;
  line-height: 1.45;
  color: var(--desktop-muted);

  &--nested {
    margin: 0 10px 6px 30px;
    padding: 6px 8px;
  }
}
</style>
