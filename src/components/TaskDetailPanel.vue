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

    <header v-if="!editorSection" class="task-panel__header">

      <el-button text class="task-panel__expand" :title="panelExpanded ? '恢复面板宽度' : '放大详情面板'" @click="panelExpanded = !panelExpanded">

        <el-icon><component :is="panelExpanded ? ScaleToOriginal : FullScreen" /></el-icon>

      </el-button>

      <span class="task-panel__header-spacer" />

      <TaskPriorityFlagMenu v-model="form.priority" class="task-panel__header-priority" />

      <el-button text class="task-panel__close" @click="onClose">

        <el-icon><Close /></el-icon>

      </el-button>

    </header>

    <div v-if="!isNew && !editorSection" class="task-panel__tabs">
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

    <div v-show="activeTab === 'detail' && editorSection !== 'activity'" class="task-panel__body">

      <el-form label-position="top" size="default" class="task-panel__form" @submit.prevent="save">

        <!-- 基本信息：Modal 分步用表单字段布局（贴 HTML）；侧栏详情仍用紧凑编辑器 -->
        <section v-show="showSection('basic')" class="task-panel__editor" :class="{ 'is-step-form': !!editorSection }">

          <template v-if="editorSection === 'basic'">
            <div class="task-panel__form-title">基本信息</div>

            <el-form-item required>
              <template #label>任务名称 <b class="task-panel__req">*</b></template>
              <el-input v-model="form.title" placeholder="输入任务名称" @keydown.enter.prevent="save" />
            </el-form-item>

            <div class="task-panel__grid2">
              <el-form-item label="清单">
                <el-select v-model="form.categoryId" clearable placeholder="未分类" style="width: 100%">
                  <el-option label="未分类" :value="null" />
                  <el-option
                    v-for="c in categoryStore.categories"
                    :key="c.id"
                    :label="c.name"
                    :value="c.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="状态">
                <el-select v-model="form.status" style="width: 100%">
                  <el-option label="待办" value="TODO" />
                  <el-option label="进行中" value="IN_PROGRESS" />
                  <el-option label="已完成" value="DONE" />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item label="优先级">
              <el-select v-model="form.priority" style="width: 100%">
                <el-option
                  v-for="p in priorityOptions"
                  :key="p.value"
                  :label="`${p.code} · ${p.label}`"
                  :value="p.value"
                />
              </el-select>
            </el-form-item>

            <div class="task-panel__grid2">
              <el-form-item label="截止时间" :error="timeError || undefined">
                <DatetimeShortcutPicker v-model="dueDate" dialog-title="选择截止时间" />
              </el-form-item>
              <el-form-item label="提醒" :error="timeError || undefined">
                <el-select
                  v-model="remindOffsetKey"
                  placeholder="选择提醒"
                  style="width: 100%"
                >
                  <el-option label="不提醒" value="none" />
                  <el-option label="提前 5 分钟" value="5" />
                  <el-option label="提前 10 分钟" value="10" />
                  <el-option label="提前 15 分钟" value="15" />
                  <el-option label="提前 20 分钟" value="20" />
                  <el-option label="提前 30 分钟" value="30" />
                  <el-option label="提前 1 小时" value="60" />
                  <el-option label="提前 1 天" value="1440" />
                </el-select>
                <p v-if="!dueDate" class="task-panel__inline-hint">选择提醒前请先设置截止时间</p>
                <p v-else-if="remindOffsetKey === 'multi'" class="task-panel__inline-hint">
                  当前为多条提醒，可在「提醒设置」高级区管理
                </p>
              </el-form-item>
            </div>

            <el-form-item label="标签">
              <TaskTagEditor v-model="form.tags" class="task-panel__tag-editor" />
            </el-form-item>

            <el-form-item label="描述 · Markdown">
              <TaskBodyEditor
                ref="bodyEditorRef"
                v-model="form.description"
                v-model:category-id="form.categoryId"
                v-model:content-expanded="contentExpanded"
                :categories="categoryStore.categories"
                :hide-category-in-bar="true"
                @add-subtask="focusSubtaskInput"
              />
            </el-form-item>
          </template>

          <template v-else>
            <input
              v-model="form.title"
              class="task-panel__title"
              placeholder="任务标题"
              @keydown.enter.prevent="save"
            />

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

              <TaskPriorityBadge :priority="form.priority" />

              <el-select
                v-model="form.status"
                size="small"
                class="task-panel__status-select"
                placeholder="状态"
              >
                <el-option label="待办" value="TODO" />
                <el-option label="进行中" value="IN_PROGRESS" />
                <el-option label="已完成" value="DONE" />
              </el-select>

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
          </template>

        </section>



        <!-- 安排 / 提醒 -->
        <section
          v-show="!contentExpanded && showSection('remind')"
          class="task-panel__section"
          :class="{ 'task-panel__section--collapse': !editorSection, 'is-step-form': !!editorSection }"
        >

          <div v-if="editorSection === 'remind'" class="task-panel__form-title">提醒设置</div>

          <button
            v-if="!editorSection"
            type="button"
            class="task-panel__collapse-head"
            @click="scheduleOpen = !scheduleOpen"
          >
            <span>安排</span>
            <el-icon :class="{ 'is-open': scheduleOpen }"><ArrowDown /></el-icon>
          </button>

          <div v-show="editorSection === 'remind' || scheduleOpen" class="task-panel__collapse-body">

            <el-form-item v-if="!editorSection" label="截止时间" :error="timeError || undefined">
              <DatetimeShortcutPicker v-model="dueDate" dialog-title="选择截止时间" />
            </el-form-item>

            <!-- 编辑器提醒步：连续/重复/方式；提前量已在基本信息与截止并列 -->
            <template v-if="editorSection === 'remind'">
              <el-form-item label="提醒提前量">
                <p class="task-panel__inline-hint">
                  已在「基本信息」与截止时间一并设置；此处可继续配置方式与重复。
                </p>
              </el-form-item>

              <el-form-item label="提醒方式">
                <div class="task-panel__chips" role="group" aria-label="提醒方式">
                  <button
                    type="button"
                    class="task-panel__chip"
                    :class="{ 'is-active': remindChannels.includes('desktop') }"
                    @click="toggleRemindChannel('desktop')"
                  >
                    桌面通知
                  </button>
                  <button
                    type="button"
                    class="task-panel__chip"
                    :class="{ 'is-active': remindChannels.includes('inapp') }"
                    @click="toggleRemindChannel('inapp')"
                  >
                    应用内
                  </button>
                  <el-button size="small" @click="onAddRemindChannel">+ 添加方式</el-button>
                </div>
              </el-form-item>

              <el-form-item label="连续提醒">
                <div class="task-panel__inline-row">
                  <el-switch v-model="remindPicker.continuous" />
                  <span class="task-panel__inline-hint">直到任务完成前持续提醒</span>
                </div>
              </el-form-item>

              <el-form-item label="重复规则">
                <div class="task-panel__repeat-box">
                  <div class="task-panel__repeat-row">
                    <el-select v-model="repeatTypeKey" style="flex: 1">
                      <el-option label="不重复" value="none" />
                      <el-option label="每天" value="daily" />
                      <el-option label="每周" value="weekly" />
                      <el-option label="每月" value="monthly" />
                      <el-option label="工作日" value="workdays" />
                      <el-option label="自定义" value="custom" />
                    </el-select>
                    <el-input-number
                      v-if="repeatTypeKey !== 'none' && repeatTypeKey !== 'workdays'"
                      v-model="repeatEvery"
                      :min="1"
                      :max="99"
                      controls-position="right"
                      style="width: 100px"
                    />
                    <span v-if="repeatTypeKey !== 'none' && repeatTypeKey !== 'workdays'" class="task-panel__inline-hint">
                      周期
                    </span>
                  </div>
                  <div v-if="repeatTypeKey === 'weekly'" class="task-panel__weekday">
                    <span class="task-panel__inline-hint">重复于</span>
                    <button
                      v-for="d in weekdayOptions"
                      :key="d.value"
                      type="button"
                      class="task-panel__weekday-btn"
                      :class="{ 'is-active': repeatWeekdays.includes(d.value) }"
                      @click="toggleRepeatWeekday(d.value)"
                    >
                      {{ d.label }}
                    </button>
                  </div>
                  <div v-if="repeatTypeKey !== 'none'" class="task-panel__repeat-row">
                    <span class="task-panel__inline-hint">结束</span>
                    <el-select v-model="repeatEndKey" style="width: 160px">
                      <el-option label="永不" value="never" />
                      <el-option label="随任务截止" value="due" />
                    </el-select>
                  </div>
                </div>
              </el-form-item>

              <div class="task-panel__advanced-remind">
                <el-button text type="primary" @click="showAdvancedRemind = !showAdvancedRemind">
                  {{ showAdvancedRemind ? '收起高级多提醒' : '高级：多提醒' }}
                </el-button>
                <RemindMultiPicker
                  v-if="showAdvancedRemind"
                  v-model="remindPicker"
                  :due-at="dueDate"
                />
              </div>
            </template>

            <!-- 非编辑器（侧栏面板）：保留原安排区 -->
            <template v-else>
              <el-form-item label="提醒" :error="timeError || undefined">
                <RemindMultiPicker v-model="remindPicker" :due-at="dueDate" />
              </el-form-item>

              <el-form-item label="连续提醒">
                <div class="task-panel__inline-row">
                  <el-switch v-model="remindPicker.continuous" />
                  <span class="task-panel__inline-hint">直到任务完成前持续提醒</span>
                </div>
              </el-form-item>

              <el-form-item v-if="dueDate" label="重复规则">
                <TaskRecurrencePicker v-model="recurrenceRule" :due-at="dueDate" />
              </el-form-item>
            </template>

          </div>

        </section>



        <section
          v-show="!contentExpanded && showSection('subtasks')"
          class="task-panel__section"
          :class="{ 'is-step-form': !!editorSection }"
        >

          <div v-if="editorSection === 'subtasks'" class="task-panel__form-title">子任务</div>
          <h3 v-else class="task-panel__section-title">子任务</h3>

          <el-form-item v-if="editorSection === 'subtasks'" label="拆解执行步骤" />

          <div v-if="subtaskProgress" class="task-panel__progress">
            <div class="task-panel__progress-bar">
              <div
                class="task-panel__progress-fill"
                :style="{ width: `${subtaskProgress.percent}%` }"
              />
            </div>
            <span class="task-panel__progress-text">
              {{ subtaskProgress.percent }}% · {{ subtaskProgress.done }}/{{ subtaskProgress.total }} 已完成
            </span>
          </div>

          <ul v-if="displaySubtasks.length" class="task-panel__subtasks-list">
            <li v-for="item in displaySubtasks" :key="item.key" class="task-panel__subtask-row">
              <TaskStatusCheckbox
                v-if="!item.isDraft && item.status"
                :status="item.status"
                @toggle="toggleChildStatus(item)"
              />
              <span v-else class="task-panel__subtask-dot" />
              <span class="task-panel__subtask-title" :class="{ 'is-done': item.status === 'DONE' }">
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
              :placeholder="editorSection ? '输入子任务，回车添加' : '添加子任务，回车确认'"
              @keydown.enter.prevent="addSubtaskInline"
            />
            <el-button :type="editorSection ? 'default' : 'primary'" :plain="!editorSection" @click="addSubtaskInline">
              添加
            </el-button>
          </div>

        </section>

        <!-- 附件步：复用描述内附件能力 -->
        <section v-show="showSection('attach')" class="task-panel__section is-step-form">
          <div class="task-panel__form-title">附件</div>
          <el-form-item label="任务附件">
            <el-button @click="onPickAttachment">+ 添加附件</el-button>
          </el-form-item>
          <TaskAttachmentList
            v-if="editorAttachments.length"
            :attachments="editorAttachments"
            @open="onOpenAttachment"
            @download="onDownloadAttachment"
            @remove="onRemoveAttachment"
          />
          <p v-else class="task-panel__attach-hint">
            支持文档、图片等常用附件；附件会写入任务描述并随保存持久化。
          </p>
          <!-- 隐藏挂载 BodyEditor，保证附件与描述同源 -->
          <div class="task-panel__hidden-editor">
            <TaskBodyEditor
              v-if="editorSection === 'attach'"
              ref="bodyEditorRef"
              v-model="form.description"
              v-model:category-id="form.categoryId"
              v-model:content-expanded="contentExpanded"
              :categories="categoryStore.categories"
              :hide-category-in-bar="true"
            />
          </div>
        </section>

      </el-form>

    </div>

    <div
      v-show="
        (activeTab === 'activity' && !isNew && !editorSection) ||
        (editorSection === 'activity' && !isNew)
      "
      class="task-panel__body task-panel__body--activity"
    >
      <div v-if="editorSection === 'activity'" class="task-panel__form-title">任务动态</div>
      <TaskActivityList ref="activityListRef" :task-id="props.taskId" />
    </div>



    <footer
      v-show="(activeTab === 'detail' || editorSection) && editorSection !== 'activity'"
      class="task-panel__footer"
    >
      <el-button v-if="!isNew && !editorSection" type="danger" link :disabled="saving" @click="remove">

        删除任务

      </el-button>

      <div class="task-panel__footer-right">

        <el-button :disabled="saving" @click="onClose">取消</el-button>

        <el-button type="primary" native-type="button" :loading="saving" @click="save">
          {{ editorSection ? '保存任务' : isNew ? '创建' : '保存' }}
        </el-button>

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
import { nextTaskStatus } from '@shared/task-status-cycle'

