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

  const totalUnread = computed(() => unreadNotifications.value + unreadActivities.value)

  async function loadKind(kind: AppMessageKind) {
    const list = unwrapIpc(await window.api.messages.list(kind))
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
    await refreshUnread()
    return updated
  }

  async function markAllRead(kind?: AppMessageKind) {
    unwrapIpc(await window.api.messages.markAllRead(kind))
    const ts = new Date().toISOString().slice(0, 19)
    const markList = (list: AppMessage[]) =>
      list.map((m) => ({ ...m, readAt: m.readAt ?? ts }))
    if (!kind || kind === 'notification') {
      notifications.value = markList(notifications.value)
    }
    if (!kind || kind === 'activity') {
      activities.value = markList(activities.value)
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
    unreadNotifications,
    unreadActivities,
    totalUnread,
    loading,
    loadAll,
    refreshUnread,
    prependMessage,
    markRead,
    markAllRead,
    subscribePush
  }
})
