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
      <el-button type="primary" :loading="migrating" @click="pickAndChangePath">
        更改并迁移（将自动重启）
      </el-button>
      <el-button
        v-if="info && info.dataPath !== info.defaultDataPath"
        :loading="migrating"
        @click="useDefaultPath"
      >
        迁回安装目录
      </el-button>
    </div>
    <p v-if="info" class="settings-section__hint">
      默认路径：{{ info.defaultDataPath }}
    </p>
    <p class="settings-section__hint">
      更改时会先完整复制数据库与附件到新目录，成功后再删除原目录中的业务文件，然后自动重启。
    </p>
    <p v-if="info && !info.writable" class="settings-section__error">当前目录不可写，请尽快更改。</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AppInfo } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const info = ref<AppInfo | null>(null)
const migrating = ref(false)

async function loadInfo() {
  info.value = unwrapIpc(await window.api.app.getInfo())
}

async function applyNewPath(path: string) {
  migrating.value = true
  try {
    await ElMessageBox.confirm(
      `将把当前数据复制到：\n${path}\n\n复制成功后删除原目录业务文件并自动重启。是否继续？`,
      '迁移数据目录',
      { type: 'warning', confirmButtonText: '开始迁移', cancelButtonText: '取消' }
    )
    const result = await unwrapIpc(await window.api.app.setDataPath(path))
    ElMessage.success(`已迁移到 ${result.pendingPath}，正在重启…`)
  } catch (err) {
    if (err === 'cancel' || (err && typeof err === 'object' && 'action' in err)) {
      return
    }
    /* unwrapIpc 已 Toast */
  } finally {
    migrating.value = false
  }
}

async function pickAndChangePath() {
  const picked = unwrapIpc(await window.api.app.pickDataDir())
  if (!picked) return
  await applyNewPath(picked)
}

async function useDefaultPath() {
  if (!info.value) return
  await applyNewPath(info.value.defaultDataPath)
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
  margin: 12px 0;
}

.settings-section__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.settings-section__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.5;
}

.settings-section__error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--el-color-danger);
}
</style>
