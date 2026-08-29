import type {
  TaskDetailStyle,
  TaskListMetaVisibility,
  TaskListViewMode
} from '@shared/list-view-preferences'
import { DEFAULT_TASK_LIST_META_VISIBILITY } from '@shared/list-view-preferences'

const VIEW_MODE_KEY = 'aitodo_list_view_mode'
const DETAIL_STYLE_KEY = 'aitodo_task_detail_style'
const META_VISIBILITY_KEY = 'aitodo_task_list_meta_visibility'

function readEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw && (allowed as readonly string[]).includes(raw)) {
      return raw as T
    }
  } catch {
    /* ignore */
  }
  return fallback
}

export function readTaskListViewMode(): TaskListViewMode {
  return readEnum(VIEW_MODE_KEY, ['list', 'kanban', 'timeline'] as const, 'list')
}

export function persistTaskListViewMode(mode: TaskListViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function readTaskDetailStyle(): TaskDetailStyle {
  return readEnum(DETAIL_STYLE_KEY, ['sidebar', 'dialog'] as const, 'sidebar')
}

export function persistTaskDetailStyle(style: TaskDetailStyle): void {
  try {
    localStorage.setItem(DETAIL_STYLE_KEY, style)
  } catch {
    /* ignore */
  }
}

export function readTaskListMetaVisibility(): TaskListMetaVisibility {
  try {
    const raw = localStorage.getItem(META_VISIBILITY_KEY)
    if (!raw) return { ...DEFAULT_TASK_LIST_META_VISIBILITY }
    const parsed = JSON.parse(raw) as Partial<TaskListMetaVisibility>
    return {
      createdAt: parsed.createdAt ?? DEFAULT_TASK_LIST_META_VISIBILITY.createdAt,
      dueAt: parsed.dueAt ?? DEFAULT_TASK_LIST_META_VISIBILITY.dueAt,
      remindAt: parsed.remindAt ?? DEFAULT_TASK_LIST_META_VISIBILITY.remindAt,
      completedAt: parsed.completedAt ?? DEFAULT_TASK_LIST_META_VISIBILITY.completedAt
    }
  } catch {
    return { ...DEFAULT_TASK_LIST_META_VISIBILITY }
  }
}

export function persistTaskListMetaVisibility(vis: TaskListMetaVisibility): void {
  try {
    localStorage.setItem(META_VISIBILITY_KEY, JSON.stringify(vis))
  } catch {
    /* ignore */
  }
}
