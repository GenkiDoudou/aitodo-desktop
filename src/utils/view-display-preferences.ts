import type { TaskDetailStyle, TaskListMetaVisibility } from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'
import type { KanbanBoardMode } from '@shared/kanban-config'
import {
  coerceHideDoneScope,
  hideDoneScopeFromLegacy,
  type HideDoneScope
} from '@shared/hide-done-scope'

export interface ViewDisplayPreferences {
  /** @deprecated 请使用 hideDoneScope */
  hideDone?: boolean
  hideDoneScope: HideDoneScope
  detailStyle: TaskDetailStyle
  metaVisibility: TaskListMetaVisibility
}

const KEY_PREFIX = 'aitodo_view_display_'

function storageKey(viewId: string): string {
  return `${KEY_PREFIX}${viewId}`
}

export function defaultViewDisplayPreferences(
  kanbanBoardMode?: KanbanBoardMode | null
): ViewDisplayPreferences {
  return {
    // 状态看板默认展示已完成列
    hideDoneScope: kanbanBoardMode === 'status' ? 'off' : 'all',
    detailStyle: 'sidebar',
    metaVisibility: { ...DEFAULT_TASK_LIST_META_VISIBILITY }
  }
}

export function readViewDisplayPreferences(
  viewId: string,
  kanbanBoardMode?: KanbanBoardMode | null
): ViewDisplayPreferences {
  const fallback = defaultViewDisplayPreferences(kanbanBoardMode)
  try {
    const raw = localStorage.getItem(storageKey(viewId))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<ViewDisplayPreferences>
    const hideDoneScope =
      parsed.hideDoneScope !== undefined
        ? coerceHideDoneScope(parsed.hideDoneScope, fallback.hideDoneScope)
        : typeof parsed.hideDone === 'boolean'
          ? hideDoneScopeFromLegacy(parsed.hideDone)
          : fallback.hideDoneScope
    return {
      hideDoneScope,
      detailStyle:
        parsed.detailStyle === 'dialog' || parsed.detailStyle === 'sidebar'
          ? parsed.detailStyle
          : fallback.detailStyle,
      metaVisibility: {
        ...fallback.metaVisibility,
        ...(parsed.metaVisibility ?? {})
      }
    }
  } catch {
    return fallback
  }
}

export function persistViewDisplayPreferences(
  viewId: string,
  prefs: ViewDisplayPreferences
): void {
  try {
    localStorage.setItem(storageKey(viewId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function copyViewDisplayPreferences(fromId: string, toId: string): void {
  const prefs = readViewDisplayPreferences(fromId)
  persistViewDisplayPreferences(toId, prefs)
}
