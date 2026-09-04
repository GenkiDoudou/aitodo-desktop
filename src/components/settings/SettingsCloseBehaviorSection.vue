<template>
  <!--
    窗口与启动：贴 preview.html 启动 / 窗口 panel。
    真实：开机自启、启动后托盘、关闭行为；其余为原型交互。
  -->
  <section class="settings-section">
    <div class="settings-panel">
      <h2 class="settings-panel__title">启动</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">开机自动启动</div>
            <div class="settings-row__label-desc">登录系统后自动启动 Todo</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              v-model="launch.enabled"
              :disabled="loadingLaunch || savingLaunch"
              @change="saveLaunch"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">启动后最小化</div>
            <div class="settings-row__label-desc">启动后直接进入系统托盘</div>
          </div>
          <div class="settings-row__control">
            <el-switch
              :model-value="launch.startupMode === 'tray'"
              :disabled="loadingLaunch || savingLaunch || !launch.enabled"
              @change="onMinimizeChange"
            />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">关闭窗口时</div>
            <div class="settings-row__label-desc">选择点击关闭按钮后的行为</div>
          </div>
          <div class="settings-row__control">
            <el-select
              v-model="behavior"
              style="width: 200px"
              :disabled="loading || saving"
              @change="saveBehavior"
            >
              <el-option label="每次询问" value="ask" />
              <el-option label="最小化到系统托盘" value="tray" />
              <el-option label="直接退出应用" value="quit" />
            </el-select>
          </div>
        </div>
        <p v-if="!packaged" class="settings-hint">
          当前为开发/未打包启动，系统自启可能无效，请用安装包验证。
        </p>
        <p v-if="syncedHint" class="settings-hint">{{ syncedHint }}</p>
      </div>
    </div>

    <div class="settings-panel">
      <h2 class="settings-panel__title">窗口</h2>
      <div class="settings-panel__body">
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">记住上次窗口大小</div>
            <div class="settings-row__label-desc">下次启动恢复窗口尺寸</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="rememberWindow" @change="toastProto('窗口尺寸记忆已更新')" />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">始终置顶</div>
            <div class="settings-row__label-desc">窗口保持在其他应用上方</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="topmost" @change="toastProto('置顶偏好已更新（演示）')" />
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <div class="settings-row__label-title">任务栏显示</div>
            <div class="settings-row__label-desc">在任务栏保留 Todo 图标</div>
          </div>
          <div class="settings-row__control">
            <el-switch v-model="showInTaskbar" @change="toastProto('任务栏显示偏好已更新（演示）')" />
          </div>
        </div>
      </div>
    </div>

    <el-button @click="toastProto('窗口设置已恢复默认')">恢复默认窗口设置</el-button>
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

const rememberWindow = ref(true)
const topmost = ref(false)
const showInTaskbar = ref(true)

function toastProto(msg: string) {
  ElMessage.success(msg)
}

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
    if (data.syncedFromSystem) syncedHint.value = '已与系统设置同步'
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

function onMinimizeChange(on: string | number | boolean) {
  launch.startupMode = on ? 'tray' : 'window'
  void saveLaunch()
}

onMounted(async () => {
  await Promise.all([loadBehavior(), loadLaunch()])
})
</script>

<style scoped lang="scss">
.settings-hint {
  margin: 0;
  padding: 0 18px 12px;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
