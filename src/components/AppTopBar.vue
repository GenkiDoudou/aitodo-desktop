<template>

  <header class="app-topbar">

    <h2 class="app-topbar__title">{{ title }}</h2>



    <div class="app-topbar__actions">

      <button

        type="button"

        class="app-topbar__icon-btn"

        title="搜索"

        @click="emit('focus-search')"

      >

        <el-icon><Search /></el-icon>

      </button>



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



      <el-dropdown trigger="click" @command="onUserCommand">

        <button type="button" class="app-topbar__avatar" title="用户">

          {{ avatarText }}

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

/**

 * 简化顶栏：左视图标题 + 右图标区（搜索 / 消息 / 头像）。

 * 不含居中 GlobalSearch 与 primary「新建任务」。

 */

import { onMounted, onUnmounted, ref } from 'vue'

import { useRouter } from 'vue-router'

import { Bell, Search } from '@element-plus/icons-vue'

import AppMessagePanel from '@/components/AppMessagePanel.vue'

import { useMessageStore } from '@/stores/message-store'



withDefaults(

  defineProps<{

    title: string

    avatarText?: string

  }>(),

  { avatarText: 'LU' }

)



const emit = defineEmits<{

  'focus-search': []

}>()



const router = useRouter()

const messageStore = useMessageStore()

const messageOpen = ref(false)



function onMessageOpenTask(taskId: string) {

  messageOpen.value = false

  void router.push({ path: '/', query: { taskId } })

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

  display: flex;

  align-items: center;

  height: 56px;

  flex-shrink: 0;

  padding: 0 20px;

  gap: 10px;

  border-bottom: 1px solid var(--desktop-border);

  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);

  z-index: 2;

}



.app-topbar__title {

  margin: 0;

  font-size: 15px;

  font-weight: 600;

  color: var(--desktop-text);

  min-width: 0;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.app-topbar__actions {

  margin-left: auto;

  display: flex;

  align-items: center;

  gap: 6px;

  flex-shrink: 0;

}



.app-topbar__icon-btn {

  position: relative;

  display: inline-flex;

  align-items: center;

  justify-content: center;

  width: 32px;

  height: 32px;

  border: none;

  border-radius: 8px;

  background: transparent;

  color: var(--desktop-text-secondary, #606266);

  cursor: pointer;

  font-size: 17px;



  &:hover {

    background: rgba(64, 158, 255, 0.1);

    color: #409eff;

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



.app-topbar__avatar {

  width: 28px;

  height: 28px;

  border: none;

  border-radius: 50%;

  background: linear-gradient(135deg, #409eff, #79bbff);

  color: #fff;

  display: inline-flex;

  align-items: center;

  justify-content: center;

  font-size: 12px;

  font-weight: 650;

  cursor: pointer;



  &:hover {

    filter: brightness(0.97);

  }

}

</style>

