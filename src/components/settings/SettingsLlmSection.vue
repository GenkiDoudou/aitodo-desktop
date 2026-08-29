<template>
  <section class="settings-section">
    <h2 class="settings-section__title">大模型配置</h2>
    <p class="settings-section__hint">
      配置保存在本地 config.json，供「AI 一句话」等功能调用。API Key 不会上传至第三方服务器（除所选模型服务商外）。
    </p>

    <el-form label-position="top" class="settings-section__form" @submit.prevent="save">
      <el-form-item label="服务商">
        <el-radio-group v-model="form.provider" @change="onProviderChange">
          <el-radio
            v-for="preset in providerList"
            :key="preset.id"
            :value="preset.id"
          >
            {{ preset.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          :placeholder="currentPreset.apiKeyHint"
          autocomplete="off"
        />
      </el-form-item>

      <el-form-item label="模型">
        <el-input v-model="form.model" :placeholder="currentPreset.modelHint" />
      </el-form-item>

      <el-form-item label="API 基址（OpenAI 兼容）">
        <el-input v-model="form.baseUrl" :placeholder="currentPreset.defaultBaseUrl" />
        <p class="settings-section__field-hint">留空则使用服务商默认地址</p>
      </el-form-item>

      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  LLM_PROVIDER_PRESETS,
  type LlmConfig,
  type LlmProvider,
  mergeLlmConfig
} from '@shared/llm-config'
import { useLlmStore } from '@/stores/llm-store'

const llmStore = useLlmStore()
const saving = ref(false)

const form = reactive<LlmConfig>(mergeLlmConfig())

const providerList = Object.values(LLM_PROVIDER_PRESETS)

const currentPreset = computed(() => LLM_PROVIDER_PRESETS[form.provider])

function onProviderChange(provider: LlmProvider) {
  const preset = LLM_PROVIDER_PRESETS[provider]
  form.model = preset.defaultModel
  form.baseUrl = preset.defaultBaseUrl
}

function applyFromStore() {
  const cfg = llmStore.config ?? mergeLlmConfig()
  form.provider = cfg.provider
  form.apiKey = cfg.apiKey
  form.model = cfg.model
  form.baseUrl = cfg.baseUrl
}

async function save() {
  saving.value = true
  try {
    await llmStore.save(mergeLlmConfig({ ...form }))
    ElMessage.success('大模型配置已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!llmStore.loaded) {
    await llmStore.load()
  }
  applyFromStore()
})
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 560px;
}

.settings-section__title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0 0 20px;
  line-height: 1.5;
}

.settings-section__form {
  :deep(.el-form-item__label) {
    font-weight: 600;
    font-size: 13px;
  }
}

.settings-section__field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
}
</style>
