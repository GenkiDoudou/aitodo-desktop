<template>
  <div class="task-timeline" v-loading="loading">
    <div class="task-timeline__main">
      <div class="task-timeline__scroll">
        <div class="task-timeline__header">
          <div class="task-timeline__gutter" />
          <div class="task-timeline__days" :style="{ width: `${gridWidth}px` }">
            <button
              v-for="day in days"
              :key="day.format('YYYY-MM-DD')"
              type="button"
              class="task-timeline__day"
              :class="{
                'is-today': day.isSame(today, 'day'),
                'is-weekend': day.day() === 0 || day.day() === 6,
                'is-focus': isFocusedDay(day)
              }"
              :style="{ width: `${DAY_WIDTH}px` }"
              :title="`查看 ${day.format('M月D日')} 的任务`"
              @click="toggleFocusDay(day)"
            >
              <span class="task-timeline__day-num">{{ day.date() }}</span>
              <span class="task-timeline__day-wd">{{ weekdayShort(day) }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="!loading && scheduledTasks.length === 0 && unscheduledTasks.length === 0"
          class="task-timeline__empty"
        >
          暂无任务
        </div>

        <div
          v-else
          class="task-timeline__body"
          :class="{ 'has-focus-day': Boolean(focusedDateKey) }"
        >
          <div
            v-for="task in scheduledTasks"
            :key="task.id"
            class="task-timeline__row"
            :class="{
              'is-selected': selectedId === task.id,
              'is-day-hit': isTaskOnFocusedDay(task),
              'is-dimmed': focusedDateKey && !isTaskOnFocusedDay(task)
            }"
          >
            <div class="task-timeline__row-label" @click="emit('select', task.id)">
              <div class="task-timeline__title-row">
                <TaskPriorityBadge :priority="task.priority ?? 4" />
                <span class="task-timeline__title" :title="task.title">{{ task.title }}</span>
              </div>
              <div v-if="categoryLabel(task)" class="task-timeline__meta">
                <span class="task-timeline__category">{{ categoryLabel(task) }}</span>
              </div>
            </div>
            <div
              class="task-timeline__row-track"
              :style="{ width: `${gridWidth}px` }"
              @dragover.prevent="onTrackDragOver"
              @drop="onDropSchedule($event)"
              @dblclick="onTrackDblClick($event)"
            >
              <div class="task-timeline__grid-lines">
                <div
                  v-for="day in days"
                  :key="day.format('YYYY-MM-DD')"
                  class="task-timeline__grid-cell"
                  :class="{ 'is-focus': isFocusedDay(day) }"
                  :style="{ width: `${DAY_WIDTH}px` }"
                  :data-date="day.format('YYYY-MM-DD')"
                />
              </div>
              <div
                v-if="displaySpan(task)"
                class="task-timeline__bar"
                :class="{
                  'is-day-hit': isTaskOnFocusedDay(task),
                  'is-point': isPointSpan(task),
                  'is-dragging': drag?.taskId === task.id
                }"
                :style="barStyle(task)"
                :title="barTitle(task)"
                @pointerdown="onBarPointerDown(task, $event)"
              >
                <span class="task-timeline__bar-handle is-left" data-edge="left" />
                <span class="task-timeline__bar-handle is-right" data-edge="right" />
              </div>
            </div>
          </div>

          <!-- 空轨道：便于拖入 / 双击创建 -->
          <div
            class="task-timeline__row task-timeline__row--drop"
            @dragover.prevent="onTrackDragOver"
            @drop="onDropSchedule($event)"
            @dblclick="onTrackDblClick($event)"
          >
            <div class="task-timeline__row-label task-timeline__row-label--hint">
              双击空白处添加
            </div>
            <div class="task-timeline__row-track" :style="{ width: `${gridWidth}px` }">
              <div class="task-timeline__grid-lines">
                <div
                  v-for="day in days"
                  :key="`drop-${day.format('YYYY-MM-DD')}`"
                  class="task-timeline__grid-cell"
                  :class="{ 'is-focus': isFocusedDay(day) }"
                  :style="{ width: `${DAY_WIDTH}px` }"
                  :data-date="day.format('YYYY-MM-DD')"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside class="task-timeline__side" :class="{ 'is-collapsed': !sideOpen }">
      <button
        v-if="!sideOpen"
        type="button"
        class="task-timeline__side-rail"
        :title="`展开安排任务（${unscheduledTasks.length}）`"
        :aria-label="`展开安排任务，共 ${unscheduledTasks.length} 个`"
        @click="sideOpen = true"
      >
        <el-icon><DArrowLeft /></el-icon>
        <span class="task-timeline__side-rail-label">安排</span>
        <span v-if="unscheduledTasks.length > 0" class="task-timeline__side-count">
          {{ unscheduledTasks.length }}
        </span>
      </button>
      <template v-else>
        <div class="task-timeline__side-head">
          <span class="task-timeline__side-head-title">
            安排任务
            <span class="task-timeline__side-count">{{ unscheduledTasks.length }}</span>
          </span>
          <button
            type="button"
            class="task-timeline__side-toggle"
            title="收起安排任务"
            aria-label="收起安排任务"
            @click="sideOpen = false"
          >
            <el-icon><DArrowRight /></el-icon>
          </button>
        </div>
        <div v-if="unscheduledTasks.length === 0" class="task-timeline__side-empty">
          没有待安排的任务
        </div>
        <div
          v-for="task in unscheduledTasks"
          :key="task.id"
          class="task-timeline__side-card"
          draggable="true"
          @dragstart="onUnscheduledDragStart(task, $event)"
          @dragend="onUnscheduledDragEnd"
          @click="emit('select', task.id)"
        >
          <TaskPriorityBadge :priority="task.priority ?? 4" />
          <div class="task-timeline__side-card-body">
            <div class="task-timeline__side-title" :title="task.title">{{ task.title }}</div>
            <div v-if="categoryLabel(task)" class="task-timeline__side-cat">
              {{ categoryLabel(task) }}
            </div>
          </div>
        </div>
      </template>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import type { Task } from '@shared/types'
