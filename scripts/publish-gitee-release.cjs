/**
 * 将 dist/ 产物同步到 Gitee Releases（由 GitHub Actions 调用）。
 *
 * 环境变量：
 *   GITEE_TOKEN  - 私人令牌（projects 权限）
 *   GITEE_OWNER  - 默认 GenkiDoudou
 *   GITEE_REPO   - 默认 aitodo-desktop
 *   RELEASE_TAG  - 如 v1.0.0（默认读 GITHUB_REF_NAME）
 *   DIST_DIR     - 默认 dist
 *
 * 加固：
 *   - 上传前拉取已有附件，同名跳过（便于 CI 安全重跑）
 *   - ECONNRESET 等瞬断错误指数退避重试
 *   - 大文件上传拉长 socket 超时
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL, URLSearchParams } = require('url')

const owner = process.env.GITEE_OWNER || 'GenkiDoudou'
const repo = process.env.GITEE_REPO || 'aitodo-desktop'
const token = process.env.GITEE_TOKEN
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || ''
const distDir = path.resolve(process.env.DIST_DIR || path.join(__dirname, '..', 'dist'))

if (!token) {
  console.error('[publish-gitee-release] 缺少 GITEE_TOKEN')
  process.exit(1)
}
if (!tag) {
  console.error('[publish-gitee-release] 缺少 RELEASE_TAG / GITHUB_REF_NAME')
  process.exit(1)
}

const ASSET_PATTERNS = [
  /\.exe$/i,
  /\.blockmap$/i,
  /\.yml$/i,
  /\.zip$/i,
  /\.part\d+$/i,
  /\.ps1$/i,
  /\.bat$/i
]

/** Gitee 附件硬限制 100MB，低于此值才上传 */
const GITEE_MAX_UPLOAD_BYTES = 95 * 1024 * 1024

/** 发布前保留的最新 semver 版本数（更早版本的附件会被修剪；默认 3，避免 1GB 配额被历史 Setup/分卷撑满） */
const DEFAULT_KEEP_RELEASES = Number.parseInt(process.env.GITEE_KEEP_RELEASES || '3', 10) || 3

/** 瞬断重试次数（不含首次） */
const UPLOAD_RETRY_MAX = Number.parseInt(process.env.GITEE_UPLOAD_RETRIES || '3', 10) || 3

/** 首次退避毫秒；之后 2x（上限 30s） */
const UPLOAD_RETRY_BASE_MS = Number.parseInt(process.env.GITEE_UPLOAD_RETRY_MS || '2000', 10) || 2000

/** 单次上传 socket 超时（毫秒），大文件默认 15 分钟 */
const UPLOAD_TIMEOUT_MS = Number.parseInt(process.env.GITEE_UPLOAD_TIMEOUT_MS || String(15 * 60 * 1000), 10)

function isQuotaError(message) {
  return /附件配额|1\s*GB|quota|超出仓库/i.test(message)
}

function isOversizeError(message) {
  return /100\s*MB|超出限制|file size/i.test(message)
}

