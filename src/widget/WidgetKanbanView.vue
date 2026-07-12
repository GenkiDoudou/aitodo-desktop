<template>
  <div class="widget-kanban">
    <div v-if="displayColumns.length === 0" class="widget-kanban__empty">暂无看板列</div>
    <div v-else class="widget-kanban__board">
      <section
        v-for="col in displayColumns"
        :key="col.id"
        class="widget-kanban__col"
        :class="{ 'is-empty': columnRows(col.id).length === 0 }"
      >
        <header class="widget-kanban__col-head">
          <span class="widget-kanban__col-title">{{ col.name }}</span>
          <span class="widget-kanban__col-count">{{ columnRows(col.id).length }}</span>
        </header>
        <div class="widget-kanban__cards">
          <div v-if="columnRows(col.id).length === 0" class="widget-kanban__col-empty">空</div>
          <article
            v-for="row in columnRows(col.id)"
            :key="row.task.id"
            class="widget-kanban__card"
            :class="{ 'widget-kanban__card--child': row.depth > 0 }"
            :style="row.depth > 0 ? { marginLeft: `${row.depth * 10}px` } : undefined"
          >
            <span
              class="widget-kanban__logo"
              :style="categoryLogoStyle(row.task)"
              :title="categoryName(row.task) || '未分类'"
            >
              {{ categoryLogo(row.task) }}
            </span>
            <input
              class="widget-kanban__check"
              type="checkbox"
              :checked="row.task.status === 'DONE'"
              :disabled="updatingIds.has(row.task.id)"
              @change="emit('toggle-done', row.task.id)"
            />
            <button type="button" class="widget-kanban__title" @click="emit('open-task', row.task.id)">
              {{ row.task.title }}
            </button>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_KANBAN_STATUS_LABELS,
  KANBAN_STATUS_COLUMNS,
  statusLabelFor,
  type KanbanBoardMode
} from '@shared/kanban-config'
import { KANBAN_DONE_COLUMN_ID, KANBAN_UNGROUPED_ID, kanbanScopeKey } from '@shared/kanban-scope'
import { compareTasks, type TaskSortBy } from '@shared/task-list-layout'
import { TASK_PRIORITIES, isValidTaskPriority } from '@shared/task-priority'
import type { Category, KanbanGroup, Task } from '@shared/types'
import { categoryLogoInitial } from '@shared/widget-notes'
import { readKanbanConfig } from '@/utils/kanban-preferences'

const props = defineProps<{
  tasks: Task[]
  boardMode: KanbanBoardMode
  sortBy?: TaskSortBy
  hideDone?: boolean
  updatingIds?: Set<string>
  categories?: Category[]
}>()

const emit = defineEmits<{
  'toggle-done': [taskId: string]
  'open-task': [taskId: string]
}>()

const DONE_COLUMN_ID = KANBAN_DONE_COLUMN_ID
const scopeKey = kanbanScopeKey({ smart: 'all' })
const customGroups = ref<KanbanGroup[]>([])
const ungroupedName = ref('未分组')

const sortBy = computed(() => props.sortBy ?? 'custom')
const hideDone = computed(() => props.hideDone ?? true)
const updatingIds = computed(() => props.updatingIds ?? new Set<string>())
const categoryMap = computed(() => new Map((props.categories ?? []).map((c) => [c.id, c])))

const rootTasks = computed(() => props.tasks.filter((task) => !task.parentId))

const childrenByParent = computed(() => {
  const map = new Map<string, Task[]>()
  for (const task of props.tasks) {
    if (!task.parentId) continue
    if (!map.has(task.parentId)) map.set(task.parentId, [])
    map.get(task.parentId)!.push(task)
  }
  return map
})

const groupIdSet = computed(() => new Set(customGroups.value.map((group) => group.id)))

const displayColumns = computed(() => {
  if (props.boardMode === 'status') {
    const labels = readKanbanConfig().statusColumnLabels ?? DEFAULT_KANBAN_STATUS_LABELS
    return KANBAN_STATUS_COLUMNS.map((status) => ({
      id: status,
      name: statusLabelFor(status, labels)
    }))
  }
  if (props.boardMode === 'priority') {
    return TASK_PRIORITIES.map((item) => ({
      id: String(item.value),
      name: `${item.code} · ${item.label}`
    }))
  }
  const cols = [{ id: KANBAN_UNGROUPED_ID, name: ungroupedName.value }]
  for (const group of customGroups.value) {
    cols.push({ id: group.id, name: group.name })
  }
  if (!hideDone.value) {
    cols.push({ id: DONE_COLUMN_ID, name: '已完成' })
  }
  return cols
})

