<template>
  <div class="shortcut-editor">
    <el-button size="small" @click="startCapture" :disabled="capturing">
      {{ capturing ? '请按下快捷键…' : '更改' }}
    </el-button>
    <el-button v-if="!isDefault" size="small" text @click="emit('reset')">恢复默认</el-button>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { normalizeAccelerator } from '@shared/shortcuts'

const props = defineProps<{
  value: string
  isDefault: boolean
}>()

const emit = defineEmits<{
  change: [string]
  reset: []
}>()

const capturing = ref(false)

function buildAccelerator(e: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return null
  }
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key === ',' ? ',' : e.key.length === 1 ? e.key.toUpperCase() : e.key
  parts.push(key)
  return normalizeAccelerator(parts.join('+'))
}

function onCaptureKeydown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  const accel = buildAccelerator(e)
  if (!accel) return
  stopCapture()
  emit('change', accel)
}

function startCapture() {
  if (capturing.value) return
  capturing.value = true
  window.addEventListener('keydown', onCaptureKeydown, true)
}

function stopCapture() {
  capturing.value = false
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

onUnmounted(stopCapture)
</script>

<style scoped lang="scss">
.shortcut-editor {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