/** 可重试的网络瞬断（含 Node syscall code 与常见文案） */
function isTransientNetworkError(err) {
  if (!err) return false
  const code = err.code || ''
  if (
    /^(ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|ERR_SOCKET_CONNECTION_TIMEOUT)$/.test(
      code
    )
  ) {
    return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /ECONNRESET|ETIMEDOUT|socket hang up|TLSWrap|network|temporarily unavailable|Gateway Time-out|502|503|504/i.test(
    msg
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 对异步操作做有限次重试；仅瞬断类错误重试，其它错误立即抛出。
 * @param {string} label 日志前缀
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withRetry(label, fn) {
  let lastErr
  for (let attempt = 0; attempt <= UPLOAD_RETRY_MAX; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const retryable = isTransientNetworkError(err)
      if (!retryable || attempt >= UPLOAD_RETRY_MAX) throw err
      const delay = Math.min(UPLOAD_RETRY_BASE_MS * 2 ** attempt, 30_000)
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `[publish-gitee-release] ${label} 瞬断（${msg}），${delay}ms 后重试 ${attempt + 1}/${UPLOAD_RETRY_MAX}`
      )
      await sleep(delay)
    }
  }
  throw lastErr
}

function listAssets() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist 不存在: ${distDir}`)
  }
  return fs
    .readdirSync(distDir)
    .filter((name) => ASSET_PATTERNS.some((re) => re.test(name)))
    .map((name) => path.join(distDir, name))
    .filter((p) => fs.statSync(p).isFile())
}

async function pruneOldAttachmentsBestEffort() {
  try {
    const { spawnSync } = require('child_process')
    const script = path.join(__dirname, 'prune-gitee-attachments.cjs')
    console.log(
      `[publish-gitee-release] 发布前修剪旧版附件（保留最新 ${DEFAULT_KEEP_RELEASES} 个版本）…`
    )
    const result = spawnSync(process.execPath, [script], {
      env: {
        ...process.env,
        GITEE_OWNER: owner,
        GITEE_REPO: repo,
        GITEE_TOKEN: token,
        KEEP: String(DEFAULT_KEEP_RELEASES),
        DRY_RUN: 'false'
      },
      stdio: 'inherit'
    })
    if (result.status !== 0) {
      console.warn('[publish-gitee-release] 修剪旧附件失败（继续尝试上传）')
    }
  } catch (err) {
    console.warn('[publish-gitee-release] 修剪旧附件异常（继续尝试上传）:', err)
  }
}

function shouldUpload(filePath) {
  const size = fs.statSync(filePath).size
  if (size >= GITEE_MAX_UPLOAD_BYTES) {
    console.warn(
      `[publish-gitee-release] skip ${path.basename(filePath)} (${(size / 1024 / 1024).toFixed(1)}MB ≥ 95MB，请使用分卷 .part*)`
    )
    return false
  }
  return true
}

function apiRequest(method, apiPath, { query, form, json } = {}) {
  const url = new URL(`https://gitee.com/api/v5${apiPath}`)
  const q = new URLSearchParams(query || {})
  if (!form && !json) {
    q.set('access_token', token)
  }
  for (const [k, v] of q.entries()) {
    url.searchParams.set(k, v)
  }

  let bodyBuf = null
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'aitodo-desktop-release'
  }

  if (form) {
    const params = new URLSearchParams({ access_token: token, ...form })
    bodyBuf = Buffer.from(params.toString(), 'utf8')
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    headers['Content-Length'] = bodyBuf.length
  } else if (json) {
    bodyBuf = Buffer.from(JSON.stringify({ access_token: token, ...json }), 'utf8')
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = bodyBuf.length
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let data = text
          try {
            data = text ? JSON.parse(text) : null
          } catch {
            /* keep text */
          }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data })
          } else {
            reject(
              new Error(
                `${method} ${url.pathname} -> HTTP ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
              )
            )
          }
        })
      }
    )
    req.setTimeout(60_000, () => {
      req.destroy(Object.assign(new Error('apiRequest timeout'), { code: 'ETIMEDOUT' }))
    })
    req.on('error', reject)
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

async function ensureRelease() {
  try {
    const existing = await withRetry(`GET release ${tag}`, () =>
      apiRequest('GET', `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`)
    )
    if (existing.data && existing.data.id) {
      console.log(`[publish-gitee-release] 已有 Release id=${existing.data.id}`)
      return existing.data.id
    }
  } catch {
    /* create below */
  }

  const created = await withRetry(`POST release ${tag}`, () =>
    apiRequest('POST', `/repos/${owner}/${repo}/releases`, {
      form: {
        tag_name: tag,
        name: tag,
        body: `Desktop release ${tag}`,
        target_commitish: 'main',
        prerelease: 'false'
      }
    })
  )
  console.log(`[publish-gitee-release] 已创建 Release id=${created.data.id}`)
  return created.data.id
}

/** 拉取 Release 已有附件文件名集合（同名则跳过上传，避免重跑重复） */
async function listExistingAttachNames(releaseId) {
  const names = new Set()
  try {
    const { data } = await withRetry(`GET attach_files ${releaseId}`, () =>
      apiRequest('GET', `/repos/${owner}/${repo}/releases/${releaseId}/attach_files`, {
        query: { per_page: '100' }
      })
    )
    const list = Array.isArray(data) ? data : []
    for (const item of list) {
      if (item && item.name) names.add(String(item.name))
    }
    console.log(`[publish-gitee-release] Release 已有附件 ${names.size} 个`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[publish-gitee-release] 无法列出已有附件（将全部尝试上传）: ${msg}`)
  }
  return names
}

