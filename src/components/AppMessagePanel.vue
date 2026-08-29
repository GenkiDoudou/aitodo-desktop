<template>
  <div class="app-message-panel">
    <div class="app-message-panel__tabs">
      <button
        type="button"
        class="app-message-panel__tab"
        :class="{ 'is-active': activeTab === 'notification' }"
        @click="activeTab = 'notification'"
      >
        通知
        <span v-if="messageStore.unreadNotifications > 0" class="app-message-panel__tab-badge">
          {{ messageStore.unreadNotifications }}
        </span>
      </button>
      <button
        type="button"
        class="app-message-panel__tab"
        :class="{ 'is-active': activeTab === 'activity' }"
        @click="activeTab = 'activity'"
      >
        动态
        <span v-if="messageStore.unreadActivities > 0" class="app-message-panel__tab-badge">
          {{ messageStore.unreadActivities }}
        </span>
      </button>
      <button
        type="button"
        class="app-message-panel__tab"
        :class="{ 'is-active': activeTab === 'pending' }"
        @click="switchPending"
      >
        待发送
        <span v-if="pendingItems.length > 0" class="app-message-panel__tab-badge">
          {{ pendingItems.length }}
        </span>
      </button>
    </div>

    <div v-loading="panelLoading" class="app-message-panel__body">
      <template v-if="activeTab === 'pending'">
        <div v-if="pendingItems.length === 0 && !pendingLoading" class="app-message-panel__empty">
          暂无待发送
        </div>
        <ul v-else class="app-message-panel__list">
          <li
            v-for="item in pendingItems"
            :key="item.id"
            class="app-message-panel__item"
            @click="onPendingClick(item)"
          >
            <span class="app-message-panel__avatar is-summary" aria-hidden="true">
              <el-icon><Timer /></el-icon>
            </span>
            <div class="app-message-panel__content">
              <div class="app-message-panel__head">
                <span class="app-message-panel__title">
                  <span class="app-message-panel__tag">{{ pendingKindLabel(item.kind) }}</span>
                  {{ item.title }}
                </span>
                <time class="app-message-panel__date">{{
                  formatDate(item.deferredTo || item.fireAt)
                }}</time>
              </div>
              <p v-if="item.bodyPreview" class="app-message-panel__body-text">{{ item.bodyPreview }}</p>
            </div>
          </li>
        </ul>
      </template>
      <template v-else>
        <div v-if="currentList.length === 0 && !messageStore.loading" class="app-message-panel__empty">
          {{ activeTab === 'notification' ? '暂无通知' : '暂无动态' }}
        </div>

        <ul v-else class="app-message-panel__list">
          <li
            v-for="item in currentList"
            :key="item.id"
            class="app-message-panel__item"
            :class="{ 'is-unread': !item.readAt }"
            @click="onItemClick(item)"
          >
            <span class="app-message-panel__avatar" aria-hidden="true" :class="avatarClass(item)">
              <el-icon><component :is="itemIcon(item)" /></el-icon>
            </span>
            <div class="app-message-panel__content">
              <div class="app-message-panel__head">
                <span class="app-message-panel__title">
                  <span v-if="!item.readAt" class="app-message-panel__unread-dot" aria-label="未读" />
                  <span v-if="isSummaryMessage(item)" class="app-message-panel__tag">定时汇总</span>
                  <span v-if="!item.readAt" class="app-message-panel__unread-tag">未读</span>
                  {{ displayTitle(item) }}
                </span>
                <time class="app-message-panel__date">{{ formatDate(item.createdAt) }}</time>
              </div>
              <p v-if="item.body" class="app-message-panel__body-text">{{ item.body }}</p>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <footer v-if="activeTab !== 'pending' && currentList.length" class="app-message-panel__footer">
      <button type="button" class="app-message-panel__mark-all" @click="onMarkAllRead">
        全部标为已读
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bell, Timer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { AppMessage, AppMessageKind } from '@shared/types'
import type { PendingNotifyItem } from '@shared/notification-config'
import { useMessageStore } from '@/stores/message-store'
import { unwrapIpc } from '@/ipc/client'
import { formatChinaDateTime } from '@/utils/datetime'

const emit = defineEmits<{
  'open-task': [string]
}>()

const messageStore = useMessageStore()
// activeTab 控制当前面板渲染哪一类消息：
// - notification：站内通知（kind=notification）
// - activity：动态（kind=activity）
// - pending：未最终确认/待投递列表（不来自 messageStore，而来自 notify IPC）
const activeTab = ref<AppMessageKind | 'pending'>('notification')
const pendingItems = ref<PendingNotifyItem[]>([])
const pendingLoading = ref(false)

