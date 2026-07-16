import { describe, expect, it } from 'vitest'
import { DESKTOP_THEME_IDS, themePrimaryColor } from '../src/utils/theme-preferences'

describe('theme-preferences', () => {
  it('has seven themes with claude default', () => {
    expect(DESKTOP_THEME_IDS).toHaveLength(7)
    expect(DESKTOP_THEME_IDS).toContain('claude')
  })

  it('themePrimaryColor returns brand color', () => {
    expect(themePrimaryColor('claude')).toBe('#cc785c')
    expect(themePrimaryColor('airbnb')).toBe('#ff385c')
    expect(themePrimaryColor('notion')).toBe('#0075de')
  })
})
