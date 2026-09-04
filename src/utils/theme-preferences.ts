/**
 * 桌面端主题：固定 Todo Pro（Element 蓝）。
 * 多品牌风格切换已下线，仅启动时写入一套 CSS 变量。
 */

export const DESKTOP_THEME_IDS = ['todoPro'] as const

export type DesktopThemeId = (typeof DESKTOP_THEME_IDS)[number]

type ThemeVars = Record<string, string>

const PRIMARY = '#409eff'

const PRIORITY_SOLID_VARS: ThemeVars = {
  '--desktop-priority-p0': '#f56c6c',
  '--desktop-priority-p1': '#e6a23c',
  '--desktop-priority-p2': '#409eff',
  '--desktop-priority-p3': '#909399',
  '--desktop-priority-p0-tint': '#fef0f0',
  '--desktop-priority-p1-tint': '#fdf6ec',
  '--desktop-priority-p2-tint': '#ecf5ff',
  '--desktop-priority-p3-tint': '#f4f4f5',
  '--desktop-danger': '#f56c6c'
}

const TODO_PRO_VARS: ThemeVars = {
  '--desktop-bg': '#f5f7fa',
  '--desktop-panel': '#ffffff',
  '--desktop-sidebar': '#fbfbfc',
  '--desktop-sidebar-rail': '#fbfbfc',
  '--desktop-sidebar-panel': '#fbfbfc',
  '--desktop-sidebar-item-active': '#ecf5ff',
  '--desktop-border': '#dcdfe6',
  '--desktop-hover': 'rgba(64, 158, 255, 0.06)',
  '--desktop-active': '#ecf5ff',
  '--desktop-muted': '#909399',
  '--desktop-text': '#303133',
  '--desktop-text-secondary': '#606266',
  '--desktop-primary': PRIMARY,
  '--desktop-primary-hover': '#66b1ff',
  '--desktop-primary-light': '#ecf5ff',
  '--desktop-font':
    '"Inter", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
  '--desktop-font-display':
    '"Inter", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
  '--desktop-radius-sm': '4px',
  '--desktop-radius-md': '4px',
  '--desktop-radius-lg': '7px',
  '--desktop-radius-pill': '4px',
  '--desktop-title-weight': '650',
  '--desktop-shadow': '0 8px 24px rgba(0, 0, 0, 0.08)',
  '--el-font-size-base': '14px',
  '--el-border-radius-base': '4px'
}

/** 将主色同步到 Element Plus 色阶变量 */
function elPrimaryVariants(primary: string): ThemeVars {
  return {
    '--el-color-primary': primary,
    '--el-color-primary-light-3': '#79bbff',
    '--el-color-primary-light-5': '#a0cfff',
    '--el-color-primary-light-7': '#c6e2ff',
    '--el-color-primary-light-8': '#d9ecff',
    '--el-color-primary-light-9': '#ecf5ff',
    '--el-color-primary-dark-2': '#337ecc'
  }
}

/** 固定应用 Todo Pro；忽略历史 localStorage 中的其它主题 id */
export function applyDesktopTheme(_theme?: DesktopThemeId): void {
  const vars = {
    ...PRIORITY_SOLID_VARS,
    ...TODO_PRO_VARS,
    ...elPrimaryVariants(PRIMARY)
  }
  const root = document.documentElement
  root.dataset.desktopTheme = 'todoPro'
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
  try {
    localStorage.removeItem('aitodo_desktop_theme')
  } catch {
    /* ignore */
  }
}

export function initDesktopTheme(): DesktopThemeId {
  applyDesktopTheme('todoPro')
  return 'todoPro'
}

export function themePrimaryColor(_theme?: DesktopThemeId): string {
  return PRIMARY
}
