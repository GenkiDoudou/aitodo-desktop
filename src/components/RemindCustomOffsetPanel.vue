<template>
  <div class="remind-custom-offset">
    <div class="remind-custom-offset__row">
      <input
        v-model.number="amount"
        type="number"
        min="1"
        class="remind-custom-offset__amount"
        @keydown.enter.prevent="confirm"
      />
      <el-dropdown trigger="click" @command="onUnitChange">
        <button type="button" class="remind-custom-offset__unit">
          <span>{{ unitLabel }}</span>
          <el-icon><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="u in REMIND_CUSTOM_UNITS"
              :key="u.key"
              :command="u.key"
              :class="{ 'is-active-opt': unit === u.key }"
            >
              {{ u.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <p class="remind-custom-offset__preview">提前 {{ amount }} {{ unitLabel }}</p>
    <p v-if="previewAt" class="remind-custom-offset__time">{{ previewAt }}</p>
    <div class="remind-custom-offset__actions">
      <button type="button" class="remind-custom-offset__btn remind-custom-offset__btn--ghost" @click="emit('cancel')">
        取消
      </button>
      <button type="button" class="remind-custom-offset__btn remind-custom-offset__btn--primary" @click="confirm">
        确定
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  REMIND_CUSTOM_UNITS,
  customOffsetToMinutes,
  remindAtFromDueOffset,
  type RemindCustomUnit
} from '@shared/task-reminder'
import { formatIsoReadable } from '@/utils/datetime'

const props = defineProps<{
  dueAt: string
  initialMinutes?: number
}>()

const emit = defineEmits<{
  confirm: [minutes: number]
  cancel: []
}>()

const amount = ref(30)
const unit = ref<RemindCustomUnit>('minute')

if (props.initialMinutes != null && props.initialMinutes > 0) {
  if (props.initialMinutes % (7 * 24 * 60) === 0) {
    amount.value = props.initialMinutes / (7 * 24 * 60)
    unit.value = 'week'
  } else if (props.initialMinutes % (24 * 60) === 0) {
    amount.value = props.initialMinutes / (24 * 60)
    unit.value = 'day'
  } else if (props.initialMinutes % 60 === 0) {
    amount.value = props.initialMinutes / 60
    unit.value = 'hour'
  } else {
    amount.value = props.initialMinutes
    unit.value = 'minute'
  }
}

const unitLabel = computed(() => REMIND_CUSTOM_UNITS.find((u) => u.key === unit.value)?.label ?? '分钟')

const previewAt = computed(() => {
  const minutes = customOffsetToMinutes(Math.max(1, amount.value || 1), unit.value)
  return formatIsoReadable(remindAtFromDueOffset(props.dueAt, minutes))
})

function onUnitChange(key: RemindCustomUnit) {
  unit.value = key
}

function confirm() {
  const minutes = customOffsetToMinutes(Math.max(1, amount.value || 1), unit.value)
  emit('confirm', minutes)
}
</script>

<style scoped lang="scss">
.remind-custom-offset__row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.remind-custom-offset__amount {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  font-size: 15px;
}

.remind-custom-offset__unit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--el-color-primary);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  min-width: 88px;
  justify-content: space-between;
}

.remind-custom-offset__preview {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.remind-custom-offset__time {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 500;
}

.remind-custom-offset__actions {
  display: flex;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.remind-custom-offset__btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 15px;
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

:deep(.is-active-opt) {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
