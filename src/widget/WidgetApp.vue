<template>
  <div
    class="widget-app"
    :class="[
      `widget-app--${displayMode}`,
      edgeAnchorClass,
      { 'is-peek': peekFromHover }
    ]"
    @click="onShellClick"
  >
    <!-- 边缘细条 / 迷你：紧凑壳 -->
    <template v-if="isCompactMode">
      <div
        class="widget-app__compact"
        :class="{ 'is-horizontal-edge': isHorizontalEdge }"
        :title="compactHint"
        @mouseenter="onCompactHover"
        @mouseleave="onCompactMouseLeave"
      >
        <span class="widget-app__compact-dot" :class="kindDotClass" />
        <span
          v-if="displayMode === 'edge_tab'"
          :class="isHorizontalEdge ? 'widget-app__compact-title' : 'widget-app__compact-vertical'"
        >{{ title }}</span>
        <span v-else class="widget-app__compact-title">{{ title }}</span>
      </div>
    </template>

    <!-- 完整展开 -->
    <template v-else>
      <header class="widget-app__head">
        <span class="widget-app__title">{{ title }}</span>
        <div class="widget-app__head-actions">
          <button type="button" class="widget-app__icon-btn" title="打开主窗口" @click.stop="openMain">⌂</button>
          <button type="button" class="widget-app__icon-btn" title="收起" @click.stop="onCollapseClick">−</button>
        </div>
      </header>

      <div class="widget-app__body">
        <div v-if="loading" class="widget-app__loading">加载中…</div>
        <div v-else-if="!instance" class="widget-app__loading">挂件不存在</div>
        <WidgetNotesPanel v-else-if="instance.kind === 'notes'" />
        <WidgetMatrixPanel v-else-if="instance.kind === 'matrix'" />
        <WidgetViewsPanel
          v-else
          :fixed-view-id="instance.viewId ?? undefined"
          :instance-id="instance.id"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { WidgetDisplayMode } from '@shared/widget-display'
import type { WidgetInstance } from '@shared/widget-notes'
import { widgetInstanceDisplayName } from '@shared/widget-notes'
import WidgetMatrixPanel from './WidgetMatrixPanel.vue'
import WidgetNotesPanel from './WidgetNotesPanel.vue'
import WidgetViewsPanel from './WidgetViewsPanel.vue'

const instance = ref<WidgetInstance | null>(null)
const loading = ref(true)
const instanceId = ref('')
/** 由贴边细条悬停临时展开：鼠标移出窗口后应再收起 */
const peekFromHover = ref(false)

const displayMode = computed<WidgetDisplayMode>(() => instance.value?.displayMode ?? 'expanded')
const isCompactMode = computed(() => displayMode.value === 'edge_tab' || displayMode.value === 'mini')

const title = computed(() => {
  if (!instance.value) return '小柒todo 挂件'
  return widgetInstanceDisplayName(instance.value)
})

const edgeAnchorClass = computed(() =>
  instance.value?.edgeAnchor ? `widget-app--anchor-${instance.value.edgeAnchor}` : ''
)

const isHorizontalEdge = computed(
  () => instance.value?.edgeAnchor === 'top' || instance.value?.edgeAnchor === 'bottom'
)

const kindDotClass = computed(() => {
  const kind = instance.value?.kind
  if (kind === 'matrix') return 'is-matrix'
  if (kind === 'view') return 'is-view'
  return 'is-notes'
})

const compactHint = computed(() =>
  displayMode.value === 'edge_tab'
    ? '悬停临时展开，移开即收起；点击细条或拖动可固定展开'
    : '点击展开查看内容'
)

let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null

function resolveInstanceId(): string {
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (hash) return hash
  return new URLSearchParams(window.location.search).get('id')?.trim() ?? ''
}

function applyInstance(next: WidgetInstance) {
  instance.value = next
  // 外部切回细条时清掉 peek 标记
  if (next.displayMode === 'edge_tab' || next.displayMode === 'mini' || next.displayMode === 'hidden') {
    peekFromHover.value = false
  }
}

async function loadInstance() {
  instanceId.value = resolveInstanceId()
  if (!instanceId.value) {
    loading.value = false
    return
  }
  const res = await window.widgetApi.widget.getInstance(instanceId.value)
  loading.value = false
  if (!res.ok) {
    ElMessage.error(res.error.message)
    return
  }
  applyInstance(res.data)
}

function clearHoverExpandTimer() {
  if (hoverExpandTimer) {
    clearTimeout(hoverExpandTimer)
    hoverExpandTimer = null
  }
}

/** 贴边细条：悬停延迟临时展开（就地 peek；收起由主进程按光标是否在窗内决定） */
function onCompactHover() {
  if (!instanceId.value || displayMode.value !== 'edge_tab') return
  clearHoverExpandTimer()
  hoverExpandTimer = setTimeout(() => {
    hoverExpandTimer = null
    peekFromHover.value = true
    void window.widgetApi.widget.expand(instanceId.value, { peek: true })
  }, 300)
}

/** 尚未展开时离开细条：取消悬停展开 */
function onCompactMouseLeave() {
  clearHoverExpandTimer()
}

function onShellClick() {
  if (!instanceId.value) return
  // 仅细条/迷你点击 → 正式展开；peek 中点内容不固定（移出窗口仍应收起）
  if (!isCompactMode.value) return
  clearHoverExpandTimer()
  peekFromHover.value = false
  void window.widgetApi.widget.expand(instanceId.value)
}

async function onCollapseClick() {
  if (!instanceId.value || !instance.value) return
  peekFromHover.value = false
  const mode = instance.value.displayMode
  if (mode === 'expanded') {
    await window.widgetApi.widget.collapse(instanceId.value)
    return
  }
  if (mode === 'edge_tab' || mode === 'mini') {
    await window.widgetApi.widget.hide(instanceId.value)
  }
}

async function openMain() {
  peekFromHover.value = false
  await window.widgetApi.app.openMain('/')
}

let cleanupModeListener: (() => void) | undefined

onMounted(() => {
  void loadInstance()
  cleanupModeListener = window.widgetApi.widget.onDisplayModeChanged((next) => {
    if (next.id === instanceId.value) {
      applyInstance(next)
    }
  })
})

onUnmounted(() => {
  clearHoverExpandTimer()
  cleanupModeListener?.()
})
</script>
