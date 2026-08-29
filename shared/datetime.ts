/**
 * 生成 ISO 本地时间字符串（存储约定：yyyy-MM-ddTHH:mm:ss，无毫秒）。
 * 与 AGENTS.md 中时间字段说明一致，便于日后与后端对齐。
 */
export function nowIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 今日日期前缀 yyyy-MM-dd，用于 Today 智能列表 SQL 比较 */
export function todayDatePrefix(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
