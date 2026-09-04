<template>
  <!-- 分步编辑 Modal：820×650，复用 TaskDetailPanel 表单与 IPC 保存逻辑 -->
  <Teleport to="body">
    <div v-if="modelValue" class="task-editor-overlay" @click.self="onCancel">
      <div class="task-editor" @click.stop>
        <header class="task-editor__head">
          <strong>{{ isNew ? '新建任务' : '编辑任务' }}</strong>
          <button type="button" class="task-editor__close" aria-label="关闭" @click="onCancel">
            ×
          </button>
        </header>

        <div class="task-editor__main">
          <nav class="task-editor__steps" aria-label="编辑步骤">
            <button
              v-for="(step, index) in steps"
              :key="step.key"
              type="button"
              class="task-editor__step"
              :class="{ 'is-active': activeStep === index }"
              @click="activeStep = index"
            >
              <span class="task-editor__step-no">{{ index + 1 }}</span>
              {{ step.label }}
            </button>
          </nav>

          <div class="task-editor__form">
            <TaskDetailPanel
              :visible="modelValue"
              variant="dialog"
              :task-id="taskId"
              :default-category-id="defaultCategoryId"
              :default-priority="defaultPriority"
              :emphasize-category="emphasizeCategory"
              :editor-section="steps[activeStep]?.section ?? 'basic'"
              @close="onCancel"
              @saved="onSaved"
              @request-section="onRequestSection"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 任务新建/编辑弹窗：左侧分步导航 + 内嵌 TaskDetailPanel。
 * 编辑已有任务时额外提供「任务动态」步。
 */

import { computed, ref, watch } from 'vue'

import type { TaskPriority } from '@shared/task-priority'

import TaskDetailPanel, { type TaskSavePayload } from '@/components/TaskDetailPanel.vue'

type EditorStepSection = 'basic' | 'subtasks' | 'remind' | 'attach' | 'activity'

const props = defineProps<{
  modelValue: boolean
  taskId: string | null
  defaultCategoryId?: string | null
  defaultPriority?: TaskPriority
  emphasizeCategory?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: [TaskSavePayload]
}>()

const activeStep = ref(0)

const isNew = computed(() => props.taskId == null)

/** 新建无动态；编辑时末尾追加任务动态 */
const steps = computed(() => {
  const base: Array<{ key: string; label: string; section: EditorStepSection }> = [
    { key: 'basic', label: '基本信息', section: 'basic' },
    { key: 'subtasks', label: '子任务', section: 'subtasks' },
    { key: 'remind', label: '提醒设置', section: 'remind' },
    { key: 'attach', label: '附件', section: 'attach' }
  ]
  if (!isNew.value) {
    base.push({ key: 'activity', label: '任务动态', section: 'activity' })
  }
  return base
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) activeStep.value = 0
  }
)

function onCancel() {
  emit('update:modelValue', false)
}

function onSaved(payload: TaskSavePayload) {
  emit('saved', payload)
  emit('update:modelValue', false)
}

function onRequestSection(section: EditorStepSection) {
  const idx = steps.value.findIndex((s) => s.section === section)
  if (idx >= 0) activeStep.value = idx
}
</script>

<style scoped lang="scss">
.task-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.task-editor {
  width: 820px;
  max-width: 100%;
  height: 650px;
  max-height: calc(100vh - 48px);
  background: #fff;
  border-radius: 6px;
  box-shadow: var(--desktop-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-editor__head {
  height: 58px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #ebeef5;

  strong {
    font-size: 16px;
  }
}

.task-editor__close {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 5px;
  font-size: 20px;
  cursor: pointer;
  color: #606266;

  &:hover {
    background: #f2f3f5;
  }
}

.task-editor__main {
  flex: 1;
  min-height: 0;
  display: flex;
}

.task-editor__steps {
  width: 160px;
  flex-shrink: 0;
  background: #fafafa;
  border-right: 1px solid #ebeef5;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.task-editor__step {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 4px;
  padding: 0 10px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  text-align: left;

  &.is-active {
    background: #ecf5ff;
    color: #409eff;
    font-weight: 600;
  }
}

.task-editor__step-no {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ebeef5;
  display: grid;
  place-items: center;
  font-size: 11px;
  flex-shrink: 0;

  .is-active & {
    background: #409eff;
    color: #fff;
  }
}

.task-editor__form {
  flex: 1;
  min-width: 0;
  overflow: hidden;

  :deep(.task-panel) {
    height: 100%;
    border: none;
    box-shadow: none;
    width: 100%;
  }

  :deep(.task-panel--dialog) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :deep(.task-panel__header) {
    display: none;
  }

  :deep(.task-panel__body) {
    flex: 1;
    overflow: auto;
    padding: 20px 24px;
  }

  :deep(.task-panel__footer) {
    border-top: 1px solid #ebeef5;
    padding: 0 20px;
    height: 58px;
    align-items: center;
  }

  :deep(.task-panel__form-title) {
    font-size: 16px;
    font-weight: 650;
    margin-bottom: 18px;
  }

  :deep(.task-panel__title) {
    font-size: 14px;
    font-weight: 400;
    border: 1px solid var(--desktop-border);
    border-radius: 4px;
    height: 34px;
    padding: 0 10px;
    margin-bottom: 15px;
  }

  :deep(.task-panel__attach-hint) {
    font-size: 13px;
    color: #a8abb2;
    margin: 0 0 12px;
    line-height: 1.5;
  }
}
</style>
