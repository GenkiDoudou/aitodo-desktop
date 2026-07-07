<template>
  <section class="settings-section">
    <h2 class="settings-section__title">提示词管理</h2>

    <article class="prompt-block prompt-block--builtin">
      <header class="prompt-block__head">
        <h3 class="prompt-block__title">{{ form.taskPromptName }}</h3>
        <el-tag size="small" type="info">内置</el-tag>
      </header>
      <p class="settings-section__hint">
        用于「AI 一句话」解析任务。用户模板须包含占位符：
        <code>{input}</code>、<code>{today}</code>、<code>{categories}</code>
      </p>
      <el-form label-position="top" class="settings-section__form">
        <el-form-item label="提示词名称">
          <el-input v-model="form.taskPromptName" disabled />
        </el-form-item>
        <el-form-item label="系统提示词（内容）">
          <el-input
            v-model="form.systemPrompt"
            type="textarea"
            :rows="10"
            resize="vertical"
            placeholder="指导模型如何输出 JSON 结构…"
          />
        </el-form-item>
        <el-form-item label="用户消息模板（内容）">
          <el-input
            v-model="form.userTemplate"
            type="textarea"
            :rows="5"
            resize="vertical"
            placeholder="须包含 {input} 占位符"
          />
        </el-form-item>
        <div class="settings-section__actions">
          <el-button @click="resetBuiltin">恢复内置默认</el-button>
          <el-button type="primary" :loading="savingBuiltin" @click="saveBuiltin">保存任务提示词</el-button>
        </div>
      </el-form>
    </article>

    <article class="prompt-block">
      <header class="prompt-block__head">
        <h3 class="prompt-block__title">自定义提示词</h3>
        <el-button type="primary" plain size="small" @click="openCustomDialog()">添加</el-button>
      </header>
      <p class="settings-section__hint">可命名多条提示词，供定时汇总等功能选择使用。</p>

      <p v-if="form.customPrompts.length === 0" class="settings-section__empty">暂无自定义提示词</p>
      <ul v-else class="prompt-list">
        <li v-for="item in form.customPrompts" :key="item.id" class="prompt-list__item">
          <div class="prompt-list__main">
            <span class="prompt-list__name">{{ item.name }}</span>
            <p class="prompt-list__preview">{{ previewContent(item.content) }}</p>
          </div>
          <div class="prompt-list__actions">
            <el-button size="small" text @click="openCustomDialog(item)">编辑</el-button>
            <el-button size="small" text type="danger" @click="removeCustom(item.id)">删除</el-button>
          </div>
        </li>
      </ul>
    </article>

    <el-dialog
      v-model="customDialogOpen"
      :title="editingCustomId ? '编辑提示词' : '添加提示词'"
      width="520px"
      destroy-on-close
      @closed="resetCustomForm"
    >
      <el-form label-position="top">
        <el-form-item label="提示词名称" required>
          <el-input v-model="customForm.name" placeholder="例如：每日回顾优化" />
        </el-form-item>
        <el-form-item label="提示词内容" required>
          <el-input
            v-model="customForm.content"
            type="textarea"
            :rows="10"
            resize="vertical"
            placeholder="输入发给大模型的提示词内容…"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="savingCustom" @click="saveCustom">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  BUILTIN_TASK_PROMPT_NAME,
  createCustomPrompt,
  getDefaultAiPromptConfig,
  mergeAiPromptConfig,
  type AiPromptConfig,
  type CustomPromptEntry
} from '@shared/ai-prompt-config'
import { useAiPromptStore } from '@/stores/ai-prompt-store'

const promptStore = useAiPromptStore()
const savingBuiltin = ref(false)
const savingCustom = ref(false)
const customDialogOpen = ref(false)
const editingCustomId = ref<string | null>(null)

const form = reactive<AiPromptConfig>(getDefaultAiPromptConfig())
const customForm = reactive({ name: '', content: '' })