import type { TimelineCalendarPreset } from '@shared/timeline-range'
import { resolveTimelineCalendarRange } from '@shared/timeline-range'
import {
  applyTimelineMove,
  applyTimelineResizeLeft,
  applyTimelineResizeRight,
  resolveTimelineSpan,
  spanToTaskDatetimes,
  type TimelineDaySpan
} from '@shared/timeline-span'
import TaskPriorityBadge from '@/components/TaskPriorityBadge.vue'

const DAY_WIDTH = 44
const EDGE_PX = 6
const DRAG_THRESHOLD = 4
const UNSCHEDULED_MIME = 'application/x-ai-todo-timeline-unscheduled'

const props = withDefaults(
  defineProps<{
    tasks: Task[]
    loading: boolean
    selectedId?: string | null
    categories?: { id: string; name: string }[]
    rangePreset?: TimelineCalendarPreset
    rangeBetween?: { start: string; end: string } | null
  }>(),
  {
    categories: () => [],
    rangePreset: 'rolling',
    rangeBetween: null
  }
)

const emit = defineEmits<{
  select: [string]
  schedule: [taskId: string, dateKey: string]
  'create-on-day': [dateKey: string]
  'update-span': [taskId: string, span: { createdAt: string; dueAt: string | null }]
}>()

const today = dayjs().startOf('day')
const focusedDateKey = ref<string | null>(null)
/** 右侧「安排任务」面板是否展开 */
const sideOpen = ref(true)

type DragMode = 'move' | 'resize-left' | 'resize-right'
interface BarDragState {
  taskId: string
  mode: DragMode
  originSpan: TimelineDaySpan
  previewSpan: TimelineDaySpan
  startX: number
  pointerId: number
  moved: boolean
}

const drag = ref<BarDragState | null>(null)

const calendarRange = computed(() =>
  resolveTimelineCalendarRange(
    props.rangePreset,
    today,
    props.rangeBetween
      ? {
          start: dayjs(props.rangeBetween.start),
          end: dayjs(props.rangeBetween.end)
        }
      : null
  )
)

const rangeStart = computed(() => calendarRange.value.start)
const rangeDayCount = computed(() => calendarRange.value.dayCount)
const days = computed(() =>
  Array.from({ length: rangeDayCount.value }, (_, i) => rangeStart.value.add(i, 'day'))
)
const gridWidth = computed(() => rangeDayCount.value * DAY_WIDTH)

watch(
  () => [props.rangePreset, props.rangeBetween?.start, props.rangeBetween?.end] as const,
  () => {
    focusedDateKey.value = null
  }
)

