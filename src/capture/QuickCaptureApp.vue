<template>
  <div class="quick-capture">
    <form class="quick-capture__shell" @submit.prevent="onSubmit">
      <div class="quick-capture__bar">
        <el-icon class="quick-capture__plus" aria-hidden="true"><Plus /></el-icon>
        <QuickAddInput
          ref="inputRef"
          v-model="text"
          :categories="categories"
          placeholder="输入任务，回车保存到收件箱…"
          @enter="onSubmit"
          @escape="onEscape"
        />
        <TaskPriorityFlagMenu v-model="priority" class="quick-capture__priority" />
      </div>
      <p v-if="status" class="quick-capture__status" :class="{ 'is-error': statusError }">{{ status }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { buildQuickCreateTaskDto, toParseCategories } from '@shared/quick-create-task'
import type { AiParseCategoryRef } from '@shared/ai-task-parser'
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from '@shared/task-priority'
import QuickAddInput from '@/components/QuickAddInput.vue'
import TaskPriorityFlagMenu from '@/components/TaskPriorityFlagMenu.vue'

const text = ref('')
const submitting = ref(false)
const status = ref('')
const statusError = ref(false)
const priority = ref<TaskPriority>(DEFAULT_TASK_PRIORITY)
const categories = ref<AiParseCategoryRef[]>([])
const inputRef = ref<InstanceType<typeof QuickAddInput> | null>(null)
let cleanupFocus: (() => void) | undefined

function focusInput() {
  inputRef.value?.focus()
}

async function loadCategories() {
  const res = await window.captureApi.categories.list()
  if (res.ok) {
    categories.value = toParseCategories(res.data)
  }
}

async function hideWindow() {
  await window.captureApi.capture.hide()
}

function onEscape() {
  text.value = ''
  status.value = ''
  priority.value = DEFAULT_TASK_PRIORITY
  void hideWindow()
}

async function onSubmit() {
  const trimmed = text.value.trim()
  if (!trimmed || submitting.value) return
  submitting.value = true
  status.value = ''
  statusError.value = false
  try {
    const dto = buildQuickCreateTaskDto(trimmed, categories.value, { triagedAt: null })
    if (!dto.title.trim()) {
      status.value = '请输入任务内容'
      statusError.value = true
      return
    }
    const res = await window.captureApi.tasks.create(dto)
    if (!res.ok) {
      status.value = res.error.message
      statusError.value = true
      return
    }
    text.value = ''
    priority.value = DEFAULT_TASK_PRIORITY
    status.value = `已保存：${res.data.title}`
    setTimeout(() => {
      void hideWindow()
    }, 180)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  cleanupFocus = window.captureApi.capture.onFocusRequest(() => {
    focusInput()
  })
  focusInput()
})

onUnmounted(() => {
  cleanupFocus?.()
})
</script>
