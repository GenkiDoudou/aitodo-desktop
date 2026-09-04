import { describe, expect, it } from 'vitest'

import { DESKTOP_THEME_IDS, themePrimaryColor } from '../src/utils/theme-preferences'

describe('theme-preferences', () => {
  it('only keeps todoPro after theme switcher removal', () => {
    expect(DESKTOP_THEME_IDS).toEqual(['todoPro'])
  })

  it('themePrimaryColor returns Todo Pro blue', () => {
    expect(themePrimaryColor('todoPro')).toBe('#409eff')
  })
})
