<template>

  <component
    :is="variant === 'dialog' ? 'div' : 'aside'"
    v-if="visible"
    class="task-panel"
    :class="{
      'is-panel-expanded': panelExpanded,
      'is-content-focus': contentExpanded,
      'task-panel--dialog': variant === 'dialog'
    }"
    @click.stop
  >

    <header class="task-panel__header">

      <el-button text class="task-panel__expand" :title="panelExpanded ? '恢复面板宽度' : '放大详情面板'" @click="panelExpanded = !panelExpanded">

        <el-icon><component :is="panelExpanded ? ScaleToOriginal : FullScreen" /></el-icon>

      </el-button>

      <span class="task-panel__header-spacer" />

      <TaskPriorityFlagMenu v-model="form.priority" class="task-panel__header-priority" />

      <el-button text class="task-panel__close" @click="onClose">

        <el-icon><Close /></el-icon>

      </el-button>

    </header>

    <div v-if="!isNew" class="task-panel__tabs">
      <button
        type="button"
        class="task-panel__tab"
        :class="{ 'is-active': activeTab === 'detail' }"
        @click="activeTab = 'detail'"
      >
        详情
      </button>
      <button
        type="button"
        class="task-panel__tab"
        :class="{ 'is-active': activeTab === 'activity' }"
        @click="activeTab = 'activity'"
      >
        动态
      </button>
    </div>

    <div v-show="activeTab === 'detail'" class="task-panel__body">

      <el-form label-position="top" size="default" class="task-panel__form" @submit.prevent="save">

        <!-- 标题 + 正文：贴近 TickTick 单页编辑体验 -->

        <section class="task-panel__editor">

          <input

            v-model="form.title"

            class="task-panel__title"

            placeholder="任务标题"

            @keydown.enter.prevent="save"

          />



          <!-- 清单 / 优先级：轻量元信息行 -->
          <div v-show="!contentExpanded" class="task-panel__meta-row">

            <el-dropdown trigger="click" class="task-panel__category-dropdown" @command="onCategoryCommand">

              <button
                type="button"
                class="task-panel__category-pill"
                :class="{ 'is-emphasis': emphasizeCategory }"
              >

                <span class="task-panel__category-dot" :style="{ background: categoryColor }" />

                <span class="task-panel__category-name">{{ categoryLabel }}</span>

                <span class="task-panel__category-chevron">▾</span>

              </button>

              <template #dropdown>

                <el-dropdown-menu>

                  <el-dropdown-item :command="null">未分类</el-dropdown-item>

                  <el-dropdown-item
                    v-for="c in categoryStore.categories"
                    :key="c.id"
                    :command="c.id"
                  >

                    <span class="task-panel__category-option">

                      <span class="task-panel__category-dot" :style="{ background: c.color ?? '#909399' }" />

                      {{ c.name }}

                    </span>

                  </el-dropdown-item>

                </el-dropdown-menu>

              </template>

            </el-dropdown>

            <TaskTagEditor v-model="form.tags" class="task-panel__tag-editor" />

          </div>



          <TaskBodyEditor
            ref="bodyEditorRef"
            v-model="form.description"
            v-model:category-id="form.categoryId"
            v-model:content-expanded="contentExpanded"
            :categories="categoryStore.categories"
            :hide-category-in-bar="true"
            @add-subtask="focusSubtaskInput"
          />

        </section>



        <!-- 安排：可折叠，默认收起减少干扰 -->

        <section v-show="!contentExpanded" class="task-panel__section task-panel__section--collapse">

          <button type="button" class="task-panel__collapse-head" @click="scheduleOpen = !scheduleOpen">

            <span>安排</span>

            <el-icon :class="{ 'is-open': scheduleOpen }"><ArrowDown /></el-icon>

          </button>

          <div v-show="scheduleOpen" class="task-panel__collapse-body">

            <el-form-item label="截止时间" :error="timeError || undefined">

              <DatetimeShortcutPicker v-model="dueDate" dialog-title="选择截止时间" />

            </el-form-item>

            <el-form-item label="提醒" :error="timeError || undefined">

              <RemindMultiPicker v-model="remindPicker" :due-at="dueDate" />

            </el-form-item>

            <el-form-item v-if="dueDate" label="重复">

              <TaskRecurrencePicker v-model="recurrenceRule" :due-at="dueDate" />

            </el-form-item>

          </div>

        </section>



        <section v-show="!contentExpanded" class="task-panel__section">

          <h3 class="task-panel__section-title">子任务</h3>

          <ul v-if="displaySubtasks.length" class="task-panel__subtasks-list">

            <li v-for="item in displaySubtasks" :key="item.key" class="task-panel__subtask-row">

              <el-checkbox

                v-if="!item.isDraft"

                :model-value="item.status === 'DONE'"

                @change="() => toggleChildStatus(item)"

              />

              <span v-else class="task-panel__subtask-dot" />

              <span

                class="task-panel__subtask-title"

                :class="{ 'is-done': item.status === 'DONE' }"

              >

                {{ item.title }}

              </span>

              <el-tag v-if="item.isDraft" size="small" type="info">待保存</el-tag>

              <button
                type="button"
                class="task-panel__subtask-remove"
                title="删除子任务"
                @click="removeSubtask(item)"
              >
                <el-icon><Close /></el-icon>
              </button>

            </li>

          </ul>

          <div class="task-panel__subtask-add">

            <el-input

              ref="subtaskInputRef"

              v-model="newSubtaskTitle"

              placeholder="添加子任务，回车确认"

              @keydown.enter.prevent="addSubtaskInline"

            />

            <el-button type="primary" plain @click="addSubtaskInline">添加</el-button>

          </div>

        </section>

      </el-form>

    </div>

    <div v-show="activeTab === 'activity' && !isNew" class="task-panel__body task-panel__body--activity">
      <TaskActivityList ref="activityListRef" :task-id="props.taskId" />
    </div>



    <footer v-show="activeTab === 'detail'" class="task-panel__footer">

      <el-button v-if="!isNew" type="danger" plain :disabled="saving" @click="remove">

        删除

      </el-button>

      <div class="task-panel__footer-right">

        <el-button :disabled="saving" @click="onClose">取消</el-button>

        <el-button type="primary" native-type="button" :loading="saving" @click="save">保存</el-button>

      </div>

    </footer>

  </component>

