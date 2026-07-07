/**
 * 将 better-sqlite3 安装为当前 Electron 版本可用的原生二进制。
 *
 * 优先使用 prebuild-install 下载官方预编译包（无需 Visual Studio）。
 * 仅当无匹配预编译包时才回退到 node-gyp 源码编译（Windows 需安装 VS C++ 工作负载）。
 */
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const electronVersion = require('electron/package.json').version

const sqliteDir = path.join(__dirname, '..', 'node_modules', 'better-sqlite3')
const nodeBinaryPath = path.join(sqliteDir, 'build', 'Release', 'better_sqlite3.node')
const lockErrorPattern = /EBUSY|EPERM|resource busy|operation not permitted/i

const env = {
  ...process.env,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
  npm_config_disturl: 'https://electronjs.org/headers',
  /** 必须为 false/未设置，否则会跳过预编译包强制本地编译 */
  npm_config_build_from_source: 'false'
}

function hasExistingBinary() {
  try {
    return fs.existsSync(nodeBinaryPath) && fs.statSync(nodeBinaryPath).size > 0
  } catch {
    return false
  }
}

function isLockError(text) {
  return lockErrorPattern.test(String(text))
}

function exitWhenLocked(stage, detail) {
  if (!isLockError(detail)) return false

  if (hasExistingBinary()) {
    console.warn(
      `[rebuild-native] ${stage}：原生模块文件被占用，跳过重建并使用现有二进制。\n` +
        '  若需强制重建，请先完全退出 ai-todo / Electron（含托盘），再执行 npm run rebuild:native'
    )
    process.exit(0)
  }

  console.error(
    `[rebuild-native] ${stage}：无法写入 better_sqlite3.node（文件被占用）。\n` +
      '  请先完全退出 ai-todo / Electron 应用（任务栏与托盘都要关闭），然后重试：\n' +
      '    npm run rebuild:native\n' +
      '    npm run dev'
  )
  process.exit(1)
}

console.log(`[rebuild-native] electron=${electronVersion}, arch=${process.arch}`)

const prebuild = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prebuild-install', '--runtime', 'electron', '--target', electronVersion, '--verbose'],
  { cwd: sqliteDir, env, stdio: 'pipe', shell: true, encoding: 'utf8' }
)

const prebuildOutput = `${prebuild.stdout ?? ''}\n${prebuild.stderr ?? ''}`
if (prebuildOutput.trim()) {
  process.stdout.write(prebuildOutput)
}

if (prebuild.status === 0) {
  console.log('[rebuild-native] prebuild-install 成功（无需本地编译）')
  process.exit(0)
}

if (exitWhenLocked('prebuild-install', prebuildOutput)) {
  return
}

console.warn(
  '[rebuild-native] 未找到匹配的预编译包，尝试源码编译…\n' +
    '  Windows 需安装 Visual Studio「使用 C++ 的桌面开发」工作负载：\n' +
    '  https://github.com/nodejs/node-gyp#on-windows'
)

try {
  execSync(
    `npm rebuild better-sqlite3 --runtime=electron --target=${electronVersion} --disturl=https://electronjs.org/headers`,
    { stdio: 'pipe', env: { ...env, npm_config_build_from_source: 'true' }, shell: true, encoding: 'utf8' }
  )
  console.log('[rebuild-native] 源码编译完成')
} catch (err) {
  const rebuildOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`
  if (rebuildOutput.trim()) {
    process.stderr.write(rebuildOutput)
  }
  exitWhenLocked('node-gyp rebuild', rebuildOutput)
  throw err
}
