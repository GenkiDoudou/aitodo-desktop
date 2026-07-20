# aiTodo 桌面客户端

纯本地 Electron 待办应用（Vue3 + Element Plus + better-sqlite3），**无需网络**。

## 环境要求

- Node.js **18+**（推荐 LTS）、npm 9+

Windows 上优先使用 `better-sqlite3` **预编译包**（无需 Visual Studio）。仅当预编译包不可用时才需要安装 [Visual Studio Build Tools](https://github.com/nodejs/node-gyp#on-windows)（「使用 C++ 的桌面开发」工作负载）。

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
npm run build:win    # Windows NSIS 安装包（可选安装目录）
npm run build:mac    # macOS dmg（需在 macOS 上执行）
```

产物输出在 `desktop/dist/`。

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

**桌面增强**：子任务（树形列表、详情内新建子任务、父任务完成约束）已实现，超出《openspec/待办需求.md》v1 最小集，后续 Web/后端可对齐时另行规格化。

## AI 任务解析

- **本地规则**：快捷添加、快捷捕获默认可用本地自然语言解析（不依赖网络）。
- **大模型（可配置）**：设置中可切换是否用 LLM 解析，并编辑「任务提示词」（`systemPrompt` + `userTemplate`）。LLM 失败时回落本地解析。
- **定时汇总**：可选用 LLM 润色（独立于任务解析开关）。

## 明确不包含（当前）

- 登录 / JWT / 后端 HTTP API（云同步方案另见需求规格，尚未落地）
- 云端数据同步（规划中，桌面端仍以本地 SQLite 为主）
- 桌面文件整理 / 桌面围栏（已永久废弃）
