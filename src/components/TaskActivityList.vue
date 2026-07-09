<template>
  <div class="task-activity-list">
    <div v-if="loading && !items.length" class="task-activity-list__empty">加载中…</div>
    <div v-else-if="!items.length" class="task-activity-list__empty">暂无动态</div>
    <ul v-else class="task-activity-list__timeline">
      <li v-for="item in items" :key="item.id" class="task-activity-list__item">
        <div class="task-activity-list__dot" />
        <div class="task-activity-list__content">
          <div class="task-activity-list__head">
            <span class="task-activity-list__type">{{ typeLabel(item.type) }}</span>
            <time class="task-activity-list__time">{{ formatTime(item.createdAt) }}</time>
          </div>
          <p class="task-activity-list__summary">{{ item.summary }}</p>
        </div>
      </li>
    </ul>
    <el-button
      v-if="hasMore"
      class="task-activity-list__more"
      text
      :loading="loadingMore"
      @click="loadMore"
    >
      加载更多
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TaskActivity } from '@shared/types'
import { taskActivityTypeLabel } from '@shared/task-activity-labels'
import { unwrapIpc } from '@/ipc/client'
import { formatIsoReadable } from '@/utils/datetime'

const props = defineProps<{
  taskId: string | null
}>()

const PAGE_SIZE = 50

const items = ref<TaskActivity[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)

function typeLabel(type: TaskActivity['type']) {
  return taskActivityTypeLabel(type)
}

function formatTime(iso: string) {
  return formatIsoReadable(iso)
}

async function load(reset = true) {
  if (!props.taskId) {
    items.value = []
    hasMore.value = false
    return
  }
  if (reset) {
    loading.value = true
  }
  try {
    const list = unwrapIpc(
      await window.api.taskActivities.listByTask(props.taskId, PAGE_SIZE)
    )
    items.value = list
    hasMore.value = list.length >= PAGE_SIZE
  } catch {
    if (reset) items.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!props.taskId || !items.value.length) return
  loadingMore.value = true
  try {
    const before = items.value[items.value.length - 1]?.createdAt
    const more = unwrapIpc(
      await window.api.taskActivities.listByTask(props.taskId, PAGE_SIZE, before)
    )
    items.value = [...items.value, ...more]
    hasMore.value = more.length >= PAGE_SIZE
  } catch {
    hasMore.value = false
  } finally {
    loadingMore.value = false
  }
}

watch(
  () => props.taskId,
  () => {
    void load(true)
  },
  { immediate: true }
)

defineExpose({ reload: () => load(true) })
</script>

<style scoped lang="scss">
.task-activity-list {
  padding: 4px 0 12px;
}

.task-activity-list__empty {
  padding: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--desktop-muted);
}

.task-activity-list__timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.task-activity-list__item {
  display: flex;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--desktop-border);
}

.task-activity-list__dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.task-activity-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-activity-list__type {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.task-activity-list__time {
  font-size: 12px;
  color: var(--desktop-muted);
  white-space: nowrap;
}

.task-activity-list__summary {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--desktop-text);
}

.task-activity-list__more {
  display: block;
  margin: 8px auto 0;
}
</style>
