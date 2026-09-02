import dayjs, { type Dayjs } from 'dayjs'
import type { Task } from './types'
import { doneTimeRangeBounds } from './date-filter'
import { resolveTaskCompletedAt } from './completed-task-groups'

/**
 * 列表「隐藏已完成」范围：
 * - off：不隐藏
 * - all：隐藏全部已完成
 * - today/week/month：仅隐藏该自然时段内完成的任务（较早完成的仍可见）
 */
export type HideDoneScope = 'off' | 'all' | 'today' | 'week' | 'month'

export const HIDE_DONE_SCOPE_LABELS: Record<HideDoneScope, string> = {
  off: '不隐藏',
  all: '全部',
  today: '本日',
  week: '本周',
  month: '本月'
}

export const HIDE_DONE_SCOPE_OPTIONS: HideDoneScope[] = ['off', 'all', 'today', 'week', 'month']

const VALID_SCOPES = new Set<string>(HIDE_DONE_SCOPE_OPTIONS)

/** 旧版 boolean hideDone 迁移为 scope */
export function hideDoneScopeFromLegacy(hideDone?: boolean): HideDoneScope {
  if (hideDone === false) return 'off'
  return 'all'
}

/** 从筛选条件解析 scope（优先 hideDoneScope，回退 legacy hideDone） */
export function resolveHideDoneScope(filter: {
  hideDone?: boolean
  hideDoneScope?: HideDoneScope
}): HideDoneScope {
  if (filter.hideDoneScope && VALID_SCOPES.has(filter.hideDoneScope)) {
    return filter.hideDoneScope
  }
  return hideDoneScopeFromLegacy(filter.hideDone)
}

/** 是否处于「隐藏已完成」任一模式（含按时段部分隐藏） */
export function isHideDoneActive(scope: HideDoneScope): boolean {
  return scope !== 'off'
}

/** 看板是否展示「已完成」列：全部隐藏时不展示，其余模式仍可能有可见的已完成任务 */
export function shouldShowKanbanDoneColumn(scope: HideDoneScope): boolean {
  return scope !== 'all'
}

/**
 * 判断任务是否应出现在当前列表（客户端二次过滤，与 SQL 一致）。
 * @returns true 表示保留该任务
 */
export function taskMatchesHideDoneScope(
  task: Task,
  scope: HideDoneScope,
  base: Dayjs = dayjs()
): boolean {
  if (scope === 'off') return true
  if (task.status !== 'DONE') return true
  if (scope === 'all') return false

  const bounds = doneTimeRangeBounds(scope, base)
  if (!bounds) return true

  const completedIso = resolveTaskCompletedAt(task)
  if (!completedIso) return true

  // 落在隐藏时段内的已完成任务被滤掉
  const inHiddenWindow = completedIso >= bounds.from && completedIso <= bounds.to
  return !inHiddenWindow
}

export interface HideDoneSqlClause {
  sql: string
  params: Record<string, string>
}

/** 为 task-repository 生成 hideDoneScope 对应的 WHERE 片段 */
export function hideDoneScopeSqlClause(scope: HideDoneScope, base: Dayjs = dayjs()): HideDoneSqlClause | null {
  if (scope === 'off') return null
  if (scope === 'all') {
    return { sql: `status != 'DONE'`, params: {} }
  }

  const bounds = doneTimeRangeBounds(scope, base)
  if (!bounds) return null

  return {
    sql: `(status != 'DONE' OR COALESCE(completed_at, updated_at) < @hideDoneFrom OR COALESCE(completed_at, updated_at) > @hideDoneTo)`,
    params: {
      hideDoneFrom: bounds.from,
      hideDoneTo: bounds.to
    }
  }
}

export function coerceHideDoneScope(value: unknown, fallback: HideDoneScope = 'all'): HideDoneScope {
  if (typeof value === 'string' && VALID_SCOPES.has(value)) {
    return value as HideDoneScope
  }
  if (typeof value === 'boolean') {
    return hideDoneScopeFromLegacy(value)
  }
  return fallback
}
