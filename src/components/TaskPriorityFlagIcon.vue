<template>
  <svg
    class="priority-flag-icon"
    :class="{ 'is-outline': outline }"
    :style="{ color }"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    aria-hidden="true"
  >
    <path
      class="priority-flag-icon__pole"
      d="M4 2.5v13"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      class="priority-flag-icon__cloth"
      d="M4 3.5h10.5l-2.8 3.2 2.8 3.6H4V3.5z"
      :fill="outline ? 'none' : 'currentColor'"
      :stroke="outline ? 'currentColor' : 'none'"
      stroke-width="1.2"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  color: string
  outline?: boolean
}>()
</script>

<style scoped lang="scss">
.priority-flag-icon {
  display: block;
  flex-shrink: 0;
}
</style>
