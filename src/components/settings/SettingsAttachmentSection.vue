<template>
  <section class="settings-section">
    <h2 class="settings-section__title">附件管理</h2>
    <p class="settings-section__hint">
      选择任务附件的存储方式。任意模式都会先写入本机缓存；打开时优先使用本地文件。
    </p>

    <div class="settings-section__field settings-section__field--stack">
      <span class="settings-section__label">存储模式</span>
      <el-radio-group v-model="mode" :disabled="loading || saving" @change="onModeChange">
        <el-radio value="local">仅本地</el-radio>
        <el-radio value="server" :disabled="!loggedIn">服务端（≤20MB）</el-radio>
        <el-radio value="s3">自配 S3 兼容</el-radio>
      </el-radio-group>
    </div>

    <p v-if="mode === 'local'" class="settings-section__hint settings-section__hint--tight">
      仅本地时，其他设备可能看不到附件文件（云同步只传链接）。
    </p>
    <p v-else-if="mode === 'server' && !loggedIn" class="settings-section__hint settings-section__hint--tight">
      使用服务端存储前请先在「账号与同步」登录。
      <el-button text type="primary" @click="goSync">去登录</el-button>
    </p>

    <template v-if="mode === 's3'">
      <div class="settings-section__field">
        <span class="settings-section__label">Endpoint</span>
        <el-input v-model="s3.endpoint" placeholder="https://s3.example.com" :disabled="loading || saving" />
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">Bucket</span>
        <el-input v-model="s3.bucket" placeholder="my-bucket" :disabled="loading || saving" />
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">Region（可选）</span>
        <el-input v-model="s3.region" placeholder="us-east-1" :disabled="loading || saving" />
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">AccessKey</span>
        <el-input
          v-model="accessKey"
          :placeholder="hasS3Secrets ? '已保存（留空则不改）' : 'Access Key'"
          show-password
          :disabled="loading || saving"
        />
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">Secret</span>
        <el-input
          v-model="secretKey"
          :placeholder="hasS3Secrets ? '已保存（留空则不改）' : 'Secret Key'"
          show-password
          :disabled="loading || saving"
        />
      </div>
      <div class="settings-section__field">
        <span class="settings-section__label">同步 S3 密钥</span>
        <el-switch
          v-model="syncS3Secrets"
          :disabled="loading || saving || testing"
          @change="saveModeOnly"
        />
      </div>
      <div class="settings-section__actions">
        <el-button type="primary" :loading="testing" :disabled="loading || saving" @click="testAndSave">
          测试连接并保存
        </el-button>
        <el-button :disabled="loading || saving || testing" @click="saveModeOnly">仅保存模式与公开配置</el-button>
      </div>
      <p class="settings-section__hint settings-section__hint--tight">
        默认不同步 AccessKey / Secret。开启后密钥会随「账号与同步」的配置同步上传到服务器，其他已登录设备可自动使用；请确认你信任该同步账号与服务端。
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_ATTACHMENT_PREFS,
  type AttachmentPrefs,
  type AttachmentStorageMode
} from '@shared/attachment-storage'
import { unwrapIpc } from '@/ipc/client'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const loggedIn = ref(false)
const hasS3Secrets = ref(false)
const mode = ref<AttachmentStorageMode>(DEFAULT_ATTACHMENT_PREFS.mode)
const syncS3Secrets = ref(false)
const s3 = reactive({ endpoint: '', bucket: '', region: '' })
const accessKey = ref('')
const secretKey = ref('')

async function load() {
  loading.value = true
  try {
    const data = unwrapIpc(await window.api.app.getAttachmentPrefs())
    mode.value = data.prefs.mode
    syncS3Secrets.value = Boolean(data.prefs.syncS3Secrets)
    loggedIn.value = data.loggedIn
    hasS3Secrets.value = data.hasS3Secrets
    s3.endpoint = data.prefs.s3?.endpoint ?? ''
    s3.bucket = data.prefs.s3?.bucket ?? ''
    s3.region = data.prefs.s3?.region ?? ''
    accessKey.value = ''
    secretKey.value = ''
  } finally {
    loading.value = false
  }
}

function buildPrefs(): AttachmentPrefs {
  if (mode.value === 's3') {
    return {
      mode: 's3',
      syncS3Secrets: syncS3Secrets.value,
      s3: {
        endpoint: s3.endpoint.trim(),
        bucket: s3.bucket.trim(),
        ...(s3.region.trim() ? { region: s3.region.trim() } : {})
      }
    }
  }
  return { mode: mode.value, syncS3Secrets: syncS3Secrets.value }
}

async function onModeChange() {
  if (mode.value === 'server' && !loggedIn.value) {
    ElMessage.warning('请先登录账号与同步')
    mode.value = 'local'
    return
  }
  if (mode.value === 's3') {
    return
  }
  saving.value = true
  try {
    const next = unwrapIpc(await window.api.app.setAttachmentPrefs(buildPrefs()))
    mode.value = next.mode
    ElMessage.success('附件存储模式已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
    await load()
  } finally {
    saving.value = false
  }
}

async function saveModeOnly() {
  saving.value = true
  try {
    const next = unwrapIpc(await window.api.app.setAttachmentPrefs(buildPrefs()))
    mode.value = next.mode
    ElMessage.success('已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function testAndSave() {
  if (!accessKey.value.trim() || !secretKey.value.trim()) {
    if (!hasS3Secrets.value) {
      ElMessage.warning('请填写 AccessKey 与 Secret')
      return
    }
    ElMessage.warning('更新密钥时请同时填写 AccessKey 与 Secret，或使用「仅保存模式与公开配置」')
    return
  }
  testing.value = true
  try {
    const next = unwrapIpc(
      await window.api.app.testAndSaveS3({
        s3: {
          endpoint: s3.endpoint.trim(),
          bucket: s3.bucket.trim(),
          ...(s3.region.trim() ? { region: s3.region.trim() } : {})
        },
        secrets: { accessKey: accessKey.value.trim(), secretKey: secretKey.value.trim() }
      })
    )
    mode.value = next.mode
    hasS3Secrets.value = true
    accessKey.value = ''
    secretKey.value = ''
    ElMessage.success('S3 连接成功，配置已保存')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'S3 测试失败，未写入密钥')
  } finally {
    testing.value = false
  }
}

function goSync() {
  router.push({ path: '/settings', query: { section: 'sync' } })
}

onMounted(load)
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 720px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: var(--desktop-text);
}

.settings-section__hint {
  margin: 0 0 20px;
  color: var(--desktop-muted);
  font-size: 13px;
  line-height: 1.5;
}

.settings-section__hint--tight {
  margin-top: -8px;
  margin-bottom: 16px;
}

.settings-section__field {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;

  .settings-section__label {
    width: 140px;
    flex-shrink: 0;
    color: var(--desktop-text);
    font-size: 14px;
  }

  :deep(.el-input) {
    flex: 1;
  }
}

.settings-section__field--stack {
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;

  .settings-section__label {
    width: auto;
  }
}

.settings-section__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