function uploadFileOnce(releaseId, filePath) {
  const boundary = '----AitodoBoundary' + Date.now()
  const fileName = path.basename(filePath)
  const fileBuf = fs.readFileSync(filePath)
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="access_token"\r\n\r\n${token}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([prefix, fileBuf, suffix])

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'gitee.com',
        path: `/api/v5/repos/${owner}/${repo}/releases/${releaseId}/attach_files`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          Accept: 'application/json',
          'User-Agent': 'aitodo-desktop-release'
        }
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[publish-gitee-release] uploaded ${fileName}`)
            resolve(text)
          } else {
            // 5xx 视为可重试
            const err = new Error(`upload ${fileName} -> HTTP ${res.statusCode}: ${text}`)
            if (res.statusCode && res.statusCode >= 500) {
              err.code = 'ECONNRESET'
            }
            reject(err)
          }
        })
      }
    )
    req.setTimeout(UPLOAD_TIMEOUT_MS, () => {
      req.destroy(Object.assign(new Error(`upload ${fileName} timeout after ${UPLOAD_TIMEOUT_MS}ms`), { code: 'ETIMEDOUT' }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function uploadFile(releaseId, filePath) {
  const fileName = path.basename(filePath)
  await withRetry(`upload ${fileName}`, () => uploadFileOnce(releaseId, filePath))
}

async function main() {
  await pruneOldAttachmentsBestEffort()

  const assets = listAssets()
  if (!assets.length) {
    throw new Error('dist 下没有可上传的 exe/zip/yml/blockmap/part')
  }
  const uploadList = assets.filter(shouldUpload)
  if (!uploadList.length) {
    throw new Error('没有可上传到 Gitee 的文件（全部超过 95MB？请确认已生成 .part 分卷）')
  }
  console.log(
    `[publish-gitee-release] tag=${tag} upload=${uploadList.length}/${assets.length}`
  )
  const releaseId = await ensureRelease()
  const existingNames = await listExistingAttachNames(releaseId)

  let ok = 0
  let skipped = 0
  let failed = 0
  for (const file of uploadList) {
    const base = path.basename(file)
    if (existingNames.has(base)) {
      console.log(`[publish-gitee-release] skip existing ${base}`)
      skipped += 1
      ok += 1
      continue
    }
    try {
      await uploadFile(releaseId, file)
      existingNames.add(base)
      ok += 1
    } catch (err) {
      failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      if (isOversizeError(msg)) {
        console.warn(`[publish-gitee-release] skip oversized ${base}: ${msg}`)
        continue
      }
      if (isQuotaError(msg)) {
        console.warn(`[publish-gitee-release] skip quota ${base}: ${msg}`)
        continue
      }
      throw err
    }
  }
  if (ok === 0) {
    throw new Error('Gitee 没有成功上传任何附件')
  }
  const partFailed = uploadList.some((p) => /\.part\d+$/i.test(p) && failed > 0)
  if (failed > 0) {
    console.warn(
      `[publish-gitee-release] 有 ${failed} 个附件未上传（多为配额或单文件 100MB 限制）。` +
        ' 可在本地运行 node scripts/prune-gitee-attachments.cjs 后重试，或到 Gitee Release 手动清理旧版附件。'
    )
  }
  console.log(
    `[publish-gitee-release] done ok=${ok} skipped=${skipped} failed=${failed}`
  )
  if (partFailed && ok > 0) {
    console.warn(
      '[publish-gitee-release] 分卷未全部上传：Gitee 免解压包可能不可用，GitHub Release 仍有完整 zip。'
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
