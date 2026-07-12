/** 可配置的桌面快捷键动作 ID（Main / Renderer 共用） */
export type ShortcutActionId =
  | 'newTask'
  | 'focusSearch'
  | 'showWindow'
  | 'toggleWidget'
  | 'quickCapture'
  | 'goHome'
  | 'goCalendar'
  | 'goMatrix'
  | 'goInbox'
  | 'goDone'
  | 'goTrash'
  | 'goDesktopOrganize'
  | 'openSettings'

export type ShortcutActionCategory = 'global' | 'navigation' | 'task'

export interface ShortcutActionDef {
  id: ShortcutActionId
  category: ShortcutActionCategory
  /** 设置页展示名称 */
  label: string
  /** 动作说明，便于用户理解边界 */
  description: string
  /** 默认快捷键字符串，Mod = Ctrl(Win/Linux) / Cmd(macOS)；空串表示默认不绑定 */
  defaultAccelerator: string
  /** 是否需要在窗口隐藏时由 Main 注册 globalShortcut */
  globalWhenHidden?: boolean
}

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutActionCategory, string> = {
  global: '全局',
  navigation: '页面导航',
  task: '任务操作'
}

export const SHORTCUT_CATEGORY_ORDER: ShortcutActionCategory[] = ['global', 'task', 'navigation']

/** 内置动作清单；新增动作时同步扩展 IPC 分发与设置页 */
export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  {
    id: 'showWindow',
    category: 'global',
    label: '显示主窗口',
    description: '显示或隐藏主窗口（再次按下缩小到托盘）',
    defaultAccelerator: 'Mod+Shift+A',
    globalWhenHidden: true
  },
  {
    id: 'toggleWidget',
    category: 'global',
    label: '打开/隐藏挂件',
    description: '切换任务挂件展开/收起（展开时失焦可自动收回边缘）',
    defaultAccelerator: 'Mod+Shift+W',
    globalWhenHidden: true
  },
  {
    id: 'quickCapture',
    category: 'global',
    label: '快捷任务输入',
    description: '打开全局任务输入条，回车快速保存到收件箱',
    defaultAccelerator: 'Mod+Shift+Space',
    globalWhenHidden: true
  },
  {
    id: 'newTask',
    category: 'global',
    label: '新建任务',
    description: '打开任务详情面板创建新任务',
    defaultAccelerator: 'Mod+N',
    globalWhenHidden: true
  },
  {
    id: 'focusSearch',
    category: 'task',
    label: '聚焦快捷添加',
    description: '跳转到首页并聚焦任务快捷添加输入框',
    defaultAccelerator: 'Mod+F'
  },
  {
    id: 'goHome',
    category: 'navigation',
    label: '任务列表',
    description: '跳转到首页全部任务',
    defaultAccelerator: 'Mod+1'
  },
  {
    id: 'goCalendar',
    category: 'navigation',
    label: '日历',
    description: '打开日历视图',
    defaultAccelerator: 'Mod+2'
  },
  {
    id: 'goMatrix',
    category: 'navigation',
    label: '四象限',
    description: '打开四象限矩阵视图',
    defaultAccelerator: 'Mod+3'
  },
  {
    id: 'goInbox',
    category: 'navigation',
    label: '收件箱',
    description: '打开收件箱（便签与未排优任务）',
    defaultAccelerator: 'Mod+4'
  },
  {
    id: 'goDone',
    category: 'navigation',
    label: '已完成',
    description: '打开已完成任务列表',
    defaultAccelerator: 'Mod+Shift+E'
  },
  {
    id: 'goTrash',
    category: 'navigation',
    label: '垃圾桶',
    description: '打开垃圾桶',
    defaultAccelerator: 'Mod+Shift+T'
  },
  {
    id: 'goDesktopOrganize',
    category: 'navigation',
    label: '桌面整理',
    description: '打开桌面整理页面',
    defaultAccelerator: 'Mod+Shift+O'
  },
  {
    id: 'openSettings',
    category: 'navigation',
    label: '打开设置',
    description: '打开设置页',
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

export function isShortcutBound(accelerator: string | null | undefined): accelerator is string {
  return typeof accelerator === 'string' && accelerator.trim().length > 0
}

/** 合并用户配置与默认值，过滤未知键；空串表示用户已清除绑定 */
export function mergeShortcutBindings(
  partial?: Partial<ShortcutBindings> | null
): ShortcutBindings {
  const defaults = getDefaultShortcutBindings()
  if (!partial) {
    return defaults
  }
  const next = { ...defaults }
  for (const [key, value] of Object.entries(partial)) {
    if (!ACTION_IDS.has(key as ShortcutActionId)) continue
    if (value === '' || value === null) {
      next[key as ShortcutActionId] = ''
    } else if (typeof value === 'string' && value.trim()) {
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
  if (!isShortcutBound(accelerator)) return false
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
  if (!isShortcutBound(accelerator)) return '未设置'
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

/** 检测绑定冲突：同一快捷键不可绑定多个动作（已清除的不参与） */
export function findShortcutConflicts(bindings: ShortcutBindings): Map<string, ShortcutActionId[]> {
  const byAccel = new Map<string, ShortcutActionId[]>()
  for (const action of SHORTCUT_ACTIONS) {
    const accel = bindings[action.id]
    if (!isShortcutBound(accel)) continue
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

export interface ShortcutConflictInfo {
  accelerator: string
  actionIds: ShortcutActionId[]
  labels: string[]
}

function labelOf(id: ShortcutActionId): string {
  return SHORTCUT_ACTIONS.find((a) => a.id === id)?.label ?? id
}

/** 列出全部冲突（含中文动作名，便于设置页展示） */
export function listShortcutConflicts(bindings: ShortcutBindings): ShortcutConflictInfo[] {
  return [...findShortcutConflicts(bindings).entries()].map(([accelerator, actionIds]) => ({
    accelerator,
    actionIds,
    labels: actionIds.map(labelOf)
  }))
}

/**
 * 若将 actionId 设为 accelerator，是否与其它动作冲突。
 * 返回占用该键的其它动作；空数组表示无冲突。
 */
export function findActionsUsingAccelerator(
  bindings: ShortcutBindings,
  accelerator: string,
  excludeActionId?: ShortcutActionId
): ShortcutActionId[] {
  if (!isShortcutBound(accelerator)) return []
  const normalized = normalizeAccelerator(accelerator)
  const hits: ShortcutActionId[] = []
  for (const action of SHORTCUT_ACTIONS) {
    if (excludeActionId && action.id === excludeActionId) continue
    if (bindings[action.id] === normalized) {
      hits.push(action.id)
    }
  }
  return hits
}

/** 生成冲突提示文案 */
export function formatShortcutConflictMessage(
  accelerator: string,
  conflictingIds: ShortcutActionId[],
  isMac = false
): string {
  const key = formatAcceleratorForDisplay(accelerator, isMac)
  const names = conflictingIds.map(labelOf).join('、')
  return `快捷键 ${key} 已用于「${names}」，请换一组或先清除原绑定`
}
