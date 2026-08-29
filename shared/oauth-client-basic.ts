/**
 * OAuth 客户端凭证混淆与 Basic Authorization 构造。
 * 与 quick-ui / quick-h5 对齐：XOR + Base64Url，避免明文 clientId:secret 出现在请求头。
 */

/** 与后端 qc.oauth.key 一致的 XOR 密钥 */
const XOR_KEY = new TextEncoder().encode('QuickBootOAuth1')

/** Flyway V39 种子；可通过环境变量覆盖（Electron Main 进程读取 process.env） */
const DEFAULT_CLIENT_ID = 'ai-todo-desktop'
const DEFAULT_CLIENT_SECRET = 'ai-todo-desktop-secret'

function xorBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]! ^ XOR_KEY[i % XOR_KEY.length]!
  }
  return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/** 将明文凭证（如 clientId:secret）混淆为 Base64Url 字符串 */
export function obfuscateCredential(plain: string): string {
  return bytesToBase64Url(xorBytes(new TextEncoder().encode(plain)))
}

/**
 * 构造 `Authorization: Basic …` 请求头值。
 * 优先使用入参，否则读 SYNC_OAUTH_CLIENT_* / VITE_OAUTH_CLIENT_* 环境变量。
 */
export function buildObfuscatedBasicAuthorization(
  clientId?: string,
  clientSecret?: string
): string | null {
  const env = typeof process !== 'undefined' ? process.env : undefined
  const id =
    clientId ??
    env?.SYNC_OAUTH_CLIENT_ID ??
    env?.VITE_OAUTH_CLIENT_ID ??
    DEFAULT_CLIENT_ID
  const secret =
    clientSecret ??
    env?.SYNC_OAUTH_CLIENT_SECRET ??
    env?.VITE_OAUTH_CLIENT_SECRET ??
    DEFAULT_CLIENT_SECRET
  if (!id || !secret) {
    return null
  }
  return 'Basic ' + obfuscateCredential(`${id}:${secret}`)
}
