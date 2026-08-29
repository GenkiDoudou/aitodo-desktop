/// <reference types="vite/client" />

import type { DesktopApi } from '@shared/desktop-api'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare global {
  interface Window {
    /** Preload 经 contextBridge 暴露的桌面 API，渲染进程唯一数据访问入口 */
    api: DesktopApi
  }
}

export {}