</template>



<script setup lang="ts">

import { computed, reactive, ref, watch } from 'vue'

import { ArrowDown, Close, FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'

import type { InputInstance } from 'element-plus'

import { ElMessage, ElMessageBox } from 'element-plus'

import type { Task, TaskStatus } from '@shared/types'

import { DEFAULT_TASK_PRIORITY, type TaskPriority } from '@shared/task-priority'

import { useCategoryStore } from '@/stores/category-store'

import { useTaskStore } from '@/stores/task-store'

import { unwrapIpc } from '@/ipc/client'

import { assertRemindersBeforeDue, buildRemindersFromOffsets } from '@shared/task-reminder'
import type { TaskRecurrenceRule } from '@shared/task-reminder'
import { toPlainCreateTaskDto, toPlainUpdateTaskDto } from '@shared/task-write-dto'
import { toIso } from '@/utils/datetime'

import DatetimeShortcutPicker from '@/components/DatetimeShortcutPicker.vue'

import RemindMultiPicker, { type RemindMultiPickerValue } from '@/components/RemindMultiPicker.vue'

import TaskRecurrencePicker from '@/components/TaskRecurrencePicker.vue'

import TaskBodyEditor from '@/components/TaskBodyEditor.vue'

import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'
import TaskTagEditor from '@/components/TaskTagEditor.vue'
import TaskActivityList from '@/components/TaskActivityList.vue'
import { useTagStore } from '@/stores/tag-store'



export interface TaskSavePayload {

  task: Task | null

  mode: 'create' | 'update' | 'delete'

}



const props = withDefaults(
  defineProps<{
  visible: boolean
  taskId: string | null
  defaultCategoryId?: string | null
  defaultPriority?: TaskPriority
  emphasizeCategory?: boolean
  variant?: 'sidebar' | 'dialog'
}>(),
  { variant: 'sidebar' }
)



const emit = defineEmits<{

  close: []

  saved: [TaskSavePayload]

  'panel-expanded-change': [boolean]

}>()



const categoryStore = useCategoryStore()

const taskStore = useTaskStore()

const tagStore = useTagStore()



const isNew = computed(() => props.visible && props.taskId === null)

const emphasizeCategory = computed(() => Boolean(props.emphasizeCategory))

const categoryLabel = computed(() => {
  if (!form.categoryId) return '未分类'
  return categoryStore.categories.find((c) => c.id === form.categoryId)?.name ?? '未分类'
})

const categoryColor = computed(() => {
  if (!form.categoryId) return '#c0c4cc'
  return categoryStore.categories.find((c) => c.id === form.categoryId)?.color ?? '#909399'
})

function onCategoryCommand(id: string | null) {
  form.categoryId = id
}



const form = reactive({

  title: '',

  description: '',

  status: 'TODO' as TaskStatus,

  priority: DEFAULT_TASK_PRIORITY as TaskPriority,

  categoryId: null as string | null,

  tags: [] as string[]

})



const dueDate = ref<string | null>(null)

const remindPicker = ref<RemindMultiPickerValue>({ reminders: [], continuous: false })

const recurrenceRule = ref<TaskRecurrenceRule | null>(null)

const timeError = ref<string | null>(null)

const saving = ref(false)

const scheduleOpen = ref(false)

const panelExpanded = ref(false)

const contentExpanded = ref(false)

const bodyEditorRef = ref<InstanceType<typeof TaskBodyEditor> | null>(null)

const draftSubtasks = ref<string[]>([])

const newSubtaskTitle = ref('')

const subtaskInputRef = ref<InputInstance>()

const activeTab = ref<'detail' | 'activity'>('detail')

const activityListRef = ref<InstanceType<typeof TaskActivityList> | null>(null)



const childTasks = ref<Task[]>([])

/** 按 parentId 单独拉子任务，不依赖列表筛选（四象限曾用 parentId:null 会导致子任务不在 store） */
async function refreshChildTasks() {
  if (!props.taskId) {
    childTasks.value = []
    return
  }
  childTasks.value = unwrapIpc(
    await window.api.tasks.list({ parentId: props.taskId })
  )
}

const savedChildren = computed(() => childTasks.value)

const displaySubtasks = computed(() => {
  const drafts = draftSubtasks.value.map((title, index) => ({
    key: `draft-${index}`,
    title,
    isDraft: true as const,
    draftIndex: index,
    status: undefined as TaskStatus | undefined
  }))
  const saved = savedChildren.value.map((task) => ({
    key: task.id,
    title: task.title,
    isDraft: false as const,
    status: task.status,
    id: task.id
  }))
  return [...saved, ...drafts]
})



function resetForCreate() {

  form.title = ''

  form.description = ''

  form.status = 'TODO'

  form.priority = props.defaultPriority ?? DEFAULT_TASK_PRIORITY

  form.categoryId = props.defaultCategoryId ?? null

  form.tags = []

  dueDate.value = null

  remindPicker.value = { reminders: [], continuous: false }

  recurrenceRule.value = null

  draftSubtasks.value = []

  newSubtaskTitle.value = ''

  scheduleOpen.value = Boolean(props.defaultCategoryId)

}



function focusSubtaskInput() {

  subtaskInputRef.value?.focus()

}



watch(panelExpanded, (v) => emit('panel-expanded-change', v))



watch(

  () => props.visible,

  (open) => {

    if (!open) {

      panelExpanded.value = false

      contentExpanded.value = false
      activeTab.value = 'detail'

    }

  }

)



watch(

  () => [props.visible, props.taskId, props.defaultCategoryId, props.defaultPriority] as const,

  async ([open, id]) => {

    if (!open) return

    activeTab.value = 'detail'
    timeError.value = null

    draftSubtasks.value = []

    newSubtaskTitle.value = ''

    if (id === null || id === undefined || id === '') {

      resetForCreate()

      childTasks.value = []

      return

    }

    const task = await unwrapIpc(await window.api.tasks.get(id))

    form.title = task.title

    form.description = task.description ?? ''

    form.status = task.status

    form.priority = task.priority

    form.categoryId = task.categoryId

    form.tags = [...(task.tags ?? [])]

    dueDate.value = task.dueAt

    remindPicker.value = {
      reminders: (task.reminders ?? []).map((r) => ({
        remindAt: r.remindAt,
        offsetMinutes: r.offsetMinutes
      })),
      continuous: task.remindContinuous ?? false
    }

    recurrenceRule.value = task.recurrence ?? null

    scheduleOpen.value = Boolean(
      task.dueAt || remindPicker.value.reminders.length || task.recurrence
    )

    await refreshChildTasks()

  },

  { immediate: true }

)



watch(dueDate, (due, prev) => {
  if (due === prev) return
  const dueAt = toIso(due)
  if (dueAt && remindPicker.value.reminders.some((r) => r.offsetMinutes != null)) {
    const offsets = remindPicker.value.reminders
      .map((r) => r.offsetMinutes)
      .filter((m): m is number => m != null)
    remindPicker.value = {
      ...remindPicker.value,
      reminders: buildRemindersFromOffsets(dueAt, offsets)
    }
  }
})

watch([dueDate, remindPicker], () => {
  const dueAt = toIso(dueDate.value)
  const err = assertRemindersBeforeDue(remindPicker.value.reminders, dueAt)
  timeError.value = err ?? ''
}, { deep: true })



function onClose() {

  emit('close')

}



function buildPayload() {

  const dueAt = toIso(dueDate.value)

  let reminders = remindPicker.value.reminders.map((r) => ({
    remindAt: r.remindAt,
    offsetMinutes: r.offsetMinutes ?? null
  }))

  if (dueAt && reminders.some((r) => r.offsetMinutes != null)) {
    const offsets = reminders
      .map((r) => r.offsetMinutes)
      .filter((m): m is number => m != null)
    reminders = buildRemindersFromOffsets(dueAt, offsets)
  }

  const err = assertRemindersBeforeDue(reminders, dueAt)

  if (err) {

    timeError.value = err
    scheduleOpen.value = true

    ElMessage.warning(err)

    return null

  }

  if (recurrenceRule.value && !dueAt) {
    const recurrenceErr = '设置重复规则需要先设置截止时间'
    timeError.value = recurrenceErr
    scheduleOpen.value = true
    ElMessage.warning(recurrenceErr)
    return null
  }

  return toPlainUpdateTaskDto({

    title: form.title.trim(),

    description: form.description.trim() || null,

    status: form.status,

    priority: form.priority,

    categoryId: form.categoryId,

    tags: form.tags,

    dueAt,

    reminders,

    recurrence: recurrenceRule.value,

    remindContinuous: remindPicker.value.continuous

  })

}



async function createDraftSubtasks(parentId: string) {

  for (const title of draftSubtasks.value) {

    const trimmed = title.trim()

    if (!trimmed) continue

    await unwrapIpc(

      await window.api.tasks.create({

        title: trimmed,

        parentId

      })

    )

  }

  draftSubtasks.value = []

}



async function addSubtaskInline() {

  const title = newSubtaskTitle.value.trim()

  if (!title) return



  if (!props.taskId) {

    draftSubtasks.value.push(title)

    newSubtaskTitle.value = ''

    return

  }



  await unwrapIpc(

    await window.api.tasks.create({

      title,

      parentId: props.taskId

    })

  )

  newSubtaskTitle.value = ''

  await refreshChildTasks()
  void taskStore.fetchWithCurrentFilter()

}



async function toggleChildStatus(item: { id?: string; status?: TaskStatus }) {

  if (!item.id || !item.status) return

  const next: TaskStatus = item.status === 'DONE' ? 'TODO' : 'DONE'

  try {

    await taskStore.update(item.id, { status: next })

    await refreshChildTasks()

  } catch {

    /* store 内 unwrapIpc 已 Toast */

  }

}



type SubtaskRow = {
  key: string
  title: string
  isDraft: boolean
  draftIndex?: number
  id?: string
  status?: TaskStatus
}

/** 删除子任务：草稿直接从数组移除；已保存项需确认后走 IPC 删除 */
async function removeSubtask(item: SubtaskRow) {
  if (item.isDraft) {
    if (item.draftIndex === undefined) return
    draftSubtasks.value.splice(item.draftIndex, 1)
    return
  }
  if (!item.id) return
  try {
    await ElMessageBox.confirm(`确定删除子任务「${item.title}」？`, '删除子任务', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await taskStore.remove(item.id)
    await refreshChildTasks()
    ElMessage.success('子任务已删除')
  } catch {
    /* store 内 unwrapIpc 已 Toast */
  }
}



async function save() {

  if (saving.value) return

  saving.value = true

  try {

    bodyEditorRef.value?.flushWysiwygToMarkdown()

    const title = form.title.trim()

    if (!title) {

      ElMessage.warning('请填写任务标题')

      return

    }

    const payload = buildPayload()

    if (!payload) {
      scheduleOpen.value = true
      return
    }

    let savedTask: Task | null = null

    if (isNew.value) {

      savedTask = unwrapIpc(await window.api.tasks.create(toPlainCreateTaskDto(payload)))

      await createDraftSubtasks(savedTask.id)

    } else if (props.taskId) {

      savedTask = unwrapIpc(await window.api.tasks.update(props.taskId, payload))

    } else {

      ElMessage.error('无法保存：任务状态异常，请关闭后重试')

      return

    }

    emit('saved', { task: savedTask, mode: isNew.value ? 'create' : 'update' })
    if (form.tags.length) {
      tagStore.remember(form.tags)
    }
    if (!isNew.value) {
      activityListRef.value?.reload()
    }

  } catch (err) {

    reportTaskSaveError(err)

  } finally {

    saving.value = false

  }

}



function reportTaskSaveError(err: unknown) {

  if (err instanceof Error && /^[A-Z_]+$/.test(err.message)) {

    return

  }

  const message = err instanceof Error ? err.message : '保存失败'

  if (/could not be cloned|No handler registered/i.test(message)) {

    ElMessage.error('保存失败：请完全退出应用后重新启动再试')

    return

  }

  ElMessage.error(message || '保存失败')

}



async function remove() {

  if (!props.taskId || saving.value) return

  const childCount = savedChildren.value.length
  const title = form.title.trim() || '未命名'

  try {
    if (childCount > 0) {
      await ElMessageBox.confirm(
        `任务「${title}」下有 ${childCount} 个子任务。\n确定删除该任务并一并删除所有子任务吗？`,
        '删除任务',
        {
          type: 'warning',
          confirmButtonText: '一并删除',
          cancelButtonText: '取消'
        }
      )
    } else {
      await ElMessageBox.confirm(`确定删除任务「${title}」？`, '删除任务', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      })
    }
  } catch {
    return
  }

  saving.value = true

  try {

    await taskStore.remove(props.taskId, { cascadeChildren: childCount > 0 })

    emit('saved', { task: null, mode: 'delete' })

    emit('close')

  } catch {

    /* unwrapIpc 已 Toast */

  } finally {

    saving.value = false

  }

}

</script>



<style scoped lang="scss">

.task-panel {

  width: min(400px, 92vw);

  flex-shrink: 0;

  display: flex;

  flex-direction: column;

  background: var(--desktop-panel);

  border-left: 1px solid var(--desktop-border);

  transition: width 0.2s ease;

  &--dialog {
    width: 100%;
    max-width: none;
    border-left: none;
    min-height: 60vh;
  }

  &.is-panel-expanded {

    width: min(720px, 62vw);

  }



  &.is-content-focus {

    .task-panel__body {

      display: flex;

      flex-direction: column;

    }



    .task-panel__editor {

      flex: 1;

      display: flex;

      flex-direction: column;

      min-height: 0;

    }

  }

}



.task-panel__header {

  display: flex;

  align-items: center;

  justify-content: flex-end;

  padding: 8px 8px 0;

  gap: 4px;

}

.task-panel__tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--desktop-border);
}

