export const DESKTOP_THEME_IDS = [
  'notion',
  'figma',
  'cursor',
  'clay',
  'claude',
  'airtable',
  'airbnb'
] as const

export type DesktopThemeId = (typeof DESKTOP_THEME_IDS)[number]

export interface DesktopThemeOption {
  id: DesktopThemeId
  label: string
  description: string
}

const THEME_KEY = 'aitodo_desktop_theme'

const THEME_OPTIONS: DesktopThemeOption[] = [
  { id: 'notion', label: 'Notion', description: '纸感暖白 · 蓝色药丸 · Inter' },
  { id: 'figma', label: 'Figma', description: '黑白编辑 · 大圆角 · 粉彩侧栏' },
  { id: 'cursor', label: 'Cursor', description: '奶油画布 · 橙色 CTA · 工具感' },
  { id: 'clay', label: 'Clay', description: '暖黄底 · 饱和点缀 · 圆润卡片' },
  { id: 'claude', label: 'Claude', description: '奶油编辑 · 珊瑚 CTA · 衬线标题' },
  { id: 'airtable', label: 'Airtable', description: '工作流白底 · 近黑 CTA · 克制' },
  { id: 'airbnb', label: 'Airbnb', description: 'Rausch 红 · 大圆角 · 友好圆润' }
]

type ThemeVars = Record<string, string>

/** 各品牌主色，同步到 Element Plus --el-color-primary */
const THEME_PRIMARY: Record<DesktopThemeId, string> = {
  notion: '#0075de',
  figma: '#000000',
  cursor: '#f54e00',
  clay: '#0a0a0a',
  claude: '#cc785c',
  airtable: '#181d26',
  airbnb: '#ff385c'
}

const THEME_VARS: Record<DesktopThemeId, ThemeVars> = {
  notion: {
    '--desktop-bg': '#f6f5f4',
    '--desktop-panel': '#ffffff',
    '--desktop-sidebar': '#f6f5f4',
    '--desktop-sidebar-rail': '#ece8e4',
    '--desktop-sidebar-panel': '#ffffff',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#e6e6e6',
    '--desktop-hover': 'rgba(0, 0, 0, 0.04)',
    '--desktop-active': 'rgba(0, 117, 222, 0.12)',
    '--desktop-muted': '#615d59',
    '--desktop-text': '#000000',
    '--desktop-font': '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '--desktop-font-display': '"Inter", sans-serif',
    '--desktop-radius-sm': '5px',
    '--desktop-radius-md': '8px',
    '--desktop-radius-lg': '12px',
    '--desktop-radius-pill': '9999px',
    '--desktop-title-weight': '700',
    '--desktop-shadow': 'none',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '8px'
  },
  figma: {
    '--desktop-bg': '#f7f7f5',
    '--desktop-panel': '#ffffff',
    '--desktop-sidebar': '#dceeb1',
    '--desktop-sidebar-rail': '#c5b0f4',
    '--desktop-sidebar-panel': '#ffffff',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#e6e6e6',
    '--desktop-hover': 'rgba(0, 0, 0, 0.05)',
    '--desktop-active': 'rgba(0, 0, 0, 0.08)',
    '--desktop-muted': '#666666',
    '--desktop-text': '#000000',
    '--desktop-font': '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    '--desktop-font-display': '"DM Sans", sans-serif',
    '--desktop-radius-sm': '6px',
    '--desktop-radius-md': '8px',
    '--desktop-radius-lg': '24px',
    '--desktop-radius-pill': '50px',
    '--desktop-title-weight': '540',
    '--desktop-shadow': 'none',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '8px'
  },
  cursor: {
    '--desktop-bg': '#f7f7f4',
    '--desktop-panel': '#fafaf7',
    '--desktop-sidebar': '#fafaf7',
    '--desktop-sidebar-rail': '#efeee8',
    '--desktop-sidebar-panel': '#ffffff',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#e6e5e0',
    '--desktop-hover': 'rgba(38, 37, 30, 0.05)',
    '--desktop-active': 'rgba(245, 78, 0, 0.14)',
    '--desktop-muted': '#807d72',
    '--desktop-text': '#26251e',
    '--desktop-font': '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    '--desktop-font-display': '"IBM Plex Sans", sans-serif',
    '--desktop-radius-sm': '4px',
    '--desktop-radius-md': '8px',
    '--desktop-radius-lg': '12px',
    '--desktop-radius-pill': '8px',
    '--desktop-title-weight': '600',
    '--desktop-shadow': 'none',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '8px'
  },
  clay: {
    '--desktop-bg': '#fffaf0',
    '--desktop-panel': '#faf5e8',
    '--desktop-sidebar': '#f5f0e0',
    '--desktop-sidebar-rail': '#ebe6d6',
    '--desktop-sidebar-panel': '#faf5e8',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#e5e5e5',
    '--desktop-hover': 'rgba(10, 10, 10, 0.05)',
    '--desktop-active': 'rgba(255, 77, 139, 0.14)',
    '--desktop-muted': '#6a6a6a',
    '--desktop-text': '#0a0a0a',
    '--desktop-font': '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    '--desktop-font-display': '"Inter", sans-serif',
    '--desktop-radius-sm': '8px',
    '--desktop-radius-md': '12px',
    '--desktop-radius-lg': '16px',
    '--desktop-radius-pill': '12px',
    '--desktop-title-weight': '600',
    '--desktop-shadow': '0 4px 20px rgba(0, 0, 0, 0.06)',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '12px'
  },
  claude: {
    '--desktop-bg': '#faf9f5',
    '--desktop-panel': '#f5f0e8',
    '--desktop-sidebar': '#efe9de',
    '--desktop-sidebar-rail': '#e8e0d2',
    '--desktop-sidebar-panel': '#f5f0e8',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#e6dfd8',
    '--desktop-hover': 'rgba(20, 20, 19, 0.05)',
    '--desktop-active': 'rgba(204, 120, 92, 0.15)',
    '--desktop-muted': '#6c6a64',
    '--desktop-text': '#141413',
    '--desktop-font': '"Source Sans 3", -apple-system, BlinkMacSystemFont, sans-serif',
    '--desktop-font-display': '"Libre Baskerville", Georgia, "Times New Roman", serif',
    '--desktop-radius-sm': '6px',
    '--desktop-radius-md': '8px',
    '--desktop-radius-lg': '12px',
    '--desktop-radius-pill': '8px',
    '--desktop-title-weight': '400',
    '--desktop-shadow': 'none',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '8px'
  },
  airtable: {
    '--desktop-bg': '#ffffff',
    '--desktop-panel': '#f8fafc',
    '--desktop-sidebar': '#f8fafc',
    '--desktop-sidebar-rail': '#e0e2e6',
    '--desktop-sidebar-panel': '#ffffff',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#dddddd',
    '--desktop-hover': 'rgba(24, 29, 38, 0.05)',
    '--desktop-active': 'rgba(27, 97, 201, 0.14)',
    '--desktop-muted': '#41454d',
    '--desktop-text': '#181d26',
    '--desktop-font': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    '--desktop-font-display': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    '--desktop-radius-sm': '6px',
    '--desktop-radius-md': '10px',
    '--desktop-radius-lg': '12px',
    '--desktop-radius-pill': '9999px',
    '--desktop-title-weight': '500',
    '--desktop-shadow': 'none',
    '--el-font-size-base': '14px',
    '--el-border-radius-base': '10px'
  },
  airbnb: {
    '--desktop-bg': '#ffffff',
    '--desktop-panel': '#f7f7f7',
    '--desktop-sidebar': '#f7f7f7',
    '--desktop-sidebar-rail': '#ebebeb',
    '--desktop-sidebar-panel': '#ffffff',
    '--desktop-sidebar-item-active': '#ffffff',
    '--desktop-border': '#dddddd',
    '--desktop-hover': 'rgba(34, 34, 34, 0.05)',
    '--desktop-active': 'rgba(255, 56, 92, 0.14)',
    '--desktop-muted': '#6a6a6a',
    '--desktop-text': '#222222',
    '--desktop-font': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '--desktop-font-display': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    '--desktop-radius-sm': '8px',
    '--desktop-radius-md': '14px',
    '--desktop-radius-lg': '20px',
    '--desktop-radius-pill': '9999px',
    '--desktop-title-weight': '600',
    '--desktop-shadow': '0 6px 16px rgba(0, 0, 0, 0.08)',
    '--el-font-size-base': '15px',
    '--el-border-radius-base': '14px'
  }
}

