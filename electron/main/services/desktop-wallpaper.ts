import { dialog, nativeImage, type BrowserWindow } from 'electron'
import { app } from 'electron'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { platform } from 'node:os'
import koffi from 'koffi'
import { AppError } from '@shared/types'
import { resolveDataDir } from '../data-path'
import { nowIso } from '@shared/datetime'

export interface WallpaperPreset {
  id: string
  name: string
  filePath: string
  previewDataUrl: string | null
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])
const STATE_FILE = () => path.join(resolveDataDir(), 'wallpaper-state.json')
const WALLPAPER_DIR = () => path.join(resolveDataDir(), 'wallpapers')

export interface DesktopWallpaperState {
  currentPath: string | null
  previousSystemPath: string | null
  appliedAt: string | null
  previewDataUrl: string | null
}

function readState(): Omit<DesktopWallpaperState, 'previewDataUrl'> {
  try {
    if (!fs.existsSync(STATE_FILE())) {
      return { currentPath: null, previousSystemPath: null, appliedAt: null }
    }
    const raw = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')) as Partial<DesktopWallpaperState>
    return {
      currentPath: raw.currentPath ?? null,
      previousSystemPath: raw.previousSystemPath ?? null,
      appliedAt: raw.appliedAt ?? null
    }
  } catch {
    return { currentPath: null, previousSystemPath: null, appliedAt: null }
  }
}

function writeState(state: Omit<DesktopWallpaperState, 'previewDataUrl'>): void {
  fs.mkdirSync(resolveDataDir(), { recursive: true })
  fs.writeFileSync(STATE_FILE(), JSON.stringify(state, null, 2), 'utf8')
}

function ensureWallpaperDir(): string {
  const dir = WALLPAPER_DIR()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function previewFromPath(filePath: string | null): string | null {
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) return null
    return img.resize({ width: 360, height: 200, quality: 'better' }).toDataURL()
  } catch {
    return null
  }
}

export function resolveWallpaperPresetsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'wallpapers')
  }
  return path.join(app.getAppPath(), 'resources', 'wallpapers')
}

export function listWallpaperPresets(): WallpaperPreset[] {
  const dir = resolveWallpaperPresetsDir()
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return []
  let entries: Array<{ id: string; name: string; file: string }>
  try {
    entries = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Array<{
      id: string
      name: string
      file: string
    }>
  } catch {
    return []
  }
  return entries
    .map((e) => {
      const filePath = path.join(dir, e.file)
      if (!fs.existsSync(filePath)) return null
      return {
        id: e.id,
        name: e.name,
        filePath,
        previewDataUrl: previewFromPath(filePath)
      }
    })
    .filter((p): p is WallpaperPreset => p != null)
}

export function applyWallpaperPreset(presetId: string): DesktopWallpaperState & { systemPath: string | null } {
  const preset = listWallpaperPresets().find((p) => p.id === presetId)
  if (!preset) throw new AppError('NOT_FOUND', '内置壁纸不存在')
  return applyWallpaperFromFile(preset.filePath)
}

export function getSystemWallpaperPath(): string | null {
  if (platform() !== 'win32') return null
  try {
    const user32 = koffi.load('user32.dll')
    const SystemParametersInfoW = user32.func(
      'bool __stdcall SystemParametersInfoW(uint32 uiAction, uint32 uiParam, void *pvParam, uint32 fWinIni)'
    )
    const SPI_GETDESKWALLPAPER = 0x0073
    const buf = Buffer.alloc(520 * 2)
    const ok = SystemParametersInfoW(SPI_GETDESKWALLPAPER, 520, buf, 0)
    if (!ok) return null
    const text = buf.toString('utf16le').replace(/\0+$/, '').trim()
    return text || null
  } catch (err) {
    console.warn('[wallpaper] getSystemWallpaperPath failed:', err)
    return null
  }
}

