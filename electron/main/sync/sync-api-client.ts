import type {
  SyncLoginRequest,
  SyncLoginResponse,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncStatusResponse
} from '@shared/sync-protocol'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class SyncApiError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message)
    this.name = 'SyncApiError'
  }
}

/**
 * Sync Server HTTP 客户端（仅 Main 进程使用）。
 */
export class SyncApiClient {
  constructor(
    private baseUrl: string,
    private accessToken: string | null = null
  ) {}

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '')
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  async login(dto: SyncLoginRequest): Promise<SyncLoginResponse> {
    return this.request<SyncLoginResponse>('POST', '/api/auth/login', dto, false)
  }

  async push(body: SyncPushRequest): Promise<SyncPushResponse> {
    return this.request<SyncPushResponse>('POST', '/api/sync/push', body, true)
  }

  async pull(cursor: string, limit = 200): Promise<SyncPullResponse> {
    const q = new URLSearchParams({ cursor: cursor || '0', limit: String(limit) })
    return this.request<SyncPullResponse>('GET', `/api/sync/pull?${q}`, undefined, true)
  }

  async status(): Promise<SyncStatusResponse> {
    return this.request<SyncStatusResponse>('GET', '/api/sync/status', undefined, true)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`
    const headers: Record<string, string> = {
      Accept: 'application/json'
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (auth) {
      if (!this.accessToken) {
        throw new SyncApiError('未登录', 401)
      }
      headers.Authorization = `Bearer ${this.accessToken}`
    }

    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000)
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new SyncApiError('同步请求超时', 500)
      }
      throw new SyncApiError(
        err instanceof Error ? `网络错误：${err.message}` : '网络错误',
        500
      )
    }

    let envelope: ApiEnvelope<T>
    try {
      envelope = (await res.json()) as ApiEnvelope<T>
    } catch {
      throw new SyncApiError(`无效响应 HTTP ${res.status}`, res.status)
    }

    if (envelope.code !== 0) {
      throw new SyncApiError(envelope.message || `业务错误 ${envelope.code}`, envelope.code)
    }
    return envelope.data
  }
}