/** Element Plus 浅色阶，依赖运行时 primary */
function elPrimaryVariants(primary: string): ThemeVars {
  return {
    '--el-color-primary': primary,
    '--el-color-primary-light-3': `color-mix(in srgb, ${primary} 70%, white)`,
    '--el-color-primary-light-5': `color-mix(in srgb, ${primary} 50%, white)`,
    '--el-color-primary-light-7': `color-mix(in srgb, ${primary} 30%, white)`,
    '--el-color-primary-light-8': `color-mix(in srgb, ${primary} 20%, white)`,
    '--el-color-primary-light-9': `color-mix(in srgb, ${primary} 10%, white)`,
    '--el-color-primary-dark-2': `color-mix(in srgb, ${primary} 80%, black)`
  }
}

export function desktopThemeOptions(): DesktopThemeOption[] {
  return THEME_OPTIONS
}

export function readDesktopTheme(): DesktopThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw && DESKTOP_THEME_IDS.includes(raw as DesktopThemeId)) {
      return raw as DesktopThemeId
    }
  } catch {
    /* ignore */
  }
  return 'claude'
}

export function persistDesktopTheme(theme: DesktopThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyDesktopTheme(theme: DesktopThemeId): void {
  const id = DESKTOP_THEME_IDS.includes(theme) ? theme : 'claude'
  const vars = {
    ...THEME_VARS[id],
    ...elPrimaryVariants(THEME_PRIMARY[id])
  }
  const root = document.documentElement
  root.dataset.desktopTheme = id
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
}

export function initDesktopTheme(): DesktopThemeId {
  const theme = readDesktopTheme()
  applyDesktopTheme(theme)
  return theme
}

export function themePrimaryColor(theme: DesktopThemeId): string {
  return THEME_PRIMARY[theme]
}
