/**
 * 将 better-sqlite3 安装为当前 Electron 版本可用的原生二进制。
 *
 * 优先使用 prebuild-install 下载官方预编译包（无需 Visual Studio）。
 * 仅当无匹配预编译包时才回退到 node-gyp 源码编译（Windows 需安装 VS C++ 工作负载）。
 */
const { execSync, spawnSync } = require('child_process')
const path = require('path')
const electronVersion = require('electron/package.json').version

const sqliteDir = path.join(__dirname, '..', 'node_modules', 'better-sqlite3')

const env = {
  ...process.env,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
  npm_config_disturl: 'https://electronjs.org/headers',
  /** 必须为 false/未设置，否则会跳过预编译包强制本地编译 */
  npm_config_build_from_source: 'false'
}

console.log(`[rebuild-native] electron=${electronVersion}, arch=${process.arch}`)

const prebuild = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prebuild-install', '--runtime', 'electron', '--target', electronVersion, '--verbose'],
  { cwd: sqliteDir, env, stdio: 'inherit', shell: true }
)

if (prebuild.status === 0) {
  console.log('[rebuild-native] prebuild-install 成功（无需本地编译）')
  process.exit(0)
}

console.warn(
  '[rebuild-native] 未找到匹配的预编译包，尝试源码编译…\n' +
    '  Windows 需安装 Visual Studio「使用 C++ 的桌面开发」工作负载：\n' +
    '  https://github.com/nodejs/node-gyp#on-windows'
)

execSync(
  `npm rebuild better-sqlite3 --runtime=electron --target=${electronVersion} --disturl=https://electronjs.org/headers`,
  { stdio: 'inherit', env: { ...env, npm_config_build_from_source: 'true' }, shell: true }
)

console.log('[rebuild-native] 源码编译完成')
