import { describe, expect, it } from 'vitest'
import { navListPrefsScopeKey } from '../src/utils/nav-list-preferences'

describe('navListPrefsScopeKey', () => {
  it('keys all / last7days / category / uncategorized', () => {
    expect(navListPrefsScopeKey({ smart: 'all' })).toBe('scope:smart:all')
    expect(navListPrefsScopeKey({ smart: 'last7days' })).toBe('scope:smart:last7days')
    expect(navListPrefsScopeKey({ categoryId: 'c1' })).toBe('scope:cat:c1')
    expect(navListPrefsScopeKey({ categoryId: null })).toBe('scope:uncategorized')
  })

  it('returns null for unsupported smart lists', () => {
    expect(navListPrefsScopeKey({ smart: 'inbox' })).toBeNull()
    expect(navListPrefsScopeKey({ smart: 'done' })).toBeNull()
  })
})
