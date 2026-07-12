import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import { platform } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { resolveDataDir } from '../data-path'

const execFileAsync = promisify(execFile)

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
const MARKER_FILE = () => join(resolveDataDir(), '.desktop-icons-hidden.flag')

/** 是否由本应用写入过 HideIcons，退出时需恢复 */
let appliedByApp = false
/** 写入前用户原有 HideIcons 值（0/1），null 表示未知 */
let previousHideIcons: number | null = null
let pendingShellOp: Promise<void> | null = null
/** 取消尚未触发的「延迟隐藏原生图标」定时器 */
let hideIconsDeferGeneration = 0
/** 使进行中的 hide/show 异步操作失效，避免收起后仍被写回 HideIcons=1 */
let shellOpGeneration = 0

function isShellOpGenerationCurrent(generation: number): boolean {
  return generation === shellOpGeneration
}

function invalidateShellOps(): number {
  shellOpGeneration += 1
  return shellOpGeneration
}

async function readHideIconsValue(): Promise<number | null> {
  if (platform() !== 'win32') return null
  try {
    const { stdout } = await execFileAsync(
      'reg',
      ['query', REG_KEY, '/v', 'HideIcons'],
      { windowsHide: true, encoding: 'utf8' }
    )
    const hex = stdout.match(/HideIcons\s+REG_DWORD\s+0x([0-9a-f]+)/i)?.[1]
    if (hex != null) return parseInt(hex, 16)
    const dec = stdout.match(/HideIcons\s+REG_DWORD\s+(\d+)/i)?.[1]
    return dec != null ? Number(dec) : null
  } catch {
    return null
  }
}

async function writeHideIcons(value: 0 | 1): Promise<void> {
  await execFileAsync(
    'reg',
    ['add', REG_KEY, '/v', 'HideIcons', '/t', 'REG_DWORD', '/d', String(value), '/f'],
    { windowsHide: true }
  )
}

/**
 * 强制显示桌面 FolderView，并把盖在图标上的空 WorkerW 压到底部。
 * NOTE: 仅写 HideIcons=0 不够——窗口可能被 SW_HIDE，或壁纸 WorkerW 盖住图标层
 *（小智桌面 / Fence 清黑框后常见）。
 */
export function forceShowDesktopFolderView(): void {
  if (platform() !== 'win32') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require('koffi') as typeof import('koffi')
    const user32 = koffi.load('user32.dll')
    const FindWindowW = user32.func('intptr_t __stdcall FindWindowW(str16 lpClassName, str16 lpWindowName)')
    const FindWindowExW = user32.func(
      'intptr_t __stdcall FindWindowExW(intptr_t hWndParent, intptr_t hWndChildAfter, str16 lpszClass, str16 lpszWindow)'
    )
    const ShowWindow = user32.func('bool __stdcall ShowWindow(intptr_t hWnd, int nCmdShow)')
    const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hWnd, int nIndex)')
    const SetWindowLongPtrW = user32.func(
      'intptr_t __stdcall SetWindowLongPtrW(intptr_t hWnd, int nIndex, intptr_t dwNewLong)'
    )
    const SetWindowPos = user32.func(
      'bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'
    )
    const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr_t hWnd, str16 lpClassName, int nMaxCount)')
    const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(intptr_t hwnd, intptr_t lParam)')
    const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)')

    const GWL_STYLE = -16
    const WS_VISIBLE = 0x10000000
    const SW_SHOW = 5
    const HWND_BOTTOM = 1
    const SWP_NOSIZE = 0x0001
    const SWP_NOMOVE = 0x0002
    const SWP_NOACTIVATE = 0x0010

    const showHwnd = (hwnd: number) => {
      if (!hwnd) return
      const style = Number(GetWindowLongPtrW(hwnd, GWL_STYLE))
      if ((style & WS_VISIBLE) === 0) {
        SetWindowLongPtrW(hwnd, GWL_STYLE, style | WS_VISIBLE)
      }
      ShowWindow(hwnd, SW_SHOW)
    }

    const progman = Number(FindWindowW('Progman', 'Program Manager'))
    const defView = Number(FindWindowExW(progman, 0, 'SHELLDLL_DefView', null))
    const list = Number(FindWindowExW(defView, 0, 'SysListView32', 'FolderView'))
    showHwnd(defView)
    showHwnd(list)

    // 压低不含 DefView 的 WorkerW，避免壁纸层盖住桌面图标
    let lowered = 0
    const cb = koffi.register((hwnd: number) => {
      const buf = Buffer.alloc(512)
      const len = GetClassNameW(hwnd, buf, 256)
      if (len <= 0) return true
      const className = buf.toString('utf16le').replace(/\0+$/, '')
      if (className !== 'WorkerW') return true
      const childDef = Number(FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null))
      if (childDef === 0) {
        SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
        lowered += 1
      } else {
        showHwnd(childDef)
        showHwnd(Number(FindWindowExW(childDef, 0, 'SysListView32', 'FolderView')))
      }
      return true
    }, koffi.pointer(EnumWindowsProc))

    try {
      EnumWindows(cb, 0)
    } finally {
      koffi.unregister(cb)
    }

    console.log(
      `[desktop-shell] forced FolderView visible (list=${list}, loweredWorkerW=${lowered})`
    )
  } catch (err) {
    console.warn('[desktop-shell] forceShowDesktopFolderView failed:', err)
  }
}