.task-panel__tab {
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--desktop-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;

  &.is-active {
    color: var(--el-color-primary);
    border-bottom-color: var(--el-color-primary);
    font-weight: 600;
  }
}

.task-panel__body--activity {
  padding-top: 8px;
}



.task-panel__expand {

  color: var(--desktop-muted);



  &:hover {

    color: var(--el-color-primary);

  }

}



.task-panel__header-spacer {

  flex: 1;

}



.task-panel__close {

  color: var(--desktop-muted);

}



.task-panel__body {

  flex: 1;

  overflow: auto;

  padding: 0 16px 16px;

}



.task-panel__form {

  :deep(.el-form-item__label) {

    font-size: 12px;

    font-weight: 600;

    color: var(--desktop-muted);

    padding-bottom: 4px;

  }

}



.task-panel__editor {

  padding: 4px 0 8px;

  min-width: 0;

  width: 100%;

}



.task-panel__title {

  display: block;

  width: 100%;

  border: none;

  outline: none;

  background: transparent;

  font-size: 22px;

  font-weight: 700;

  line-height: 1.35;

  color: var(--desktop-text);

  padding: 8px 0 12px;

  font-family: inherit;



  &::placeholder {

    color: var(--desktop-muted);

    font-weight: 500;

  }

}



.task-panel__section {

  margin-bottom: 14px;

  padding: 12px 14px;

  background: var(--desktop-bg);

  border-radius: 10px;

  border: 1px solid var(--desktop-border);



  &--collapse {

    padding: 0;

    overflow: hidden;

  }

}



