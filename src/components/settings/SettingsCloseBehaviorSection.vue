<template>
  <section class="settings-section">
    <h2 class="settings-section__title">窗口与启动</h2>
    <p class="settings-section__hint">控制开机自启与关闭主窗口时的行为。</p>

    <div class="settings-section__field">
      <span class="settings-section__label">开机时自动启动</span>
      <el-switch
        v-model="launch.enabled"
        :disabled="loadingLaunch || savingLaunch"
        @change="saveLaunch"
      />
    </div>
    <p v-if="!packaged" class="settings-section__hint settings-section__hint--tight">
      当前为开发/未打包启动，系统自启可能无效，请用安装包验证。
    </p>
    <p v-if="syncedHint" class="settings-section__hint settings-section__hint--tight">
      {{ syncedHint }}
    </p>

    <div v-if="launch.enabled" class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">启动后</span>
      <el-radio-group
        v-model="launch.startupMode"
        :disabled="loadingLaunch || savingLaunch"
        @change="saveLaunch"
      >
        <el-radio value="tray">静默到托盘</el-radio>
        <el-radio value="window">打开主窗口</el-radio>
      </el-radio-group>
    </div>

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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { CloseBehavior } from '@shared/close-behavior'
import type { LaunchAtLoginPrefs } from '@shared/launch-at-login'
import { unwrapIpc } from '@/ipc/client'

const behavior = ref<CloseBehavior>('ask')
const loading = ref(false)
const saving = ref(false)

const launch = reactive<LaunchAtLoginPrefs>({
  enabled: false,
  startupMode: 'tray'
})
const packaged = ref(true)
const syncedHint = ref('')
const loadingLaunch = ref(false)
const savingLaunch = ref(false)

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

async function loadLaunch() {
  loadingLaunch.value = true
  syncedHint.value = ''
  try {
    const data = unwrapIpc(await window.api.app.getLaunchAtLogin())
    launch.enabled = data.enabled
    launch.startupMode = data.startupMode
    packaged.value = data.packaged
    if (data.syncedFromSystem) {
      syncedHint.value = '已与系统设置同步'
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '读取开机自启失败')
  } finally {
    loadingLaunch.value = false
  }
}

async function saveLaunch() {
  savingLaunch.value = true
  try {
    const saved = unwrapIpc(
      await window.api.app.setLaunchAtLogin({
        enabled: launch.enabled,
        startupMode: launch.startupMode
      })
    )
    launch.enabled = saved.enabled
    launch.startupMode = saved.startupMode
    ElMessage.success('开机自启已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存开机自启失败')
    await loadLaunch()
  } finally {
    savingLaunch.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadBehavior(), loadLaunch()])
})
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

  &--tight {
    margin: -8px 0 16px;
  }
}

.settings-section__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  margin-bottom: 12px;
  background: var(--desktop-panel);

  &--stack {
    flex-direction: column;
    align-items: flex-start;
  }
}

.settings-section__label {
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}
</style>
