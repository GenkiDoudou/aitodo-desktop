<template>
  <el-dialog
    :model-value="visible"
    width="680px"
    destroy-on-close
    class="task-view-editor"
    :show-close="true"
    align-center
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="task-view-editor__header">
        <div class="task-view-editor__header-icon" aria-hidden="true">
          <el-icon><Grid /></el-icon>
        </div>
        <div class="task-view-editor__header-text">
          <h2 class="task-view-editor__title">{{ dialogTitle }}</h2>
          <p class="task-view-editor__subtitle">保存布局、筛选与排序，随时切换任务视角</p>
        </div>
      </div>
    </template>

    <div class="task-view-editor__body">
      <section class="task-view-editor__section">
        <h3 class="task-view-editor__section-title">基础</h3>
        <div class="task-view-editor__name-wrap">
          <label class="task-view-editor__field-label" for="view-editor-name">视图名称</label>
          <el-input
            id="view-editor-name"
            v-model="name"
            maxlength="64"
            placeholder="例如：本周高优、研发看板"
            size="large"
            clearable
          />
        </div>

        <div class="task-view-editor__field">
          <span class="task-view-editor__field-label">展示布局</span>
          <div class="task-view-editor__layout-grid" role="radiogroup" aria-label="展示布局">
            <button
              v-for="opt in layoutOptions"
              :key="opt.value"
              type="button"
              class="task-view-editor__layout-card"
              :class="{ 'is-active': layout === opt.value }"
              role="radio"
              :aria-checked="layout === opt.value"
              @click="layout = opt.value"
            >
              <span class="task-view-editor__layout-icon">
                <el-icon><component :is="opt.icon" /></el-icon>
              </span>
              <span class="task-view-editor__layout-name">{{ opt.label }}</span>
              <span class="task-view-editor__layout-desc">{{ opt.desc }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="task-view-editor__section">
        <h3 class="task-view-editor__section-title">显示选项</h3>
        <div class="task-view-editor__options-grid">
          <div v-if="layout === 'list'" class="task-view-editor__option">
            <label class="task-view-editor__field-label">分组</label>
            <el-select v-model="groupBy" class="task-view-editor__select">
              <el-option
                v-for="opt in groupOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div v-if="layout === 'kanban'" class="task-view-editor__option">
            <label class="task-view-editor__field-label">看板分组</label>
            <el-select v-model="kanbanBoardMode" placeholder="选择分组" class="task-view-editor__select">
              <el-option
                v-for="opt in kanbanGroupOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <template v-if="layout === 'quadrant'">
            <div class="task-view-editor__option task-view-editor__option--full">
              <div class="task-view-editor__switch-row">
                <span class="task-view-editor__field-label">显示已完成</span>
                <el-switch v-model="quadrantOptions.showCompleted" />
              </div>
              <div class="task-view-editor__switch-row">
                <span class="task-view-editor__field-label">启用分组</span>
                <el-switch v-model="quadrantOptions.enableGrouping" />
              </div>
              <div class="task-view-editor__option">
                <label class="task-view-editor__field-label">象限内分组</label>
                <el-select
                  v-model="quadrantOptions.groupBy"
                  class="task-view-editor__select"
                  :disabled="!quadrantOptions.enableGrouping"
                >
                  <el-option
                    v-for="(label, key) in quadrantGroupByLabels"
                    :key="key"
                    :label="label"
                    :value="key"
                  />
                </el-select>
              </div>
            </div>
          </template>
          <div v-if="layout !== 'quadrant'" class="task-view-editor__option">
            <label class="task-view-editor__field-label">排序</label>
            <el-select v-model="sortBy" class="task-view-editor__select">
              <el-option
                v-for="opt in sortOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>

        <div class="task-view-editor__display-block">
          <div class="task-view-editor__switch-row">
            <span class="task-view-editor__field-label">隐藏已完成</span>
            <el-switch v-model="hideDone" />
          </div>
          <p class="task-view-editor__hint">
            状态看板建议关闭，以便显示「已完成」列
          </p>

          <div class="task-view-editor__field" style="margin-top: 14px">
            <span class="task-view-editor__field-label">列表时间字段</span>
            <div class="task-view-editor__checks">
              <label v-for="opt in metaOptions" :key="opt.key" class="task-view-editor__check">
                <el-checkbox v-model="metaVisibility[opt.key]" />
                <span>{{ opt.label }}</span>
              </label>
            </div>
          </div>

          <div class="task-view-editor__field" style="margin-top: 14px">
            <span class="task-view-editor__field-label">任务详情样式</span>
            <el-radio-group v-model="detailStyle" size="small">
              <el-radio value="sidebar">侧边栏</el-radio>
              <el-radio value="dialog">弹框详情</el-radio>
            </el-radio-group>
          </div>
        </div>
      </section>

      <section class="task-view-editor__section task-view-editor__section--filter">
        <div class="task-view-editor__section-head">
          <h3 class="task-view-editor__section-title">筛选条件</h3>
          <span class="task-view-editor__section-badge">可选</span>
        </div>
        <ViewFilterBuilder v-model="root" :categories="categories" />
        <p v-if="validationError" class="task-view-editor__error">
          <el-icon><WarningFilled /></el-icon>
          {{ validationError }}
        </p>
      </section>
    </div>

    <template #footer>
      <div class="task-view-editor__footer">
        <div class="task-view-editor__preview" :class="{ 'has-filter': !isEmptyFilterNode(root) }">
          <span class="task-view-editor__preview-dot" />
          <span v-if="isEmptyFilterNode(root)">未设筛选，显示范围内全部任务</span>
          <span v-else>预览约匹配 <strong>{{ previewCount }}</strong> 条任务</span>
        </div>
        <div class="task-view-editor__actions">
          <el-button @click="emit('update:visible', false)">取消</el-button>
          <el-button type="primary" :disabled="!canSave" :loading="saving" @click="onSave">
            保存视图
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { ElMessage } from 'element-plus'
import { Clock, Grid, List, Operation, WarningFilled } from '@element-plus/icons-vue'
import type { Category, TaskViewLayout } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import { TASK_GROUP_BY_LABELS, TASK_SORT_BY_LABELS } from '@shared/task-list-layout'
import { QUADRANT_GROUP_BY_LABELS, type QuadrantGroupBy } from '@shared/quadrant-layout'
import type { QuadrantLayoutOptions } from '@shared/quadrant-layout'
import { readQuadrantViewPreferences } from '@/utils/quadrant-preferences'
import { VIEW_EDITOR_KANBAN_GROUP_OPTIONS } from '@shared/view-editor-config'
import type { TaskDetailStyle, TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import {
  createEmptyAndGroup,
  filterNodeForEditor,
  filterNodeToPersist,
  isEmptyFilterNode,
  validateFilterNode,
  type FilterNode
} from '@shared/task-filter-ast'
import { useViewStore } from '@/stores/view-store'
import {
  defaultViewDisplayPreferences,
  persistViewDisplayPreferences,
  readViewDisplayPreferences
} from '@/utils/view-display-preferences'
import ViewFilterBuilder from '@/components/filters/ViewFilterBuilder.vue'

const layoutOptions: {
  value: TaskViewLayout
  label: string
  desc: string
  icon: Component
}[] = [
  { value: 'list', label: '列表', desc: '树形层级浏览', icon: List },
  { value: 'kanban', label: '看板', desc: '分列拖拽管理', icon: Grid },
  { value: 'timeline', label: '时间线', desc: '按时间轴排布', icon: Clock },
  { value: 'quadrant', label: '四象限', desc: '按优先级矩阵排布', icon: Operation }
]

const sortOptions: { value: TaskSortBy; label: string }[] = (
  ['custom', 'time', 'createdAt', 'completedAt', 'remindAt', 'priority', 'title', 'tag'] as const
).map((value) => ({ value, label: TASK_SORT_BY_LABELS[value] }))

const groupOptions: { value: TaskGroupBy; label: string }[] = (
  ['none', 'time', 'priority', 'tag', 'custom'] as const
).map((value) => ({ value, label: TASK_GROUP_BY_LABELS[value] }))

const metaOptions: { key: keyof TaskListMetaVisibility; label: string }[] = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'dueAt', label: '到期时间' },
  { key: 'remindAt', label: '提醒时间' },
  { key: 'completedAt', label: '完成时间' }
]