function applyFromStore() {
  const cfg = promptStore.config ?? getDefaultAiPromptConfig()
  form.taskPromptName = cfg.taskPromptName
  form.systemPrompt = cfg.systemPrompt
  form.userTemplate = cfg.userTemplate
  form.customPrompts = cfg.customPrompts.map((p) => ({ ...p }))
}

function previewContent(content: string) {
  const oneLine = content.replace(/\s+/g, ' ').trim()
  return oneLine.length > 80 ? `${oneLine.slice(0, 80)}…` : oneLine
}

async function persistConfig() {
  const next = mergeAiPromptConfig({
    taskPromptName: form.taskPromptName,
    systemPrompt: form.systemPrompt,
    userTemplate: form.userTemplate,
    customPrompts: form.customPrompts
  })
  await promptStore.save(next)
  applyFromStore()
}

async function saveBuiltin() {
  if (!form.userTemplate.includes('{input}')) {
    ElMessage.warning('用户模板须包含 {input} 占位符')
    return
  }
  savingBuiltin.value = true
  try {
    await persistConfig()
    ElMessage.success('任务提示词已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    savingBuiltin.value = false
  }
}

async function resetBuiltin() {
  try {
    await ElMessageBox.confirm('确定恢复内置任务提示词为默认内容？', '恢复默认', { type: 'warning' })
    const defaults = getDefaultAiPromptConfig()
    form.taskPromptName = BUILTIN_TASK_PROMPT_NAME
    form.systemPrompt = defaults.systemPrompt
    form.userTemplate = defaults.userTemplate
  } catch {
    /* 取消 */
  }
}

function openCustomDialog(item?: CustomPromptEntry) {
  if (item) {
    editingCustomId.value = item.id
    customForm.name = item.name
    customForm.content = item.content
  } else {
    editingCustomId.value = null
    customForm.name = ''
    customForm.content = ''
  }
  customDialogOpen.value = true
}

function resetCustomForm() {
  editingCustomId.value = null
  customForm.name = ''
  customForm.content = ''
}

async function saveCustom() {
  const name = customForm.name.trim()
  const content = customForm.content.trim()
  if (!name || !content) {
    ElMessage.warning('请填写提示词名称和内容')
    return
  }
  savingCustom.value = true
  try {
    if (editingCustomId.value) {
      form.customPrompts = form.customPrompts.map((p) =>
        p.id === editingCustomId.value ? { ...p, name, content } : p
      )
    } else {
      form.customPrompts = [...form.customPrompts, createCustomPrompt(name, content)]
    }
    await persistConfig()
    customDialogOpen.value = false
    ElMessage.success('提示词已保存')
  } catch {
    /* unwrapIpc 已 Toast */
  } finally {
    savingCustom.value = false
  }
}

async function removeCustom(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该提示词？', '删除提示词', { type: 'warning' })
  } catch {
    return
  }
  form.customPrompts = form.customPrompts.filter((p) => p.id !== id)
  try {
    await persistConfig()
    ElMessage.success('已删除')
  } catch {
    applyFromStore()
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
  max-width: 820px;
}

.settings-section__title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  font-size: 13px;
  color: var(--desktop-muted);
  margin: 0 0 16px;
  line-height: 1.6;

  code {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--desktop-bg);
    font-size: 12px;
  }
}

.settings-section__empty {
  margin: 0;
  font-size: 13px;
  color: var(--desktop-muted);
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

.prompt-block {
  border: 1px solid var(--desktop-border);
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
  background: var(--desktop-panel);

  &--builtin {
    border-color: rgba(64, 158, 255, 0.25);
  }
}

.prompt-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.prompt-block__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.prompt-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.prompt-list__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--desktop-border);

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.prompt-list__name {
  font-size: 14px;
  font-weight: 600;
}

.prompt-list__preview {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.5;
}

.prompt-list__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
</style>
