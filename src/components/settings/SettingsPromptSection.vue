<template>
  <section class="settings-section">
    <h2 class="settings-section__title">提示词管理</h2>
    <p class="settings-section__hint">
      配置「AI 一句话」解析任务时发送给大模型的提示词。用户模板支持占位符：
      <code>{input}</code> 用户输入、<code>{today}</code> 今天日期、<code>{categories}</code> 可选分类列表。
    </p>

    <el-form label-position="top" class="settings-section__form" @submit.prevent="save">
      <el-form-item label="系统提示词">
        <el-input
          v-model="form.systemPrompt"
          type="textarea"
          :rows="12"
          resize="vertical"
          placeholder="指导模型如何输出 JSON 结构…"
        />
      </el-form-item>

      <el-form-item label="用户消息模板">
        <el-input
          v-model="form.userTemplate"
          type="textarea"
          :rows="6"
          resize="vertical"
          placeholder="须包含 {input} 占位符"
        />
      </el-form-item>

      <div class="settings-section__actions">
        <el-button @click="resetDefault">恢复默认</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存提示词</el-button>
      </div>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getDefaultAiPromptConfig,
  mergeAiPromptConfig,
  type AiPromptConfig
} from '@shared/ai-prompt-config'
import { useAiPromptStore } from '@/stores/ai-prompt-store'

const promptStore = useAiPromptStore()
const saving = ref(false)
const form = reactive<AiPromptConfig>(getDefaultAiPromptConfig())

function applyFromStore() {
  const cfg = promptStore.config ?? getDefaultAiPromptConfig()
  form.systemPrompt = cfg.systemPrompt
  form.userTemplate = cfg.userTemplate
}

async function save() {
  if (!form.userTemplate.includes('{input}')) {
    ElMessage.warning('用户模板须包含 {input} 占位符')
    return
  }
  saving.value = true
  try {
    await promptStore.save(mergeAiPromptConfig({ ...form }))
    ElMessage.success('提示词已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    saving.value = false
  }
}

async function resetDefault() {
  try {
    await ElMessageBox.confirm('确定恢复为默认提示词？', '恢复默认', { type: 'warning' })
    const defaults = getDefaultAiPromptConfig()
    form.systemPrompt = defaults.systemPrompt
    form.userTemplate = defaults.userTemplate
  } catch {
    /* 取消 */
  }
}

onMounted(async () => {
  if (!promptStore.loaded) {
    await promptStore.load()
  }
  applyFromStore()
})
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 720px;
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
  line-height: 1.6;

  code {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--desktop-bg);
    font-size: 12px;
  }
}

.settings-section__form {
  :deep(.el-form-item__label) {
    font-weight: 600;
    font-size: 13px;
  }
}

.settings-section__actions {
  display: flex;
  gap: 8px;
}
</style>
