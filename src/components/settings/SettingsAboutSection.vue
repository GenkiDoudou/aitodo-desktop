<template>
  <section class="settings-section">
    <h2 class="settings-section__title">关于</h2>
    <p class="settings-section__version">小柒todo 桌面版 {{ info?.version ?? status?.currentVersion ?? '-' }}</p>
    <p class="settings-section__hint">纯本地待办客户端，数据默认存储于本机 SQLite。</p>

    <div class="settings-section__update">
      <p class="settings-section__meta">
        安装形态：{{ shapeLabel }}
        <template v-if="status?.feedSource"> · 源：{{ status.feedSource }}</template>
      </p>
      <p class="settings-section__status">{{ statusText }}</p>
      <div class="settings-section__actions">
        <el-button :loading="checking" @click="onCheck">检查更新</el-button>
        <el-button v-if="status?.state === 'ready'" type="primary" @click="onQuitAndInstall">
          重启以更新
        </el-button>
      </div>
      <p v-if="status?.errorMessage" class="settings-section__error">{{ status.errorMessage }}</p>
      <p class="settings-section__hint settings-section__hint--tight">
        未签名安装包可能被系统拦截，请在提示中允许运行。发版说明见 desktop/docs/auto-update-release.md。
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AppInfo } from '@shared/types'
import type { AppUpdateStatus, InstallShape } from '@shared/app-update'
import { unwrapIpc } from '@/ipc/client'

const info = ref<AppInfo | null>(null)
const status = ref<AppUpdateStatus | null>(null)
const checking = ref(false)
let cleanupStatus: (() => void) | undefined

const shapeLabel = computed(() => {
  const shape: InstallShape | undefined = status.value?.installShape
  if (shape === 'nsis') return 'Windows 安装版（NSIS）'
  if (shape === 'mac') return 'macOS'
  if (shape === 'portable-dir') return 'Windows 免解压目录'
  return '-'
})

const statusText = computed(() => {
  const s = status.value
  if (!s) return '更新状态：-'
  if (s.message) return s.message
  switch (s.state) {
    case 'idle':
      return '更新状态：空闲'
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 ${s.availableVersion ?? ''}`
    case 'downloading':
      return `正在下载… ${s.progress != null ? `${s.progress}%` : ''}`
    case 'ready':
      return '更新已就绪，可重启安装'
    case 'applying':
      return '正在应用更新…'
    case 'up-to-date':
      return '已是最新版本'
    case 'error':
      return '检查或下载失败'
    default:
      return `更新状态：${s.state}`
  }
})

onMounted(async () => {
  info.value = unwrapIpc(await window.api.app.getInfo())
  status.value = unwrapIpc(await window.api.appUpdate.getStatus())
  cleanupStatus = window.api.appUpdate.onStatus((next) => {
    status.value = next
  })
})

onUnmounted(() => {
  cleanupStatus?.()
})

async function onCheck() {
  checking.value = true
  try {
    status.value = unwrapIpc(await window.api.appUpdate.check())
    if (status.value.state === 'up-to-date') {
      ElMessage.success('已是最新版本')
    } else if (status.value.state === 'error') {
      ElMessage.error(status.value.errorMessage || '检查更新失败')
    } else if (status.value.state === 'ready') {
      ElMessage.success('更新已下载，请重启以更新')
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '检查更新失败')
  } finally {
    checking.value = false
  }
}

async function onQuitAndInstall() {
  try {
    unwrapIpc(await window.api.appUpdate.quitAndInstall())
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '无法应用更新')
  }
}
</script>

<style scoped lang="scss">
.settings-section__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__version {
  font-size: 15px;
  margin: 0 0 8px;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0;
}

.settings-section__hint--tight {
  margin-top: 12px;
}

.settings-section__update {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--desktop-border);
}

.settings-section__meta,
.settings-section__status {
  font-size: 13px;
  margin: 0 0 8px;
  color: var(--desktop-muted);
}

.settings-section__status {
  color: var(--desktop-text, inherit);
}

.settings-section__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.settings-section__error {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--el-color-danger);
}
</style>
