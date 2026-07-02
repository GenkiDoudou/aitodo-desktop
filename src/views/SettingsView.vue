<template>
  <div class="settings">
    <header class="settings__header">
      <el-button text @click="router.push('/')">← 返回</el-button>
      <h1>设置</h1>
    </header>
    <section class="settings__section">
      <h2>数据存储</h2>
      <p class="settings__path">{{ info?.dataPath ?? '加载中…' }}</p>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="安装到 Program Files 等目录可能无法写入；卸载可能删除安装目录下的数据，请及时备份。"
        class="settings__alert"
      />
      <div class="settings__row">
        <el-input v-model="newPath" placeholder="输入新的数据目录绝对路径" />
        <el-button type="primary" @click="changePath">更改（重启后生效）</el-button>
      </div>
      <p v-if="info && !info.writable" class="settings__error">当前目录不可写，请尽快更改。</p>
    </section>
    <section class="settings__section">
      <h2>关于</h2>
      <p>版本 {{ info?.version ?? '-' }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AppInfo } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const router = useRouter()
const info = ref<AppInfo | null>(null)
const newPath = ref('')

async function loadInfo() {
  info.value = await unwrapIpc(await window.api.app.getInfo())
}

async function changePath() {
  const path = newPath.value.trim()
  if (!path) {
    ElMessage.warning('请输入路径')
    return
  }
  const result = await unwrapIpc(await window.api.app.setDataPath(path))
  await ElMessageBox.alert(
    `新路径已保存：${result.pendingPath}\n请手动复制原 data 目录下的文件到新目录后重启应用。`,
    '需重启生效',
    { type: 'info' }
  )
}

onMounted(loadInfo)
</script>

<style scoped lang="scss">
.settings {
  padding: 16px 20px;
  height: 100vh;
  overflow: auto;
  background: var(--desktop-bg);
}

.settings__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.settings__section {
  max-width: 640px;
  margin-bottom: 24px;

  h2 {
    font-size: 14px;
    margin: 0 0 8px;
  }
}

.settings__path {
  font-family: Consolas, monospace;
  font-size: 13px;
  word-break: break-all;
}

.settings__alert {
  margin: 12px 0;
}

.settings__row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings__error {
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
