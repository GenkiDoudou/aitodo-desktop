<template>
  <section class="settings-section">
    <h2 class="settings-section__title">风格切换</h2>
    <p class="settings-section__hint">
      默认使用 Claude 风格。切换后会同步调整配色、圆角、标题字体与 Element Plus 主色。
    </p>

    <div class="settings-theme-grid">
      <button
        v-for="item in options"
        :key="item.id"
        class="settings-theme-card"
        :class="{ 'is-active': theme === item.id }"
        @click="onSelect(item.id)"
      >
        <span
          class="settings-theme-card__swatch"
          :style="{ background: themePrimaryColor(item.id) }"
        />
        <span class="settings-theme-card__name">{{ item.label }}</span>
        <span class="settings-theme-card__meta">{{ item.description }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  applyDesktopTheme,
  desktopThemeOptions,
  persistDesktopTheme,
  readDesktopTheme,
  themePrimaryColor,
  type DesktopThemeId
} from '@/utils/theme-preferences'

const options = desktopThemeOptions()
const theme = ref<DesktopThemeId>(readDesktopTheme())

function onSelect(nextTheme: DesktopThemeId) {
  theme.value = nextTheme
  applyDesktopTheme(nextTheme)
  persistDesktopTheme(nextTheme)
}
</script>

<style scoped lang="scss">
.settings-section {
  max-width: 820px;
}

.settings-section__title {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
}

.settings-section__hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--desktop-muted);
}

.settings-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.settings-theme-card {
  border: 1px solid var(--desktop-border);
  border-radius: var(--desktop-radius-lg);
  background: var(--desktop-panel);
  color: var(--desktop-text);
  text-align: left;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, background 0.15s, transform 0.12s;

  &:hover {
    background: var(--desktop-hover);
  }

  &:active {
    transform: scale(0.98);
  }

  &.is-active {
    border-color: var(--el-color-primary);
    background: var(--desktop-active);
    box-shadow: var(--desktop-shadow);
  }
}

.settings-theme-card__swatch {
  width: 100%;
  height: 6px;
  border-radius: var(--desktop-radius-pill);
}

.settings-theme-card__name {
  font-size: 14px;
  font-weight: 600;
}

.settings-theme-card__meta {
  font-size: 12px;
  line-height: 1.4;
  color: var(--desktop-muted);
}
</style>