const rootTasks = computed(() => props.tasks.filter((t) => !t.parentId))

const unscheduledTasks = computed(() =>
  rootTasks.value.filter((t) => !t.dueAt).sort((a, b) => a.title.localeCompare(b.title))
)

const scheduledTasks = computed(() => {
  const list = rootTasks.value
    .filter((t) => Boolean(resolveTimelineSpan(t)))
    .sort((a, b) => {
      const sa = resolveTimelineSpan(a)!
      const sb = resolveTimelineSpan(b)!
      if (sa.startKey !== sb.startKey) return sa.startKey.localeCompare(sb.startKey)
      return a.title.localeCompare(b.title)
    })
  if (!focusedDateKey.value) return list
  return [...list].sort((a, b) => {
    const ha = isTaskOnFocusedDay(a) ? 0 : 1
    const hb = isTaskOnFocusedDay(b) ? 0 : 1
    if (ha !== hb) return ha - hb
    return (resolveTimelineSpan(a)?.startKey ?? '').localeCompare(
      resolveTimelineSpan(b)?.startKey ?? ''
    )
  })
})

function weekdayShort(d: Dayjs) {
  return ['日', '一', '二', '三', '四', '五', '六'][d.day()]
}

function isFocusedDay(day: Dayjs) {
  return focusedDateKey.value === day.format('YYYY-MM-DD')
}

function toggleFocusDay(day: Dayjs) {
  const key = day.format('YYYY-MM-DD')
  focusedDateKey.value = focusedDateKey.value === key ? null : key
}

function displaySpan(task: Task): TimelineDaySpan | null {
  if (drag.value?.taskId === task.id) return drag.value.previewSpan
  return resolveTimelineSpan(task)
}

function isPointSpan(task: Task): boolean {
  const span = displaySpan(task)
  return Boolean(span && span.startKey === span.endKey)
}

function isTaskOnFocusedDay(task: Task): boolean {
  if (!focusedDateKey.value) return false
  const span = displaySpan(task)
  if (!span) return false
  return focusedDateKey.value >= span.startKey && focusedDateKey.value <= span.endKey
}

function categoryLabel(task: Task): string {
  if (task.categoryId) {
    return props.categories.find((c) => c.id === task.categoryId)?.name ?? ''
  }
  if (task.categoryId === null) return '未分类'
  return ''
}

function barStyle(task: Task) {
  const span = displaySpan(task)
  if (!span) return { display: 'none' }
  const startOffset = Math.max(0, dayjs(span.startKey).diff(rangeStart.value, 'day'))
  const endOffset = Math.min(
    rangeDayCount.value - 1,
    dayjs(span.endKey).diff(rangeStart.value, 'day')
  )
  if (endOffset < 0 || startOffset > rangeDayCount.value - 1) {
    return { display: 'none' }
  }
  const clampedStart = Math.min(startOffset, endOffset)
  const daysSpan = Math.max(1, endOffset - clampedStart + 1)
  return {
    left: `${clampedStart * DAY_WIDTH + 4}px`,
    width: `${daysSpan * DAY_WIDTH - 8}px`,
    opacity: task.status === 'DONE' ? 0.55 : 1
  }
}

function barTitle(task: Task) {
  const span = displaySpan(task)
  if (!span) return categoryLabel(task)
  const range =
    span.startKey === span.endKey ? span.startKey : `${span.startKey} → ${span.endKey}`
  return [categoryLabel(task), range].filter(Boolean).join(' · ')
}

function dateKeyFromClientX(clientX: number, trackEl: HTMLElement): string | null {
  const rect = trackEl.getBoundingClientRect()
  const x = clientX - rect.left + trackEl.scrollLeft
  const idx = Math.floor(x / DAY_WIDTH)
  if (idx < 0 || idx >= rangeDayCount.value) return null
  return rangeStart.value.add(idx, 'day').format('YYYY-MM-DD')
}

function findTrackEl(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof Element)) return null
  return el.closest('.task-timeline__row-track') as HTMLElement | null
}

function onTrackDragOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDropSchedule(e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData(UNSCHEDULED_MIME)
  if (!raw) return
  let taskId = ''
  try {
    taskId = JSON.parse(raw).id as string
  } catch {
    return
  }
  const track = findTrackEl(e.currentTarget)
  if (!track) return
  const dateKey = dateKeyFromClientX(e.clientX, track)
  if (!dateKey || !taskId) return
  emit('schedule', taskId, dateKey)
}

function onTrackDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement | null)?.closest?.('.task-timeline__bar')) return
  const track = findTrackEl(e.currentTarget)
  if (!track) return
  const dateKey = dateKeyFromClientX(e.clientX, track)
  if (!dateKey) return
  emit('create-on-day', dateKey)
}

function onUnscheduledDragStart(task: Task, e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(UNSCHEDULED_MIME, JSON.stringify({ id: task.id }))
  e.dataTransfer.effectAllowed = 'move'
}

function onUnscheduledDragEnd() {
  /* no-op */
}

function onBarPointerDown(task: Task, e: PointerEvent) {
  if (e.button !== 0) return
  const span = resolveTimelineSpan(task)
  if (!span) return
  const target = e.target as HTMLElement
  const edge = target.dataset.edge as 'left' | 'right' | undefined
  const mode: DragMode =
    edge === 'left' ? 'resize-left' : edge === 'right' ? 'resize-right' : 'move'

  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

  drag.value = {
    taskId: task.id,
    mode,
    originSpan: span,
    previewSpan: { ...span },
    startX: e.clientX,
    pointerId: e.pointerId,
    moved: false
  }

  window.addEventListener('pointermove', onBarPointerMove)
  window.addEventListener('pointerup', onBarPointerUp)
  window.addEventListener('pointercancel', onBarPointerUp)
}

function onBarPointerMove(e: PointerEvent) {
  const state = drag.value
  if (!state || e.pointerId !== state.pointerId) return
  const dx = e.clientX - state.startX
  const moved = Math.abs(dx) >= DRAG_THRESHOLD ? true : state.moved
  const deltaDays = Math.round(dx / DAY_WIDTH)

  let previewSpan = state.originSpan
  if (state.mode === 'move') {
    previewSpan = applyTimelineMove(state.originSpan, deltaDays)
  } else if (state.mode === 'resize-left') {
    const newStart = dayjs(state.originSpan.startKey).add(deltaDays, 'day').format('YYYY-MM-DD')
    previewSpan = applyTimelineResizeLeft(state.originSpan, newStart)
  } else {
    const newEnd = dayjs(state.originSpan.endKey).add(deltaDays, 'day').format('YYYY-MM-DD')
    previewSpan = applyTimelineResizeRight(state.originSpan, newEnd)
  }

  drag.value = { ...state, moved, previewSpan }
}

function onBarPointerUp(e: PointerEvent) {
  const state = drag.value
  if (!state || e.pointerId !== state.pointerId) return
  cleanupBarDragListeners()

  const { taskId, originSpan, previewSpan, moved } = state
  drag.value = null

  if (!moved) {
    emit('select', taskId)
    return
  }
  if (
    previewSpan.startKey === originSpan.startKey &&
    previewSpan.endKey === originSpan.endKey
  ) {
    return
  }
  const task = props.tasks.find((t) => t.id === taskId)
  if (!task) return
  emit('update-span', taskId, spanToTaskDatetimes(previewSpan, task))
}

function cleanupBarDragListeners() {
  window.removeEventListener('pointermove', onBarPointerMove)
  window.removeEventListener('pointerup', onBarPointerUp)
  window.removeEventListener('pointercancel', onBarPointerUp)
}

onBeforeUnmount(() => {
  cleanupBarDragListeners()
})
</script>

<style scoped lang="scss">
.task-timeline {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
  overflow: hidden;
}

.task-timeline__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-timeline__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 16px;
}

.task-timeline__empty {
  text-align: center;
  padding: 48px;
  color: var(--desktop-muted);
}

.task-timeline__header {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--desktop-panel);
  border-bottom: 1px solid var(--desktop-border);
  padding-bottom: 4px;
}

.task-timeline__gutter {
  width: 200px;
  flex-shrink: 0;
}

.task-timeline__days {
  display: flex;
  flex-shrink: 0;
}