/**
 * 异步重启 Explorer；detach 且不阻塞 Electron 主进程。
 * NOTE: 同步 taskkill 会导致应用未响应。
 * 用途：隐藏桌面图标后刷新壳；以及清除 Progman/DWM 残留的桌面黑框脏区。
 */
export function refreshExplorerShellAsync(): void {
  if (platform() !== 'win32') return
  console.log('[desktop-shell] refreshing explorer to clear desktop artifacts')
  const child = spawn(
    'cmd.exe',
    ['/c', 'taskkill /f /im explorer.exe >nul 2>&1 & timeout /t 1 /nobreak >nul & start explorer.exe'],
    { detached: true, stdio: 'ignore', windowsHide: true }
  )
  child.unref()
}

function writeMarker(): void {
  try {
    fs.mkdirSync(resolveDataDir(), { recursive: true })
    fs.writeFileSync(MARKER_FILE(), `${Date.now()}\n`, 'utf8')
  } catch (err) {
    console.warn('[desktop-shell] write marker failed:', err)
  }
}

function clearMarker(): void {
  try {
    fs.unlinkSync(MARKER_FILE())
  } catch {
    /* ignore */
  }
}

export function hasDesktopIconsHiddenMarker(): boolean {
  try {
    return fs.existsSync(MARKER_FILE())
  } catch {
    return false
  }
}

async function applyHideIcons(hidden: boolean, opGen: number): Promise<void> {
  if (platform() !== 'win32') return
  if (!isShellOpGenerationCurrent(opGen)) return

  if (hidden) {
    if (appliedByApp) return
    previousHideIcons = await readHideIconsValue()
    if (!isShellOpGenerationCurrent(opGen)) return
    await writeHideIcons(1)
    if (!isShellOpGenerationCurrent(opGen)) return
    appliedByApp = true
    writeMarker()
    refreshExplorerShellAsync()
    return
  }

  if (!appliedByApp && !hasDesktopIconsHiddenMarker()) return
  const restore: 0 | 1 = previousHideIcons === 1 ? 1 : 0
  await writeHideIcons(restore)
  if (!isShellOpGenerationCurrent(opGen)) return
  appliedByApp = false
  previousHideIcons = null
  clearMarker()
  refreshExplorerShellAsync()
}

/**
 * 收起容器 / 紧急恢复：强制显示原生桌面图标。
 * 不依赖 in-memory appliedByApp，避免异常态下 HideIcons 残留为 1。
 * @param refreshExplorer 是否立刻重启 Explorer（若随后还会 purge，可先写注册表再统一重启）
 */
async function applyForceShowIcons(refreshExplorer: boolean, opGen: number): Promise<void> {
  if (platform() !== 'win32') return
  await writeHideIcons(0)
  if (!isShellOpGenerationCurrent(opGen)) return
  appliedByApp = false
  previousHideIcons = null
  clearMarker()
  if (refreshExplorer) {
    refreshExplorerShellAsync()
    // Explorer 起来后再强制把 FolderView 窗口显示出来
    setTimeout(() => {
      if (!isShellOpGenerationCurrent(opGen)) return
      forceShowDesktopFolderView()
    }, 2500)
  } else {
    forceShowDesktopFolderView()
  }
}

