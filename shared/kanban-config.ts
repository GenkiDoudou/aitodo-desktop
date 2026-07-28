import type { TaskStatus } from './types'

/** 看板列组织方式：自定义分组 / 状态 / 级别 / 时间 / 标签 */
export type KanbanBoardMode = 'group' | 'status' | 'priority' | 'time' | 'tag'

export interface KanbanStatusColumnLabels {
  todo: string
  inProgress: string
  done: string
}

export interface KanbanConfig {
  /** 进入看板时的默认模式 */
  defaultMode: KanbanBoardMode
  statusColumnLabels: KanbanStatusColumnLabels
}

export const DEFAULT_KANBAN_STATUS_LABELS: KanbanStatusColumnLabels = {
  todo: '未开始',
  inProgress: '进行中',
  done: '已完成'
}

export const DEFAULT_KANBAN_CONFIG: KanbanConfig = {
  defaultMode: 'group',
  statusColumnLabels: { ...DEFAULT_KANBAN_STATUS_LABELS }
}

export const KANBAN_STATUS_COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

export function mergeKanbanConfig(partial?: Partial<KanbanConfig> | null): KanbanConfig {
  const labels = partial?.statusColumnLabels ?? {}
  const mode = partial?.defaultMode
  let defaultMode: KanbanBoardMode = 'group'
  if (mode === 'status' || mode === 'priority' || mode === 'time' || mode === 'tag') {
    defaultMode = mode
  }
  return {
    defaultMode,
    statusColumnLabels: {
      todo: trimLabel(labels.todo, DEFAULT_KANBAN_STATUS_LABELS.todo),
      inProgress: trimLabel(labels.inProgress, DEFAULT_KANBAN_STATUS_LABELS.inProgress),
      done: trimLabel(labels.done, DEFAULT_KANBAN_STATUS_LABELS.done)
    }
  }
}

function trimLabel(value: string | undefined, fallback: string): string {
  const t = value?.trim()
  return t || fallback
}

export function statusLabelFor(
  status: TaskStatus,
  labels: KanbanStatusColumnLabels
): string {
  if (status === 'TODO') return labels.todo
  if (status === 'IN_PROGRESS') return labels.inProgress
  return labels.done
}
