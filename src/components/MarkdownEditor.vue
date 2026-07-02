<template>
  <div class="md-field" :class="{ 'is-open': open }">
    <!-- 折叠：显示渲染摘要，而非原始 Markdown -->
    <button v-if="!open" type="button" class="md-field__trigger" @click="open = true">
      <span class="md-field__icon">📝</span>
      <span class="md-field__body">
        <span class="md-field__title">描述</span>
        <span v-if="hasContent" class="md-field__snippet">{{ snippetText }}</span>
        <span v-else class="md-field__hint">添加备注，支持 Markdown</span>
      </span>
      <el-icon class="md-field__arrow"><ArrowDown /></el-icon>
    </button>

    <!-- 展开：工具栏 + 编辑 + 实时预览 -->
    <div v-else class="md-field__panel">
      <div class="md-field__panel-head">
        <span>描述</span>
        <button type="button" class="md-field__close" @click="close">收起</button>
      </div>

      <div class="md-field__toolbar">
        <button
          v-for="btn in tools"
          :key="btn.key"
          type="button"
          class="md-field__tool"
          :title="btn.label"
          @click="apply(btn)"
        >
          {{ btn.short }}
        </button>
      </div>

      <textarea
        ref="textareaRef"
        v-model="modelValue"
        class="md-field__input"
        rows="3"
        placeholder="输入 Markdown…  **加粗**  - 列表  [链接](url)"
        @input="autoGrow"
      />

      <div v-if="hasContent" class="md-field__live">
        <span class="md-field__live-label">预览</span>
        <div class="md-field__live-body" v-html="previewHtml" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'

const modelValue = defineModel<string>({ default: '' })

const open = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

const hasContent = computed(() => modelValue.value.trim().length > 0)
const previewHtml = computed(() => md.render(modelValue.value || ''))
/** 折叠态一行摘要：去掉 Markdown 符号后的纯文本 */
const snippetText = computed(() => {
  const text = modelValue.value
    .replace(/[#>*`[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 36 ? `${text.slice(0, 36)}…` : text
})

watch(
  () => modelValue.value,
  (v) => {
    if (v.trim()) open.value = true
  },
  { immediate: true }
)

interface Tool {
  key: string
  label: string
  short: string
  prefix: string
  suffix: string
  placeholder?: string
  block?: boolean
}

const tools: Tool[] = [
  { key: 'b', label: '加粗', short: 'B', prefix: '**', suffix: '**', placeholder: '文字' },
  { key: 'i', label: '斜体', short: 'I', prefix: '*', suffix: '*', placeholder: '文字' },
  { key: 'h', label: '标题', short: 'H', prefix: '## ', suffix: '', block: true, placeholder: '标题' },
  { key: 'l', label: '列表', short: '≡', prefix: '- ', suffix: '', block: true, placeholder: '条目' },
  { key: 't', label: '待办', short: '☑', prefix: '- [ ] ', suffix: '', block: true, placeholder: '待办' },
  { key: 'a', label: '链接', short: '🔗', prefix: '[', suffix: '](https://)', placeholder: '文字' },
  { key: 'c', label: '代码', short: '`', prefix: '`', suffix: '`', placeholder: 'code' }
]

function close() {
  if (!hasContent.value) {
    open.value = false
  } else {
    open.value = false
  }
}

function autoGrow() {
  const ta = textareaRef.value
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
}

async function apply(action: Tool) {
  const ta = textareaRef.value
  const text = modelValue.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const selected = text.slice(start, end)
  const insert = action.placeholder ?? (selected || '文字')
  const lineStart = text.lastIndexOf('\n', start - 1) + 1

  const next = action.block
    ? `${text.slice(0, lineStart)}${action.prefix}${insert}${action.suffix}${text.slice(end)}`
    : `${text.slice(0, start)}${action.prefix}${insert}${action.suffix}${text.slice(end)}`

  const cursor = action.block
    ? lineStart + action.prefix.length + insert.length
    : start + action.prefix.length + insert.length

  modelValue.value = next
  await nextTick()
  autoGrow()
  ta.focus()
  ta.setSelectionRange(cursor, cursor)
}

watch(open, async (v) => {
  if (v) {
    await nextTick()
    autoGrow()
  }
})
</script>

<style scoped lang="scss">
.md-field {
  margin-top: 4px;
}

.md-field__trigger {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px dashed var(--desktop-border);
  border-radius: 10px;
  background: var(--desktop-panel);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--desktop-hover);
  }
}

.md-field__icon {
  font-size: 16px;
  line-height: 1.4;
  opacity: 0.7;
}

.md-field__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.md-field__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
}

.md-field__snippet {
  font-size: 13px;
  color: var(--desktop-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md-field__hint {
  font-size: 13px;
  color: var(--desktop-muted);
}

.md-field__arrow {
  margin-top: 2px;
  color: var(--desktop-muted);
}

.md-field__panel {
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  background: var(--desktop-panel);
  overflow: hidden;
}

.md-field__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
  background: var(--desktop-bg);
  border-bottom: 1px solid var(--desktop-border);
}

.md-field__close {
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 12px;
  cursor: pointer;
}

.md-field__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 10px 4px;
}

.md-field__tool {
  min-width: 30px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--desktop-bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-text);
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-7);
    color: var(--el-color-primary);
  }
}

.md-field__input {
  display: block;
  width: 100%;
  min-height: 72px;
  max-height: 160px;
  padding: 8px 12px;
  border: none;
  border-top: 1px solid var(--desktop-border);
  border-bottom: 1px solid var(--desktop-border);
  background: transparent;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
  color: var(--desktop-text);

  &::placeholder {
    color: #b1b3b8;
    font-size: 12px;
  }
}

.md-field__live {
  padding: 8px 12px 10px;
  background: var(--desktop-bg);
}

.md-field__live-label {
  display: block;
  font-size: 11px;
  color: var(--desktop-muted);
  margin-bottom: 6px;
}

.md-field__live-body {
  font-size: 13px;
  line-height: 1.55;
  color: var(--desktop-text);
  max-height: 100px;
  overflow: auto;

  :deep(p) {
    margin: 0 0 0.35em;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0.25em 0;
    padding-left: 1.2em;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.1em 0.35em;
    border-radius: 4px;
    font-size: 0.9em;
  }

  :deep(a) {
    color: var(--el-color-primary);
  }

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 0.2em 0;
    font-size: 14px;
  }
}
</style>