function setRegistryFitStyle(): void {
  execFileSync(
    'reg',
    ['add', 'HKCU\\Control Panel\\Desktop', '/v', 'WallpaperStyle', '/t', 'REG_SZ', '/d', '10', '/f'],
    { windowsHide: true }
  )
  execFileSync(
    'reg',
    ['add', 'HKCU\\Control Panel\\Desktop', '/v', 'TileWallpaper', '/t', 'REG_SZ', '/d', '0', '/f'],
    { windowsHide: true }
  )
}

export function applySystemWallpaper(imagePath: string): void {
  if (platform() !== 'win32') {
    throw new AppError('VALIDATION_ERROR', '仅支持 Windows 设置桌面背景')
  }
  if (!fs.existsSync(imagePath)) {
    throw new AppError('NOT_FOUND', '壁纸文件不存在')
  }

  setRegistryFitStyle()

  const user32 = koffi.load('user32.dll')
  const SystemParametersInfoW = user32.func(
    'bool __stdcall SystemParametersInfoW(uint32 uiAction, uint32 uiParam, str16 pvParam, uint32 fWinIni)'
  )
  const SPI_SETDESKWALLPAPER = 0x0014
  const SPIF_UPDATEINIFILE = 0x01
  const SPIF_SENDCHANGE = 0x02
  const ok = SystemParametersInfoW(
    SPI_SETDESKWALLPAPER,
    0,
    imagePath,
    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE
  )
  if (!ok) {
    throw new AppError('INTERNAL', '设置桌面背景失败，请确认图片格式可用')
  }
}

export function getWallpaperState(): DesktopWallpaperState & { systemPath: string | null } {
  const state = readState()
  const previewSource = state.currentPath ?? getSystemWallpaperPath()
  return {
    ...state,
    previewDataUrl: previewFromPath(previewSource),
    systemPath: getSystemWallpaperPath()
  }
}

export async function pickWallpaperImage(
  parent?: BrowserWindow | null
): Promise<{ path: string; previewDataUrl: string | null } | null> {
  const result = await dialog.showOpenDialog(parent ?? undefined, {
    title: '选择桌面背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  const filePath = result.filePaths[0]
  const ext = path.extname(filePath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new AppError('VALIDATION_ERROR', '仅支持 jpg / png / webp / bmp')
  }
  return { path: filePath, previewDataUrl: previewFromPath(filePath) }
}

export function applyWallpaperFromFile(sourcePath: string): DesktopWallpaperState & { systemPath: string | null } {
  const ext = path.extname(sourcePath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new AppError('VALIDATION_ERROR', '仅支持 jpg / png / webp / bmp')
  }
  if (!fs.existsSync(sourcePath)) {
    throw new AppError('NOT_FOUND', '图片不存在')
  }

  const previous = getSystemWallpaperPath()
  const dir = ensureWallpaperDir()
  const destName = `wallpaper-${Date.now()}${ext === '.jpeg' ? '.jpg' : ext}`
  const destPath = path.join(dir, destName)
  fs.copyFileSync(sourcePath, destPath)

  applySystemWallpaper(destPath)

  const persisted = {
    currentPath: destPath,
    previousSystemPath: readState().previousSystemPath ?? previous,
    appliedAt: nowIso()
  }
  writeState(persisted)
  return {
    ...persisted,
    previewDataUrl: previewFromPath(destPath),
    systemPath: destPath
  }
}

export function restorePreviousWallpaper(): DesktopWallpaperState & { systemPath: string | null } {
  const state = readState()
  if (!state.previousSystemPath) {
    throw new AppError('VALIDATION_ERROR', '没有可恢复的原背景')
  }
  if (!fs.existsSync(state.previousSystemPath)) {
    throw new AppError('NOT_FOUND', '原背景文件已不存在，无法恢复')
  }

  applySystemWallpaper(state.previousSystemPath)
  const next = {
    currentPath: null,
    previousSystemPath: null,
    appliedAt: null
  }
  writeState(next)
  return {
    ...next,
    previewDataUrl: previewFromPath(state.previousSystemPath),
    systemPath: state.previousSystemPath
  }
}
