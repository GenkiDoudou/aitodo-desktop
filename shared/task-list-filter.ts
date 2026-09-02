import type { TaskListFilter } from './types'

/**
 * 克隆列表筛选条件为纯 JSON 对象，供 IPC 传递。
 * Vue/Pinia 的 reactive Proxy 经 IPC 序列化可能丢字段；categoryId: null 必须显式保留。
 */
export function cloneTaskListFilter(filter: TaskListFilter): TaskListFilter {
  const out: TaskListFilter = {}

  if (typeof filter.hideDone === 'boolean') {
    out.hideDone = filter.hideDone
  }
  if (filter.hideDoneScope) {
    out.hideDoneScope = filter.hideDoneScope
  }
  if (filter.smartList) {
    out.smartList = filter.smartList
  }
  if (filter.status) {
    out.status = filter.status
  }
  if (filter.search?.trim()) {
    out.search = filter.search.trim()
  }
  if (Object.prototype.hasOwnProperty.call(filter, 'categoryId')) {
    out.categoryId = filter.categoryId ?? null
  }
  if (Object.prototype.hasOwnProperty.call(filter, 'parentId')) {
    out.parentId = filter.parentId ?? null
  }
  if (filter.dateField) {
    out.dateField = filter.dateField
  }
  if (filter.doneTimeRange) {
    out.doneTimeRange = filter.doneTimeRange
  }
  if (filter.dateFrom) {
    out.dateFrom = filter.dateFrom
  }
  if (filter.dateTo) {
    out.dateTo = filter.dateTo
  }

  return out
}

/** 四象限视图的列表筛选：不按清单/smartList/父子过滤，子任务在象限内嵌套展示 */
export function isMatrixListFilter(filter: TaskListFilter): boolean {
  return (
    filter.categoryId === undefined &&
    filter.smartList === undefined &&
    !Object.prototype.hasOwnProperty.call(filter, 'parentId')
  )
}