import { DEFAULT_TASK_PRIORITY, getTaskPriorityMeta, TASK_PRIORITIES, type TaskPriority } from '@shared/task-priority'

import { useCategoryStore } from '@/stores/category-store'

import { useTaskStore } from '@/stores/task-store'

import { unwrapIpc } from '@/ipc/client'

import { assertRemindersBeforeDue, buildRemindersFromOffsets } from '@shared/task-reminder'
import type { RecurrenceType, TaskRecurrenceRule } from '@shared/task-reminder'
import { toPlainCreateTaskDto, toPlainUpdateTaskDto } from '@shared/task-write-dto'
import { toIso } from '@/utils/datetime'

import DatetimeShortcutPicker from '@/components/DatetimeShortcutPicker.vue'

import RemindMultiPicker, { type RemindMultiPickerValue } from '@/components/RemindMultiPicker.vue'

import TaskRecurrencePicker from '@/components/TaskRecurrencePicker.vue'

import TaskBodyEditor from '@/components/TaskBodyEditor.vue'

import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'
import TaskTagEditor from '@/components/TaskTagEditor.vue'
import TaskActivityList from '@/components/TaskActivityList.vue'
import TaskStatusCheckbox from '@/components/TaskStatusCheckbox.vue'
import TaskAttachmentList from '@/components/TaskAttachmentList.vue'
import type { TaskFileAttachment } from '@shared/task-description'
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
  /**
   * 分步编辑 Modal 当前分区；有值时隐藏侧栏头/Tab，仅展示对应字段。
   * basic=基本信息 / subtasks=子任务 / remind=提醒 / attach=附件 / activity=任务动态
   */
  editorSection?: 'basic' | 'subtasks' | 'remind' | 'attach' | 'activity' | null
}>(),
  { variant: 'sidebar', editorSection: null }
)



