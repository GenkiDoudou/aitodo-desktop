/** 将 ids 中 from 下标元素移到 to 下标（to 为移动后的目标下标） */
export function moveItemInOrder<T>(ids: readonly T[], from: number, to: number): T[] {
  if (
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length ||
    from === to
  ) {
    return [...ids]
  }
  const next = [...ids]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}
