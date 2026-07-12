<template>
  <el-dialog
    :model-value="modelValue"
    :title="category ? '编辑清单' : '新建清单'"
    width="420px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="清单名称" required>
        <el-input v-model="name" maxlength="64" show-word-limit placeholder="例如：工作" />
      </el-form-item>
      <el-form-item>
        <template #label>
          <span>关键词</span>
          <span class="category-edit__hint">标题包含关键词时自动归入此清单；全局不可重复</span>
        </template>
        <el-select
          v-model="keywords"
          class="category-edit__keywords"
          multiple
          filterable
          allow-create
          default-first-option
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="4"
          placeholder="输入后回车添加关键词"
          no-data-text="输入后回车添加关键词"
        >
          <el-option v-for="kw in keywords" :key="kw" :label="kw" :value="kw" />
        </el-select>
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
import type { Category } from '@shared/types'
import {
  findCategoryKeywordConflict,
  normalizeCategoryKeyword,
  normalizeCategoryKeywords
} from '@shared/category-keywords'
import { useCategoryStore } from '@/stores/category-store'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  category?: Category | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const categoryStore = useCategoryStore()
const name = ref('')
const keywords = ref<string[]>([])
const saving = ref(false)

watch(
  () => [props.modelValue, props.category] as const,
  ([open, category]) => {
    if (!open) return
    name.value = category?.name ?? ''
    keywords.value = [...(category?.keywords ?? [])]
  },
  { immediate: true }
)

function onClosed() {
  saving.value = false
}

async function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) {
    ElMessage.warning('请输入清单名称')
    return
  }

  const normalized = normalizeCategoryKeywords(keywords.value)
  for (const raw of keywords.value) {
    const norm = normalizeCategoryKeyword(raw)
    if (raw.trim() && !norm) {
      ElMessage.warning(`关键词「${raw}」无效，不能为空且不超过 32 字`)
      return
    }
  }

  const conflict = findCategoryKeywordConflict(
    normalized,
    categoryStore.categories.map((c) => ({
      id: c.id,
      name: c.name,
      keywords: c.keywords ?? []
    })),
    props.category?.id
  )
  if (conflict) {
    ElMessage.warning(conflict)
    return
  }

  saving.value = true
  try {
    if (props.category) {
      await categoryStore.update(props.category.id, {
        name: trimmedName,
        keywords: normalized
      })
    } else {
      await categoryStore.create(trimmedName, { keywords: normalized })
    }
    emit('update:modelValue', false)
    emit('saved')
  } catch {
    /* store / IPC 已 Toast */
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.category-edit__hint {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--desktop-muted);
}

.category-edit__keywords {
  width: 100%;
}
</style>
