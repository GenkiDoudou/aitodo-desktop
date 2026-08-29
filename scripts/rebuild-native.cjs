/**
 * 将 better-sqlite3 安装为当前 Electron 版本可用的原生二进制。
 *
 * 优先使用 prebuild-install 下载官方预编译包（无需 Visual Studio）。
 * 仅当无匹配预编译包时才回退到 node-gyp 源码编译（Windows 需安装 VS C++ 工作负载）。
 *
 * 注意：勿用 npx 调用 prebuild-install（全局 npm 误配 home/registry 时 npx 会解析到错误路径）。
 */
const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const electronVersion = require('electron/package.json').version

const desktopRoot = path.join(__dirname, '..')
const sqliteDir = path.join(desktopRoot, 'node_modules', 'better-sqlite3')
const nodeBinaryPath = path.join(sqliteDir, 'build', 'Release', 'better_sqlite3.node')
const lockErrorPattern = /EBUSY|EPERM|resource busy|operation not permitted/i

/** npm install --ignore-scripts 会跳过 electron/install.js，导致 electron-vite 报 Electron uninstall */
function ensureElectronBinary() {
  let electronDir
  try {
    electronDir = path.dirname(require.resolve('electron/package.json', { paths: [desktopRoot] }))
  } catch {
    console.error('[rebuild-native] 未找到 electron 包，请先 npm install / pnpm install')
    process.exit(1)
  }

  const pathFile = path.join(electronDir, 'path.txt')
  if (fs.existsSync(pathFile)) {
    const rel = fs.readFileSync(pathFile, 'utf8').trim()
    const exe = path.join(electronDir, 'dist', rel)
    if (rel && fs.existsSync(exe)) {
      return
    }
  }

  const installJs = path.join(electronDir, 'install.js')
  if (!fs.existsSync(installJs)) {
    console.error('[rebuild-native] 缺少 electron/install.js，请重新安装依赖')
    process.exit(1)
  }

  console.log('[rebuild-native] Electron 二进制未就绪，正在执行 install.js 下载…')
  execSync(`${process.execPath} "${installJs}"`, { cwd: electronDir, stdio: 'inherit', shell: true })
}

/** 解析 prebuild-install 可执行入口（desktop 根或 better-sqlite3 嵌套依赖） */
function resolvePrebuildInstallBin() {
  const searchPaths = [desktopRoot, sqliteDir]
  for (const base of searchPaths) {
    try {
      return require.resolve('prebuild-install/bin.js', { paths: [base] })
    } catch {
      /* 继续尝试下一候选路径 */
    }
  }
  return null
}

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

ensureElectronBinary()

const prebuildBin = resolvePrebuildInstallBin()
if (!prebuildBin) {
  console.error(
    '[rebuild-native] 未找到 prebuild-install。\n' +
      '  请先完整安装依赖（跳过 postinstall 避免循环失败）：\n' +
      '    npm install --ignore-scripts\n' +
      '    npm run rebuild:native\n' +
      '  若 npm 报 Unknown user config "home"，请执行：npm config delete home && npm config set registry https://npmmirror.com'
  )
  process.exit(1)
}

const prebuild = spawnSync(
  process.execPath,
  [prebuildBin, '--runtime', 'electron', '--target', electronVersion, '--verbose'],
  { cwd: sqliteDir, env, stdio: 'pipe', encoding: 'utf8' }
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
  execSync('npm rebuild better-sqlite3', {
    stdio: 'pipe',
    cwd: desktopRoot,
    env: {
      ...env,
      npm_config_runtime: 'electron',
      npm_config_target: electronVersion,
      npm_config_disturl: 'https://electronjs.org/headers',
      npm_config_build_from_source: 'true'
    },
    shell: true,
    encoding: 'utf8'
  })
  console.log('[rebuild-native] 源码编译完成')
} catch (err) {
  const rebuildOutput = `${err.stdout ?? ''}\n${err.stderr ?? ''}\n${err.message ?? ''}`
  if (rebuildOutput.trim()) {
    process.stderr.write(rebuildOutput)
  }
  exitWhenLocked('node-gyp rebuild', rebuildOutput)
  throw err
}
