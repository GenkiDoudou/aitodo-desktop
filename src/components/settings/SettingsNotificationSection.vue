<template>
  <!--
    通知管理：贴 preview.html「应用通知 / 通知时间 / 通知渠道」panel 结构。
    保留托盘、免打扰、IYUU/Webhook 真实配置。
  -->
  <section class="settings-section">
    <div class="settings-notice">
      {{
        loggedIn
          ? '已登录：可按下方时机经服务器代发；关闭客户端且租约过期后，离线代发开启时到点外发。'
          : '未登录：外发仅本机直连生效渠道；关闭客户端后不会云端代发。'
      }}
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">应用通知</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">桌面通知</div>
            <div class="settings-row__label-desc">任务提醒到期时显示系统托盘通知</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              v-model="config.systemTrayEnabled"
              :disabled="loading || saving"
              @change="saveConfig"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">任务提醒</div>
            <div class="settings-row__label-desc">根据任务提醒规则发送通知</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              :model-value="activeReminderOn"
              :disabled="loading || saving"
              @change="onActiveReminder"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">定时汇总</div>
            <div class="settings-row__label-desc">汇总生成后通知我</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              :model-value="activeSummaryOn"
              :disabled="loading || saving"
              @change="onActiveSummary"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">通知时间</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">免打扰</div>
            <div class="settings-row__label-desc">开启后不在指定时间外发通知</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="config.quietHours.enabled" :disabled="loading || saving" />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">免打扰时间</div>
            <div class="settings-row__label-desc">
              {{ config.quietHours.start || '22:00' }} — {{ config.quietHours.end || '08:00' }}
            </div>
          </div>
          <div class="settings-row__control">
            <el-time-select
              v-model="config.quietHours.start"
              start="00:00"
              step="00:30"
              end="23:30"
              placeholder="开始"
              :disabled="loading || saving || !config.quietHours.enabled"
              style="width: 110px"
            />
            <span>至</span>
            <el-time-select
              v-model="config.quietHours.end"
              start="00:00"
              step="00:30"
              end="23:30"
              placeholder="结束"
              :disabled="loading || saving || !config.quietHours.enabled"
              style="width: 110px"
            />
            <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">
              保存
            </el-button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">客户端在线代发</div>
            <div class="settings-row__label-desc">已登录且本机在线时经服务器代发</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="config.relayWhenOnline" :disabled="loading || saving" />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">客户端离线代发</div>
            <div class="settings-row__label-desc">关端租约过期后由服务器到点外发</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="config.relayWhenOffline" :disabled="loading || saving" />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">通知渠道</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">应用内通知</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox :model-value="true" disabled />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">系统通知</div>
          </div>
          <div class="settings-row__control">
            <el-checkbox
              :model-value="config.systemTrayEnabled"
              :disabled="loading || saving"
              @change="(v: string | number | boolean) => {
                config.systemTrayEnabled = Boolean(v)
                void saveConfig()
              }"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">生效外发渠道</div>
            <div class="settings-row__label-desc">IYUU 与 Webhook 互斥，仅生效一个</div>
          </div>
          <div class="settings-row__control">
            <el-radio-group v-model="config.activeChannel" :disabled="loading || saving" size="small">
              <el-radio-button value="iyuu">IYUU</el-radio-button>
              <el-radio-button value="webhook">Webhook</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <template v-if="config.activeChannel === 'iyuu'">
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">爱语飞飞（IYUU）</div>
              <div class="settings-row__label-desc">
                <a href="https://iyuu.cn/article/2" target="_blank" rel="noopener">接口说明</a>
              </div>
            </div>
            <div class="settings-row__control">
              <el-input
                v-model="config.iyuu.token"
                type="password"
                show-password
                placeholder="IYUU 令牌"
                :disabled="loading || saving"
                style="width: 220px"
              />
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">IYUU 事件</div>
            </div>
            <div class="settings-row__control">
              <el-checkbox v-model="iyuuReminder" :disabled="loading || saving" label="任务提醒" />
              <el-checkbox v-model="iyuuSummary" :disabled="loading || saving" label="定时汇总" />
              <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">
                保存
              </el-button>
              <el-button :loading="testing" :disabled="loading || saving" @click="testIyuu">
                测试
              </el-button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">Webhook</div>
              <div class="settings-row__label-desc">POST JSON（title / body / event / entityId）</div>
            </div>
            <div class="settings-row__control settings-row__control--stack">
              <el-input
                v-model="config.webhook.name"
                placeholder="名称"
                :disabled="loading || saving"
                style="width: 140px"
              />
              <el-input
                v-model="config.webhook.url"
                placeholder="https://..."
                :disabled="loading || saving"
                style="width: 240px"
              />
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row__label">
              <div class="settings-row__label-title">Webhook 事件</div>
            </div>
            <div class="settings-row__control">
              <el-checkbox v-model="whReminder" :disabled="loading || saving" label="任务提醒" />
              <el-checkbox v-model="whSummary" :disabled="loading || saving" label="定时汇总" />
              <el-button type="primary" :loading="saving" :disabled="loading" @click="saveConfig">
                保存
              </el-button>
              <el-button :loading="testing" :disabled="loading || saving" @click="testWebhook">
                测试
              </el-button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">投递状态</h2>
      <div class="settings-panel__body">
        <div class="settings-row settings-row--block">
          <div class="settings-row__label">
            <div class="settings-row__label-title">待发送</div>
          </div>
          <div class="settings-row__control">
            <el-button text type="primary" :disabled="loading" @click="refreshPending">刷新</el-button>
          </div>
        </div>
        <div class="settings-table-wrap">
          <el-table :data="pending" size="small" empty-text="暂无待发送">
            <el-table-column label="类型" min-width="80">
              <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="140" />
            <el-table-column label="计划时间" min-width="160">
              <template #default="{ row }">
                {{ formatChinaDateTime(row.deferredTo || row.fireAt) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="settings-table-wrap">
          <p class="settings-table-caption">最近投递</p>
          <el-table :data="deliveries" size="small" empty-text="暂无记录">
            <el-table-column label="时间" min-width="140">
              <template #default="{ row }">{{ formatChinaDateTime(row.at) }}</template>
            </el-table-column>
            <el-table-column label="事件" min-width="100">
              <template #default="{ row }">
                {{ row.event === 'task_reminder' ? '任务提醒' : '定时汇总' }}
              </template>
            </el-table-column>
            <el-table-column prop="channel" label="渠道" min-width="100" />
            <el-table-column label="结果" min-width="120">
              <template #default="{ row }">
                <span :class="row.ok ? 'is-ok' : 'is-fail'">{{
                  row.ok ? '成功' : row.message || '失败'
                }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
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

const activeChannel = computed(() =>
  config.activeChannel === 'iyuu' ? config.iyuu : config.webhook
)

const activeReminderOn = computed(() => activeChannel.value.events.includes('task_reminder'))
const activeSummaryOn = computed(() => activeChannel.value.events.includes('scheduled_summary'))

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
  const target = which === 'iyuu' ? config.iyuu : config.webhook
  const set = new Set(target.events)
  if (on) set.add(event)
  else set.delete(event)
  target.events = set.size
    ? ([...set] as NotifyEvent[])
    : [...DEFAULT_NOTIFICATION_CONFIG.iyuu.events]
}

function onActiveReminder(on: string | number | boolean) {
  setChannelEvent(config.activeChannel, 'task_reminder', Boolean(on))
  void saveConfig()
}

function onActiveSummary(on: string | number | boolean) {
  setChannelEvent(config.activeChannel, 'scheduled_summary', Boolean(on))
  void saveConfig()
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
      const syncStatus = unwrapIpc(await window.api.sync.getStatus())
      loggedIn.value = syncStatus.loggedIn
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
.settings-row__control--stack {
  flex-wrap: wrap;
}

.settings-row--block {
  border-bottom: none;
}

.settings-table-wrap {
  padding: 0 18px 16px;
}

.settings-table-caption {
  margin: 8px 0 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--desktop-text);
}

.is-ok {
  color: var(--el-color-success);
}

.is-fail {
  color: var(--el-color-danger);
}
</style>
