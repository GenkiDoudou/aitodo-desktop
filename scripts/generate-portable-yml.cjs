/**
 * 在 electron-builder 产出 Win zip 后生成 latest-portable.yml。
 * 若 zip ≥ 90MB（Gitee 附件上限 100MB），再切分为 .partNN 并写入 part: 列表，
 * 便于 Gitee 分卷上传；完整 zip 仍保留给 GitHub。
 *
 * 用法：node scripts/generate-portable-yml.cjs
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const distDir = path.join(__dirname, '..', 'dist')
const pkg = require('../package.json')
/** 低于 Gitee 100MB 硬限制，留余量 */
const PART_MAX_BYTES = 90 * 1024 * 1024

function findWinZip() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist 不存在: ${distDir}`)
  }
  const names = fs.readdirSync(distDir).filter((n) => /-win\.zip$/i.test(n) || /\.zip$/i.test(n))
  const preferred =
    names.find((n) => n.includes(pkg.version) && /win/i.test(n) && !/\.part\d+$/i.test(n)) ||
    names.find((n) => /win/i.test(n) && n.endsWith('.zip') && !/\.part\d+$/i.test(n)) ||
    names.find((n) => n.endsWith('.zip') && !/mac|darwin/i.test(n) && !/\.part\d+$/i.test(n))
  if (!preferred) {
    throw new Error('未找到 Windows zip 产物，请确认 win.target 包含 zip')
  }
  return preferred
}

function clearOldParts(zipName) {
  const prefix = `${zipName}.part`
  for (const name of fs.readdirSync(distDir)) {
    if (name.startsWith(prefix)) {
      fs.unlinkSync(path.join(distDir, name))
    }
  }
}

/** 按固定字节切分，返回分卷文件名列表（有序） */
function splitIntoParts(zipPath, zipName) {
  clearOldParts(zipName)
  const size = fs.statSync(zipPath).size
  const fd = fs.openSync(zipPath, 'r')
  const parts = []
  let offset = 0
  let index = 1
  try {
    while (offset < size) {
      const chunkSize = Math.min(PART_MAX_BYTES, size - offset)
      const buf = Buffer.alloc(chunkSize)
      fs.readSync(fd, buf, 0, chunkSize, offset)
      const partName = `${zipName}.part${String(index).padStart(2, '0')}`
      fs.writeFileSync(path.join(distDir, partName), buf)
      parts.push(partName)
      offset += chunkSize
      index += 1
    }
  } finally {
    fs.closeSync(fd)
  }
  return parts
}

function main() {
  const zipName = findWinZip()
  const zipPath = path.join(distDir, zipName)
  const buf = fs.readFileSync(zipPath)
  const sha512 = crypto.createHash('sha512').update(buf).digest('base64')
  const size = buf.length

  const lines = [
    `version: ${pkg.version}`,
    `path: ${zipName}`,
    `sha512: ${sha512}`,
    `releaseDate: ${new Date().toISOString()}`
  ]

  if (size >= PART_MAX_BYTES) {
    const parts = splitIntoParts(zipPath, zipName)
    for (const part of parts) {
      lines.push(`part: ${part}`)
    }
    console.log(
      `[generate-portable-yml] zip ${(size / 1024 / 1024).toFixed(1)}MB ≥ 90MB，已分 ${parts.length} 卷供 Gitee 上传`
    )
  } else {
    clearOldParts(zipName)
    console.log(`[generate-portable-yml] zip ${(size / 1024 / 1024).toFixed(1)}MB，无需分卷`)
  }

  lines.push('')
  const out = path.join(distDir, 'latest-portable.yml')
  fs.writeFileSync(out, lines.join('\n'), 'utf8')
  console.log(`[generate-portable-yml] wrote ${out}`)
  console.log(`  path=${zipName}`)
  console.log(`  sha512=${sha512.slice(0, 24)}…`)

  // 供用户从 Gitee 手动获取免解压包：下载脚本体积很小，可随 Release 附件发布
  copyPortableDownloader()
}

function copyPortableDownloader() {
  const scriptsDir = __dirname
  const pairs = [
    ['download-portable-from-gitee.ps1', 'download-portable-from-gitee.ps1'],
    ['下载免解压版.bat', '下载免解压版.bat']
  ]
  for (const [fromName, toName] of pairs) {
    const from = path.join(scriptsDir, fromName)
    const to = path.join(distDir, toName)
    if (!fs.existsSync(from)) {
      console.warn(`[generate-portable-yml] skip missing ${fromName}`)
      continue
    }
    fs.copyFileSync(from, to)
    console.log(`[generate-portable-yml] copied ${toName}`)
  }
}

main()