.task-panel__collapse-head {

  display: flex;

  align-items: center;

  justify-content: space-between;

  width: 100%;

  padding: 12px 14px;

  border: none;

  background: transparent;

  font-size: 13px;

  font-weight: 600;

  cursor: pointer;

  color: var(--desktop-text);



  .el-icon {

    transition: transform 0.2s;

    color: var(--desktop-muted);



    &.is-open {

      transform: rotate(180deg);

    }

  }

}



.task-panel__collapse-body {

  padding: 0 14px 14px;

  border-top: 1px solid var(--desktop-border);

}

.task-panel__meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 2px 12px;
  flex-wrap: wrap;
}

.task-panel__category-dropdown {
  flex: 0 1 auto;
  min-width: 120px;
  max-width: 45%;
}

.task-panel__tag-editor {
  flex: 1 1 160px;
  min-width: 0;
}

.task-panel__category-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  background: var(--desktop-bg);
  font-size: 13px;
  color: var(--desktop-text);
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-5);
  }

  &.is-emphasis {
    padding: 8px 12px;
    border-color: var(--el-color-primary-light-7);
    background: color-mix(in srgb, var(--el-color-primary) 6%, var(--desktop-bg));
    font-size: 14px;
    font-weight: 600;
  }
}

.task-panel__category-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-panel__category-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.task-panel__category-chevron {
  font-size: 10px;
  color: var(--desktop-muted);
  flex-shrink: 0;
}

