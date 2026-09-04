/**
 * 从公开更新仓拉取 Release 列表，作为关于页「更新日志」。
 * 策略与自动更新一致：优先 Gitee，失败再 GitHub。
 */
import type {
  AppReleaseChangelogItem,
  AppReleaseChangelogResult,
  UpdateFeedSource
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
  /** Gitee 部分接口用 url 字段 */
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

function releasesApiUrl(source: UpdateFeedSource, config: UpdateFeedConfig, limit: number): string {
  if (source === 'gitee') {
    const { owner, repo } = config.gitee
    return `https://gitee.com/api/v5/repos/${owner}/${repo}/releases?per_page=${limit}&page=1`
  }
  const { owner, repo } = config.github
  return `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}&page=1`
}

async function fetchFrom(
  source: UpdateFeedSource,
  config: UpdateFeedConfig,
  fetchText: FetchJsonText,
  limit: number
): Promise<AppReleaseChangelogResult> {
  const url = releasesApiUrl(source, config, limit)
  const text = await fetchText(url)
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error(`${source} Release JSON 解析失败`)
  }
  // Gitee 偶发返回 { message } 错误对象
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const msg = (parsed as { message?: string }).message
    throw new Error(msg ? `${source}: ${msg}` : `${source} Release 响应无效`)
  }
  const items = normalizeItems(parsed, limit)
  if (items.length === 0) throw new Error(`${source} 暂无 Release`)
  return { source, items }
}

/** 拉取更新日志：Gitee → GitHub */
export async function fetchReleaseChangelog(
  options: FetchReleaseChangelogOptions = {}
): Promise<AppReleaseChangelogResult> {
  const config = options.config ?? getUpdateFeedConfig()
  const fetchText = options.fetchText ?? defaultFetchText
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 30)
  const errors: string[] = []

  try {
    return await fetchFrom('gitee', config, fetchText, limit)
  } catch (err) {
    errors.push(`gitee: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    return await fetchFrom('github', config, fetchText, limit)
  } catch (err) {
    errors.push(`github: ${err instanceof Error ? err.message : String(err)}`)
  }

  throw new Error(`无法获取更新日志：${errors.join(' | ')}`)
}
