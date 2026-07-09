import {
  DEFAULT_KANBAN_CONFIG,
  mergeKanbanConfig,
  type KanbanBoardMode,
  type KanbanConfig
} from '@shared/kanban-config'

const CONFIG_KEY = 'aitodo_kanban_config'
const CURRENT_MODE_KEY = 'aitodo_kanban_board_mode'

export function readKanbanConfig(): KanbanConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_KANBAN_CONFIG, statusColumnLabels: { ...DEFAULT_KANBAN_CONFIG.statusColumnLabels } }
    return mergeKanbanConfig(JSON.parse(raw) as Partial<KanbanConfig>)
  } catch {
    return { ...DEFAULT_KANBAN_CONFIG, statusColumnLabels: { ...DEFAULT_KANBAN_CONFIG.statusColumnLabels } }
  }
}

export function persistKanbanConfig(config: KanbanConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(mergeKanbanConfig(config)))
  } catch {
    /* ignore */
  }
}

export function readKanbanBoardMode(): KanbanBoardMode {
  try {
    const raw = localStorage.getItem(CURRENT_MODE_KEY)
    if (raw === 'group' || raw === 'status') return raw
  } catch {
    /* ignore */
  }
  return readKanbanConfig().defaultMode
}

export function persistKanbanBoardMode(mode: KanbanBoardMode): void {
  try {
    localStorage.setItem(CURRENT_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}
