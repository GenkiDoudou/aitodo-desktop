<template>
  <!--
    列表优先级：text=单行 P 文字色（HTML 原型）；solid=实心徽章；soft=浅底。
  -->
  <span
    class="priority-badge"
    :class="[`is-p${meta.value}`, `is-${variant}`]"
    :title="`${meta.code} · ${meta.label}`"
  >
    {{ meta.code }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTaskPriorityMeta, type TaskPriority } from '@shared/task-priority'

const props = withDefaults(
  defineProps<{
    priority: TaskPriority
    /** text=列表 P 文字色；solid=实心徽章；soft=浅底 */
    variant?: 'text' | 'solid' | 'soft'
  }>(),
  { variant: 'text' }
)

const meta = computed(() => getTaskPriorityMeta(props.priority))
const variant = computed(() => props.variant)
</script>

<style scoped lang="scss">
.priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 28px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  border: none;

  &.is-text {
    min-width: 28px;
    height: auto;
    padding: 0;
    background: transparent;
    font-size: 12px;
    font-weight: 650;

    &.is-p1 {
      color: var(--desktop-priority-p0);
    }

    &.is-p2 {
      color: var(--desktop-priority-p1);
    }

    &.is-p3 {
      color: var(--desktop-priority-p2);
    }

    &.is-p4 {
      color: var(--desktop-priority-p3);
    }
  }

  &.is-solid {
    color: #fff;

    &.is-p1 {
      background: var(--desktop-priority-p0);
    }

    &.is-p2 {
      background: var(--desktop-priority-p1);
    }

    &.is-p3 {
      background: var(--desktop-priority-p2);
    }

    &.is-p4 {
      background: var(--desktop-priority-p3);
    }
  }

  &.is-soft {
    &.is-p1 {
      color: var(--desktop-priority-p0);
      background: var(--desktop-priority-p0-tint);
    }

    &.is-p2 {
      color: var(--desktop-priority-p1);
      background: var(--desktop-priority-p1-tint);
    }

    &.is-p3 {
      color: #ca8a04;
      background: var(--desktop-priority-p2-tint);
    }

    &.is-p4 {
      color: var(--desktop-priority-p3);
      background: var(--desktop-priority-p3-tint);
    }
  }
}
</style>
