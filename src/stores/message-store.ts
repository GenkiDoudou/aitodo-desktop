import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppMessage, AppMessageKind } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

/** 应用内消息中心（通知 / 动态） */
export const useMessageStore = defineStore('messages', () => {
  const notifications = ref<AppMessage[]>([])
  const activities = ref<AppMessage[]>([])
  const unreadNotifications = ref(0)
  const unreadActivities = ref(0)
  const loading = ref(false)
  const summaryReports = ref<AppMessage[]>([])

  async function loadSummaryReports(limit = 8) {
    summaryReports.value = unwrapIpc(
      await window.api.messages.list('notification', 'scheduled_summary')
    ).slice(0, limit)
  }

  const totalUnread = computed(() => unreadNotifications.value + unreadActivities.value)

  async function loadKind(kind: AppMessageKind, source?: import('@shared/types').AppMessageSource) {
    const list = unwrapIpc(await window.api.messages.list(kind, source))
    if (kind === 'notification') {
      notifications.value = list
    } else {
      activities.value = list
    }
  }

  async function refreshUnread() {
    try {
      unreadNotifications.value = unwrapIpc(await window.api.messages.countUnread('notification'))
      unreadActivities.value = unwrapIpc(await window.api.messages.countUnread('activity'))
    } catch {
      unreadNotifications.value = 0
      unreadActivities.value = 0
    }
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadKind('notification'), loadKind('activity'), refreshUnread()])
    } finally {
      loading.value = false
    }
  }

  function prependMessage(message: AppMessage) {
    if (message.kind === 'notification') {
      notifications.value = [message, ...notifications.value.filter((m) => m.id !== message.id)]
      if (message.source === 'scheduled_summary') {
        summaryReports.value = [
          message,
          ...summaryReports.value.filter((m) => m.id !== message.id)
        ].slice(0, 8)
      }
      if (!message.readAt) unreadNotifications.value += 1
    } else {
      activities.value = [message, ...activities.value.filter((m) => m.id !== message.id)]
      if (!message.readAt) unreadActivities.value += 1
    }
  }

  async function markRead(id: string) {
    const updated = unwrapIpc(await window.api.messages.markRead(id))
    const patch = (list: AppMessage[]) =>
      list.map((m) => (m.id === id ? { ...m, readAt: updated.readAt } : m))
    notifications.value = patch(notifications.value)
    activities.value = patch(activities.value)
    summaryReports.value = patch(summaryReports.value)
    await refreshUnread()
    return updated
  }

  async function markAllRead(kind?: AppMessageKind) {
    unwrapIpc(await window.api.messages.markAllRead(kind))
    if (!kind || kind === 'notification') {
      await loadKind('notification')
      await loadSummaryReports()
    }
    if (!kind || kind === 'activity') {
      await loadKind('activity')
    }
    await refreshUnread()
  }

  function subscribePush() {
    return window.api.app.onMessagePush((message) => {
      prependMessage(message)
    })
  }

  return {
    notifications,
    activities,
    summaryReports,
    unreadNotifications,
    unreadActivities,
    totalUnread,
    loading,
    loadAll,
    loadSummaryReports,
    refreshUnread,
    prependMessage,
    markRead,
    markAllRead,
    subscribePush
  }
})
