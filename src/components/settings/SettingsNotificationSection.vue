<template>
  <section class="settings-section">
    <h2 class="settings-section__title">通知管理</h2>
    <p class="settings-section__hint">
      配置系统托盘与外部推送。外部渠道（IYUU / Webhook）互斥，仅生效一个；站内消息始终保留。
    </p>

    <div v-if="loggedIn" class="settings-section__banner settings-section__banner--ok">
      已登录：可按下方时机经服务器代发；关闭客户端且租约过期后，离线代发开启时到点外发。
    </div>
    <div v-else class="settings-section__banner">
      未登录：外发仅本机直连生效渠道；关闭客户端后不会云端代发。
    </div>

    <div class="settings-section__field">
      <div>
        <span class="settings-section__label">系统托盘通知</span>
        <p class="settings-section__subhint">到期提醒、定时汇总时弹出操作系统通知（不受免打扰影响）</p>
      </div>
      <el-switch v-model="config.systemTrayEnabled" :disabled="loading || saving" @change="saveConfig" />
    </div>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">生效渠道</span>
      <el-radio-group v-model="config.activeChannel" :disabled="loading || saving">
        <el-radio-button value="iyuu">IYUU</el-radio-button>
        <el-radio-button value="webhook">Webhook</el-radio-button>
      </el-radio-group>

      <template v-if="config.activeChannel === 'iyuu'">
        <div class="settings-section__row-between">
          <span class="settings-section__label">爱语飞飞（IYUU）</span>
          <a class="settings-section__link" href="https://iyuu.cn/article/2" target="_blank" rel="noopener"
            >接口说明</a
          >
        </div>
        <el-input
          v-model="config.iyuu.token"
          type="password"
          show-password
          placeholder="IYUU 令牌"
          :disabled="loading || saving"
        />
        <div class="settings-section__checks">
          <el-checkbox v-model="iyuuReminder" :disabled="loading || saving" label="任务提醒" />
          <el-checkbox v-model="iyuuSummary" :disabled="loading || saving" label="定时汇总" />
        </div>
        <div class="settings-section__actions">
          <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">保存</el-button>
          <el-button :loading="testing" :disabled="loading || saving" @click="testIyuu">测试发送</el-button>
        </div>
      </template>

      <template v-else>
        <el-input v-model="config.webhook.name" placeholder="名称" :disabled="loading || saving" />
        <el-input v-model="config.webhook.url" placeholder="https://..." :disabled="loading || saving" />
        <div class="settings-section__checks">
          <el-checkbox v-model="whReminder" :disabled="loading || saving" label="任务提醒" />
          <el-checkbox v-model="whSummary" :disabled="loading || saving" label="定时汇总" />
        </div>
        <p class="settings-section__subhint">固定 POST，Body 为 JSON（title / body / event / entityId / firedAt）。</p>
        <div class="settings-section__actions">
          <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">保存</el-button>
          <el-button :loading="testing" :disabled="loading || saving" @click="testWebhook">测试发送</el-button>
        </div>
      </template>
    </div>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">外发时机</span>
      <div class="settings-section__row-between">
        <div>
          <span>客户端在线代发</span>
          <p class="settings-section__subhint">已登录且本机在线时经服务器代发</p>
        </div>
        <el-switch v-model="config.relayWhenOnline" :disabled="loading || saving" />
      </div>
      <div class="settings-section__row-between">
        <div>
          <span>客户端离线代发</span>
          <p class="settings-section__subhint">关端租约过期后由服务器到点外发</p>
        </div>
        <el-switch v-model="config.relayWhenOffline" :disabled="loading || saving" />
      </div>
      <div class="settings-section__row-between">
        <div>
          <span>每日免打扰</span>
          <p class="settings-section__subhint">时段内外发延后到结束时刻补发；站内/托盘仍可用</p>
        </div>
        <el-switch v-model="config.quietHours.enabled" :disabled="loading || saving" />
      </div>
      <div v-if="config.quietHours.enabled" class="settings-section__quiet">
        <el-time-select
          v-model="config.quietHours.start"
          start="00:00"
          step="00:30"
          end="23:30"
          placeholder="开始"
          :disabled="loading || saving"
        />
        <span>至</span>
        <el-time-select
          v-model="config.quietHours.end"
          start="00:00"
          step="00:30"
          end="23:30"
          placeholder="结束"
          :disabled="loading || saving"
        />
      </div>
      <div class="settings-section__actions">
        <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">保存时机</el-button>
      </div>
    </div>

    <div class="settings-section__field settings-section__field--stack">
      <div class="settings-section__row-between">
        <span class="settings-section__label">待发送</span>
        <el-button text type="primary" :disabled="loading" @click="refreshPending">刷新</el-button>
      </div>
      <el-table :data="pending" size="small" empty-text="暂无待发送">
        <el-table-column label="类型" min-width="80">
          <template #default="{ row }">
            {{ kindLabel(row.kind) }}
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column label="计划时间" min-width="160">
          <template #default="{ row }">
            {{ formatChinaDateTime(row.deferredTo || row.fireAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="70" />
      </el-table>
    </div>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">最近投递</span>
      <el-table :data="deliveries" size="small" empty-text="暂无记录">
        <el-table-column label="时间" min-width="140">
          <template #default="{ row }">
            {{ formatChinaDateTime(row.at) }}
          </template>
        </el-table-column>
        <el-table-column prop="event" label="事件" min-width="100">
          <template #default="{ row }">
            {{ row.event === 'task_reminder' ? '任务提醒' : '定时汇总' }}
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" min-width="100" />
        <el-table-column label="结果" min-width="120">
          <template #default="{ row }">
            <span :class="row.ok ? 'is-ok' : 'is-fail'">{{ row.ok ? '成功' : row.message || '失败' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_NOTIFICATION_CONFIG,
  mergeNotificationConfig,
  type NotificationConfig,
  type NotifyDeliveryRecord,
  type NotifyEvent,
  type PendingNotifyItem
} from '@shared/notification-config'
import { unwrapIpc } from '@/ipc/client'
import { formatChinaDateTime } from '@/utils/datetime'

const config = reactive<NotificationConfig>(mergeNotificationConfig())
const deliveries = ref<NotifyDeliveryRecord[]>([])
const pending = ref<PendingNotifyItem[]>([])
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const loggedIn = ref(false)

const iyuuReminder = computed({
  get: () => config.iyuu.events.includes('task_reminder'),
  set: (v: boolean) => setChannelEvent('iyuu', 'task_reminder', v)
})
const iyuuSummary = computed({
  get: () => config.iyuu.events.includes('scheduled_summary'),
  set: (v: boolean) => setChannelEvent('iyuu', 'scheduled_summary', v)
})
const whReminder = computed({
  get: () => config.webhook.events.includes('task_reminder'),
  set: (v: boolean) => setChannelEvent('webhook', 'task_reminder', v)
})
const whSummary = computed({
  get: () => config.webhook.events.includes('scheduled_summary'),
  set: (v: boolean) => setChannelEvent('webhook', 'scheduled_summary', v)
})

function setChannelEvent(which: 'iyuu' | 'webhook', event: NotifyEvent, on: boolean) {
  // 生效渠道配置中：
  // - activeChannel 决定“对外推送”走 IYUU 还是 Webhook；
  // - iyuu.events / webhook.events 用来控制哪些 event 允许从该渠道发出。
  // 这里的逻辑只更新 events 数组（不是切换 activeChannel）。
  const target = which === 'iyuu' ? config.iyuu : config.webhook
  const set = new Set(target.events)
  if (on) set.add(event)
  else set.delete(event)
  target.events = set.size
    ? ([...set] as NotifyEvent[])
    : [...DEFAULT_NOTIFICATION_CONFIG.iyuu.events]
}

function kindLabel(kind: string) {
  if (kind === 'deferred') return '延后'
  if (kind === 'queued') return '队列'
  return '即将'
}

async function refreshPending() {
  try {
    pending.value = unwrapIpc(await window.api.notify.listPending())
  } catch {
    pending.value = []
  }
}

async function refresh() {
  loading.value = true
  try {
    const next = unwrapIpc(await window.api.notify.getConfig())
    Object.assign(config, mergeNotificationConfig(next))
    deliveries.value = unwrapIpc(await window.api.notify.listDeliveries())
    await refreshPending()
    try {
      const status = unwrapIpc(await window.api.sync.getStatus())
      loggedIn.value = status.loggedIn
    } catch {
      loggedIn.value = false
    }
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const next = unwrapIpc(await window.api.notify.setConfig(mergeNotificationConfig(config)))
    Object.assign(config, next)
    ElMessage.success('通知配置已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function testIyuu() {
  testing.value = true
  try {
    const result = unwrapIpc(await window.api.notify.testIyuu(config.iyuu.token))
    if (result.ok) ElMessage.success(result.message || '发送成功')
    else ElMessage.error(result.message || '发送失败')
    deliveries.value = unwrapIpc(await window.api.notify.listDeliveries())
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '测试失败')
  } finally {
    testing.value = false
  }
}

async function testWebhook() {
  testing.value = true
  try {
    const result = unwrapIpc(await window.api.notify.testWebhook(config.webhook.url))
    if (result.ok) ElMessage.success(result.message || '发送成功')
    else ElMessage.error(result.message || '发送失败')
    deliveries.value = unwrapIpc(await window.api.notify.listDeliveries())
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '测试失败')
  } finally {
    testing.value = false
  }
}

onMounted(refresh)
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
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
}

.settings-section__banner {
  padding: 10px 12px;
  margin-bottom: 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.5;
  background: color-mix(in srgb, var(--el-color-warning) 12%, transparent);
  color: var(--el-color-warning-dark-2, #92400e);
}

.settings-section__banner--ok {
  background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  color: var(--el-color-success-dark-2, #065f46);
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

.settings-section__row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.settings-section__link {
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;
}

.settings-section__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin: 10px 0;
}

.settings-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.settings-section__quiet {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

.is-ok {
  color: var(--el-color-success);
}

.is-fail {
  color: var(--el-color-danger);
}
</style>
