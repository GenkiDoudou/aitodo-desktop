<template>
  <div class="task-kanban" v-loading="loading">
    <header class="task-kanban__toolbar">
      <button type="button" class="task-kanban__add-group" @click="onAddGroup">
        <el-icon><Plus /></el-icon>
        新分组
      </button>
    </header>

    <div v-if="!loading && rootTasks.length === 0 && customGroups.length === 0" class="task-kanban__empty">
      暂无任务，点击列头 + 或「新分组」开始
    </div>

    <div v-else class="task-kanban__board">
      <section
        v-for="col in displayColumns"
        :key="col.id"
        class="task-kanban__col"
        :class="{ 'is-column-selected': selectedColumnId === col.id }"
        @dragover.prevent="onDragOver"
        @drop.prevent="onDrop(col.id)"
      >
        <header class="task-kanban__col-head">
          <div
            class="task-kanban__col-title-wrap"
            role="button"
            tabindex="0"
            :title="selectedColumnId === col.id ? '再次点击取消选中' : '选中后，顶栏添加的任务将进入此分组'"
            @click="toggleColumnSelection(col.id)"
            @keydown.enter.prevent="toggleColumnSelection(col.id)"
          >
            <span class="task-kanban__col-title">{{ col.name }}</span>
            <span class="task-kanban__col-count">{{ activeInColumn(col.id).length }}</span>
          </div>
          <div class="task-kanban__col-actions">
            <button
              type="button"
              class="task-kanban__icon-btn"
              title="添加任务"
              @click.stop="startQuickAdd(col.id)"
            >
              <el-icon><Plus /></el-icon>
            </button>
            <el-dropdown trigger="click" @command="(c) => onColumnCommand(c, col)">
              <button type="button" class="task-kanban__icon-btn" title="分组设置" @click.stop>
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item v-if="col.id !== KANBAN_UNGROUPED_ID" command="add-left">
                    在左侧添加分组
                  </el-dropdown-item>
                  <el-dropdown-item command="add-right">在右侧添加分组</el-dropdown-item>
                  <el-dropdown-item v-if="col.id !== KANBAN_UNGROUPED_ID" command="delete" divided>
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </header>

        <div class="task-kanban__cards">
          <div v-if="quickAddColumn === col.id" class="task-kanban__quick-add">
            <QuickAddInput
              ref="quickAddInputRef"
              v-model="quickAddText"
              placeholder="任务标题，可含日期/提醒/重复，回车保存"
              :categories="parseCategories"
              :show-meta="true"
              @enter="submitQuickAdd(col.id)"
              @escape="cancelQuickAdd"
              @blur="onQuickAddBlur"
            />
          </div>

          <article
            v-for="task in activeInColumn(col.id)"
            :key="task.id"
            class="task-kanban__card"
            :class="{ 'is-selected': selectedId === task.id }"
            draggable="true"
            @dragstart="onDragStart(task.id, $event)"
            @dragend="onDragEnd"
            @click="emit('select', task.id)"
          >
            <div class="task-kanban__card-top">
              <el-checkbox
                :model-value="task.status === 'DONE'"
                @click.stop
                @change="() => emit('toggle-status', task)"
              />
              <span class="task-kanban__card-title">{{ task.title }}</span>
            </div>
            <p v-if="descriptionPreview(task)" class="task-kanban__card-desc">
              {{ descriptionPreview(task) }}
            </p>
            <div v-if="dueLabel(task)" class="task-kanban__card-due">{{ dueLabel(task) }}</div>
          </article>
        </div>

        <div v-if="!hideDone && doneInColumn(col.id).length" class="task-kanban__done">
          <button
            type="button"
            class="task-kanban__done-head"
            @click="toggleDoneExpanded(col.id)"
          >
            <el-icon class="task-kanban__done-chevron" :class="{ 'is-open': isDoneExpanded(col.id) }">
              <ArrowDown />
            </el-icon>
            <span>已完成</span>
            <span class="task-kanban__done-count">{{ doneInColumn(col.id).length }}</span>
          </button>
          <div v-show="isDoneExpanded(col.id)" class="task-kanban__done-list">
            <article
              v-for="task in doneInColumn(col.id)"
              :key="task.id"
              class="task-kanban__card task-kanban__card--done"
              :class="{ 'is-selected': selectedId === task.id }"
              draggable="true"
              @dragstart="onDragStart(task.id, $event)"
              @dragend="onDragEnd"
              @click="emit('select', task.id)"
            >
              <div class="task-kanban__card-top">
                <el-checkbox :model-value="true" @click.stop @change="() => emit('toggle-status', task)" />
                <span class="task-kanban__card-title is-done">{{ task.title }}</span>
              </div>
              <p v-if="descriptionPreview(task)" class="task-kanban__card-desc">{{ descriptionPreview(task) }}</p>
              <div v-if="dueLabel(task)" class="task-kanban__card-due is-muted">{{ dueLabel(task) }}</div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown, MoreFilled, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import type { KanbanGroup, Task } from '@shared/types'
