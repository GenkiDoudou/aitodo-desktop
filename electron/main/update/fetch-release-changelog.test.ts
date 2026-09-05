import { describe, expect, it } from 'vitest'
import { fetchReleaseChangelog } from './fetch-release-changelog'

describe('fetchReleaseChangelog', () => {
  it('maps GitHub release body', async () => {
    const result = await fetchReleaseChangelog({
      config: {
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        expect(url).toContain('api.github.com')
        return JSON.stringify([
          {
            tag_name: 'v1.2.0',
            name: '1.2.0',
            body: '## 修复\n- 日历滚动',
            published_at: '2026-09-01T00:00:00Z',
            html_url: 'https://github.com/o/r/releases/tag/v1.2.0'
          }
        ])
      }
    })
    expect(result.source).toBe('github')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].tag).toBe('v1.2.0')
    expect(result.items[0].body).toContain('日历滚动')
  })

  it('rejects empty release list', async () => {
    await expect(
      fetchReleaseChangelog({
        config: { github: { owner: 'o', repo: 'r' } },
        fetchText: async () => JSON.stringify([])
      })
    ).rejects.toThrow(/暂无 Release/)
  })
})
