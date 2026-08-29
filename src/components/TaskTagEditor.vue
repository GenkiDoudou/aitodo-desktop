<template>
  <el-select
    :model-value="modelValue"
    class="task-tag-editor"
    multiple
    filterable
    allow-create
    default-first-option
    collapse-tags
    collapse-tags-tooltip
    :max-collapse-tags="3"
    placeholder="添加标签"
    no-data-text="输入后回车创建标签"
    @update:model-value="onUpdate"
  >
    <el-option v-for="name in suggestions" :key="name" :label="name" :value="name">
      <span>#{{ name }}</span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { normalizeTagName, normalizeTagNames } from '@shared/task-tags'
import { useTagStore } from '@/stores/tag-store'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const tagStore = useTagStore()

const suggestions = computed(() => {
  const current = new Set(props.modelValue)
  return tagStore.names.filter((name) => !current.has(name))
})

function onUpdate(raw: string[]) {
  const next: string[] = []
  for (const item of raw) {
    const norm = normalizeTagName(item)
    if (!norm) {
      ElMessage.warning(`标签「${item}」格式无效，仅支持中文、字母、数字和连字符，1–32 字`)
      continue
    }
    if (!next.includes(norm)) {
      next.push(norm)
    }
  }
  emit('update:modelValue', normalizeTagNames(next))
}

onMounted(() => {
  void tagStore.load()
})
</script>

<style scoped lang="scss">
.task-tag-editor {
  width: 100%;
}
</style>
