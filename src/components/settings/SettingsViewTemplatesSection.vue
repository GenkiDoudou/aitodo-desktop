<template>
  <section class="settings-section">
    <h2 class="settings-section__title">从模板添加视图</h2>
    <p class="settings-section__hint">
      一键添加 GitHub Projects 风格的预置视图到侧栏，不会修改其他全局偏好。
    </p>
    <div class="view-templates">
      <article v-for="tpl in VIEW_TEMPLATES" :key="tpl.id" class="view-templates__card">
        <h3 class="view-templates__title">{{ tpl.title }}</h3>
        <p class="view-templates__desc">{{ tpl.description }}</p>
        <el-button size="small" :loading="addingId === tpl.id" @click="onAdd(tpl.id)">
          添加视图
        </el-button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { VIEW_TEMPLATES, type ViewTemplateId } from '@shared/view-templates'
import { useViewStore } from '@/stores/view-store'

const viewStore = useViewStore()
const addingId = ref<ViewTemplateId | null>(null)

async function onAdd(id: ViewTemplateId) {
  addingId.value = id
  try {
    const created = await viewStore.createFromTemplate(id)
    ElMessage.success(`已添加视图「${created.name}」`)
  } catch {
    /* unwrapIpc */
  } finally {
    addingId.value = null
  }
}
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
}

.view-templates {
  display: grid;
  gap: 12px;
}

.view-templates__card {
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--desktop-panel);
}

.view-templates__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.view-templates__desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--desktop-muted);
}
</style>
