<template>
  <div class="task-body-editor" :class="{ 'is-content-expanded': contentExpanded }">
    <div class="task-body-editor__tabs">
      <button
        type="button"
        class="task-body-editor__tab"
        :class="{ 'is-active': viewMode === 'wysiwyg' }"
        @click="switchMode('wysiwyg')"
      >
        编辑
      </button>
      <button
        type="button"
        class="task-body-editor__tab"
        :class="{ 'is-active': viewMode === 'source' }"
        @click="switchMode('source')"
      >
        源码
      </button>
      <button
        type="button"
        class="task-body-editor__tab-expand"
        :title="contentExpanded ? '恢复正文高度' : '放大正文编辑区'"
        @click="contentExpanded = !contentExpanded"
      >
        <el-icon><component :is="contentExpanded ? ScaleToOriginal : FullScreen" /></el-icon>
      </button>
    </div>

    <div class="task-body-editor__toolbar">
      <button
        v-for="tool in markdownTools"
        :key="tool.key"
        type="button"
        class="task-body-editor__tool"
        :title="tool.label"
        :disabled="viewMode === 'source'"
        @mousedown.prevent="onToolClick(tool)"
      >
        {{ tool.short }}
      </button>
    </div>

    <div class="task-body-editor__main">
      <div v-show="viewMode === 'wysiwyg'" class="task-body-editor__wysiwyg">
        <EditorContent v-if="editor" :editor="editor" class="task-body-editor__tiptap" />
      </div>

      <textarea
        v-show="viewMode === 'source'"
        ref="sourceRef"
        v-model="sourceText"
        class="task-body-editor__source"
        :placeholder="placeholder"
        @input="onSourceInput"
      />
    </div>

    <TaskAttachmentList
      :attachments="attachments"
      @open="openAttachment"
      @download="downloadAttachment"
      @remove="removeAttachment"
    />

    <footer class="task-body-editor__bar">
      <el-dropdown v-if="!hideCategoryInBar" trigger="click" @command="onCategoryCommand">
        <button
          type="button"
          class="task-body-editor__bar-btn task-body-editor__bar-btn--category"
          :title="`清单：${categoryLabel}`"
        >
          <span class="task-body-editor__bar-dot" :style="{ background: categoryColor }" />
          <span v-if="categoryId" class="task-body-editor__category-text">{{ categoryLabel }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :command="null">
              <span class="task-body-editor__category-option">
                <span class="task-body-editor__bar-dot task-body-editor__bar-dot--muted" />
                未分类
              </span>
            </el-dropdown-item>
            <el-dropdown-item v-for="c in categories" :key="c.id" :command="c.id">
              <span class="task-body-editor__category-option">
                <span class="task-body-editor__bar-dot" :style="{ background: c.color ?? '#909399' }" />
                {{ c.name }}
              </span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <button type="button" class="task-body-editor__bar-btn" title="插入图片到正文" @click="pickImage">🖼</button>
      <button type="button" class="task-body-editor__bar-btn" title="添加附件（显示在下方列表）" @click="pickAttachment">
        📎
      </button>
      <input ref="imageInputRef" type="file" class="task-body-editor__file" accept="image/*" @change="onImageFile" />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'
import { EditorContent } from '@tiptap/vue-3'
import { MARKDOWN_TOOLS, type MarkdownTool } from '@shared/markdown-tools'
import {
  parseTaskDescription,
  serializeTaskDescription,
  savedAttachmentToFileMeta,
  type TaskFileAttachment
} from '@shared/task-description'
import { useTaskTiptapEditor } from '@/composables/useTaskTiptapEditor'
import TaskAttachmentList from '@/components/TaskAttachmentList.vue'
import { unwrapIpc } from '@/ipc/client'
import type { Category } from '@shared/types'

type EditorViewMode = 'wysiwyg' | 'source'

const modelValue = defineModel<string>({ default: '' })
const categoryId = defineModel<string | null>('categoryId', { default: null })
const contentExpanded = defineModel<boolean>('contentExpanded', { default: false })

const props = withDefaults(
  defineProps<{
    categories?: Category[]
    placeholder?: string
    /** 清单已在详情顶栏展示时，隐藏底部清单按钮 */
    hideCategoryInBar?: boolean
  }>(),
  {
    categories: () => [],
    placeholder: '输入正文… 支持标题、列表、待办；可粘贴图片',
    hideCategoryInBar: false
  }
)

defineEmits<{
  'add-subtask': []
}>()

const categoryLabel = computed(() => {
  if (!categoryId.value) return '未分类'
  return props.categories.find((c) => c.id === categoryId.value)?.name ?? '未分类'
})

const categoryColor = computed(() => {
  if (!categoryId.value) return '#c0c4cc'
  return props.categories.find((c) => c.id === categoryId.value)?.color ?? '#909399'
})

function onCategoryCommand(id: string | null) {
  categoryId.value = id
}

const viewMode = ref<EditorViewMode>('wysiwyg')
const markdownTools = MARKDOWN_TOOLS
const attachments = ref<TaskFileAttachment[]>([])
const sourceText = ref('')
const sourceRef = ref<HTMLTextAreaElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)

