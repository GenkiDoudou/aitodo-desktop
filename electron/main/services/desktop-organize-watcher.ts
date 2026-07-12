import fs from 'node:fs'
import type { DesktopOrganizeService } from './desktop-organize-service'
import { resolveDesktopPath } from './desktop-path'

let watcher: fs.FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let onOrganized: (() => void) | null = null

export function setDesktopOrganizeWatcherCallback(cb: (() => void) | null): void {
  onOrganized = cb
}

/** 根据设置启动/停止桌面目录监听，新文件时自动整理 */
export function syncDesktopOrganizeWatcher(service: DesktopOrganizeService): void {
  stopDesktopOrganizeWatcher()
  const settings = service.getSettings()
  if (!settings.autoOrganizeOnNewIcons) return

  let desktopPath: string
  try {
    desktopPath = resolveDesktopPath()
  } catch {
    return
  }

  try {
    watcher = fs.watch(desktopPath, { persistent: false }, () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        try {
          const result = service.autoOrganizeIfNeeded()
          if (result && result.moved.length > 0) {
            onOrganized?.()
          }
        } catch (err) {
          console.warn('[desktop-organize-watcher] auto organize failed:', err)
        }
      }, 2500)
    })
  } catch (err) {
    console.warn('[desktop-organize-watcher] watch failed:', err)
  }
}

export function stopDesktopOrganizeWatcher(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

/** 应用启动时若开启则自动整理 */
export function runBootAutoOrganize(service: DesktopOrganizeService): void {
  const settings = service.getSettings()
  if (!settings.autoOrganizeOnBoot) return
  try {
    service.autoOrganizeIfNeeded()
  } catch (err) {
    console.warn('[desktop-organize] boot auto organize failed:', err)
  }
}
