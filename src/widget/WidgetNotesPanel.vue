<template>
  <div class="notes-panel">
    <aside class="notes-panel__list">
      <div class="notes-panel__list-head">
        <button type="button" class="notes-panel__new" @click="createNote">+ 新建</button>
      </div>
      <div class="notes-panel__items">
        <button
          v-for="note in notes"
          :key="note.id"
          type="button"
          class="notes-panel__item"
          :class="{ 'is-active': note.id === selectedId, [`is-${note.color}`]: true }"
          @click="selectNote(note.id)"
        >
          <span v-if="note.pinned" class="notes-panel__pin">📌</span>
          <span class="notes-panel__preview">{{ preview(note.content) }}</span>
        </button>
      </div>
    </aside>

    <section v-if="selected" class="notes-panel__editor">
      <div class="notes-panel__toolbar">
        <div class="notes-panel__colors">
          <button
            v-for="color in colors"
            :key="color"
            type="button"
            class="notes-panel__color"
            :class="[`is-${color}`, { 'is-selected': selected.color === color }]"
            :title="color"
            @click="setColor(color)"
          />
        </div>
        <div class="notes-panel__actions">
          <button type="button" class="notes-panel__action" @click="togglePin">
            {{ selected.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" class="notes-panel__action" @click="convertToTask">转为任务</button>
          <button type="button" class="notes-panel__action is-danger" @click="deleteNote">删除</button>
        </div>
      </div>
      <textarea
        v-model="draft"
        class="notes-panel__textarea"
        :class="`is-${selected.color}`"
        placeholder="写点什么…"
        @input="scheduleSave"
        @blur="flushSave"
      />
      <p v-if="saving" class="notes-panel__status">保存中…</p>
    </section>

    <div v-else class="notes-panel__empty">点击「新建」或选择便签</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { WidgetNote, WidgetNoteColor } from '@shared/widget-notes'
import { WIDGET_NOTE_COLORS } from '@shared/widget-notes'

const notes = ref<WidgetNote[]>([])
const selectedId = ref<string | null>(null)
const draft = ref('')
const saving = ref(false)
const colors = WIDGET_NOTE_COLORS
let saveTimer: ReturnType<typeof setTimeout> | null = null

const selected = computed(() => notes.value.find((n) => n.id === selectedId.value) ?? null)

function preview(content: string): string {
  const line = content.split(/\r?\n/).find((s) => s.trim())
  return (line ?? '空白便签').slice(0, 24)
}

async function reload() {
  const res = await window.widgetApi.widgetNotes.list()
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  notes.value = res.data
  if (selectedId.value && !notes.value.some((n) => n.id === selectedId.value)) {
    selectedId.value = notes.value[0]?.id ?? null
  }
  if (!selectedId.value && notes.value[0]) {
    selectedId.value = notes.value[0].id
  }
  if (selected.value) {
    draft.value = selected.value.content
  }
}

function selectNote(id: string) {
  void flushSave()
  selectedId.value = id
  draft.value = notes.value.find((n) => n.id === id)?.content ?? ''
}

async function createNote() {
  const res = await window.widgetApi.widgetNotes.create({ content: '' })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  notes.value = [res.data, ...notes.value]
  selectedId.value = res.data.id
  draft.value = ''
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void flushSave()
  }, 500)
}

async function flushSave() {
  if (!selectedId.value) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  saving.value = true
  const res = await window.widgetApi.widgetNotes.update(selectedId.value, { content: draft.value })
  saving.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  notes.value = notes.value.map((n) => (n.id === res.data.id ? res.data : n))
  await reload()
}

async function setColor(color: WidgetNoteColor) {
  if (!selectedId.value) return
  const res = await window.widgetApi.widgetNotes.update(selectedId.value, { color })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await reload()
}

async function togglePin() {
  if (!selected.value) return
  const res = await window.widgetApi.widgetNotes.update(selected.value.id, {
    pinned: !selected.value.pinned
  })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  await reload()
}

async function convertToTask() {
  if (!selectedId.value) return
  await flushSave()
  const res = await window.widgetApi.widgetNotes.convertToTask(selectedId.value, {
    deleteNote: true
  })
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  ElMessage.success(`已加入收件箱：${res.data.title}`)
  selectedId.value = null
  draft.value = ''
  await reload()
}

async function deleteNote() {
  if (!selectedId.value) return
  const id = selectedId.value
  const res = await window.widgetApi.widgetNotes.delete(id)
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  selectedId.value = null
  draft.value = ''
  await reload()
}

onMounted(() => {
  void reload()
})
</script>

<style scoped lang="scss">
.notes-panel {
  display: flex;
  height: 100%;
}

.notes-panel__list {
  width: 110px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--widget-border);
  background: #222838;
}

.notes-panel__list-head {
  padding: 8px;
  border-bottom: 1px solid var(--widget-border);
}

.notes-panel__new {
  width: 100%;
  padding: 6px;
  border: 1px dashed var(--widget-border);
  background: transparent;
  color: var(--widget-accent);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.notes-panel__items {
  flex: 1;
  overflow: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notes-panel__item {
  border: none;
  border-radius: 6px;
  padding: 6px;
  text-align: left;
  cursor: pointer;
  font-size: 11px;
  color: #333;
  min-height: 36px;
}

.notes-panel__item.is-active {
  outline: 2px solid var(--widget-accent);
}

.notes-panel__item.is-yellow { background: var(--note-yellow); }
.notes-panel__item.is-green { background: var(--note-green); }
.notes-panel__item.is-blue { background: var(--note-blue); }
.notes-panel__item.is-pink { background: var(--note-pink); }
.notes-panel__item.is-gray { background: var(--note-gray); }

.notes-panel__pin {
  margin-right: 2px;
}

.notes-panel__preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notes-panel__editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.notes-panel__toolbar {
  padding: 8px;
  border-bottom: 1px solid var(--widget-border);
}

.notes-panel__colors {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.notes-panel__color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.notes-panel__color.is-selected {
  border-color: var(--widget-accent);
}

.notes-panel__color.is-yellow { background: var(--note-yellow); }
.notes-panel__color.is-green { background: var(--note-green); }
.notes-panel__color.is-blue { background: var(--note-blue); }
.notes-panel__color.is-pink { background: var(--note-pink); }
.notes-panel__color.is-gray { background: var(--note-gray); }

.notes-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notes-panel__action {
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: var(--widget-text);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
}

.notes-panel__action.is-danger {
  color: #ffb4b4;
}

.notes-panel__textarea {
  flex: 1;
  border: none;
  resize: none;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #222;
  background: var(--note-yellow);
}

.notes-panel__textarea.is-yellow { background: var(--note-yellow); }
.notes-panel__textarea.is-green { background: var(--note-green); }
.notes-panel__textarea.is-blue { background: var(--note-blue); }
.notes-panel__textarea.is-pink { background: var(--note-pink); }
.notes-panel__textarea.is-gray { background: var(--note-gray); }

.notes-panel__status {
  margin: 0;
  padding: 4px 12px 8px;
  font-size: 11px;
  color: var(--widget-muted);
}

.notes-panel__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--widget-muted);
  font-size: 12px;
}
</style>