const emit = defineEmits<{

  close: []

  saved: [TaskSavePayload]

  'panel-expanded-change': [boolean]

  /** Modal 步骤导航请求切换分区 */
  'request-section': ['basic' | 'subtasks' | 'remind' | 'attach' | 'activity']

}>()



const categoryStore = useCategoryStore()

const taskStore = useTaskStore()

const tagStore = useTagStore()



const isNew = computed(() => props.visible && props.taskId === null)

const emphasizeCategory = computed(() => Boolean(props.emphasizeCategory))

/** 无 editorSection 时展示全部；有值时仅展示对应分区（activity 单独用 activity body） */
function showSection(section: 'basic' | 'subtasks' | 'remind' | 'attach') {
  if (props.editorSection === 'activity') return false
  if (!props.editorSection) return section !== 'attach'
  return props.editorSection === section
}

function focusBasicForAttach() {
  emit('request-section', 'basic')
}

const priorityOptions = TASK_PRIORITIES

/** 触发附件列表刷新（子组件 expose 的 ref 变更不一定触发父 computed） */
const attachTick = ref(0)

const editorAttachments = computed<TaskFileAttachment[]>(() => {
  void attachTick.value
  const raw = bodyEditorRef.value?.attachments
  return (raw as TaskFileAttachment[] | undefined) ?? []
})

