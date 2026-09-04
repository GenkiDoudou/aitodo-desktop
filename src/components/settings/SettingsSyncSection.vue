<template>
  <!--
    账号与同步：贴 preview.html 账号 / 同步 / 同步内容三栏 panel。
    保留真实登录、偏好与同步 IPC。
  -->
  <section class="settings-section">
    <div class="settings-panel">
      <h2 class="settings-panel__title">账号</h2>
      <div class="settings-panel__body">
        <template v-if="status?.loggedIn">
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">{{ status.username }}</div>
              <div class="settings-row__label-desc">设备 ID：{{ status.deviceId }}</div>
            </div>
            <div class="settings-row__control">
              <el-button @click="onAccountManage">账号管理</el-button>
              <el-button :disabled="loading || saving" @click="logout">退出登录</el-button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">服务器地址</div>
              <div class="settings-row__label-desc">自建 Sync Server，未登录时数据仅存本机</div>
            </div>
            <div class="settings-row__control settings-row__control--grow">
              <el-input
                v-model="serverUrl"
                placeholder="https://aitodo.126w.com"
                :disabled="loading || saving"
                style="width: 260px"
              />
              <el-button :loading="testing" :disabled="loading || saving" @click="testServer">
                测试
              </el-button>
              <el-button :disabled="loading || saving" @click="saveServerUrl">保存</el-button>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">{{ authMode === 'login' ? '登录' : '注册' }}</div>
              <div class="settings-row__label-desc">登录后可在多设备间同步任务与设置</div>
            </div>
            <div class="settings-row__control">
              <el-radio-group v-model="authMode" :disabled="loading || saving" size="small">
                <el-radio-button value="login">登录</el-radio-button>
                <el-radio-button value="register">注册</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">用户名</div>
            </div>
            <div class="settings-row__control">
              <el-input
                v-model="username"
                :disabled="loading || saving"
                autocomplete="username"
                style="width: 220px"
              />
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">密码</div>
            </div>
            <div class="settings-row__control">
              <el-input
                v-model="password"
                type="password"
                show-password
                :disabled="loading || saving"
                style="width: 220px"
                :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'"
              />
            </div>
          </div>
          <template v-if="authMode === 'register'">
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-title">邮箱</div>
              </div>
              <div class="settings-row__control">
                <el-input
                  v-model="email"
                  type="email"
                  placeholder="用于找回账号"
                  :disabled="loading || saving"
                  style="width: 220px"
                />
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-row__label">
                <div class="settings-row__label-title">手机号（选填）</div>
              </div>
              <div class="settings-row__control">
                <el-input
                  v-model="phonenumber"
                  :disabled="loading || saving"
                  style="width: 220px"
                />
              </div>
            </div>
          </template>
          <div class="settings-row">
            <div class="settings-row__label" />
            <div class="settings-row__control">
              <el-button
                type="primary"
                :loading="saving"
                :disabled="loading"
                @click="authMode === 'login' ? login() : registerAccount()"
              >
                {{ authMode === 'login' ? '登录并同步' : '注册并同步' }}
              </el-button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">同步</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">自动同步</div>
            <div class="settings-row__label-desc">有网络时按间隔自动同步本地变更</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              :model-value="autoSyncOn"
              :disabled="loading || saving || !status?.loggedIn"
              @change="onAutoSyncChange"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">同步频率</div>
            <div class="settings-row__label-desc">仅登录后生效</div>
          </div>
          <div class="settings-row__control">
            <el-select
              v-model="prefs.syncIntervalMs"
              style="width: 140px"
              :disabled="loading || saving || !status?.loggedIn"
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
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">同步状态</div>
            <div class="settings-row__label-desc">
              上次同步：{{ status?.lastSyncAt || '尚未同步' }}
              <template v-if="status?.loggedIn"> · 待推送 {{ status.pendingCount }}</template>
            </div>
          </div>
          <div class="settings-row__control">
            <el-button
              type="primary"
              :loading="saving"
              :disabled="loading || !status?.loggedIn"
              @click="triggerSync"
            >
              立即同步
            </el-button>
          </div>
        </div>
        <div v-if="status?.lastError" class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">最近错误</div>
            <div class="settings-row__label-desc settings-row__label-desc--error">
              {{ status.lastError }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">同步内容</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">任务</div>
            <div class="settings-row__label-desc">含子任务、标签、清单、提醒</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              v-model="prefs.syncTasks"
              :disabled="loading || saving"
              @change="savePrefs"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">配置与规则</div>
            <div class="settings-row__label-desc">快捷键、LLM、提示词、视图与汇总配置等</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              v-model="prefs.syncConfig"
              :disabled="loading || saving"
              @change="savePrefs"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">定时汇总</div>
            <div class="settings-row__label-desc">定时汇总结果消息</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              v-model="prefs.syncSummaryResults"
              :disabled="loading || saving"
              @change="savePrefs"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">便签</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              v-model="prefs.syncNotes"
              :disabled="loading || saving"
              @change="savePrefs"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">附件</div>
            <div class="settings-row__label-desc">附件同步即将支持</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              :model-value="attachSync"
              @change="(v: string | number | boolean) => onAttachSync(Boolean(v))"
            />
          </div>
        </div>
      </div>
    </div>

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
import { computed, onMounted, reactive, ref } from 'vue'
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
const attachSync = ref(false)
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

/** 自动同步：有登录即视为开启（间隔由下方控制） */
const autoSyncOn = computed(() => Boolean(status.value?.loggedIn))

function onAccountManage() {
  ElMessage.info('请通过服务器地址、登录与退出管理账号')
}

function onAutoSyncChange(on: string | number | boolean) {
  if (!on) {
    ElMessage.info('关闭自动同步后仍可手动「立即同步」；间隔设置在登录后生效')
  }
}

function onAttachSync(on: boolean) {
  attachSync.value = on
  ElMessage.info(on ? '附件同步即将支持，已记录偏好' : '已关闭附件同步偏好')
}

async function reportUiPrefs() {
  try {
    unwrapIpc(await window.api.sync.reportUiPreferences(collectUiPreferences()))
  } catch {
    /* 忽略 */
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
    await refreshStatus()
  } finally {
    saving.value = false
  }
}

async function testServer() {
  testing.value = true
  try {
    const result = unwrapIpc(await window.api.sync.testServerUrl(serverUrl.value))
    if (result.ok) ElMessage.success(result.message)
    else ElMessage.error(result.message)
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

function waitForDataPolicy(user: string, summary: LocalSyncDataSummary): Promise<SyncLoginDataPolicy> {
  dataPolicyUsername.value = user
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

async function finishAuthFlow(initial: SyncAuthResult): Promise<boolean> {
  if (initial.kind === 'completed') return true
  if (initial.kind !== 'needs_data_policy') return false
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
      ElMessage.success(
        policy === 'clear' ? '已清空本机数据并开始同步云端' : '已合并本机数据并开始同步'
      )
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
    if (phone) dto.phonenumber = phone
    const authResult = unwrapIpc(await window.api.sync.register(dto))
    const ok = await finishAuthFlow(authResult)
    if (!ok) return
    saveLastSyncUsername(trimmedUser)
    password.value = ''
    email.value = ''
    phonenumber.value = ''
    if (authResult.kind === 'completed') ElMessage.success('注册成功，已开始同步')
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
    if (!ok) return
    saveLastSyncUsername(username.value.trim())
    password.value = ''
    if (authResult.kind === 'completed') ElMessage.success('登录成功，已开始同步')
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
    if (status.value.lastError) ElMessage.warning(status.value.lastError)
    else ElMessage.success('同步完成')
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
.settings-row__control--grow {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.settings-row__label-desc--error {
  color: var(--el-color-danger);
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
