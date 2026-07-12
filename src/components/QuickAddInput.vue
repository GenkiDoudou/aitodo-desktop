<template>
  <div
    class="quick-add-input"
    :class="{ 'is-focused': focused, 'has-preview': showMeta }"
  >
    <div class="quick-add-input__field">
      <div ref="mirrorRef" class="quick-add-input__mirror" aria-hidden="true">
        <span
          v-for="(seg, index) in segments"
          :key="index"
          class="quick-add-input__seg"
          :class="seg.kind !== 'plain' ? `is-${seg.kind}` : undefined"
        >{{ seg.text }}</span>
      </div>
      <input
        ref="inputRef"
        :value="modelValue"
        class="quick-add-input__control"
        :placeholder="placeholder"
        spellcheck="false"
        @input="onInput"
        @keydown.enter.prevent="emit('enter')"
        @keydown.esc.prevent="emit('escape')"
        @focus="onFocus"
        @blur="onBlurAndEmit"
        @scroll="syncScroll"
      />
    </div>

    <div v-if="showMeta" class="quick-add-input__meta">
      <span v-if="draft?.dueAt" class="quick-add-input__tag is-due">
        截止 {{ formatIso(draft.dueAt) }}
      </span>
      <span v-if="draft?.remindAt" class="quick-add-input__tag is-remind">
        提醒 {{ formatIso(draft.remindAt) }}
        <template v-if="draft.reminders.length > 1">等 {{ draft.reminders.length }} 条</template>
      </span>
      <span v-if="draft?.recurrence" class="quick-add-input__tag is-recurrence">
        {{ recurrenceText }}
      </span>
      <span v-if="draft?.category" class="quick-add-input__tag is-category">
        {{ draft.category.name }}
      </span>
      <span v-if="draft?.title && hasHighlights" class="quick-add-input__tag is-title">
        标题 {{ draft.title }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  buildParseTextSegments,
  parseAiTaskInput,
  type AiParseCategoryRef,
  type AiParsedTaskDraft
} from '@shared/ai-task-parser'
import { recurrenceLabel } from '@shared/task-reminder'
import { toParseCategories } from '@shared/quick-create-task'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    categories?: AiParseCategoryRef[]
    /** 是否展示解析摘要行 */
    showMeta?: boolean
  }>(),
  {
    placeholder: '',
    categories: () => [],
    showMeta: true
  }
)

const emit = defineEmits<{
  'update:modelValue': [string]
  enter: []
  escape: []
  blur: []
}>()

const inputRef = ref<HTMLInputElement>()
const mirrorRef = ref<HTMLDivElement>()
const focused = ref(false)
const draft = ref<AiParsedTaskDraft | null>(null)
let parseTimer: ReturnType<typeof setTimeout> | null = null

const segments = computed(() =>
  buildParseTextSegments(props.modelValue, draft.value?.highlights ?? [])
)

const hasHighlights = computed(() => (draft.value?.highlights.length ?? 0) > 0)

const showMeta = computed(() => {
  if (!props.showMeta || !props.modelValue.trim()) return false
  const d = draft.value
  if (!d) return false
  return Boolean(d.dueAt || d.remindAt || d.recurrence || d.category || hasHighlights.value)
})

const recurrenceText = computed(() =>
  draft.value?.recurrence ? recurrenceLabel(draft.value.recurrence, draft.value.dueAt) : ''
)

function formatIso(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

function runParse() {
  const text = props.modelValue
  if (!text.trim()) {
    draft.value = null
    return
  }
  draft.value = parseAiTaskInput(text, { categories: toParseCategories(props.categories) })
}

function scheduleParse() {
  if (parseTimer) clearTimeout(parseTimer)
  parseTimer = setTimeout(runParse, 120)
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  scheduleParse()
}

function onFocus() {
  focused.value = true
  runParse()
}

function onBlurAndEmit() {
  focused.value = false
  emit('blur')
}

function syncScroll() {
  if (!inputRef.value || !mirrorRef.value) return
  mirrorRef.value.scrollLeft = inputRef.value.scrollLeft
}

watch(
  () => props.modelValue,
  () => scheduleParse()
)

watch(
  () => props.categories,
  () => scheduleParse(),
  { deep: true }
)

defineExpose({
  focus: () => inputRef.value?.focus()
})
</script>

<style scoped lang="scss">
.quick-add-input {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quick-add-input__field {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 22px;
  overflow: hidden;
}

.quick-add-input__mirror,
.quick-add-input__control {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  font-size: 14px;
  line-height: 22px;
  font-family: inherit;
  letter-spacing: normal;
  white-space: pre;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.quick-add-input__mirror {
  position: absolute;
  inset: 0;
  pointer-events: none;
  color: var(--desktop-text);
  word-break: keep-all;
}

.quick-add-input__control {
  position: relative;
  z-index: 1;
  background: transparent;
  outline: none;
  color: transparent;
  caret-color: var(--desktop-text);

  &::placeholder {
    color: var(--desktop-muted);
  }
}

.quick-add-input__seg {
  &.is-due {
    color: var(--el-color-primary);
    font-weight: 500;
  }

  &.is-remind {
    color: var(--el-color-warning);
    font-weight: 500;
  }

  &.is-recurrence {
    color: #7c3aed;
    font-weight: 500;
  }

  &.is-category {
    color: var(--el-color-success);
    font-weight: 500;
  }
}

.quick-add-input__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 2px;
}

.quick-add-input__tag {
  font-size: 11px;
  line-height: 1.4;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--desktop-bg);
  color: var(--desktop-muted);
  border: 1px solid transparent;

  &.is-due {
    color: var(--el-color-primary);
    border-color: color-mix(in srgb, var(--el-color-primary) 25%, transparent);
    background: color-mix(in srgb, var(--el-color-primary) 8%, var(--desktop-bg));
  }

  &.is-remind {
    color: var(--el-color-warning);
    border-color: color-mix(in srgb, var(--el-color-warning) 25%, transparent);
    background: color-mix(in srgb, var(--el-color-warning) 8%, var(--desktop-bg));
  }

  &.is-recurrence {
    color: #7c3aed;
    border-color: color-mix(in srgb, #7c3aed 25%, transparent);
    background: color-mix(in srgb, #7c3aed 8%, var(--desktop-bg));
  }

  &.is-category {
    color: var(--el-color-success);
    border-color: color-mix(in srgb, var(--el-color-success) 25%, transparent);
    background: color-mix(in srgb, var(--el-color-success) 8%, var(--desktop-bg));
  }

  &.is-title {
    color: var(--desktop-muted);
    border-color: var(--desktop-border, rgba(0, 0, 0, 0.06));
  }
}
</style>
