<template>
  <el-dialog
    :model-value="modelValue"
    :title="rule ? '编辑自定义规则' : '新建自定义规则'"
    width="440px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="规则名称">
        <el-input v-model="localForm.name" placeholder="例如：双十一活动" maxlength="32" show-word-limit />
      </el-form-item>
      <el-form-item label="匹配方式">
        <el-radio-group v-model="localForm.matchType">
          <el-radio value="keyword">关键字（文件名包含）</el-radio>
          <el-radio value="extension">文件后缀</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="localForm.matchType === 'keyword' ? '关键字' : '后缀（逗号分隔）'">
        <el-input
          v-model="localForm.matchValue"
          :placeholder="localForm.matchType === 'keyword' ? '双十一' : 'pdf, doc, docx'"
        />
      </el-form-item>
      <el-form-item label="整理到分区">
        <el-select v-model="localForm.categoryId" placeholder="选择目标分类" style="width: 100%">
          <el-option
            v-for="cat in selectableCategories"
            :key="cat.id"
            :label="cat.name"
            :value="cat.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="启用规则">
        <el-switch v-model="localForm.enabled" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type {
  CreateDesktopCustomRuleDto,
  DesktopCategory,
  DesktopCustomRule
} from '@shared/desktop-organize-types'

const props = defineProps<{
  modelValue: boolean
  categories: DesktopCategory[]
  rule: DesktopCustomRule | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [dto: CreateDesktopCustomRuleDto, id?: string]
}>()

const localForm = ref({
  name: '',
  matchType: 'keyword' as 'extension' | 'keyword',
  matchValue: '',
  categoryId: '',
  enabled: true
})

const selectableCategories = computed(() =>
  props.categories.filter((c) => c.id !== 'uncategorized' && c.enabled)
)

watch(
  () => [props.modelValue, props.rule] as const,
  ([open]) => {
    if (!open) return
    if (props.rule) {
      localForm.value = {
        name: props.rule.name,
        matchType: props.rule.matchType,
        matchValue: props.rule.matchValue,
        categoryId: props.rule.categoryId,
        enabled: props.rule.enabled
      }
    } else {
      localForm.value = {
        name: '',
        matchType: 'keyword',
        matchValue: '',
        categoryId: selectableCategories.value[0]?.id ?? '',
        enabled: true
      }
    }
  },
  { immediate: true }
)

function submit() {
  const name = localForm.value.name.trim()
  const matchValue = localForm.value.matchValue.trim()
  if (!name) {
    ElMessage.warning('请输入规则名称')
    return
  }
  if (!matchValue) {
    ElMessage.warning(localForm.value.matchType === 'keyword' ? '请输入关键字' : '请输入后缀')
    return
  }
  if (!localForm.value.categoryId) {
    ElMessage.warning('请选择目标分区')
    return
  }
  emit('save', { ...localForm.value, name, matchValue }, props.rule?.id)
}
</script>
