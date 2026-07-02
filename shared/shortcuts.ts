/** 可配置的桌面快捷键动作 ID（Main / Renderer 共用） */
export type ShortcutActionId = 'newTask' | 'openSettings' | 'focusSearch' | 'goHome' | 'showWindow'

export interface ShortcutActionDef {
  id: ShortcutActionId
  /** 设置页展示名称 */
  label: string
  /** 动作说明，便于用户理解边界 */
  description: string
  /** 默认快捷键字符串，Mod = Ctrl(Win/Linux) / Cmd(macOS) */
  defaultAccelerator: string
  /** 是否需要在窗口隐藏时由 Main 注册 globalShortcut */
  globalWhenHidden?: boolean
}

/** 内置动作清单；新增动作时同步扩展 IPC 分发与设置页 */
export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  {
    id: 'newTask',
    label: '新建任务',
    description: '打开任务创建抽屉',
    defaultAccelerator: 'Mod+N',
    globalWhenHidden: true
  },
  {
    id: 'showWindow',
    label: '显示主窗口',
    description: '从托盘恢复并聚焦应用窗口',
    defaultAccelerator: 'Mod+Shift+A',
    globalWhenHidden: true
  },
  {
    id: 'focusSearch',
    label: '聚焦搜索',
    description: '跳转到首页并聚焦任务搜索框',
    defaultAccelerator: 'Mod+F'
  },
  {
    id: 'goHome',
    label: '返回任务列表',
    description: '跳转到首页任务列表',
    defaultAccelerator: 'Mod+1'
  },
  {
    id: 'openSettings',
    label: '打开设置',
    description: '打开设置页（含快捷键管理）',
    defaultAccelerator: 'Mod+,'
  }
]

export type ShortcutBindings = Record<ShortcutActionId, string>

/** 默认快捷键映射表 */
export function getDefaultShortcutBindings(): ShortcutBindings {
  const bindings = {} as ShortcutBindings
  for (const action of SHORTCUT_ACTIONS) {
    bindings[action.id] = action.defaultAccelerator
  }
  return bindings
}

const ACTION_IDS = new Set(SHORTCUT_ACTIONS.map((a) => a.id))

/** 合并用户配置与默认值，过滤未知键 */
export function mergeShortcutBindings(
  partial?: Partial<ShortcutBindings> | null
): ShortcutBindings {
  const defaults = getDefaultShortcutBindings()
  if (!partial) {
    return defaults
  }
  const next = { ...defaults }
  for (const [key, value] of Object.entries(partial)) {
    if (ACTION_IDS.has(key as ShortcutActionId) && typeof value === 'string' && value.trim()) {
      next[key as ShortcutActionId] = normalizeAccelerator(value)
    }
  }
  return next
}

/** 规范化存储格式：去空格、Mod/Ctrl/Alt/Shift 首字母大写 */
export function normalizeAccelerator(raw: string): string {
  return raw
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'mod') return 'Mod'
      if (lower === 'ctrl' || lower === 'control') return 'Ctrl'
      if (lower === 'alt') return 'Alt'
      if (lower === 'shift') return 'Shift'
      if (lower === 'comma' || part === ',') return ','
      if (part.length === 1) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('+')
}

export interface ParsedAccelerator {
  mod: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  key: string
}

/** 解析快捷键字符串，供键盘事件匹配使用 */
export function parseAccelerator(accelerator: string): ParsedAccelerator {
  const parts = normalizeAccelerator(accelerator)
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  const key = (parts.pop() ?? '').toLowerCase()
  return {
    mod: parts.includes('Mod'),
    ctrl: parts.includes('Ctrl'),
    alt: parts.includes('Alt'),
    shift: parts.includes('Shift'),
    key: key === ',' ? ',' : key
  }
}

/** 判断 KeyboardEvent 是否匹配给定快捷键（窗口聚焦时使用） */
export function eventMatchesAccelerator(e: KeyboardEvent, accelerator: string): boolean {
  const parsed = parseAccelerator(accelerator)
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()

  if (parsed.mod && !(e.ctrlKey || e.metaKey)) return false
  if (parsed.ctrl && !e.ctrlKey) return false
  if (parsed.alt && !e.altKey) return false
  if (parsed.shift && !e.shiftKey) return false

  if (!parsed.mod && !parsed.ctrl && (e.ctrlKey || e.metaKey)) return false
  if (!parsed.alt && e.altKey) return false
  if (!parsed.shift && e.shiftKey) return false

  const wanted = parsed.key
  if (wanted === ',') {
    return eventKey === ',' || e.code === 'Comma'
  }
  if (wanted.length === 1) {
    return eventKey === wanted
  }
  return eventKey === wanted.toLowerCase()
}

/** 将 Mod 转为平台展示符号（设置页用） */
export function formatAcceleratorForDisplay(accelerator: string, isMac = false): string {
  return normalizeAccelerator(accelerator)
    .split('+')
    .map((part) => {
      if (part === 'Mod') return isMac ? '⌘' : 'Ctrl'
      if (part === 'Shift') return isMac ? '⇧' : 'Shift'
      if (part === 'Alt') return isMac ? '⌥' : 'Alt'
      if (part === ',') return ','
      return part
    })
    .join(isMac ? '' : '+')
}

/** Electron globalShortcut 使用的 accelerator 字符串 */
export function toElectronAccelerator(accelerator: string): string {
  return normalizeAccelerator(accelerator)
    .split('+')
    .map((part) => {
      if (part === 'Mod') return 'CommandOrControl'
      if (part === 'Ctrl') return 'Control'
      if (part === 'Alt') return 'Alt'
      if (part === 'Shift') return 'Shift'
      if (part === ',') return 'Comma'
      return part
    })
    .join('+')
}

/** 检测绑定冲突：同一快捷键不可绑定多个动作 */
export function findShortcutConflicts(bindings: ShortcutBindings): Map<string, ShortcutActionId[]> {
  const byAccel = new Map<string, ShortcutActionId[]>()
  for (const action of SHORTCUT_ACTIONS) {
    const accel = bindings[action.id]
    const list = byAccel.get(accel) ?? []
    list.push(action.id)
    byAccel.set(accel, list)
  }
  const conflicts = new Map<string, ShortcutActionId[]>()
  for (const [accel, ids] of byAccel) {
    if (ids.length > 1) {
      conflicts.set(accel, ids)
    }
  }
  return conflicts
}
