<template>
  <section class="summary-results" v-loading="loading">
    <p v-if="!loading && reports.length === 0" class="summary-results__empty">
      暂无汇总报告。启用定时汇总后，到点会自动生成并在此展示。
    </p>

    <article
      v-for="report in reports"
      :key="report.id"
      class="summary-results__card"
      :class="{ 'is-unread': !report.readAt }"
    >
      <header class="summary-results__head">
        <h3 class="summary-results__title">{{ displayTitle(report) }}</h3>
        <time class="summary-results__time">{{ formatTime(report.createdAt) }}</time>
      </header>
      <pre v-if="report.body" class="summary-results__body">{{ report.body }}</pre>
      <footer v-if="!report.readAt" class="summary-results__foot">
        <el-button size="small" text type="primary" @click="markRead(report.id)">标为已读</el-button>
      </footer>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { AppMessage } from '@shared/types'
import { useMessageStore } from '@/stores/message-store'

const messageStore = useMessageStore()
const loading = ref(false)

const reports = computed(() => messageStore.summaryReports)

function displayTitle(report: AppMessage) {
  return report.title.replace(/^定时汇总：/, '')
}

function formatTime(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}

async function markRead(id: string) {
  try {
    await messageStore.markRead(id)
    ElMessage.success('已标为已读')
  } catch {
    /* unwrapIpc 已 Toast */
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await messageStore.loadSummaryReports(50)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.summary-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.summary-results__empty {
  margin: 48px 0;
  text-align: center;
  font-size: 14px;
  color: var(--desktop-muted);
}

.summary-results__card {
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--desktop-border);
  background: #fff;

  &.is-unread {
    border-color: color-mix(in srgb, var(--el-color-primary) 35%, var(--desktop-border));
    background: color-mix(in srgb, var(--el-color-primary) 4%, #fff);
  }
}

.summary-results__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.summary-results__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.summary-results__time {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--desktop-muted);
}

.summary-results__body {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.summary-results__foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
