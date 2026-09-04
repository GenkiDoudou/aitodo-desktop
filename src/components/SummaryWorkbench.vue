<template>
  <!--
    定时汇总工作台：对齐 preview (1).html 的 summary 视图。
    展示配置摘要、概览卡片、最近汇总正文；编辑配置 / 立即生成走现有 store。
  -->
  <section class="summary-wb" v-loading="loading">
    <header class="summary-wb__toolbar">
      <div class="summary-wb__head-left">
        <h1 class="summary-wb__title">定时汇总</h1>
        <span class="summary-wb__muted">自动生成周期工作总结</span>
      </div>
      <div class="summary-wb__actions">
        <el-button @click="configOpen = true">编辑配置</el-button>
        <el-button type="primary" :loading="running" @click="runNow">立即生成</el-button>
      </div>
    </header>

    <div v-if="primaryConfig" class="summary-wb__card">
      <h3>{{ primaryConfig.name }}</h3>
      <p class="summary-wb__muted">
        {{ scheduleLabel(primaryConfig) }} · {{ sendTimeLabel(primaryConfig) }}
        <template v-if="reportHint(primaryConfig)"> · {{ reportHint(primaryConfig) }}</template>
      </p>
    </div>
    <div v-else class="summary-wb__card summary-wb__card--empty">
      <h3>尚未配置汇总</h3>
      <p class="summary-wb__muted">点击「编辑配置」创建定时汇总任务</p>
    </div>

    <div class="summary-wb__quad">
      <div class="summary-wb__card">
        <h3>本周概览</h3>
        <div class="summary-wb__stat">{{ weekDoneCount }}</div>
        <p class="summary-wb__muted">已完成任务</p>
      </div>
      <div class="summary-wb__card">
        <h3>最近一次</h3>
        <div class="summary-wb__stat summary-wb__stat--sm">
          {{ latestReport ? formatDate(latestReport.createdAt) : '—' }}
        </div>
        <p class="summary-wb__muted">
          {{ latestReport ? '状态：已生成' : '暂无生成记录' }}
        </p>
      </div>
    </div>

    <div class="summary-wb__reports">
      <h3 class="summary-wb__section-title">最近汇总</h3>
      <p v-if="!loading && reports.length === 0" class="summary-wb__empty">
        暂无汇总报告。配置启用后到点会自动生成，也可点击「立即生成」。
      </p>
      <article
        v-for="report in reports"
        :key="report.id"
        class="summary-wb__report"
        :class="{ 'is-unread': !report.readAt }"
      >
        <header class="summary-wb__report-head">
          <strong>{{ displayTitle(report) }}</strong>
          <time>{{ formatTime(report.createdAt) }}</time>
        </header>
        <pre v-if="report.body" class="summary-wb__report-body">{{ report.body }}</pre>
        <footer v-if="!report.readAt" class="summary-wb__report-foot">
          <el-button size="small" text type="primary" @click="markRead(report.id)">标为已读</el-button>
        </footer>
      </article>
    </div>

    <el-dialog
      v-model="configOpen"
      title="定时汇总配置"
      width="720px"
      top="4vh"
      destroy-on-close
      append-to-body
      class="summary-wb__dialog"
      @closed="onConfigClosed"
    >
      <SettingsSummarySection embedded />
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AppMessage, ScheduledSummary } from '@shared/types'
import { useScheduledSummaryStore } from '@/stores/scheduled-summary-store'
import { useMessageStore } from '@/stores/message-store'
import { useTaskStore } from '@/stores/task-store'
import SettingsSummarySection from '@/components/settings/SettingsSummarySection.vue'
import dayjs from 'dayjs'

const summaryStore = useScheduledSummaryStore()
const messageStore = useMessageStore()
const taskStore = useTaskStore()

const loading = ref(false)
const running = ref(false)
const configOpen = ref(false)

const reports = computed(() => messageStore.summaryReports)
const primaryConfig = computed(() => summaryStore.items[0] ?? null)
const latestReport = computed(() => reports.value[0] ?? null)

/** 本周已完成任务数（客户端粗算，贴原型概览卡） */
const weekDoneCount = computed(() => {
  const start = dayjs().startOf('week')
  return taskStore.tasks.filter(
    (t) =>
      t.status === 'DONE' &&
      !t.deletedAt &&
      t.completedAt &&
      dayjs(t.completedAt).isAfter(start)
  ).length
})

function scheduleLabel(item: ScheduledSummary) {
  if (item.scheduleType === 'daily') return '每天'
  if (item.scheduleType === 'weekly') return '每周'
  if (item.scheduleType === 'monthly') return '每月'
  return item.scheduleType
}

function sendTimeLabel(item: ScheduledSummary) {
  return item.sendTime || '—'
}

function reportHint(item: ScheduledSummary) {
  const mode = item.reportConfig?.mode
  if (mode === 'template') return '自由模板'
  return '表单配置'
}

function displayTitle(report: AppMessage) {
  return report.title.replace(/^定时汇总：/, '')
}

function formatTime(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}

function formatDate(iso: string) {
  return iso.slice(0, 10)
}

async function markRead(id: string) {
  try {
    await messageStore.markRead(id)
    ElMessage.success('已标为已读')
  } catch {
    /* store toast */
  }
}

async function runNow() {
  const item = primaryConfig.value
  if (!item) {
    configOpen.value = true
    ElMessage.info('请先创建汇总配置')
    return
  }
  running.value = true
  try {
    await summaryStore.runNow(item.id)
    await messageStore.loadSummaryReports(50)
    ElMessage.success('汇总已生成')
  } catch {
    /* store toast */
  } finally {
    running.value = false
  }
}

async function onConfigClosed() {
  await summaryStore.load()
  await messageStore.loadSummaryReports(50)
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([summaryStore.load(), messageStore.loadSummaryReports(50), taskStore.load()])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.summary-wb {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 24px 28px;
}

.summary-wb__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.summary-wb__head-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.summary-wb__title {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
}

.summary-wb__muted {
  color: #909399;
  font-size: 12px;
}

.summary-wb__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.summary-wb__card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
  background: #fff;
  margin-bottom: 12px;

  h3 {
    margin: 0 0 9px;
    font-size: 14px;
  }

  &--empty {
    background: #fafafa;
  }
}

.summary-wb__quad {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.summary-wb__stat {
  font-size: 28px;
  font-weight: 650;
  line-height: 1.2;

  &--sm {
    font-size: 18px;
  }
}

.summary-wb__section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.summary-wb__empty {
  text-align: center;
  color: #a8abb2;
  padding: 24px;
  font-size: 13px;
}

.summary-wb__report {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: #fff;

  &.is-unread {
    border-color: #a0cfff;
    background: #fbfdff;
  }
}

.summary-wb__report-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;

  time {
    font-size: 12px;
    color: #909399;
    flex-shrink: 0;
  }
}

.summary-wb__report-body {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  color: #606266;
}

.summary-wb__report-foot {
  margin-top: 8px;
}
</style>