const props = withDefaults(
  defineProps<{
    visible: boolean
    mode?: 'create' | 'edit' | 'save-as'
    viewId?: string | null
    initialName?: string
    initialLayout?: TaskViewLayout
    initialGroupBy?: TaskGroupBy
    initialSortBy?: TaskSortBy
    initialKanbanBoardMode?: KanbanBoardMode | null
    initialQuadrantOptions?: QuadrantLayoutOptions | null
    initialRule?: FilterNode | null
    initialHideDone?: boolean
    initialDetailStyle?: TaskDetailStyle
    initialMetaVisibility?: TaskListMetaVisibility
    categories: Category[]
  }>(),
  {
    mode: 'create',
    viewId: null,
    initialName: '',
    initialLayout: 'list',
    initialGroupBy: 'none',
    initialSortBy: 'custom',
    initialKanbanBoardMode: 'group',
    initialRule: null,
    initialHideDone: undefined,
    initialDetailStyle: 'sidebar',
    initialMetaVisibility: undefined
  }
)

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [string | undefined]
}>()

const kanbanGroupOptions = VIEW_EDITOR_KANBAN_GROUP_OPTIONS

const viewStore = useViewStore()
const name = ref('')
const layout = ref<TaskViewLayout>('list')
const groupBy = ref<TaskGroupBy>('none')
const sortBy = ref<TaskSortBy>('custom')
const kanbanBoardMode = ref<KanbanBoardMode>('group')
const quadrantOptions = ref<QuadrantLayoutOptions>(readQuadrantViewPreferences())
const quadrantGroupByLabels = QUADRANT_GROUP_BY_LABELS
const hideDone = ref(true)
const detailStyle = ref<TaskDetailStyle>('sidebar')
const metaVisibility = ref<TaskListMetaVisibility>({ ...DEFAULT_TASK_LIST_META_VISIBILITY })
const root = ref<FilterNode>(createEmptyAndGroup())
const saving = ref(false)
const previewCount = ref(0)
let previewTimer: ReturnType<typeof setTimeout> | null = null
let suppressStatusHideDoneSync = false

