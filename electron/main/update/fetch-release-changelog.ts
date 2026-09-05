/**
 * 从公开更新仓拉取 Release 列表，作为关于页「更新日志」。
 * 与自动更新一致：仅 GitHub。
 */
import type {
  AppReleaseChangelogItem,
  AppReleaseChangelogResult
} from '@shared/app-update'
import { getUpdateFeedConfig, type UpdateFeedConfig } from './update-feed-config'

export type FetchJsonText = (url: string) => Promise<string>

export interface FetchReleaseChangelogOptions {
  config?: UpdateFeedConfig
  fetchText?: FetchJsonText
  /** 最多条数，默认 10 */
  limit?: number
}

interface RawRelease {
  tag_name?: string
  name?: string | null
  body?: string | null
  published_at?: string | null
  created_at?: string | null
  html_url?: string | null
  url?: string | null
}

function defaultFetchText(url: string): Promise<string> {
  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ai-todo-desktop-changelog'
    }
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return res.text()
  })
}

function normalizeItems(raw: unknown, limit: number): AppReleaseChangelogItem[] {
  if (!Array.isArray(raw)) throw new Error('Release 列表格式无效')
  const items: AppReleaseChangelogItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as RawRelease
    const tag = typeof r.tag_name === 'string' ? r.tag_name.trim() : ''
    if (!tag) continue
    const title =
      typeof r.name === 'string' && r.name.trim() ? r.name.trim() : tag
    const body = typeof r.body === 'string' ? r.body.trim() : ''
    items.push({
      tag,
      title,
      body: body || '（本版本未填写发版说明）',
      publishedAt: r.published_at ?? r.created_at ?? null,
      htmlUrl: r.html_url ?? r.url ?? null
    })
    if (items.length >= limit) break
  }
  return items
}

function githubReleasesApiUrl(config: UpdateFeedConfig, limit: number): string {
  const { owner, repo } = config.github
  return `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}&page=1`
}

/** 拉取更新日志（仅 GitHub Releases） */
export async function fetchReleaseChangelog(
  options: FetchReleaseChangelogOptions = {}
): Promise<AppReleaseChangelogResult> {
  const config = options.config ?? getUpdateFeedConfig()
  const fetchText = options.fetchText ?? defaultFetchText
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 30)
  const url = githubReleasesApiUrl(config, limit)
  const text = await fetchText(url)
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('GitHub Release JSON 解析失败')
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const msg = (parsed as { message?: string }).message
    throw new Error(msg ? `github: ${msg}` : 'GitHub Release 响应无效')
  }
  const items = normalizeItems(parsed, limit)
  if (items.length === 0) throw new Error('GitHub 暂无 Release')
  return { source: 'github', items }
}