/** 防止 v-model 与编辑器互相同步时循环 */
let syncingFromModel = false
let syncingToModel = false

function getCurrentBody(): string {
  if (viewMode.value === 'source') {
    return sourceText.value
  }
  return getMarkdown()
}

function syncToModel() {
  if (syncingFromModel) return
  syncingToModel = true
  modelValue.value = serializeTaskDescription(getCurrentBody(), attachments.value)
  nextTick(() => {
    syncingToModel = false
  })
}

function applyParsedDescription(raw: string) {
  const parsed = parseTaskDescription(raw)
  attachments.value = parsed.attachments
  sourceText.value = parsed.body
  setMarkdownContent(parsed.body)
}

const { editor, setMarkdownContent, getMarkdown, applyTool, insertImage } = useTaskTiptapEditor({
  placeholder: props.placeholder,
  onBodyChange: () => {
    if (viewMode.value === 'wysiwyg') {
      syncToModel()
    }
  },
  onPasteImage: (file) => insertImageFile(file)
})

watch(
  () => modelValue.value,
  (raw) => {
    if (syncingToModel) return
    syncingFromModel = true
    applyParsedDescription(raw)
    nextTick(() => {
      syncingFromModel = false
    })
  },
  { immediate: true }
)

/** 编辑器实例晚于 model 就绪时补一次正文同步 */
watch(editor, (ed) => {
  if (!ed || syncingToModel) return
  const { body } = parseTaskDescription(modelValue.value)
  setMarkdownContent(body)
})

watch(attachments, () => syncToModel(), { deep: true })

function switchMode(mode: EditorViewMode) {
  if (mode === viewMode.value) return
  if (mode === 'source') {
    sourceText.value = getMarkdown()
  } else {
    setMarkdownContent(sourceText.value)
    syncToModel()
  }
  viewMode.value = mode
}

function onSourceInput() {
  syncToModel()
}

function onToolClick(tool: MarkdownTool) {
  if (viewMode.value !== 'wysiwyg') return
  applyTool(tool)
}

function pickImage() {
  imageInputRef.value?.click()
}

function onImageFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void insertImageFile(file)
  input.value = ''
}

async function insertImageFile(file: File) {
  if (file.size > 8 * 1024 * 1024) {
    ElMessage.warning('图片请小于 8MB')
    return
  }
  try {
    const base64 = await readFileAsBase64(file)
    const saved = unwrapIpc(
      await window.api.app.saveAttachment({ name: file.name || 'image.png', base64 })
    )
    if (!saved.isImage) {
      ElMessage.warning('请选择图片文件')
      return
    }
    if (viewMode.value === 'source') {
      sourceText.value = `${sourceText.value}\n\n![${saved.name}](${saved.uri})\n`
      syncToModel()
    } else {
      insertImage(saved.uri, saved.name)
    }
    ElMessage.success('图片已插入正文')
  } catch {
    ElMessage.error('图片保存失败')
  }
}

