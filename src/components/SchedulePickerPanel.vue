<template>
  <div class="schedule-picker">
    <button
      v-if="showBack"
      type="button"
      class="schedule-picker__back"
      @click="emit('back')"
    >
      ‹ 返回提醒选项
    </button>
    <!-- 日期 / 时间 分段切换，参考滴答清单式交互 -->
    <div class="schedule-picker__tabs">
      <button
        type="button"
        class="schedule-picker__tab"
        :class="{ 'is-active': tab === 'date' }"
        @click="tab = 'date'"
      >
        日期
      </button>
      <button
        type="button"
        class="schedule-picker__tab"
        :class="{ 'is-active': tab === 'time' }"
        @click="tab = 'time'"
      >
        时间
      </button>
    </div>

    <!-- 快捷图标：今天 / 明天 / 下周 / 今晚 -->
    <div class="schedule-picker__quick">
      <button
        v-for="item in quickPresets"
        :key="item.key"
        type="button"
        class="schedule-picker__quick-btn"
        :title="item.label"
        @click="applyQuick(item)"
      >
        <span class="schedule-picker__quick-icon" :data-icon="item.icon" />
      </button>
    </div>

    <!-- 日期：月历点选，大格子降低误触 -->
    <div v-show="tab === 'date'" class="schedule-picker__calendar">
      <div class="schedule-picker__month-bar">
        <button type="button" class="schedule-picker__nav" @click="shiftMonth(-1)">‹</button>
        <span class="schedule-picker__month-label">{{ monthLabel }}</span>
        <button type="button" class="schedule-picker__nav" @click="shiftMonth(1)">›</button>
        <button type="button" class="schedule-picker__today-link" @click="goToday">今天</button>
      </div>
      <div class="schedule-picker__weekdays">
        <span v-for="w in weekdays" :key="w">{{ w }}</span>
      </div>
      <div class="schedule-picker__days">
        <button
          v-for="day in calendarDays"
          :key="day.format('YYYY-MM-DD')"
          type="button"
          class="schedule-picker__day"
          :class="{
            'is-other': !day.isSame(viewMonth, 'month'),
            'is-today': day.isSame(today, 'day'),
            'is-selected': day.isSame(selectedDate, 'day')
          }"
          @click="selectDate(day)"
        >
          {{ day.date() }}
        </button>
      </div>
      <button type="button" class="schedule-picker__sub-row" @click="tab = 'time'">
        <span class="schedule-picker__sub-label">时间</span>
        <span class="schedule-picker__sub-value">{{ selectedTime }} ›</span>
      </button>
    </div>

    <!-- 时间：30 分钟一档列表，点击即选 -->
    <div v-show="tab === 'time'" class="schedule-picker__time-panel">
      <div ref="timeListRef" class="schedule-picker__time-list">
        <button
          v-for="slot in timeSlots"
          :key="slot"
          type="button"
          class="schedule-picker__time-item"
          :class="{ 'is-selected': selectedTime === slot }"
          :data-slot="slot"
          @click="selectedTime = slot"
        >
          <span>{{ slot }}</span>
          <span v-if="selectedTime === slot" class="schedule-picker__check">✓</span>
        </button>
      </div>
    </div>

    <div class="schedule-picker__actions">
      <button type="button" class="schedule-picker__btn schedule-picker__btn--ghost" @click="emit('clear')">
        清除
      </button>
      <button type="button" class="schedule-picker__btn schedule-picker__btn--primary" @click="confirm">
        确定
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { isoAt } from '@/utils/datetime'
import {
  buildCalendarDays,
  buildTimeSlots,
  defaultQuickPresets,
  normalizeHm,
  type QuickDatePreset
} from '@/utils/schedule-picker'

const props = defineProps<{
  /** 打开时的初始 ISO 值 */
  initialIso?: string | null
  showBack?: boolean
}>()

const emit = defineEmits<{
  confirm: [string]
  clear: []
  back: []
}>()

const tab = ref<'date' | 'time'>('date')
const viewMonth = ref(dayjs())
const selectedDate = ref(dayjs())
const selectedTime = ref('09:00')
const timeListRef = ref<HTMLElement | null>(null)

const today = dayjs()
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const quickPresets = defaultQuickPresets()
const timeSlots = buildTimeSlots(30)

const monthLabel = computed(() => viewMonth.value.format('YYYY年M月'))
const calendarDays = computed(() => buildCalendarDays(viewMonth.value))

function initFromIso(iso?: string | null) {
  if (iso) {
    const d = dayjs(iso)
    if (d.isValid()) {
      selectedDate.value = d
      viewMonth.value = d.startOf('month')
      selectedTime.value = normalizeHm(d.format('HH:mm:ss'))
      return
    }
  }
  selectedDate.value = dayjs()
  viewMonth.value = dayjs().startOf('month')
  selectedTime.value = '09:00'
  tab.value = 'date'
}

