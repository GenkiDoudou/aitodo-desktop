<template>
  <el-dialog
    :model-value="modelValue"
    width="480px"
    class="close-behavior-dialog"
    :close-on-click-modal="false"
    :show-close="true"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="close-behavior-dialog__header">
        <div class="close-behavior-dialog__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3v10m0 0 4-4m-4 4-4-4M5 21h14"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <div>
          <h3 class="close-behavior-dialog__title">关闭主窗口</h3>
          <p class="close-behavior-dialog__subtitle">选择本次关闭时要执行的操作</p>
        </div>
      </div>
    </template>

    <div class="close-behavior-dialog__options" role="radiogroup" aria-label="关闭行为">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="close-behavior-dialog__option"
        :class="{ 'is-active': selectedBehavior === option.value }"
        @click="selectedBehavior = option.value"
      >
        <span class="close-behavior-dialog__option-icon" aria-hidden="true">{{ option.icon }}</span>
        <span class="close-behavior-dialog__option-body">
          <span class="close-behavior-dialog__option-title">{{ option.title }}</span>
          <span class="close-behavior-dialog__option-desc">{{ option.desc }}</span>
        </span>
        <span class="close-behavior-dialog__option-check" aria-hidden="true" />
      </button>
    </div>

    <label class="close-behavior-dialog__remember">
      <el-checkbox v-model="remember">记住我的选择，下次不再询问</el-checkbox>
    </label>

    <template #footer>
      <div class="close-behavior-dialog__footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button type="primary" @click="confirm">确认</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ConfirmCloseBehavior, ConfirmClosePayload } from '@shared/close-behavior'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [payload: ConfirmClosePayload]
}>()

const options: Array<{
  value: ConfirmCloseBehavior
  title: string
  desc: string
  icon: string
}> = [
  {
    value: 'tray',
    title: '缩小到托盘',
    desc: '继续在后台运行，可从托盘重新打开',
    icon: '📌'
  },
  {
    value: 'quit',
    title: '退出应用',
    desc: '完全关闭小柒todo',
    icon: '⏻'
  }
]

const selectedBehavior = ref<ConfirmCloseBehavior>('tray')
const remember = ref(false)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      selectedBehavior.value = 'tray'
      remember.value = false
    }
  }
)

function confirm() {
  emit('confirm', {
    behavior: selectedBehavior.value,
    remember: remember.value
  })
}
</script>

<style scoped lang="scss">
.close-behavior-dialog__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.close-behavior-dialog__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.16), rgba(13, 148, 136, 0.12));
  color: #409eff;

  svg {
    width: 22px;
    height: 22px;
  }
}

.close-behavior-dialog__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--desktop-text);
}

.close-behavior-dialog__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--desktop-muted);
}

.close-behavior-dialog__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.close-behavior-dialog__option {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--desktop-border);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: rgba(64, 158, 255, 0.35);
    background: rgba(64, 158, 255, 0.03);
  }

  &.is-active {
    border-color: #409eff;
    background: rgba(64, 158, 255, 0.06);
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
  }
}

.close-behavior-dialog__option-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--desktop-bg);
  font-size: 18px;
}

.close-behavior-dialog__option-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.close-behavior-dialog__option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--desktop-text);
}

.close-behavior-dialog__option-desc {
  font-size: 12px;
  color: var(--desktop-muted);
  line-height: 1.4;
}

.close-behavior-dialog__option-check {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #c5c9d0;
  position: relative;

  .is-active & {
    border-color: #409eff;

    &::after {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: #409eff;
    }
  }
}

.close-behavior-dialog__remember {
  display: block;
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--desktop-bg);
}

.close-behavior-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style lang="scss">
.close-behavior-dialog.el-dialog {
  border-radius: 16px;
  overflow: hidden;

  .el-dialog__header {
    margin: 0;
    padding: 20px 20px 0;
  }

  .el-dialog__body {
    padding: 18px 20px 8px;
  }

  .el-dialog__footer {
    padding: 8px 20px 20px;
  }
}
</style>
