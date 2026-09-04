<template>
  <!-- 统一桌面壳：220px 侧栏 + 顶栏 + 内容区；Home / Calendar / Settings 共用 -->
  <div class="app-shell">
    <slot name="sidebar" />
    <div class="app-shell__workspace">
      <slot name="topbar" />
      <main class="app-shell__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  display: flex;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--desktop-bg);
}

.app-shell__workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-shell__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
</style>
