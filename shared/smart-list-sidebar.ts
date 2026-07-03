/**
 * 任务侧栏「智能清单」等二级菜单项的显示策略。
 * 设置页可配置；侧栏按策略与内容数量决定是否展示。
 */

/** 可在设置中配置显示策略的侧栏项 id */
export type SmartListSidebarItemId =
  | 'all'
  | 'today'
  | 'week'
  | 'last7days'
  | 'uncategorized'
  | 'filters'
  | 'done'
  | 'trash'

export type SmartListSidebarVisibility = 'show' | 'hide' | 'when_nonempty'

export const SMART_LIST_SIDEBAR_VISIBILITY_OPTIONS: SmartListSidebarVisibility[] = [
  'show',
  'hide',
  'when_nonempty'
]

export const SMART_LIST_SIDEBAR_VISIBILITY_LABELS: Record<SmartListSidebarVisibility, string> = {
  show: '显示',
  hide: '隐藏',
  when_nonempty: '有内容时显示'
}

export type SmartListSidebarPreferences = Record<SmartListSidebarItemId, SmartListSidebarVisibility>

/** 默认策略：与常见 TickTick 习惯接近（全部默认隐藏，常用项显示） */
export const DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES: SmartListSidebarPreferences = {
  all: 'hide',
  today: 'show',
  week: 'show',
  last7days: 'show',
  uncategorized: 'show',
  filters: 'show',
  done: 'show',
  trash: 'show'
}

export const SMART_LIST_SIDEBAR_ITEM_IDS: SmartListSidebarItemId[] = [
  'all',
  'today',
  'week',
  'last7days',
  'uncategorized',
  'filters',
  'done',
  'trash'
]

/** 设置页分组（仅 UI 结构，图标在组件内映射） */
export const SMART_LIST_SIDEBAR_SETTING_GROUPS: {
  items: { id: SmartListSidebarItemId; label: string }[]
}[] = [
  {
    items: [
      { id: 'all', label: '全部' },
      { id: 'today', label: '今天' },
      { id: 'week', label: '本周' },
      { id: 'last7days', label: '最近7天' }
    ]
  },
  {
    items: [
      { id: 'uncategorized', label: '未分类' },
      { id: 'filters', label: '过滤器' }
    ]
  },
  {
    items: [
      { id: 'done', label: '已完成' },
      { id: 'trash', label: '垃圾桶' }
    ]
  }
]

/** 合并本地已存配置与默认值，避免新增项缺键 */
export function normalizeSmartListSidebarPreferences(
  partial?: Partial<SmartListSidebarPreferences>
): SmartListSidebarPreferences {
  return { ...DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES, ...partial }
}

/**
 * 根据显示策略与内容数量判断侧栏项是否应展示。
 * @param contentCount 该项下的任务数（或等价「有内容」指标，过滤器暂无实现时为 0）
 */
export function isSmartListSidebarItemVisible(
  visibility: SmartListSidebarVisibility,
  contentCount: number
): boolean {
  if (visibility === 'show') return true
  if (visibility === 'hide') return false
  return contentCount > 0
}