/**
 * 隐藏/恢复 Windows 原生桌面图标（异步，不阻塞 UI）。
 * 首次隐藏时会记住用户原设置并在 restore 时还原。
 */
export function setNativeDesktopIconsHidden(hidden: boolean): void {
  const opGen = invalidateShellOps()
  pendingShellOp = applyHideIcons(hidden, opGen).catch((err) => {
    console.error('[desktop-shell] setNativeDesktopIconsHidden failed:', err)
  })
}

/** 取消尚未执行的延迟隐藏（收起容器前必须调用） */
export function cancelDeferredHideNativeDesktopIcons(): void {
  hideIconsDeferGeneration += 1
  invalidateShellOps()
}

export function nextHideIconsDeferGeneration(): number {
  hideIconsDeferGeneration += 1
  return hideIconsDeferGeneration
}

export function isHideIconsDeferGenerationCurrent(generation: number): boolean {
  return generation === hideIconsDeferGeneration
}

/**
 * 容器未开启时恢复原生桌面图标。
 * NOTE: 不能只看 marker——异常退出可能已清 marker 但 HideIcons 仍为 1。
 */
export async function recoverDesktopIconsFromMarkerIfNeeded(fencesEnabled: boolean): Promise<void> {
  if (platform() !== 'win32') return
  if (fencesEnabled) return
  const current = await readHideIconsValue()
  if (current !== 1 && !hasDesktopIconsHiddenMarker()) return
  console.warn('[desktop-shell] fences off but HideIcons still hidden, forcing restore')
  const opGen = invalidateShellOps()
  await applyForceShowIcons(true, opGen)
}

/** 应用退出或关闭 Fence 模式时强制恢复（始终写 HideIcons=0） */
export function restoreNativeDesktopIconsIfNeeded(): void {
  cancelDeferredHideNativeDesktopIcons()
  const opGen = invalidateShellOps()
  pendingShellOp = applyForceShowIcons(true, opGen).catch((err) => {
    console.error('[desktop-shell] restoreNativeDesktopIconsIfNeeded failed:', err)
  })
}

/**
 * 收起容器专用：先写 HideIcons=0，再由调用方统一 purge/重启 Explorer，
 * 避免「先重启 Explorer（仍隐藏）再写注册表」的竞态。
 */
export function prepareNativeDesktopIconsForFenceCollapse(): Promise<void> {
  cancelDeferredHideNativeDesktopIcons()
  const opGen = invalidateShellOps()
  const op = applyForceShowIcons(false, opGen).catch((err) => {
    console.error('[desktop-shell] prepareNativeDesktopIconsForFenceCollapse failed:', err)
  })
  pendingShellOp = op
  return op
}

/**
 * Explorer 重启后二次确认桌面图标已显示。
 * 防止延迟隐藏或过期异步 hide 在收起后把 HideIcons 写回 1。
 */
export function scheduleEnsureDesktopIconsVisibleAfterCollapse(): void {
  if (platform() !== 'win32') return
  const opGen = shellOpGeneration
  pendingShellOp = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 2200))
    if (!isShellOpGenerationCurrent(opGen)) return
    const current = await readHideIconsValue()
    if (current === 1 || hasDesktopIconsHiddenMarker()) {
      console.warn('[desktop-shell] HideIcons still hidden after collapse, forcing restore')
      await writeHideIcons(0)
      if (!isShellOpGenerationCurrent(opGen)) return
      appliedByApp = false
      previousHideIcons = null
      clearMarker()
      refreshExplorerShellAsync()
      setTimeout(() => {
        if (!isShellOpGenerationCurrent(opGen)) return
        forceShowDesktopFolderView()
      }, 2500)
    } else {
      forceShowDesktopFolderView()
    }
  })().catch((err) => {
    console.error('[desktop-shell] ensure icons visible after collapse failed:', err)
  })
}

export async function waitForDesktopShellOp(): Promise<void> {
  if (pendingShellOp) {
    await pendingShellOp
  }
}

export function isNativeDesktopIconsHiddenByApp(): boolean {
  return appliedByApp || hasDesktopIconsHiddenMarker()
}

/** @internal 供单元测试 */
export function __testShellOpGeneration() {
  return { invalidateShellOps, isShellOpGenerationCurrent, get: () => shellOpGeneration }
}
