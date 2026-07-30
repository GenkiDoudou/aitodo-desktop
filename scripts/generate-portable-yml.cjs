/**
 * 在 electron-builder 产出 Win zip 后生成 latest-portable.yml，
 * 供免解压目录版自动更新使用。
 *
 * 用法：node scripts/generate-portable-yml.cjs
 * 通常由 npm run build:win 末尾调用。
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
  // 优先匹配 builder 默认带版本的 zip；排除 mac
  const preferred =
    names.find((n) => n.includes(pkg.version) && /win/i.test(n)) ||
    names.find((n) => /win/i.test(n) && n.endsWith('.zip')) ||
    names.find((n) => n.endsWith('.zip') && !/mac|darwin/i.test(n))
  if (!preferred) {
    throw new Error('未找到 Windows zip 产物，请确认 win.target 包含 zip')
  }
  return preferred
}

function main() {
  const zipName = findWinZip()
  const zipPath = path.join(distDir, zipName)
  const buf = fs.readFileSync(zipPath)
  const sha512 = crypto.createHash('sha512').update(buf).digest('base64')
  const yml = [
    `version: ${pkg.version}`,
    `path: ${zipName}`,
    `sha512: ${sha512}`,
    `releaseDate: ${new Date().toISOString()}`,
    ''
  ].join('\n')
  const out = path.join(distDir, 'latest-portable.yml')
  fs.writeFileSync(out, yml, 'utf8')
  console.log(`[generate-portable-yml] wrote ${out}`)
  console.log(`  path=${zipName}`)
  console.log(`  sha512=${sha512.slice(0, 24)}…`)
}

main()