watch(
  () => props.initialIso,
  (iso) => initFromIso(iso),
  { immediate: true }
)

watch(tab, async (t) => {
  if (t === 'time') {
    await nextTick()
    const el = timeListRef.value?.querySelector(`[data-slot="${selectedTime.value}"]`)
    el?.scrollIntoView({ block: 'center' })
  }
})

function shiftMonth(delta: number) {
  viewMonth.value = viewMonth.value.add(delta, 'month')
}

function goToday() {
  selectedDate.value = dayjs()
  viewMonth.value = dayjs().startOf('month')
}

function selectDate(day: dayjs.Dayjs) {
  selectedDate.value = day
  if (!day.isSame(viewMonth.value, 'month')) {
    viewMonth.value = day.startOf('month')
  }
}

function applyQuick(item: QuickDatePreset) {
  const { date, time } = item.apply()
  selectedDate.value = date
  viewMonth.value = date.startOf('month')
  selectedTime.value = normalizeHm(time)
}

function confirm() {
  const [h, m] = selectedTime.value.split(':').map(Number)
  const merged = selectedDate.value.hour(h).minute(m).second(0)
  emit('confirm', isoAt(merged))
}

defineExpose({ initFromIso })
</script>

<style scoped lang="scss">
.schedule-picker {
  width: 300px;
  user-select: none;
}

.schedule-picker__back {
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 13px;
  padding: 0 0 10px;
  cursor: pointer;
}

.schedule-picker__tabs {
  display: flex;
  padding: 4px;
  background: var(--desktop-bg);
  border-radius: 10px;
  margin-bottom: 12px;
}

.schedule-picker__tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--desktop-muted);
  cursor: pointer;

  &.is-active {
    background: #fff;
    color: var(--desktop-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

.schedule-picker__quick {
  display: flex;
  justify-content: space-around;
  margin-bottom: 12px;
}

.schedule-picker__quick-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
  }
}

.schedule-picker__quick-icon {
  display: block;
  width: 24px;
  height: 24px;
  margin: 0 auto;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  opacity: 0.85;

  &[data-icon='today'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23f5a623'%3E%3Ccircle cx='12' cy='12' r='5'/%3E%3Cpath stroke='%23f5a623' stroke-width='2' d='M12 2v3M12 19v3M2 12h3M19 12h3'/%3E%3C/svg%3E");
  }

  &[data-icon='tomorrow'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f5a623' stroke-width='2'%3E%3Cpath d='M12 18V6M8 10l4-4 4 4'/%3E%3Cpath stroke='%23ccc' d='M4 20h16'/%3E%3C/svg%3E");
  }

  &[data-icon='next-week'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.5'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Ctext x='12' y='15' text-anchor='middle' font-size='8' fill='%23666'%3E+7%3C/text%3E%3C/svg%3E");
  }

  &[data-icon='tonight'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236c7ae0'%3E%3Cpath d='M21 14.5A7.5 7.5 0 1110.5 4 6 6 0 0021 14.5z'/%3E%3C/svg%3E");
  }
}

.schedule-picker__month-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.schedule-picker__month-label {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
}

.schedule-picker__nav,
.schedule-picker__today-link {
  border: none;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: 6px;

  &:hover {
    background: var(--desktop-hover);
    color: var(--el-color-primary);
  }
}

.schedule-picker__nav {
  font-size: 18px;
  line-height: 1;
}

.schedule-picker__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: var(--desktop-muted);
  margin-bottom: 4px;
}

.schedule-picker__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.schedule-picker__day {
  aspect-ratio: 1;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  color: var(--desktop-text);

  &.is-other {
    color: #c0c4cc;
  }

  &.is-today:not(.is-selected) {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  &.is-selected {
    background: var(--el-color-primary);
    color: #fff;
    font-weight: 600;
  }

  &:hover:not(.is-selected) {
    background: var(--desktop-hover);
  }
}

.schedule-picker__sub-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 12px;
  padding: 12px 4px;
  border: none;
  border-top: 1px solid var(--desktop-border);
  background: transparent;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    color: var(--el-color-primary);
  }
}

.schedule-picker__sub-value {
  color: var(--desktop-muted);
}

.schedule-picker__time-panel {
  margin-bottom: 8px;
}

.schedule-picker__time-list {
  max-height: 280px;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.schedule-picker__time-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.schedule-picker__check {
  font-size: 14px;
}

.schedule-picker__actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.schedule-picker__btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &--ghost {
    border: 1px solid var(--desktop-border);
    background: #fff;
    color: var(--desktop-text);
  }

  &--primary {
    border: none;
    background: var(--el-color-primary);
    color: #fff;
  }
}
</style>
