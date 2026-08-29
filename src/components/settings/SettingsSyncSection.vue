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
          placeholder="https://aitodo.126w.com"
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
        <!--
          同步范围与服务端实体类型的对应关系在 desktop/shared/sync-entity-filter.ts 中定义：
          - syncTasks -> task / category / tag 等（取决于实现阶段）
          - syncConfig -> app_settings / task_view / scheduled_summary 配置
          - syncSummaryResults -> app_message（仅定时汇总结果：source=scheduled_summary）
          - syncNotes -> widget_note
        -->
        <el-checkbox v-model="prefs.syncTasks" :disabled="loading || saving" @change="savePrefs">
          任务（分类）
        </el-checkbox>
        <el-checkbox v-model="prefs.syncConfig" :disabled="loading || saving" @change="savePrefs">
          配置
        </el-checkbox>
        <el-checkbox
          v-model="prefs.syncSummaryResults"
          :disabled="loading || saving"
          @change="savePrefs"
        >
          定时汇总结果
        </el-checkbox>
        <el-checkbox v-model="prefs.syncNotes" :disabled="loading || saving" @change="savePrefs">
          便签
        </el-checkbox>
      </div>
      <p class="settings-section__subhint">
        配置含快捷键、LLM（含 API Key）、提示词、关闭行为、动态保留、挂件启动项、界面偏好、自定义视图与定时汇总配置。定时汇总结果为站内「定时汇总」消息正文。
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
      <div class="settings-section__auth-toggle">
        <el-radio-group v-model="authMode" :disabled="loading || saving">
          <el-radio-button value="login">登录</el-radio-button>
          <el-radio-button value="register">注册</el-radio-button>
        </el-radio-group>
      </div>
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
          :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'"
        />
      </div>
      <template v-if="authMode === 'register'">
        <div class="settings-section__field settings-section__field--stack">
          <span class="settings-section__label">邮箱</span>
          <el-input
            v-model="email"
            type="email"
            placeholder="用于找回账号与通知"
            :disabled="loading || saving"
            autocomplete="email"
          />
        </div>
        <div class="settings-section__field settings-section__field--stack">
          <span class="settings-section__label">手机号（选填）</span>
          <el-input
            v-model="phonenumber"
            placeholder="可选"
            :disabled="loading || saving"
            autocomplete="tel"
          />
        </div>
      </template>
      <div class="settings-section__actions">
        <el-button
          v-if="authMode === 'login'"
          type="primary"
          :loading="saving"
          :disabled="loading"
          @click="login"
        >
          登录并同步
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="saving"
          :disabled="loading"
          @click="registerAccount"
        >
          注册并同步
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

    <el-dialog
      v-model="dataPolicyVisible"
      title="本机数据与当前账号不一致"
      width="480px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <p class="settings-section__policy-lead">
        账号「{{ dataPolicyUsername }}」登录成功。本机仍有
        <strong>{{ dataPolicySummary.taskCount }}</strong> 条任务、
        <strong>{{ dataPolicySummary.categoryCount }}</strong> 个分类、
        <strong>{{ dataPolicySummary.noteCount }}</strong> 条便签等数据，
        可能来自离线使用或其它账号。请选择如何处理：
      </p>
      <ul class="settings-section__policy-list">
        <li><strong>合并到当前账号</strong>：保留本机数据并上传到云端（可能与云端按时间合并）。</li>
        <li><strong>清空本机数据</strong>：删除本机 Todo 数据，仅同步当前账号云端内容。</li>
        <li><strong>取消登录</strong>：不保存登录状态，本机数据不变。</li>
      </ul>
      <template #footer>
        <el-button :disabled="saving" @click="resolveDataPolicy('cancel')">取消登录</el-button>
        <el-button type="warning" :disabled="saving" @click="resolveDataPolicy('clear')">
          清空本机数据
        </el-button>
        <el-button type="primary" :loading="saving" @click="resolveDataPolicy('merge')">
          合并到当前账号
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_SYNC_SERVER_URL,
  type DesktopSyncStatus,
  type LocalSyncDataSummary,
  type SyncAuthResult,
  type SyncLoginDataPolicy
} from '@shared/sync-protocol'
import {
  DEFAULT_SYNC_PREFERENCES,
  SYNC_INTERVAL_OPTIONS_MS,
  syncIntervalLabel,
  type SyncPreferences
} from '@shared/sync-preferences'
import { unwrapIpc } from '@/ipc/client'
import { collectUiPreferences } from '@/utils/ui-preferences-export'
import { loadLastSyncUsername, saveLastSyncUsername } from '@/utils/sync-auth-preferences'

