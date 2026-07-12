/**
 * 任务侧栏「智能清单」等二级菜单项的显示策略。
 * 设置页可配置；侧栏按策略与内容数量决定是否展示。
 */

/** 可在设置中配置显示策略的侧栏项 id */
export type SmartListSidebarItemId =
  | 'inbox'
  | 'all'
  | 'last7days'
  | 'uncategorized'
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

/** 默认策略：全部始终展示（下属自定义视图），常用项显示 */
export const DEFAULT_SMART_LIST_SIDEBAR_PREFERENCES: SmartListSidebarPreferences = {
  inbox: 'when_nonempty',
  all: 'show',
  last7days: 'show',
  uncategorized: 'show',
  done: 'show',
  trash: 'show'
}

export const SMART_LIST_SIDEBAR_ITEM_IDS: SmartListSidebarItemId[] = [
  'inbox',
  'all',
  'last7days',
  'uncategorized',
  'done',
  'trash'
]

/** 设置页分组（仅 UI 结构，图标在组件内映射） */
export const SMART_LIST_SIDEBAR_SETTING_GROUPS: {
  items: { id: SmartListSidebarItemId; label: string }[]
}[] = [
  {
    items: [
      { id: 'inbox', label: '收件箱' },
      { id: 'all', label: '全部' },
      { id: 'last7days', label: '最近7天' }
    ]
  },
  {
    items: [{ id: 'uncategorized', label: '未分类' }]
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
