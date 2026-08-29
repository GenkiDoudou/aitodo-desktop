import type {
  SyncLoginRequest,
  SyncLoginResponse,
  SyncRegisterRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncStatusResponse
} from '@shared/sync-protocol'
import { buildObfuscatedBasicAuthorization } from '@shared/oauth-client-basic'
import { type ApiEnvelope, readApiEnvelopeError } from './api-envelope'

/** quickboot 管理端 R<T> 信封（登录/注册成功 code=200） */
interface REnvelope<T> {
  code: number
  msg?: string
  data: T
}

interface LoginTokenVo {
  accessToken: string
  tokenName?: string
}

interface AuthMeVo {
  userId?: string
  username?: string
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
 * 登录/注册走 {@code POST /login|/register}（R 信封 code=200 + OAuth Basic）；
 * sync/notify 仍走 {@code /api/**}（DesktopApiResponse code=0 + Bearer）。
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
    const tokenVo = await this.requestR<LoginTokenVo>('POST', '/login', dto, { oauth: true })
    return this.finalizeAuthSession(tokenVo.accessToken)
  }

  /** 自注册；成功后与 login 相同：签发 token 并拉取 /auth/me。 */
  async register(dto: SyncRegisterRequest): Promise<SyncLoginResponse> {
    const tokenVo = await this.requestR<LoginTokenVo>('POST', '/register', dto, { oauth: true })
    return this.finalizeAuthSession(tokenVo.accessToken)
  }

  async push(body: SyncPushRequest): Promise<SyncPushResponse> {
    return this.requestDesktop<SyncPushResponse>('POST', '/api/sync/push', body, true)
  }

  async pull(cursor: string, limit = 200): Promise<SyncPullResponse> {
    const q = new URLSearchParams({ cursor: cursor || '0', limit: String(limit) })
    return this.requestDesktop<SyncPullResponse>('GET', `/api/sync/pull?${q}`, undefined, true)
  }

  async status(): Promise<SyncStatusResponse> {
    return this.requestDesktop<SyncStatusResponse>('GET', '/api/sync/status', undefined, true)
  }

  /** 登录/注册后补全 userId、username（LoginController 仅返回 token）。 */
  private async finalizeAuthSession(accessToken: string): Promise<SyncLoginResponse> {
    this.setAccessToken(accessToken)
    const me = await this.requestR<AuthMeVo>('GET', '/auth/me', undefined, { bearer: true })
    return {
      accessToken,
      userId: me.userId ?? '',
      username: me.username ?? ''
    }
  }

  /** R<T> 协议：code===200 为成功。 */
  private async requestR<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { oauth?: boolean; bearer?: boolean } = {}
  ): Promise<T> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}${path}`
    const headers: Record<string, string> = {
      Accept: 'application/json'
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }
    if (opts.bearer) {
      if (!this.accessToken) {
        throw new SyncApiError('未登录', 401)
      }
      headers.Authorization = `Bearer ${this.accessToken}`
    } else if (opts.oauth) {
      const basic = buildObfuscatedBasicAuthorization()
      if (!basic) {
        throw new SyncApiError('未配置 OAuth 客户端凭证', 500)
      }
      headers.Authorization = basic
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

    let envelope: REnvelope<T>
    try {
      envelope = (await res.json()) as REnvelope<T>
    } catch {
      throw new SyncApiError(`无效响应 HTTP ${res.status}`, res.status)
    }

    if (envelope.code !== 200) {
      const text = envelope.msg?.trim()
      throw new SyncApiError(text || `业务错误 ${envelope.code}`, envelope.code)
    }
    return envelope.data
  }

  /** DesktopApiResponse 协议：code===0 为成功。 */
  private async requestDesktop<T>(
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
      throw new SyncApiError(readApiEnvelopeError(envelope), envelope.code)
    }
    return envelope.data
  }
}
