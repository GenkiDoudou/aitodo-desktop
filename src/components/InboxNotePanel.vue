<template>
  <aside v-show="visible" class="inbox-note-panel" :class="{ 'is-open': visible }">
    <header class="inbox-note-panel__head">
      <h2 class="inbox-note-panel__title">便签</h2>
      <button type="button" class="inbox-note-panel__close" title="关闭" @click="emit('close')">×</button>
    </header>

    <div v-if="!note" class="inbox-note-panel__empty">选择一张便签查看全文</div>

    <template v-else>
      <div class="inbox-note-panel__toolbar">
        <div class="inbox-note-panel__colors">
          <button
            v-for="color in colors"
            :key="color"
            type="button"
            class="inbox-note-panel__color"
            :class="[`is-${color}`, { 'is-selected': note.color === color }]"
            :title="color"
            @click="setColor(color)"
          />
        </div>
        <div class="inbox-note-panel__actions">
          <button type="button" class="inbox-note-panel__action" @click="togglePin">
            {{ note.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" class="inbox-note-panel__action" @click="emit('convert', note)">
            转为任务
          </button>
          <button type="button" class="inbox-note-panel__action is-danger" @click="emit('delete', note.id)">
            删除
          </button>
        </div>
      </div>

      <textarea
        v-model="draft"
        class="inbox-note-panel__textarea"
        :class="`is-${note.color}`"
        placeholder="写点什么…"
        @input="scheduleSave"
        @blur="flushSave"
      />
      <p v-if="saving" class="inbox-note-panel__status">保存中…</p>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { WidgetNote, WidgetNoteColor } from '@shared/widget-notes'
import { WIDGET_NOTE_COLORS } from '@shared/widget-notes'

const props = defineProps<{
  visible: boolean
  note: WidgetNote | null
}>()

const emit = defineEmits<{
  close: []
  changed: []
  convert: [WidgetNote]
  delete: [string]
}>()

const colors = WIDGET_NOTE_COLORS
const draft = ref('')
const saving = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.note,
  (next) => {
    draft.value = next?.content ?? ''
  },
  { immediate: true }
)

function scheduleSave() {
  // textarea 输入会触发频繁保存请求；这里做了 500ms 防抖，
  // 只在用户暂停输入后再调用 flushSave，降低 IPC/写库压力。
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void flushSave()
  }, 500)
}

async function flushSave() {
  if (!props.note) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (draft.value === props.note.content) return
  saving.value = true
  const res = await window.api.widgetNotes.update(props.note.id, { content: draft.value })
  saving.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  emit('changed')
}

async function setColor(color: WidgetNoteColor) {
  if (!props.note || props.note.color === color) return
  const res = await window.api.widgetNotes.update(props.note.id, { color })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  emit('changed')
}

async function togglePin() {
  if (!props.note) return
  const res = await window.api.widgetNotes.update(props.note.id, { pinned: !props.note.pinned })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  emit('changed')
}
</script>

<style scoped lang="scss">
.inbox-note-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: min(400px, 92vw);
  background: var(--desktop-panel);
  border-left: 1px solid var(--desktop-border, #e5e7eb);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.06);
}

.inbox-note-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--desktop-border, #e5e7eb);
  flex-shrink: 0;
}

.inbox-note-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.inbox-note-panel__close {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--desktop-muted);
  cursor: pointer;
  padding: 0 4px;

  &:hover {
    color: var(--desktop-text);
  }
}

.inbox-note-panel__empty {
  padding: 24px 16px;
  color: var(--desktop-muted);
  font-size: 13px;
}

.inbox-note-panel__toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--desktop-border, #e5e7eb);
  flex-shrink: 0;
}

.inbox-note-panel__colors {
  display: flex;
  gap: 8px;
}

.inbox-note-panel__color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;

  &.is-yellow { background: #f5d76e; }
  &.is-green { background: #7dcea0; }
  &.is-blue { background: #85c1e9; }
  &.is-pink { background: #f5b7b1; }
  &.is-gray { background: #bdc3c7; }

  &.is-selected {
    border-color: #374151;
  }
}

.inbox-note-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inbox-note-panel__action {
  border: 1px solid var(--desktop-border, #e5e7eb);
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--desktop-text);

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-danger {
    color: var(--el-color-danger);
  }
}

.inbox-note-panel__textarea {
  flex: 1;
  min-height: 0;
  margin: 12px 16px 8px;
  padding: 12px;
  border: 1px solid var(--desktop-border, #e5e7eb);
  border-radius: 10px;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
  font-family: inherit;

  &.is-yellow { background: #fff9db; }
  &.is-green { background: #e8f8ef; }
  &.is-blue { background: #e8f4ff; }
  &.is-pink { background: #ffe8f0; }
  &.is-gray { background: #f2f3f5; }
}

.inbox-note-panel__status {
  margin: 0 16px 12px;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
