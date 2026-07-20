import { resolve } from 'path'
import type { Plugin } from 'vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

/**
 * 打包后 Electron 用 file:// 加载页面时，带 crossorigin 的 script/link
 * 会被当成 CORS 请求并静默失败，导致白屏。开发态走 http:// 无此问题。
 */
function removeCrossOriginPlugin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(="[^"]*")?/g, '')
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, 'electron/main/index.ts')
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
          widget: resolve(__dirname, 'electron/preload/widget.ts'),
          capture: resolve(__dirname, 'electron/preload/capture.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'shared')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, '.'),
    build: {
      modulePreload: {
        polyfill: false
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          widget: resolve(__dirname, 'widget.html'),
          capture: resolve(__dirname, 'capture.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    },
    plugins: [vue(), removeCrossOriginPlugin()]
  }
})
