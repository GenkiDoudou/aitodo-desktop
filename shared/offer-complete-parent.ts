import type { Task } from './types'

/**
 * 判断完成某个子任务后，是否应询问用户把直接父任务也标为完成。
 *
 * @param parent 直接父任务；缺失或已删除时不询问
 * @param children 父任务下的子任务快照（可含其它 parentId，函数会过滤）
 * @returns 父任务未完成、且所有未删除的直接子任务均为 DONE 时为 true
 *
 * 边界：没有存活子任务时不询问（避免空父任务被误关）。
 * 向上询问由调用方在用户确认并完成父任务后再调一次本函数。
 */
export function shouldOfferCompleteParent(options: {
  parent: Task | null | undefined
  children: Task[]
}): boolean {
  const parent = options.parent
  if (!parent || parent.deletedAt || parent.status === 'DONE') {
    return false
  }
  const aliveChildren = options.children.filter(
    (child) => !child.deletedAt && child.parentId === parent.id
  )
  if (aliveChildren.length === 0) {
    return false
  }
  return aliveChildren.every((child) => child.status === 'DONE')
}
