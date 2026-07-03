<template>
  <div class="task-timeline" v-loading="loading">
    <div v-if="!loading && timelineTasks.length === 0 && noDateTasks.length === 0" class="task-timeline__empty">
      暂无任务
    </div>
    <template v-else>
      <div class="task-timeline__header">
        <div class="task-timeline__gutter" />
        <div class="task-timeline__days" :style="{ width: `${gridWidth}px` }">
          <div
            v-for="day in days"
            :key="day.format('YYYY-MM-DD')"
            class="task-timeline__day"
            :class="{ 'is-today': day.isSame(today, 'day'), 'is-weekend': day.day() === 0 || day.day() === 6 }"
            :style="{ width: `${DAY_WIDTH}px` }"
          >
            <span class="task-timeline__day-num">{{ day.date() }}</span>
            <span class="task-timeline__day-wd">{{ weekdayShort(day) }}</span>
          </div>
        </div>
      </div>

      <div class="task-timeline__body">
        <section v-if="noDateTasks.length" class="task-timeline__section">
          <div
            v-for="task in noDateTasks"
            :key="task.id"
            class="task-timeline__row"
            :class="{ 'is-selected': selectedId === task.id }"
            @click="emit('select', task.id)"
          >
            <div class="task-timeline__row-label">{{ task.title }}</div>
            <div class="task-timeline__row-track" :style="{ width: `${gridWidth}px` }">
              <span class="task-timeline__no-date-tag">未设置截止日</span>
            </div>
          </div>
        </section>

        <div
          v-for="task in timelineTasks"
          :key="task.id"
          class="task-timeline__row"
          :class="{ 'is-selected': selectedId === task.id }"
          @click="emit('select', task.id)"
        >
          <div class="task-timeline__row-label" :title="task.title">{{ task.title }}</div>
          <div class="task-timeline__row-track" :style="{ width: `${gridWidth}px` }">
            <div class="task-timeline__grid-lines">
              <div
                v-for="day in days"
                :key="day.format('YYYY-MM-DD')"
                class="task-timeline__grid-cell"
                :style="{ width: `${DAY_WIDTH}px` }"
              />
            </div>
            <div class="task-timeline__bar" :style="barStyle(task)" :title="barTitle(task)" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import type { Task } from '@shared/types'

const DAY_WIDTH = 44
const RANGE_DAYS = 28

const props = defineProps<{
  tasks: Task[]
  loading: boolean
  selectedId?: string | null
}>()

const emit = defineEmits<{
  select: [string]
}>()

const today = dayjs().startOf('day')
const rangeStart = computed(() => today.subtract(3, 'day'))
const days = computed(() =>
  Array.from({ length: RANGE_DAYS }, (_, i) => rangeStart.value.add(i, 'day'))
)
const gridWidth = computed(() => RANGE_DAYS * DAY_WIDTH)

const rootTasks = computed(() => props.tasks.filter((t) => !t.parentId))

const noDateTasks = computed(() => rootTasks.value.filter((t) => !t.dueAt))

const timelineTasks = computed(() =>
  rootTasks.value
    .filter((t) => t.dueAt)
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
)

function weekdayShort(d: dayjs.Dayjs) {
  return ['日', '一', '二', '三', '四', '五', '六'][d.day()]
}

/** 条带：从创建日（或范围起点）到截止日 */
function barStyle(task: Task) {
  const end = dayjs(task.dueAt!.slice(0, 10))
  let start = task.createdAt ? dayjs(task.createdAt.slice(0, 10)) : end
  if (start.isAfter(end)) start = end

  const startOffset = Math.max(0, start.diff(rangeStart.value, 'day'))
  const endOffset = Math.min(RANGE_DAYS - 1, end.diff(rangeStart.value, 'day'))
  const span = Math.max(1, endOffset - startOffset + 1)

  return {
    left: `${startOffset * DAY_WIDTH + 4}px`,
    width: `${span * DAY_WIDTH - 8}px`,
    opacity: task.status === 'DONE' ? 0.55 : 1
  }
}

function barTitle(task: Task) {
  const start = task.createdAt?.slice(0, 10) ?? ''
  const end = task.dueAt?.slice(0, 10) ?? ''
  return `${start} → ${end}`
}
</script>

<style scoped lang="scss">
.task-timeline {
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
  width: 160px;
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
  border-right: 1px solid var(--desktop-border);
  font-size: 11px;

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

.task-timeline__section-label {
  width: 160px;
  flex-shrink: 0;
  padding: 8px 8px 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--desktop-muted);
}

.task-timeline__section {
  border-bottom: 1px solid var(--desktop-border);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.task-timeline__row {
  display: flex;
  align-items: center;
  min-height: 36px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    background: var(--desktop-active);
  }
}

.task-timeline__row-label {
  width: 160px;
  flex-shrink: 0;
  padding: 6px 8px 6px 0;
  font-size: 13px;
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
}

.task-timeline__bar {
  position: absolute;
  top: 6px;
  height: 16px;
  border-radius: 4px;
  background: linear-gradient(90deg, #409eff 0%, #79bbff 100%);
  min-width: 8px;
  pointer-events: none;
}

.task-timeline__no-date-tag {
  position: absolute;
  left: 8px;
  top: 6px;
  font-size: 11px;
  color: var(--desktop-muted);
}
</style>
