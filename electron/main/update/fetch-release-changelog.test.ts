import { describe, expect, it } from 'vitest'
import { fetchReleaseChangelog } from './fetch-release-changelog'

describe('fetchReleaseChangelog', () => {
  it('prefers gitee then maps release body', async () => {
    const result = await fetchReleaseChangelog({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com')) {
          return JSON.stringify([
            {
              tag_name: 'v1.2.0',
              name: '1.2.0',
              body: '## 修复\n- 日历滚动',
              published_at: '2026-09-01T00:00:00Z',
              html_url: 'https://gitee.com/o/r/releases/v1.2.0'
            }
          ])
        }
        throw new Error('should not hit github')
      }
    })
    expect(result.source).toBe('gitee')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].tag).toBe('v1.2.0')
    expect(result.items[0].body).toContain('日历滚动')
  })

  it('falls back to github when gitee fails', async () => {
    const result = await fetchReleaseChangelog({
      config: {
        gitee: { owner: 'o', repo: 'r' },
        github: { owner: 'o', repo: 'r' }
      },
      fetchText: async (url) => {
        if (url.includes('gitee.com')) throw new Error('down')
        return JSON.stringify([
          {
            tag_name: 'v1.0.0',
            name: null,
            body: '',
            published_at: null,
            html_url: 'https://github.com/o/r/releases/tag/v1.0.0'
          }
        ])
      }
    })
    expect(result.source).toBe('github')
    expect(result.items[0].title).toBe('v1.0.0')
    expect(result.items[0].body).toContain('未填写')
  })
})