.task-timeline__day {
  flex-shrink: 0;
  text-align: center;
  padding: 4px 0;
  border: none;
  border-right: 1px solid var(--desktop-border);
  background: transparent;
  font-size: 11px;
  cursor: pointer;
  color: inherit;

  &:hover {
    background: rgba(64, 158, 255, 0.08);
  }

  &.is-today .task-timeline__day-num {
    background: var(--el-color-primary);
    color: #fff;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &.is-weekend {
    background: rgba(0, 0, 0, 0.02);
  }

  &.is-focus {
    background: rgba(64, 158, 255, 0.16);

    .task-timeline__day-num {
      background: var(--el-color-primary);
      color: #fff;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.35);
    }

    .task-timeline__day-wd {
      color: var(--el-color-primary);
      font-weight: 600;
    }
  }
}

.task-timeline__day-num {
  display: block;
  font-weight: 600;
  line-height: 22px;
}

.task-timeline__day-wd {
  display: block;
  color: var(--desktop-muted);
  font-size: 10px;
}

.task-timeline__row {
  display: flex;
  align-items: center;
  min-height: 44px;
  border-radius: 6px;
  transition: background 0.12s ease, opacity 0.12s ease;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    background: var(--desktop-active);
  }

  &.is-day-hit {
    background: rgba(64, 158, 255, 0.1);
    box-shadow: inset 3px 0 0 var(--el-color-primary);
  }

  &.is-dimmed {
    opacity: 0.38;
  }

  &--drop {
    min-height: 36px;
    opacity: 0.85;

    &:hover {
      background: rgba(64, 158, 255, 0.04);
    }
  }
}

.task-timeline__row-label {
  width: 200px;
  flex-shrink: 0;
  padding: 6px 10px 6px 0;
  min-width: 0;
  cursor: pointer;

  &--hint {
    font-size: 12px;
    color: var(--desktop-muted);
    cursor: default;
  }
}

.task-timeline__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.task-timeline__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-timeline__meta {
  display: flex;
  margin-top: 2px;
  padding-left: 34px;
}

.task-timeline__category {
  font-size: 11px;
  color: var(--desktop-text);
  background: var(--desktop-bg);
  border: 1px solid var(--desktop-border);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 16px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-timeline__row-track {
  position: relative;
  flex-shrink: 0;
  height: 28px;
}

.task-timeline__grid-lines {
  position: absolute;
  inset: 0;
  display: flex;
  pointer-events: none;
}

.task-timeline__grid-cell {
  flex-shrink: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  height: 100%;

  &.is-focus {
    background: rgba(64, 158, 255, 0.12);
  }
}

.task-timeline__bar {
  position: absolute;
  top: 6px;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(90deg, #409eff 0%, #79bbff 100%);
  min-width: 8px;
  cursor: grab;
  touch-action: none;
  user-select: none;

  &.is-point {
    border-radius: 8px;
  }

  &.is-day-hit {
    height: 18px;
    top: 5px;
    background: linear-gradient(90deg, #1d7fe8 0%, #409eff 100%);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.35);
  }

  &.is-dragging {
    cursor: grabbing;
    opacity: 0.85;
    z-index: 3;
  }
}

.task-timeline__bar-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;

  &.is-left {
    left: 0;
  }

  &.is-right {
    right: 0;
  }
}

.task-timeline__side {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--desktop-border);
  background: var(--desktop-panel);
  padding: 12px 10px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: width 0.15s ease;

  &.is-collapsed {
    width: 40px;
    padding: 8px 4px;
    overflow: hidden;
  }
}

.task-timeline__side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.task-timeline__side-head-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.task-timeline__side-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
    color: var(--el-color-primary);
  }
}

.task-timeline__side-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--desktop-muted);
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
    color: var(--el-color-primary);
  }
}

.task-timeline__side-rail-label {
  writing-mode: vertical-rl;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: inherit;
}

.task-timeline__side-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--desktop-muted);
  background: var(--desktop-bg);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 18px;
}

.task-timeline__side-empty {
  font-size: 12px;
  color: var(--desktop-muted);
  padding: 12px 4px;
}

.task-timeline__side-card {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--desktop-border);
  border-radius: 8px;
  background: var(--desktop-bg);
  cursor: grab;

  &:hover {
    border-color: var(--el-color-primary);
  }

  &:active {
    cursor: grabbing;
  }
}

.task-timeline__side-card-body {
  min-width: 0;
  flex: 1;
}

.task-timeline__side-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-timeline__side-cat {
  margin-top: 2px;
  font-size: 11px;
  color: var(--desktop-muted);
}
</style>