const status = ref<DesktopSyncStatus | null>(null)
const serverUrl = ref(DEFAULT_SYNC_SERVER_URL)
const authMode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const email = ref('')
const phonenumber = ref('')
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const prefs = reactive<SyncPreferences>({ ...DEFAULT_SYNC_PREFERENCES })
const dataPolicyVisible = ref(false)
const dataPolicyUsername = ref('')
const dataPolicySummary = reactive<LocalSyncDataSummary>({
  taskCount: 0,
  categoryCount: 0,
  noteCount: 0
})
let dataPolicyResolver: ((policy: SyncLoginDataPolicy) => void) | null = null

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
        syncSummaryResults: prefs.syncSummaryResults,
        syncNotes: prefs.syncNotes,
        syncIntervalMs: prefs.syncIntervalMs
      })
    )
    Object.assign(prefs, next)
  } catch {
    /* unwrapIpc 已 Toast */
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
  } catch {
    /* unwrapIpc 已 Toast */
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
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

/** 等待用户在弹窗中选择本机数据策略 */
function waitForDataPolicy(username: string, summary: LocalSyncDataSummary): Promise<SyncLoginDataPolicy> {
  dataPolicyUsername.value = username
  dataPolicySummary.taskCount = summary.taskCount
  dataPolicySummary.categoryCount = summary.categoryCount
  dataPolicySummary.noteCount = summary.noteCount
  dataPolicyVisible.value = true
  return new Promise((resolve) => {
    dataPolicyResolver = resolve
  })
}

function resolveDataPolicy(policy: SyncLoginDataPolicy) {
  dataPolicyVisible.value = false
  dataPolicyResolver?.(policy)
  dataPolicyResolver = null
}

/** 处理 login/register 返回：必要时弹窗并完成二次 confirm */
async function finishAuthFlow(initial: SyncAuthResult): Promise<boolean> {
  if (initial.kind === 'completed') {
    return true
  }
  if (initial.kind !== 'needs_data_policy') {
    return false
  }
  saving.value = false
  const policy = await waitForDataPolicy(initial.username, initial.summary)
  saving.value = true
  try {
    const next = unwrapIpc(await window.api.sync.completeLogin({ policy }))
    if (next.kind === 'cancelled') {
      ElMessage.info('已取消登录，本机数据未改动')
      return false
    }
    if (next.kind === 'completed') {
      if (policy === 'clear') {
        ElMessage.success('已清空本机数据并开始同步云端')
      } else {
        ElMessage.success('已合并本机数据并开始同步')
      }
      return true
    }
    return false
  } finally {
    saving.value = false
  }
}

async function registerAccount() {
  const trimmedUser = username.value.trim()
  const trimmedEmail = email.value.trim()
  if (!trimmedUser || !password.value) {
    ElMessage.warning('请填写用户名和密码')
    return
  }
  if (!trimmedEmail) {
    ElMessage.warning('请填写邮箱')
    return
  }
  saving.value = true
  try {
    await reportUiPrefs()
    if (serverUrl.value.trim()) {
      unwrapIpc(await window.api.sync.setServerUrl(serverUrl.value))
    }
    const dto: import('@shared/sync-protocol').SyncRegisterRequest = {
      username: trimmedUser,
      password: password.value,
      email: trimmedEmail
    }
    const phone = phonenumber.value.trim()
    if (phone) {
      dto.phonenumber = phone
    }
    const authResult = unwrapIpc(await window.api.sync.register(dto))
    const ok = await finishAuthFlow(authResult)
    if (!ok) {
      return
    }
    saveLastSyncUsername(trimmedUser)
    password.value = ''
    email.value = ''
    phonenumber.value = ''
    if (authResult.kind === 'completed') {
      ElMessage.success('注册成功，已开始同步')
    }
    await refreshStatus()
  } catch {
    /* unwrapIpc 已 Toast */
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
    const authResult = unwrapIpc(
      await window.api.sync.login({
        username: username.value.trim(),
        password: password.value
      })
    )
    const ok = await finishAuthFlow(authResult)
    if (!ok) {
      return
    }
    saveLastSyncUsername(username.value.trim())
    password.value = ''
    if (authResult.kind === 'completed') {
      ElMessage.success('登录成功，已开始同步')
    }
    await refreshStatus()
  } catch {
    /* unwrapIpc 已 Toast */
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
  } catch {
    /* unwrapIpc 已 Toast */
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
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  username.value = loadLastSyncUsername()
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

.settings-section__auth-toggle {
  margin-bottom: 12px;
}

.settings-section__error {
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  color: var(--el-color-danger);
  font-size: 13px;
}

.settings-section__policy-lead {
  margin: 0 0 12px;
  line-height: 1.6;
  font-size: 14px;
}

.settings-section__policy-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.7;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