function sortTaskList(items: Task[]): Task[] {
  return [...items].sort((a, b) => compareTasks(a, b, sortBy.value))
}

function resolveColumnId(task: Task): string {
  if (task.kanbanGroupId && groupIdSet.value.has(task.kanbanGroupId)) {
    return task.kanbanGroupId
  }
  return KANBAN_UNGROUPED_ID
}

function tasksInColumn(columnId: string): Task[] {
  if (props.boardMode === 'status') {
    return rootTasks.value.filter((task) => task.status === columnId)
  }
  if (props.boardMode === 'priority') {
    const priority = Number(columnId)
    if (!isValidTaskPriority(priority)) return []
    return rootTasks.value.filter((task) => {
      const value = typeof task.priority === 'number' ? task.priority : Number(task.priority)
      return (Number.isFinite(value) ? value : 4) === priority
    })
  }
  if (columnId === DONE_COLUMN_ID) {
    return rootTasks.value.filter((task) => task.status === 'DONE')
  }
  return rootTasks.value.filter((task) => task.status !== 'DONE' && resolveColumnId(task) === columnId)
}

function columnRows(columnId: string) {
  const rows: Array<{ task: Task; depth: number }> = []

  function walk(task: Task, depth: number) {
    rows.push({ task, depth })
    for (const child of sortTaskList(childrenByParent.value.get(task.id) ?? [])) {
      walk(child, depth + 1)
    }
  }

  for (const root of sortTaskList(tasksInColumn(columnId))) {
    walk(root, 0)
  }
  return rows
}

function categoryName(task: Task): string {
  if (!task.categoryId) return '未分类'
  return categoryMap.value.get(task.categoryId)?.name ?? '未分类'
}

function categoryLogo(task: Task): string {
  return categoryLogoInitial(categoryName(task))
}

function categoryLogoStyle(task: Task): Record<string, string> {
  const color = task.categoryId ? categoryMap.value.get(task.categoryId)?.color : null
  if (color) {
    return { background: color, color: '#fff' }
  }
  return { background: 'rgba(255,255,255,0.12)', color: 'var(--widget-muted)' }
}

async function loadGroups() {
  const res = await window.widgetApi.kanbanGroups.list(scopeKey)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  customGroups.value = res.data.groups
  ungroupedName.value = res.data.ungroupedName
}

onMounted(() => {
  if (props.boardMode === 'group') {
    void loadGroups()
  }
})

watch(
  () => props.boardMode,
  (mode) => {
    if (mode === 'group') {
      void loadGroups()
    }
  }
)
</script>

<style scoped lang="scss">
.widget-kanban {
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.widget-kanban__board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: start;
  padding: 8px;
}

.widget-kanban__col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.16);
  height: fit-content;

  &.is-empty {
    .widget-kanban__cards {
      padding: 4px 6px 6px;
    }

    .widget-kanban__col-empty {
      padding: 4px 0;
    }
  }
}

.widget-kanban__col-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.widget-kanban__col-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  color: var(--widget-text);
}

.widget-kanban__col-count {
  flex: 0 0 auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--widget-muted);
  font-size: 10px;
  line-height: 18px;
  text-align: center;
}

.widget-kanban__cards {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.widget-kanban__col-empty {
  padding: 6px 0;
  color: var(--widget-muted);
  font-size: 11px;
  text-align: center;
}

.widget-kanban__card {
  display: grid;
  grid-template-columns: 18px 14px minmax(0, 1fr);
  align-items: start;
  gap: 5px;
  padding: 6px 7px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
}

.widget-kanban__card--child {
  background: rgba(255, 255, 255, 0.03);
}

.widget-kanban__logo {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.widget-kanban__check {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  accent-color: var(--widget-accent);
  cursor: pointer;
}

.widget-kanban__title {
  min-width: 0;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--widget-text);
  cursor: pointer;
  font-size: 11px;
  line-height: 1.35;
  text-align: left;
  word-break: break-word;
}

.widget-kanban__title:hover {
  color: var(--widget-accent);
}

.widget-kanban__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--widget-muted);
  font-size: 12px;
}
</style>
