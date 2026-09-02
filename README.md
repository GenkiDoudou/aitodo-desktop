# aiTodo 桌面客户端

纯本地 Electron 待办应用（Vue3 + Element Plus + better-sqlite3），**默认无需网络**。可选接入自建 Sync Server 做多设备同步（见下方「云同步」）。

## 环境要求

- Node.js **18–22 LTS**（推荐 20/22；**勿用 Node 24+**，原生模块预编译包可能未覆盖）
- npm 9+

若 `npm install` / `rebuild:native` 报 `Unknown user config "home"` 或找不到 `prebuild-install`：

```bash
npm config delete home
npm config set registry https://npmmirror.com
cd desktop
npm install --ignore-scripts
npm run rebuild:native
npm run dev
```

`rebuild:native` 会同时下载 **Electron 二进制** 并安装 **better-sqlite3** 预编译包（使用 `--ignore-scripts` 后必须手动跑一次）。

Windows 上优先使用 **预编译包**（无需 Visual Studio）。仅当预编译不可用时才需 [Visual Studio Build Tools](https://github.com/nodejs/node-gyp#on-windows)（「使用 C++ 的桌面开发」）。

## 开发

```bash
cd desktop
npm install
npm run dev
```

## 测试

```bash
cd desktop
npm test
```

测试在 **Electron 运行时**执行（与 `dev` 相同 ABI），不会再把 `better-sqlite3` 编译成系统 Node 版本。

若启动仍报 `NODE_MODULE_VERSION 108/130` 不匹配：

```bash
cd desktop
npm run rebuild:native   # node scripts/rebuild-native.cjs
npm run dev
```

> `rebuild:native` 通过 `npm rebuild` + Electron headers 编译，兼容常见 Node 18 环境。

## 打包

```bash
cd desktop
npm run build        # 编译 main/preload/renderer
npm run build:win    # Windows：NSIS + zip，并生成 latest-portable.yml
npm run build:mac    # macOS：dmg + zip（需在 macOS 上执行）
```

产物输出在 `desktop/dist/`。

**文档**：[`docs/pages-overview.md`](docs/pages-overview.md)（页面与视图结构）、[`docs/auto-update-release.md`](docs/auto-update-release.md)（自动更新发布）。

### 推送到公开仓并发版（自更新）

仅同步 **desktop/** 到：

- https://github.com/GenkiDoudou/aitodo-desktop
- https://gitee.com/GenkiDoudou/aitodo-desktop

```bash
cd desktop
# 同步已提交的 desktop/（subtree）
pnpm run sync:opensource

# 同步 + 打 v* tag，触发 Actions 打包（客户端即可检查更新）
pnpm run release:opensource
```

详见 [`docs/opensource-subtree.md`](docs/opensource-subtree.md)。

### 自动更新（概要）

- **NSIS / macOS**：`electron-updater` + `latest.yml` / `latest-mac.yml`
- **免解压目录**：`*-win.zip` + `latest-portable.yml`；更新**不会**覆盖同级 `data/`
- 发布到 **Gitee + GitHub Releases**（客户端优先 Gitee，失败回退 GitHub）
- 首版**无代码签名**，可能出现 SmartScreen / Gatekeeper 提示
- 仓库名可用环境变量 `AITODO_UPDATE_GITEE_*` / `AITODO_UPDATE_GITHUB_*` 覆盖

## 数据目录

| 环境 | 默认路径 |
|---|---|
| **开发**（`npm run dev`） | 系统用户数据目录下 `data/data.db`（Windows 一般为 `%APPDATA%/ai-todo-desktop/data/`） |
| Windows 打包 | 可执行文件同级 `data/data.db` |
| macOS 打包 | `.app` 旁 `ai-todo-data/data.db` |

开发模式下数据库**不再**写在 `node_modules/electron` 旁，重启 `npm run dev` 不会丢数据。若你曾在旧版本创建过任务，首次启动会自动尝试从旧路径迁移一次。

可在应用 **设置** 中更改数据目录：会先完整复制库与附件到新目录，成功后再删除原目录业务文件，并自动重启。

## 架构

- **Renderer**：Vue3 + Pinia + Element Plus，仅通过 `window.api`（IPC）访问数据
- **Main**：better-sqlite3、业务规则、托盘、提醒
- **Preload**：`contextBridge` 白名单

任务状态：`TODO` / `IN_PROGRESS` / `DONE`（与仓库 `AGENTS.md` 一致）。

- **列表 / 详情勾选**：二态（完成 ↔ 未完成）；勾选不会把「进行中」单独暴露为中间态。
- **进行中**：通过状态看板拖拽，或详情面板状态下拉设置。

**桌面增强**：子任务（树形列表、详情内新建子任务、父任务完成约束）已实现。

## AI 任务解析

- **本地规则**：快捷添加、快捷捕获默认可用本地自然语言解析（不依赖网络）。
- **大模型（可配置）**：设置中可切换是否用 LLM 解析，并编辑「任务提示词」（`systemPrompt` + `userTemplate`）。LLM 失败时回落本地解析。
- **定时汇总**：可选用 LLM 润色（独立于任务解析开关）。

## 云同步（可选）

默认仍为纯本地。若要多设备同步，需自行部署兼容的 Sync Server（HTTP API + JWT），然后在桌面端「设置 → 账号与同步」填写服务器地址并登录。

未登录时行为与纯本地一致；退出登录后停止自动同步。通知、租约、同步范围等行为见应用内设置说明。

> 本仓库为桌面客户端开源仓；服务端实现可自建，不必与本仓同组织。

## 明确不包含（当前）

- 附件 blob、视图/看板的云同步（后续 Phase）
- 字段级冲突合并 UI / 实时 WebSocket
- 桌面文件整理 / 桌面围栏（已永久废弃）