const dialogTitle = computed(() => {
  if (props.mode === 'edit') return '编辑视图'
  if (props.mode === 'save-as') return '另存为视图'
  return '新建视图'
})

const validationError = computed(() => {
  if (isEmptyFilterNode(root.value)) return null
  return validateFilterNode(root.value)
})

const canSave = computed(() => Boolean(name.value.trim()) && !saving.value && !validationError.value)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    suppressStatusHideDoneSync = true
    name.value = props.initialName || ''
    layout.value = props.initialLayout
    groupBy.value = props.initialGroupBy
    sortBy.value = props.initialSortBy
    kanbanBoardMode.value = props.initialKanbanBoardMode ?? 'group'
    quadrantOptions.value = props.initialQuadrantOptions
      ? { ...props.initialQuadrantOptions }
      : props.initialLayout === 'quadrant'
        ? readQuadrantViewPreferences()
        : readQuadrantViewPreferences()
    root.value = filterNodeForEditor(props.initialRule)

    const mode = layout.value === 'kanban' ? kanbanBoardMode.value : null
    const stored =
      props.mode === 'edit' && props.viewId
        ? readViewDisplayPreferences(props.viewId, mode)
        : defaultViewDisplayPreferences(mode)
    hideDone.value =
      typeof props.initialHideDone === 'boolean' ? props.initialHideDone : stored.hideDone
    detailStyle.value = props.initialDetailStyle ?? stored.detailStyle
    metaVisibility.value = {
      ...stored.metaVisibility,
      ...(props.initialMetaVisibility ?? {})
    }
    schedulePreview()
    void Promise.resolve().then(() => {
      suppressStatusHideDoneSync = false
    })
  }
)

watch(root, () => schedulePreview(), { deep: true })

watch([layout, kanbanBoardMode], ([nextLayout, nextMode]) => {
  if (suppressStatusHideDoneSync) return
  if (nextLayout === 'quadrant' && props.mode === 'create' && !props.initialQuadrantOptions) {
    quadrantOptions.value = readQuadrantViewPreferences()
  }
  if (nextLayout === 'kanban' && nextMode === 'status') {
    hideDone.value = false
  }
})

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    void refreshPreview()
  }, 280)
}

async function refreshPreview() {
  if (isEmptyFilterNode(root.value)) {
    previewCount.value = 0
    return
  }
  const err = validateFilterNode(root.value)
  if (err) {
    previewCount.value = 0
    return
  }
  try {
    previewCount.value = await viewStore.previewCount(root.value)
  } catch {
    previewCount.value = 0
  }
}

