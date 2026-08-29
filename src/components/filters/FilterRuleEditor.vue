<script setup lang="ts">
/**
 * 兼容保留：条件树编辑器（供 FilterGroupNode 组合使用）。
 * 新功能请使用 TaskViewEditor。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Category } from '@shared/types'
import {
  createEmptyAndGroup,
  normalizeFilterNode,
  validateFilterNode,
  type FilterNode
} from '@shared/task-filter-ast'
import { useViewStore } from '@/stores/view-store'
import FilterGroupNode from './FilterGroupNode.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    mode?: 'create' | 'edit'
    viewId?: string | null
    initialName?: string
    initialRule?: FilterNode | null
    categories: Category[]
  }>(),
  {
    mode: 'create',
    viewId: null,
    initialName: '',
    initialRule: null
  }
)

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
}>()

const viewStore = useViewStore()
const name = ref('')
const root = ref<FilterNode>(createEmptyAndGroup())
const saving = ref(false)
const previewCount = ref(0)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const dialogTitle = computed(() => (props.mode === 'edit' ? '编辑视图规则' : '新建视图规则'))

const validationError = computed(() => validateFilterNode(root.value))

const canSave = computed(() => Boolean(name.value.trim()) && !saving.value && !validationError.value)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    name.value = props.initialName || ''
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
  saving.value = true
  try {
    if (props.mode === 'edit' && props.viewId) {
      await viewStore.update(props.viewId, { name: trimmed, filterRule: rule })
      ElMessage.success('视图已更新')
    } else {
      await viewStore.create({ name: trimmed, layout: 'list', filterRule: rule })
      ElMessage.success('视图已创建')
    }
    emit('saved')
    emit('update:visible', false)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="dialogTitle"
    width="720px"
    destroy-on-close
    class="filter-rule-editor"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="名称" required>
        <el-input v-model="name" maxlength="64" placeholder="视图名称" />
      </el-form-item>
      <el-form-item label="条件">
        <FilterGroupNode
          v-if="root.type === 'group'"
          :node="root"
          :depth="0"
          :categories="categories"
          @change="onRootChange"
        />
      </el-form-item>
      <p v-if="validationError" class="filter-rule-editor__error">{{ validationError }}</p>
      <p class="filter-rule-editor__preview">预览约匹配 {{ previewCount }} 条任务</p>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!canSave" :loading="saving" @click="onSave">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.filter-rule-editor__error {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.filter-rule-editor__preview {
  margin: 0;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
