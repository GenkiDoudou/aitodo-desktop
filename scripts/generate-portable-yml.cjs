/**
 * 在 electron-builder 产出 Win zip 后生成 latest-portable.yml（完整单包，供 GitHub Release）。
 *
 * 用法：node scripts/generate-portable-yml.cjs
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const distDir = path.join(__dirname, '..', 'dist')
const pkg = require('../package.json')

function findWinZip() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist 不存在: ${distDir}`)
  }
  const names = fs.readdirSync(distDir).filter((n) => /-win\.zip$/i.test(n) || /\.zip$/i.test(n))
  const preferred =
    names.find((n) => /^XiaoQiTodo-.*-win\.zip$/i.test(n) && n.includes(pkg.version)) ||
    names.find((n) => n.includes(pkg.version) && /win/i.test(n) && !/\.part\d+$/i.test(n)) ||
    names.find((n) => /win/i.test(n) && n.endsWith('.zip') && !/\.part\d+$/i.test(n)) ||
    names.find((n) => n.endsWith('.zip') && !/mac|darwin/i.test(n) && !/\.part\d+$/i.test(n))
  if (!preferred) {
    throw new Error('未找到 Windows zip 产物，请确认 win.target 包含 zip')
  }
  return preferred
}

/** 清理历史 Gitee 分卷残留，避免误上传 */
function clearLegacyParts(zipName) {
  const prefix = `${zipName}.part`
  for (const name of fs.readdirSync(distDir)) {
    if (name.startsWith(prefix)) {
      fs.unlinkSync(path.join(distDir, name))
    }
  }
}

function main() {
  const zipName = findWinZip()
  const zipPath = path.join(distDir, zipName)
  clearLegacyParts(zipName)

  const buf = fs.readFileSync(zipPath)
  const sha512 = crypto.createHash('sha512').update(buf).digest('base64')
  const size = buf.length

  const lines = [
    `version: ${pkg.version}`,
    `path: ${zipName}`,
    `sha512: ${sha512}`,
    `releaseDate: ${new Date().toISOString()}`,
    ''
  ]

  const out = path.join(distDir, 'latest-portable.yml')
  fs.writeFileSync(out, lines.join('\n'), 'utf8')
  console.log(
    `[generate-portable-yml] wrote ${out} (${(size / 1024 / 1024).toFixed(1)}MB) path=${zipName}`
  )
}

main()