async function onSave() {
  if (!isEmptyFilterNode(root.value)) {
    const err = validateFilterNode(root.value)
    if (err) {
      ElMessage.warning(err)
      return
    }
  }
  const trimmed = name.value.trim()
  if (!trimmed) {
    ElMessage.warning('请输入名称')
    return
  }
  const filterRule = filterNodeToPersist(root.value)
  const payload = {
    name: trimmed,
    layout: layout.value,
    groupBy: layout.value === 'list' ? groupBy.value : ('none' as TaskGroupBy),
    sortBy: layout.value === 'quadrant' ? quadrantOptions.value.sortBy : sortBy.value,
    filterRule,
    kanbanBoardMode: layout.value === 'kanban' ? kanbanBoardMode.value : null,
    quadrantOptions:
      layout.value === 'quadrant'
        ? {
            showCompleted: quadrantOptions.value.showCompleted,
            enableGrouping: quadrantOptions.value.enableGrouping,
            groupBy: quadrantOptions.value.groupBy,
            sortBy: quadrantOptions.value.sortBy
          }
        : null
  }
  const displayPrefs = {
    hideDone: hideDone.value,
    detailStyle: detailStyle.value,
    metaVisibility: { ...metaVisibility.value }
  }
  saving.value = true
  try {
    let savedId: string | undefined
    if (props.mode === 'edit' && props.viewId) {
      await viewStore.update(props.viewId, payload)
      savedId = props.viewId
      ElMessage.success('视图已更新')
    } else {
      const created = await viewStore.create(payload)
      savedId = created.id
      ElMessage.success('视图已创建')
    }
    if (savedId) {
      persistViewDisplayPreferences(savedId, displayPrefs)
    }
    emit('saved', savedId)
    emit('update:visible', false)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.task-view-editor__header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding-right: 28px;
}

.task-view-editor__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.14), rgba(13, 148, 136, 0.12));
  color: var(--el-color-primary);
  font-size: 22px;
  flex-shrink: 0;
}

.task-view-editor__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--desktop-text);
}

.task-view-editor__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--desktop-muted);
}

.task-view-editor__body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.task-view-editor__section {
  padding: 18px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--desktop-border);
  }

  &--filter {
    padding-bottom: 4px;
  }
}

.task-view-editor__section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.task-view-editor__section-title {
  margin: 0 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--desktop-muted);
}

.task-view-editor__section-head .task-view-editor__section-title {
  margin-bottom: 0;
}

.task-view-editor__section-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--desktop-muted);
  background: var(--desktop-hover);
}

.task-view-editor__name-wrap {
  margin-bottom: 18px;
}

.task-view-editor__field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-view-editor__field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--desktop-text);
}

.task-view-editor__layout-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.task-view-editor__layout-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 12px;
  border: 1.5px solid var(--desktop-border);
  border-radius: 12px;
  background: var(--desktop-panel);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: #fafcff;
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background: linear-gradient(180deg, rgba(64, 158, 255, 0.06) 0%, #fff 100%);
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.12);

    .task-view-editor__layout-icon {
      color: var(--el-color-primary);
      background: rgba(64, 158, 255, 0.12);
    }
  }
}

.task-view-editor__layout-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
  border-radius: 8px;
  background: var(--desktop-hover);
  color: var(--desktop-muted);
  font-size: 17px;
  transition: color 0.15s ease, background 0.15s ease;
}

.task-view-editor__layout-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
}

.task-view-editor__layout-desc {
  font-size: 11px;
  line-height: 1.35;
  color: var(--desktop-muted);
}

.task-view-editor__options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.task-view-editor__display-block {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--desktop-border);
}

.task-view-editor__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .task-view-editor__field-label {
    margin-bottom: 0;
  }
}

.task-view-editor__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.4;
}

.task-view-editor__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
}

.task-view-editor__check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;
}

.task-view-editor__option.is-full {
  grid-column: 1 / -1;
}

.task-view-editor__select {
  width: 100%;
}

.task-view-editor__error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--el-color-danger);
  background: rgba(245, 108, 108, 0.08);
}

.task-view-editor__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.task-view-editor__preview {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  color: var(--desktop-muted);

  strong {
    font-weight: 600;
    color: var(--el-color-primary);
  }

  &.has-filter strong {
    color: var(--desktop-ai);
  }
}

.task-view-editor__preview-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--desktop-muted);
  flex-shrink: 0;

  .has-filter & {
    background: var(--desktop-ai);
    box-shadow: 0 0 0 3px var(--desktop-ai-light);
  }
}

.task-view-editor__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>

<style lang="scss">
/* el-dialog 挂载到 body，需非 scoped */
.el-dialog.task-view-editor {
  overflow: hidden;
  border-radius: 14px;
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.12),
    0 0 0 1px rgba(15, 23, 42, 0.04);

  .el-dialog__header {
    margin: 0;
    padding: 22px 24px 0;
    border-bottom: none;
  }

  .el-dialog__headerbtn {
    top: 18px;
    right: 18px;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    transition: background 0.15s ease;

    &:hover {
      background: var(--desktop-hover);
    }
  }

  .el-dialog__body {
    padding: 8px 24px 4px;
  }

  .el-dialog__footer {
    padding: 14px 24px 20px;
    border-top: 1px solid var(--desktop-border);
    background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  }
}
</style>