async function pickAttachment() {
  try {
    const saved = unwrapIpc(await window.api.app.pickAttachment())
    if (!saved) return
    if (saved.isImage) {
      ElMessage.info('图片请使用 🖼 插入到正文')
      return
    }
    const meta = savedAttachmentToFileMeta(saved)
    if (attachments.value.some((a) => a.uri === meta.uri)) {
      ElMessage.warning('该附件已在列表中')
      return
    }
    attachments.value = [...attachments.value, meta]
    ElMessage.success('附件已添加')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

function removeAttachment(index: number) {
  attachments.value = attachments.value.filter((_, i) => i !== index)
}

async function openAttachment(item: TaskFileAttachment) {
  try {
    unwrapIpc(await window.api.app.openAttachment(item.uri))
  } catch {
    ElMessage.warning('无法打开附件')
  }
}

async function downloadAttachment(item: TaskFileAttachment) {
  try {
    const ok = unwrapIpc(await window.api.app.downloadAttachment(item.uri, item.name))
    if (ok) {
      ElMessage.success('附件已保存')
    }
  } catch {
    ElMessage.warning('下载失败')
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** 保存前由 TaskDetailPanel 调用：将 WYSIWYG 正文与外置附件写入 v-model */
function flushWysiwygToMarkdown() {
  if (viewMode.value === 'source') {
    syncToModel()
    return
  }
  sourceText.value = getMarkdown()
  syncToModel()
}

defineExpose({ flushWysiwygToMarkdown })
</script>

<style scoped lang="scss">
.task-body-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  width: 100%;

  &.is-content-expanded {
    .task-body-editor__wysiwyg,
    .task-body-editor__source {
      min-height: calc(100vh - 320px);
      max-height: none;
    }
  }
}

.task-body-editor__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.task-body-editor__tab {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--desktop-muted);
  cursor: pointer;

  &.is-active {
    background: var(--desktop-active);
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.task-body-editor__tab-expand {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--desktop-border);
  border-radius: 6px;
  background: var(--desktop-bg);
  color: var(--desktop-muted);
  cursor: pointer;

  &:hover {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary);
  }
}

.task-body-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.task-body-editor__tool {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--desktop-border);
  border-radius: 6px;
  background: var(--desktop-bg);
  font-size: 12px;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.task-body-editor__main {
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.task-body-editor__wysiwyg {
  min-height: 160px;
  max-height: 420px;
  overflow: auto;
  padding: 4px 2px 12px;
  border-radius: 8px;
  border: 1px solid transparent;

  &:focus-within {
    border-color: var(--desktop-border);
  }
}

.task-body-editor__tiptap {
  :deep(.task-tiptap__content) {
    outline: none;
    min-height: 140px;
    font-size: 13px;
    line-height: 1.65;
    color: var(--desktop-text);

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: var(--desktop-muted);
      pointer-events: none;
      height: 0;
    }

    h1 {
      font-size: 1.4em;
      font-weight: 700;
      margin: 12px 0 8px;
    }

    h2 {
      font-size: 1.2em;
      font-weight: 600;
      margin: 10px 0 6px;
    }

    h3 {
      font-size: 1.1em;
      font-weight: 600;
      margin: 8px 0 4px;
    }

    ul,
    ol {
      margin: 8px 0;
      padding-left: 1.4em;
    }

    ul[data-type='taskList'] {
      list-style: none;
      padding-left: 0;

      li {
        display: flex;
        align-items: flex-start;
        gap: 6px;

        label {
          flex-shrink: 0;
        }
      }
    }

    mark {
      background: #fff3bf;
      padding: 0 2px;
    }

    img {
      max-width: 100%;
      border-radius: 8px;
      margin: 8px 0;
      display: block;
    }

    a {
      color: var(--el-color-primary);
      text-decoration: underline;
    }

    blockquote {
      margin: 8px 0;
      padding-left: 12px;
      border-left: 3px solid var(--desktop-border);
      color: var(--desktop-muted);
    }

    pre {
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--desktop-bg);
      overflow: auto;
    }

    code {
      padding: 2px 5px;
      border-radius: 4px;
      background: var(--desktop-bg);
      font-size: 0.92em;
    }

    hr {
      border: none;
      border-top: 1px solid var(--desktop-border);
      margin: 12px 0;
    }
  }
}

.task-body-editor__source {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 160px;
  max-height: 420px;
  padding: 8px 4px 12px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  outline: none;
  resize: vertical;
  background: transparent;
  font-size: 13px;
  line-height: 1.65;
  color: var(--desktop-text);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;

  &::placeholder {
    color: var(--desktop-muted);
  }
}

.task-body-editor__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--desktop-border);
}

.task-body-editor__bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--desktop-border);
  border-radius: 6px;
  background: var(--desktop-bg);
  font-size: 13px;
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }
}

.task-body-editor__bar-btn--category {
  max-width: 160px;
}

.task-body-editor__category-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.task-body-editor__category-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.task-body-editor__bar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--muted {
    background: #c0c4cc;
  }
}

.task-body-editor__file {
  display: none;
}
</style>
