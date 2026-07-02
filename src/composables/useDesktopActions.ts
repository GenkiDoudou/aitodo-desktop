import { useRouter } from 'vue-router'
import type { ShortcutActionId } from '@shared/shortcuts'

/**
 * 桌面端统一动作分发：快捷键、托盘、设置页均通过此入口触发，
 * 避免仅在 HomeView 注册监听导致设置页等路由下无效。
 */
export function useDesktopActions() {
  const router = useRouter()

  async function dispatch(action: ShortcutActionId): Promise<void> {
    switch (action) {
      case 'newTask':
        await router.push('/')
        window.dispatchEvent(new CustomEvent('desktop:new-task'))
        break
      case 'focusSearch':
        await router.push('/')
        window.dispatchEvent(new CustomEvent('desktop:focus-search'))
        break
      case 'goHome':
        await router.push('/')
        break
      case 'openSettings':
        await router.push('/settings')
        break
      case 'showWindow':
        await window.api.app.showWindow()
        break
      default:
        break
    }
  }

  return { dispatch }
}
