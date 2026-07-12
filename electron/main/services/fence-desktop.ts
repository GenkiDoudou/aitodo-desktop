import { app, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { DesktopFenceSettings } from '@shared/fence-types'
import {
  cancelDeferredHideNativeDesktopIcons,
  isHideIconsDeferGenerationCurrent,
  nextHideIconsDeferGeneration,
  recoverDesktopIconsFromMarkerIfNeeded,
  restoreNativeDesktopIconsIfNeeded,
  setNativeDesktopIconsHidden
} from './desktop-shell'

/**
 * 按 Fence 设置同步 Windows 原生桌面图标显隐。
 * NOTE: 须在 Fence 窗口显示之后再调用，避免 Explorer 重启时主窗未就绪。
 */
export function syncNativeDesktopIcons(settings: DesktopFenceSettings): void {
  if (settings.fencesEnabled && settings.hideNativeIcons) {
    setNativeDesktopIconsHidden(true)
  } else {
    restoreNativeDesktopIconsIfNeeded()
  }
}

/** 延迟隐藏原生图标，先让 Fence 窗口完成加载；收起后会作废 */
export function deferHideNativeDesktopIcons(settings: DesktopFenceSettings): void {
  if (!settings.fencesEnabled || !settings.hideNativeIcons) return
  const generation = nextHideIconsDeferGeneration()
  setTimeout(() => {
    // 收起容器或改设置后 generation 会递增，避免收起后仍被隐藏
    if (!isHideIconsDeferGenerationCurrent(generation)) return
    setNativeDesktopIconsHidden(true)
  }, 2500)
}

export { cancelDeferredHideNativeDesktopIcons, recoverDesktopIconsFromMarkerIfNeeded, restoreNativeDesktopIconsIfNeeded }

/** Windows 风格黄色文件夹图标（避免 getFileIcon 对目录返回泛化图标） */
const FOLDER_ICON_DATA_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M6 12c0-2.2 1.8-4 4-4h10l3 3h15c2.2 0 4 1.8 4 4v3H6v-6z"/>
      <path fill="#FFD54F" d="M6 18h36v18c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V18z"/>
      <path fill="#FFE082" opacity=".55" d="M10 22h28v3H10z"/>
    </svg>`
  )

function isDirectoryPath(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory()
  } catch {
    return false
  }
}

/** 从 .url 互联网快捷方式解析 IconFile */
function resolveUrlShortcutIcon(filePath: string): string | null {
  try {
    const text = fs.readFileSync(filePath, 'utf8')
    const iconFile = text.match(/^\s*IconFile\s*=\s*(.+)\s*$/im)?.[1]?.trim()
    if (iconFile && fs.existsSync(iconFile)) return iconFile
    const url = text.match(/^\s*URL\s*=\s*(.+)\s*$/im)?.[1]?.trim()
    if (url?.startsWith('file:///')) {
      const local = decodeURIComponent(url.replace(/^file:\/\/\//i, '')).replace(/\//g, path.sep)
      if (fs.existsSync(local)) return local
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * 提取桌面项图标。
 * NOTE: 对 .lnk 直接 getFileIcon 常返回泛化快捷方式白页图标，需解析目标后再取图标。
 */
export async function getFileIconDataUrl(filePath: string): Promise<string> {
  if (!filePath?.trim()) {
    throw new Error('路径无效')
  }

  if (isDirectoryPath(filePath)) {
    return FOLDER_ICON_DATA_URL
  }

  const lower = filePath.toLowerCase()

  if (lower.endsWith('.lnk')) {
    try {
      const link = shell.readShortcutLink(filePath)
      if (link.icon) {
        const fromIcon = nativeImage.createFromPath(link.icon)
        if (!fromIcon.isEmpty()) {
          return fromIcon.resize({ width: 48, height: 48, quality: 'best' }).toDataURL()
        }
      }
      if (link.target) {
        if (isDirectoryPath(link.target)) {
          return FOLDER_ICON_DATA_URL
        }
        const icon = await app.getFileIcon(link.target, { size: 'normal' })
        if (!icon.isEmpty()) return icon.toDataURL()
      }
    } catch (err) {
      console.warn('[fence-icon] readShortcutLink failed:', filePath, err)
    }
  }

  if (lower.endsWith('.url')) {
    const iconPath = resolveUrlShortcutIcon(filePath)
    if (iconPath) {
      try {
        if (isDirectoryPath(iconPath)) return FOLDER_ICON_DATA_URL
        const fromPath = nativeImage.createFromPath(iconPath)
        if (!fromPath.isEmpty()) {
          return fromPath.resize({ width: 48, height: 48, quality: 'best' }).toDataURL()
        }
        const icon = await app.getFileIcon(iconPath, { size: 'normal' })
        if (!icon.isEmpty()) return icon.toDataURL()
      } catch {
        /* fall through */
      }
    }
  }

  const icon = await app.getFileIcon(filePath, { size: 'normal' })
  return icon.toDataURL()
}

export async function openDesktopItem(filePath: string): Promise<void> {
  const err = await shell.openPath(filePath)
  if (err) {
    throw new Error(err)
  }
}
