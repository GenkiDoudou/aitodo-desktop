<template>
  <div class="fence-app" :class="{ 'is-drag-over': dragOver, [`fence-app--${slotDef.mode}`]: true }">
    <section class="fence-panel">
      <header class="fence-panel__head">
        <span class="fence-panel__icon" aria-hidden="true">{{ slotDef.icon }}</span>
        <span class="fence-panel__title">{{ slotDef.title }}</span>
        <span v-if="slotDef.mode === 'grid'" class="fence-panel__count">{{ items.length }}</span>
        <div class="fence-panel__head-actions">
          <button type="button" class="fence-panel__tool" title="添加" aria-label="添加">＋</button>
          <button type="button" class="fence-panel__tool" title="搜索" aria-label="搜索">⌕</button>
          <button type="button" class="fence-panel__tool" title="固定" aria-label="固定">⌖</button>
          <button type="button" class="fence-panel__tool fence-panel__tool--close" title="隐藏" aria-label="隐藏" @click="hide">
            ×
          </button>
        </div>
      </header>

      <nav v-if="slotDef.mode === 'tabs' && slotDef.tabs?.length" class="fence-panel__tabs">
        <button
          v-for="tab in slotDef.tabs"
          :key="tab.tabId"
          type="button"
          class="fence-panel__tab"
          :class="{ 'is-active': activeTabId === tab.tabId }"
          @click="activeTabId = tab.tabId"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div
        class="fence-panel__body"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <div v-if="items.length" class="fence-panel__grid">
          <div
            v-for="item in items"
            :key="item.absolutePath"
            class="fence-panel__item"
            draggable="true"
            :title="item.absolutePath"
            @dragstart="onDragStart(item)"
            @dragend="onDragEnd"
            @dblclick="openItem(item)"
          >
            <span class="fence-panel__item-icon-wrap">
              <img
                v-if="iconUrls[item.absolutePath]"
                class="fence-panel__item-img"
                :src="iconUrls[item.absolutePath]"
                :alt="displayName(item.name)"
                draggable="false"
              />
              <span v-else class="fence-panel__item-fallback">{{ item.kind === 'folder' ? '📁' : '📄' }}</span>
            </span>
            <span class="fence-panel__item-name">{{ displayName(item.name) }}</span>
          </div>
        </div>
        <div v-else-if="slotDef.mode === 'tabs'" class="fence-panel__empty-actions">
          <p class="fence-panel__empty">可自动移动入对应的整理架</p>
          <button type="button" class="fence-panel__action">📁 添加文件夹</button>
          <button type="button" class="fence-panel__action fence-panel__action--secondary">设置整理规则</button>
        </div>
        <p v-else class="fence-panel__empty">拖入项目或扫描桌面后显示</p>
      </div>

      <footer class="fence-panel__foot">
        <button type="button" class="fence-panel__view is-active" title="网格">▦</button>
        <button type="button" class="fence-panel__view" title="列表">☰</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { DesktopScanItem } from '@shared/desktop-organize-types'
import type { DesktopFenceScanPayload } from '@shared/fence-types'
import {
  dropCategoryForFenceTab,
  filterItemsForFenceTab,
  getFenceSlot
} from '@shared/fence-slot-config'

const slotId = window.fenceApi.getSlotId()
const slotDef = getFenceSlot(slotId)!
const payload = ref<DesktopFenceScanPayload | null>(null)
const iconUrls = reactive<Record<string, string>>({})
const dragOver = ref(false)
const activeTabId = ref(slotDef.tabs?.[0]?.tabId ?? '')

const activeTab = computed(() => slotDef.tabs?.find((t) => t.tabId === activeTabId.value) ?? null)

const items = computed(() => {
  const all = payload.value?.items ?? []
  if (slotDef.mode === 'grid' && slotDef.categoryId) {
    return all.filter((i) => i.matchedCategoryId === slotDef.categoryId)
  }
  if (slotDef.mode === 'tabs' && activeTab.value) {
    return filterItemsForFenceTab(all, activeTab.value)
  }
  return []
})

/** 桌面显示名：去掉 .lnk / .url 扩展名 */
function displayName(name: string): string {
  return name.replace(/\.(lnk|url)$/i, '')
}

async function loadIcons(list: DesktopScanItem[]) {
  const batchSize = 3
  for (let i = 0; i < list.length; i += batchSize) {
    const slice = list.slice(i, i + batchSize)
    await Promise.all(
      slice.map(async (item) => {
        if (iconUrls[item.absolutePath]) return
        const res = await window.fenceApi.getFileIcon(item.absolutePath)
        if (res.ok) {
          iconUrls[item.absolutePath] = res.data
        }
      })
    )
    if (i + batchSize < list.length) {
      await new Promise((r) => setTimeout(r, 30))
    }
  }
}

function applyPayload(data: DesktopFenceScanPayload) {
  payload.value = data
}

watch(items, (list) => {
  void loadIcons(list)
}, { immediate: true })

function onDragStart(item: DesktopScanItem) {
  void window.fenceApi.beginDrag(item.absolutePath)
}

function onDragEnd() {
  void window.fenceApi.endDrag()
}

async function onDrop() {
  dragOver.value = false
  const categoryId =
    slotDef.mode === 'grid'
      ? slotDef.categoryId!
      : activeTab.value
        ? dropCategoryForFenceTab(activeTab.value)
        : 'file'
  await window.fenceApi.dropItem(categoryId)
}

async function openItem(item: DesktopScanItem) {
  await window.fenceApi.openItem(item.absolutePath)
}

async function hide() {
  await window.fenceApi.hide()
}

let cleanup: (() => void) | undefined

onMounted(() => {
  cleanup = window.fenceApi.onScanPush(applyPayload)
})

onUnmounted(() => {
  cleanup?.()
})
</script>