async function onPickAttachment() {
  await bodyEditorRef.value?.pickAttachment?.()
  attachTick.value += 1
}

function onOpenAttachment(item: TaskFileAttachment) {
  void bodyEditorRef.value?.openAttachment?.(item)
}

function onDownloadAttachment(item: TaskFileAttachment) {
  void bodyEditorRef.value?.downloadAttachment?.(item)
}

function onRemoveAttachment(index: number) {
  bodyEditorRef.value?.removeAttachment?.(index)
  attachTick.value += 1
}

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

/** 编辑器提醒步：贴设计稿的单一提前量；multi=已有多条，需走高级 */
const remindOffsetKey = ref<string>('none')
/** 提醒方式（本机 UI 偏好，尚未入库） */
const remindChannels = ref<Array<'desktop' | 'inapp'>>(['desktop', 'inapp'])
const showAdvancedRemind = ref(false)
const repeatTypeKey = ref<string>('none')
const repeatEvery = ref(1)
const repeatWeekdays = ref<number[]>([])
const repeatEndKey = ref<'never' | 'due'>('never')

const weekdayOptions = [
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
  { label: '日', value: 0 }
]

/** 基本信息提醒下拉的预设提前量（分钟） */
const REMIND_OFFSET_PRESETS = [5, 10, 15, 20, 30, 60, 1440] as const

