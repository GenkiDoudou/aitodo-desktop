import koffi from 'koffi'
import type { BrowserWindow } from 'electron'
import { refreshExplorerShellAsync } from './desktop-shell'

const user32 = koffi.load('user32.dll')

const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(intptr_t hwnd, intptr_t lParam)')
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)')
const GetClassNameW = user32.func('int __stdcall GetClassNameW(intptr_t hWnd, str16 lpClassName, int nMaxCount)')
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(intptr_t hWnd, str16 lpString, int nMaxCount)')
const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hWnd, int nIndex)')
const SetWindowLongPtrW = user32.func('intptr_t __stdcall SetWindowLongPtrW(intptr_t hWnd, int nIndex, intptr_t dwNewLong)')
const GetWindowThreadProcessId = user32.func(
  'uint32 __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32 *lpdwProcessId)'
)
const DestroyWindow = user32.func('bool __stdcall DestroyWindow(intptr_t hWnd)')
const SetWindowPos = user32.func(
  'bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'
)
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(intptr_t hWnd)')

const GWLP_HWNDPARENT = -8
const SWP_NOMOVE = 0x0002
const SWP_NOSIZE = 0x0001
const SWP_NOACTIVATE = 0x0010
const HWND_BOTTOM = 1

function hwndFromWindow(win: BrowserWindow): number {
  const buf = win.getNativeWindowHandle()
  if (buf.length >= 8) {
    return Number(buf.readBigInt64LE(0))
  }
  return buf.readUInt32LE(0)
}

function readClassName(hwnd: number): string {
  const buf = Buffer.alloc(512)
  const len = GetClassNameW(hwnd, buf, 256)
  if (len <= 0) return ''
  return buf.toString('utf16le').replace(/\0+$/, '')
}

function readWindowTitle(hwnd: number): string {
  const buf = Buffer.alloc(512)
  const len = GetWindowTextW(hwnd, buf, 256)
  if (len <= 0) return ''
  return buf.toString('utf16le').replace(/\0+$/, '')
}

function windowPid(hwnd: number): number {
  const out = [0]
  GetWindowThreadProcessId(hwnd, out)
  return out[0] ?? 0
}

function isChromeWidgetClass(className: string): boolean {
  return className.startsWith('Chrome_WidgetWin_')
}

/** 页面 title 会覆盖 BrowserWindow title，实际常见为「小柒todo Fence」 */
function isFenceRelatedTitle(title: string): boolean {
  if (!title) return false
  return (
    title.startsWith('Fence-') ||
    title.includes('小柒todo Fence') ||
    title === '小柒todo Fence'
  )
}

/**
 * @deprecated 禁止再把 Fence 挂到 Progman（移动/销毁后会留下桌面层黑框脏区）。
 */
export function pinFenceWindowToDesktop(_win: BrowserWindow): void {
  /* no-op */
}

/**
 * 将 Fence 置底（不挂 Progman），减少「悬浮在最上层」的感觉。
 * NOTE: 真正嵌入桌面图标层需要 WorkerW/SetParent，在 Electron 上会黑框，故不使用。
 */
export function lowerFenceWindowToDesktop(win: BrowserWindow): void {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  try {
    win.setAlwaysOnTop(false)
    const hwnd = hwndFromWindow(win)
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
  } catch (err) {
    console.warn('[fence-pin] lower failed:', err)
  }
}

/** 销毁前解除与 Progman 的 owner 关联 */
export function detachFenceWindowFromDesktop(win: BrowserWindow): void {
  if (process.platform !== 'win32' || win.isDestroyed()) return
  try {
    const hwnd = hwndFromWindow(win)
    SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, 0)
  } catch (err) {
    console.warn('[fence-pin] detach failed:', err)
  }
}

/**
 * 销毁本进程中标题匹配 Fence 的 Chromium 窗，以及仍挂在 Progman 下的本进程窗。
 */
export function destroyOrphanFenceHwnds(): void {
  if (process.platform !== 'win32') return

  const selfPid = process.pid
  const toDestroy: number[] = []

  const cb = koffi.register((hwnd: number) => {
    if (windowPid(hwnd) !== selfPid) return true
    const className = readClassName(hwnd)
    if (!isChromeWidgetClass(className)) return true

    const title = readWindowTitle(hwnd)
    const parent = Number(GetWindowLongPtrW(hwnd, GWLP_HWNDPARENT))
    const parented = parent !== 0
    const fenceTitle = isFenceRelatedTitle(title)

    // 可见的 Fence 标题窗，或仍挂着 owner 的本进程 Chromium 窗
    if (fenceTitle || (parented && IsWindowVisible(hwnd))) {
      toDestroy.push(hwnd)
    }
    return true
  }, koffi.pointer(EnumWindowsProc))

  try {
    EnumWindows(cb, 0)
  } finally {
    koffi.unregister(cb)
  }

  for (const hwnd of toDestroy) {
    try {
      SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, 0)
      DestroyWindow(hwnd)
    } catch (err) {
      console.warn('[fence-pin] DestroyWindow failed:', hwnd, err)
    }
  }

  if (toDestroy.length > 0) {
    console.log(`[fence-pin] destroyed ${toDestroy.length} orphan fence hwnd(s)`)
  }
}

/**
 * 彻底清除桌面黑框：销毁遗留 HWND + 重启 Explorer 清掉 DWM/Progman 脏区。
 * 黑框往往不是存活窗口，而是桌面层残留脏矩形，只有刷新壳才能去掉。
 */
export function purgeDesktopFenceArtifacts(): void {
  destroyOrphanFenceHwnds()
  refreshExplorerShellAsync()
}
