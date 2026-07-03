import dayjs from 'dayjs'

/** 列表行展示：紧凑时间（今天/明天仅显示时分，其余 M月D日 HH:mm） */
export function formatTaskListTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = dayjs(iso)
  if (!d.isValid()) return iso
  const today = dayjs().format('YYYY-MM-DD')
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')
  const date = iso.slice(0, 10)
  const time = d.format('HH:mm')
  if (date === today) return `今天 ${time}`
  if (date === tomorrow) return `明天 ${time}`
  return d.format('M月D日 HH:mm')
}

/** 列表行：创建时间（仅日期或日期+时分） */
export function formatTaskCreatedAt(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = dayjs(iso)
  if (!d.isValid()) return iso
  const today = dayjs().format('YYYY-MM-DD')
  if (iso.slice(0, 10) === today) return `今天 ${d.format('HH:mm')}`
  return d.format('M月D日 HH:mm')
}

/** 垃圾桶列表右侧日期：优先截止日，否则删除日 */
export function formatTrashTaskDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = dayjs(iso)
  if (!d.isValid()) return iso
  return d.format('YYYY年M月D日')
}
