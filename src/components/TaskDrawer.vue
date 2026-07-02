<template>
  <el-drawer
    :model-value="modelValue"
    :title="isNew ? '新建任务' : '任务详情'"
    size="560px"
    class="task-drawer"
    :append-to-body="true"
    @update:model-value="emit('update:modelValue', $event)"
    @close="onClose"
  >
    <div class="task-drawer__body">
      <el-form label-position="top" size="default" class="task-drawer__form" @submit.prevent="save">
        <section class="task-drawer__section">
          <el-form-item label="标题" required class="task-drawer__title-item">
            <el-input
              v-model="form.title"
              placeholder="要做什么？"
              size="large"
              class="task-drawer__title-input"
              @keydown.enter.prevent="save"
            />
          </el-form-item>

          <MarkdownEditor v-model="form.description" />
        </section>

        <section class="task-drawer__section">
          <h3 class="task-drawer__section-title">安排</h3>
          <div class="task-drawer__grid">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="待办" value="TODO" />
                <el-option label="进行中" value="IN_PROGRESS" />
                <el-option label="已完成" value="DONE" />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="form.categoryId" clearable placeholder="未分类" style="width: 100%">
                <el-option
                  v-for="c in categoryStore.categories"
                  :key="c.id"
                  :label="c.name"
                  :value="c.id"
                />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="截止时间">
            <DatetimeShortcutPicker v-model="dueDate" dialog-title="选择截止时间" />
          </el-form-item>
          <el-form-item label="提醒时间" :error="timeError || undefined">
            <RemindTimePicker v-model="remindDate" :due-at="dueDate" />
          </el-form-item>
        </section>

        <section v-if="taskId && !isNew" class="task-drawer__section">
          <div class="task-drawer__subtasks-head">
            <h3 class="task-drawer__section-title">子任务</h3>
            <el-button size="small" text type="primary" @click="emit('new-subtask', taskId!)">
              + 添加
            </el-button>
          </div>
          <ul v-if="children.length" class="task-drawer__subtasks-list">
            <li v-for="child in children" :key="child.id">{{ child.title }}</li>
          </ul>
          <p v-else class="task-drawer__muted">暂无子任务</p>
        </section>
      </el-form>
    </div>

    <template #footer>
      <div class="task-drawer__footer">
        <el-button v-if="!isNew" type="danger" plain :disabled="saving" @click="remove">
          删除
        </el-button>
        <div class="task-drawer__footer-right">
          <el-button :disabled="saving" @click="onClose">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Task, TaskStatus } from '@shared/types'
import { useCategoryStore } from '@/stores/category-store'
import { useTaskStore } from '@/stores/task-store'
import { unwrapIpc } from '@/ipc/client'
import { assertRemindBeforeDue, toIso } from '@/utils/datetime'
import DatetimeShortcutPicker from '@/components/DatetimeShortcutPicker.vue'
import RemindTimePicker from '@/components/RemindTimePicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'

export interface TaskSavePayload {
  task: Task | null
}

const props = defineProps<{
  modelValue: boolean
  taskId: string | null
  parentIdForCreate?: string | null
  /** 侧栏当前选中的分类，新建时预填 */
  defaultCategoryId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: [TaskSavePayload]
  'new-subtask': [string]
}>()

const categoryStore = useCategoryStore()
const taskStore = useTaskStore()

const isNew = computed(() => props.modelValue && props.taskId === null)

const form = reactive({
  title: '',
  description: '',
  status: 'TODO' as TaskStatus,
  categoryId: null as string | null
})

const dueDate = ref<string | null>(null)
const remindDate = ref<string | null>(null)
const timeError = ref<string | null>(null)
const saving = ref(false)

const children = computed(() =>
  props.taskId ? taskStore.tasks.filter((t) => t.parentId === props.taskId) : []
)

function resetForCreate() {
  form.title = ''
  form.description = ''
  form.status = 'TODO'
  form.categoryId = props.defaultCategoryId ?? null
  dueDate.value = null
  remindDate.value = null
}

watch(
  () => [props.modelValue, props.taskId, props.defaultCategoryId] as const,
  async ([open, id]) => {
    if (!open) return
    timeError.value = null
    if (id === null) {
      resetForCreate()
      return
    }
    const task = await unwrapIpc(await window.api.tasks.get(id))
    form.title = task.title
    form.description = task.description ?? ''
    form.status = task.status
    form.categoryId = task.categoryId
    dueDate.value = task.dueAt
    remindDate.value = task.remindAt
  }
)

watch([dueDate, remindDate], () => {
  timeError.value = assertRemindBeforeDue(remindDate.value, dueDate.value)
})

function onClose() {
  emit('update:modelValue', false)
}

function buildPayload() {
  const dueAt = toIso(dueDate.value)
  const remindAt = toIso(remindDate.value)
  const err = assertRemindBeforeDue(remindAt, dueAt)
  if (err) {
    timeError.value = err
    ElMessage.warning(err)
    return null
  }
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    status: form.status,
    categoryId: form.categoryId,
    dueAt,
    remindAt
  }
}

async function save() {
  if (saving.value) return

  const title = form.title.trim()
  if (!title) {
    ElMessage.warning('请填写任务标题')
    return
  }

  const payload = buildPayload()
  if (!payload) return

  saving.value = true
  try {
    let savedTask: Task | null = null
    if (isNew.value) {
      savedTask = await unwrapIpc(
        await window.api.tasks.create({
          ...payload,
          parentId: props.parentIdForCreate ?? null
        })
      )
    } else if (props.taskId) {
      savedTask = await unwrapIpc(await window.api.tasks.update(props.taskId, payload))
    } else {
      ElMessage.error('无法保存：任务状态异常，请关闭后重试')
      return
    }

    emit('saved', { task: savedTask })
    emit('update:modelValue', false)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.taskId || saving.value) return
  saving.value = true
  try {
    await unwrapIpc(await window.api.tasks.delete(props.taskId))
    emit('saved', { task: null })
    emit('update:modelValue', false)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.task-drawer__body {
  padding: 0 2px;
}

.task-drawer__form {
  :deep(.el-form-item__label) {
    font-size: 12px;
    font-weight: 600;
    color: var(--desktop-muted);
    padding-bottom: 4px;
  }
}

.task-drawer__section {
  margin-bottom: 20px;
  padding: 14px 14px 6px;
  background: var(--desktop-bg);
  border-radius: 10px;
  border: 1px solid var(--desktop-border);
}

.task-drawer__section-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--desktop-text);
}

.task-drawer__title-item {
  margin-bottom: 12px;

  :deep(.el-form-item__label) {
    display: none;
  }
}

.task-drawer__title-input :deep(.el-input__inner) {
  font-size: 18px;
  font-weight: 600;
  border: none;
  box-shadow: none;
  padding-left: 0;
  background: transparent;
}

.task-drawer__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-drawer__subtasks-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  .task-drawer__section-title {
    margin: 0;
  }
}

.task-drawer__subtasks-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
}

.task-drawer__muted {
  font-size: 12px;
  color: var(--desktop-muted);
  margin: 0;
}

.task-drawer__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.task-drawer__footer-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>

<style lang="scss">
.task-drawer {
  .el-drawer__header {
    margin-bottom: 0;
    padding: 16px 20px 12px;
    font-size: 15px;
    font-weight: 600;
  }

  .el-drawer__body {
    padding: 8px 16px 16px;
    overflow: auto;
  }

  .el-drawer__footer {
    padding: 12px 16px;
    border-top: 1px solid var(--desktop-border);
  }
}

</style>