import type { TaskListMetaVisibility } from '@shared/list-view-preferences'
import { KANBAN_UNGROUPED_ID } from '@shared/kanban-scope'
import { taskDescriptionPreview } from '@shared/task-description'
import { buildCreateTaskDtoFromParsed, parseAiTaskInput } from '@shared/ai-task-parser'
import QuickAddInput from '@/components/QuickAddInput.vue'
import { formatTaskListTime } from '@/utils/format-task-time'
import { unwrapIpc } from '@/ipc/client'

interface DisplayColumn {
  id: string
  name: string
}

const props = defineProps<{
  scopeKey: string
  tasks: Task[]
  loading: boolean
  selectedId?: string | null
  hideDone?: boolean
  metaVisibility?: TaskListMetaVisibility
  /** 快捷添加任务默认清单 */
  defaultCategoryId?: string | null
  /** 用于快捷识别中的分类名匹配 */
  parseCategories?: { id: string; name: string }[]
}>()

const parseCategories = computed(() => props.parseCategories ?? [])

const emit = defineEmits<{
  select: [string]
  'toggle-status': [Task]
  changed: []
}>()

/** 当前选中的看板列：顶栏快捷添加会写入此列；null 表示未选中，默认归入未分组 */
const selectedColumnId = defineModel<string | null>('selectedColumnId', { default: null })

const customGroups = ref<KanbanGroup[]>([])
const ungroupedName = ref('未分组')
const draggingTaskId = ref<string | null>(null)
const doneExpanded = ref<Record<string, boolean>>({})
const quickAddColumn = ref<string | null>(null)
const quickAddText = ref('')
const quickAddInputRef = ref<InstanceType<typeof QuickAddInput> | InstanceType<typeof QuickAddInput>[] | null>(null)

const rootTasks = computed(() => props.tasks.filter((t) => !t.parentId))

const displayColumns = computed<DisplayColumn[]>(() => {
  const cols: DisplayColumn[] = [{ id: KANBAN_UNGROUPED_ID, name: ungroupedName.value }]
  for (const g of customGroups.value) {
    cols.push({ id: g.id, name: g.name })
  }
  return cols
})

const groupIdSet = computed(() => new Set(customGroups.value.map((g) => g.id)))

function resolveColumnId(task: Task): string {
  if (task.kanbanGroupId && groupIdSet.value.has(task.kanbanGroupId)) {
    return task.kanbanGroupId
  }
  return KANBAN_UNGROUPED_ID
}

function activeInColumn(columnId: string) {
  return rootTasks.value.filter((t) => t.status !== 'DONE' && resolveColumnId(t) === columnId)
}

function doneInColumn(columnId: string) {
  return rootTasks.value.filter((t) => t.status === 'DONE' && resolveColumnId(t) === columnId)
}

function isDoneExpanded(columnId: string) {
  return doneExpanded.value[columnId] !== false
}

function toggleDoneExpanded(columnId: string) {
  doneExpanded.value[columnId] = !isDoneExpanded(columnId)
}

function descriptionPreview(task: Task) {
  return taskDescriptionPreview(task.description, 48)
}

function dueLabel(task: Task): string {
  if (props.metaVisibility?.dueAt === false || !task.dueAt) return ''
  const d = dayjs(task.dueAt)
  if (!d.isValid()) return ''
  return d.format('YYYY/M/D, H:mm')
}

async function loadGroups() {
  try {
    const board = unwrapIpc(await window.api.kanbanGroups.list(props.scopeKey))
    customGroups.value = board.groups
    ungroupedName.value = board.ungroupedName || '未分组'
  } catch {
    customGroups.value = []
    ungroupedName.value = '未分组'
  }
}

watch(() => props.scopeKey, () => {
  selectedColumnId.value = null
  void loadGroups()
}, { immediate: true })

function toggleColumnSelection(columnId: string) {
  selectedColumnId.value = selectedColumnId.value === columnId ? null : columnId
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDragStart(taskId: string, e: DragEvent) {
  draggingTaskId.value = taskId
  e.dataTransfer?.setData('text/plain', taskId)
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragEnd() {
  draggingTaskId.value = null
}

async function onDrop(columnId: string) {
  const taskId = draggingTaskId.value
  draggingTaskId.value = null
  if (!taskId) return
  const task = rootTasks.value.find((t) => t.id === taskId)
  if (!task) return
  if (resolveColumnId(task) === columnId) return
  const nextGroupId = columnId === KANBAN_UNGROUPED_ID ? null : columnId
  try {
    unwrapIpc(await window.api.tasks.update(taskId, { kanbanGroupId: nextGroupId }))
    emit('changed')
  } catch {
    /* unwrapIpc 已提示 */
  }
}

async function onAddGroup() {
  const { value } = await ElMessageBox.prompt('分组名称', '新分组', {
    confirmButtonText: '创建',
    cancelButtonText: '取消'
  })
  if (!value?.trim()) return
  try {
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'end'
      })
    )
    await loadGroups()
  } catch {
  }
}