.task-panel__category-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.task-panel__header-priority {
  flex-shrink: 0;
}

.task-panel__section-title {

  margin: 0 0 12px;

  font-size: 13px;

  font-weight: 600;

  color: var(--desktop-text);

}



.task-panel__grid {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 12px;

  margin-top: 12px;

}



.task-panel__subtasks-list {

  list-style: none;

  margin: 0 0 10px;

  padding: 0;

}



.task-panel__subtask-row {

  display: flex;

  align-items: center;

  gap: 8px;

  padding: 6px 0;

  font-size: 13px;

}



.task-panel__subtask-dot {

  width: 14px;

  height: 14px;

  border: 1px dashed var(--desktop-border);

  border-radius: 50%;

  flex-shrink: 0;

}



.task-panel__subtask-title {

  flex: 1;

  min-width: 0;



  &.is-done {

    text-decoration: line-through;

    color: var(--desktop-muted);

  }

}



.task-panel__subtask-remove {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  width: 24px;

  height: 24px;

  border: none;

  border-radius: 6px;

  background: transparent;

  color: var(--desktop-muted);

  cursor: pointer;

  flex-shrink: 0;



  &:hover {

    background: var(--desktop-hover);

    color: var(--el-color-danger);

  }

}



.task-panel__subtask-add {

  display: flex;

  gap: 8px;

}



.task-panel__footer {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 12px 16px;

  border-top: 1px solid var(--desktop-border);

}



.task-panel__footer-right {

  display: flex;

  gap: 8px;

  margin-left: auto;

}

</style>


