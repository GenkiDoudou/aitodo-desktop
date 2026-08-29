import { UNCATEGORIZED_LIST_KEY } from '@shared/visible-lists'

export type VisibleListScope = 'all' | 'calendar' | 'matrix'

export const VISIBLE_LIST_STORAGE_KEYS: Record<VisibleListScope, string> = {
  all: 'aitodo_visible_lists_all',
  calendar: 'aitodo_visible_lists_calendar',
  matrix: 'aitodo_visible_lists_matrix'
}

/**
 * 读取某视图的清单多选。空数组表示显示全部清单。
 */
export function readVisibleListIds(scope: VisibleListScope): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_LIST_STORAGE_KEYS[scope])
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return []
  }
}

export function persistVisibleListIds(scope: VisibleListScope, ids: string[]): void {
  try {
    localStorage.setItem(VISIBLE_LIST_STORAGE_KEYS[scope], JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export { UNCATEGORIZED_LIST_KEY }
