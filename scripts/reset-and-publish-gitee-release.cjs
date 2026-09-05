/**
 * 针对同一版本号重置 Gitee Release 后再上传（解决同名重发 / 配额占满后补传）。
 *
 * 流程：
 *   1. 删除该 tag 对应 Release 上的全部附件（立刻腾配额）
 *   2. 删除该 Release
 *   3. 尽力删除远端 git tag（Gitee API；失败仅警告）
 *   4. 可选：修剪其它旧版附件（KEEP_OTHERS，默认 3）
 *   5. 除非 SKIP_PUBLISH=true，否则调用 publish-gitee-release.cjs
 *
 * 环境变量：
 *   GITEE_TOKEN     - 必填
 *   RELEASE_TAG     - 必填，如 v1.0.9（也可用 GITHUB_REF_NAME）
 *   GITEE_OWNER     - 默认 GenkiDoudou
 *   GITEE_REPO      - 默认 aitodo-desktop
 *   KEEP_OTHERS     - 重置后仍保留的其它最新版本附件数，默认 3；0=不修剪其它
 *   DRY_RUN         - true 只打印不删除、不上传
 *   SKIP_PUBLISH    - true 只重置，不调用 publish
 *   DIST_DIR        - 传给 publish（默认 dist）
 *
 * 示例：
 *   $env:GITEE_TOKEN="…"
 *   $env:RELEASE_TAG="v1.0.9"
 *   $env:DRY_RUN="true"
 *   node scripts/reset-and-publish-gitee-release.cjs
 *   $env:DRY_RUN="false"
 *   node scripts/reset-and-publish-gitee-release.cjs
 */
const path = require('path')
const https = require('https')
const { spawnSync } = require('child_process')
const { URL, URLSearchParams } = require('url')

const owner = process.env.GITEE_OWNER || 'GenkiDoudou'
const repo = process.env.GITEE_REPO || 'aitodo-desktop'
const token = process.env.GITEE_TOKEN
const tag = (process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || '').trim()
const keepOthers = Math.max(0, Number.parseInt(process.env.KEEP_OTHERS || '3', 10) || 0)
const dryRun = /^true|1|yes$/i.test(process.env.DRY_RUN || '')
const skipPublish = /^true|1|yes$/i.test(process.env.SKIP_PUBLISH || '')

