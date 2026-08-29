<template>
  <div class="task-recurrence-custom">
    <div class="task-recurrence-custom__row">
      <span class="task-recurrence-custom__prefix">每</span>
      <input
        v-model.number="interval"
        type="number"
        min="1"
        class="task-recurrence-custom__amount"
        @keydown.enter.prevent="confirm"
      />
      <el-dropdown trigger="click" @command="onUnitChange">
        <button type="button" class="task-recurrence-custom__unit">
          <span>{{ unitLabel }}</span>
          <el-icon><ArrowDown /></el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="u in RECURRENCE_CUSTOM_UNITS"
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
    <p v-if="dueAt && previewNext" class="task-recurrence-custom__preview">
      下次：{{ previewNext }}
    </p>
    <div class="task-recurrence-custom__actions">
      <button
        type="button"
        class="task-recurrence-custom__btn task-recurrence-custom__btn--ghost"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="button"
        class="task-recurrence-custom__btn task-recurrence-custom__btn--primary"
        @click="confirm"
      >
        确定
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import {
  RECURRENCE_CUSTOM_UNITS,
  nextDueAfterRecurrence,
  type RecurrenceUnit,
  type TaskRecurrenceRule
} from '@shared/task-reminder'
import { formatIsoReadable } from '@/utils/datetime'

const props = defineProps<{
  dueAt?: string | null
  initial?: TaskRecurrenceRule | null
}>()

const emit = defineEmits<{
  confirm: [rule: TaskRecurrenceRule]
  cancel: []
}>()

const interval = ref(1)
const unit = ref<RecurrenceUnit>('day')

if (props.initial?.type === 'custom') {
  interval.value = Math.max(1, props.initial.interval ?? 1)
  unit.value = props.initial.unit ?? 'day'
}

const unitLabel = computed(
  () => RECURRENCE_CUSTOM_UNITS.find((u) => u.key === unit.value)?.label ?? '天'
)

const previewNext = computed(() => {
  if (!props.dueAt) return ''
  const rule: TaskRecurrenceRule = {
    type: 'custom',
    interval: Math.max(1, interval.value || 1),
    unit: unit.value
  }
  const next = nextDueAfterRecurrence(props.dueAt, rule)
  return next ? formatIsoReadable(next) : ''
})

function onUnitChange(key: RecurrenceUnit) {
  unit.value = key
}

function confirm() {
  emit('confirm', {
    type: 'custom',
    interval: Math.max(1, interval.value || 1),
    unit: unit.value
  })
}
</script>

<style scoped lang="scss">
.task-recurrence-custom__row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.task-recurrence-custom__prefix {
  font-size: 15px;
  color: var(--desktop-text);
  flex-shrink: 0;
}

.task-recurrence-custom__amount {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  font-size: 15px;
}

.task-recurrence-custom__unit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--el-color-primary);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  min-width: 72px;
  justify-content: space-between;
}

.task-recurrence-custom__preview {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 500;
}

.task-recurrence-custom__actions {
  display: flex;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--desktop-border);
}

.task-recurrence-custom__btn {
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
