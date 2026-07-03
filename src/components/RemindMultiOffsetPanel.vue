<template>
  <div class="remind-multi-offset">
    <template v-if="panel === 'list'">
      <ul class="remind-multi-offset__list">
        <li
          v-for="opt in REMIND_OFFSET_PRESETS"
          :key="opt.key"
          class="remind-multi-offset__item"
          :class="{ 'is-selected': selectedMinutes.has(opt.minutes) }"
          @click="toggleMinutes(opt.minutes)"
        >
          <span>{{ opt.label }}</span>
          <span v-if="selectedMinutes.has(opt.minutes)" class="remind-multi-offset__check">✓</span>
        </li>
        <li
          v-for="c in customMinutesList"
          :key="'c-' + c"
          class="remind-multi-offset__item is-selected"
          @click="toggleMinutes(c)"
        >
          <span>{{ customLabel(c) }}</span>
          <span class="remind-multi-offset__check">✓</span>
        </li>
        <li class="remind-multi-offset__item" @click="panel = 'custom'">
          <span>自定义</span>
        </li>
      </ul>

      <div class="remind-multi-offset__continuous">
        <span class="remind-multi-offset__continuous-label">持续提醒</span>
        <el-switch v-model="draftContinuous" />
      </div>

      <div class="remind-multi-offset__actions">
        <button type="button" class="remind-multi-offset__btn remind-multi-offset__btn--ghost" @click="emit('cancel')">
          取消
        </button>
        <button type="button" class="remind-multi-offset__btn remind-multi-offset__btn--primary" @click="confirm">
          确定
        </button>
      </div>
    </template>

    <RemindCustomOffsetPanel
      v-else
      :due-at="dueAt"
      @confirm="onCustomConfirm"
      @cancel="panel = 'list'"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  REMIND_OFFSET_PRESETS,
  customOffsetToMinutes,
  type RemindCustomUnit
} from '@shared/task-reminder'
import RemindCustomOffsetPanel from '@/components/RemindCustomOffsetPanel.vue'

const props = defineProps<{
  dueAt: string
  initialMinutes?: number[]
  initialContinuous?: boolean
}>()

const emit = defineEmits<{
  confirm: [minutes: number[], continuous: boolean]
  cancel: []
}>()

const panel = ref<'list' | 'custom'>('list')
const selectedMinutes = ref<Set<number>>(new Set())
const draftContinuous = ref(false)

const presetMinuteSet = new Set(REMIND_OFFSET_PRESETS.map((p) => p.minutes))

const customMinutesList = computed(() =>
  [...selectedMinutes.value].filter((m) => !presetMinuteSet.has(m)).sort((a, b) => b - a)
)

watch(
  () => [props.initialMinutes, props.initialContinuous] as const,
  ([mins, cont]) => {
    selectedMinutes.value = new Set(mins ?? [])
    draftContinuous.value = cont ?? false
  },
  { immediate: true }
)

function toggleMinutes(minutes: number) {
  const next = new Set(selectedMinutes.value)
  if (next.has(minutes)) next.delete(minutes)
  else next.add(minutes)
  selectedMinutes.value = next
}

function customLabel(minutes: number): string {
  if (minutes % (7 * 24 * 60) === 0) return `提前 ${minutes / (7 * 24 * 60)} 周`
  if (minutes % (24 * 60) === 0) return `提前 ${minutes / (24 * 60)} 天`
  if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`
  return `提前 ${minutes} 分钟`
}

function onCustomConfirm(minutes: number) {
  toggleMinutes(minutes)
  if (!selectedMinutes.value.has(minutes)) {
    selectedMinutes.value = new Set([...selectedMinutes.value, minutes])
  }
  panel.value = 'list'
}

function confirm() {
  emit('confirm', [...selectedMinutes.value].sort((a, b) => b - a), draftContinuous.value)
}
</script>

<style scoped lang="scss">
.remind-multi-offset {
  width: 300px;
}

.remind-multi-offset__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}

.remind-multi-offset__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px;
  font-size: 15px;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    background: var(--desktop-hover);
  }

  &.is-selected {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.remind-multi-offset__check {
  font-size: 14px;
}

.remind-multi-offset__continuous {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 4px;
  margin-top: 8px;
  border-top: 1px solid var(--desktop-border);
}

.remind-multi-offset__continuous-label {
  font-size: 14px;
  color: var(--desktop-text);
}

.remind-multi-offset__actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.remind-multi-offset__btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &--ghost {
    border: 1px solid var(--desktop-border);
    background: #fff;
  }

  &--primary {
    border: none;
    background: var(--el-color-primary);
    color: #fff;
  }
}
</style>
