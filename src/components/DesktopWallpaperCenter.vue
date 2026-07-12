<template>
  <div class="wall-center">
    <header class="wall-center__hero glass">
      <div class="wall-center__hero-text">
        <h2>壁纸中心</h2>
        <p>选择内置壁纸或上传本地图片，一键设为 Windows 桌面背景</p>
      </div>
      <div
        class="wall-center__preview"
        :class="{ 'has-image': !!previewUrl }"
        :style="previewStyle"
      >
        <span v-if="!previewUrl" class="wall-center__preview-empty">预览区域</span>
      </div>
      <div class="wall-center__hero-actions">
        <el-button type="primary" size="large" :loading="busy" @click="pickAndApply">
          上传并应用
        </el-button>
        <el-button size="large" :loading="busy" @click="applyPending" :disabled="!pendingPath">
          应用当前预览
        </el-button>
        <el-button size="large" plain :loading="busy" :disabled="!canRestore" @click="restore">
          恢复原背景
        </el-button>
      </div>
    </header>

    <section class="wall-center__section">
      <h3>内置壁纸</h3>
      <div v-if="presets.length" class="wall-center__grid">
        <button
          v-for="preset in presets"
          :key="preset.id"
          type="button"
          class="wall-center__card glass"
          :class="{ 'is-active': activePresetId === preset.id }"
          @click="selectPreset(preset)"
        >
          <img
            v-if="preset.previewDataUrl"
            :src="preset.previewDataUrl"
            :alt="preset.name"
            class="wall-center__thumb"
          />
          <span v-else class="wall-center__thumb-empty">{{ preset.name }}</span>
          <span class="wall-center__card-name">{{ preset.name }}</span>
          <span v-if="activePresetId === preset.id" class="wall-center__badge">当前</span>
        </button>
      </div>
      <p v-else class="wall-center__empty">暂无内置壁纸</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { WallpaperPreset } from '@shared/fence-types'

const fenceApi = window.api.fence

const presets = ref<WallpaperPreset[]>([])
const previewUrl = ref<string | null>(null)
const pendingPath = ref<string | null>(null)
const canRestore = ref(false)
const busy = ref(false)
const activePresetId = ref<string | null>(null)

const previewStyle = computed(() =>
  previewUrl.value
    ? { backgroundImage: `url(${previewUrl.value})` }
    : undefined
)

async function load() {
  const [wallRes, presetRes] = await Promise.all([
    fenceApi.getWallpaper(),
    fenceApi.listWallpaperPresets()
  ])
  if (wallRes.ok) {
    previewUrl.value = wallRes.data.previewDataUrl
    canRestore.value = !!wallRes.data.previousSystemPath
  }
  if (presetRes.ok) presets.value = presetRes.data
}

async function pickAndApply() {
  busy.value = true
  try {
    const pickRes = await fenceApi.pickWallpaper()
    if (!pickRes.ok) {
      ElMessage.error(pickRes.error.message)
      return
    }
    if (!pickRes.data) return
    pendingPath.value = pickRes.data.path
    previewUrl.value = pickRes.data.previewDataUrl
    activePresetId.value = null
    const applyRes = await fenceApi.applyWallpaper(pickRes.data.path)
    if (!applyRes.ok) {
      ElMessage.error(applyRes.error.message)
      return
    }
    previewUrl.value = applyRes.data.previewDataUrl
    canRestore.value = !!applyRes.data.previousSystemPath
    pendingPath.value = null
    ElMessage.success('壁纸已应用到桌面')
  } finally {
    busy.value = false
  }
}

async function applyPending() {
  if (!pendingPath.value) return
  busy.value = true
  try {
    const res = await fenceApi.applyWallpaper(pendingPath.value)
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
    previewUrl.value = res.data.previewDataUrl
    canRestore.value = !!res.data.previousSystemPath
    pendingPath.value = null
    ElMessage.success('壁纸已应用到桌面')
  } finally {
    busy.value = false
  }
}

async function selectPreset(preset: WallpaperPreset) {
  busy.value = true
  try {
    previewUrl.value = preset.previewDataUrl
    activePresetId.value = preset.id
    pendingPath.value = null
    const res = await fenceApi.applyWallpaperPreset(preset.id)
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
    previewUrl.value = res.data.previewDataUrl
    canRestore.value = !!res.data.previousSystemPath
    ElMessage.success(`已应用「${preset.name}」`)
  } finally {
    busy.value = false
  }
}

async function restore() {
  busy.value = true
  try {
    const res = await fenceApi.restoreWallpaper()
    if (!res.ok) {
      ElMessage.error(res.error.message)
      return
    }
    previewUrl.value = res.data.previewDataUrl
    canRestore.value = false
    activePresetId.value = null
    pendingPath.value = null
    ElMessage.success('已恢复原桌面背景')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void load()
})

defineExpose({ reload: load })
</script>

<style scoped>
.wall-center {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 4px 32px;
}

.wall-center__hero {
  padding: 20px 22px;
  border-radius: 18px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.wall-center__hero-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.wall-center__hero-text p {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
}

.wall-center__preview {
  width: 100%;
  height: min(42vh, 320px);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(51, 65, 85, 0.75)),
    repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.04),
      rgba(255, 255, 255, 0.04) 8px,
      transparent 8px,
      transparent 16px
    );
  background-size: cover;
  background-position: center;
  border: 2px dashed rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.25);
}

.wall-center__preview.has-image {
  border-style: solid;
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.wall-center__preview-empty {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
}

.wall-center__hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.wall-center__section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.wall-center__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.wall-center__card {
  position: relative;
  border: 2px solid transparent;
  border-radius: 14px;
  padding: 8px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: transform 0.15s, border-color 0.15s;
}

.wall-center__card:hover {
  transform: translateY(-2px);
}

.wall-center__card.is-active {
  border-color: rgba(56, 189, 248, 0.85);
}

.wall-center__thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border-radius: 10px;
  display: block;
}

.wall-center__thumb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  font-size: 12px;
}

.wall-center__card-name {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
}

.wall-center__badge {
  position: absolute;
  top: 14px;
  right: 14px;
  background: rgba(56, 189, 248, 0.92);
  color: #0f172a;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.wall-center__empty {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}
</style>
