/**
 * 修剪 Gitee Release 历史附件，避免仓库 1GB 附件配额耗尽。
 *
 * 环境变量：
 *   GITEE_TOKEN  - 必填
 *   GITEE_OWNER  - 默认 GenkiDoudou
 *   GITEE_REPO   - 默认 aitodo-desktop
 *   KEEP         - 保留最新 N 个 semver tag 的附件，默认 8
 *   DRY_RUN      - true 时只打印不删除
 */
const https = require('https')
const { URL, URLSearchParams } = require('url')

const owner = process.env.GITEE_OWNER || 'GenkiDoudou'
const repo = process.env.GITEE_REPO || 'aitodo-desktop'
const token = process.env.GITEE_TOKEN
const keepCount = Math.max(1, Number.parseInt(process.env.KEEP || '8', 10) || 8)
const dryRun = /^true|1|yes$/i.test(process.env.DRY_RUN || '')

if (!token) {
  console.error('[prune-gitee-attachments] 缺少 GITEE_TOKEN')
  process.exit(1)
}

const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)(?:[-.+][0-9A-Za-z.-]*)?$/

function apiRequest(method, apiPath, { query, form } = {}) {
  const url = new URL(`https://gitee.com/api/v5${apiPath}`)
  const q = new URLSearchParams(query || {})
  if (!form) q.set('access_token', token)
  for (const [k, v] of q.entries()) url.searchParams.set(k, v)

  let bodyBuf = null
  const headers = { Accept: 'application/json', 'User-Agent': 'aitodo-desktop-release' }
  if (form) {
    const params = new URLSearchParams({ access_token: token, ...form })
    bodyBuf = Buffer.from(params.toString(), 'utf8')
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
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
            resolve(data)
          } else {
            reject(
              new Error(
                `${method} ${apiPath} -> HTTP ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`
              )
            )
          }
        })
      }
    )
    req.on('error', reject)
    if (bodyBuf) req.write(bodyBuf)
    req.end()
  })
}

async function listAllReleases() {
  const all = []
  for (let page = 1; page <= 20; page += 1) {
    const batch = await apiRequest('GET', `/repos/${owner}/${repo}/releases`, {
      query: { page: String(page), per_page: '100', direction: 'desc' }
    })
    if (!Array.isArray(batch) || !batch.length) break
    all.push(...batch)
    if (batch.length < 100) break
  }
  return all
}

function semverKey(tag) {
  const m = SEMVER_TAG.exec(tag)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3]), tag]
}

function sortSemverTags(tags) {
  return tags
    .map(semverKey)
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    .map((x) => x[3])
}

async function listAttachFiles(releaseId) {
  const data = await apiRequest('GET', `/repos/${owner}/${repo}/releases/${releaseId}/attach_files`, {
    query: { per_page: '100' }
  })
  return Array.isArray(data) ? data : []
}

async function deleteAttachFile(releaseId, attachId) {
  await apiRequest('DELETE', `/repos/${owner}/${repo}/releases/${releaseId}/attach_files/${attachId}`)
}

async function main() {
  const releases = await listAllReleases()
  const semverTags = sortSemverTags(releases.map((r) => r.tag_name).filter(Boolean))
  const keepTags = new Set(semverTags.slice(-keepCount))

  console.log(`[prune-gitee-attachments] KEEP=${keepCount} DRY_RUN=${dryRun}`)
  console.log('[prune-gitee-attachments] 保留版本:')
  for (const tag of [...keepTags].sort()) {
    console.log(`  ${tag}`)
  }

  let deleted = 0
  for (const release of releases) {
    const tag = release.tag_name
    if (!tag || keepTags.has(tag)) continue
    const files = await listAttachFiles(release.id)
    if (!files.length) continue
    console.log(`[prune-gitee-attachments] ${tag} (id=${release.id})：${files.length} 个附件`)
    for (const file of files) {
      const label = `${file.name || file.id} (id=${file.id})`
      if (dryRun) {
        console.log(`  [dry-run] 将删除 ${label}`)
        continue
      }
      await deleteAttachFile(release.id, file.id)
      console.log(`  已删除 ${label}`)
      deleted += 1
    }
  }

  if (dryRun) {
    console.log('[prune-gitee-attachments] dry-run 完成，未实际删除')
  } else {
    console.log(`[prune-gitee-attachments] 完成，共删除 ${deleted} 个附件`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
