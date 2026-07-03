<template>
  <section class="settings-section">
    <h2 class="settings-section__title">数据存储</h2>
    <p class="settings-section__path">{{ info?.dataPath ?? '加载中…' }}</p>
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="安装到 Program Files 等目录可能无法写入；卸载可能删除安装目录下的数据，请及时备份。"
      class="settings-section__alert"
    />
    <div class="settings-section__row">
      <el-input v-model="newPath" placeholder="输入新的数据目录绝对路径" />
      <el-button type="primary" @click="changePath">更改（重启后生效）</el-button>
    </div>
    <p v-if="info && !info.writable" class="settings-section__error">当前目录不可写，请尽快更改。</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AppInfo } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const info = ref<AppInfo | null>(null)
const newPath = ref('')

async function loadInfo() {
  info.value = unwrapIpc(await window.api.app.getInfo())
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
.settings-section {
  max-width: 720px;
}

.settings-section__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__path {
  font-family: Consolas, monospace;
  font-size: 13px;
  word-break: break-all;
  color: var(--desktop-muted);
}

.settings-section__alert {
  margin: 16px 0;
}

.settings-section__row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings-section__error {
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