async function onColumnCommand(command: string, col: DisplayColumn) {
  if (command === 'rename') {
    const { value } = await ElMessageBox.prompt('分组名称', '重命名', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: col.name
    })
    if (!value?.trim() || value.trim() === col.name) return
    if (col.id === KANBAN_UNGROUPED_ID) {
      unwrapIpc(
        await window.api.kanbanGroups.update(KANBAN_UNGROUPED_ID, {
          name: value.trim(),
          scopeKey: props.scopeKey
        })
      )
    } else {
      unwrapIpc(await window.api.kanbanGroups.update(col.id, { name: value.trim() }))
    }
    await loadGroups()
    return
  }
  if (command === 'add-left') {
    const { value } = await ElMessageBox.prompt('分组名称', '在左侧添加分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    if (!value?.trim()) return
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'before',
        refGroupId: col.id
      })
    )
    await loadGroups()
    return
  }
  if (command === 'add-right') {
    const { value } = await ElMessageBox.prompt('分组名称', '在右侧添加分组', {
      confirmButtonText: '创建',
      cancelButtonText: '取消'
    })
    if (!value?.trim()) return
    unwrapIpc(
      await window.api.kanbanGroups.create({
        scopeKey: props.scopeKey,
        name: value.trim(),
        position: 'after',
        refGroupId: col.id
      })
    )
    await loadGroups()
    return
  }
  if (command === 'delete') {
    await ElMessageBox.confirm(
      `确定删除分组「${col.name}」？其下任务将移入「${ungroupedName.value}」。`,
      '删除分组', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    unwrapIpc(await window.api.kanbanGroups.delete(col.id))
    await loadGroups()
    emit('changed')
  }
}

function startQuickAdd(columnId: string) {
  quickAddColumn.value = columnId
  quickAddText.value = ''
  void nextTick(() => {
    const el = quickAddInputRef.value
    const input = Array.isArray(el) ? el[0] : el
    input?.focus()
  })
}

function cancelQuickAdd() {
  quickAddColumn.value = null
  quickAddText.value = ''
}

function onQuickAddBlur() {
  window.setTimeout(() => {
    if (!quickAddText.value.trim()) cancelQuickAdd()
  }, 120)
}

async function submitQuickAdd(columnId: string) {
  const title = quickAddText.value.trim()
  if (!title) {
    cancelQuickAdd()
    return
  }
  const kanbanGroupId = columnId === KANBAN_UNGROUPED_ID ? null : columnId
  try {
    const parsed = parseAiTaskInput(title, { categories: props.parseCategories ?? [] })
    const dto = buildCreateTaskDtoFromParsed(parsed, {
      categoryId: parsed.category?.id ?? props.defaultCategoryId ?? null,
      kanbanGroupId
    })
    unwrapIpc(await window.api.tasks.create(dto))
    cancelQuickAdd()
    emit('changed')
  } catch {
  }
}
</script>

<style scoped lang="scss">
.task-kanban {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f7f8fa;
}

.task-kanban__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px 0;
  flex-shrink: 0;
}

.task-kanban__add-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.task-kanban__empty {
  text-align: center;
  padding: 48px;
  color: var(--desktop-muted);
}

.task-kanban__board {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  min-height: 0;
  padding: 12px 16px 16px;
}

.task-kanban__col {
  flex: 0 0 272px;
  width: 272px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-radius: 10px;
  transition: background 0.15s ease;

  &.is-column-selected {
    background: rgba(64, 158, 255, 0.08);
  }
}

.task-kanban__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 10px;
  flex-shrink: 0;
}

.task-kanban__col-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.task-kanban__col-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-kanban__col-count {
  font-size: 12px;
  color: var(--desktop-muted);
  flex-shrink: 0;
}

.task-kanban__col-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.task-kanban__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--desktop-text);
  }
}

.task-kanban__cards {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

.task-kanban__quick-add {
  background: #fff;
  border: 1px solid var(--el-color-primary);
  border-radius: 10px;
  padding: 8px 10px;
}

.task-kanban__card {
  background: #fff;
  border: 1px solid #e8eaed;
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }

  &--done {
    opacity: 0.72;
  }
}

.task-kanban__card-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.task-kanban__card-title {
  flex: 1;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
  color: var(--desktop-text);

  &.is-done {
    text-decoration: line-through;
    color: var(--desktop-muted);
  }
}

.task-kanban__card-desc {
  margin: 6px 0 0 28px;
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-kanban__card-due {
  margin: 6px 0 0 28px;
  font-size: 12px;
  color: #e03e3e;
  font-weight: 500;

  &.is-muted {
    color: var(--desktop-muted);
    font-weight: 400;
  }
}

.task-kanban__done {
  flex-shrink: 0;
  border-top: 1px solid #e8eaed;
  padding-top: 8px;
  margin-top: 4px;
}

.task-kanban__done-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 6px 4px;
  font-size: 12px;
  color: var(--desktop-muted);
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }
}

.task-kanban__done-chevron {
  font-size: 12px;
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(0deg);
  }

  &:not(.is-open) {
    transform: rotate(-90deg);
  }
}

.task-kanban__done-count {
  margin-left: auto;
}

.task-kanban__done-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  max-height: 240px;
  overflow-y: auto;
}
</style>