function syncRemindOffsetKeyFromPicker() {
  const list = remindPicker.value.reminders
  if (!list.length) {
    remindOffsetKey.value = 'none'
    return
  }
  const offsets = list
    .map((r) => r.offsetMinutes)
    .filter((m): m is number => m != null)
  if (
    offsets.length === 1 &&
    (REMIND_OFFSET_PRESETS as readonly number[]).includes(offsets[0])
  ) {
    remindOffsetKey.value = String(offsets[0])
    return
  }
  if (offsets.length >= 1 || list.length > 1) {
    remindOffsetKey.value = 'multi'
    showAdvancedRemind.value = true
    return
  }
  remindOffsetKey.value = 'none'
}

function applyRemindOffsetKey(key: string) {
  if (key === 'none' || key === 'multi') {
    if (key === 'none') {
      remindPicker.value = { ...remindPicker.value, reminders: [] }
    }
    return
  }
  const minutes = Number(key)
  if (!Number.isFinite(minutes)) return
  const dueAt = toIso(dueDate.value)
  if (!dueAt) {
    ElMessage.warning('请先设置截止时间')
    remindOffsetKey.value = 'none'
    return
  }
  remindPicker.value = {
    ...remindPicker.value,
    reminders: buildRemindersFromOffsets(dueAt, [minutes])
  }
}

function toggleRemindChannel(channel: 'desktop' | 'inapp') {
  const set = new Set(remindChannels.value)
  if (set.has(channel)) {
    if (set.size <= 1) return
    set.delete(channel)
  } else {
    set.add(channel)
  }
  remindChannels.value = [...set]
}

function onAddRemindChannel() {
  ElMessage.info('更多提醒方式即将支持')
}

function syncRepeatUiFromRule(rule: TaskRecurrenceRule | null) {
  if (!rule || rule.type === 'none') {
    repeatTypeKey.value = 'none'
    repeatEvery.value = 1
    return
  }
  if (rule.type === 'custom') {
    repeatTypeKey.value = 'custom'
    repeatEvery.value = Math.max(1, rule.interval ?? 1)
    return
  }
  if (
    rule.type === 'daily' ||
    rule.type === 'weekly' ||
    rule.type === 'monthly' ||
    rule.type === 'workdays'
  ) {
    repeatTypeKey.value = rule.type
    repeatEvery.value = 1
    return
  }
  repeatTypeKey.value = 'custom'
}

function applyRepeatUiToRule() {
  const key = repeatTypeKey.value
  if (key === 'none') {
    recurrenceRule.value = null
    return
  }
  if (key === 'custom') {
    recurrenceRule.value = {
      type: 'custom',
      interval: Math.max(1, repeatEvery.value || 1),
      unit: 'day'
    }
    return
  }
  if (key === 'daily' || key === 'weekly' || key === 'monthly' || key === 'workdays') {
    recurrenceRule.value = { type: key as RecurrenceType }
    return
  }
  recurrenceRule.value = null
}

