<template>
  <section class="settings-section">
    <h2 class="settings-section__title">关闭行为</h2>
    <p class="settings-section__hint">设置点击主窗口关闭按钮时的默认处理方式。</p>

    <div class="settings-section__field">
      <span class="settings-section__label">关闭主窗口时</span>
      <el-radio-group
        v-model="behavior"
        :disabled="loading || saving"
        @change="saveBehavior"
      >
        <el-radio value="ask">每次询问</el-radio>
        <el-radio value="tray">缩小到托盘</el-radio>
        <el-radio value="quit">退出应用</el-radio>
      </el-radio-group>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CloseBehavior } from '@shared/close-behavior'
import { unwrapIpc } from '@/ipc/client'

const behavior = ref<CloseBehavior>('ask')
const loading = ref(false)
const saving = ref(false)

async function loadBehavior() {
  loading.value = true
  try {
    behavior.value = unwrapIpc(await window.api.app.getCloseBehavior())
  } finally {
    loading.value = false
  }
}

async function saveBehavior(value: string | number | boolean | undefined) {
  const next = value as CloseBehavior
  saving.value = true
  try {
    behavior.value = unwrapIpc(await window.api.app.setCloseBehavior(next))
    ElMessage.success('关闭行为已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存关闭行为失败')
    await loadBehavior()
  } finally {
    saving.value = false
  }
}

onMounted(loadBehavior)
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 720px;
}

.settings-section__title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.settings-section__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: var(--desktop-panel);
}

.settings-section__label {
  font-size: 14px;
  font-weight: 600;
}
</style>
