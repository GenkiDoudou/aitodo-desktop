<template>
  <header class="app-topbar">
    <GlobalSearch class="app-topbar__search" />

    <div class="app-topbar__actions">
      <el-dropdown trigger="click" @command="onNewCommand">
        <el-button type="primary" class="app-topbar__new">
          <el-icon><Plus /></el-icon>
          新建任务
          <el-icon class="app-topbar__new-caret"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="task">新建任务</el-dropdown-item>
            <el-dropdown-item command="capture">快捷捕获</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-popover
        v-model:visible="messageOpen"
        placement="bottom-end"
        :width="360"
        trigger="click"
        popper-class="app-topbar-message-popover"
      >
        <template #reference>
          <button type="button" class="app-topbar__icon-btn" title="消息">
            <el-icon><Bell /></el-icon>
            <span v-if="messageStore.totalUnread > 0" class="app-topbar__badge">
              {{ messageStore.totalUnread > 9 ? '9+' : messageStore.totalUnread }}
            </span>
          </button>
        </template>
        <AppMessagePanel @open-task="onMessageOpenTask" />
      </el-popover>

      <button type="button" class="app-topbar__icon-btn" title="日历" @click="goCalendar">
        <el-icon><Calendar /></el-icon>
      </button>

      <button type="button" class="app-topbar__icon-btn" title="外观" @click="openThemeSettings">
        <el-icon><Sunny /></el-icon>
      </button>

      <el-dropdown trigger="click" @command="onUserCommand">
        <button type="button" class="app-topbar__user">
          <span class="app-topbar__avatar">张</span>
          <span class="app-topbar__username">张三</span>
          <el-icon class="app-topbar__caret"><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="settings">设置</el-dropdown-item>
            <el-dropdown-item command="home">返回工作台</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, Bell, Calendar, Plus, Sunny } from '@element-plus/icons-vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import AppMessagePanel from '@/components/AppMessagePanel.vue'
import { useMessageStore } from '@/stores/message-store'

const router = useRouter()
const messageStore = useMessageStore()
const messageOpen = ref(false)

function onNewCommand(command: string) {
  if (command === 'capture') {
    void window.api.capture.toggle()
    return
  }
  void router.push('/')
  window.dispatchEvent(new CustomEvent('desktop:new-task'))
}

function onMessageOpenTask(taskId: string) {
  messageOpen.value = false
  void router.push({ path: '/', query: { taskId } })
}

function goCalendar() {
  void router.push('/calendar')
}

function openThemeSettings() {
  void router.push({ path: '/settings', query: { section: 'theme' } })
}

function onUserCommand(command: string) {
  if (command === 'settings') void router.push('/settings')
  else if (command === 'home') void router.push('/')
}

let unsubscribePush: (() => void) | null = null

onMounted(() => {
  void messageStore.refreshUnread()
  unsubscribePush = messageStore.subscribePush()
})

onUnmounted(() => {
  unsubscribePush?.()
})
</script>

<style scoped lang="scss">
.app-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 480px) minmax(max-content, 1fr);
  align-items: center;
  height: 56px;
  flex-shrink: 0;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--desktop-border);
  background: var(--desktop-bg);
  z-index: 2;
}

.app-topbar__search {
  grid-column: 2;
  width: 100%;
  max-width: none;
}

.app-topbar__actions {
  grid-column: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  flex-wrap: nowrap;
  justify-self: end;
  min-width: max-content;
}

.app-topbar__new {
  border-radius: var(--desktop-radius-pill);
  padding-inline: 16px;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 102, 255, 0.25);
}

.app-topbar__new-caret {
  margin-left: 2px;
  font-size: 12px;
}

.app-topbar__icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 17px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--desktop-text);
  }
}

.app-topbar__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--desktop-danger);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.app-topbar__user {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 4px 8px 4px 4px;
  border-radius: var(--desktop-radius-pill);
  cursor: pointer;
  color: var(--desktop-text);
  white-space: nowrap;
  flex-shrink: 0;
  max-width: none;
  writing-mode: horizontal-tb;

  &:hover {
    background: var(--desktop-hover);
  }
}

.app-topbar__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--desktop-primary-light);
  color: var(--desktop-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.app-topbar__username {
  font-size: 13px;
  white-space: nowrap;
  line-height: 1.2;
}

.app-topbar__caret {
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