function toggleRepeatWeekday(day: number) {
  const set = new Set(repeatWeekdays.value)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  repeatWeekdays.value = [...set].sort((a, b) => a - b)
  if (repeatTypeKey.value !== 'weekly') {
    repeatTypeKey.value = 'weekly'
  }
  applyRepeatUiToRule()
}

watch(remindOffsetKey, (key, prev) => {
  if (key === prev) return
  if (key === 'multi') return
  applyRemindOffsetKey(key)
})

watch(remindPicker, () => {
  syncRemindOffsetKeyFromPicker()
}, { deep: true })

watch([repeatTypeKey, repeatEvery], () => {
  applyRepeatUiToRule()
})

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

/** 详情标题区优先级文案（与列表徽章同源） */
const priorityMeta = computed(() => getTaskPriorityMeta(form.priority))

/**
 * 子任务进度：仅统计已持久化子任务；无子任务时返回 null（不展示假进度条）。
 */
const subtaskProgress = computed(() => {
  const saved = savedChildren.value
  if (saved.length === 0) return null
  const done = saved.filter((t) => t.status === 'DONE').length
  const total = saved.length
  return {
    done,
    total,
    percent: Math.round((done / total) * 100)
  }
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

  remindOffsetKey.value = 'none'
  remindChannels.value = ['desktop', 'inapp']
  showAdvancedRemind.value = false
  repeatTypeKey.value = 'none'
  repeatEvery.value = 1
  repeatWeekdays.value = []
  repeatEndKey.value = 'never'

  draftSubtasks.value = []

  newSubtaskTitle.value = ''

  scheduleOpen.value = Boolean(props.defaultCategoryId)

}



function focusSubtaskInput() {

  subtaskInputRef.value?.focus()

}



watch(panelExpanded, (v) => emit('panel-expanded-change', v))

/** Modal 进入提醒步时展开安排区 */
watch(
  () => props.editorSection,
  (section) => {
    if (section === 'remind') scheduleOpen.value = true
  }
)



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
    syncRemindOffsetKeyFromPicker()
    syncRepeatUiFromRule(recurrenceRule.value)

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
  const next = nextTaskStatus(item.status)
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

.task-panel__status-select {
  width: 110px;
  flex: 0 0 auto;
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

.task-panel__form-title {
  font-size: 16px;
  font-weight: 650;
  margin: 0 0 18px;
  color: var(--desktop-text);
}

.task-panel__attach-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #a8abb2;
  line-height: 1.5;
}

.task-panel__grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-panel__req {
  color: #f56c6c;
  font-weight: 400;
}

.task-panel__inline-hint {
  margin-left: 10px;
  font-size: 12px;
  color: #909399;
}

.task-panel__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.task-panel__chip {
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: #606266;
  cursor: pointer;

  &.is-active {
    border-color: #a0cfff;
    background: #ecf5ff;
    color: #409eff;
  }
}

.task-panel__repeat-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-panel__repeat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.task-panel__weekday {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.task-panel__weekday-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  font-size: 12px;
  cursor: pointer;

  &.is-active {
    border-color: #409eff;
    background: #ecf5ff;
    color: #409eff;
  }
}

.task-panel__advanced-remind {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.task-panel__inline-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-panel__hidden-editor {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.task-panel__editor.is-step-form,
.task-panel__section.is-step-form {
  :deep(.el-form-item) {
    margin-bottom: 15px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    color: #606266;
  }
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

.task-panel__progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.task-panel__progress-bar {
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--desktop-primary, #1677ff) 12%, var(--desktop-bg));
  overflow: hidden;
}

.task-panel__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--desktop-primary, var(--el-color-primary));
  transition: width 0.2s ease;
}

.task-panel__progress-text {
  font-size: 12px;
  color: var(--desktop-muted);
}

.task-panel__footer {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 12px 16px;

  border-top: 1px solid var(--desktop-border);

  background: var(--desktop-panel);

  box-shadow: var(--desktop-shadow);

}



.task-panel__footer-right {

  display: flex;

  gap: 8px;

  margin-left: auto;

}

</style>


