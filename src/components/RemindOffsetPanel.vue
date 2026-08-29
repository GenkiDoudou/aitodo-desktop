<template>
  <div class="remind-offset-panel">
    <ul class="remind-offset-panel__list">
      <li
        v-for="opt in options"
        :key="opt.key"
        class="remind-offset-panel__item"
        :class="{ 'is-selected': selectedKey === opt.key }"
        @click="selectOffset(opt)"
      >
        <span>{{ opt.label }}</span>
        <span v-if="selectedKey === opt.key" class="remind-offset-panel__check">✓</span>
      </li>
      <li
        class="remind-offset-panel__item"
        :class="{ 'is-selected': selectedKey === 'custom' }"
        @click="emit('custom')"
      >
        <span>自定义</span>
        <span v-if="selectedKey === 'custom'" class="remind-offset-panel__check">✓</span>
      </li>
    </ul>

    <div class="remind-offset-panel__actions">
      <button type="button" class="remind-offset-panel__btn remind-offset-panel__btn--ghost" @click="emit('clear')">
        清除
      </button>
      <button
        type="button"
        class="remind-offset-panel__btn remind-offset-panel__btn--primary"
        :disabled="selectedKey === 'custom'"
        @click="confirm"
      >
        确定
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  remindFromDue,
  remindOffsetOptions,
  type RemindOffsetOption
} from '@/utils/schedule-picker'

const props = defineProps<{
  dueAt: string
  initialIso?: string | null
}>()

const emit = defineEmits<{
  confirm: [string]
  clear: []
  custom: []
}>()

const options = remindOffsetOptions()
const selectedKey = ref<string>('on-time')

function matchKeyFromIso(iso: string | null | undefined): string {
  if (!iso) return 'on-time'
  for (const opt of options) {
    if (opt.minutes === null) continue
    const expected = remindFromDue(props.dueAt, opt.minutes)
    if (expected === iso) return opt.key
  }
  return 'custom'
}

watch(
  () => [props.initialIso, props.dueAt] as const,
  ([iso]) => {
    selectedKey.value = matchKeyFromIso(iso)
  },
  { immediate: true }
)

function selectOffset(opt: RemindOffsetOption) {
  selectedKey.value = opt.key
}

function confirm() {
  const opt = options.find((o) => o.key === selectedKey.value)
  if (!opt || opt.minutes === null) return
  emit('confirm', remindFromDue(props.dueAt, opt.minutes))
}
</script>

<style scoped lang="scss">
.remind-offset-panel {
  width: 300px;
}

.remind-offset-panel__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
}

.remind-offset-panel__item {
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

.remind-offset-panel__check {
  font-size: 14px;
}

.remind-offset-panel__actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.remind-offset-panel__btn {
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

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
