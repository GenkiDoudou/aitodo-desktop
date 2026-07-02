<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/task-store'

const router = useRouter()
const taskStore = useTaskStore()

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('desktop:new-task'))
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.api.app.onNewTask(() => {
    window.dispatchEvent(new CustomEvent('desktop:new-task'))
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
</style>
