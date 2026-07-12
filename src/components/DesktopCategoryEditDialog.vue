<template>
  <el-dialog
    :model-value="modelValue"
    :title="category ? '编辑分类' : '新建分类'"
    width="480px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="显示名称" required>
        <el-input v-model="name" maxlength="32" placeholder="例如：文档" />
      </el-form-item>
      <el-form-item label="目标文件夹名">
        <el-input v-model="targetFolderName" maxlength="32" :placeholder="name || '与显示名相同'" />
        <p class="desktop-cat-edit__hint">整理后路径：{{ folderPrefix }}{{ targetFolderName || name || '…' }}/</p>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="图标">
            <el-input v-model="icon" maxlength="4" placeholder="📁" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="颜色">
            <el-color-picker v-model="color" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="规则">
        <div class="desktop-cat-edit__rules">
          <div v-for="(rule, index) in rules" :key="index" class="desktop-cat-edit__rule-row">
            <el-select v-model="rule.type" style="width: 120px" @change="onRuleTypeChange(rule)">
              <el-option label="类型" value="kind" />
              <el-option label="扩展名" value="extension" />
              <el-option label="文件名" value="namePattern" />
            </el-select>
            <template v-if="rule.type === 'kind'">
              <el-select v-model="rule.value" style="flex: 1">
                <el-option label="文件" value="file" />
                <el-option label="文件夹" value="folder" />
                <el-option label="图标" value="icon" />
              </el-select>
            </template>
            <template v-else-if="rule.type === 'extension'">
              <el-select
                v-model="rule.values"
                multiple
                filterable
                allow-create
                default-first-option
                collapse-tags
                style="flex: 1"
                placeholder=".pdf, .docx"
              />
            </template>
            <template v-else-if="rule.type === 'namePattern'">
              <el-input v-model="rule.pattern" style="flex: 1" placeholder="*报告*" />
            </template>
            <el-button text type="danger" @click="rules.splice(index, 1)">删除</el-button>
          </div>
          <el-button size="small" @click="addRule">+ 添加规则</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { DesktopCategory, DesktopCategoryRule } from '@shared/desktop-organize-types'

const props = defineProps<{
  modelValue: boolean
  category?: DesktopCategory | null
  folderPrefix: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  save: [payload: {
    name: string
    targetFolderName: string
    icon: string
    color: string
    rules: DesktopCategoryRule[]
  }]
}>()

const name = ref('')
const targetFolderName = ref('')
const icon = ref('📁')
const color = ref('#dbeafe')
const rules = ref<DesktopCategoryRule[]>([])
const saving = ref(false)

watch(
  () => [props.modelValue, props.category] as const,
  ([open, category]) => {
    if (!open) return
    name.value = category?.name ?? ''
    targetFolderName.value = category?.targetFolderName ?? ''
    icon.value = category?.icon ?? '📁'
    color.value = category?.color ?? '#dbeafe'
    rules.value = category?.rules?.length
      ? category.rules.map((r) => ({ ...r }))
      : [{ type: 'extension', values: ['.pdf'] }]
  },
  { immediate: true }
)

function onClosed() {
  saving.value = false
}

function addRule() {
  rules.value.push({ type: 'extension', values: [] })
}

function onRuleTypeChange(rule: DesktopCategoryRule) {
  if (rule.type === 'kind') {
    ;(rule as { type: 'kind'; value: 'file' }).value = 'file'
  } else if (rule.type === 'extension') {
    ;(rule as { type: 'extension'; values: string[] }).values = []
  } else if (rule.type === 'namePattern') {
    ;(rule as { type: 'namePattern'; pattern: string }).pattern = '*'
  }
}

function submit() {
  const title = name.value.trim()
  if (!title) {
    ElMessage.warning('请输入分类名称')
    return
  }
  saving.value = true
  emit('save', {
    name: title,
    targetFolderName: targetFolderName.value.trim() || title,
    icon: icon.value.trim() || '📁',
    color: color.value,
    rules: rules.value.filter((r) => {
      if (r.type === 'extension') return r.values.length > 0
      if (r.type === 'namePattern') return r.pattern.trim().length > 0
      return true
    })
  })
  saving.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped>
.desktop-cat-edit__hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.desktop-cat-edit__rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.desktop-cat-edit__rule-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