if (!token) {
  console.error('[reset-and-publish-gitee-release] 缺少 GITEE_TOKEN')
  process.exit(1)
}
if (!tag) {
  console.error('[reset-and-publish-gitee-release] 缺少 RELEASE_TAG / GITHUB_REF_NAME')
  process.exit(1)
}

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
            resolve({ status: res.statusCode, data })
          } else if (res.statusCode === 404) {
            resolve({ status: 404, data })
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

async function findReleaseByTag(releaseTag) {
  const { status, data } = await apiRequest(
    'GET',
    `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(releaseTag)}`
  )
  if (status === 404 || !data || !data.id) return null
  return data
}

async function listAttachFiles(releaseId) {
  const { data } = await apiRequest('GET', `/repos/${owner}/${repo}/releases/${releaseId}/attach_files`, {
    query: { per_page: '100' }
  })
  return Array.isArray(data) ? data : []
}

async function deleteAttachFile(releaseId, attachId) {
  await apiRequest('DELETE', `/repos/${owner}/${repo}/releases/${releaseId}/attach_files/${attachId}`)
}

async function deleteRelease(releaseId) {
  await apiRequest('DELETE', `/repos/${owner}/${repo}/releases/${releaseId}`)
}

/**
 * 尽力删除远端 tag。Gitee 可能提供 tags 或 git/refs 路径，任一成功即可。
 * 删 tag 不是腾配额的必要条件（附件删掉即可），失败只警告。
 */
async function deleteRemoteTagBestEffort(releaseTag) {
  const candidates = [
    `/repos/${owner}/${repo}/tags/${encodeURIComponent(releaseTag)}`,
    `/repos/${owner}/${repo}/git/refs/tags/${encodeURIComponent(releaseTag)}`
  ]
  for (const apiPath of candidates) {
    try {
      const { status } = await apiRequest('DELETE', apiPath)
      if (status === 404) continue
      console.log(`[reset-and-publish-gitee-release] 已删除远端 tag（${apiPath}）`)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[reset-and-publish-gitee-release] 删除 tag 尝试失败 ${apiPath}: ${msg}`)
    }
  }
  console.warn(
    '[reset-and-publish-gitee-release] 未能通过 API 删除远端 tag（可手动在 Gitee 删 tag；publish 创建 Release 时仍可用同名 tag）'
  )
  return false
}

/** 重置指定 tag：附件 → Release → tag */
async function resetTargetRelease(releaseTag) {
  const release = await findReleaseByTag(releaseTag)
  if (!release) {
    console.log(`[reset-and-publish-gitee-release] 无已有 Release：${releaseTag}（跳过删除）`)
    return { deletedFiles: 0, deletedRelease: false }
  }

  console.log(
    `[reset-and-publish-gitee-release] 找到 Release id=${release.id} tag=${release.tag_name}`
  )
  const files = await listAttachFiles(release.id)
  console.log(`[reset-and-publish-gitee-release] 附件 ${files.length} 个`)

  let deletedFiles = 0
  for (const file of files) {
    const label = `${file.name || file.id} (id=${file.id})`
    if (dryRun) {
      console.log(`  [dry-run] 将删除附件 ${label}`)
      continue
    }
    await deleteAttachFile(release.id, file.id)
    console.log(`  已删除附件 ${label}`)
    deletedFiles += 1
  }

  if (dryRun) {
    console.log(`  [dry-run] 将删除 Release id=${release.id}`)
  } else {
    await deleteRelease(release.id)
    console.log(`[reset-and-publish-gitee-release] 已删除 Release id=${release.id}`)
  }

  if (dryRun) {
    console.log(`  [dry-run] 将尝试删除远端 tag ${releaseTag}`)
  } else {
    await deleteRemoteTagBestEffort(releaseTag)
  }

  return { deletedFiles, deletedRelease: !dryRun }
}

async function pruneOthersBestEffort() {
  if (keepOthers <= 0) {
    console.log('[reset-and-publish-gitee-release] KEEP_OTHERS=0，跳过修剪其它版本')
    return
  }
  const script = path.join(__dirname, 'prune-gitee-attachments.cjs')
  console.log(
    `[reset-and-publish-gitee-release] 修剪其它旧版附件（KEEP=${keepOthers} DRY_RUN=${dryRun}）…`
  )
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      GITEE_OWNER: owner,
      GITEE_REPO: repo,
      GITEE_TOKEN: token,
      KEEP: String(keepOthers),
      DRY_RUN: dryRun ? 'true' : 'false'
    },
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    console.warn('[reset-and-publish-gitee-release] 修剪其它版本失败（继续）')
  }
}

function runPublish() {
  const script = path.join(__dirname, 'publish-gitee-release.cjs')
  console.log('[reset-and-publish-gitee-release] 开始 publish…')
  const result = spawnSync(process.execPath, [script], {
    env: {
      ...process.env,
      GITEE_OWNER: owner,
      GITEE_REPO: repo,
      GITEE_TOKEN: token,
      RELEASE_TAG: tag,
      /** 重置后发布：再修剪时保留较少版本，避免立刻再次撑满 1GB */
      GITEE_KEEP_RELEASES: process.env.GITEE_KEEP_RELEASES || String(Math.max(keepOthers, 3))
    },
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

async function main() {
  console.log(
    `[reset-and-publish-gitee-release] tag=${tag} DRY_RUN=${dryRun} SKIP_PUBLISH=${skipPublish} KEEP_OTHERS=${keepOthers}`
  )

  const { deletedFiles, deletedRelease } = await resetTargetRelease(tag)
  console.log(
    `[reset-and-publish-gitee-release] 目标版本：deletedFiles=${deletedFiles} deletedRelease=${deletedRelease}`
  )

  await pruneOthersBestEffort()

  if (dryRun) {
    console.log('[reset-and-publish-gitee-release] dry-run 结束，未实际上传')
    return
  }
  if (skipPublish) {
    console.log('[reset-and-publish-gitee-release] SKIP_PUBLISH=true，重置完成')
    return
  }
  runPublish()
  console.log('[reset-and-publish-gitee-release] 完成')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
