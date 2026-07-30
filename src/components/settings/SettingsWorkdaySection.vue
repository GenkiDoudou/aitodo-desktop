<template>
  <section class="settings-section workday-settings">
    <h2 class="settings-section__title">工作日</h2>
    <p class="settings-section__hint">
      查看中国法定节假日与调休补班。未登录直连 timor.tech；登录云同步后优先从同步服务器获取（失败回退
      timor.tech）。此处仅展示日历，不修改任务「工作日」重复规则。
    </p>

    <div class="workday-settings__status">
      <div class="workday-settings__status-rows">
        <div class="workday-settings__row">
          <span class="workday-settings__label">数据来源</span>
          <span>{{ status?.sourceLabel ?? '中国法定节假日（timor.tech）' }}</span>
        </div>
        <div class="workday-settings__row">
          <span class="workday-settings__label">已缓存年份</span>
          <span>{{ cachedYearsText }}</span>
        </div>
        <div class="workday-settings__row">
          <span class="workday-settings__label">上次更新</span>
          <span>{{ lastUpdatedText }}</span>
        </div>
      </div>
      <el-button type="primary" :loading="refreshing" @click="onRefresh">刷新数据</el-button>
    </div>

    <div class="workday-settings__legend">
      <span class="workday-settings__legend-item">
        <span class="holiday-month__mark is-off">休</span>
        法定放假
      </span>
      <span class="workday-settings__legend-item">
        <span class="holiday-month__mark is-work">班</span>
        调休上班
      </span>
    </div>

    <div class="workday-settings__toolbar">
      <el-button text @click="onNavPrev">{{ panelMode === 'months' ? '上年' : '上月' }}</el-button>
      <button
        type="button"
        class="workday-settings__title"
        :title="panelMode === 'days' ? '点击选择月份' : '返回日视图'"
        @click="togglePanelMode"
      >
        {{ panelTitle }}
      </button>
      <el-button text @click="onNavNext">{{ panelMode === 'months' ? '下年' : '下月' }}</el-button>
      <el-button text type="primary" @click="goToday">本月</el-button>
    </div>

    <HolidayYearCalendar
      v-if="panelMode === 'months'"
      :year="anchor.year()"
      :selected-month="anchor.month() + 1"
      :holiday-marks="holidayMarks"
      @select-month="selectMonth"
    />
    <HolidayMonthCalendar v-else :anchor="anchor" :holiday-marks="holidayMarks" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { HolidayCacheStatus, HolidayCalendarDay } from '@shared/timor-holiday'
import { buildCalendarDays } from '@/utils/schedule-picker'
import HolidayMonthCalendar from '@/components/settings/HolidayMonthCalendar.vue'
import HolidayYearCalendar from '@/components/settings/HolidayYearCalendar.vue'

type PanelMode = 'days' | 'months'

const today = dayjs()
const anchor = ref(dayjs().startOf('month'))
const panelMode = ref<PanelMode>('days')
const holidayMarks = ref<Record<string, HolidayCalendarDay>>({})
const status = ref<HolidayCacheStatus | null>(null)
const refreshing = ref(false)

const panelTitle = computed(() =>
  panelMode.value === 'months'
    ? anchor.value.format('YYYY年')
    : anchor.value.format('YYYY年M月')
)

const relevantYears = computed(() => {
  if (panelMode.value === 'months') {
    return [anchor.value.year()]
  }
  const days = buildCalendarDays(anchor.value.startOf('month'))
  const years = new Set(days.map((d) => d.year()))
  return [...years].sort((a, b) => a - b)
})

const cachedYearsText = computed(() => {
  const years = status.value?.cachedYears ?? []
  return years.length ? years.join(', ') : '尚未缓存'
})

const lastUpdatedText = computed(() => {
  const meta = status.value?.yearsMeta ?? []
  const relevant = meta.filter((m) => relevantYears.value.includes(m.year) && m.updatedAt)
  if (!relevant.length) return '尚未拉取'
  const newest = relevant
    .map((m) => m.updatedAt!)
    .sort()
    .at(-1)!
  return dayjs(newest).format('YYYY-MM-DD HH:mm')
})

async function loadMarksAndStatus() {
  try {
    const [marksRes, statusRes] = await Promise.all([
      window.api.holidays.calendarMarks(relevantYears.value),
      window.api.holidays.status()
    ])
    if (marksRes.ok) {
      holidayMarks.value = { ...holidayMarks.value, ...marksRes.data }
    }
    if (statusRes.ok) {
      status.value = statusRes.data
    }
  } catch {
    ElMessage.error('加载节假日数据失败')
  }
}

async function onRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const result = await window.api.holidays.refresh(relevantYears.value)
    if (!result.ok) {
      ElMessage.error(result.error?.message || '刷新失败')
      return
    }
    holidayMarks.value = { ...holidayMarks.value, ...result.data.marks }
    status.value = result.data.status
    ElMessage.success('节假日数据已刷新')
  } catch {
    ElMessage.error('刷新失败，已保留当前标注')
  } finally {
    refreshing.value = false
  }
}

function togglePanelMode() {
  panelMode.value = panelMode.value === 'days' ? 'months' : 'days'
}

function selectMonth(month1to12: number) {
  anchor.value = anchor.value.month(month1to12 - 1).startOf('month')
  panelMode.value = 'days'
}

function onNavPrev() {
  if (panelMode.value === 'months') {
    anchor.value = anchor.value.subtract(1, 'year').startOf('month')
  } else {
    anchor.value = anchor.value.subtract(1, 'month').startOf('month')
  }
}

function onNavNext() {
  if (panelMode.value === 'months') {
    anchor.value = anchor.value.add(1, 'year').startOf('month')
  } else {
    anchor.value = anchor.value.add(1, 'month').startOf('month')
  }
}

function goToday() {
  anchor.value = dayjs().startOf('month')
  panelMode.value = 'days'
}

watch(
  [anchor, panelMode],
  () => {
    void loadMarksAndStatus()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.settings-section__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
}

.settings-section__hint {
  margin: 0 0 20px;
  color: var(--desktop-muted);
  font-size: 13px;
  line-height: 1.5;
  max-width: 640px;
}

.workday-settings__status {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  background: var(--desktop-panel);
  margin-bottom: 14px;
}

.workday-settings__status-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.workday-settings__row {
  display: flex;
  gap: 12px;
}

.workday-settings__label {
  width: 88px;
  flex-shrink: 0;
  color: var(--desktop-muted);
}

.workday-settings__legend {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.workday-settings__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.holiday-month__mark {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;

  &.is-off {
    color: #c45656;
    background: rgba(196, 86, 86, 0.12);
  }

  &.is-work {
    color: #2f6fed;
    background: rgba(47, 111, 237, 0.12);
  }
}

.workday-settings__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.workday-settings__title {
  min-width: 120px;
  text-align: center;
  font-size: 15px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--el-color-primary);
  }
}
</style>
