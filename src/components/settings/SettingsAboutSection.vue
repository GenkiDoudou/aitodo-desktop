<template>
  <section class="settings-section">
    <h2 class="settings-section__title">关于</h2>
    <p class="settings-section__version">小柒todo 桌面版 {{ info?.version ?? '-' }}</p>
    <p class="settings-section__hint">纯本地待办客户端，数据默认存储于本机 SQLite。</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AppInfo } from '@shared/types'
import { unwrapIpc } from '@/ipc/client'

const info = ref<AppInfo | null>(null)

onMounted(async () => {
  info.value = unwrapIpc(await window.api.app.getInfo())
})
</script>

<style scoped lang="scss">
.settings-section__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__version {
  font-size: 15px;
  margin: 0 0 8px;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0;
}
</style>
