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

| 平台 | 默认路径 |
|---|---|
| Windows | 可执行文件同级 `data/data.db` |
| macOS | `.app` 旁 `ai-todo-data/data.db` |

可在应用 **设置** 中修改数据目录；**v1 需重启后生效**，请按提示手动复制原 `data` 目录内容。

## 架构

- **Renderer**：Vue3 + Pinia + Element Plus，仅通过 `window.api`（IPC）访问数据
- **Main**：better-sqlite3、业务规则、托盘、提醒
- **Preload**：`contextBridge` 白名单

任务状态：`TODO` / `IN_PROGRESS` / `DONE`（与仓库 `AGENTS.md` 一致）。

**桌面增强**：子任务（树形列表、详情内新建子任务、父任务完成约束）已实现，超出《openspec/待办需求.md》v1 最小集，后续 Web/后端可对齐时另行规格化。

## 明确不包含（v1）

- 登录 / JWT / 后端 HTTP API
- 云端数据同步
- AI 一句话（仅灰色占位入口）
