<template>
  <div ref="rootRef" class="global-search">
    <el-input
      ref="inputRef"
      v-model="query"
      class="global-search__input"
      placeholder="搜索任务、清单、标签、描述…"
      clearable
      @focus="openPanel = true"
      @input="onInput"
      @keydown.down.prevent="moveHighlight(1)"
      @keydown.up.prevent="moveHighlight(-1)"
      @keydown.enter.prevent="confirmHighlight"
      @keydown.esc="closePanel"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
      <template #suffix>
        <kbd class="global-search__kbd">Ctrl+K</kbd>
      </template>
    </el-input>

    <div v-if="openPanel && (loading || results.length > 0 || trimmedQuery)" class="global-search__panel">
      <div v-if="loading" class="global-search__hint">搜索中…</div>
      <div v-else-if="!trimmedQuery" class="global-search__hint">输入关键词搜索任务标题</div>
      <div v-else-if="results.length === 0" class="global-search__hint">未找到匹配任务</div>
      <ul v-else class="global-search__list">
        <li
          v-for="(task, index) in results"
          :key="task.id"
          class="global-search__item"
          :class="{ 'is-active': index === highlightIndex }"
          @mousedown.prevent="selectTask(task.id)"
        >
          <TaskPriorityBadge :priority="task.priority ?? 4" compact />
          <span class="global-search__title">{{ task.title }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import type { ElInput } from 'element-plus'
import type { Task } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'

const router = useRouter()
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<InstanceType<typeof ElInput> | null>(null)
const query = ref('')
const results = ref<Task[]>([])
const loading = ref(false)
const openPanel = ref(false)
const highlightIndex = ref(0)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

const trimmedQuery = computed(() => query.value.trim())

/** 对外暴露：快捷键 Ctrl+K 聚焦搜索框 */
function focusInput() {
  void router.push('/')
  inputRef.value?.focus()
  openPanel.value = true
}

async function runSearch(q: string) {
  const seq = ++searchSeq
  if (!q) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const list = unwrapIpc(
      await window.api.tasks.list({
        smartList: 'all',
        search: q,
        hideDone: false,
        hideDoneScope: 'off'
      })
    )
    if (seq !== searchSeq) return
    results.value = list.slice(0, 12)
    highlightIndex.value = 0
  } catch {
    if (seq === searchSeq) results.value = []
  } finally {
    if (seq === searchSeq) loading.value = false
  }
}

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSearch(trimmedQuery.value)
  }, 200)
}

function moveHighlight(delta: number) {
  if (results.value.length === 0) return
  const next = highlightIndex.value + delta
  if (next < 0) highlightIndex.value = results.value.length - 1
  else if (next >= results.value.length) highlightIndex.value = 0
  else highlightIndex.value = next
}

async function selectTask(taskId: string) {
  openPanel.value = false
  query.value = ''
  results.value = []
  await router.push({ path: '/', query: { taskId } })
}

function confirmHighlight() {
  const task = results.value[highlightIndex.value]
  if (task) void selectTask(task.id)
}

function closePanel() {
  openPanel.value = false
}

function onDocumentClick(e: MouseEvent) {
  if (!rootRef.value?.contains(e.target as Node)) {
    openPanel.value = false
  }
}

function onFocusGlobalSearch() {
  focusInput()
}

watch(trimmedQuery, (q) => {
  if (!q) results.value = []
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('desktop:focus-global-search', onFocusGlobalSearch)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('desktop:focus-global-search', onFocusGlobalSearch)
  if (debounceTimer) clearTimeout(debounceTimer)
})

defineExpose({ focusInput })
</script>

<style scoped lang="scss">
.global-search {
  position: relative;
  width: 100%;
}

.global-search__input {
  :deep(.el-input__wrapper) {
    border-radius: 20px;
    padding: 0 14px;
    min-height: 36px;
    box-shadow: none;
    border: 1px solid transparent;
    background: var(--desktop-sidebar);

    &.is-focus {
      border-color: var(--desktop-primary);
      background: var(--desktop-bg);
      box-shadow: 0 0 0 2px var(--desktop-primary-light);
    }
  }

  :deep(.el-input__inner) {
    font-size: 13px;
    color: var(--desktop-text);

    &::placeholder {
      color: #a0a7b4;
    }
  }

  :deep(.el-input__prefix) {
    color: #9ca3af;
    font-size: 15px;
  }
}

.global-search__kbd {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--desktop-border);
  background: var(--desktop-bg);
  font-size: 11px;
  color: var(--desktop-muted);
  line-height: 1.2;
  font-family: inherit;
}

.global-search__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 200;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--desktop-border);
  border-radius: var(--desktop-radius-lg);
  background: var(--desktop-bg);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.global-search__hint {
  padding: 12px 14px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.global-search__list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.global-search__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--desktop-radius-md);
  cursor: pointer;

  &:hover,
  &.is-active {
    background: var(--desktop-primary-light);
  }
}

.global-search__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
</style>
