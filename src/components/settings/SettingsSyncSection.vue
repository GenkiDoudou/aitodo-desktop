<template>
  <section class="settings-section">
    <h2 class="settings-section__title">账号与同步</h2>
    <p class="settings-section__hint">
      {{
        status?.loggedIn
          ? '已登录时可在多台桌面客户端间按下方范围同步（需自建 Sync Server）。'
          : '未登录时数据仅存本机，行为与此前纯本地版本一致。'
      }}
    </p>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">服务器地址</span>
      <div class="settings-section__row">
        <el-input
          v-model="serverUrl"
          placeholder="http://127.0.0.1:8088"
          :disabled="loading || saving || status?.loggedIn"
        />
        <el-button :loading="testing" :disabled="loading || saving" @click="testServer">
          测试连接
        </el-button>
        <el-button :disabled="loading || saving || status?.loggedIn" @click="saveServerUrl">
          保存
        </el-button>
      </div>
    </div>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">同步范围</span>
      <div class="settings-section__toggles">
        <el-checkbox v-model="prefs.syncTasks" :disabled="loading || saving" @change="savePrefs">
          任务（分类）
        </el-checkbox>
        <el-checkbox v-model="prefs.syncConfig" :disabled="loading || saving" @change="savePrefs">
          配置
        </el-checkbox>
        <el-checkbox v-model="prefs.syncNotes" :disabled="loading || saving" @change="savePrefs">
          便签
        </el-checkbox>
      </div>
      <p class="settings-section__subhint">
        配置含快捷键、LLM（含 API Key）、提示词、关闭行为、动态保留、挂件启动项、界面偏好与自定义视图。
      </p>
    </div>

    <div class="settings-section__field">
      <span class="settings-section__label">同步频率</span>
      <el-select
        v-model="prefs.syncIntervalMs"
        style="width: 140px"
        :disabled="loading || saving"
        @change="savePrefs"
      >
        <el-option
          v-for="opt in intervalOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
    </div>

    <template v-if="!status?.loggedIn">
      <div class="settings-section__field settings-section__field--stack">
        <span class="settings-section__label">用户名</span>
        <el-input v-model="username" :disabled="loading || saving" autocomplete="username" />
      </div>
      <div class="settings-section__field settings-section__field--stack">
        <span class="settings-section__label">密码</span>
        <el-input
          v-model="password"
          type="password"
          show-password
          :disabled="loading || saving"
          autocomplete="current-password"
        />
      </div>
      <div class="settings-section__actions">
        <el-button type="primary" :loading="saving" :disabled="loading" @click="login">
          登录并同步
        </el-button>
      </div>
    </template>

    <template v-else>
      <div class="settings-section__field">
        <span class="settings-section__label">当前账号</span>
        <span>{{ status.username }}</span>
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">设备 ID</span>
        <span class="settings-section__mono">{{ status.deviceId }}</span>
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">待推送变更</span>
        <span>{{ status.pendingCount }}</span>
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">最近同步</span>
        <span>{{ status.lastSyncAt || '尚未同步' }}</span>
      </div>
      <div v-if="status.lastError" class="settings-section__error">
        {{ status.lastError }}
      </div>
      <div class="settings-section__actions">
        <el-button type="primary" :loading="saving" :disabled="loading" @click="triggerSync">
          立即同步
        </el-button>
        <el-button :disabled="loading || saving" @click="logout">退出登录</el-button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { DesktopSyncStatus } from '@shared/sync-protocol'
import {
  DEFAULT_SYNC_PREFERENCES,
  SYNC_INTERVAL_OPTIONS_MS,
  syncIntervalLabel,
  type SyncPreferences
} from '@shared/sync-preferences'
import { unwrapIpc } from '@/ipc/client'
import { collectUiPreferences } from '@/utils/ui-preferences-export'

const status = ref<DesktopSyncStatus | null>(null)
const serverUrl = ref('http://127.0.0.1:8088')
const username = ref('')
const password = ref('')
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const prefs = reactive<SyncPreferences>({ ...DEFAULT_SYNC_PREFERENCES })

const intervalOptions = SYNC_INTERVAL_OPTIONS_MS.map((value) => ({
  value,
  label: syncIntervalLabel(value)
}))

async function reportUiPrefs() {
  try {
    unwrapIpc(await window.api.sync.reportUiPreferences(collectUiPreferences()))
  } catch {
    /* 未登录或主进程未就绪时忽略 */
  }
}

async function refreshStatus() {
  loading.value = true
  try {
    status.value = unwrapIpc(await window.api.sync.getStatus())
    if (status.value.serverBaseUrl) {
      serverUrl.value = status.value.serverBaseUrl
    }
    Object.assign(prefs, status.value.preferences ?? DEFAULT_SYNC_PREFERENCES)
  } finally {
    loading.value = false
  }
}

async function savePrefs() {
  saving.value = true
  try {
    const next = unwrapIpc(
      await window.api.sync.setPreferences({
        syncTasks: prefs.syncTasks,
        syncConfig: prefs.syncConfig,
        syncNotes: prefs.syncNotes,
        syncIntervalMs: prefs.syncIntervalMs
      })
    )
    Object.assign(prefs, next)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存同步偏好失败')
    await refreshStatus()
  } finally {
    saving.value = false
  }
}

async function testServer() {
  testing.value = true
  try {
    const result = unwrapIpc(await window.api.sync.testServerUrl(serverUrl.value))
    if (result.ok) {
      ElMessage.success(result.message)
    } else {
      ElMessage.error(result.message)
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '测试失败')
  } finally {
    testing.value = false
  }
}

async function saveServerUrl() {
  saving.value = true
  try {
    serverUrl.value = unwrapIpc(await window.api.sync.setServerUrl(serverUrl.value))
    ElMessage.success('服务器地址已保存')
    await refreshStatus()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function login() {
  saving.value = true
  try {
    await reportUiPrefs()
    if (serverUrl.value.trim()) {
      unwrapIpc(await window.api.sync.setServerUrl(serverUrl.value))
    }
    unwrapIpc(
      await window.api.sync.login({
        username: username.value.trim(),
        password: password.value
      })
    )
    password.value = ''
    ElMessage.success('登录成功，已开始同步')
    await refreshStatus()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    saving.value = false
  }
}

async function logout() {
  saving.value = true
  try {
    unwrapIpc(await window.api.sync.logout())
    ElMessage.success('已退出登录，自动同步已停止')
    await refreshStatus()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '退出失败')
  } finally {
    saving.value = false
  }
}

async function triggerSync() {
  saving.value = true
  try {
    await reportUiPrefs()
    status.value = unwrapIpc(await window.api.sync.trigger())
    if (status.value.lastError) {
      ElMessage.warning(status.value.lastError)
    } else {
      ElMessage.success('同步完成')
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '同步失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await refreshStatus()
  await reportUiPrefs()
})
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

.settings-section__hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.settings-section__subhint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
}

.settings-section__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  margin-bottom: 12px;
}

.settings-section__field--stack {
  flex-direction: column;
  align-items: stretch;
}

.settings-section__label {
  font-size: 14px;
  color: var(--desktop-text);
}

.settings-section__row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.settings-section__toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 8px;
}

.settings-section__mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  word-break: break-all;
}

.settings-section__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.settings-section__error {
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
