<template>
  <div
    class="widget-app"
    :class="[
      `widget-app--${displayMode}`,
      edgeAnchorClass
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
  displayMode.value === 'edge_tab' ? '悬停或点击展开挂件' : '点击展开查看内容'
)

let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null

function resolveInstanceId(): string {
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (hash) return hash
  return new URLSearchParams(window.location.search).get('id')?.trim() ?? ''
}

function applyInstance(next: WidgetInstance) {
  instance.value = next
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

function onCompactHover() {
  if (!instanceId.value || displayMode.value !== 'edge_tab') return
  if (hoverExpandTimer) clearTimeout(hoverExpandTimer)
  hoverExpandTimer = setTimeout(() => {
    void window.widgetApi.widget.expand(instanceId.value)
  }, 300)
}

function onShellClick() {
  if (!isCompactMode.value || !instanceId.value) return
  void window.widgetApi.widget.expand(instanceId.value)
}

async function onCollapseClick() {
  if (!instanceId.value || !instance.value) return
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
  if (hoverExpandTimer) clearTimeout(hoverExpandTimer)
  cleanupModeListener?.()
})
</script>
