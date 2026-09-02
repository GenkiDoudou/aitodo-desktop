import {
  DESIGN_LIST_CATEGORIES,
  DESIGN_SIDEBAR_VIEWS
} from '@shared/design-sidebar-presets'
import type { useCategoryStore } from '@/stores/category-store'
import type { useViewStore } from '@/stores/view-store'

const BOOTSTRAP_KEY = 'aitodo_design_bootstrap_v1'

type CategoryStore = ReturnType<typeof useCategoryStore>
type ViewStore = ReturnType<typeof useViewStore>

/**
 * 首次启动补齐设计稿侧栏预设：清单（工作/项目/学习/生活）与「我的视图」四项。
 * 仅补缺，不覆盖用户已有同名项。
 */
export async function ensureDesignBootstrap(
  categoryStore: CategoryStore,
  viewStore: ViewStore
): Promise<void> {
  try {
    if (localStorage.getItem(BOOTSTRAP_KEY)) return
  } catch {
    return
  }

  const existingCatNames = new Set(categoryStore.categories.map((c) => c.name))
  for (const preset of DESIGN_LIST_CATEGORIES) {
    if (!existingCatNames.has(preset.name)) {
      await categoryStore.create(preset.name, { color: preset.color })
    }
  }

  await viewStore.load()
  const existingViewNames = new Set(viewStore.items.map((v) => v.name))
  for (const preset of DESIGN_SIDEBAR_VIEWS) {
    if (!existingViewNames.has(preset.name)) {
      await viewStore.create(preset)
    }
  }

  try {
    localStorage.setItem(BOOTSTRAP_KEY, '1')
  } catch {
    /* ignore */
  }
}
