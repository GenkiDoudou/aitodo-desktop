<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="760px"
    destroy-on-close
    class="task-view-editor"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="名称" required>
        <el-input v-model="name" maxlength="64" placeholder="视图名称" />
      </el-form-item>
      <el-form-item label="布局">
        <el-radio-group v-model="layout">
          <el-radio value="list">列表</el-radio>
          <el-radio value="kanban">看板</el-radio>
          <el-radio value="timeline">时间线</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="layout === 'kanban'" label="看板模式">
        <el-radio-group v-model="kanbanBoardMode">
          <el-radio value="group">分组</el-radio>
          <el-radio value="status">状态</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="分组">
        <el-select v-model="groupBy" style="width: 100%">
          <el-option label="无" value="none" />
          <el-option label="时间" value="time" />
          <el-option label="优先级" value="priority" />
          <el-option label="自定义" value="custom" />
          <el-option label="标签" value="tag" />
        </el-select>
      </el-form-item>
      <el-form-item label="排序">
        <el-select v-model="sortBy" style="width: 100%">
          <el-option label="自定义" value="custom" />
          <el-option label="时间" value="time" />
          <el-option label="标题" value="title" />
          <el-option label="优先级" value="priority" />
          <el-option label="标签" value="tag" />
        </el-select>
      </el-form-item>
      <el-form-item label="筛选条件">
        <FilterGroupNode
          v-if="root.type === 'group'"
          :node="root"
          :depth="0"
          :categories="categories"
          @change="onRootChange"
        />
      </el-form-item>
      <p v-if="validationError" class="task-view-editor__error">{{ validationError }}</p>
      <p class="task-view-editor__preview">预览约匹配 {{ previewCount }} 条任务</p>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!canSave" :loading="saving" @click="onSave">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Category, TaskViewLayout } from '@shared/types'
import type { KanbanBoardMode } from '@shared/kanban-config'
import type { TaskGroupBy, TaskSortBy } from '@shared/task-list-layout'
import {
  createEmptyAndGroup,
  normalizeFilterNode,
  validateFilterNode,
  type FilterNode
} from '@shared/task-filter-ast'
import { useViewStore } from '@/stores/view-store'
import FilterGroupNode from '@/components/filters/FilterGroupNode.vue'

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
    initialRule?: FilterNode | null
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
    initialRule: null
  }
)

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: [string | undefined]
}>()

const viewStore = useViewStore()
const name = ref('')
const layout = ref<TaskViewLayout>('list')
const groupBy = ref<TaskGroupBy>('none')
const sortBy = ref<TaskSortBy>('custom')
const kanbanBoardMode = ref<KanbanBoardMode>('group')
const root = ref<FilterNode>(createEmptyAndGroup())
const saving = ref(false)
const previewCount = ref(0)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const dialogTitle = computed(() => {
  if (props.mode === 'edit') return '编辑视图'
  if (props.mode === 'save-as') return '另存为视图'
  return '新建视图'
})

const validationError = computed(() => validateFilterNode(root.value))

const canSave = computed(() => Boolean(name.value.trim()) && !saving.value && !validationError.value)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    name.value = props.initialName || ''
    layout.value = props.initialLayout
    groupBy.value = props.initialGroupBy
    sortBy.value = props.initialSortBy
    kanbanBoardMode.value = props.initialKanbanBoardMode ?? 'group'
    root.value = normalizeFilterNode(props.initialRule ?? createEmptyAndGroup())
    schedulePreview()
  }
)

watch(root, () => schedulePreview(), { deep: true })

function onRootChange(next: FilterNode) {
  root.value = next
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    void refreshPreview()
  }, 280)
}

async function refreshPreview() {
  if (validateFilterNode(root.value)) {
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
  const err = validateFilterNode(root.value)
  if (err) {
    ElMessage.warning(err)
    return
  }
  const trimmed = name.value.trim()
  if (!trimmed) {
    ElMessage.warning('请输入名称')
    return
  }
  const rule = normalizeFilterNode(root.value)
  const payload = {
    name: trimmed,
    layout: layout.value,
    groupBy: groupBy.value,
    sortBy: sortBy.value,
    filterRule: rule,
    kanbanBoardMode: layout.value === 'kanban' ? kanbanBoardMode.value : null
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
.task-view-editor__error {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.task-view-editor__preview {
  margin: 0;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
