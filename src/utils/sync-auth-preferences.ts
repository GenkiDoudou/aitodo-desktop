/** 账号与同步：本地记住上次登录用户名（aitodo_* 键，可随 UI 偏好导出） */
export const SYNC_LAST_USERNAME_KEY = 'aitodo_sync_last_username'

/** 读取上次登录/注册使用的用户名 */
export function loadLastSyncUsername(): string {
  try {
    return localStorage.getItem(SYNC_LAST_USERNAME_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

/** 持久化用户名（登录/注册成功后调用） */
export function saveLastSyncUsername(username: string): void {
  const trimmed = username.trim()
  if (!trimmed) return
  try {
    localStorage.setItem(SYNC_LAST_USERNAME_KEY, trimmed)
  } catch {
    /* 极端环境无 localStorage 时忽略 */
  }
}
