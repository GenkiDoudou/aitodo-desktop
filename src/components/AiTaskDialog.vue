<template>
  <el-dialog
    :model-value="modelValue"
    width="560px"
    class="ai-dialog"
    :append-to-body="true"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <template #header>
      <div class="ai-dialog__header">
        <el-icon class="ai-dialog__icon"><MagicStick /></el-icon>
        <span>AI 一句话建任务</span>
      </div>
    </template>

    <el-input
      v-model="inputText"
      type="textarea"
      :rows="4"
      resize="none"
      placeholder="例如：明天下午3点开会，提前30分钟提醒我，归到工作分类"
      class="ai-dialog__input"
      @input="scheduleParse"
    />

    <div v-if="draft" class="ai-dialog__preview">
      <div class="ai-dialog__preview-title">解析预览</div>
      <div class="ai-dialog__cards">
        <div class="ai-dialog__card">
          <span class="ai-dialog__label">标题</span>
          <span class="ai-dialog__value" :class="{ 'is-missing': !draft.title }">
            {{ draft.title || '（未识别，将使用首句）' }}
          </span>
        </div>
        <div class="ai-dialog__card">
          <span class="ai-dialog__label">到期</span>
          <span class="ai-dialog__value" :class="{ 'is-muted': !draft.dueAt }">
            {{ draft.dueAt ? formatDisplay(draft.dueAt) : '未设置' }}
          </span>
        </div>
        <div class="ai-dialog__card">
          <span class="ai-dialog__label">提醒</span>
          <span class="ai-dialog__value" :class="{ 'is-muted': !draft.remindAt }">
            {{ draft.remindAt ? formatDisplay(draft.remindAt) : '未设置' }}
          </span>
        </div>
        <div class="ai-dialog__card">
          <span class="ai-dialog__label">分类</span>
          <span class="ai-dialog__value" :class="{ 'is-muted': !draft.category }">
            <template v-if="draft.category">
              <span
                class="ai-dialog__dot"
                :style="{ background: categoryColor(draft.category.id) }"
              />
              {{ draft.category.name }}
            </template>
            <template v-else>未分类</template>
          </span>
        </div>
      </div>
      <ul v-if="draft.warnings.length" class="ai-dialog__warnings">
        <li v-for="(w, i) in draft.warnings" :key="i">{{ w }}</li>
      </ul>
    </div>

    <p class="ai-dialog__footnote">本地规则解析，不上传云端；已配置大模型时将使用设置中的提示词</p>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        class="ai-dialog__submit"
        :loading="saving"
        :disabled="!inputText.trim()"
        @click="submit"
      >
        创建任务
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Category, Task } from '@shared/types'
import { parseAiTaskInput, type AiParsedTaskDraft } from '@shared/ai-task-parser'
import { unwrapIpc } from '@/ipc/client'

const props = defineProps<{
  modelValue: boolean
  categories: Category[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [Task]
}>()

const inputText = ref('')
const draft = ref<AiParsedTaskDraft | null>(null)
const saving = ref(false)
let parseTimer: ReturnType<typeof setTimeout> | null = null

function categoryColor(id: string): string {
  return props.categories.find((c) => c.id === id)?.color ?? '#0d9488'
}

function formatDisplay(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

function runParse() {
  const text = inputText.value.trim()
  if (!text) {
    draft.value = null
    return
  }
  draft.value = parseAiTaskInput(text, {
    categories: props.categories.map((c) => ({ id: c.id, name: c.name }))
  })
}

function scheduleParse() {
  if (parseTimer) clearTimeout(parseTimer)
  parseTimer = setTimeout(runParse, 280)
}

function onClosed() {
  inputText.value = ''
  draft.value = null
  saving.value = false
}

async function submit() {
  const text = inputText.value.trim()
  if (!text || saving.value) return

  runParse()
  const parsed = draft.value ?? parseAiTaskInput(text, {
    categories: props.categories.map((c) => ({ id: c.id, name: c.name }))
  })

  const title = parsed.title.trim() || text.split(/[，,。]/)[0]?.trim() || text
  if (!title) {
    ElMessage.warning('请填写任务描述')
    return
  }

  saving.value = true
  try {
    const task = unwrapIpc(
      await window.api.tasks.create({
        title: title.slice(0, 200),
        categoryId: parsed.category?.id ?? null,
        dueAt: parsed.dueAt,
        remindAt: parsed.remindAt
      })
    )
    emit('created', task)
    emit('update:modelValue', false)
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      runParse()
    }
  }
)
</script>

<style scoped lang="scss">
.ai-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--desktop-text);
}

.ai-dialog__icon {
  color: var(--desktop-ai);
  font-size: 20px;
}

.ai-dialog__input {
  :deep(textarea) {
    font-size: 14px;
    line-height: 1.5;
  }
}

.ai-dialog__preview {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--desktop-ai-light);
  border: 1px solid var(--desktop-ai-border);
}

.ai-dialog__preview-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-ai);
  margin-bottom: 10px;
}

.ai-dialog__cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.ai-dialog__card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ai-dialog__label {
  font-size: 11px;
  color: var(--desktop-muted);
}

.ai-dialog__value {
  font-size: 13px;
  color: var(--desktop-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;

  &.is-muted {
    color: var(--desktop-muted);
  }

  &.is-missing {
    color: #e6a23c;
  }
}

.ai-dialog__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ai-dialog__warnings {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: #e6a23c;

  li {
    margin: 0 0 4px;
  }
}

.ai-dialog__footnote {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--desktop-muted);
}

.ai-dialog__submit {
  --el-button-bg-color: var(--desktop-ai);
  --el-button-border-color: var(--desktop-ai);
  --el-button-hover-bg-color: var(--desktop-ai-hover-solid);
  --el-button-hover-border-color: var(--desktop-ai-hover-solid);
  --el-button-active-bg-color: var(--desktop-ai-active);
  --el-button-active-border-color: var(--desktop-ai-active);
}
</style>

<style lang="scss">
/* Dialog 挂载到 body，需全局类名覆盖圆角 */
.ai-dialog.el-dialog {
  border-radius: 12px;
  overflow: hidden;
}
</style>
