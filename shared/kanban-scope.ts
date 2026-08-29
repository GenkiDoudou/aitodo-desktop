/** 看板虚拟「未分组」列 id（不入库） */
export const KANBAN_UNGROUPED_ID = '__ungrouped__'

/** 分组看板「已完成」独立列 id（不入库） */
export const KANBAN_DONE_COLUMN_ID = '__DONE__'

/** 未分组显示名在库内的行 id（按 scope 一条） */
export function kanbanUngroupedMetaId(scopeKey: string): string {
  return `${KANBAN_UNGROUPED_ID}:${scopeKey}`
}

export function isKanbanUngroupedMetaId(id: string): boolean {
  return id.startsWith(`${KANBAN_UNGROUPED_ID}:`)
}

/** 由当前侧栏导航计算看板分组作用域 */
export function kanbanScopeKey(opts: {
  categoryId?: string | null | undefined
  smart?: string
}): string {
  if (opts.categoryId !== undefined) {
    return opts.categoryId === null ? 'scope:uncategorized' : `scope:cat:${opts.categoryId}`
  }
  return `scope:smart:${opts.smart ?? 'all'}`
}