const currentList = computed(() =>
  activeTab.value === 'notification'
    ? messageStore.notifications
    : activeTab.value === 'activity'
      ? messageStore.activities
      : []
)

const panelLoading = computed(() =>
  activeTab.value === 'pending' ? pendingLoading.value : messageStore.loading
)

function formatDate(iso: string) {
  return formatChinaDateTime(iso) || iso
}

function pendingKindLabel(kind: string) {
  if (kind === 'deferred') return '延后'
  if (kind === 'queued') return '队列'
  return '即将'
}

async function loadPending() {
  pendingLoading.value = true
  try {
    pendingItems.value = unwrapIpc(await window.api.notify.listPending())
  } catch {
    pendingItems.value = []
  } finally {
    pendingLoading.value = false
  }
}

function switchPending() {
  activeTab.value = 'pending'
  void loadPending()
}

function onPendingClick(item: PendingNotifyItem) {
  if (item.event === 'task_reminder' && item.entityId) {
    emit('open-task', item.entityId)
  }
}

function isSummaryMessage(item: AppMessage) {
  return item.source === 'scheduled_summary'
}

function itemIcon(item: AppMessage) {
  return isSummaryMessage(item) ? Timer : Bell
}

function avatarClass(item: AppMessage) {
  return isSummaryMessage(item) ? 'is-summary' : 'is-reminder'
}

function displayTitle(item: AppMessage) {
  if (isSummaryMessage(item)) {
    return item.title.replace(/^定时汇总：/, '')
  }
  return item.title
}

async function onItemClick(item: AppMessage) {
  if (!item.readAt) {
    await messageStore.markRead(item.id)
  }
  if (item.taskId) {
    emit('open-task', item.taskId)
  }
}

async function onMarkAllRead() {
  if (activeTab.value === 'pending') return
  await messageStore.markAllRead(activeTab.value)
  ElMessage.success('已全部标为已读')
}

onMounted(() => {
  void messageStore.loadAll()
})
</script>

<style scoped lang="scss">
.app-message-panel {
  width: 360px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  margin: -12px;
}

.app-message-panel__tabs {
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #f0f1f3;
}

.app-message-panel__tab {
  position: relative;
  border: none;
  background: transparent;
  padding: 6px 20px;
  font-size: 14px;
  color: var(--desktop-muted);
  cursor: pointer;
  border-radius: 999px;
  transition: background 0.15s ease, color 0.15s ease;

  &.is-active {
    background: #f0f1f3;
    color: var(--desktop-text);
    font-weight: 600;
  }
}

.app-message-panel__tab-badge {
  position: absolute;
  top: 0;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.app-message-panel__body {
  flex: 1;
  min-height: 120px;
  max-height: 380px;
  overflow-y: auto;
}

.app-message-panel__empty {
  padding: 48px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--desktop-muted);
}

.app-message-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.app-message-panel__item {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f1f3;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: #fafbfc;
  }

  &.is-unread {
    background: color-mix(in srgb, var(--el-color-primary) 6%, #fff);

    .app-message-panel__title {
      font-weight: 600;
      color: var(--desktop-text);
    }
  }

  &.is-unread:hover {
    background: color-mix(in srgb, var(--el-color-primary) 10%, #fff);
  }

  &:last-child {
    border-bottom: none;
  }
}

.app-message-panel__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #409eff 55%, #67c23a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;

  &.is-summary {
    background: linear-gradient(135deg, #e6a23c 55%, #f56c6c 100%);
  }
}

.app-message-panel__content {
  flex: 1;
  min-width: 0;
}

.app-message-panel__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.app-message-panel__title {
  font-size: 14px;
  color: var(--desktop-text);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.app-message-panel__unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.app-message-panel__unread-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-color-primary) 14%, #fff);
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
}

.app-message-panel__tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, #e6a23c 18%, #fff);
  color: #b88230;
  font-size: 11px;
  font-weight: 600;
}

.app-message-panel__date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--desktop-muted);
}

.app-message-panel__body-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--desktop-muted);
  word-break: break-word;
}

.app-message-panel__footer {
  padding: 8px 16px 12px;
  border-top: 1px solid #f0f1f3;
  text-align: center;
}

.app-message-panel__mark-all {
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--el-color-primary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;

  &:hover {
    background: rgba(64, 158, 255, 0.08);
  }
}
</style>
