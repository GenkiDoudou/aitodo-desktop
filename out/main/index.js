"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const BetterSqlite3 = require("better-sqlite3");
const fs = require("fs");
const uuid = require("uuid");
const dayjs = require("dayjs");
const node_fs = require("node:fs");
const node_path = require("node:path");
const url = require("url");
const electronUpdater = require("electron-updater");
const extractZip = require("extract-zip");
const crypto = require("crypto");
const SHORTCUT_ACTIONS = [
  {
    id: "showWindow",
    category: "global",
    label: "显示主窗口",
    description: "显示或隐藏主窗口（再次按下缩小到托盘）",
    defaultAccelerator: "Mod+Shift+A",
    globalWhenHidden: true
  },
  {
    id: "toggleWidget",
    category: "global",
    label: "打开/隐藏挂件",
    description: "切换任务挂件展开/收起（展开时失焦可自动收回边缘）",
    defaultAccelerator: "Mod+Shift+W",
    globalWhenHidden: true
  },
  {
    id: "quickCapture",
    category: "global",
    label: "快捷任务输入",
    description: "打开全局任务输入条，回车快速保存到收件箱",
    defaultAccelerator: "Mod+Shift+Space",
    globalWhenHidden: true
  },
  {
    id: "newTask",
    category: "global",
    label: "新建任务",
    description: "打开任务详情面板创建新任务",
    defaultAccelerator: "Mod+N",
    globalWhenHidden: true
  },
  {
    id: "focusSearch",
    category: "task",
    label: "聚焦快捷添加",
    description: "跳转到首页并聚焦任务快捷添加输入框",
    defaultAccelerator: "Mod+F"
  },
  {
    id: "goHome",
    category: "navigation",
    label: "任务列表",
    description: "跳转到首页全部任务",
    defaultAccelerator: "Mod+1"
  },
  {
    id: "goCalendar",
    category: "navigation",
    label: "日历",
    description: "打开日历视图",
    defaultAccelerator: "Mod+2"
  },
  {
    id: "goMatrix",
    category: "navigation",
    label: "四象限",
    description: "打开四象限矩阵视图",
    defaultAccelerator: "Mod+3"
  },
  {
    id: "goInbox",
    category: "navigation",
    label: "收件箱",
    description: "打开收件箱（便签与未排优任务）",
    defaultAccelerator: "Mod+4"
  },
  {
    id: "goDone",
    category: "navigation",
    label: "已完成",
    description: "打开已完成任务列表",
    defaultAccelerator: "Mod+Shift+E"
  },
  {
    id: "goTrash",
    category: "navigation",
    label: "垃圾桶",
    description: "打开垃圾桶",
    defaultAccelerator: "Mod+Shift+T"
  },
  {
    id: "openSettings",
    category: "navigation",
    label: "打开设置",
    description: "打开设置页",
    defaultAccelerator: "Mod+,"
  }
];
function getDefaultShortcutBindings() {
  const bindings = {};
  for (const action of SHORTCUT_ACTIONS) {
    bindings[action.id] = action.defaultAccelerator;
  }
  return bindings;
}
const ACTION_IDS = new Set(SHORTCUT_ACTIONS.map((a) => a.id));
function isShortcutBound(accelerator) {
  return typeof accelerator === "string" && accelerator.trim().length > 0;
}
function mergeShortcutBindings(partial) {
  const defaults = getDefaultShortcutBindings();
  if (!partial) {
    return defaults;
  }
  const next = { ...defaults };
  for (const [key, value] of Object.entries(partial)) {
    if (!ACTION_IDS.has(key)) continue;
    if (value === "" || value === null) {
      next[key] = "";
    } else if (typeof value === "string" && value.trim()) {
      next[key] = normalizeAccelerator(value);
    }
  }
  return next;
}
function normalizeAccelerator(raw) {
  return raw.split("+").map((part) => part.trim()).filter(Boolean).map((part) => {
    const lower = part.toLowerCase();
    if (lower === "mod") return "Mod";
    if (lower === "ctrl" || lower === "control") return "Ctrl";
    if (lower === "alt") return "Alt";
    if (lower === "shift") return "Shift";
    if (lower === "comma" || part === ",") return ",";
    if (part.length === 1) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join("+");
}
function formatAcceleratorForDisplay(accelerator, isMac = false) {
  if (!isShortcutBound(accelerator)) return "未设置";
  return normalizeAccelerator(accelerator).split("+").map((part) => {
    if (part === "Mod") return isMac ? "⌘" : "Ctrl";
    if (part === "Shift") return isMac ? "⇧" : "Shift";
    if (part === "Alt") return isMac ? "⌥" : "Alt";
    if (part === ",") return ",";
    return part;
  }).join(isMac ? "" : "+");
}
function toElectronAccelerator(accelerator) {
  return normalizeAccelerator(accelerator).split("+").map((part) => {
    if (part === "Mod") return "CommandOrControl";
    if (part === "Ctrl") return "Control";
    if (part === "Alt") return "Alt";
    if (part === "Shift") return "Shift";
    if (part === ",") return "Comma";
    return part;
  }).join("+");
}
function findShortcutConflicts(bindings) {
  const byAccel = /* @__PURE__ */ new Map();
  for (const action of SHORTCUT_ACTIONS) {
    const accel = bindings[action.id];
    if (!isShortcutBound(accel)) continue;
    const list = byAccel.get(accel) ?? [];
    list.push(action.id);
    byAccel.set(accel, list);
  }
  const conflicts = /* @__PURE__ */ new Map();
  for (const [accel, ids] of byAccel) {
    if (ids.length > 1) {
      conflicts.set(accel, ids);
    }
  }
  return conflicts;
}
function labelOf(id) {
  return SHORTCUT_ACTIONS.find((a) => a.id === id)?.label ?? id;
}
function formatShortcutConflictMessage(accelerator, conflictingIds, isMac = false) {
  const key = formatAcceleratorForDisplay(accelerator, isMac);
  const names = conflictingIds.map(labelOf).join("、");
  return `快捷键 ${key} 已用于「${names}」，请换一组或先清除原绑定`;
}
const LLM_PROVIDER_PRESETS = {
  alibaba: {
    id: "alibaba",
    label: "阿里通义（DashScope）",
    defaultModel: "qwen-plus",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelHint: "例如 qwen-plus、qwen-turbo",
    apiKeyHint: "在阿里云 DashScope 控制台获取 API Key"
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    modelHint: "例如 deepseek-chat、deepseek-reasoner",
    apiKeyHint: "在 DeepSeek 开放平台获取 API Key"
  }
};
function getDefaultLlmConfig() {
  const preset = LLM_PROVIDER_PRESETS.alibaba;
  return {
    provider: preset.id,
    apiKey: "",
    model: preset.defaultModel,
    baseUrl: preset.defaultBaseUrl
  };
}
function mergeLlmConfig(partial) {
  const defaults = getDefaultLlmConfig();
  if (!partial) return { ...defaults };
  const provider = partial.provider ?? defaults.provider;
  const preset = LLM_PROVIDER_PRESETS[provider];
  return {
    provider,
    apiKey: partial.apiKey ?? "",
    model: partial.model?.trim() || preset.defaultModel,
    baseUrl: partial.baseUrl?.trim() || preset.defaultBaseUrl
  };
}
function resolveLlmBaseUrl(config) {
  const trimmed = config.baseUrl.trim();
  if (trimmed) return trimmed.replace(/\/$/, "");
  return LLM_PROVIDER_PRESETS[config.provider].defaultBaseUrl;
}
const BUILTIN_TASK_PROMPT_NAME = "任务提示词";
const DEFAULT_AI_SYSTEM_PROMPT = `你是小柒todo 桌面待办助手的任务解析器。用户会用一句中文描述待办，你需要提取结构化字段。

请严格只输出 JSON，不要 markdown 代码块，格式如下：
{
  "title": "任务标题（必填，简短）",
  "dueAt": "yyyy-MM-ddTHH:mm:ss 或 null",
  "remindAt": "yyyy-MM-ddTHH:mm:ss 或 null",
  "categoryName": "分类名称或 null"
}

规则：
1. title 必填，从用户描述中提炼核心动作，不超过 200 字
2. 时间使用本地时间 ISO 格式（无毫秒、无时区），无法确定则 null
3. remindAt 必须早于或等于 dueAt；仅有提醒无到期时 remindAt 可为 null
4. categoryName 仅当用户明确提到分类/清单名称时填写，否则 null
5. 当前日期参考用户消息中的「今天」上下文`;
const DEFAULT_AI_USER_TEMPLATE = `今天日期：{today}

可选分类：{categories}

用户输入：
{input}`;
function getDefaultAiPromptConfig() {
  return {
    taskPromptName: BUILTIN_TASK_PROMPT_NAME,
    systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
    userTemplate: DEFAULT_AI_USER_TEMPLATE,
    taskParseMode: "local",
    customPrompts: []
  };
}
function normalizeTaskParseMode(raw) {
  return raw === "llm" ? "llm" : "local";
}
function mergeAiPromptConfig(partial) {
  const defaults = getDefaultAiPromptConfig();
  if (!partial) return { ...defaults, customPrompts: [] };
  const customPrompts = Array.isArray(partial.customPrompts) ? partial.customPrompts.filter((p) => p?.name?.trim() && p?.content?.trim()).map((p) => ({
    id: p.id?.trim() || uuid.v4(),
    name: p.name.trim(),
    content: p.content.trim()
  })) : defaults.customPrompts;
  return {
    taskPromptName: partial.taskPromptName?.trim() || BUILTIN_TASK_PROMPT_NAME,
    systemPrompt: partial.systemPrompt?.trim() || defaults.systemPrompt,
    userTemplate: partial.userTemplate?.trim() || defaults.userTemplate,
    taskParseMode: normalizeTaskParseMode(partial.taskParseMode),
    customPrompts
  };
}
function renderAiUserPrompt(template, vars) {
  return template.replace(/\{input\}/g, vars.input).replace(/\{today\}/g, vars.today).replace(/\{categories\}/g, vars.categories);
}
const DEFAULT_CLOSE_BEHAVIOR = "ask";
function mergeCloseBehavior(raw) {
  if (raw === "tray" || raw === "quit" || raw === "ask") return raw;
  return DEFAULT_CLOSE_BEHAVIOR;
}
const DEFAULT_LAUNCH_AT_LOGIN = {
  startupMode: "tray"
};
function mergeLaunchAtLoginPrefs(raw) {
  const enabled = raw?.enabled === true;
  const startupMode = raw?.startupMode === "window" || raw?.startupMode === "tray" ? raw.startupMode : DEFAULT_LAUNCH_AT_LOGIN.startupMode;
  return { enabled, startupMode };
}
function shouldStartHidden(argv, loginItem, prefs) {
  if (!prefs.enabled || prefs.startupMode !== "tray") {
    return false;
  }
  if (argv.includes("--hidden")) {
    return true;
  }
  if (loginItem.wasOpenedAsHidden === true) {
    return true;
  }
  return loginItem.wasOpenedAtLogin === true;
}
const DEFAULT_TASK_ACTIVITY_RETENTION = {
  mode: "forever"
};
const DEFAULT_TASK_ACTIVITY_MAX_COUNT = 2e3;
const DEFAULT_TASK_ACTIVITY_MAX_DAYS = 180;
function mergeTaskActivityRetention(partial) {
  if (!partial?.mode) {
    return { ...DEFAULT_TASK_ACTIVITY_RETENTION };
  }
  if (partial.mode === "max_count") {
    return {
      mode: "max_count",
      maxCount: normalizePositiveInt(partial.maxCount, DEFAULT_TASK_ACTIVITY_MAX_COUNT)
    };
  }
  if (partial.mode === "max_days") {
    return {
      mode: "max_days",
      maxDays: normalizePositiveInt(partial.maxDays, DEFAULT_TASK_ACTIVITY_MAX_DAYS)
    };
  }
  return { mode: "forever" };
}
function normalizePositiveInt(value, fallback) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return fallback;
  }
  return n;
}
function validateTaskActivityRetention(policy) {
  if (policy.mode === "forever") {
    return null;
  }
  if (policy.mode === "max_count") {
    if (!policy.maxCount || policy.maxCount < 1) {
      return "请填写有效的最大保留条数";
    }
    return null;
  }
  if (policy.mode === "max_days") {
    if (!policy.maxDays || policy.maxDays < 1) {
      return "请填写有效的保留天数";
    }
    return null;
  }
  return "无效的保留策略";
}
const CONFIG_FILE$1 = "config.json";
function getDefaultDataDir() {
  if (!electron.app.isPackaged) {
    return path.join(electron.app.getPath("userData"), "data");
  }
  if (process.platform === "darwin") {
    const exe = electron.app.getPath("exe");
    return path.resolve(path.dirname(exe), "..", "..", "..", "ai-todo-data");
  }
  return path.join(path.dirname(process.execPath), "data");
}
function getLegacyDevDataDir() {
  return path.join(path.dirname(process.execPath), "data");
}
function migrateLegacyDevDatabaseIfNeeded(targetDir) {
  if (electron.app.isPackaged) {
    return;
  }
  const targetDb = path.join(targetDir, "data.db");
  if (fs.existsSync(targetDb)) {
    return;
  }
  const legacyDb = path.join(getLegacyDevDataDir(), "data.db");
  if (!fs.existsSync(legacyDb)) {
    return;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(legacyDb, targetDb);
  console.log(`[aiTodo] 已从旧开发目录迁移数据库：${legacyDb} → ${targetDb}`);
}
function readConfigFrom(dir) {
  const configPath = path.join(dir, CONFIG_FILE$1);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}
function resolveDataDir() {
  const defaultDir = getDefaultDataDir();
  migrateLegacyDevDatabaseIfNeeded(defaultDir);
  const cfg = readConfigFrom(defaultDir);
  if (cfg?.dataDir) {
    return cfg.dataDir;
  }
  return defaultDir;
}
function isDirectoryWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".write-test");
    fs.writeFileSync(probe, "ok", "utf-8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
function migrateDataDirContents(sourceDir, targetDir) {
  const src = path.resolve(sourceDir);
  const dest = path.resolve(targetDir);
  if (src === dest) {
    throw new Error("目标目录与当前目录相同");
  }
  if (!isDirectoryWritable(dest)) {
    throw new Error("目标目录不可写");
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.existsSync(src) ? fs.readdirSync(src) : [];
  for (const name of entries) {
    if (name === CONFIG_FILE$1 && src === path.resolve(getDefaultDataDir())) {
      continue;
    }
    const from = path.join(src, name);
    const to = path.join(dest, name);
    fs.cpSync(from, to, { recursive: true, force: true });
  }
  const srcDb = path.join(src, "data.db");
  const destDb = path.join(dest, "data.db");
  if (fs.existsSync(srcDb) && !fs.existsSync(destDb)) {
    throw new Error("复制数据库失败");
  }
  for (const name of entries) {
    if (name === CONFIG_FILE$1 && src === path.resolve(getDefaultDataDir())) {
      continue;
    }
    const from = path.join(src, name);
    fs.rmSync(from, { recursive: true, force: true });
  }
}
function relocateDataDir(newDir, options) {
  const target = path.resolve(newDir);
  const source = path.resolve(options.sourceDir);
  migrateDataDirContents(source, target);
  savePendingDataDir(getDefaultDataDir(), target);
  return target;
}
function savePendingDataDir(currentDir, newDir) {
  if (!isDirectoryWritable(newDir)) {
    throw new Error("目标目录不可写");
  }
  fs.mkdirSync(currentDir, { recursive: true });
  const configPath = path.join(currentDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, dataDir: newDir };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function getDatabaseFilePath(dataDir) {
  return path.join(dataDir, "data.db");
}
function readActiveConfig() {
  const defaultDir = getDefaultDataDir();
  return readConfigFrom(defaultDir) ?? {};
}
function readShortcutBindings() {
  const cfg = readActiveConfig();
  return mergeShortcutBindings(cfg.shortcuts);
}
function saveShortcutBindings(bindings) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, shortcuts: bindings };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function readLlmConfig() {
  const cfg = readActiveConfig();
  return mergeLlmConfig(cfg.llm);
}
function saveLlmConfig(config) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, llm: mergeLlmConfig(config) };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function readAiPromptConfig() {
  const cfg = readActiveConfig();
  return mergeAiPromptConfig(cfg.aiPrompt);
}
function saveAiPromptConfig(config) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, aiPrompt: mergeAiPromptConfig(config) };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function readCloseBehavior() {
  const cfg = readActiveConfig();
  return mergeCloseBehavior(cfg.closeBehavior);
}
function saveCloseBehavior(behavior) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = { ...existing, closeBehavior: mergeCloseBehavior(behavior) };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function readLaunchAtLoginPrefs() {
  const cfg = readActiveConfig();
  return mergeLaunchAtLoginPrefs(cfg.launchAtLogin);
}
function saveLaunchAtLoginPrefs(prefs) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = {
    ...existing,
    launchAtLogin: mergeLaunchAtLoginPrefs(prefs)
  };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function readTaskActivityRetention() {
  const cfg = readActiveConfig();
  return mergeTaskActivityRetention(cfg.taskActivityRetention);
}
function saveTaskActivityRetention(policy) {
  const defaultDir = getDefaultDataDir();
  fs.mkdirSync(defaultDir, { recursive: true });
  const configPath = path.join(defaultDir, CONFIG_FILE$1);
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      existing = {};
    }
  }
  const next = {
    ...existing,
    taskActivityRetention: mergeTaskActivityRetention(policy)
  };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf-8");
}
function nowIso() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const TAG_NAME_RE = /^[\u4e00-\u9fa5\w-]{1,32}$/;
function stripMarkupForTags(text) {
  return text.replace(/<[^>]+>/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~>-]/g, " ");
}
function extractTagsFromText(title, description) {
  const raw = `${title} ${stripMarkupForTags(description ?? "")}`;
  const found = /* @__PURE__ */ new Set();
  const re = /#([\u4e00-\u9fa5\w-]{1,32})/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    found.add(m[1]);
  }
  return [...found].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
function normalizeTagName(raw) {
  const name = raw.trim().replace(/^#+/, "");
  if (!name || !TAG_NAME_RE.test(name)) {
    return null;
  }
  return name;
}
function normalizeTagNames(names) {
  const set = /* @__PURE__ */ new Set();
  for (const raw of names) {
    const norm = normalizeTagName(raw);
    if (norm) {
      set.add(norm);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
class TagRepository {
  constructor(db) {
    this.db = db;
  }
  listAllNames() {
    const rows = this.db.prepare(`SELECT name FROM tags ORDER BY name COLLATE NOCASE ASC`).all();
    return rows.map((r) => r.name);
  }
  getTagsByTaskIds(taskIds) {
    const map = /* @__PURE__ */ new Map();
    if (!taskIds.length) {
      return map;
    }
    const placeholders = taskIds.map(() => "?").join(",");
    const rows = this.db.prepare(
      `SELECT tt.task_id AS taskId, t.name AS name
         FROM task_tags tt
         INNER JOIN tags t ON t.id = tt.tag_id
         WHERE tt.task_id IN (${placeholders})
         ORDER BY t.name COLLATE NOCASE ASC`
    ).all(...taskIds);
    for (const row of rows) {
      const list = map.get(row.taskId) ?? [];
      list.push(row.name);
      map.set(row.taskId, list);
    }
    return map;
  }
  getTagsForTask(taskId) {
    return this.getTagsByTaskIds([taskId]).get(taskId) ?? [];
  }
  /** 覆盖任务的标签关联；自动创建不存在的标签 */
  setTaskTags(taskId, tagNames, ts = nowIso()) {
    const normalized = normalizeTagNames(tagNames);
    const deleteLinks = this.db.prepare(`DELETE FROM task_tags WHERE task_id = ?`);
    const findTag = this.db.prepare(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`);
    const insertTag = this.db.prepare(
      `INSERT INTO tags (id, name, created_at) VALUES (@id, @name, @createdAt)`
    );
    const insertLink = this.db.prepare(
      `INSERT INTO task_tags (task_id, tag_id, created_at) VALUES (@taskId, @tagId, @createdAt)`
    );
    const apply = this.db.transaction(() => {
      deleteLinks.run(taskId);
      for (const name of normalized) {
        let row = findTag.get(name);
        if (!row) {
          const id = uuid.v4();
          insertTag.run({ id, name, createdAt: ts });
          row = { id, name };
        }
        insertLink.run({ taskId, tagId: row.id, createdAt: ts });
      }
      this.pruneOrphanTags();
    });
    apply();
    return normalized;
  }
  pruneOrphanTags() {
    this.db.prepare(
      `DELETE FROM tags
         WHERE id NOT IN (SELECT DISTINCT tag_id FROM task_tags)`
    ).run();
  }
  deleteLinksForTask(taskId) {
    this.db.prepare(`DELETE FROM task_tags WHERE task_id = ?`).run(taskId);
    this.pruneOrphanTags();
  }
}
function migrateLegacyTaskTags(db) {
  const repo = new TagRepository(db);
  const rows = db.prepare(`SELECT id, title, description FROM tasks WHERE deleted_at IS NULL`).all();
  const existingLinks = db.prepare(`SELECT 1 FROM task_tags LIMIT 1`).get();
  if (existingLinks) {
    return;
  }
  const ts = nowIso();
  for (const row of rows) {
    const names = extractTagsFromText(row.title, row.description);
    if (names.length) {
      repo.setTaskTags(row.id, names, ts);
    }
  }
}
const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        category_id TEXT,
        parent_id TEXT,
        due_at TEXT,
        remind_at TEXT,
        remind_fired_at TEXT,
        completed_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_version INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
    `
  },
  {
    version: 2,
    sql: `
      ALTER TABLE tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 4;
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS kanban_groups (
        id TEXT PRIMARY KEY,
        scope_key TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kanban_groups_scope ON kanban_groups(scope_key);
      ALTER TABLE tasks ADD COLUMN kanban_group_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_kanban_group ON tasks(kanban_group_id);
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS app_messages (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        task_id TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_app_messages_kind ON app_messages(kind);
      CREATE INDEX IF NOT EXISTS idx_app_messages_created ON app_messages(created_at);
    `
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS task_reminders (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        fired_at TEXT,
        offset_minutes INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_reminders_at ON task_reminders(remind_at);
      CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON task_reminders(task_id);
      ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
      ALTER TABLE tasks ADD COLUMN remind_continuous INTEGER NOT NULL DEFAULT 0;
      INSERT INTO task_reminders (id, task_id, remind_at, fired_at, offset_minutes, created_at)
      SELECT
        lower(hex(randomblob(16))),
        id,
        remind_at,
        remind_fired_at,
        NULL,
        updated_at
      FROM tasks
      WHERE remind_at IS NOT NULL AND deleted_at IS NULL;
    `
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS scheduled_summaries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_ids TEXT NOT NULL DEFAULT '[]',
        schedule_type TEXT NOT NULL,
        send_time TEXT NOT NULL,
        send_weekday INTEGER,
        send_day INTEGER,
        use_llm INTEGER NOT NULL DEFAULT 0,
        prompt_text TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_summaries_enabled ON scheduled_summaries(enabled);
    `
  },
  {
    version: 7,
    sql: `
      ALTER TABLE scheduled_summaries ADD COLUMN report_config TEXT;
    `
  },
  {
    version: 8,
    sql: `
      ALTER TABLE app_messages ADD COLUMN source TEXT;
    `
  },
  {
    version: 9,
    sql: `
      ALTER TABLE tasks ADD COLUMN completed_occurrence_dates TEXT;
    `
  },
  {
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS task_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_filters_sort ON task_filters(sort_order);
    `
  },
  {
    version: 11,
    sql: `
      CREATE TABLE IF NOT EXISTS task_activities (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_activities_task_created
        ON task_activities(task_id, created_at DESC);
    `
  },
  {
    version: 12,
    sql: `
      DROP TABLE IF EXISTS task_filters;
      CREATE TABLE IF NOT EXISTS task_views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        scope_key TEXT,
        filter_rule_json TEXT,
        group_by TEXT NOT NULL,
        sort_by TEXT NOT NULL,
        kanban_board_mode TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_task_views_sort ON task_views(sort_order);
      INSERT INTO task_views (
        id, name, layout, scope_key, filter_rule_json, group_by, sort_by,
        kanban_board_mode, sort_order, created_at, updated_at
      ) VALUES
        (
          'view-default-all', '全部任务', 'list', NULL, NULL,
          'none', 'custom', NULL, 0,
          datetime('now'), datetime('now')
        ),
        (
          'view-default-kanban', '看板', 'kanban', NULL,
          '{"type":"group","op":"and","children":[{"type":"cond","field":"status","op":"in","value":["TODO","IN_PROGRESS"]}]}',
          'none', 'custom', 'status', 1,
          datetime('now'), datetime('now')
        );
    `
  },
  {
    version: 13,
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);
    `
  },
  {
    version: 14,
    sql: `
      ALTER TABLE tasks ADD COLUMN start_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_start_at ON tasks(start_at);
    `
  },
  {
    version: 15,
    sql: `
      ALTER TABLE categories ADD COLUMN keywords TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 16,
    sql: `
      CREATE TABLE IF NOT EXISTS desktop_organize_settings (
        id                   TEXT PRIMARY KEY DEFAULT 'default',
        folder_prefix        TEXT NOT NULL DEFAULT '小柒整理-',
        layout_mode          TEXT NOT NULL DEFAULT 'flat_prefix',
        auto_organize_on_scan INTEGER NOT NULL DEFAULT 0,
        auto_scan_on_boot    INTEGER NOT NULL DEFAULT 1,
        updated_at           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_categories (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        target_folder_name TEXT NOT NULL,
        icon               TEXT NOT NULL DEFAULT '📁',
        color              TEXT NOT NULL DEFAULT '#dbeafe',
        sort_order         INTEGER NOT NULL DEFAULT 0,
        enabled            INTEGER NOT NULL DEFAULT 1,
        is_system          INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_category_rules (
        id          TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES desktop_categories(id) ON DELETE CASCADE,
        rule_type   TEXT NOT NULL,
        rule_json   TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS desktop_manual_assignments (
        item_path   TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_organize_snapshots (
        id           TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );

      INSERT INTO desktop_organize_settings (id, folder_prefix, layout_mode, auto_organize_on_scan, auto_scan_on_boot, updated_at)
      VALUES ('default', '小柒整理-', 'flat_prefix', 0, 1, datetime('now'));

      INSERT INTO desktop_categories (id, name, target_folder_name, icon, color, sort_order, enabled, is_system, created_at, updated_at) VALUES
        ('cat-docs', '文档', '文档', '📄', '#dbeafe', 100, 1, 0, datetime('now'), datetime('now')),
        ('cat-images', '图片', '图片', '🖼️', '#fce7f3', 110, 1, 0, datetime('now'), datetime('now')),
        ('file', '文件', '文件', '📄', '#f3f4f6', 200, 1, 1, datetime('now'), datetime('now')),
        ('folder', '文件夹', '文件夹', '📁', '#fef3c7', 210, 1, 1, datetime('now'), datetime('now')),
        ('icon', '图标', '图标', '🔗', '#e0e7ff', 220, 1, 1, datetime('now'), datetime('now')),
        ('uncategorized', '未分类', '未分类', '❓', '#fee2e2', 230, 1, 1, datetime('now'), datetime('now'));

      INSERT INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES
        ('rule-docs-ext', 'cat-docs', 'extension', '{"type":"extension","values":[".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx"]}', 0),
        ('rule-images-ext', 'cat-images', 'extension', '{"type":"extension","values":[".png",".jpg",".jpeg",".gif",".webp",".bmp"]}', 0),
        ('rule-file-kind', 'file', 'kind', '{"type":"kind","value":"file"}', 0),
        ('rule-folder-kind', 'folder', 'kind', '{"type":"kind","value":"folder"}', 0),
        ('rule-icon-kind', 'icon', 'kind', '{"type":"kind","value":"icon"}', 0);
    `
  },
  {
    version: 17,
    sql: `
      CREATE TABLE IF NOT EXISTS widget_settings (
        id               TEXT PRIMARY KEY DEFAULT 'default',
        x                INTEGER NOT NULL DEFAULT 200,
        y                INTEGER NOT NULL DEFAULT 200,
        width            INTEGER NOT NULL DEFAULT 320,
        height           INTEGER NOT NULL DEFAULT 420,
        always_on_top    INTEGER NOT NULL DEFAULT 1,
        open_on_startup  INTEGER NOT NULL DEFAULT 0,
        last_tab         TEXT NOT NULL DEFAULT 'notes',
        updated_at       TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS widget_notes (
        id         TEXT PRIMARY KEY,
        content    TEXT NOT NULL DEFAULT '',
        color      TEXT NOT NULL DEFAULT 'yellow',
        pinned     INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO widget_settings (id, x, y, width, height, always_on_top, open_on_startup, last_tab, updated_at)
      VALUES ('default', 200, 200, 320, 420, 1, 0, 'notes', datetime('now'));
    `
  },
  {
    version: 18,
    sql: `
      CREATE TABLE IF NOT EXISTS desktop_fence_settings (
        id                   TEXT PRIMARY KEY DEFAULT 'default',
        fences_enabled       INTEGER NOT NULL DEFAULT 0,
        fences_always_on_top INTEGER NOT NULL DEFAULT 1,
        updated_at           TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktop_fence_layout (
        category_id  TEXT PRIMARY KEY,
        x            INTEGER NOT NULL DEFAULT 100,
        y            INTEGER NOT NULL DEFAULT 100,
        width        INTEGER NOT NULL DEFAULT 300,
        height       INTEGER NOT NULL DEFAULT 280,
        visible      INTEGER NOT NULL DEFAULT 1,
        updated_at   TEXT NOT NULL
      );

      INSERT INTO desktop_fence_settings (id, fences_enabled, fences_always_on_top, updated_at)
      VALUES ('default', 0, 1, datetime('now'));
    `
  },
  {
    version: 19,
    sql: `
      ALTER TABLE desktop_fence_settings ADD COLUMN hide_native_icons INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    version: 20,
    sql: `
      UPDATE desktop_fence_settings SET hide_native_icons = 0;
    `
  },
  {
    version: 21,
    sql: `
      UPDATE desktop_fence_settings SET fences_always_on_top = 0;
    `
  },
  {
    version: 22,
    sql: `
      DELETE FROM desktop_fence_layout;
      INSERT INTO desktop_fence_layout (category_id, x, y, width, height, visible, updated_at)
      VALUES
        ('slot-apps', 16, 16, 300, 720, 1, datetime('now')),
        ('slot-folders', 1200, 16, 300, 200, 1, datetime('now')),
        ('slot-files', 1200, 228, 300, 508, 1, datetime('now'));
    `
  },
  {
    version: 23,
    sql: `
      DELETE FROM desktop_fence_layout
        WHERE category_id NOT IN ('slot-apps', 'slot-folders', 'slot-files');
      ALTER TABLE desktop_fence_settings ADD COLUMN layout_dimension_version INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    version: 24,
    sql: `
      ALTER TABLE desktop_organize_settings ADD COLUMN auto_organize_on_boot INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE desktop_organize_settings ADD COLUMN auto_organize_on_new_icons INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS desktop_custom_rules (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        enabled     INTEGER NOT NULL DEFAULT 1,
        match_type  TEXT NOT NULL,
        match_value TEXT NOT NULL,
        category_id TEXT NOT NULL REFERENCES desktop_categories(id) ON DELETE CASCADE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      INSERT OR IGNORE INTO desktop_categories (id, name, target_folder_name, icon, color, sort_order, enabled, is_system, created_at, updated_at) VALUES
        ('cat-compress', '压缩', '压缩', '🗜️', '#e0e7ff', 105, 1, 0, datetime('now'), datetime('now')),
        ('cat-video', '视频', '视频', '🎬', '#fce7f3', 115, 0, 0, datetime('now'), datetime('now')),
        ('cat-audio', '音频', '音频', '🎵', '#fef3c7', 116, 0, 0, datetime('now'), datetime('now'));

      UPDATE desktop_category_rules SET rule_json = '{"type":"extension","values":[".txt",".pdf",".doc",".docx",".ppt",".pptx",".xls",".xlsx",".md",".rtf"]}' WHERE id = 'rule-docs-ext';
      UPDATE desktop_category_rules SET rule_json = '{"type":"extension","values":[".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg",".psd",".ico"]}' WHERE id = 'rule-images-ext';

      INSERT OR IGNORE INTO desktop_category_rules (id, category_id, rule_type, rule_json, sort_order) VALUES
        ('rule-compress-ext', 'cat-compress', 'extension', '{"type":"extension","values":[".zip",".rar",".7z",".dmg",".gz",".tar",".001",".apk",".iso"]}', 0),
        ('rule-video-ext', 'cat-video', 'extension', '{"type":"extension","values":[".mp4",".avi",".mov",".flv",".mkv",".wmv",".webm",".m4v"]}', 0),
        ('rule-audio-ext', 'cat-audio', 'extension', '{"type":"extension","values":[".mp3",".wav",".flac",".aac",".wma",".m4a",".ogg"]}', 0),
        ('rule-icon-lnk', 'icon', 'extension', '{"type":"extension","values":[".lnk"]}', 0);

      DELETE FROM desktop_category_rules WHERE id = 'rule-icon-kind';
    `
  },
  {
    version: 25,
    sql: `
      ALTER TABLE tasks ADD COLUMN triaged_at TEXT NULL;
      UPDATE tasks SET triaged_at = updated_at WHERE triaged_at IS NULL;
    `
  },
  {
    version: 26,
    sql: `
      ALTER TABLE task_views ADD COLUMN quadrant_options_json TEXT NULL;
    `
  },
  {
    version: 27,
    sql: `
      CREATE TABLE IF NOT EXISTS widget_instances (
        id            TEXT PRIMARY KEY,
        kind          TEXT NOT NULL,
        view_id       TEXT NULL,
        name          TEXT NOT NULL DEFAULT '',
        x             INTEGER NOT NULL DEFAULT 200,
        y             INTEGER NOT NULL DEFAULT 200,
        width         INTEGER NOT NULL DEFAULT 320,
        height        INTEGER NOT NULL DEFAULT 420,
        always_on_top INTEGER NOT NULL DEFAULT 1,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      INSERT INTO widget_instances (
        id, kind, view_id, name, x, y, width, height, always_on_top, sort_order, created_at, updated_at
      )
      SELECT
        'widget-default',
        CASE
          WHEN last_tab = 'matrix' THEN 'matrix'
          ELSE 'notes'
        END,
        NULL,
        CASE
          WHEN last_tab = 'matrix' THEN '四象限'
          ELSE '便签'
        END,
        x,
        y,
        width,
        height,
        always_on_top,
        0,
        datetime('now'),
        datetime('now')
      FROM widget_settings
      WHERE id = 'default'
        AND NOT EXISTS (SELECT 1 FROM widget_instances WHERE id = 'widget-default');
    `
  },
  {
    version: 28,
    sql: `
      ALTER TABLE widget_instances ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'expanded';
      ALTER TABLE widget_instances ADD COLUMN collapse_policy TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE widget_instances ADD COLUMN idle_timeout_sec INTEGER NOT NULL DEFAULT 30;
      ALTER TABLE widget_instances ADD COLUMN edge_anchor TEXT NOT NULL DEFAULT 'right';
      ALTER TABLE widget_instances ADD COLUMN expanded_x INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_y INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_width INTEGER NULL;
      ALTER TABLE widget_instances ADD COLUMN expanded_height INTEGER NULL;

      UPDATE widget_instances SET
        expanded_x = x,
        expanded_y = y,
        expanded_width = width,
        expanded_height = height;

      UPDATE widget_instances SET display_mode = 'edge_tab', collapse_policy = 'on_blur'
        WHERE kind IN ('matrix', 'view');
    `
  },
  {
    version: 29,
    sql: `
      DROP TABLE IF EXISTS desktop_custom_rules;
      DROP TABLE IF EXISTS desktop_category_rules;
      DROP TABLE IF EXISTS desktop_manual_assignments;
      DROP TABLE IF EXISTS desktop_categories;
      DROP TABLE IF EXISTS desktop_organize_snapshots;
      DROP TABLE IF EXISTS desktop_organize_settings;
      DROP TABLE IF EXISTS desktop_fence_layout;
      DROP TABLE IF EXISTS desktop_fence_settings;
    `
  },
  {
    version: 30,
    sql: `
      CREATE TABLE IF NOT EXISTS local_changes (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        client_sync_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        pushed_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS idx_local_changes_pending
        ON local_changes(status, created_at);

      CREATE TABLE IF NOT EXISTS sync_state (
        id TEXT PRIMARY KEY DEFAULT 'default',
        device_id TEXT NOT NULL,
        user_id TEXT,
        server_base_url TEXT,
        last_pulled_cursor TEXT,
        last_pushed_at TEXT,
        last_sync_at TEXT,
        last_error TEXT,
        auth_expires_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_payload_json TEXT,
        server_payload_json TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL
      );
    `
  }
];
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map(
      (r) => r.version
    )
  );
  const insert = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue;
    }
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, nowIso());
    });
    apply();
    if (migration.version === 13) {
      migrateLegacyTaskTags(db);
    }
  }
}
let dbInstance = null;
let activeDataDir = null;
class DatabaseNotWritableError extends Error {
  constructor(dataPath) {
    super(`数据目录不可写：${dataPath}`);
    this.dataPath = dataPath;
    this.name = "DatabaseNotWritableError";
  }
  code = "DB_NOT_WRITABLE";
}
function getDatabase() {
  const dataDir = resolveDataDir();
  if (dbInstance && activeDataDir === dataDir) {
    return dbInstance;
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (!isDirectoryWritable(dataDir)) {
    throw new DatabaseNotWritableError(dataDir);
  }
  const dbPath = getDatabaseFilePath(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  dbInstance = new BetterSqlite3(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  runMigrations(dbInstance);
  activeDataDir = dataDir;
  return dbInstance;
}
function getActiveDataDir() {
  return activeDataDir ?? resolveDataDir();
}
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    activeDataDir = null;
  }
}
const IPC = {
  TASKS_LIST: "tasks:list",
  TASKS_GET: "tasks:get",
  TASKS_GET_IN_TRASH: "tasks:getInTrash",
  TASKS_CREATE: "tasks:create",
  TASKS_UPDATE: "tasks:update",
  TASKS_DELETE: "tasks:delete",
  TASKS_RESTORE: "tasks:restore",
  TASKS_PERMANENT_DELETE: "tasks:permanentDelete",
  TASKS_EMPTY_TRASH: "tasks:emptyTrash",
  TASKS_COUNT_TRASH: "tasks:countTrash",
  TASKS_COUNT_DONE: "tasks:countDone",
  TASKS_REORDER: "tasks:reorder",
  KANBAN_GROUPS_LIST: "kanbanGroups:list",
  KANBAN_GROUPS_CREATE: "kanbanGroups:create",
  KANBAN_GROUPS_UPDATE: "kanbanGroups:update",
  KANBAN_GROUPS_DELETE: "kanbanGroups:delete",
  CATEGORIES_LIST: "categories:list",
  CATEGORIES_CREATE: "categories:create",
  CATEGORIES_UPDATE: "categories:update",
  CATEGORIES_DELETE: "categories:delete",
  CATEGORIES_REORDER: "categories:reorder",
  TAGS_LIST: "tags:list",
  APP_GET_DATA_PATH: "app:getDataPath",
  APP_SET_DATA_PATH: "app:setDataPath",
  /** 系统文件夹选择器，用于设置数据目录 */
  APP_PICK_DATA_DIR: "app:pickDataDir",
  APP_EXPORT_USER_CONFIG: "app:exportUserConfig",
  APP_IMPORT_USER_CONFIG: "app:importUserConfig",
  APP_EXPORT_TASKS_JSON: "app:exportTasksJson",
  APP_EXPORT_TASKS_MARKDOWN: "app:exportTasksMarkdown",
  APP_IMPORT_TASKS_JSON: "app:importTasksJson",
  APP_GET_VERSION: "app:getVersion",
  APP_GET_INFO: "app:getInfo",
  /** Main → Renderer：托盘/菜单触发新建任务（兼容旧版） */
  APP_NEW_TASK: "app:new-task",
  /** Main → Renderer：快捷键/托盘触发的统一动作 */
  APP_ACTION: "app:action",
  APP_GET_SHORTCUTS: "app:getShortcuts",
  APP_SET_SHORTCUTS: "app:setShortcuts",
  APP_GET_LLM_CONFIG: "app:getLlmConfig",
  APP_SET_LLM_CONFIG: "app:setLlmConfig",
  APP_GET_AI_PROMPT: "app:getAiPrompt",
  APP_SET_AI_PROMPT: "app:setAiPrompt",
  /** 按设置解析任务文本（本地 / LLM，失败回落） */
  APP_PARSE_TASK_INPUT: "app:parseTaskInput",
  APP_GET_CLOSE_BEHAVIOR: "app:getCloseBehavior",
  APP_SET_CLOSE_BEHAVIOR: "app:setCloseBehavior",
  APP_GET_LAUNCH_AT_LOGIN: "app:getLaunchAtLogin",
  APP_SET_LAUNCH_AT_LOGIN: "app:setLaunchAtLogin",
  APP_CLOSE_REQUEST: "app:closeRequest",
  APP_CONFIRM_CLOSE: "app:confirmClose",
  APP_SHOW_WINDOW: "app:showWindow",
  /** 系统文件选择器 → 复制到 data/attachments */
  APP_PICK_ATTACHMENT: "app:pickAttachment",
  /** 将 base64 缓冲区写入 attachments（粘贴图片等） */
  APP_SAVE_ATTACHMENT: "app:saveAttachment",
  /** 附件 URI → file:// 供预览渲染 */
  APP_RESOLVE_ATTACHMENT_URL: "app:resolveAttachmentUrl",
  /** 用系统默认程序打开附件 */
  APP_OPEN_ATTACHMENT: "app:openAttachment",
  /** 附件另存为到用户指定路径 */
  APP_DOWNLOAD_ATTACHMENT: "app:downloadAttachment",
  /** Main → Renderer：新应用内消息 */
  APP_MESSAGE_PUSH: "app:message-push",
  MESSAGES_LIST: "messages:list",
  MESSAGES_COUNT_UNREAD: "messages:countUnread",
  MESSAGES_MARK_READ: "messages:markRead",
  MESSAGES_MARK_ALL_READ: "messages:markAllRead",
  SCHEDULED_SUMMARIES_LIST: "scheduledSummaries:list",
  SCHEDULED_SUMMARIES_CREATE: "scheduledSummaries:create",
  SCHEDULED_SUMMARIES_UPDATE: "scheduledSummaries:update",
  SCHEDULED_SUMMARIES_DELETE: "scheduledSummaries:delete",
  SCHEDULED_SUMMARIES_PREVIEW: "scheduledSummaries:preview",
  SCHEDULED_SUMMARIES_RUN_NOW: "scheduledSummaries:runNow",
  /** 日历法定放假 / 调休上班标注（按年份批量） */
  HOLIDAYS_CALENDAR_MARKS: "holidays:calendarMarks",
  /** 节假日缓存状态（来源 / 年份 / mtime） */
  HOLIDAYS_STATUS: "holidays:status",
  /** 强制刷新指定年份节假日缓存 */
  HOLIDAYS_REFRESH: "holidays:refresh",
  TASK_VIEWS_LIST: "taskViews:list",
  TASK_VIEWS_CREATE: "taskViews:create",
  TASK_VIEWS_UPDATE: "taskViews:update",
  TASK_VIEWS_DELETE: "taskViews:delete",
  TASK_VIEWS_PREVIEW_COUNT: "taskViews:previewCount",
  TASK_VIEWS_CREATE_FROM_TEMPLATE: "taskViews:createFromTemplate",
  TASK_ACTIVITIES_LIST_BY_TASK: "taskActivities:listByTask",
  TASK_ACTIVITIES_COUNT: "taskActivities:count",
  TASK_ACTIVITIES_DELETE_ALL: "taskActivities:deleteAll",
  TASK_ACTIVITIES_PURGE: "taskActivities:purge",
  TASK_ACTIVITIES_DELETE_TRASHED: "taskActivities:deleteTrashed",
  TASK_ACTIVITY_RETENTION_GET: "taskActivityRetention:get",
  TASK_ACTIVITY_RETENTION_SET: "taskActivityRetention:set",
  WIDGET_TOGGLE: "widget:toggle",
  WIDGET_SHOW: "widget:show",
  WIDGET_HIDE: "widget:hide",
  WIDGET_GET_SETTINGS: "widget:getSettings",
  WIDGET_UPDATE_SETTINGS: "widget:updateSettings",
  WIDGET_INSTANCES_LIST: "widgetInstances:list",
  WIDGET_INSTANCES_GET: "widgetInstances:get",
  WIDGET_INSTANCES_CREATE: "widgetInstances:create",
  WIDGET_INSTANCES_UPDATE: "widgetInstances:update",
  WIDGET_INSTANCES_DELETE: "widgetInstances:delete",
  WIDGET_INSTANCE_SHOW: "widgetInstance:show",
  WIDGET_INSTANCE_HIDE: "widgetInstance:hide",
  WIDGET_INSTANCE_TOGGLE: "widgetInstance:toggle",
  WIDGET_INSTANCE_EXPAND: "widgetInstance:expand",
  WIDGET_INSTANCE_COLLAPSE: "widgetInstance:collapse",
  WIDGET_INSTANCE_SET_DISPLAY_MODE: "widgetInstance:setDisplayMode",
  /** Main → Widget：展示状态变更 */
  WIDGET_DISPLAY_MODE_CHANGED: "widget:displayModeChanged",
  WIDGET_NOTES_LIST: "widgetNotes:list",
  WIDGET_NOTES_CREATE: "widgetNotes:create",
  WIDGET_NOTES_UPDATE: "widgetNotes:update",
  WIDGET_NOTES_DELETE: "widgetNotes:delete",
  WIDGET_NOTES_CONVERT_TO_TASK: "widgetNotes:convertToTask",
  CAPTURE_TOGGLE: "capture:toggle",
  CAPTURE_SHOW: "capture:show",
  CAPTURE_HIDE: "capture:hide",
  /** Main → Capture：聚焦输入框 */
  CAPTURE_FOCUS: "capture:focus",
  APP_OPEN_MAIN: "app:openMain",
  /** Main → Renderer：打开指定路由 */
  APP_NAVIGATE: "app:navigate",
  /** 云同步：登录 / 登出 / 状态 / 触发 / 服务器地址 / 偏好 / 测连 */
  SYNC_LOGIN: "sync:login",
  SYNC_REGISTER: "sync:register",
  SYNC_LOGOUT: "sync:logout",
  SYNC_GET_STATUS: "sync:getStatus",
  SYNC_TRIGGER: "sync:trigger",
  SYNC_SET_SERVER_URL: "sync:setServerUrl",
  SYNC_SET_PREFERENCES: "sync:setPreferences",
  SYNC_TEST_SERVER_URL: "sync:testServerUrl",
  SYNC_COMPLETE_LOGIN: "sync:completeLogin",
  SYNC_AUTH_COMPLETED: "sync:authCompleted",
  SYNC_REPORT_UI_PREFERENCES: "sync:reportUiPreferences",
  /** Main → Renderer：远端应用了 UI 偏好 */
  SYNC_UI_PREFERENCES_APPLIED: "sync:uiPreferencesApplied",
  /** 通知管理 */
  NOTIFY_GET_CONFIG: "notify:getConfig",
  NOTIFY_SET_CONFIG: "notify:setConfig",
  NOTIFY_TEST_IYUU: "notify:testIyuu",
  NOTIFY_TEST_WEBHOOK: "notify:testWebhook",
  NOTIFY_LIST_DELIVERIES: "notify:listDeliveries",
  NOTIFY_LIST_PENDING: "notify:listPending",
  /** 自动更新 */
  APP_UPDATE_GET_STATUS: "appUpdate:getStatus",
  APP_UPDATE_CHECK: "appUpdate:check",
  APP_UPDATE_QUIT_AND_INSTALL: "appUpdate:quitAndInstall",
  /** 关于页：拉取公开仓 Release 更新日志 */
  APP_UPDATE_LIST_CHANGELOG: "appUpdate:listChangelog",
  /** Main → Renderer：更新状态推送 */
  APP_UPDATE_STATUS: "appUpdate:status"
};
const EXCLUDE_DONE = {
  type: "group",
  op: "and",
  children: [{ type: "cond", field: "status", op: "in", value: ["TODO", "IN_PROGRESS"] }]
};
const TITLE_CONTAINS_BUG = {
  type: "group",
  op: "and",
  children: [{ type: "cond", field: "title", op: "contains", value: "bug" }]
};
const HAS_DUE = {
  type: "group",
  op: "and",
  children: [{ type: "cond", field: "dueAt", op: "isNotEmpty" }]
};
const VIEW_TEMPLATES = [
  {
    id: "team-planning",
    title: "Team planning",
    description: "列表视图，隐藏已完成",
    preset: {
      name: "Team planning",
      layout: "list",
      groupBy: "none",
      sortBy: "time",
      filterRule: EXCLUDE_DONE
    }
  },
  {
    id: "kanban",
    title: "Kanban",
    description: "状态看板，隐藏已完成",
    preset: {
      name: "Kanban",
      layout: "kanban",
      groupBy: "none",
      sortBy: "custom",
      filterRule: EXCLUDE_DONE,
      kanbanBoardMode: "status"
    }
  },
  {
    id: "feature-release",
    title: "Feature release",
    description: "列表按优先级排序",
    preset: {
      name: "Feature release",
      layout: "list",
      groupBy: "none",
      sortBy: "priority",
      filterRule: null
    }
  },
  {
    id: "bug-tracker",
    title: "Bug tracker",
    description: "分组看板，标题含 bug",
    preset: {
      name: "Bug tracker",
      layout: "kanban",
      groupBy: "none",
      sortBy: "custom",
      filterRule: TITLE_CONTAINS_BUG,
      kanbanBoardMode: "group"
    }
  },
  {
    id: "iterative-development",
    title: "Iterative development",
    description: "分组看板，适合迭代",
    preset: {
      name: "Iterative development",
      layout: "kanban",
      groupBy: "none",
      sortBy: "custom",
      filterRule: null,
      kanbanBoardMode: "group"
    }
  },
  {
    id: "product-launch",
    title: "Product launch",
    description: "列表按时间排序",
    preset: {
      name: "Product launch",
      layout: "list",
      groupBy: "none",
      sortBy: "time",
      filterRule: null
    }
  },
  {
    id: "roadmap",
    title: "Roadmap",
    description: "时间线，仅有截止日的任务",
    preset: {
      name: "Roadmap",
      layout: "timeline",
      groupBy: "none",
      sortBy: "time",
      filterRule: HAS_DUE
    }
  },
  {
    id: "team-retrospective",
    title: "Team retrospective",
    description: "分组看板，回顾会议",
    preset: {
      name: "Team retrospective",
      layout: "kanban",
      groupBy: "none",
      sortBy: "custom",
      filterRule: null,
      kanbanBoardMode: "group"
    }
  }
];
function getViewTemplate(id) {
  return VIEW_TEMPLATES.find((t) => t.id === id);
}
function normalizeCategoryKeyword(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 32) return null;
  return trimmed;
}
function normalizeCategoryKeywords(raw) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const item of raw ?? []) {
    const norm = normalizeCategoryKeyword(item);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(norm);
  }
  return result;
}
function parseCategoryKeywordsJson(raw) {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeCategoryKeywords(parsed.filter((x) => typeof x === "string"));
  } catch {
    return [];
  }
}
function serializeCategoryKeywords(keywords) {
  return JSON.stringify(normalizeCategoryKeywords(keywords));
}
function findCategoryKeywordConflict(keywords, allCategories, excludeCategoryId) {
  const normalizedIncoming = normalizeCategoryKeywords(keywords);
  const global = /* @__PURE__ */ new Map();
  for (const cat of allCategories) {
    if (excludeCategoryId && cat.id === excludeCategoryId) continue;
    for (const kw of cat.keywords) {
      const norm = normalizeCategoryKeyword(kw);
      if (!norm) continue;
      global.set(norm.toLowerCase(), { categoryName: cat.name, keyword: norm });
    }
  }
  for (const kw of normalizedIncoming) {
    const hit = global.get(kw.toLowerCase());
    if (hit) {
      return `关键词「${kw}」已被清单「${hit.categoryName}」使用`;
    }
  }
  return null;
}
function matchCategoryByKeywords(text, categories) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let best = null;
  for (const cat of categories) {
    for (const raw of cat.keywords ?? []) {
      const keyword = normalizeCategoryKeyword(raw);
      if (!keyword || !trimmed.includes(keyword)) continue;
      if (!best || keyword.length > best.keyword.length) {
        best = { category: cat, keyword };
      }
    }
  }
  return best?.category ?? null;
}
function resolveCreateCategoryId(rawInput, parsedCategoryId, navCategoryId, categories) {
  if (parsedCategoryId) return parsedCategoryId;
  if (navCategoryId) return navCategoryId;
  return matchCategoryByKeywords(rawInput, categories)?.id ?? null;
}
function mapRow$8(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    keywords: parseCategoryKeywordsJson(row.keywords),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}
class CategoryRepository {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare(
      `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`
    ).all();
    return rows.map(mapRow$8);
  }
  maxSortOrder() {
    const row = this.db.prepare(
      `SELECT COALESCE(MAX(sort_order), -1) as mx FROM categories WHERE deleted_at IS NULL`
    ).get();
    return row.mx;
  }
  findById(id) {
    const row = this.db.prepare(`SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL`).get(id);
    return row ? mapRow$8(row) : null;
  }
  insert(category) {
    this.db.prepare(
      `INSERT INTO categories (id, name, color, sort_order, keywords, created_at, updated_at, deleted_at)
         VALUES (@id, @name, @color, @sortOrder, @keywords, @createdAt, @updatedAt, NULL)`
    ).run({
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder,
      keywords: serializeCategoryKeywords(category.keywords),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    });
  }
  update(id, fields) {
    const existing = this.findById(id);
    if (!existing) {
      return;
    }
    const next = {
      name: fields.name ?? existing.name,
      color: fields.color !== void 0 ? fields.color : existing.color,
      sortOrder: fields.sortOrder ?? existing.sortOrder,
      keywords: fields.keywords !== void 0 ? serializeCategoryKeywords(fields.keywords) : serializeCategoryKeywords(existing.keywords),
      updatedAt: fields.updatedAt ?? existing.updatedAt
    };
    this.db.prepare(
      `UPDATE categories SET name = @name, color = @color, sort_order = @sortOrder, keywords = @keywords, updated_at = @updatedAt WHERE id = @id`
    ).run({ id, ...next });
  }
  softDelete(id, deletedAt) {
    this.db.prepare(`UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(deletedAt, deletedAt, id);
  }
  /** 软删除分类时，将关联任务的 category_id 置空 */
  clearTaskCategoryReferences(categoryId, updatedAt) {
    this.db.prepare(
      `UPDATE tasks SET category_id = NULL, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL`
    ).run(updatedAt, categoryId);
  }
}
const KANBAN_UNGROUPED_ID = "__ungrouped__";
function kanbanUngroupedMetaId(scopeKey) {
  return `${KANBAN_UNGROUPED_ID}:${scopeKey}`;
}
function isKanbanUngroupedMetaId(id) {
  return id.startsWith(`${KANBAN_UNGROUPED_ID}:`);
}
function mapRow$7(row) {
  return {
    id: row.id,
    scopeKey: row.scope_key,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
class KanbanGroupRepository {
  constructor(db) {
    this.db = db;
  }
  /** 全部看板自定义分组（任务导出用） */
  listAll() {
    const rows = this.db.prepare(`SELECT * FROM kanban_groups ORDER BY scope_key ASC, sort_order ASC`).all();
    return rows.map(mapRow$7);
  }
  listByScope(scopeKey) {
    const rows = this.db.prepare(
      `SELECT * FROM kanban_groups WHERE scope_key = ? ORDER BY sort_order ASC, created_at ASC`
    ).all(scopeKey);
    return rows.map(mapRow$7);
  }
  findById(id) {
    const row = this.db.prepare(`SELECT * FROM kanban_groups WHERE id = ?`).get(id);
    return row ? mapRow$7(row) : null;
  }
  maxSortOrder(scopeKey) {
    const row = this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM kanban_groups WHERE scope_key = ?`).get(scopeKey);
    return row.mx;
  }
  insert(group) {
    this.db.prepare(
      `INSERT INTO kanban_groups (id, scope_key, name, sort_order, created_at, updated_at)
         VALUES (@id, @scopeKey, @name, @sortOrder, @createdAt, @updatedAt)`
    ).run({
      id: group.id,
      scopeKey: group.scopeKey,
      name: group.name,
      sortOrder: group.sortOrder,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    });
  }
  update(group) {
    this.db.prepare(
      `UPDATE kanban_groups SET name = @name, sort_order = @sortOrder, updated_at = @updatedAt WHERE id = @id`
    ).run({
      id: group.id,
      name: group.name,
      sortOrder: group.sortOrder,
      updatedAt: group.updatedAt
    });
  }
  delete(id) {
    this.db.prepare(`DELETE FROM kanban_groups WHERE id = ?`).run(id);
  }
  /** 删除分组后任务归入未分组 */
  clearTasksGroupId(groupId) {
    this.db.prepare(`UPDATE tasks SET kanban_group_id = NULL WHERE kanban_group_id = ?`).run(groupId);
  }
  shiftSortOrders(scopeKey, fromOrder, delta) {
    const excludeMeta = `AND id NOT LIKE '__ungrouped__:%'`;
    if (delta > 0) {
      this.db.prepare(
        `UPDATE kanban_groups SET sort_order = sort_order + ?
           WHERE scope_key = ? AND sort_order >= ? ${excludeMeta}`
      ).run(delta, scopeKey, fromOrder);
    } else {
      this.db.prepare(
        `UPDATE kanban_groups SET sort_order = sort_order + ?
           WHERE scope_key = ? AND sort_order > ? ${excludeMeta}`
      ).run(delta, scopeKey, fromOrder);
    }
  }
  /** 仅统计用户自定义列的最大 sort_order（不含未分组元数据行） */
  maxCustomSortOrder(scopeKey) {
    const rows = this.db.prepare(`SELECT sort_order FROM kanban_groups WHERE scope_key = ?`).all(scopeKey);
    let max = -1;
    for (const row of rows) {
      if (row.sort_order > max) max = row.sort_order;
    }
    return max;
  }
  listCustomByScope(scopeKey) {
    return this.listByScope(scopeKey).filter((g) => !isKanbanUngroupedMetaId(g.id));
  }
}
function mapRow$6(row) {
  const source = row.source;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    taskId: row.task_id,
    source: source === "task_reminder" || source === "scheduled_summary" ? source : null,
    readAt: row.read_at,
    createdAt: row.created_at
  };
}
class AppMessageRepository {
  constructor(db) {
    this.db = db;
  }
  list(kind, limit = 100, source) {
    if (kind && source) {
      const rows2 = this.db.prepare(
        `SELECT * FROM app_messages WHERE kind = ? AND source = ? ORDER BY created_at DESC LIMIT ?`
      ).all(kind, source, limit);
      return rows2.map(mapRow$6);
    }
    if (kind) {
      const rows2 = this.db.prepare(
        `SELECT * FROM app_messages WHERE kind = ? ORDER BY created_at DESC LIMIT ?`
      ).all(kind, limit);
      return rows2.map(mapRow$6);
    }
    const rows = this.db.prepare(`SELECT * FROM app_messages ORDER BY created_at DESC LIMIT ?`).all(limit);
    return rows.map(mapRow$6);
  }
  countUnread(kind) {
    if (kind) {
      const row2 = this.db.prepare(`SELECT COUNT(*) as cnt FROM app_messages WHERE kind = ? AND read_at IS NULL`).get(kind);
      return row2.cnt;
    }
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM app_messages WHERE read_at IS NULL`).get();
    return row.cnt;
  }
  findById(id) {
    const row = this.db.prepare(`SELECT * FROM app_messages WHERE id = ?`).get(id);
    return row ? mapRow$6(row) : null;
  }
  insert(message) {
    this.db.prepare(
      `INSERT INTO app_messages (id, kind, title, body, task_id, source, read_at, created_at)
         VALUES (@id, @kind, @title, @body, @taskId, @source, @readAt, @createdAt)`
    ).run({
      id: message.id,
      kind: message.kind,
      title: message.title,
      body: message.body,
      taskId: message.taskId,
      source: message.source,
      readAt: message.readAt,
      createdAt: message.createdAt
    });
  }
  markRead(id, readAt) {
    this.db.prepare(`UPDATE app_messages SET read_at = ? WHERE id = ? AND read_at IS NULL`).run(
      readAt,
      id
    );
  }
  markAllRead(kind, readAt) {
    if (kind) {
      const result2 = this.db.prepare(`UPDATE app_messages SET read_at = ? WHERE kind = ? AND read_at IS NULL`).run(readAt, kind);
      return result2.changes;
    }
    const result = this.db.prepare(`UPDATE app_messages SET read_at = ? WHERE read_at IS NULL`).run(readAt);
    return result.changes;
  }
  upsertFromSync(message) {
    this.db.prepare(
      `INSERT INTO app_messages (id, kind, title, body, task_id, source, read_at, created_at)
         VALUES (@id, @kind, @title, @body, @taskId, @source, @readAt, @createdAt)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind,
           title = excluded.title,
           body = excluded.body,
           task_id = excluded.task_id,
           source = excluded.source,
           read_at = excluded.read_at,
           created_at = excluded.created_at`
    ).run({
      id: message.id,
      kind: message.kind,
      title: message.title,
      body: message.body,
      taskId: message.taskId,
      source: message.source,
      readAt: message.readAt,
      createdAt: message.createdAt
    });
  }
  deleteById(id) {
    this.db.prepare(`DELETE FROM app_messages WHERE id = ?`).run(id);
  }
}
function remindAtFromDueOffset(dueAt, offsetMinutes) {
  return dayjs(dueAt).subtract(offsetMinutes, "minute").format("YYYY-MM-DDTHH:mm:ss");
}
function assertRemindersBeforeDue(reminders, dueAt) {
  if (!dueAt) return null;
  for (const r of reminders) {
    if (r.remindAt > dueAt) {
      return "提醒时间不能晚于到期时间";
    }
  }
  return null;
}
function buildRemindersFromOffsets(dueAt, offsetMinutesList) {
  const unique = [...new Set(offsetMinutesList)].sort((a, b) => b - a);
  return unique.map((minutes) => ({
    remindAt: remindAtFromDueOffset(dueAt, minutes),
    offsetMinutes: minutes
  }));
}
function primaryRemindAt(reminders) {
  if (!reminders.length) return null;
  const sorted = [...reminders].sort((a, b) => a.remindAt.localeCompare(b.remindAt));
  return sorted[0]?.remindAt ?? null;
}
function parseRecurrenceRule(json) {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    const type = parsed?.type;
    if (!type || type === "none") return null;
    if (type === "ebbinghaus") return null;
    return parsed;
  } catch {
    return null;
  }
}
function serializeRecurrenceRule(rule) {
  if (!rule || rule.type === "none") return null;
  return JSON.stringify(rule);
}
function nextDueAfterRecurrence(dueAt, rule) {
  const d = dayjs(dueAt);
  if (!d.isValid()) return null;
  switch (rule.type) {
    case "daily":
      return d.add(1, "day").format("YYYY-MM-DDTHH:mm:ss");
    case "weekly":
      return d.add(1, "week").format("YYYY-MM-DDTHH:mm:ss");
    case "monthly":
      return d.add(1, "month").format("YYYY-MM-DDTHH:mm:ss");
    case "yearly":
      return d.add(1, "year").format("YYYY-MM-DDTHH:mm:ss");
    case "workdays": {
      let next = d.add(1, "day");
      while (next.day() === 0 || next.day() === 6) {
        next = next.add(1, "day");
      }
      return next.format("YYYY-MM-DDTHH:mm:ss");
    }
    case "weekend": {
      let next = d.add(1, "day");
      while (next.day() !== 0 && next.day() !== 6) {
        next = next.add(1, "day");
      }
      return next.format("YYYY-MM-DDTHH:mm:ss");
    }
    case "custom": {
      const n = rule.interval ?? 1;
      const unit = rule.unit ?? "day";
      return d.add(n, unit).format("YYYY-MM-DDTHH:mm:ss");
    }
    case "legal_holidays":
      return null;
    default:
      return null;
  }
}
function mapRow$5(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    remindAt: row.remind_at,
    firedAt: row.fired_at,
    offsetMinutes: row.offset_minutes
  };
}
class TaskReminderRepository {
  constructor(db) {
    this.db = db;
  }
  listByTaskId(taskId) {
    const rows = this.db.prepare(
      `SELECT * FROM task_reminders WHERE task_id = ? ORDER BY remind_at ASC`
    ).all(taskId);
    return rows.map(mapRow$5);
  }
  listByTaskIds(taskIds) {
    const map = /* @__PURE__ */ new Map();
    if (!taskIds.length) return map;
    const placeholders = taskIds.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT * FROM task_reminders WHERE task_id IN (${placeholders}) ORDER BY remind_at ASC`).all(...taskIds);
    for (const row of rows) {
      const item = mapRow$5(row);
      const list = map.get(row.task_id) ?? [];
      list.push(item);
      map.set(row.task_id, list);
    }
    return map;
  }
  replaceForTask(taskId, items, createdAt) {
    const del = this.db.prepare(`DELETE FROM task_reminders WHERE task_id = ?`);
    const insert = this.db.prepare(
      `INSERT INTO task_reminders (id, task_id, remind_at, fired_at, offset_minutes, created_at)
       VALUES (@id, @taskId, @remindAt, NULL, @offsetMinutes, @createdAt)`
    );
    const tx = this.db.transaction(() => {
      del.run(taskId);
      const result = [];
      for (const item of items) {
        const id = uuid.v4();
        insert.run({
          id,
          taskId,
          remindAt: item.remindAt,
          offsetMinutes: item.offsetMinutes ?? null,
          createdAt
        });
        result.push({
          id,
          taskId,
          remindAt: item.remindAt,
          firedAt: null,
          offsetMinutes: item.offsetMinutes ?? null
        });
      }
      return result;
    });
    return tx();
  }
  deleteByTaskId(taskId) {
    this.db.prepare(`DELETE FROM task_reminders WHERE task_id = ?`).run(taskId);
  }
  findDue(nowIso2) {
    const rows = this.db.prepare(
      `SELECT r.* FROM task_reminders r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE t.deleted_at IS NULL
           AND t.status != 'DONE'
           AND r.remind_at <= ?
           AND r.fired_at IS NULL`
    ).all(nowIso2);
    return rows.map(mapRow$5);
  }
  markFired(id, firedAt) {
    this.db.prepare(`UPDATE task_reminders SET fired_at = ? WHERE id = ?`).run(firedAt, id);
  }
  clearFiredForTask(taskId) {
    this.db.prepare(`UPDATE task_reminders SET fired_at = NULL WHERE task_id = ?`).run(taskId);
  }
  /** 循环后按偏移重建提醒时间 */
  rebuildOffsetsForTask(taskId, newDueAt) {
    const rows = this.db.prepare(`SELECT id, offset_minutes FROM task_reminders WHERE task_id = ? AND offset_minutes IS NOT NULL`).all(taskId);
    const update = this.db.prepare(`UPDATE task_reminders SET remind_at = ?, fired_at = NULL WHERE id = ?`);
    for (const row of rows) {
      const remindAt = remindAtFromDueOffset(newDueAt, row.offset_minutes);
      update.run(remindAt, row.id);
    }
  }
}
function isDueSmartList(smart) {
  return smart === "today" || smart === "week" || smart === "last7days";
}
function startOfWeekMonday(base = dayjs()) {
  const day = base.day();
  const offset = day === 0 ? -6 : 1 - day;
  return base.add(offset, "day").startOf("day");
}
function endOfWeekSunday(base = dayjs()) {
  return startOfWeekMonday(base).add(6, "day").endOf("day");
}
function endOfDayIso(d) {
  return `${d.format("YYYY-MM-DD")}T23:59:59`;
}
function dueCutoffIsoForSmartList(smart, base = dayjs()) {
  switch (smart) {
    case "today":
      return endOfDayIso(base);
    case "week":
      return endOfDayIso(endOfWeekSunday(base));
    case "last7days":
      return endOfDayIso(base.add(6, "day"));
  }
}
function resolveTaskCompletedAt(task) {
  if (task.status !== "DONE") return null;
  return task.completedAt ?? task.updatedAt ?? null;
}
function startOfDayIso(d) {
  return `${d.format("YYYY-MM-DD")}T00:00:00`;
}
function resolveTaskDateIso(task, field) {
  if (field === "dueAt") return task.dueAt;
  if (field === "createdAt") return task.createdAt;
  if (field === "completedAt") return resolveTaskCompletedAt(task);
  return null;
}
function smartListDateBounds(smart, dateField, base = dayjs()) {
  if (smart === "today") {
    return { from: startOfDayIso(base), to: endOfDayIso(base) };
  }
  if (smart === "week") {
    const start = startOfWeekMonday(base);
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) };
  }
  return {
    from: startOfDayIso(base),
    to: endOfDayIso(base.add(6, "day"))
  };
}
function doneTimeRangeBounds(range, base = dayjs(), custom) {
  if (range === "all") return null;
  if (range === "today") {
    return { from: startOfDayIso(base), to: endOfDayIso(base) };
  }
  if (range === "week") {
    const start = startOfWeekMonday(base);
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) };
  }
  if (range === "month") {
    return {
      from: startOfDayIso(base.startOf("month")),
      to: endOfDayIso(base.endOf("month"))
    };
  }
  if (range === "custom" && custom?.from && custom?.to) {
    const fromD = dayjs(custom.from.slice(0, 10));
    const toD = dayjs(custom.to.slice(0, 10));
    if (!fromD.isValid() || !toD.isValid()) return null;
    return { from: startOfDayIso(fromD), to: endOfDayIso(toD) };
  }
  return null;
}
const HIDE_DONE_SCOPE_OPTIONS = ["off", "all", "today", "week", "month"];
const VALID_SCOPES = new Set(HIDE_DONE_SCOPE_OPTIONS);
function hideDoneScopeFromLegacy(hideDone) {
  if (hideDone === false) return "off";
  return "all";
}
function resolveHideDoneScope(filter) {
  if (filter.hideDoneScope && VALID_SCOPES.has(filter.hideDoneScope)) {
    return filter.hideDoneScope;
  }
  return hideDoneScopeFromLegacy(filter.hideDone);
}
function hideDoneScopeSqlClause(scope, base = dayjs()) {
  if (scope === "off") return null;
  if (scope === "all") {
    return { sql: `status != 'DONE'`, params: {} };
  }
  const bounds = doneTimeRangeBounds(scope, base);
  if (!bounds) return null;
  return {
    sql: `(status != 'DONE' OR COALESCE(completed_at, updated_at) < @hideDoneFrom OR COALESCE(completed_at, updated_at) > @hideDoneTo)`,
    params: {
      hideDoneFrom: bounds.from,
      hideDoneTo: bounds.to
    }
  };
}
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeCompletedOccurrenceDates(dates) {
  if (!dates?.length) return [];
  const set = /* @__PURE__ */ new Set();
  for (const d of dates) {
    if (typeof d === "string" && DATE_KEY_RE.test(d)) set.add(d);
  }
  return [...set].sort();
}
function parseCompletedOccurrenceDates(raw) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeCompletedOccurrenceDates(parsed.filter((x) => typeof x === "string"));
  } catch {
    return [];
  }
}
function serializeCompletedOccurrenceDates(dates) {
  const list = normalizeCompletedOccurrenceDates(dates);
  return list.length ? JSON.stringify(list) : null;
}
const DEFAULT_TASK_PRIORITY = 4;
const TASK_PRIORITIES = [
  {
    value: 1,
    code: "P0",
    label: "重要且紧急",
    flagLabel: "P0",
    quadrantTitle: "重要且紧急",
    color: "#f56c6c",
    flagColor: "#f56c6c",
    flagOutline: false,
    roman: "Ⅰ"
  },
  {
    value: 2,
    code: "P1",
    label: "重要不紧急",
    flagLabel: "P1",
    quadrantTitle: "重要不紧急",
    color: "#e6a23c",
    flagColor: "#e6a23c",
    flagOutline: false,
    roman: "Ⅱ"
  },
  {
    value: 3,
    code: "P2",
    label: "不重要但紧急",
    flagLabel: "P2",
    quadrantTitle: "不重要但紧急",
    color: "#409eff",
    flagColor: "#409eff",
    flagOutline: false,
    roman: "Ⅲ"
  },
  {
    value: 4,
    code: "P3",
    label: "不重要不紧急",
    flagLabel: "P3",
    quadrantTitle: "不重要不紧急",
    color: "#909399",
    flagColor: "#909399",
    flagOutline: true,
    roman: "Ⅳ"
  }
];
function isValidTaskPriority(value) {
  return value >= 1 && value <= 4 && Number.isInteger(value);
}
function coerceTaskPriority(value, fallback = DEFAULT_TASK_PRIORITY) {
  if (value == null || value === "") {
    return fallback;
  }
  const n = typeof value === "number" ? value : Number(value);
  return isValidTaskPriority(n) ? n : fallback;
}
function normalizeTaskPriority(value) {
  return coerceTaskPriority(value, DEFAULT_TASK_PRIORITY);
}
function getTaskPriorityMeta(priority) {
  return TASK_PRIORITIES.find((p) => p.value === priority) ?? TASK_PRIORITIES[3];
}
function mapRow$4(row, reminders = []) {
  parseRecurrenceRule(row.recurrence_rule);
  const syncedReminders = reminders;
  const legacyRemind = primaryRemindAt(syncedReminders) ?? row.remind_at;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: normalizeTaskPriority(row.priority),
    categoryId: row.category_id,
    parentId: row.parent_id,
    startAt: row.start_at ?? null,
    dueAt: row.due_at,
    remindAt: legacyRemind,
    remindFiredAt: row.remind_fired_at,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    syncVersion: row.sync_version,
    kanbanGroupId: row.kanban_group_id ?? null,
    reminders: syncedReminders,
    recurrence: parseRecurrenceRule(row.recurrence_rule ?? null),
    completedOccurrenceDates: parseCompletedOccurrenceDates(row.completed_occurrence_dates),
    remindContinuous: (row.remind_continuous ?? 0) === 1,
    triagedAt: row.triaged_at ?? null
  };
}
function sqlBind(params) {
  const out = { ...params };
  for (const key of Object.keys(out)) {
    if (out[key] === void 0) {
      out[key] = null;
    }
  }
  return out;
}
function boundsForSmartListNonDue(smart) {
  const raw = smartListDateBounds(smart);
  if (!("from" in raw)) {
    throw new Error("expected closed range for non-due smart list");
  }
  return raw;
}
class TaskRepository {
  constructor(db) {
    this.db = db;
  }
  list(filter = {}) {
    const isTrash = filter.smartList === "trash";
    const clauses = isTrash ? ["deleted_at IS NOT NULL"] : ["deleted_at IS NULL"];
    const params = {};
    if (isTrash) {
      if (filter.search?.trim()) {
        clauses.push("LOWER(title) LIKE @search");
        params.search = `%${filter.search.trim().toLowerCase()}%`;
      }
      const sql2 = `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY deleted_at DESC, updated_at DESC`;
      const rows2 = this.db.prepare(sql2).all(sqlBind(params));
      return rows2.map(mapRow$4);
    }
    if (filter.smartList !== "done") {
      const hideClause = hideDoneScopeSqlClause(
        resolveHideDoneScope(filter),
        dayjs()
      );
      if (hideClause) {
        clauses.push(hideClause.sql);
        Object.assign(params, hideClause.params);
      }
    }
    if (filter.status) {
      clauses.push("status = @status");
      params.status = filter.status;
    }
    if (filter.categoryId !== void 0) {
      if (filter.categoryId === null) {
        clauses.push("category_id IS NULL AND parent_id IS NULL");
      } else {
        clauses.push(`(
          category_id = @categoryId
          OR parent_id IN (
            SELECT id FROM tasks
            WHERE category_id = @categoryId AND deleted_at IS NULL
          )
        )`);
        params.categoryId = filter.categoryId;
      }
    }
    if (filter.parentId !== void 0) {
      if (filter.parentId === null) {
        clauses.push("parent_id IS NULL");
      } else {
        clauses.push("parent_id = @parentId");
        params.parentId = filter.parentId;
      }
    }
    if (filter.search?.trim()) {
      clauses.push("LOWER(title) LIKE @search");
      params.search = `%${filter.search.trim().toLowerCase()}%`;
    }
    if (filter.smartList === "done") {
      clauses.push(`status = 'DONE'`);
      const doneBounds = doneTimeRangeBounds(filter.doneTimeRange ?? "all", dayjs(), {
        from: filter.dateFrom,
        to: filter.dateTo
      });
      if (doneBounds) {
        clauses.push(
          `COALESCE(completed_at, updated_at) >= @doneFrom AND COALESCE(completed_at, updated_at) <= @doneTo`
        );
        params.doneFrom = doneBounds.from;
        params.doneTo = doneBounds.to;
      }
    } else if (isDueSmartList(filter.smartList)) {
      const dateField = filter.dateField ?? "dueAt";
      if (dateField === "dueAt") {
        clauses.push(`status != 'DONE'`);
        clauses.push(`due_at IS NOT NULL AND due_at <= @dueCutoff`);
        params.dueCutoff = dueCutoffIsoForSmartList(filter.smartList);
      } else if (dateField === "createdAt") {
        clauses.push(`status != 'DONE'`);
        clauses.push(`created_at >= @smartFrom AND created_at <= @smartTo`);
        const bounds = boundsForSmartListNonDue(filter.smartList);
        params.smartFrom = bounds.from;
        params.smartTo = bounds.to;
      } else {
        clauses.push(`status = 'DONE'`);
        clauses.push(
          `COALESCE(completed_at, updated_at) >= @smartFrom AND COALESCE(completed_at, updated_at) <= @smartTo`
        );
        const bounds = boundsForSmartListNonDue(filter.smartList);
        params.smartFrom = bounds.from;
        params.smartTo = bounds.to;
      }
    }
    const orderBy = filter.smartList === "done" ? "completed_at DESC, updated_at DESC, sort_order ASC" : "sort_order ASC, created_at DESC";
    const sql = `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy}`;
    const rows = this.db.prepare(sql).all(sqlBind(params));
    return rows.map(mapRow$4);
  }
  findById(id) {
    if (!id) {
      return null;
    }
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL`).get(id);
    return row ? mapRow$4(row) : null;
  }
  /** 含已软删除记录，供垃圾桶详情与恢复 */
  findByIdIncludingDeleted(id) {
    if (!id) {
      return null;
    }
    const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
    return row ? mapRow$4(row) : null;
  }
  countTrash() {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NOT NULL`).get();
    return row.cnt;
  }
  /** 未删除的已完成任务数（侧栏「有内容时显示」用） */
  countDone() {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL AND status = 'DONE'`).get();
    return row.cnt;
  }
  findDeletedChildrenByParentId(parentId) {
    const rows = this.db.prepare(`SELECT * FROM tasks WHERE parent_id = ? AND deleted_at IS NOT NULL`).all(parentId);
    return rows.map(mapRow$4);
  }
  restore(id, updatedAt) {
    this.db.prepare(`UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`).run(updatedAt, id);
  }
  /** 恢复前若父任务已不存在，解除 parent 关联（任务仍在垃圾桶中） */
  clearParentOnDeleted(id, updatedAt) {
    this.db.prepare(
      `UPDATE tasks SET parent_id = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`
    ).run(updatedAt, id);
  }
  hardDelete(id) {
    this.db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  }
  hardDeleteAllTrash() {
    const result = this.db.prepare(`DELETE FROM tasks WHERE deleted_at IS NOT NULL`).run();
    return result.changes;
  }
  maxSortOrder() {
    const row = this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM tasks WHERE deleted_at IS NULL`).get();
    return row.mx;
  }
  insert(task) {
    this.db.prepare(
      `INSERT INTO tasks (
          id, title, description, status, priority, category_id, parent_id,
          start_at, due_at, remind_at, remind_fired_at, completed_at, sort_order,
          created_at, updated_at, deleted_at, sync_version, kanban_group_id,
          recurrence_rule, remind_continuous, completed_occurrence_dates, triaged_at
        ) VALUES (
          @id, @title, @description, @status, @priority, @categoryId, @parentId,
          @startAt, @dueAt, @remindAt, @remindFiredAt, @completedAt, @sortOrder,
          @createdAt, @updatedAt, NULL, @syncVersion, @kanbanGroupId,
          @recurrenceRule, @remindContinuous, @completedOccurrenceDates, @triagedAt
        )`
    ).run(
      sqlBind({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        categoryId: task.categoryId,
        parentId: task.parentId,
        startAt: task.startAt,
        dueAt: task.dueAt,
        remindAt: task.remindAt,
        remindFiredAt: task.remindFiredAt,
        completedAt: task.completedAt,
        sortOrder: task.sortOrder,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        syncVersion: task.syncVersion,
        kanbanGroupId: task.kanbanGroupId,
        recurrenceRule: serializeRecurrenceRule(task.recurrence),
        remindContinuous: task.remindContinuous ? 1 : 0,
        completedOccurrenceDates: serializeCompletedOccurrenceDates(task.completedOccurrenceDates),
        triagedAt: task.triagedAt
      })
    );
  }
  update(task) {
    this.db.prepare(
      `UPDATE tasks SET
          title = @title, description = @description, status = @status,
          priority = @priority, category_id = @categoryId, parent_id = @parentId,
          start_at = @startAt, due_at = @dueAt, remind_at = @remindAt, remind_fired_at = @remindFiredAt,
          completed_at = @completedAt, sort_order = @sortOrder, updated_at = @updatedAt,
          sync_version = @syncVersion,
          kanban_group_id = @kanbanGroupId,
          recurrence_rule = @recurrenceRule, remind_continuous = @remindContinuous,
          completed_occurrence_dates = @completedOccurrenceDates, triaged_at = @triagedAt
         WHERE id = @id AND deleted_at IS NULL`
    ).run(
      sqlBind({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        categoryId: task.categoryId,
        parentId: task.parentId,
        startAt: task.startAt,
        dueAt: task.dueAt,
        remindAt: task.remindAt,
        remindFiredAt: task.remindFiredAt,
        completedAt: task.completedAt,
        sortOrder: task.sortOrder,
        updatedAt: task.updatedAt,
        syncVersion: task.syncVersion,
        kanbanGroupId: task.kanbanGroupId,
        recurrenceRule: serializeRecurrenceRule(task.recurrence),
        remindContinuous: task.remindContinuous ? 1 : 0,
        completedOccurrenceDates: serializeCompletedOccurrenceDates(task.completedOccurrenceDates),
        triagedAt: task.triagedAt
      })
    );
  }
  softDelete(id, deletedAt, syncVersion) {
    if (syncVersion !== void 0) {
      this.db.prepare(
        `UPDATE tasks SET deleted_at = ?, updated_at = ?, sync_version = ? WHERE id = ?`
      ).run(deletedAt, deletedAt, syncVersion, id);
      return;
    }
    this.db.prepare(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(deletedAt, deletedAt, id);
  }
  countChildren(parentId) {
    const row = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM tasks
         WHERE parent_id = ? AND deleted_at IS NULL`
    ).get(parentId);
    return row.cnt;
  }
  /** 直接子任务列表（未删除） */
  findChildrenByParentId(parentId) {
    const rows = this.db.prepare(`SELECT * FROM tasks WHERE parent_id = ? AND deleted_at IS NULL`).all(parentId);
    return rows.map(mapRow$4);
  }
  countOpenChildren(parentId) {
    const row = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM tasks
         WHERE parent_id = ? AND deleted_at IS NULL AND status != 'DONE'`
    ).get(parentId);
    return row.cnt;
  }
  promoteChildren(parentId, updatedAt) {
    this.db.prepare(
      `UPDATE tasks SET parent_id = NULL, updated_at = ?
         WHERE parent_id = ? AND deleted_at IS NULL`
    ).run(updatedAt, parentId);
  }
  /** 提醒扫描：到期且未触发、未完成、未删除 */
  findDueReminders(nowIso2) {
    const rows = this.db.prepare(
      `SELECT * FROM tasks
         WHERE deleted_at IS NULL
           AND status != 'DONE'
           AND remind_at IS NOT NULL
           AND remind_at <= ?
           AND remind_fired_at IS NULL`
    ).all(nowIso2);
    return rows.map(mapRow$4);
  }
  markRemindFired(id, firedAt) {
    this.db.prepare(`UPDATE tasks SET remind_fired_at = ?, updated_at = ? WHERE id = ?`).run(firedAt, firedAt, id);
  }
  /** 按完成时间区间查询已完成任务（供定时汇总） */
  listCompletedInRange(from, to, categoryIds, dueBetween) {
    const clauses = [
      `deleted_at IS NULL`,
      `status = 'DONE'`,
      `COALESCE(completed_at, updated_at) >= @from`,
      `COALESCE(completed_at, updated_at) < @to`
    ];
    const params = { from, to };
    if (dueBetween) {
      clauses.push(`due_at IS NOT NULL`, `due_at >= @dueFrom`, `due_at <= @dueTo`);
      params.dueFrom = dueBetween.from;
      params.dueTo = dueBetween.to;
    }
    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map((_, i) => `@cat${i}`).join(", ");
      clauses.push(`category_id IN (${placeholders})`);
      categoryIds.forEach((id, i) => {
        params[`cat${i}`] = id;
      });
    }
    const sql = `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY completed_at DESC, updated_at DESC`;
    const rows = this.db.prepare(sql).all(params);
    return rows.map(mapRow$4);
  }
  /** 按区块配置查询任务（供定时汇总） */
  listForSummaryReport(filter, from, to, categoryIds, options) {
    if (filter === "completed") {
      return this.listCompletedInRange(from, to, categoryIds, options?.dueBetween);
    }
    const clauses = [`deleted_at IS NULL`, `status != 'DONE'`];
    const params = { from, to };
    const dueBetween = options?.dueBetween;
    if (dueBetween) {
      clauses.push(`due_at IS NOT NULL`, `due_at >= @dueFrom`, `due_at <= @dueTo`);
      params.dueFrom = dueBetween.from;
      params.dueTo = dueBetween.to;
      if (filter === "overdue") {
        clauses.push(`due_at < @to`);
      }
    } else if (filter === "overdue") {
      clauses.push(`due_at IS NOT NULL`, `due_at < @to`);
    } else {
      clauses.push(`(due_at IS NULL OR due_at >= @to)`);
      clauses.push(`(
        (due_at IS NOT NULL AND due_at >= @from)
        OR (due_at IS NULL AND created_at >= @from AND created_at < @to)
      )`);
    }
    if (categoryIds && categoryIds.length > 0) {
      const placeholders = categoryIds.map((_, i) => `@cat${i}`).join(", ");
      clauses.push(`category_id IN (${placeholders})`);
      categoryIds.forEach((id, i) => {
        params[`cat${i}`] = id;
      });
    }
    const orderBy = filter === "overdue" ? "due_at ASC, updated_at DESC" : "CASE WHEN due_at IS NULL THEN 1 ELSE 0 END, due_at ASC, created_at DESC, updated_at DESC";
    const sql = `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy}`;
    const rows = this.db.prepare(sql).all(params);
    return rows.map(mapRow$4);
  }
}
const TIME_FIELDS = ["dueAt", "createdAt", "completedAt"];
function createEmptyAndGroup() {
  return { type: "group", op: "and", children: [] };
}
function normalizeFilterNode(node) {
  if (!node || typeof node !== "object") return createEmptyAndGroup();
  if (node.type === "group") {
    const children = (node.children ?? []).map((c) => normalizeFilterNode(c)).filter((c) => {
      if (c.type === "group") return c.children.length > 0;
      return true;
    });
    return {
      type: "group",
      op: node.op === "or" ? "or" : "and",
      not: node.not ? true : void 0,
      children
    };
  }
  return {
    type: "cond",
    field: node.field,
    op: node.op,
    value: node.value
  };
}
function validateFilterNode(node) {
  const n = normalizeFilterNode(node);
  return validateNodeRecursive(n);
}
function validateNodeRecursive(node) {
  if (node.type === "group") {
    if (node.children.length === 0) {
      return "条件组不能为空";
    }
    for (const child of node.children) {
      const err = validateNodeRecursive(child);
      if (err) return err;
    }
    return null;
  }
  return validateCond(node);
}
function validateCond(cond) {
  const { field, op, value } = cond;
  if (op === "isEmpty" || op === "isNotEmpty" || op === "isTrue" || op === "isFalse") {
    return null;
  }
  if (field === "category" && op === "in") {
    if (!Array.isArray(value) || value.length === 0) return "请选择至少一个清单";
    return null;
  }
  if (field === "priority" && (op === "in" || op === "eq")) {
    if (op === "in" && (!Array.isArray(value) || value.length === 0)) return "请选择优先级";
    if (op === "eq" && (typeof value !== "number" || value < 1 || value > 4)) return "优先级无效";
    return null;
  }
  if (field === "status" && (op === "in" || op === "eq" || op === "neq")) {
    if (op === "in" && (!Array.isArray(value) || value.length === 0)) return "请选择状态";
    if ((op === "eq" || op === "neq") && typeof value !== "string") return "状态无效";
    return null;
  }
  if (TIME_FIELDS.includes(field)) {
    if (op === "rel") {
      if (typeof value !== "string" || !value) return "请选择时间范围";
      return null;
    }
    if (op === "between") {
      const v = value;
      if (!v?.from || !v?.to) return "请填写起止日期";
      return null;
    }
  }
  if (field === "title" && (op === "contains" || op === "notContains")) {
    if (typeof value !== "string" || !value.trim()) return "请输入标题关键词";
    return null;
  }
  if (field === "kanbanGroup" && op === "eq") {
    if (value !== null && typeof value !== "string") return "看板分组无效";
    return null;
  }
  if (field === "hasSubtasks" || field === "hasRecurrence") {
    if (op !== "isTrue" && op !== "isFalse" && op !== "eq") return "运算符不适用于该字段";
    return null;
  }
  return null;
}
function parseFilterAstJson(raw) {
  const parsed = JSON.parse(raw);
  return normalizeFilterNode(parsed);
}
function serializeFilterAst(node) {
  return JSON.stringify(normalizeFilterNode(node));
}
function matchTask(task, node, ctx = {}) {
  const tree = normalizeFilterNode(node);
  if (tree.type === "group" && tree.children.length === 0) {
    return true;
  }
  return evalNode(task, tree, ctx);
}
function evalNode(task, node, ctx) {
  if (node.type === "group") {
    const results = node.children.map((c) => evalNode(task, c, ctx));
    let ok = node.op === "and" ? results.every(Boolean) : results.some(Boolean);
    if (node.not) ok = !ok;
    return ok;
  }
  return evalCond(task, node, ctx);
}
function evalCond(task, cond, ctx) {
  const { field, op, value } = cond;
  switch (field) {
    case "category":
      return matchCategory$1(task, op, value);
    case "priority":
      return matchPriority(task, op, value);
    case "status":
      return matchStatus(task, op, value);
    case "dueAt":
    case "createdAt":
    case "completedAt":
      return matchTimeField(task, field, op, value, ctx);
    case "title":
      return matchTitle(task, op, value);
    case "hasSubtasks":
      return matchHasSubtasks(task, op, value, ctx);
    case "hasRecurrence":
      return matchHasRecurrence(task, op, value);
    case "kanbanGroup":
      return matchKanbanGroup(task, op, value);
    default:
      return false;
  }
}
function matchCategory$1(task, op, value) {
  const cat = task.categoryId;
  if (op === "isEmpty") return cat == null;
  if (op === "isNotEmpty") return cat != null;
  if (op === "in" && Array.isArray(value)) {
    return value.some((v) => v === "__uncategorized__" ? cat == null : v === cat);
  }
  if (op === "eq") {
    if (value === "__uncategorized__" || value === null) return cat == null;
    return cat === value;
  }
  return false;
}
function matchPriority(task, op, value) {
  const p = task.priority;
  if (op === "eq") return p === value;
  if (op === "in" && Array.isArray(value)) return value.includes(p);
  if (op === "neq") return p !== value;
  return false;
}
function matchStatus(task, op, value) {
  const s = task.status;
  if (op === "eq") return s === value;
  if (op === "in" && Array.isArray(value)) return value.includes(s);
  if (op === "neq") return s !== value;
  return false;
}
function matchTitle(task, op, value) {
  const t = task.title.toLowerCase();
  const q = String(value ?? "").trim().toLowerCase();
  if (op === "contains") return q.length > 0 && t.includes(q);
  if (op === "notContains") return q.length > 0 && !t.includes(q);
  if (op === "isEmpty") return !task.title.trim();
  if (op === "isNotEmpty") return Boolean(task.title.trim());
  return false;
}
function matchHasSubtasks(task, op, value, ctx) {
  const has = ctx.hasSubtasksById?.get(task.id) ?? false;
  if (op === "isTrue" || op === "eq" && value === true) return has;
  if (op === "isFalse" || op === "eq" && value === false) return !has;
  return false;
}
function matchHasRecurrence(task, op, value) {
  const has = Boolean(task.recurrence && task.recurrence.type !== "none");
  if (op === "isTrue" || op === "eq" && value === true) return has;
  if (op === "isFalse" || op === "eq" && value === false) return !has;
  return false;
}
function matchKanbanGroup(task, op, value) {
  const gid = task.kanbanGroupId ?? null;
  if (op === "isEmpty") return gid == null;
  if (op === "isNotEmpty") return gid != null;
  if (op === "eq") {
    if (value === null || value === "__ungrouped__") return gid == null;
    return gid === value;
  }
  return false;
}
function matchTimeField(task, field, op, value, ctx) {
  const now = ctx.now ?? dayjs();
  let iso = resolveTaskDateIso(task, field);
  if (ctx.instanceDateKey && field === "dueAt") {
    const timePart = task.dueAt && task.dueAt.length >= 19 ? task.dueAt.slice(10) : "T00:00:00";
    iso = `${ctx.instanceDateKey}${timePart.startsWith("T") ? timePart : `T${timePart}`}`;
  }
  if (op === "isEmpty" || op === "rel" && value === "noDate") {
    return iso == null;
  }
  if (op === "isNotEmpty" || op === "rel" && value === "hasDate") {
    return iso != null;
  }
  if (!iso) return false;
  const d = dayjs(iso);
  if (!d.isValid()) return false;
  if (op === "rel") {
    return matchTimeRel(d, value, now);
  }
  if (op === "between") {
    const range = value;
    return iso >= range.from && iso <= range.to;
  }
  return false;
}
function matchTimeRel(d, rel, now) {
  const day = d.startOf("day");
  const today = now.startOf("day");
  switch (rel) {
    case "today":
      return day.isSame(today, "day");
    case "tomorrow":
      return day.isSame(today.add(1, "day"), "day");
    case "week": {
      const start = today.startOf("week");
      const end = today.endOf("week");
      return !day.isBefore(start, "day") && !day.isAfter(end, "day");
    }
    case "month": {
      const start = today.startOf("month");
      const end = today.endOf("month");
      return !day.isBefore(start, "day") && !day.isAfter(end, "day");
    }
    case "overdue":
      return day.isBefore(today, "day");
    case "noDate":
      return false;
    case "hasDate":
      return true;
    default:
      return false;
  }
}
function parseQuadrantOptions(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function mapRow$3(row) {
  return {
    id: row.id,
    name: row.name,
    layout: row.layout,
    scopeKey: row.scope_key,
    filterRule: row.filter_rule_json ? parseFilterAstJson(row.filter_rule_json) : null,
    groupBy: row.group_by,
    sortBy: row.sort_by,
    kanbanBoardMode: row.kanban_board_mode,
    quadrantOptions: parseQuadrantOptions(row.quadrant_options_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
class TaskViewRepository {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare(`SELECT * FROM task_views ORDER BY sort_order ASC, created_at ASC`).all();
    return rows.map(mapRow$3);
  }
  findById(id) {
    const row = this.db.prepare(`SELECT * FROM task_views WHERE id = ?`).get(id);
    return row ? mapRow$3(row) : null;
  }
  findByName(name) {
    const row = this.db.prepare(`SELECT * FROM task_views WHERE name = ?`).get(name);
    return row ? mapRow$3(row) : null;
  }
  maxSortOrder() {
    const row = this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) as mx FROM task_views`).get();
    return row.mx;
  }
  insert(view) {
    this.db.prepare(
      `INSERT INTO task_views (
          id, name, layout, scope_key, filter_rule_json, group_by, sort_by,
          kanban_board_mode, quadrant_options_json, sort_order, created_at, updated_at
        ) VALUES (
          @id, @name, @layout, @scopeKey, @filterRuleJson, @groupBy, @sortBy,
          @kanbanBoardMode, @quadrantOptionsJson, @sortOrder, @createdAt, @updatedAt
        )`
    ).run({
      id: view.id,
      name: view.name,
      layout: view.layout,
      scopeKey: view.scopeKey,
      filterRuleJson: view.filterRule ? serializeFilterAst(view.filterRule) : null,
      groupBy: view.groupBy,
      sortBy: view.sortBy,
      kanbanBoardMode: view.kanbanBoardMode,
      quadrantOptionsJson: view.quadrantOptions ? JSON.stringify(view.quadrantOptions) : null,
      sortOrder: view.sortOrder,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt
    });
  }
  update(view) {
    this.db.prepare(
      `UPDATE task_views SET
          name = @name, layout = @layout, scope_key = @scopeKey,
          filter_rule_json = @filterRuleJson, group_by = @groupBy, sort_by = @sortBy,
          kanban_board_mode = @kanbanBoardMode, quadrant_options_json = @quadrantOptionsJson,
          sort_order = @sortOrder, updated_at = @updatedAt
         WHERE id = @id`
    ).run({
      id: view.id,
      name: view.name,
      layout: view.layout,
      scopeKey: view.scopeKey,
      filterRuleJson: view.filterRule ? serializeFilterAst(view.filterRule) : null,
      groupBy: view.groupBy,
      sortBy: view.sortBy,
      kanbanBoardMode: view.kanbanBoardMode,
      quadrantOptionsJson: view.quadrantOptions ? JSON.stringify(view.quadrantOptions) : null,
      sortOrder: view.sortOrder,
      updatedAt: view.updatedAt
    });
  }
  delete(id) {
    this.db.prepare(`DELETE FROM task_views WHERE id = ?`).run(id);
  }
}
function mapRow$2(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    summary: row.summary,
    createdAt: row.created_at
  };
}
class TaskActivityRepository {
  constructor(db) {
    this.db = db;
  }
  listByTask(taskId, limit = 100, before) {
    if (before) {
      const rows2 = this.db.prepare(
        `SELECT * FROM task_activities
           WHERE task_id = ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`
      ).all(taskId, before, limit);
      return rows2.map(mapRow$2);
    }
    const rows = this.db.prepare(
      `SELECT * FROM task_activities
         WHERE task_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
    ).all(taskId, limit);
    return rows.map(mapRow$2);
  }
  countAll() {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM task_activities`).get();
    return row.cnt;
  }
  insert(activity) {
    this.db.prepare(
      `INSERT INTO task_activities (id, task_id, type, summary, created_at)
         VALUES (@id, @taskId, @type, @summary, @createdAt)`
    ).run({
      id: activity.id,
      taskId: activity.taskId,
      type: activity.type,
      summary: activity.summary,
      createdAt: activity.createdAt
    });
  }
  insertMany(activities) {
    if (!activities.length) return;
    const stmt = this.db.prepare(
      `INSERT INTO task_activities (id, task_id, type, summary, created_at)
       VALUES (@id, @taskId, @type, @summary, @createdAt)`
    );
    const tx = this.db.transaction((rows) => {
      for (const activity of rows) {
        stmt.run({
          id: activity.id,
          taskId: activity.taskId,
          type: activity.type,
          summary: activity.summary,
          createdAt: activity.createdAt
        });
      }
    });
    tx(activities);
  }
  deleteAll() {
    const result = this.db.prepare(`DELETE FROM task_activities`).run();
    return result.changes;
  }
  deleteByTaskId(taskId) {
    const result = this.db.prepare(`DELETE FROM task_activities WHERE task_id = ?`).run(taskId);
    return result.changes;
  }
  /** 删除仍在垃圾桶中的任务所关联的动态 */
  deleteForTrashedTasks() {
    const result = this.db.prepare(
      `DELETE FROM task_activities
         WHERE task_id IN (SELECT id FROM tasks WHERE deleted_at IS NOT NULL)`
    ).run();
    return result.changes;
  }
  purgeByPolicy(policy) {
    if (policy.mode === "forever") {
      return 0;
    }
    if (policy.mode === "max_count" && policy.maxCount) {
      const keep = Math.max(1, policy.maxCount);
      const result = this.db.prepare(
        `DELETE FROM task_activities
           WHERE id NOT IN (
             SELECT id FROM task_activities
             ORDER BY created_at DESC
             LIMIT ?
           )`
      ).run(keep);
      return result.changes;
    }
    if (policy.mode === "max_days" && policy.maxDays) {
      const cutoff = /* @__PURE__ */ new Date();
      cutoff.setDate(cutoff.getDate() - policy.maxDays);
      const cutoffIso = cutoff.toISOString().slice(0, 19);
      const result = this.db.prepare(`DELETE FROM task_activities WHERE created_at < ?`).run(cutoffIso);
      return result.changes;
    }
    return 0;
  }
}
function layoutSummaryTaskTree(matched, options) {
  const limited = options.limit != null && options.limit > 0 ? matched.slice(0, options.limit) : matched;
  const matchedCount = limited.length;
  const matchedIds = new Set(limited.map((t) => t.id));
  const byId = /* @__PURE__ */ new Map();
  for (const t of limited) byId.set(t.id, t);
  for (const t of limited) {
    let parentId = t.parentId;
    const seen = /* @__PURE__ */ new Set();
    while (parentId) {
      if (seen.has(parentId) || byId.has(parentId)) break;
      seen.add(parentId);
      const parent = options.resolveById(parentId);
      if (!parent || parent.deletedAt) break;
      byId.set(parent.id, parent);
      parentId = parent.parentId;
    }
  }
  const orderIndex = /* @__PURE__ */ new Map();
  limited.forEach((t, i) => orderIndex.set(t.id, i));
  const byParent = /* @__PURE__ */ new Map();
  for (const t of byId.values()) {
    const key = t.parentId && byId.has(t.parentId) ? t.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  }
  function subtreeOrder(task) {
    if (orderIndex.has(task.id)) return orderIndex.get(task.id);
    let min = Number.POSITIVE_INFINITY;
    for (const child of byParent.get(task.id) ?? []) {
      min = Math.min(min, subtreeOrder(child));
    }
    return Number.isFinite(min) ? min : Number.MAX_SAFE_INTEGER;
  }
  for (const [, list] of byParent) {
    list.sort((a, b) => subtreeOrder(a) - subtreeOrder(b));
  }
  const rows = [];
  function walk(task, depth) {
    rows.push({
      task,
      depth,
      matched: matchedIds.has(task.id)
    });
    for (const child of byParent.get(task.id) ?? []) {
      walk(child, depth + 1);
    }
  }
  for (const root of byParent.get(null) ?? []) {
    walk(root, 0);
  }
  return { rows, matchedCount };
}
function summaryTreeIndent(depth) {
  return "  ".repeat(Math.max(0, depth));
}
class SummaryTemplateError extends Error {
  line;
  constructor(line, message) {
    super(`第 ${line} 行：${message}`);
    this.name = "SummaryTemplateError";
    this.line = line;
  }
}
const SECTION_ATTRS = /* @__PURE__ */ new Set([
  "status",
  "due",
  "list",
  "listId",
  "title",
  "time",
  "hideEmpty"
]);
const TASK_FIELDS = /* @__PURE__ */ new Set([
  "title",
  "dueAt",
  "completedAt",
  "categoryName",
  "status",
  "count",
  "sectionTitle"
]);
const OPEN_TAG = /\{\{\s*#(section|tasks|if)(?:\s+([^}]*?))?\s*\}\}/g;
const CLOSE_TAG = /\{\{\s*\/(section|tasks|if)\s*\}\}/g;
const VAR_TAG = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const COMMENT_TAG = /\{\{\s*!--[\s\S]*?--\s*\}\}/g;
function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}
function parseAttrs(raw, line) {
  const attrs = {};
  if (!raw?.trim()) return attrs;
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
  let m;
  let matched = false;
  while ((m = re.exec(raw)) !== null) {
    matched = true;
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  if (!matched && raw.trim()) {
    throw new SummaryTemplateError(line, `无法解析属性：${raw.trim()}`);
  }
  return attrs;
}
function tokenize(source) {
  const stripped = source.replace(COMMENT_TAG, (full) => full.replace(/[^\n]/g, " "));
  const markers = [];
  let m;
  const openRe = new RegExp(OPEN_TAG.source, "g");
  while ((m = openRe.exec(stripped)) !== null) {
    const name = m[1];
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: "open",
        name,
        attrs: m[2] ?? "",
        index: m.index,
        line: lineAt(source, m.index)
      }
    });
  }
  const closeRe = new RegExp(CLOSE_TAG.source, "g");
  while ((m = closeRe.exec(stripped)) !== null) {
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: "close",
        name: m[1],
        index: m.index,
        line: lineAt(source, m.index)
      }
    });
  }
  const varRe = new RegExp(VAR_TAG.source, "g");
  while ((m = varRe.exec(stripped)) !== null) {
    const overlapping = markers.some((x) => m.index >= x.index && m.index < x.end);
    if (overlapping) continue;
    markers.push({
      index: m.index,
      end: m.index + m[0].length,
      token: {
        kind: "var",
        name: m[1],
        index: m.index,
        line: lineAt(source, m.index)
      }
    });
  }
  markers.sort((a, b) => a.index - b.index);
  const tokens = [];
  let cursor = 0;
  for (const marker of markers) {
    if (marker.index > cursor) {
      tokens.push({ kind: "text", value: stripped.slice(cursor, marker.index), index: cursor });
    }
    tokens.push(marker.token);
    cursor = marker.end;
  }
  if (cursor < stripped.length) {
    tokens.push({ kind: "text", value: stripped.slice(cursor), index: cursor });
  }
  return tokens;
}
function parseTokens(tokens, source) {
  let i = 0;
  function parseBlock(until) {
    const nodes = [];
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.kind === "close") {
        if (until && tok.name === until) {
          i += 1;
          return nodes;
        }
        throw new SummaryTemplateError(tok.line, `意外的闭合标签 {{/${tok.name}}}`);
      }
      if (tok.kind === "text") {
        if (tok.value) nodes.push({ type: "text", value: tok.value });
        i += 1;
        continue;
      }
      if (tok.kind === "var") {
        nodes.push({ type: "var", name: tok.name, line: tok.line });
        i += 1;
        continue;
      }
      if (tok.kind === "open") {
        const line = tok.line;
        const name = tok.name;
        const rawAttrs = tok.attrs;
        i += 1;
        if (name === "section") {
          const attrs = parseAttrs(rawAttrs, line);
          const children = parseBlock("section");
          nodes.push({ type: "section", attrs, children, line });
          continue;
        }
        if (name === "tasks") {
          if (rawAttrs.trim()) {
            throw new SummaryTemplateError(line, "tasks 标签不接受属性");
          }
          const children = parseBlock("tasks");
          nodes.push({ type: "tasks", children, line });
          continue;
        }
        if (name === "if") {
          const field = rawAttrs.trim();
          if (!field || /\s/.test(field) || field.includes("=")) {
            throw new SummaryTemplateError(line, "if 仅支持 {{#if fieldName}} 形式");
          }
          const children = parseBlock("if");
          nodes.push({ type: "if", field, children, line });
          continue;
        }
      }
    }
    if (until) {
      throw new SummaryTemplateError(lineAt(source, source.length), `未闭合的 {{#${until}}}`);
    }
    return nodes;
  }
  const ast = parseBlock();
  return ast;
}
function parseSummaryTemplate(source) {
  const tokens = tokenize(source);
  return parseTokens(tokens, source);
}
function validateSummaryTemplateAst(nodes) {
  const walk = (list, inTasks) => {
    for (const node of list) {
      if (node.type === "section") {
        validateSectionAttrs(node.attrs, node.line);
        walk(node.children);
      } else if (node.type === "tasks") {
        walk(node.children);
      } else if (node.type === "if") {
        if (!TASK_FIELDS.has(node.field)) {
          throw new SummaryTemplateError(node.line, `if 不支持字段「${node.field}」`);
        }
        walk(node.children);
      } else if (node.type === "var") {
        if (!TASK_FIELDS.has(node.name)) {
          throw new SummaryTemplateError(node.line, `未知字段「${node.name}」`);
        }
      }
    }
  };
  walk(nodes);
}
function validateSectionAttrs(attrs, line) {
  for (const key of Object.keys(attrs)) {
    if (!SECTION_ATTRS.has(key)) {
      throw new SummaryTemplateError(line, `未知属性「${key}」`);
    }
  }
  const status = attrs.status;
  if (status !== "completed" && status !== "pending" && status !== "overdue") {
    throw new SummaryTemplateError(line, "section 必须提供 status=completed|pending|overdue");
  }
  if (attrs.due != null && attrs.due !== "today") {
    throw new SummaryTemplateError(line, "due 仅支持 today");
  }
  if (attrs.time != null) {
    const t = attrs.time;
    if (t !== "today" && t !== "yesterday" && t !== "this_week" && t !== "last_week" && t !== "this_month" && t !== "last_month" && t !== "last_7_days" && t !== "last_30_days" && t !== "since_last") {
      throw new SummaryTemplateError(line, `无效 time「${t}」`);
    }
  }
  if (attrs.hideEmpty != null && attrs.hideEmpty !== "true" && attrs.hideEmpty !== "false") {
    throw new SummaryTemplateError(line, "hideEmpty 仅支持 true/false");
  }
}
function sectionAttrsToQuerySpec(attrs, line) {
  validateSectionAttrs(attrs, line);
  const status = attrs.status;
  const timePreset = attrs.time ?? (status === "completed" ? "since_last" : "today");
  return {
    status,
    timePreset,
    dueTodayOnly: attrs.due === "today",
    listName: attrs.list?.trim() || void 0,
    listId: attrs.listId?.trim() || void 0,
    title: attrs.title?.trim() || "未命名区块",
    hideEmpty: attrs.hideEmpty === "true",
    line
  };
}
function formatField(task, name, extras) {
  if (name === "count") return String(extras.count);
  if (name === "sectionTitle") return extras.sectionTitle;
  if (!task) return "";
  if (name === "title") return task.title;
  if (name === "dueAt") return task.dueAt?.slice(0, 16).replace("T", " ") ?? "";
  if (name === "completedAt") return task.completedAt?.slice(0, 16).replace("T", " ") ?? "";
  if (name === "categoryName") {
    return task.categoryId ? extras.categoryNames.get(task.categoryId) ?? "未分类" : "未分类";
  }
  if (name === "status") return task.status;
  return "";
}
function renderNodes(nodes, ctx, scope) {
  let out = "";
  for (const node of nodes) {
    if (node.type === "text") {
      out += node.value;
      continue;
    }
    if (node.type === "var") {
      out += formatField(scope.task, node.name, {
        count: scope.count,
        sectionTitle: scope.sectionTitle,
        categoryNames: ctx.categoryNames
      });
      continue;
    }
    if (node.type === "if") {
      const value = formatField(scope.task, node.field, {
        count: scope.count,
        sectionTitle: scope.sectionTitle,
        categoryNames: ctx.categoryNames
      });
      if (value) {
        out += renderNodes(node.children, ctx, scope);
      }
      continue;
    }
    if (node.type === "tasks") {
      continue;
    }
    if (node.type === "section") {
      const spec = sectionAttrsToQuerySpec(node.attrs, node.line);
      const bounds = resolveSectionTimeBounds(spec.timePreset, ctx.scheduleType, ctx.now, ctx.lastSentAt);
      const categoryId = ctx.resolveListId({
        listName: spec.listName,
        listId: spec.listId,
        line: spec.line
      });
      const categoryIds = categoryId ? [categoryId] : void 0;
      const dueBetween = spec.dueTodayOnly ? localDayBounds(ctx.now) : null;
      const tasks = ctx.fetchTasks({
        status: spec.status,
        bounds,
        categoryIds,
        dueBetween
      });
      if (!tasks.length && spec.hideEmpty) {
        continue;
      }
      const { rows, matchedCount } = layoutSummaryTaskTree(tasks, {
        resolveById: ctx.resolveById ?? (() => null)
      });
      if (!matchedCount && spec.hideEmpty) {
        continue;
      }
      const sectionScopeBase = {
        task: null,
        count: matchedCount,
        sectionTitle: spec.title
      };
      out += renderSectionBody(node.children, ctx, sectionScopeBase, rows);
    }
  }
  return out;
}
function prefixDepth(block, depth) {
  const pad = summaryTreeIndent(depth);
  if (!pad || !block) return block;
  const endsWithNewline = block.endsWith("\n");
  const lines = block.split("\n");
  if (endsWithNewline) lines.pop();
  const prefixed = lines.map((line) => line.length ? pad + line : line).join("\n");
  return endsWithNewline ? `${prefixed}
` : prefixed;
}
function renderSectionBody(nodes, ctx, scope, rows) {
  let out = "";
  for (const node of nodes) {
    if (node.type === "tasks") {
      for (const row of rows) {
        const chunk = renderNodes(node.children, ctx, {
          task: row.task,
          count: scope.count,
          sectionTitle: scope.sectionTitle
        });
        out += prefixDepth(chunk, row.depth);
      }
      continue;
    }
    if (node.type === "section") {
      out += renderNodes([node], ctx, scope);
      continue;
    }
    out += renderNodes([node], ctx, scope);
  }
  return out;
}
function renderSummaryFreeTemplate(body, ctx) {
  const ast = parseSummaryTemplate(body);
  validateSummaryTemplateAst(ast);
  return renderNodes(ast, ctx, { task: null, count: 0, sectionTitle: "" }).replace(/\n{3,}/g, "\n\n").trim();
}
function assertValidSummaryFreeTemplate(body) {
  const ast = parseSummaryTemplate(body);
  validateSummaryTemplateAst(ast);
}
const DEFAULT_SUMMARY_PROMPT = `你是小柒todo 的任务汇总助手。请根据用户提供的「任务汇总数据」生成简洁、有条理的中文汇总。

要求：
1. 按报告中的区块与清单/分类分组展示
2. 保留任务标题，可补充完成时间或截止时间
3. 语气简洁专业，适合每日/每周回顾
4. 若某区块无任务，简要说明即可
5. 直接输出正文，不要 markdown 代码块`;
function normalizeSendTime(raw, fallback = "09:00") {
  if (raw == null || raw === "") return fallback;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return dayjs(raw).format("HH:mm");
  }
  if (typeof raw === "object" && raw !== null) {
    const maybeDayjs = raw;
    if (typeof maybeDayjs.format === "function") {
      try {
        const formatted = maybeDayjs.format("HH:mm");
        if (/^\d{2}:\d{2}$/.test(formatted)) return formatted;
      } catch {
      }
    }
    if (maybeDayjs.$d instanceof Date && !Number.isNaN(maybeDayjs.$d.getTime())) {
      return dayjs(maybeDayjs.$d).format("HH:mm");
    }
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const hm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (hm) {
      return `${hm[1].padStart(2, "0")}:${hm[2]}`;
    }
    const iso = trimmed.match(/T(\d{2}):(\d{2})/);
    if (iso) {
      return `${iso[1]}:${iso[2]}`;
    }
  }
  return fallback;
}
function summaryPeriodBounds(scheduleType, now, lastSentAt) {
  const to = now.format("YYYY-MM-DDTHH:mm:ss");
  if (lastSentAt) {
    return { from: lastSentAt, to };
  }
  switch (scheduleType) {
    case "daily":
      return { from: now.subtract(1, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ss"), to };
    case "weekly":
      return { from: now.subtract(7, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ss"), to };
    case "monthly":
      return { from: now.subtract(1, "month").startOf("day").format("YYYY-MM-DDTHH:mm:ss"), to };
  }
}
function shouldSendSummaryNow(summary, now = dayjs()) {
  if (!summary.enabled) return false;
  const [hh, mm] = summary.sendTime.split(":").map((v) => Number(v));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const scheduled = now.hour(hh).minute(mm).second(0).millisecond(0);
  if (now.isBefore(scheduled)) return false;
  if (summary.scheduleType === "weekly") {
    if (summary.sendWeekday == null || now.day() !== summary.sendWeekday) return false;
  }
  if (summary.scheduleType === "monthly") {
    if (summary.sendDay == null || now.date() !== summary.sendDay) return false;
  }
  if (summary.lastSentAt) {
    const last = dayjs(summary.lastSentAt);
    if (last.isSame(now, "day") && summary.scheduleType === "daily") return false;
    if (last.isSame(now, "week") && summary.scheduleType === "weekly") return false;
    if (last.isSame(now, "month") && summary.scheduleType === "monthly") return false;
  }
  return true;
}
const SUMMARY_TASK_FILTER_LABELS = {
  completed: "已完成",
  pending: "未完成",
  overdue: "已逾期"
};
const SUMMARY_TIME_SCOPE_LABELS = {
  since_last: "自上次发送以来",
  today: "今天",
  yesterday: "昨天",
  this_week: "本周",
  last_week: "上周",
  this_month: "本月",
  last_month: "上月",
  last_7_days: "最近 7 天",
  last_30_days: "最近 30 天"
};
function defaultRenderForStatus(status) {
  return {
    style: "bullets",
    showCount: true,
    showDueAt: status !== "completed",
    showCompletedAt: status === "completed",
    limit: null,
    hideEmptySection: false
  };
}
function defaultGroup() {
  return { by: "category", emptyGroups: "hide" };
}
function defaultSort(status) {
  if (status === "completed") {
    return { field: "completedAt", order: "desc" };
  }
  return { field: "dueAt", order: "asc" };
}
function createReportSectionV2(partial = {}) {
  const id = partial.id ?? `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const status = partial.query?.status ?? partial.taskFilter ?? "completed";
  const preset = partial.time?.preset ?? partial.timeScope ?? "this_week";
  return {
    id,
    title: partial.title?.trim() || "新区块",
    enabled: partial.enabled !== false,
    query: {
      status,
      listScope: partial.query?.listScope ?? { mode: "all" },
      dueScope: partial.query?.dueScope ?? null
    },
    time: {
      mode: "preset",
      preset
    },
    group: partial.group ?? defaultGroup(),
    sort: partial.sort ?? defaultSort(status),
    render: partial.render ?? defaultRenderForStatus(status)
  };
}
function sectionV2(id, title, status, preset) {
  return createReportSectionV2({ id, title, taskFilter: status, timeScope: preset });
}
const DEFAULT_FREE_TEMPLATE_BODY = `{{!-- 自由模板示例：可按需修改 --}}
{{#section status="completed" time="since_last" title="已完成" hideEmpty="true"}}
【{{sectionTitle}}】共 {{count}} 项
{{#tasks}}
- {{title}}{{#if completedAt}}（完成 {{completedAt}}）{{/if}}
{{/tasks}}
{{/section}}
`;
function createDefaultFreeTemplate(body) {
  const text = typeof body === "string" ? body : "";
  return {
    body: text.length > 0 ? text : DEFAULT_FREE_TEMPLATE_BODY,
    syntaxVersion: 1
  };
}
const DEFAULT_REPORT_CONFIG = {
  mode: "form",
  templateId: "daily_completed",
  sections: [sectionV2("completed_since_last", "已完成", "completed", "since_last")],
  freeTemplate: createDefaultFreeTemplate()
};
function withFormConfig(templateId, sections) {
  return {
    mode: "form",
    templateId,
    sections,
    freeTemplate: createDefaultFreeTemplate()
  };
}
[
  {
    id: "daily_completed",
    name: "每日已完成回顾",
    description: "汇总自上次发送以来已完成的任务",
    config: withFormConfig("daily_completed", [
      sectionV2("completed_since_last", "已完成", "completed", "since_last")
    ])
  },
  {
    id: "weekly_completed",
    name: "本周已完成",
    description: "汇总本周内完成的任务",
    config: withFormConfig("weekly_completed", [
      sectionV2("completed_week", "本周已完成", "completed", "this_week")
    ])
  },
  {
    id: "weekly_pending",
    name: "本周未完成",
    description: "汇总本周内待办与进行中的任务",
    config: withFormConfig("weekly_pending", [
      sectionV2("pending_week", "本周未完成", "pending", "this_week")
    ])
  },
  {
    id: "weekly_overview",
    name: "本周工作全景",
    description: "同时包含本周已完成、未完成与当前逾期",
    config: withFormConfig("weekly_overview", [
      sectionV2("completed_week", "本周已完成", "completed", "this_week"),
      sectionV2("pending_week", "本周未完成", "pending", "this_week"),
      sectionV2("overdue_now", "已逾期", "overdue", "today")
    ])
  },
  {
    id: "monthly_completed",
    name: "本月已完成",
    description: "汇总本月内完成的任务",
    config: withFormConfig("monthly_completed", [
      sectionV2("completed_month", "本月已完成", "completed", "this_month")
    ])
  },
  {
    id: "custom",
    name: "自定义",
    description: "自行勾选区块并配置统计范围",
    config: withFormConfig("custom", [
      sectionV2("completed_since_last", "已完成", "completed", "since_last"),
      sectionV2("pending_week", "未完成", "pending", "this_week")
    ])
  }
];
function cloneReportConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
function isTimeScope(value) {
  return value === "since_last" || value === "today" || value === "yesterday" || value === "this_week" || value === "last_week" || value === "this_month" || value === "last_month" || value === "last_7_days" || value === "last_30_days";
}
function isTaskFilter(value) {
  return value === "completed" || value === "pending" || value === "overdue";
}
function mapLegacySectionToV2(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const item = raw;
  if (!isTaskFilter(item.taskFilter) || !isTimeScope(item.timeScope)) return null;
  return createReportSectionV2({
    id: typeof item.id === "string" && item.id ? item.id : `section-${index + 1}`,
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名区块",
    enabled: item.enabled !== false,
    taskFilter: item.taskFilter,
    timeScope: item.timeScope
  });
}
function normalizeListScope(raw) {
  if (!raw || typeof raw !== "object") return { mode: "all" };
  const item = raw;
  if (item.mode === "only_list" && typeof item.listId === "string" && item.listId.trim()) {
    return { mode: "only_list", listId: item.listId.trim() };
  }
  return { mode: "all" };
}
function normalizeSectionV2(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const item = raw;
  if ((item.taskFilter != null || item.timeScope != null) && (item.query == null || typeof item.query !== "object")) {
    return mapLegacySectionToV2(item, index);
  }
  const queryRaw = item.query ?? {};
  const status = isTaskFilter(queryRaw.status) ? queryRaw.status : isTaskFilter(item.taskFilter) ? item.taskFilter : null;
  if (!status) return null;
  const timeRaw = item.time ?? {};
  const preset = isTimeScope(timeRaw.preset) ? timeRaw.preset : isTimeScope(item.timeScope) ? item.timeScope : "this_week";
  const groupRaw = item.group ?? {};
  const by = groupRaw.by === "none" || groupRaw.by === "list" || groupRaw.by === "category" ? groupRaw.by : "category";
  const emptyGroups = groupRaw.emptyGroups === "show" ? "show" : "hide";
  const sortRaw = item.sort ?? {};
  const field = sortRaw.field === "createdAt" || sortRaw.field === "completedAt" || sortRaw.field === "dueAt" ? sortRaw.field : defaultSort(status).field;
  const order = sortRaw.order === "desc" ? "desc" : "asc";
  const renderRaw = item.render ?? {};
  const baseRender = defaultRenderForStatus(status);
  const limit = typeof renderRaw.limit === "number" && Number.isFinite(renderRaw.limit) && renderRaw.limit > 0 ? Math.floor(renderRaw.limit) : null;
  return {
    id: typeof item.id === "string" && item.id ? item.id : `section-${index + 1}`,
    title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : "未命名区块",
    enabled: item.enabled !== false,
    query: {
      status,
      listScope: normalizeListScope(queryRaw.listScope),
      dueScope: queryRaw.dueScope === "due_today_only" ? "due_today_only" : null
    },
    time: { mode: "preset", preset },
    group: { by, emptyGroups },
    sort: { field, order },
    render: {
      style: renderRaw.style === "numbered" ? "numbered" : "bullets",
      showCount: renderRaw.showCount !== false && (renderRaw.showCount ?? baseRender.showCount),
      showDueAt: renderRaw.showDueAt ?? baseRender.showDueAt,
      showCompletedAt: renderRaw.showCompletedAt ?? baseRender.showCompletedAt,
      limit,
      hideEmptySection: renderRaw.hideEmptySection === true
    }
  };
}
function normalizeReportConfigV2(raw) {
  if (!raw || typeof raw !== "object") {
    return cloneReportConfig(DEFAULT_REPORT_CONFIG);
  }
  const input = raw;
  const sections = Array.isArray(input.sections) ? input.sections.map((item, index) => normalizeSectionV2(item, index)).filter((item) => item !== null) : [];
  if (!sections.length) {
    const fallback = cloneReportConfig(DEFAULT_REPORT_CONFIG);
    fallback.mode = input.mode === "template" ? "template" : "form";
    fallback.freeTemplate = normalizeFreeTemplate(input.freeTemplate);
    fallback.templateId = typeof input.templateId === "string" ? input.templateId : fallback.templateId;
    return fallback;
  }
  return {
    mode: input.mode === "template" ? "template" : "form",
    templateId: typeof input.templateId === "string" ? input.templateId : "custom",
    sections,
    freeTemplate: normalizeFreeTemplate(input.freeTemplate)
  };
}
function normalizeFreeTemplate(raw) {
  if (typeof raw === "string") {
    return createDefaultFreeTemplate(raw);
  }
  if (raw && typeof raw === "object") {
    const body = typeof raw.body === "string" ? raw.body : "";
    if ("body" in raw) {
      return { body, syntaxVersion: 1 };
    }
  }
  return createDefaultFreeTemplate();
}
function normalizeReportConfig(raw) {
  return normalizeReportConfigV2(raw);
}
function localDayBounds(now = dayjs()) {
  return {
    from: now.startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
    to: now.endOf("day").format("YYYY-MM-DDTHH:mm:ss")
  };
}
function resolveSectionTimeBounds(timeScope, scheduleType, now, lastSentAt) {
  const to = now.format("YYYY-MM-DDTHH:mm:ss");
  if (timeScope === "since_last") {
    const bounds = summaryPeriodBounds(scheduleType, now, lastSentAt);
    return {
      from: bounds.from,
      to: bounds.to,
      label: SUMMARY_TIME_SCOPE_LABELS.since_last
    };
  }
  switch (timeScope) {
    case "today":
      return {
        from: now.startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.today
      };
    case "yesterday": {
      const y = now.subtract(1, "day");
      return {
        from: y.startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        to: y.endOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        label: SUMMARY_TIME_SCOPE_LABELS.yesterday
      };
    }
    case "this_week":
      return {
        from: startOfWeekMonday(now).format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_week
      };
    case "last_week": {
      const lastMon = startOfWeekMonday(now).subtract(7, "day");
      return {
        from: lastMon.format("YYYY-MM-DDTHH:mm:ss"),
        to: lastMon.add(6, "day").endOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        label: SUMMARY_TIME_SCOPE_LABELS.last_week
      };
    }
    case "this_month":
      return {
        from: now.startOf("month").format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.this_month
      };
    case "last_month": {
      const prev = now.subtract(1, "month");
      return {
        from: prev.startOf("month").format("YYYY-MM-DDTHH:mm:ss"),
        to: prev.endOf("month").format("YYYY-MM-DDTHH:mm:ss"),
        label: SUMMARY_TIME_SCOPE_LABELS.last_month
      };
    }
    case "last_7_days":
      return {
        from: now.subtract(7, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.last_7_days
      };
    case "last_30_days":
      return {
        from: now.subtract(30, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.last_30_days
      };
    default:
      return {
        from: now.subtract(1, "day").startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        to,
        label: SUMMARY_TIME_SCOPE_LABELS.since_last
      };
  }
}
function resolveSectionCategoryIds(section, summaryCategoryIds) {
  if (section.query.listScope.mode === "only_list" && section.query.listScope.listId) {
    return [section.query.listScope.listId];
  }
  return summaryCategoryIds.length > 0 ? summaryCategoryIds : void 0;
}
function compareNullableIso(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}
function sortSectionTasks(tasks, sort) {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (sort.field === "dueAt") cmp = compareNullableIso(a.dueAt, b.dueAt);
    else if (sort.field === "createdAt") cmp = compareNullableIso(a.createdAt, b.createdAt);
    else cmp = compareNullableIso(a.completedAt, b.completedAt);
    return sort.order === "desc" ? -cmp : cmp;
  });
  return sorted;
}
function formatTaskLineV2(task, render) {
  const parts = [task.title];
  if (render.showCompletedAt && task.completedAt) {
    parts.push(`（完成 ${task.completedAt.slice(0, 16).replace("T", " ")}）`);
  } else if (render.showDueAt) {
    if (task.dueAt) {
      parts.push(`（截止 ${task.dueAt.slice(0, 16).replace("T", " ")}）`);
    } else {
      parts.push("（无截止）");
    }
  }
  return parts.join("");
}
function bulletPrefix(style, index) {
  return style === "numbered" ? `${index}.` : "-";
}
function buildSectionTasksSummaryText(section, tasks, categoryNames, bounds, resolveById = () => null) {
  const sorted = sortSectionTasks(tasks, section.sort);
  const limit = section.render.limit != null && section.render.limit > 0 ? section.render.limit : null;
  if (!sorted.length && section.render.hideEmptySection) {
    return null;
  }
  const groupBy = section.group.by;
  const lines = [];
  const pushRows = (rows, basePad) => {
    rows.forEach((row, index) => {
      const indent = `${basePad}${summaryTreeIndent(row.depth)}`;
      const prefix = bulletPrefix(section.render.style, index + 1);
      if (row.matched) {
        lines.push(`${indent}${prefix} ${formatTaskLineV2(row.task, section.render)}`);
      } else {
        lines.push(`${indent}${prefix} ${row.task.title}`);
      }
    });
  };
  if (groupBy === "none") {
    const { rows, matchedCount: matchedCount2 } = layoutSummaryTaskTree(sorted, { limit, resolveById });
    const countPart2 = section.render.showCount ? ` · ${matchedCount2} 项` : "";
    const header2 = `【${section.title}】${bounds.label} · ${SUMMARY_TASK_FILTER_LABELS[section.query.status]}${countPart2}`;
    if (!matchedCount2) {
      if (section.render.hideEmptySection) return null;
      return `${header2}
暂无相关任务。`;
    }
    lines.push(header2);
    pushRows(rows, "  ");
    return lines.join("\n");
  }
  const limited = limit != null ? sorted.slice(0, limit) : sorted;
  const matchedCount = limited.length;
  const countPart = section.render.showCount ? ` · ${matchedCount} 项` : "";
  const header = `【${section.title}】${bounds.label} · ${SUMMARY_TASK_FILTER_LABELS[section.query.status]}${countPart}`;
  if (!matchedCount) {
    if (section.render.hideEmptySection) return null;
    return `${header}
暂无相关任务。`;
  }
  lines.push(header);
  const byCategory = /* @__PURE__ */ new Map();
  for (const task of limited) {
    const key = task.categoryId ?? "__none__";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(task);
  }
  for (const [catKey, list] of byCategory) {
    if (!list.length && section.group.emptyGroups === "hide") continue;
    const label = catKey === "__none__" ? "未分类" : categoryNames.get(catKey) ?? "未分类";
    const countLabel = section.render.showCount ? `（${list.length}）` : "";
    lines.push(`  · ${label}${countLabel}`);
    const { rows } = layoutSummaryTaskTree(list, { resolveById });
    pushRows(rows, "    ");
  }
  return lines.join("\n");
}
function buildReportSummaryText(sections, categoryNames, resolveById = () => null) {
  const enabled = sections.filter((item) => item.section.enabled);
  if (!enabled.length) {
    return "未启用任何汇总区块。";
  }
  const parts = enabled.map(
    ({ section, bounds, tasks }) => buildSectionTasksSummaryText(section, tasks, categoryNames, bounds, resolveById)
  ).filter((part) => part != null);
  if (!parts.length) {
    return "本周期暂无相关任务。";
  }
  const hasTasks = enabled.some((item) => item.tasks.length > 0);
  if (!hasTasks && parts.every((p) => p.includes("暂无相关任务"))) {
    return parts.join("\n\n") + "\n\n本周期暂无相关任务。";
  }
  return parts.join("\n\n");
}
function parseReportConfig(raw) {
  if (!raw) {
    return normalizeReportConfig(null);
  }
  try {
    return normalizeReportConfig(JSON.parse(raw));
  } catch {
    return normalizeReportConfig(null);
  }
}
function mapRow$1(row) {
  let categoryIds = [];
  try {
    categoryIds = JSON.parse(row.category_ids);
    if (!Array.isArray(categoryIds)) categoryIds = [];
  } catch {
    categoryIds = [];
  }
  return {
    id: row.id,
    name: row.name,
    categoryIds,
    scheduleType: row.schedule_type,
    sendTime: row.send_time,
    sendWeekday: row.send_weekday,
    sendDay: row.send_day,
    useLlm: row.use_llm === 1,
    promptText: row.prompt_text,
    reportConfig: parseReportConfig(row.report_config),
    enabled: row.enabled === 1,
    lastSentAt: row.last_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
class ScheduledSummaryRepository {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare(`SELECT * FROM scheduled_summaries ORDER BY created_at ASC`).all();
    return rows.map(mapRow$1);
  }
  findById(id) {
    const row = this.db.prepare(`SELECT * FROM scheduled_summaries WHERE id = ?`).get(id);
    return row ? mapRow$1(row) : null;
  }
  insert(summary) {
    this.db.prepare(
      `INSERT INTO scheduled_summaries (
          id, name, category_ids, schedule_type, send_time, send_weekday, send_day,
          use_llm, prompt_text, report_config, enabled, last_sent_at, created_at, updated_at
        ) VALUES (
          @id, @name, @categoryIds, @scheduleType, @sendTime, @sendWeekday, @sendDay,
          @useLlm, @promptText, @reportConfig, @enabled, @lastSentAt, @createdAt, @updatedAt
        )`
    ).run({
      id: summary.id,
      name: summary.name,
      categoryIds: JSON.stringify(summary.categoryIds),
      scheduleType: summary.scheduleType,
      sendTime: summary.sendTime,
      sendWeekday: summary.sendWeekday,
      sendDay: summary.sendDay,
      useLlm: summary.useLlm ? 1 : 0,
      promptText: summary.promptText,
      reportConfig: JSON.stringify(summary.reportConfig),
      enabled: summary.enabled ? 1 : 0,
      lastSentAt: summary.lastSentAt,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt
    });
  }
  update(summary) {
    this.db.prepare(
      `UPDATE scheduled_summaries SET
          name = @name,
          category_ids = @categoryIds,
          schedule_type = @scheduleType,
          send_time = @sendTime,
          send_weekday = @sendWeekday,
          send_day = @sendDay,
          use_llm = @useLlm,
          prompt_text = @promptText,
          report_config = @reportConfig,
          enabled = @enabled,
          last_sent_at = @lastSentAt,
          updated_at = @updatedAt
        WHERE id = @id`
    ).run({
      id: summary.id,
      name: summary.name,
      categoryIds: JSON.stringify(summary.categoryIds),
      scheduleType: summary.scheduleType,
      sendTime: summary.sendTime,
      sendWeekday: summary.sendWeekday,
      sendDay: summary.sendDay,
      useLlm: summary.useLlm ? 1 : 0,
      promptText: summary.promptText,
      reportConfig: JSON.stringify(summary.reportConfig),
      enabled: summary.enabled ? 1 : 0,
      lastSentAt: summary.lastSentAt,
      updatedAt: summary.updatedAt
    });
  }
  delete(id) {
    this.db.prepare(`DELETE FROM scheduled_summaries WHERE id = ?`).run(id);
  }
  markSent(id, sentAt) {
    this.db.prepare(`UPDATE scheduled_summaries SET last_sent_at = ?, updated_at = ? WHERE id = ?`).run(sentAt, sentAt, id);
  }
}
class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AppError";
  }
}
function categoryPayload(category) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    keywords: category.keywords,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt
  };
}
class CategoryService {
  constructor(repo, outbox) {
    this.repo = repo;
    this.outbox = outbox;
  }
  list() {
    return this.repo.list();
  }
  withTx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  enqueueUpsert(category, syncVersion) {
    this.outbox?.record({
      entityType: "category",
      entityId: category.id,
      operation: "upsert",
      payload: categoryPayload(category),
      clientSyncVersion: syncVersion
    });
  }
  assertKeywords(keywords, excludeCategoryId) {
    const normalized = normalizeCategoryKeywords(keywords);
    for (const kw of normalized) {
      if (!normalizeCategoryKeyword(kw)) {
        throw new AppError("VALIDATION_ERROR", "关键词不能为空且不超过 32 字");
      }
    }
    const conflict = findCategoryKeywordConflict(normalized, this.repo.list(), excludeCategoryId);
    if (conflict) {
      throw new AppError("VALIDATION_ERROR", conflict);
    }
    return normalized;
  }
  create(dto) {
    const title = dto.name?.trim();
    if (!title) {
      throw new AppError("VALIDATION_ERROR", "分类名称不能为空");
    }
    const keywords = this.assertKeywords(dto.keywords ?? []);
    const ts = nowIso();
    const category = {
      id: uuid.v4(),
      name: title,
      color: dto.color ?? "#409EFF",
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      keywords,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null
    };
    return this.withTx(() => {
      this.repo.insert(category);
      this.enqueueUpsert(category, 1);
      return category;
    });
  }
  update(id, dto) {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "分类不存在");
    }
    const keywords = dto.keywords !== void 0 ? this.assertKeywords(dto.keywords, id) : existing.keywords;
    const ts = nowIso();
    return this.withTx(() => {
      this.repo.update(id, {
        name: dto.name?.trim() ?? existing.name,
        color: dto.color !== void 0 ? dto.color : existing.color,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        keywords,
        updatedAt: ts
      });
      const updated = this.repo.findById(id);
      this.enqueueUpsert(updated, 1);
      return updated;
    });
  }
  delete(id) {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "分类不存在");
    }
    const ts = nowIso();
    this.withTx(() => {
      this.repo.clearTaskCategoryReferences(id, ts);
      this.repo.softDelete(id, ts);
      this.outbox?.record({
        entityType: "category",
        entityId: id,
        operation: "delete",
        payload: {
          id,
          deletedAt: ts,
          updatedAt: ts
        },
        clientSyncVersion: 1
      });
    });
  }
  /** 按 ids 顺序重写 sortOrder；未知 id 跳过；全非法则报错；空数组 no-op */
  reorder(ids) {
    if (!ids.length) return this.list();
    const existing = new Set(this.repo.list().map((c) => c.id));
    const seen = /* @__PURE__ */ new Set();
    const ordered = [];
    for (const id of ids) {
      if (!existing.has(id) || seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
    if (!ordered.length) {
      throw new AppError("VALIDATION_ERROR", "没有可排序的清单");
    }
    const ts = nowIso();
    return this.withTx(() => {
      ordered.forEach((id, index) => {
        this.repo.update(id, { sortOrder: index, updatedAt: ts });
        const updated = this.repo.findById(id);
        this.enqueueUpsert(updated, 1);
      });
      return this.list();
    });
  }
}
function messageSyncPayload(message) {
  return {
    id: message.id,
    kind: message.kind,
    title: message.title,
    body: message.body,
    taskId: message.taskId,
    source: message.source,
    readAt: message.readAt,
    createdAt: message.createdAt,
    updatedAt: message.readAt ?? message.createdAt
  };
}
class AppMessageService {
  constructor(repo, outbox, getSyncPrefs) {
    this.repo = repo;
    this.outbox = outbox;
    this.getSyncPrefs = getSyncPrefs;
  }
  list(kind, source) {
    return this.repo.list(kind, 100, source);
  }
  countUnread(kind) {
    return this.repo.countUnread(kind);
  }
  create(dto) {
    const title = dto.title?.trim();
    if (!title) {
      throw new AppError("VALIDATION_ERROR", "消息标题不能为空");
    }
    const ts = nowIso();
    const message = {
      id: uuid.v4(),
      kind: dto.kind,
      title,
      body: dto.body?.trim() ? dto.body.trim() : null,
      taskId: dto.taskId ?? null,
      source: dto.source ?? null,
      readAt: null,
      createdAt: ts
    };
    this.repo.insert(message);
    this.enqueueIfSummaryResult(message);
    return message;
  }
  /** 任务提醒触发时写入应用内通知 */
  createTaskReminder(task) {
    return this.create({
      kind: "notification",
      title: "任务提醒",
      body: task.title,
      taskId: task.id,
      source: "task_reminder"
    });
  }
  markRead(id) {
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "消息不存在");
    }
    if (!existing.readAt) {
      this.repo.markRead(id, nowIso());
    }
    const updated = this.repo.findById(id);
    this.enqueueIfSummaryResult(updated);
    return updated;
  }
  markAllRead(kind) {
    const pendingRead = this.outbox && this.getSyncPrefs?.().syncSummaryResults ? this.repo.list("notification", 200, "scheduled_summary").filter((m) => !m.readAt).map((m) => m.id) : [];
    const n = this.repo.markAllRead(kind, nowIso());
    for (const id of pendingRead) {
      const updated = this.repo.findById(id);
      if (updated) this.enqueueIfSummaryResult(updated);
    }
    return n;
  }
  enqueueIfSummaryResult(message) {
    if (!this.outbox || !this.getSyncPrefs) return;
    if (!this.getSyncPrefs().syncSummaryResults) return;
    if (message.kind !== "notification" || message.source !== "scheduled_summary") return;
    this.outbox.record({
      entityType: "app_message",
      entityId: message.id,
      operation: "upsert",
      payload: messageSyncPayload(message),
      clientSyncVersion: 1
    });
  }
}
class KanbanGroupService {
  constructor(repo) {
    this.repo = repo;
  }
  /** 返回自定义列与未分组显示名（未分组列本身不入 groups） */
  listBoard(scopeKey) {
    if (!scopeKey?.trim()) {
      throw new AppError("VALIDATION_ERROR", "scopeKey 不能为空");
    }
    const all = this.repo.listByScope(scopeKey);
    const meta = all.find((g) => isKanbanUngroupedMetaId(g.id));
    const groups = all.filter((g) => !isKanbanUngroupedMetaId(g.id));
    return { groups, ungroupedName: meta?.name ?? "未分组" };
  }
  list(scopeKey) {
    return this.listBoard(scopeKey).groups;
  }
  create(dto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new AppError("VALIDATION_ERROR", "分组名称不能为空");
    }
    const scopeKey = dto.scopeKey?.trim();
    if (!scopeKey) {
      throw new AppError("VALIDATION_ERROR", "scopeKey 不能为空");
    }
    const ts = nowIso();
    let sortOrder = this.repo.maxCustomSortOrder(scopeKey) + 1;
    if (dto.refGroupId === KANBAN_UNGROUPED_ID) {
      if (dto.position === "before") {
        throw new AppError("VALIDATION_ERROR", "未分组左侧不能添加分组");
      }
      if (dto.position === "after") {
        sortOrder = 0;
        this.repo.shiftSortOrders(scopeKey, 0, 1);
      }
    } else if (dto.position === "before" && dto.refGroupId) {
      const ref = this.repo.findById(dto.refGroupId);
      if (!ref || ref.scopeKey !== scopeKey || isKanbanUngroupedMetaId(ref.id)) {
        throw new AppError("NOT_FOUND", "参考分组不存在");
      }
      sortOrder = ref.sortOrder;
      this.repo.shiftSortOrders(scopeKey, sortOrder, 1);
    } else if (dto.position === "after" && dto.refGroupId) {
      const ref = this.repo.findById(dto.refGroupId);
      if (!ref || ref.scopeKey !== scopeKey || isKanbanUngroupedMetaId(ref.id)) {
        throw new AppError("NOT_FOUND", "参考分组不存在");
      }
      sortOrder = ref.sortOrder + 1;
      this.repo.shiftSortOrders(scopeKey, sortOrder, 1);
    }
    const group = {
      id: uuid.v4(),
      scopeKey,
      name,
      sortOrder,
      createdAt: ts,
      updatedAt: ts
    };
    this.repo.insert(group);
    return group;
  }
  update(id, dto) {
    if (id === KANBAN_UNGROUPED_ID) {
      const scopeKey = dto.scopeKey?.trim();
      if (!scopeKey) {
        throw new AppError("VALIDATION_ERROR", "重命名未分组需要 scopeKey");
      }
      const name = dto.name?.trim() || "未分组";
      return this.upsertUngroupedMeta(scopeKey, name);
    }
    const existing = this.repo.findById(id);
    if (!existing || isKanbanUngroupedMetaId(existing.id)) {
      throw new AppError("NOT_FOUND", "分组不存在");
    }
    const updated = {
      ...existing,
      name: dto.name?.trim() ? dto.name.trim() : existing.name,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    };
    this.repo.update(updated);
    return updated;
  }
  delete(id) {
    if (id === KANBAN_UNGROUPED_ID || isKanbanUngroupedMetaId(id)) {
      throw new AppError("VALIDATION_ERROR", "不能删除未分组");
    }
    const existing = this.repo.findById(id);
    if (!existing) {
      throw new AppError("NOT_FOUND", "分组不存在");
    }
    this.repo.clearTasksGroupId(id);
    this.repo.delete(id);
  }
  upsertUngroupedMeta(scopeKey, name) {
    const metaId = kanbanUngroupedMetaId(scopeKey);
    const ts = nowIso();
    const existing = this.repo.findById(metaId);
    if (existing) {
      const updated = { ...existing, name, updatedAt: ts };
      this.repo.update(updated);
      return updated;
    }
    const group = {
      id: metaId,
      scopeKey,
      name,
      sortOrder: -1,
      createdAt: ts,
      updatedAt: ts
    };
    this.repo.insert(group);
    return group;
  }
}
const VALID_STATUS = ["TODO", "IN_PROGRESS", "DONE"];
function taskSyncPayload(task) {
  const { remindFiredAt: _omit, ...rest } = task;
  return { ...rest };
}
class TaskService {
  constructor(repo, reminderRepo, tagRepo, activityService, activityRecorder, outbox) {
    this.repo = repo;
    this.reminderRepo = reminderRepo;
    this.tagRepo = tagRepo;
    this.activityService = activityService;
    this.activityRecorder = activityRecorder;
    this.outbox = outbox;
  }
  withTx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  enqueueTaskUpsert(task) {
    this.outbox?.record({
      entityType: "task",
      entityId: task.id,
      operation: "upsert",
      payload: taskSyncPayload(task),
      clientSyncVersion: task.syncVersion
    });
  }
  enqueueTaskDelete(task, ts, syncVersion) {
    this.outbox?.record({
      entityType: "task",
      entityId: task.id,
      operation: "delete",
      payload: {
        id: task.id,
        deletedAt: ts,
        updatedAt: ts,
        syncVersion
      },
      clientSyncVersion: syncVersion
    });
  }
  list(filter) {
    const tasks = this.repo.list(filter ?? {});
    return this.attachTags(tasks);
  }
  get(id) {
    if (!id?.trim()) {
      throw new AppError("VALIDATION_ERROR", "任务 id 不能为空");
    }
    const task = this.repo.findById(id);
    if (!task) {
      throw new AppError("NOT_FOUND", "任务不存在");
    }
    return this.enrichTask(task);
  }
  getInTrash(id) {
    if (!id?.trim()) {
      throw new AppError("VALIDATION_ERROR", "任务 id 不能为空");
    }
    const task = this.repo.findByIdIncludingDeleted(id);
    if (!task?.deletedAt) {
      throw new AppError("NOT_FOUND", "任务不在垃圾桶中");
    }
    return this.enrichTask(task);
  }
  countTrash() {
    return this.repo.countTrash();
  }
  countDone() {
    return this.repo.countDone();
  }
  enrichTask(task) {
    const reminders = this.reminderRepo.listByTaskId(task.id);
    const tags = this.tagRepo.getTagsForTask(task.id);
    return {
      ...task,
      tags,
      reminders,
      remindAt: primaryRemindAt(reminders) ?? task.remindAt
    };
  }
  attachTags(tasks) {
    if (!tasks.length) {
      return tasks;
    }
    const tagMap = this.tagRepo.getTagsByTaskIds(tasks.map((t) => t.id));
    return tasks.map((task) => ({
      ...task,
      tags: tagMap.get(task.id) ?? []
    }));
  }
  normalizeReminderInputs(dto, dueAt) {
    if (dto.reminders !== void 0) {
      return dto.reminders;
    }
    if (dto.remindAt) {
      return [{ remindAt: dto.remindAt, offsetMinutes: null }];
    }
    return [];
  }
  create(dto) {
    const title = dto.title?.trim();
    if (!title) {
      throw new AppError("VALIDATION_ERROR", "任务标题不能为空");
    }
    let parent = null;
    if (dto.parentId) {
      parent = this.repo.findById(dto.parentId);
      if (!parent) {
        throw new AppError("NOT_FOUND", "父任务不存在");
      }
    }
    const status = dto.status ?? "TODO";
    const ts = nowIso();
    const dueAt = dto.dueAt ?? null;
    const reminderInputs = this.normalizeReminderInputs(dto, dueAt);
    const err = assertRemindersBeforeDue(reminderInputs, dueAt);
    if (err) {
      throw new AppError("VALIDATION_ERROR", err);
    }
    const recurrence = dto.recurrence ?? null;
    if (recurrence && !dueAt) {
      throw new AppError("VALIDATION_ERROR", "设置重复规则需要先设置截止时间");
    }
    let categoryId = dto.categoryId ?? null;
    if (!categoryId && parent?.categoryId) {
      categoryId = parent.categoryId;
    }
    const task = {
      id: uuid.v4(),
      title,
      description: dto.description ?? null,
      status,
      priority: coerceTaskPriority(dto.priority, DEFAULT_TASK_PRIORITY),
      categoryId,
      parentId: dto.parentId ?? null,
      startAt: dto.startAt ?? null,
      dueAt,
      remindAt: primaryRemindAt(reminderInputs),
      remindFiredAt: null,
      completedAt: status === "DONE" ? ts : null,
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
      syncVersion: 1,
      kanbanGroupId: dto.kanbanGroupId ?? null,
      recurrence,
      completedOccurrenceDates: [],
      remindContinuous: dto.remindContinuous ?? false,
      tags: dto.tags ? normalizeTagNames(dto.tags) : [],
      triagedAt: dto.triagedAt !== void 0 ? dto.triagedAt ?? null : null
    };
    return this.withTx(() => {
      this.repo.insert(task);
      if (task.tags.length) {
        this.tagRepo.setTaskTags(task.id, task.tags, ts);
      }
      if (reminderInputs.length) {
        this.reminderRepo.replaceForTask(task.id, reminderInputs, ts);
      }
      this.enqueueTaskUpsert(task);
      this.recordActivities(this.activityRecorder?.buildCreateEvents(task, dto) ?? []);
      return this.enrichTask(task);
    });
  }
  update(id, dto) {
    if (!id?.trim()) {
      throw new AppError("VALIDATION_ERROR", "任务 id 不能为空");
    }
    const existing = this.get(id);
    const nextStatus = dto.status ?? existing.status;
    if (!VALID_STATUS.includes(nextStatus)) {
      throw new AppError("VALIDATION_ERROR", "无效的任务状态");
    }
    if (nextStatus === "DONE" && existing.status !== "DONE") {
      const openChildren = this.repo.countOpenChildren(id);
      if (openChildren > 0) {
        throw new AppError("PARENT_HAS_OPEN_CHILDREN", "存在未完成的子任务");
      }
    }
    const ts = nowIso();
    let completedAt = existing.completedAt;
    if (nextStatus === "DONE") {
      completedAt = ts;
    } else if (existing.status === "DONE" && nextStatus !== "DONE") {
      completedAt = null;
    }
    const dueAt = dto.dueAt !== void 0 ? dto.dueAt ?? null : existing.dueAt;
    const startAt = dto.startAt !== void 0 ? dto.startAt ?? null : existing.startAt;
    const remindersTouched = dto.reminders !== void 0 || dto.remindAt !== void 0;
    let reminderInputs;
    if (dto.reminders !== void 0) {
      reminderInputs = dto.reminders;
    } else if (dto.remindAt !== void 0) {
      reminderInputs = dto.remindAt ? [{ remindAt: dto.remindAt, offsetMinutes: null }] : [];
    }
    if (reminderInputs) {
      const err = assertRemindersBeforeDue(reminderInputs, dueAt);
      if (err) {
        throw new AppError("VALIDATION_ERROR", err);
      }
    }
    const nextRecurrence = dto.recurrence !== void 0 ? dto.recurrence ?? null : existing.recurrence;
    if (nextRecurrence && !dueAt) {
      throw new AppError("VALIDATION_ERROR", "设置重复规则需要先设置截止时间");
    }
    let nextCompletedOccurrences = existing.completedOccurrenceDates ?? [];
    if (dto.completedOccurrenceDates !== void 0) {
      nextCompletedOccurrences = normalizeCompletedOccurrenceDates(dto.completedOccurrenceDates);
    } else if (dto.recurrence !== void 0 && !nextRecurrence) {
      nextCompletedOccurrences = [];
    }
    let remindFiredAt = existing.remindFiredAt;
    if (remindersTouched) {
      remindFiredAt = null;
    }
    const nextPriority = coerceTaskPriority(
      dto.priority ?? existing.priority,
      existing.priority
    );
    let triagedAt = existing.triagedAt ?? null;
    if (dto.priority !== void 0 && nextPriority !== existing.priority) {
      triagedAt = ts;
    }
    const updated = {
      ...existing,
      title: dto.title?.trim() ?? existing.title,
      description: dto.description !== void 0 ? dto.description ?? null : existing.description,
      status: nextStatus,
      priority: nextPriority,
      categoryId: dto.categoryId !== void 0 ? dto.categoryId ?? null : existing.categoryId,
      parentId: dto.parentId !== void 0 ? dto.parentId ?? null : existing.parentId,
      startAt,
      dueAt,
      remindAt: reminderInputs !== void 0 ? primaryRemindAt(reminderInputs) : existing.remindAt,
      remindFiredAt,
      completedAt,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      kanbanGroupId: dto.kanbanGroupId !== void 0 ? dto.kanbanGroupId ?? null : existing.kanbanGroupId,
      recurrence: nextRecurrence,
      completedOccurrenceDates: nextCompletedOccurrences,
      remindContinuous: dto.remindContinuous !== void 0 ? dto.remindContinuous : existing.remindContinuous,
      triagedAt,
      updatedAt: ts,
      syncVersion: existing.syncVersion + 1
    };
    if (!updated.title.trim()) {
      throw new AppError("VALIDATION_ERROR", "任务标题不能为空");
    }
    let nextTags = existing.tags ?? [];
    if (dto.tags !== void 0) {
      nextTags = normalizeTagNames(dto.tags);
    }
    updated.tags = nextTags;
    return this.withTx(() => {
      this.repo.update(updated);
      if (dto.tags !== void 0) {
        this.tagRepo.setTaskTags(id, nextTags, ts);
      }
      if (reminderInputs !== void 0) {
        this.reminderRepo.replaceForTask(id, reminderInputs, ts);
      } else if (dto.dueAt !== void 0 && dueAt && existing.reminders?.length) {
        this.reminderRepo.rebuildOffsetsForTask(id, dueAt);
      }
      this.enqueueTaskUpsert(updated);
      this.recordActivities(
        this.activityRecorder?.buildUpdateEvents(existing, updated, dto) ?? []
      );
      return this.enrichTask(updated);
    });
  }
  delete(id, options) {
    const task = this.get(id);
    const ts = nowIso();
    const childCount = this.repo.countChildren(id);
    if (childCount > 0) {
      if (!options?.cascadeChildren) {
        throw new AppError(
          "HAS_CHILDREN",
          `该任务下有 ${childCount} 个子任务，请确认是否一并删除`
        );
      }
      this.softDeleteSubtree(task, ts);
      return;
    }
    this.withTx(() => {
      const syncVersion = task.syncVersion + 1;
      this.recordDelete(task, ts);
      this.repo.softDelete(id, ts, syncVersion);
      this.enqueueTaskDelete(task, ts, syncVersion);
    });
  }
  recordDelete(task, ts) {
    if (!this.activityRecorder) return;
    const events = [];
    if (task.parentId) {
      events.push(
        this.activityRecorder.buildSubtaskParentEvents(task.parentId, task, "removed", ts)
      );
    }
    events.push(this.activityRecorder.buildDeleteEvent(task, ts));
    this.recordActivities(events);
  }
  softDeleteSubtree(task, ts) {
    this.withTx(() => {
      this.softDeleteSubtreeInTx(task, ts);
    });
  }
  softDeleteSubtreeInTx(task, ts) {
    for (const child of this.repo.findChildrenByParentId(task.id)) {
      this.softDeleteSubtreeInTx(child, ts);
    }
    const syncVersion = task.syncVersion + 1;
    this.recordDelete(task, ts);
    this.repo.softDelete(task.id, ts, syncVersion);
    this.enqueueTaskDelete(task, ts, syncVersion);
  }
  restore(id) {
    const task = this.repo.findByIdIncludingDeleted(id);
    if (!task?.deletedAt) {
      throw new AppError("NOT_FOUND", "任务不在垃圾桶中");
    }
    if (task.parentId) {
      const parent = this.repo.findByIdIncludingDeleted(task.parentId);
      if (parent?.deletedAt) {
        this.restore(task.parentId);
      } else if (!parent) {
        this.repo.clearParentOnDeleted(id, nowIso());
      }
    }
    const ts = nowIso();
    return this.withTx(() => {
      this.repo.restore(id, ts);
      if (this.activityRecorder) {
        this.recordActivities([this.activityRecorder.buildRestoreEvent(id, ts)]);
      }
      const restored = this.get(id);
      const withVersion = { ...restored, syncVersion: restored.syncVersion + 1, updatedAt: ts };
      this.repo.update(withVersion);
      this.enqueueTaskUpsert(withVersion);
      return this.enrichTask(withVersion);
    });
  }
  permanentDelete(id, options) {
    const task = this.repo.findByIdIncludingDeleted(id);
    if (!task?.deletedAt) {
      throw new AppError("NOT_FOUND", "任务不在垃圾桶中");
    }
    const childCount = this.repo.findDeletedChildrenByParentId(id).length;
    if (childCount > 0) {
      if (!options?.cascadeChildren) {
        throw new AppError(
          "HAS_CHILDREN",
          `该任务下有 ${childCount} 个子任务，请确认是否一并彻底删除`
        );
      }
      for (const child of this.repo.findDeletedChildrenByParentId(id)) {
        this.permanentDelete(child.id, { cascadeChildren: true });
      }
    }
    nowIso();
    this.reminderRepo.deleteByTaskId(id);
    this.activityService?.deleteByTaskId(id);
    this.repo.hardDelete(id);
  }
  emptyTrash() {
    this.activityService?.deleteForTrashedTasks();
    return this.repo.hardDeleteAllTrash();
  }
  /** 按 ids 顺序重写 sortOrder；未列出任务不变；未知 id 跳过；全非法报错；空数组 no-op */
  reorder(ids) {
    if (!ids.length) return [];
    const existing = new Set(
      this.repo.list({}).map((t) => t.id)
    );
    const seen = /* @__PURE__ */ new Set();
    const ordered = [];
    for (const id of ids) {
      if (!existing.has(id) || seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
    if (!ordered.length) {
      throw new AppError("VALIDATION_ERROR", "没有可排序的任务");
    }
    const ts = nowIso();
    return this.withTx(() => {
      const result = [];
      ordered.forEach((id, index) => {
        const task = this.repo.findById(id);
        if (!task) return;
        const next = {
          ...task,
          sortOrder: index,
          updatedAt: ts,
          syncVersion: task.syncVersion + 1
        };
        this.repo.update(next);
        this.enqueueTaskUpsert(next);
        result.push(this.enrichTask(next));
      });
      return result;
    });
  }
  recordActivities(inputs) {
    if (!this.activityService || !this.activityRecorder || !inputs.length) {
      return;
    }
    this.activityService.recordMany(this.activityRecorder.toActivities(inputs));
  }
}
function mapRow(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    payload: JSON.parse(row.payload_json),
    clientSyncVersion: row.client_sync_version,
    createdAt: row.created_at,
    pushedAt: row.pushed_at,
    status: row.status
  };
}
class SyncOutbox {
  constructor(db) {
    this.db = db;
  }
  runInTransaction(fn) {
    return this.db.transaction(fn)();
  }
  record(input) {
    const id = uuid.v4();
    const ts = nowIso();
    this.db.prepare(
      `INSERT INTO local_changes (
          id, entity_type, entity_id, operation, payload_json,
          client_sync_version, created_at, pushed_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`
    ).run(
      id,
      input.entityType,
      input.entityId,
      input.operation,
      JSON.stringify(input.payload),
      input.clientSyncVersion,
      ts
    );
    return id;
  }
  listPending(limit = 200) {
    const rows = this.db.prepare(
      `SELECT * FROM local_changes
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT ?`
    ).all(limit);
    return rows.map(mapRow);
  }
  /** 仅列出指定实体类型的 pending（避免关闭同步的类型堵死队列） */
  listPendingOfTypes(entityTypes, limit = 200) {
    if (!entityTypes.length) return [];
    const placeholders = entityTypes.map(() => "?").join(",");
    const rows = this.db.prepare(
      `SELECT * FROM local_changes
         WHERE status = 'pending' AND entity_type IN (${placeholders})
         ORDER BY created_at ASC
         LIMIT ?`
    ).all(...entityTypes, limit);
    return rows.map(mapRow);
  }
  countPending() {
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM local_changes WHERE status = 'pending'`).get();
    return row.cnt;
  }
  /** 是否已有待推送或曾成功推送的记录（存量补齐时跳过） */
  hasPendingOrPushed(entityType, entityId) {
    const row = this.db.prepare(
      `SELECT 1 as ok FROM local_changes
         WHERE entity_type = ? AND entity_id = ? AND status IN ('pending', 'pushed')
         LIMIT 1`
    ).get(entityType, entityId);
    return Boolean(row);
  }
  /**
   * 作废某实体的 pending/pushed 记录，便于换账号后强制重新入队推送。
   * discarded/rejected 不动。
   */
  discardPendingOrPushed(entityType, entityId) {
    this.db.prepare(
      `UPDATE local_changes
         SET status = 'discarded'
         WHERE entity_type = ? AND entity_id = ? AND status IN ('pending', 'pushed')`
    ).run(entityType, entityId);
  }
  markStatus(id, status, pushedAt) {
    const ts = pushedAt ?? (status === "pushed" ? nowIso() : null);
    this.db.prepare(
      `UPDATE local_changes
         SET status = ?, pushed_at = COALESCE(?, pushed_at)
         WHERE id = ?`
    ).run(status, ts, id);
  }
  markMany(ids, status) {
    const stmt = this.db.prepare(
      `UPDATE local_changes
       SET status = ?, pushed_at = CASE WHEN ? = 'pushed' THEN ? ELSE pushed_at END
       WHERE id = ?`
    );
    const ts = nowIso();
    const run = this.db.transaction((list) => {
      for (const id of list) {
        stmt.run(status, status, ts, id);
      }
    });
    run(ids);
  }
}
const SYNC_INTERVAL_OPTIONS_MS = [3e4, 6e4, 12e4, 3e5];
const DEFAULT_SYNC_PREFERENCES = {
  syncTasks: true,
  syncConfig: true,
  syncNotes: true,
  syncSummaryResults: true,
  syncIntervalMs: 3e4
};
function isSyncIntervalMs(value) {
  return typeof value === "number" && SYNC_INTERVAL_OPTIONS_MS.includes(value);
}
function mergeSyncPreferences(partial) {
  const base = { ...DEFAULT_SYNC_PREFERENCES };
  if (!partial) return base;
  return {
    syncTasks: partial.syncTasks ?? base.syncTasks,
    syncConfig: partial.syncConfig ?? base.syncConfig,
    syncNotes: partial.syncNotes ?? base.syncNotes,
    syncSummaryResults: partial.syncSummaryResults ?? base.syncSummaryResults,
    syncIntervalMs: isSyncIntervalMs(partial.syncIntervalMs) ? partial.syncIntervalMs : base.syncIntervalMs
  };
}
const FILE_NAME$1 = "sync-preferences.json";
function readSyncPreferences(dataDir) {
  const path2 = node_path.join(dataDir, FILE_NAME$1);
  if (!node_fs.existsSync(path2)) return mergeSyncPreferences();
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    return mergeSyncPreferences(raw);
  } catch {
    return mergeSyncPreferences();
  }
}
function writeSyncPreferences(dataDir, prefs) {
  const merged = mergeSyncPreferences(prefs);
  node_fs.mkdirSync(dataDir, { recursive: true });
  node_fs.writeFileSync(node_path.join(dataDir, FILE_NAME$1), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
const XOR_KEY = new TextEncoder().encode("QuickBootOAuth1");
const DEFAULT_CLIENT_ID = "ai-todo-desktop";
const DEFAULT_CLIENT_SECRET = "ai-todo-desktop-secret";
function xorBytes(bytes) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ XOR_KEY[i % XOR_KEY.length];
  }
  return out;
}
function bytesToBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function obfuscateCredential(plain) {
  return bytesToBase64Url(xorBytes(new TextEncoder().encode(plain)));
}
function buildObfuscatedBasicAuthorization(clientId, clientSecret) {
  const env = typeof process !== "undefined" ? process.env : void 0;
  const id = env?.SYNC_OAUTH_CLIENT_ID ?? env?.VITE_OAUTH_CLIENT_ID ?? DEFAULT_CLIENT_ID;
  const secret = env?.SYNC_OAUTH_CLIENT_SECRET ?? env?.VITE_OAUTH_CLIENT_SECRET ?? DEFAULT_CLIENT_SECRET;
  if (!id || !secret) {
    return null;
  }
  return "Basic " + obfuscateCredential(`${id}:${secret}`);
}
const SYNC_ENTITY_TYPES = [
  "category",
  "task",
  "task_reminder",
  "tag",
  "task_tag",
  "widget_note",
  "app_settings",
  "task_view",
  "scheduled_summary",
  "app_message"
];
const DEFAULT_SYNC_SERVER_URL = "https://aitodo.126w.com";
function isSyncEntityEnabled(entityType, prefs) {
  switch (entityType) {
    case "category":
    case "task":
    case "task_reminder":
    case "tag":
    case "task_tag":
      return prefs.syncTasks;
    case "widget_note":
      return prefs.syncNotes;
    case "app_settings":
    case "task_view":
    case "scheduled_summary":
      return prefs.syncConfig;
    case "app_message":
      return prefs.syncSummaryResults;
    default:
      return false;
  }
}
function credentialsPath(dataDir) {
  return node_path.join(dataDir, "sync-credentials.json");
}
function readSyncCredentials(dataDir) {
  const path2 = credentialsPath(dataDir);
  if (!node_fs.existsSync(path2)) return null;
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    if (!raw?.accessToken || !raw?.userId) return null;
    return raw;
  } catch {
    return null;
  }
}
function writeSyncCredentials(dataDir, creds) {
  const path2 = credentialsPath(dataDir);
  node_fs.mkdirSync(node_path.dirname(path2), { recursive: true });
  node_fs.writeFileSync(path2, JSON.stringify(creds, null, 2), { encoding: "utf8", mode: 384 });
}
function clearSyncCredentials(dataDir) {
  const path2 = credentialsPath(dataDir);
  if (node_fs.existsSync(path2)) {
    node_fs.unlinkSync(path2);
  }
}
function mapState(row) {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    serverBaseUrl: row.server_base_url,
    lastPulledCursor: row.last_pulled_cursor,
    lastPushedAt: row.last_pushed_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    authExpiresAt: row.auth_expires_at,
    updatedAt: row.updated_at
  };
}
function ensureSyncState(db) {
  const existing = db.prepare(`SELECT * FROM sync_state WHERE id = 'default'`).get();
  if (existing) return mapState(existing);
  const ts = nowIso();
  const deviceId = uuid.v4();
  db.prepare(
    `INSERT INTO sync_state (
      id, device_id, user_id, server_base_url, last_pulled_cursor,
      last_pushed_at, last_sync_at, last_error, auth_expires_at, updated_at
    ) VALUES ('default', ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?)`
  ).run(deviceId, ts);
  return ensureSyncState(db);
}
function updateSyncState(db, patch) {
  const current = ensureSyncState(db);
  const next = {
    ...current,
    deviceId: patch.deviceId ?? current.deviceId,
    userId: patch.userId !== void 0 ? patch.userId : current.userId,
    serverBaseUrl: patch.serverBaseUrl !== void 0 ? patch.serverBaseUrl : current.serverBaseUrl,
    lastPulledCursor: patch.lastPulledCursor !== void 0 ? patch.lastPulledCursor : current.lastPulledCursor,
    lastPushedAt: patch.lastPushedAt !== void 0 ? patch.lastPushedAt : current.lastPushedAt,
    lastSyncAt: patch.lastSyncAt !== void 0 ? patch.lastSyncAt : current.lastSyncAt,
    lastError: patch.lastError !== void 0 ? patch.lastError : current.lastError,
    authExpiresAt: patch.authExpiresAt !== void 0 ? patch.authExpiresAt : current.authExpiresAt,
    updatedAt: nowIso()
  };
  db.prepare(
    `UPDATE sync_state SET
      device_id = ?, user_id = ?, server_base_url = ?, last_pulled_cursor = ?,
      last_pushed_at = ?, last_sync_at = ?, last_error = ?, auth_expires_at = ?, updated_at = ?
     WHERE id = 'default'`
  ).run(
    next.deviceId,
    next.userId,
    next.serverBaseUrl,
    next.lastPulledCursor,
    next.lastPushedAt,
    next.lastSyncAt,
    next.lastError,
    next.authExpiresAt,
    next.updatedAt
  );
  return next;
}
const FILE_NAME = "ui-preferences-snapshot.json";
function readUiPreferencesSnapshot(dataDir) {
  const path2 = node_path.join(dataDir, FILE_NAME);
  if (!node_fs.existsSync(path2)) return {};
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
function writeUiPreferencesSnapshot(dataDir, prefs) {
  node_fs.mkdirSync(dataDir, { recursive: true });
  node_fs.writeFileSync(node_path.join(dataDir, FILE_NAME), JSON.stringify(prefs, null, 2), "utf8");
}
const WIDGET_NOTE_COLORS = ["yellow", "green", "blue", "pink", "gray"];
const WIDGET_KINDS = ["notes", "matrix", "view"];
const WIDGET_KIND_LABELS = {
  notes: "便签",
  matrix: "四象限",
  view: "视图"
};
const WIDGET_DEFAULT_WIDTH = 320;
const WIDGET_DEFAULT_HEIGHT = 420;
const WIDGET_KANBAN_DEFAULT_WIDTH = 392;
const WIDGET_KANBAN_DEFAULT_HEIGHT = 520;
function widgetInstanceDisplayName(instance) {
  if (instance.name.trim()) {
    return instance.name.trim();
  }
  return WIDGET_KIND_LABELS[instance.kind];
}
function sortWidgetNotes(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
const SETTINGS_ID = "default";
function mapSettings(row) {
  return {
    id: row.id,
    openOnStartup: row.open_on_startup === 1,
    updatedAt: row.updated_at
  };
}
function mapNote(row) {
  const color = WIDGET_NOTE_COLORS.includes(row.color) ? row.color : "yellow";
  return {
    id: row.id,
    content: row.content,
    color,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
class WidgetNoteRepository {
  constructor(db) {
    this.db = db;
  }
  getSettings() {
    const row = this.db.prepare(`SELECT * FROM widget_settings WHERE id = ?`).get(SETTINGS_ID);
    if (!row) {
      throw new AppError("INTERNAL", "挂件设置未初始化");
    }
    return mapSettings(row);
  }
  updateSettings(dto) {
    const current = this.getSettings();
    const ts = nowIso();
    const next = {
      openOnStartup: dto.openOnStartup ?? current.openOnStartup,
      updatedAt: ts
    };
    this.db.prepare(
      `UPDATE widget_settings SET open_on_startup = @openOnStartup, updated_at = @updatedAt WHERE id = @id`
    ).run({
      id: SETTINGS_ID,
      openOnStartup: next.openOnStartup ? 1 : 0,
      updatedAt: ts
    });
    return { id: SETTINGS_ID, ...next };
  }
  listNotes() {
    const rows = this.db.prepare(`SELECT * FROM widget_notes`).all();
    return sortWidgetNotes(rows.map(mapNote));
  }
  findNote(id) {
    const row = this.db.prepare(`SELECT * FROM widget_notes WHERE id = ?`).get(id);
    return row ? mapNote(row) : null;
  }
  createNote(dto = {}) {
    const ts = nowIso();
    const id = uuid.v4();
    const color = dto.color && WIDGET_NOTE_COLORS.includes(dto.color) ? dto.color : "yellow";
    const content = dto.content ?? "";
    this.db.prepare(
      `INSERT INTO widget_notes (id, content, color, pinned, created_at, updated_at)
         VALUES (@id, @content, @color, 0, @createdAt, @updatedAt)`
    ).run({ id, content, color, createdAt: ts, updatedAt: ts });
    return {
      id,
      content,
      color,
      pinned: false,
      createdAt: ts,
      updatedAt: ts
    };
  }
  updateNote(id, dto) {
    const current = this.findNote(id);
    if (!current) {
      throw new AppError("NOT_FOUND", "便签不存在");
    }
    const ts = nowIso();
    const next = {
      ...current,
      content: dto.content ?? current.content,
      color: dto.color && WIDGET_NOTE_COLORS.includes(dto.color) ? dto.color : current.color,
      pinned: dto.pinned ?? current.pinned,
      updatedAt: ts
    };
    this.db.prepare(
      `UPDATE widget_notes SET content = @content, color = @color, pinned = @pinned, updated_at = @updatedAt
         WHERE id = @id`
    ).run({
      id,
      content: next.content,
      color: next.color,
      pinned: next.pinned ? 1 : 0,
      updatedAt: ts
    });
    return next;
  }
  deleteNote(id) {
    const result = this.db.prepare(`DELETE FROM widget_notes WHERE id = ?`).run(id);
    if (result.changes === 0) {
      throw new AppError("NOT_FOUND", "便签不存在");
    }
  }
  /** 远程同步写入：保留服务端时间戳 */
  upsertFromSync(note) {
    const color = WIDGET_NOTE_COLORS.includes(note.color) ? note.color : "yellow";
    const existing = this.findNote(note.id);
    if (existing) {
      this.db.prepare(
        `UPDATE widget_notes SET content = @content, color = @color, pinned = @pinned,
           created_at = @createdAt, updated_at = @updatedAt WHERE id = @id`
      ).run({
        id: note.id,
        content: note.content,
        color,
        pinned: note.pinned ? 1 : 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
      });
      return;
    }
    this.db.prepare(
      `INSERT INTO widget_notes (id, content, color, pinned, created_at, updated_at)
         VALUES (@id, @content, @color, @pinned, @createdAt, @updatedAt)`
    ).run({
      id: note.id,
      content: note.content,
      color,
      pinned: note.pinned ? 1 : 0,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    });
  }
  deleteIfExists(id) {
    this.db.prepare(`DELETE FROM widget_notes WHERE id = ?`).run(id);
  }
}
function readApiEnvelopeError(envelope) {
  const text = (envelope.message ?? envelope.msg)?.trim();
  if (text) {
    return text;
  }
  return `业务错误 ${envelope.code}`;
}
class SyncApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "SyncApiError";
  }
}
class SyncApiClient {
  constructor(baseUrl, accessToken = null) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }
  setBaseUrl(url2) {
    this.baseUrl = url2.replace(/\/+$/, "");
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  setAccessToken(token) {
    this.accessToken = token;
  }
  async login(dto) {
    const tokenVo = await this.requestR("POST", "/login", dto, { oauth: true });
    return this.finalizeAuthSession(tokenVo.accessToken);
  }
  /** 自注册；成功后与 login 相同：签发 token 并拉取 /auth/me。 */
  async register(dto) {
    const tokenVo = await this.requestR("POST", "/register", dto, { oauth: true });
    return this.finalizeAuthSession(tokenVo.accessToken);
  }
  async push(body) {
    return this.requestDesktop("POST", "/api/sync/push", body, true);
  }
  async pull(cursor, limit = 200) {
    const q = new URLSearchParams({ cursor: cursor || "0", limit: String(limit) });
    return this.requestDesktop("GET", `/api/sync/pull?${q}`, void 0, true);
  }
  async status() {
    return this.requestDesktop("GET", "/api/sync/status", void 0, true);
  }
  /** 登录/注册后补全 userId、username（LoginController 仅返回 token）。 */
  async finalizeAuthSession(accessToken) {
    this.setAccessToken(accessToken);
    const me = await this.requestR("GET", "/auth/me", void 0, { bearer: true });
    return {
      accessToken,
      userId: me.userId ?? "",
      username: me.username ?? ""
    };
  }
  /** R<T> 协议：code===200 为成功。 */
  async requestR(method, path2, body, opts = {}) {
    const url2 = `${this.baseUrl.replace(/\/+$/, "")}${path2}`;
    const headers = {
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    if (opts.bearer) {
      if (!this.accessToken) {
        throw new SyncApiError("未登录", 401);
      }
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else if (opts.oauth) {
      const basic = buildObfuscatedBasicAuthorization();
      if (!basic) {
        throw new SyncApiError("未配置 OAuth 客户端凭证", 500);
      }
      headers.Authorization = basic;
    }
    let res;
    try {
      res = await fetch(url2, {
        method,
        headers,
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: AbortSignal.timeout(3e4)
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new SyncApiError("同步请求超时", 500);
      }
      throw new SyncApiError(
        err instanceof Error ? `网络错误：${err.message}` : "网络错误",
        500
      );
    }
    let envelope;
    try {
      envelope = await res.json();
    } catch {
      throw new SyncApiError(`无效响应 HTTP ${res.status}`, res.status);
    }
    if (envelope.code !== 200) {
      const text = envelope.msg?.trim();
      throw new SyncApiError(text || `业务错误 ${envelope.code}`, envelope.code);
    }
    return envelope.data;
  }
  /** DesktopApiResponse 协议：code===0 为成功。 */
  async requestDesktop(method, path2, body, auth = true) {
    const url2 = `${this.baseUrl.replace(/\/+$/, "")}${path2}`;
    const headers = {
      Accept: "application/json"
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    if (auth) {
      if (!this.accessToken) {
        throw new SyncApiError("未登录", 401);
      }
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    let res;
    try {
      res = await fetch(url2, {
        method,
        headers,
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: AbortSignal.timeout(3e4)
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new SyncApiError("同步请求超时", 500);
      }
      throw new SyncApiError(
        err instanceof Error ? `网络错误：${err.message}` : "网络错误",
        500
      );
    }
    let envelope;
    try {
      envelope = await res.json();
    } catch {
      throw new SyncApiError(`无效响应 HTTP ${res.status}`, res.status);
    }
    if (envelope.code !== 0) {
      throw new SyncApiError(readApiEnvelopeError(envelope), envelope.code);
    }
    return envelope.data;
  }
}
function applyLaunchAtLoginToSystem(prefs, electronApp) {
  const merged = mergeLaunchAtLoginPrefs(prefs);
  if (!merged.enabled) {
    electronApp.setLoginItemSettings({
      openAtLogin: false,
      openAsHidden: false,
      args: []
    });
    return;
  }
  const hidden = merged.startupMode === "tray";
  electronApp.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: hidden,
    args: hidden ? ["--hidden"] : []
  });
}
function reconcileLaunchAtLoginPrefs(local, electronApp) {
  const merged = mergeLaunchAtLoginPrefs(local);
  let systemOpen = false;
  try {
    systemOpen = Boolean(electronApp.getLoginItemSettings().openAtLogin);
  } catch {
    return { prefs: merged, syncedFromSystem: false };
  }
  if (systemOpen === merged.enabled) {
    return { prefs: merged, syncedFromSystem: false };
  }
  return {
    prefs: { ...merged, enabled: systemOpen },
    syncedFromSystem: true
  };
}
const APP_SETTINGS_ENTITY_ID = "default";
function buildAppSettingsPayload(widgetNoteRepo, uiPreferences) {
  const settings = widgetNoteRepo.getSettings();
  return {
    id: APP_SETTINGS_ENTITY_ID,
    updatedAt: nowIso(),
    shortcuts: readShortcutBindings(),
    llm: readLlmConfig(),
    aiPrompt: readAiPromptConfig(),
    closeBehavior: readCloseBehavior(),
    launchAtLogin: readLaunchAtLoginPrefs(),
    taskActivityRetention: readTaskActivityRetention(),
    widget: { openOnStartup: settings.openOnStartup },
    ...uiPreferences ? { uiPreferences } : {}
  };
}
function enqueueAppSettingsUpsert(outbox, widgetNoteRepo, uiPreferences) {
  const payload = buildAppSettingsPayload(widgetNoteRepo, uiPreferences);
  outbox.record({
    entityType: "app_settings",
    entityId: APP_SETTINGS_ENTITY_ID,
    operation: "upsert",
    payload,
    clientSyncVersion: 1
  });
}
function applyAppSettingsPayload(payload, widgetNoteRepo, dataDir) {
  if (payload.shortcuts && typeof payload.shortcuts === "object") {
    saveShortcutBindings(mergeShortcutBindings(payload.shortcuts));
  }
  if (payload.llm && typeof payload.llm === "object") {
    saveLlmConfig(mergeLlmConfig(payload.llm));
  }
  if (payload.aiPrompt && typeof payload.aiPrompt === "object") {
    saveAiPromptConfig(mergeAiPromptConfig(payload.aiPrompt));
  }
  if (payload.closeBehavior && typeof payload.closeBehavior === "object") {
    saveCloseBehavior(mergeCloseBehavior(payload.closeBehavior));
  }
  if (payload.launchAtLogin && typeof payload.launchAtLogin === "object") {
    const merged = mergeLaunchAtLoginPrefs(payload.launchAtLogin);
    saveLaunchAtLoginPrefs(merged);
    try {
      applyLaunchAtLoginToSystem(merged, electron.app);
    } catch {
    }
  }
  if (payload.taskActivityRetention && typeof payload.taskActivityRetention === "object") {
    saveTaskActivityRetention(mergeTaskActivityRetention(payload.taskActivityRetention));
  }
  const widget = payload.widget;
  if (widget && typeof widget.openOnStartup === "boolean") {
    widgetNoteRepo.updateSettings({ openOnStartup: widget.openOnStartup });
  }
  const ui = payload.uiPreferences;
  if (ui && typeof ui === "object" && !Array.isArray(ui) && dataDir) {
    const prefs = {};
    for (const [k, v] of Object.entries(ui)) {
      if (typeof v === "string") prefs[k] = v;
    }
    writeUiPreferencesSnapshot(dataDir, prefs);
    return prefs;
  }
  return null;
}
const APPLY_ORDER = [
  "category",
  "tag",
  "task",
  "task_tag",
  "task_reminder",
  "task_view",
  "scheduled_summary",
  "app_message",
  "app_settings",
  "widget_note"
];
function orderKey(entityType) {
  const i = APPLY_ORDER.indexOf(entityType);
  return i >= 0 ? i : 99;
}
function sortPullChanges(changes) {
  return [...changes].sort((a, b) => {
    const o = orderKey(a.entityType) - orderKey(b.entityType);
    if (o !== 0) return o;
    return a.revision - b.revision;
  });
}
function applyRemoteChange(db, change, opts) {
  if (change.originDeviceId && change.originDeviceId === opts.deviceId && opts.localSyncVersion !== void 0 && typeof change.payload.syncVersion === "number" && opts.localSyncVersion >= change.payload.syncVersion) {
    return false;
  }
  switch (change.entityType) {
    case "category":
      applyCategory(db, change);
      return true;
    case "task":
      applyTask(db, change);
      return true;
    case "widget_note":
      applyWidgetNote(db, change);
      return true;
    case "app_settings":
      applyAppSettings(db, change, opts);
      return true;
    case "task_view":
      applyTaskView(db, change);
      return true;
    case "scheduled_summary":
      applyScheduledSummary(db, change);
      return true;
    case "app_message":
      applyAppMessage(db, change);
      return true;
    case "tag":
    case "task_tag":
    case "task_reminder":
      return false;
    default:
      return false;
  }
}
function applyAppSettings(db, change, opts) {
  if (change.operation === "delete") return;
  const uiPrefs = applyAppSettingsPayload(
    change.payload,
    new WidgetNoteRepository(db),
    opts.dataDir
  );
  if (uiPrefs && opts.onUiPreferencesApplied) {
    opts.onUiPreferencesApplied(uiPrefs);
  }
}
function applyTaskView(db, change) {
  const repo = new TaskViewRepository(db);
  const p = change.payload;
  const id = String(p.id ?? change.entityId);
  if (change.operation === "delete") {
    if (repo.findById(id)) {
      repo.delete(id);
    }
    return;
  }
  let filterRule = null;
  if (p.filterRule != null) {
    if (typeof p.filterRule === "string") {
      filterRule = parseFilterAstJson(p.filterRule);
    } else if (typeof p.filterRule === "object") {
      filterRule = p.filterRule;
    }
  }
  const view = {
    id,
    name: String(p.name ?? "未命名视图"),
    layout: p.layout ?? "list",
    scopeKey: p.scopeKey ?? null,
    filterRule,
    groupBy: p.groupBy ?? "none",
    sortBy: p.sortBy ?? "custom",
    kanbanBoardMode: p.kanbanBoardMode ?? null,
    quadrantOptions: p.quadrantOptions ?? null,
    sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : 0,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  };
  const existing = repo.findById(id);
  if (existing && existing.updatedAt > view.updatedAt) {
    return;
  }
  if (existing) {
    repo.update(view);
  } else {
    repo.insert(view);
  }
}
function applyScheduledSummary(db, change) {
  const repo = new ScheduledSummaryRepository(db);
  const p = change.payload;
  const id = String(p.id ?? change.entityId);
  if (change.operation === "delete") {
    if (repo.findById(id)) {
      repo.delete(id);
    }
    return;
  }
  const summary = {
    id,
    name: String(p.name ?? "汇总"),
    categoryIds: Array.isArray(p.categoryIds) ? p.categoryIds : [],
    scheduleType: p.scheduleType ?? "daily",
    sendTime: String(p.sendTime ?? "09:00"),
    sendWeekday: typeof p.sendWeekday === "number" ? p.sendWeekday : null,
    sendDay: typeof p.sendDay === "number" ? p.sendDay : null,
    useLlm: Boolean(p.useLlm),
    promptText: p.promptText ?? null,
    reportConfig: normalizeReportConfigV2(p.reportConfig),
    enabled: p.enabled !== false,
    lastSentAt: p.lastSentAt ?? null,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  };
  const existing = repo.findById(id);
  if (existing && existing.updatedAt > summary.updatedAt) {
    return;
  }
  if (existing) {
    repo.update(summary);
  } else {
    repo.insert(summary);
  }
}
function applyAppMessage(db, change) {
  const repo = new AppMessageRepository(db);
  const p = change.payload;
  const id = String(p.id ?? change.entityId);
  if (change.operation === "delete") {
    repo.deleteById(id);
    return;
  }
  const sourceRaw = p.source;
  const source = sourceRaw === "task_reminder" || sourceRaw === "scheduled_summary" ? sourceRaw : null;
  if (source !== "scheduled_summary") return;
  const kind = p.kind === "activity" ? "activity" : "notification";
  const message = {
    id,
    kind,
    title: String(p.title ?? "定时汇总"),
    body: p.body ?? null,
    taskId: p.taskId ?? null,
    source,
    readAt: p.readAt ?? null,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt)
  };
  const remoteUpdatedAt = String(p.updatedAt ?? p.readAt ?? message.createdAt);
  const existing = repo.findById(id);
  if (existing) {
    const localUpdatedAt = existing.readAt ?? existing.createdAt;
    if (localUpdatedAt > remoteUpdatedAt) return;
  }
  repo.upsertFromSync(message);
}
function applyCategory(db, change) {
  const repo = new CategoryRepository(db);
  const p = change.payload;
  if (change.operation === "delete") {
    const id = String(p.id ?? change.entityId);
    const ts = String(p.updatedAt ?? p.deletedAt ?? change.serverUpdatedAt);
    if (repo.findById(id)) {
      repo.softDelete(id, ts);
    }
    return;
  }
  const category = {
    id: String(p.id ?? change.entityId),
    name: String(p.name ?? "未命名"),
    color: p.color ?? "#409EFF",
    sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : 0,
    keywords: Array.isArray(p.keywords) ? p.keywords : [],
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt),
    deletedAt: p.deletedAt ?? null
  };
  const existing = repo.findById(category.id);
  if (existing) {
    if (category.deletedAt) {
      repo.softDelete(category.id, category.deletedAt);
    } else {
      repo.update(category.id, {
        name: category.name,
        color: category.color,
        sortOrder: category.sortOrder,
        keywords: category.keywords,
        updatedAt: category.updatedAt
      });
    }
  } else if (!category.deletedAt) {
    repo.insert(category);
  }
}
function applyTask(db, change) {
  const repo = new TaskRepository(db);
  const reminderRepo = new TaskReminderRepository(db);
  const tagRepo = new TagRepository(db);
  const p = change.payload;
  const id = String(p.id ?? change.entityId);
  if (change.operation === "delete") {
    const ts = String(p.updatedAt ?? p.deletedAt ?? change.serverUpdatedAt);
    const syncVersion = typeof p.syncVersion === "number" ? p.syncVersion : (repo.findByIdIncludingDeleted(id)?.syncVersion ?? 0) + 1;
    if (repo.findById(id)) {
      repo.softDelete(id, ts, syncVersion);
    }
    return;
  }
  const existing = repo.findByIdIncludingDeleted(id);
  const localFired = existing?.remindFiredAt ?? null;
  const remoteRemindAt = p.remindAt ?? null;
  let remindFiredAt = localFired;
  if (existing && remoteRemindAt && existing.remindAt && remoteRemindAt !== existing.remindAt) {
    remindFiredAt = null;
  }
  const task = {
    id,
    title: String(p.title ?? "未命名"),
    description: p.description ?? null,
    status: p.status ?? "TODO",
    priority: typeof p.priority === "number" ? p.priority : 4,
    categoryId: p.categoryId ?? null,
    parentId: p.parentId ?? null,
    startAt: p.startAt ?? null,
    dueAt: p.dueAt ?? null,
    remindAt: remoteRemindAt,
    remindFiredAt,
    completedAt: p.completedAt ?? null,
    sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : 0,
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt),
    deletedAt: p.deletedAt ?? null,
    syncVersion: typeof p.syncVersion === "number" ? p.syncVersion : 1,
    kanbanGroupId: p.kanbanGroupId ?? null,
    recurrence: p.recurrence ?? null,
    completedOccurrenceDates: Array.isArray(p.completedOccurrenceDates) ? p.completedOccurrenceDates : [],
    remindContinuous: Boolean(p.remindContinuous),
    tags: Array.isArray(p.tags) ? p.tags : [],
    triagedAt: p.triagedAt ?? null
  };
  if (task.deletedAt) {
    if (existing && !existing.deletedAt) {
      repo.softDelete(id, task.deletedAt, task.syncVersion);
    }
    return;
  }
  if (existing) {
    if (existing.deletedAt) {
      repo.restore(id, task.updatedAt);
    }
    repo.update(task);
  } else {
    repo.insert(task);
  }
  if (Array.isArray(p.reminders)) {
    const inputs = p.reminders.map(
      (r) => ({
        remindAt: r.remindAt,
        offsetMinutes: r.offsetMinutes ?? null
      })
    );
    reminderRepo.replaceForTask(id, inputs, task.updatedAt);
  }
  if (Array.isArray(p.tags)) {
    tagRepo.setTaskTags(id, p.tags, task.updatedAt);
  }
}
function applyWidgetNote(db, change) {
  const repo = new WidgetNoteRepository(db);
  const p = change.payload;
  const id = String(p.id ?? change.entityId);
  if (change.operation === "delete") {
    repo.deleteIfExists(id);
    return;
  }
  const colorRaw = String(p.color ?? "yellow");
  const color = WIDGET_NOTE_COLORS.includes(colorRaw) ? colorRaw : "yellow";
  const note = {
    id,
    content: String(p.content ?? ""),
    color,
    pinned: Boolean(p.pinned),
    createdAt: String(p.createdAt ?? change.serverUpdatedAt),
    updatedAt: String(p.updatedAt ?? change.serverUpdatedAt)
  };
  const existing = repo.findNote(id);
  if (existing && existing.updatedAt > note.updatedAt) {
    return;
  }
  repo.upsertFromSync(note);
}
function taskViewToSyncPayload(view) {
  return {
    id: view.id,
    name: view.name,
    layout: view.layout,
    scopeKey: view.scopeKey,
    filterRule: view.filterRule,
    groupBy: view.groupBy,
    sortBy: view.sortBy,
    kanbanBoardMode: view.kanbanBoardMode,
    quadrantOptions: view.quadrantOptions,
    sortOrder: view.sortOrder,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt
  };
}
function enqueueMissingLocalEntities(db, prefs, dataDir, options) {
  const forceRepush = Boolean(options?.forceRepush);
  const outbox = new SyncOutbox(db);
  let enqueued = 0;
  function shouldSkip(entityType, entityId) {
    if (forceRepush) {
      outbox.discardPendingOrPushed(entityType, entityId);
      return false;
    }
    return outbox.hasPendingOrPushed(entityType, entityId);
  }
  outbox.runInTransaction(() => {
    if (isSyncEntityEnabled("category", prefs)) {
      const cats = new CategoryRepository(db).list();
      for (const c of cats) {
        if (shouldSkip("category", c.id)) continue;
        outbox.record({
          entityType: "category",
          entityId: c.id,
          operation: "upsert",
          payload: {
            id: c.id,
            name: c.name,
            color: c.color,
            sortOrder: c.sortOrder,
            keywords: c.keywords,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt
          },
          clientSyncVersion: 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("task", prefs)) {
      const tasks = new TaskRepository(db).list({});
      for (const t of tasks) {
        if (shouldSkip("task", t.id)) continue;
        const { remindFiredAt: _omit, ...payload } = t;
        outbox.record({
          entityType: "task",
          entityId: t.id,
          operation: "upsert",
          payload: { ...payload },
          clientSyncVersion: t.syncVersion || 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("widget_note", prefs)) {
      const notes = new WidgetNoteRepository(db).listNotes();
      for (const n of notes) {
        if (shouldSkip("widget_note", n.id)) continue;
        outbox.record({
          entityType: "widget_note",
          entityId: n.id,
          operation: "upsert",
          payload: {
            id: n.id,
            content: n.content,
            color: n.color,
            pinned: n.pinned,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt
          },
          clientSyncVersion: 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("task_view", prefs)) {
      const views = new TaskViewRepository(db).list();
      for (const v of views) {
        if (shouldSkip("task_view", v.id)) continue;
        outbox.record({
          entityType: "task_view",
          entityId: v.id,
          operation: "upsert",
          payload: taskViewToSyncPayload(v),
          clientSyncVersion: 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("scheduled_summary", prefs)) {
      const summaries = new ScheduledSummaryRepository(db).list();
      for (const s of summaries) {
        if (shouldSkip("scheduled_summary", s.id)) continue;
        outbox.record({
          entityType: "scheduled_summary",
          entityId: s.id,
          operation: "upsert",
          payload: {
            id: s.id,
            name: s.name,
            categoryIds: s.categoryIds,
            scheduleType: s.scheduleType,
            sendTime: s.sendTime,
            sendWeekday: s.sendWeekday,
            sendDay: s.sendDay,
            useLlm: s.useLlm,
            promptText: s.promptText,
            reportConfig: s.reportConfig,
            enabled: s.enabled,
            lastSentAt: s.lastSentAt,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
          },
          clientSyncVersion: 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("app_message", prefs)) {
      const messages = new AppMessageRepository(db).list(
        "notification",
        500,
        "scheduled_summary"
      );
      for (const m of messages) {
        if (shouldSkip("app_message", m.id)) continue;
        outbox.record({
          entityType: "app_message",
          entityId: m.id,
          operation: "upsert",
          payload: {
            id: m.id,
            kind: m.kind,
            title: m.title,
            body: m.body,
            taskId: m.taskId,
            source: m.source,
            readAt: m.readAt,
            createdAt: m.createdAt,
            updatedAt: m.readAt ?? m.createdAt
          },
          clientSyncVersion: 1
        });
        enqueued += 1;
      }
    }
    if (isSyncEntityEnabled("app_settings", prefs)) {
      if (forceRepush || !outbox.hasPendingOrPushed("app_settings", APP_SETTINGS_ENTITY_ID)) {
        if (forceRepush) {
          outbox.discardPendingOrPushed("app_settings", APP_SETTINGS_ENTITY_ID);
        }
        const ui = readUiPreferencesSnapshot(dataDir);
        enqueueAppSettingsUpsert(
          outbox,
          new WidgetNoteRepository(db),
          Object.keys(ui).length ? ui : void 0
        );
        enqueued += 1;
      }
    }
  });
  return enqueued;
}
function scalarCount(db, sql) {
  const row = db.prepare(sql).get();
  return row?.cnt ?? 0;
}
function hasLocalSyncableData(db) {
  const tasks = scalarCount(db, `SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL`);
  if (tasks > 0) return true;
  const categories = scalarCount(db, `SELECT COUNT(*) as cnt FROM categories WHERE deleted_at IS NULL`);
  if (categories > 0) return true;
  const notes = scalarCount(db, `SELECT COUNT(*) as cnt FROM widget_notes`);
  return notes > 0;
}
function getLocalSyncDataSummary(db) {
  return {
    taskCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM tasks WHERE deleted_at IS NULL`),
    categoryCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM categories WHERE deleted_at IS NULL`),
    noteCount: scalarCount(db, `SELECT COUNT(*) as cnt FROM widget_notes`)
  };
}
function shouldPromptLocalDataPolicy(db, previousUserId, newUserId) {
  if (!hasLocalSyncableData(db)) {
    return false;
  }
  if (previousUserId != null && previousUserId === newUserId) {
    return false;
  }
  return true;
}
function clearLocalSyncData(db) {
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM task_tags`).run();
    db.prepare(`DELETE FROM task_reminders`).run();
    db.prepare(`DELETE FROM task_activities`).run();
    db.prepare(`DELETE FROM tasks`).run();
    db.prepare(`DELETE FROM tags`).run();
    db.prepare(`DELETE FROM kanban_groups`).run();
    db.prepare(`DELETE FROM categories`).run();
    db.prepare(`DELETE FROM task_views`).run();
    db.prepare(`DELETE FROM scheduled_summaries`).run();
    db.prepare(`DELETE FROM app_messages`).run();
    db.prepare(`DELETE FROM widget_notes`).run();
    db.prepare(`DELETE FROM local_changes`).run();
    db.prepare(`DELETE FROM sync_conflicts`).run();
    db.prepare(
      `UPDATE sync_state SET
        last_pulled_cursor = NULL,
        last_pushed_at = NULL,
        last_sync_at = NULL,
        last_error = NULL
       WHERE id = 'default'`
    ).run();
  });
  run();
}
const NOTIFY_EVENTS = ["task_reminder", "scheduled_summary"];
const ACTIVE_NOTIFY_CHANNELS = ["iyuu", "webhook"];
const DEFAULT_NOTIFICATION_CONFIG = {
  systemTrayEnabled: true,
  activeChannel: "iyuu",
  relayWhenOnline: true,
  relayWhenOffline: true,
  quietHours: {
    enabled: false,
    start: "23:00",
    end: "08:00"
  },
  iyuu: {
    token: "",
    events: [...NOTIFY_EVENTS]
  },
  webhook: {
    name: "Webhook",
    url: "",
    events: [...NOTIFY_EVENTS]
  },
  lease: {
    heartbeatIntervalMs: 3e4,
    leaseTtlMs: 9e4
  }
};
function isNotifyEvent(value) {
  return typeof value === "string" && NOTIFY_EVENTS.includes(value);
}
function normalizeEvents(raw) {
  if (!Array.isArray(raw)) return [...NOTIFY_EVENTS];
  const events = raw.filter(isNotifyEvent);
  return events.length ? events : [...NOTIFY_EVENTS];
}
function normalizeHm(raw, fallback) {
  if (typeof raw !== "string") return fallback;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return fallback;
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function normalizeHeaders(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const headers = Object.fromEntries(
    Object.entries(raw).filter(
      (e) => typeof e[0] === "string" && typeof e[1] === "string"
    )
  );
  return Object.keys(headers).length ? headers : void 0;
}
function normalizeWebhookSingle(raw) {
  const base = DEFAULT_NOTIFICATION_CONFIG.webhook;
  if (!raw || typeof raw !== "object") return { ...base, events: [...base.events] };
  const w = raw;
  const headers = normalizeHeaders(w.headers);
  return {
    name: typeof w.name === "string" && w.name.trim() ? w.name.trim() : base.name,
    url: typeof w.url === "string" ? w.url.trim() : "",
    ...headers ? { headers } : {},
    events: normalizeEvents(w.events)
  };
}
function migrateFromLegacy(raw) {
  const iyuu = raw.iyuu && typeof raw.iyuu === "object" ? raw.iyuu : null;
  const iyuuEnabled = Boolean(iyuu?.enabled);
  let webhook = normalizeWebhookSingle(raw.webhook);
  let anyWebhookEnabled = Boolean(webhook.url);
  if (Array.isArray(raw.webhooks) && raw.webhooks.length) {
    const first = raw.webhooks[0];
    if (first && typeof first === "object") {
      const w = first;
      webhook = normalizeWebhookSingle({
        name: w.name,
        url: w.url,
        headers: w.headers,
        events: w.events
      });
      anyWebhookEnabled = Boolean(w.enabled) && Boolean(webhook.url);
    }
  }
  let activeChannel = "iyuu";
  if (typeof raw.activeChannel === "string" && ACTIVE_NOTIFY_CHANNELS.includes(raw.activeChannel)) {
    activeChannel = raw.activeChannel;
  } else if (anyWebhookEnabled && !iyuuEnabled) {
    activeChannel = "webhook";
  } else {
    activeChannel = "iyuu";
  }
  return { activeChannel, webhook };
}
function mergeNotificationConfig(partial) {
  const base = structuredClone(DEFAULT_NOTIFICATION_CONFIG);
  if (!partial || typeof partial !== "object") return base;
  const raw = partial;
  const migrated = migrateFromLegacy(raw);
  const iyuuPartial = raw.iyuu && typeof raw.iyuu === "object" ? raw.iyuu : null;
  const leasePartial = raw.lease && typeof raw.lease === "object" ? raw.lease : null;
  const quietPartial = raw.quietHours && typeof raw.quietHours === "object" ? raw.quietHours : null;
  const activeChannel = typeof raw.activeChannel === "string" && ACTIVE_NOTIFY_CHANNELS.includes(raw.activeChannel) ? raw.activeChannel : migrated.activeChannel;
  return {
    systemTrayEnabled: typeof raw.systemTrayEnabled === "boolean" ? raw.systemTrayEnabled : base.systemTrayEnabled,
    activeChannel,
    relayWhenOnline: typeof raw.relayWhenOnline === "boolean" ? raw.relayWhenOnline : base.relayWhenOnline,
    relayWhenOffline: typeof raw.relayWhenOffline === "boolean" ? raw.relayWhenOffline : base.relayWhenOffline,
    quietHours: {
      enabled: typeof quietPartial?.enabled === "boolean" ? quietPartial.enabled : base.quietHours.enabled,
      start: normalizeHm(quietPartial?.start, base.quietHours.start),
      end: normalizeHm(quietPartial?.end, base.quietHours.end)
    },
    iyuu: {
      token: typeof iyuuPartial?.token === "string" ? iyuuPartial.token : base.iyuu.token,
      events: iyuuPartial?.events !== void 0 ? normalizeEvents(iyuuPartial.events) : base.iyuu.events
    },
    webhook: migrated.webhook,
    lease: {
      heartbeatIntervalMs: typeof leasePartial?.heartbeatIntervalMs === "number" && leasePartial.heartbeatIntervalMs > 0 ? leasePartial.heartbeatIntervalMs : base.lease.heartbeatIntervalMs,
      leaseTtlMs: typeof leasePartial?.leaseTtlMs === "number" && leasePartial.leaseTtlMs > 0 ? leasePartial.leaseTtlMs : base.lease.leaseTtlMs
    }
  };
}
function applyServerChannelConfig(local, server) {
  const remote = mergeNotificationConfig(server);
  return mergeNotificationConfig({
    ...local,
    activeChannel: remote.activeChannel,
    relayWhenOnline: remote.relayWhenOnline,
    relayWhenOffline: remote.relayWhenOffline,
    quietHours: remote.quietHours,
    iyuu: remote.iyuu,
    webhook: remote.webhook
  });
}
function activeChannelReady(cfg, event) {
  if (cfg.activeChannel === "iyuu") {
    return {
      channel: "iyuu",
      ok: cfg.iyuu.events.includes(event) && Boolean(cfg.iyuu.token.trim())
    };
  }
  return {
    channel: "webhook",
    ok: cfg.webhook.events.includes(event) && Boolean(cfg.webhook.url.trim())
  };
}
function buildTaskReminderExternalCopy(task) {
  const title = task.title.trim() || "任务提醒";
  const desc = task.description?.trim();
  return { title, body: desc ? `${title}
${desc}` : title };
}
const CONFIG_FILE = "notification-config.json";
const LOCAL_LOG_FILE = "notification-delivery-local.json";
const LOCAL_LOG_MAX = 50;
function readNotificationConfig(dataDir) {
  const path2 = node_path.join(dataDir, CONFIG_FILE);
  if (!node_fs.existsSync(path2)) return mergeNotificationConfig();
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    return mergeNotificationConfig(raw);
  } catch {
    return mergeNotificationConfig();
  }
}
function writeNotificationConfig(dataDir, config) {
  const merged = mergeNotificationConfig(config);
  node_fs.mkdirSync(dataDir, { recursive: true });
  node_fs.writeFileSync(node_path.join(dataDir, CONFIG_FILE), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
function readLocalDeliveryLog(dataDir) {
  const path2 = node_path.join(dataDir, LOCAL_LOG_FILE);
  if (!node_fs.existsSync(path2)) return [];
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function appendLocalDeliveryLog(dataDir, record) {
  const prev = readLocalDeliveryLog(dataDir);
  const next = [record, ...prev].slice(0, LOCAL_LOG_MAX);
  node_fs.mkdirSync(dataDir, { recursive: true });
  node_fs.writeFileSync(node_path.join(dataDir, LOCAL_LOG_FILE), JSON.stringify(next, null, 2), "utf8");
  return next;
}
const notificationConfigStore = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  appendLocalDeliveryLog,
  readLocalDeliveryLog,
  readNotificationConfig,
  writeNotificationConfig
}, Symbol.toStringTag, { value: "Module" }));
class NotifyApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "NotifyApiError";
  }
}
class NotifyApiClient {
  constructor(baseUrl, accessToken = null) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }
  setBaseUrl(url2) {
    this.baseUrl = url2.replace(/\/+$/, "");
  }
  setAccessToken(token) {
    this.accessToken = token;
  }
  async putConfig(config) {
    await this.request("PUT", "/api/notify/config", {
      activeChannel: config.activeChannel,
      relayWhenOnline: config.relayWhenOnline,
      relayWhenOffline: config.relayWhenOffline,
      quietHours: config.quietHours,
      iyuu: {
        token: config.iyuu.token,
        events: config.iyuu.events
      },
      webhook: {
        name: config.webhook.name,
        url: config.webhook.url,
        headers: config.webhook.headers,
        events: config.webhook.events
      }
    });
  }
  async getConfig() {
    return this.request("GET", "/api/notify/config");
  }
  async dispatch(payload, idempotencyKey) {
    await this.request("POST", "/api/notify/dispatch", {
      idempotencyKey,
      event: payload.event,
      entityId: payload.entityId,
      title: payload.title,
      body: payload.body,
      firedAt: payload.firedAt,
      origin: "relay"
    });
  }
  async heartbeat(deviceId, leaseTtlMs) {
    await this.request("POST", "/api/notify/lease/heartbeat", { deviceId, leaseTtlMs });
  }
  async releaseLease(deviceId) {
    await this.request("POST", "/api/notify/lease/release", { deviceId });
  }
  async listDeliveries(limit = 50) {
    const rows = await this.request("GET", `/api/notify/deliveries?limit=${limit}`);
    return rows.map((r) => ({
      id: r.id,
      at: r.createdAt ?? "",
      event: r.event,
      channel: r.channel,
      ok: r.ok,
      message: r.message
    }));
  }
  async listUnacked() {
    return this.request("GET", "/api/notify/deliveries/unacked?limit=50");
  }
  async listPending(limit = 50) {
    const rows = await this.request("GET", `/api/notify/pending?limit=${limit}`);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      event: r.event,
      entityId: r.entityId,
      title: r.title,
      bodyPreview: r.bodyPreview,
      fireAt: r.fireAt,
      deferredTo: r.deferredTo ?? null,
      source: r.source === "local" ? "local" : "server"
    }));
  }
  async ack(ids) {
    await this.request("POST", "/api/notify/deliveries/ack", { ids });
  }
  async request(method, path2, body) {
    if (!this.accessToken) {
      throw new NotifyApiError("未登录", 401);
    }
    const url2 = `${this.baseUrl.replace(/\/+$/, "")}${path2}`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${this.accessToken}`
    };
    if (body !== void 0) {
      headers["Content-Type"] = "application/json";
    }
    let res;
    try {
      res = await fetch(url2, {
        method,
        headers,
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: AbortSignal.timeout(3e4)
      });
    } catch (err) {
      throw new NotifyApiError(
        err instanceof Error ? `网络错误：${err.message}` : "网络错误",
        500
      );
    }
    let envelope;
    try {
      envelope = await res.json();
    } catch {
      throw new NotifyApiError(`无效响应 HTTP ${res.status}`, res.status);
    }
    if (envelope.code !== 0) {
      throw new NotifyApiError(readApiEnvelopeError(envelope), envelope.code);
    }
    return envelope.data;
  }
}
class NotifyLeaseHeartbeat {
  constructor(getClient, getDeviceId, getLeaseTtlMs, getIntervalMs) {
    this.getClient = getClient;
    this.getDeviceId = getDeviceId;
    this.getLeaseTtlMs = getLeaseTtlMs;
    this.getIntervalMs = getIntervalMs;
  }
  timer = null;
  start() {
    this.stop();
    void this.beat();
    this.timer = setInterval(() => {
      void this.beat();
    }, this.getIntervalMs());
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  /**
   * 退出登录 / 关断 notify runtime 时主动释放租约，
   * 让服务端更快进入「可离线代发」状态（失败忽略，避免挡 logout）。
   */
  async release() {
    this.stop();
    const client = this.getClient();
    if (!client) return;
    try {
      await client.releaseLease(this.getDeviceId());
    } catch {
    }
  }
  async beat() {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.heartbeat(this.getDeviceId(), this.getLeaseTtlMs());
    } catch (err) {
      console.warn("[notify-lease] heartbeat failed", err);
    }
  }
}
function parseHm(hm) {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function inQuietHours(now, quiet) {
  if (!quiet.enabled) return false;
  const s = parseHm(quiet.start);
  const e = parseHm(quiet.end);
  if (!s || !e) return false;
  const startM = s.hour * 60 + s.minute;
  const endM = e.hour * 60 + e.minute;
  const nowM = minutesOfDay(now);
  if (startM === endM) return true;
  if (startM < endM) {
    return nowM >= startM && nowM < endM;
  }
  return nowM >= startM || nowM < endM;
}
function quietEnd(now, quiet) {
  if (!inQuietHours(now, quiet)) return null;
  const e = parseHm(quiet.end);
  if (!e) return null;
  const end = new Date(now);
  end.setSeconds(0, 0);
  end.setHours(e.hour, e.minute, 0, 0);
  const s = parseHm(quiet.start);
  if (!s) return end;
  const startM = s.hour * 60 + s.minute;
  const endM = e.hour * 60 + e.minute;
  const nowM = minutesOfDay(now);
  if (startM > endM && nowM >= startM) {
    end.setDate(end.getDate() + 1);
  }
  return end;
}
const APP_NOTIFICATION_ID = "com.aitodo.desktop";
function registerNotificationSupport() {
  if (process.platform === "win32") {
    electron.app.setAppUserModelId(APP_NOTIFICATION_ID);
  }
}
function notificationIcon() {
  const candidates = [
    path.join(process.resourcesPath, "tray.png"),
    path.join(electron.app.getAppPath(), "resources", "tray.png"),
    path.join(__dirname, "../../resources/tray.png")
  ];
  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) continue;
    const image = electron.nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) return image;
  }
  return void 0;
}
function flashMainWindow() {
  const win = electron.BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  win?.flashFrame(true);
}
function showWithElectron(title, body) {
  if (!electron.Notification.isSupported()) {
    console.warn("[system-notification] Notification API not supported");
    return false;
  }
  try {
    const notification = new electron.Notification({
      title,
      body,
      icon: notificationIcon(),
      silent: false
    });
    notification.on("failed", (_event, error) => {
      console.error("[system-notification] Electron notification failed:", error);
    });
    notification.show();
    return true;
  } catch (err) {
    console.error("[system-notification] Electron show failed", err);
    return false;
  }
}
function showWithNodeNotifier(title, body) {
  try {
    const notifier = require("node-notifier");
    notifier.notify({
      title,
      message: body,
      appID: APP_NOTIFICATION_ID,
      wait: false
    });
  } catch (err) {
    console.error("[system-notification] node-notifier failed, fallback to Electron", err);
    showWithElectron(title, body);
  }
}
function showSystemNotification(title, body) {
  const message = (body || title).trim().slice(0, 240);
  const heading = title.trim() || "小柒todo";
  if (process.platform === "win32") {
    showWithNodeNotifier(heading, message);
    flashMainWindow();
    return;
  }
  if (!showWithElectron(heading, message)) {
    flashMainWindow();
  }
}
const DEFERRED_FILE = "notification-deferred.json";
function readDeferredNotifies(dataDir) {
  const path2 = node_path.join(dataDir, DEFERRED_FILE);
  if (!node_fs.existsSync(path2)) return [];
  try {
    const raw = JSON.parse(node_fs.readFileSync(path2, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function writeDeferredNotifies(dataDir, items) {
  node_fs.mkdirSync(dataDir, { recursive: true });
  node_fs.writeFileSync(node_path.join(dataDir, DEFERRED_FILE), JSON.stringify(items, null, 2), "utf8");
}
function upsertDeferredNotify(dataDir, item) {
  const prev = readDeferredNotifies(dataDir);
  const key = `${item.event}|${item.entityId}|${item.fireAt}`;
  const next = prev.filter((x) => `${x.event}|${x.entityId}|${x.fireAt}` !== key);
  next.push(item);
  writeDeferredNotifies(dataDir, next);
}
function removeDeferredNotify(dataDir, event, entityId, fireAt) {
  const key = `${event}|${entityId}|${fireAt}`;
  writeDeferredNotifies(
    dataDir,
    readDeferredNotifies(dataDir).filter((x) => `${x.event}|${x.entityId}|${x.fireAt}` !== key)
  );
}
const notificationDeferredStore = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  readDeferredNotifies,
  removeDeferredNotify,
  upsertDeferredNotify,
  writeDeferredNotifies
}, Symbol.toStringTag, { value: "Module" }));
async function sendIyuu(token, payload, fetchImpl = fetch) {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, message: "IYUU 令牌为空" };
  }
  const url2 = `https://iyuu.cn/${encodeURIComponent(trimmed)}.send`;
  const body = new URLSearchParams({
    text: payload.title,
    desp: payload.body
  });
  try {
    const res = await fetchImpl(url2, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body,
      signal: AbortSignal.timeout(15e3)
    });
    const text = await res.text();
    let errcode;
    let errmsg = text;
    try {
      const json = JSON.parse(text);
      errcode = json.errcode;
      if (json.errmsg) errmsg = json.errmsg;
    } catch {
    }
    if (!res.ok || errcode !== void 0 && errcode !== 0) {
      return { ok: false, message: errmsg || `HTTP ${res.status}` };
    }
    return { ok: true, message: "ok" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "IYUU 发送失败"
    };
  }
}
async function sendWebhook(url2, headers, payload, fetchImpl = fetch) {
  const target = url2.trim();
  if (!target) {
    return { ok: false, message: "Webhook URL 为空" };
  }
  try {
    const res = await fetchImpl(target, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers ?? {}
      },
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        event: payload.event,
        entityId: payload.entityId,
        firedAt: payload.firedAt
      }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, message: text || `HTTP ${res.status}` };
    }
    return { ok: true, message: "ok" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Webhook 发送失败"
    };
  }
}
class NotificationDispatcher {
  constructor(deps) {
    this.deps = deps;
  }
  getConfig() {
    return readNotificationConfig(this.deps.getDataDir());
  }
  async dispatch(input) {
    const cfg = this.getConfig();
    const fireAt = input.fireAt?.trim() || nowIso();
    const payload = {
      title: input.title.trim() || "小柒todo",
      body: (input.body || input.title).trim(),
      event: input.event,
      entityId: input.entityId,
      firedAt: fireAt
    };
    if (!input.skipTray && cfg.systemTrayEnabled) {
      const show = this.deps.showTray ?? showSystemNotification;
      show(payload.title, payload.body.slice(0, 240));
    }
    if (input.skipExternal) return [];
    const records = [];
    const loggedIn = this.deps.isLoggedIn?.() ?? false;
    const now = this.deps.now?.() ?? /* @__PURE__ */ new Date();
    if (loggedIn && !cfg.relayWhenOnline) {
      return records;
    }
    if (inQuietHours(now, cfg.quietHours)) {
      const end = quietEnd(now, cfg.quietHours);
      if (end) {
        upsertDeferredNotify(this.deps.getDataDir(), {
          id: uuid.v4(),
          event: input.event,
          entityId: input.entityId,
          title: payload.title,
          body: payload.body,
          fireAt,
          deferredTo: end.toISOString()
        });
      }
      return records;
    }
    if (this.deps.relayIfLoggedIn && loggedIn) {
      try {
        const handled = await this.deps.relayIfLoggedIn(payload);
        if (handled) {
          return records;
        }
      } catch (err) {
        console.error("[notify] relay failed, fallback to local", err);
      }
    }
    const ready = activeChannelReady(cfg, input.event);
    if (!ready.ok) return records;
    if (ready.channel === "iyuu") {
      const result = await sendIyuu(cfg.iyuu.token, payload, this.deps.fetchImpl);
      records.push(this.log("IYUU", input.event, result.ok, result.message));
    } else {
      const result = await sendWebhook(
        cfg.webhook.url,
        cfg.webhook.headers,
        payload,
        this.deps.fetchImpl
      );
      records.push(this.log(cfg.webhook.name || "Webhook", input.event, result.ok, result.message));
    }
    return records;
  }
  async testIyuu(token) {
    const cfg = this.getConfig();
    const payload = {
      title: "小柒todo 测试",
      body: "这是一条 IYUU 测试通知",
      firedAt: nowIso()
    };
    return sendIyuu(token ?? cfg.iyuu.token, payload, this.deps.fetchImpl);
  }
  async testWebhook(url2, headers) {
    const cfg = this.getConfig();
    const payload = {
      title: "小柒todo 测试",
      body: "这是一条 Webhook 测试通知",
      event: "task_reminder",
      entityId: "test",
      firedAt: nowIso()
    };
    return sendWebhook(
      url2 ?? cfg.webhook.url,
      headers ?? cfg.webhook.headers,
      payload,
      this.deps.fetchImpl
    );
  }
  log(channel, event, ok, message) {
    const record = {
      id: uuid.v4(),
      at: nowIso(),
      event,
      channel,
      ok,
      message
    };
    try {
      appendLocalDeliveryLog(this.deps.getDataDir(), record);
    } catch (err) {
      console.error("[notify] append local log failed", err);
    }
    return record;
  }
}
let dispatcherSingleton = null;
function getNotificationDispatcher(deps) {
  if (!dispatcherSingleton) {
    dispatcherSingleton = new NotificationDispatcher(deps);
  }
  return dispatcherSingleton;
}
class NotifyRuntime {
  constructor(getDb, getDataDir) {
    this.getDb = getDb;
    this.getDataDir = getDataDir;
  }
  client = null;
  heartbeat = null;
  onInAppPush = null;
  deferredTimer = null;
  /** 由 index 注入，避免与 handlers 循环依赖 */
  setOnInAppPush(fn) {
    this.onInAppPush = fn;
  }
  /** 启动本机免打扰延后冲刷（登录与否都需要） */
  ensureDeferredFlush() {
    if (this.deferredTimer) return;
    void this.flushDeferred().catch(() => void 0);
    this.deferredTimer = setInterval(() => {
      void this.flushDeferred().catch((err) => console.warn("[notify] flush deferred", err));
    }, 6e4);
  }
  dispatcher() {
    return getNotificationDispatcher({
      getDataDir: this.getDataDir,
      isLoggedIn: () => Boolean(readSyncCredentials(this.getDataDir())?.accessToken),
      relayIfLoggedIn: (payload) => this.relayIfLoggedIn(payload)
    });
  }
  /** 登录成功或启动已登录时调用 */
  onLoggedIn() {
    const creds = readSyncCredentials(this.getDataDir());
    const state = ensureSyncState(this.getDb());
    if (!creds?.accessToken || !state.serverBaseUrl) {
      this.onLoggedOut();
      return;
    }
    this.client = new NotifyApiClient(state.serverBaseUrl, creds.accessToken);
    void this.pullConfigFromServer().catch(
      (err) => console.warn("[notify] pull config failed", err)
    );
    this.heartbeat = new NotifyLeaseHeartbeat(
      () => this.client,
      () => ensureSyncState(this.getDb()).deviceId,
      () => readNotificationConfig(this.getDataDir()).lease.leaseTtlMs,
      () => readNotificationConfig(this.getDataDir()).lease.heartbeatIntervalMs
    );
    this.heartbeat.start();
    void this.backfillUnacked().catch(
      (err) => console.warn("[notify] backfill unacked failed", err)
    );
  }
  /**
   * 拉取关端调度成功但未确认的投递，补写站内消息（不弹托盘、不重外发），再 ack。
   */
  async backfillUnacked() {
    if (!this.client || !this.onInAppPush) return;
    const rows = await this.client.listUnacked();
    if (!rows.length) return;
    const groups = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = `${row.event}|${row.entityId}|${row.title}|${row.body}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }
    const db = this.getDb();
    const messages = new AppMessageService(
      new AppMessageRepository(db),
      new SyncOutbox(db),
      () => readSyncPreferences(this.getDataDir())
    );
    const ackIds = [];
    for (const group of groups.values()) {
      const sample = group[0];
      const source = sample.event === "task_reminder" ? "task_reminder" : sample.event === "scheduled_summary" ? "scheduled_summary" : null;
      const msg = messages.create({
        kind: "notification",
        title: sample.title || "通知",
        body: sample.body || null,
        taskId: sample.event === "task_reminder" ? sample.entityId || null : null,
        source
      });
      this.onInAppPush(msg, { skipExternalNotify: true });
      for (const r of group) ackIds.push(r.id);
    }
    if (ackIds.length) {
      await this.client.ack(ackIds);
    }
  }
  onLoggedOut() {
    void this.heartbeat?.release();
    this.heartbeat = null;
    this.client = null;
  }
  async saveConfig(config) {
    const saved = writeNotificationConfig(this.getDataDir(), mergeNotificationConfig(config));
    if (this.client) {
      try {
        await this.client.putConfig(saved);
      } catch (err) {
        console.warn("[notify] push config failed", err);
      }
    }
    return saved;
  }
  async listDeliveries() {
    if (this.client) {
      try {
        return await this.client.listDeliveries(50);
      } catch {
      }
    }
    const { readLocalDeliveryLog: readLocalDeliveryLog2 } = await Promise.resolve().then(() => notificationConfigStore);
    return readLocalDeliveryLog2(this.getDataDir());
  }
  async listPending() {
    const { listLocalPending, mergePendingLists } = await Promise.resolve().then(() => require("./notify-pending-DcnGfdKc.js"));
    const local = listLocalPending(this.getDb(), this.getDataDir());
    if (!this.client) return local;
    try {
      const server = await this.client.listPending(50);
      return mergePendingLists(local, server);
    } catch {
      return local;
    }
  }
  /** 到点冲刷本机免打扰延后队列 */
  async flushDeferred() {
    const { readDeferredNotifies: readDeferredNotifies2, removeDeferredNotify: removeDeferredNotify2 } = await Promise.resolve().then(() => notificationDeferredStore);
    const now = Date.now();
    for (const item of readDeferredNotifies2(this.getDataDir())) {
      if (new Date(item.deferredTo).getTime() > now) continue;
      await this.dispatcher().dispatch({
        event: item.event,
        title: item.title,
        body: item.body,
        entityId: item.entityId,
        fireAt: item.fireAt,
        skipTray: true
      });
      removeDeferredNotify2(this.getDataDir(), item.event, item.entityId, item.fireAt);
    }
  }
  /** 从服务端拉取渠道配置写入本机（不上传） */
  async pullConfigFromServer() {
    if (!this.client) return;
    const remote = await this.client.getConfig();
    const local = readNotificationConfig(this.getDataDir());
    writeNotificationConfig(this.getDataDir(), applyServerChannelConfig(local, remote));
  }
  async relayIfLoggedIn(payload) {
    const creds = readSyncCredentials(this.getDataDir());
    if (!creds?.accessToken || !this.client) {
      const state = ensureSyncState(this.getDb());
      if (!creds?.accessToken || !state.serverBaseUrl) return false;
      this.client = new NotifyApiClient(state.serverBaseUrl, creds.accessToken);
    }
    const key = `${payload.event}#${payload.entityId}#${payload.firedAt}`;
    await this.client.dispatch(payload, key);
    return true;
  }
}
let runtime = null;
function getNotifyRuntime(getDb, getDataDir) {
  if (!runtime) {
    runtime = new NotifyRuntime(getDb, getDataDir);
  }
  return runtime;
}
const DEFAULT_SERVER_URL = DEFAULT_SYNC_SERVER_URL;
class SyncEngine {
  constructor(getDb, getDataDir) {
    this.getDb = getDb;
    this.getDataDir = getDataDir;
    this.client = new SyncApiClient(DEFAULT_SERVER_URL, null);
  }
  client;
  timer = null;
  running = false;
  /** 登录/启动后做一次从 0 的对账；日常同步走增量，避免占死主进程导致回车添加卡住 */
  needsFullReconcile = false;
  /**
   * 本机 userId 为空或与当前登录不一致时：强制把本地实体重新入队并 Push，
   * 再全量 Pull，使本地与当前账号云端对齐。
   */
  needsForceLocalPush = false;
  /** 验票成功、待用户选择本机数据策略时暂存 */
  pendingLogin = null;
  /** 应用启动：已登录则恢复 token 并开启定时同步 */
  start() {
    const db = this.getDb();
    const state = ensureSyncState(db);
    if (state.serverBaseUrl) {
      this.client.setBaseUrl(state.serverBaseUrl);
    }
    const creds = readSyncCredentials(this.getDataDir());
    if (creds) {
      this.client.setAccessToken(creds.accessToken);
      this.needsFullReconcile = true;
      this.ensureTimer();
      getNotifyRuntime(this.getDb, this.getDataDir).onLoggedIn();
      void this.trigger().catch(() => void 0);
    }
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  getPreferences() {
    return readSyncPreferences(this.getDataDir());
  }
  ensureTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const interval = this.getPreferences().syncIntervalMs;
    this.timer = setInterval(() => {
      void this.trigger().catch(() => void 0);
    }, interval);
  }
  /** 登录态下重置定时器（改频率后调用） */
  refreshTimerIfLoggedIn() {
    const creds = readSyncCredentials(this.getDataDir());
    if (!creds) return;
    this.ensureTimer();
  }
  getStatus() {
    const db = this.getDb();
    const state = ensureSyncState(db);
    const creds = readSyncCredentials(this.getDataDir());
    const outbox = new SyncOutbox(db);
    return {
      loggedIn: Boolean(creds?.accessToken),
      username: creds?.username ?? null,
      serverBaseUrl: state.serverBaseUrl || this.client.getBaseUrl(),
      deviceId: state.deviceId,
      lastPulledCursor: state.lastPulledCursor,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      pendingCount: outbox.countPending(),
      preferences: this.getPreferences()
    };
  }
  setPreferences(partial) {
    const next = writeSyncPreferences(
      this.getDataDir(),
      mergeSyncPreferences({ ...this.getPreferences(), ...partial })
    );
    this.refreshTimerIfLoggedIn();
    return next;
  }
  reportUiPreferences(prefs) {
    writeUiPreferencesSnapshot(this.getDataDir(), prefs);
    this.enqueueLocalAppSettings();
  }
  /** 本机配置变更后入队 app_settings（已登录且开启配置同步时） */
  enqueueLocalAppSettings() {
    const prefs = this.getPreferences();
    if (!isSyncEntityEnabled("app_settings", prefs)) return;
    const creds = readSyncCredentials(this.getDataDir());
    if (!creds) return;
    const db = this.getDb();
    const outbox = new SyncOutbox(db);
    const ui = readUiPreferencesSnapshot(this.getDataDir());
    enqueueAppSettingsUpsert(
      outbox,
      new WidgetNoteRepository(db),
      Object.keys(ui).length ? ui : void 0
    );
  }
  setServerUrl(url2) {
    const trimmed = url2.trim().replace(/\/+$/, "");
    if (!trimmed) {
      throw new Error("服务器地址不能为空");
    }
    this.client.setBaseUrl(trimmed);
    updateSyncState(this.getDb(), { serverBaseUrl: trimmed });
    return trimmed;
  }
  async testServerUrl(url2) {
    const target = (url2 ?? this.getStatus().serverBaseUrl).trim().replace(/\/+$/, "");
    if (!target) {
      return { ok: false, message: "请先填写服务器地址" };
    }
    try {
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json"
      };
      const basic = buildObfuscatedBasicAuthorization();
      if (basic) {
        headers.Authorization = basic;
      }
      const res = await fetch(`${target}/login`, {
        method: "POST",
        headers,
        body: JSON.stringify({ username: "", password: "" }),
        signal: AbortSignal.timeout(8e3)
      });
      await res.text().catch(() => void 0);
      return { ok: true, message: `连接成功（HTTP ${res.status}）` };
    } catch (err) {
      const message = err instanceof Error && err.name === "TimeoutError" ? "连接超时" : err instanceof Error ? `无法连接：${err.message}` : "无法连接";
      return { ok: false, message };
    }
  }
  async login(dto) {
    const state = ensureSyncState(this.getDb());
    if (state.serverBaseUrl) {
      this.client.setBaseUrl(state.serverBaseUrl);
    }
    const result = await this.client.login(dto);
    return this.beginLoginOrPrompt(result);
  }
  /** 自注册成功后与 login 相同：持久化凭证并触发首次同步。 */
  async register(dto) {
    const state = ensureSyncState(this.getDb());
    if (state.serverBaseUrl) {
      this.client.setBaseUrl(state.serverBaseUrl);
    }
    const result = await this.client.register(dto);
    return this.beginLoginOrPrompt(result);
  }
  /**
   * 用户在本机数据策略弹窗中选择后，完成或取消登录。
   */
  async completeLogin(request) {
    const pending = this.pendingLogin;
    this.pendingLogin = null;
    if (!pending) {
      throw new SyncApiError("无待完成的登录，请重新登录", 400);
    }
    if (request.policy === "cancel") {
      this.client.setAccessToken(null);
      return { kind: "cancelled" };
    }
    if (request.policy === "clear") {
      clearLocalSyncData(this.getDb());
    }
    const data = await this.finalizeLogin(pending);
    return { kind: "completed", data };
  }
  /** 验票成功后：本机有未归属数据则挂起，否则直接 finalize。 */
  async beginLoginOrPrompt(result) {
    const db = this.getDb();
    const state = ensureSyncState(db);
    if (shouldPromptLocalDataPolicy(db, state.userId, result.userId)) {
      this.pendingLogin = result;
      return {
        kind: "needs_data_policy",
        summary: getLocalSyncDataSummary(db),
        username: result.username
      };
    }
    const data = await this.finalizeLogin(result);
    return { kind: "completed", data };
  }
  async finalizeLogin(result) {
    const db = this.getDb();
    const previousUserId = ensureSyncState(db).userId;
    const ownershipChanged = previousUserId == null || previousUserId === "" || previousUserId !== result.userId;
    this.client.setAccessToken(result.accessToken);
    writeSyncCredentials(this.getDataDir(), {
      accessToken: result.accessToken,
      userId: result.userId,
      username: result.username,
      savedAt: nowIso()
    });
    updateSyncState(db, {
      userId: result.userId,
      lastError: null,
      ...ownershipChanged ? { lastPulledCursor: null } : {}
    });
    this.needsFullReconcile = true;
    this.needsForceLocalPush = true;
    this.ensureTimer();
    getNotifyRuntime(this.getDb, this.getDataDir).onLoggedIn();
    try {
      await this.trigger();
    } catch {
    }
    this.broadcastAuthCompleted();
    return result;
  }
  /** 通知各窗口刷新任务/分类等（清空或合并后列表需重载） */
  broadcastAuthCompleted() {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.SYNC_AUTH_COMPLETED);
    }
  }
  logout() {
    this.pendingLogin = null;
    getNotifyRuntime(this.getDb, this.getDataDir).onLoggedOut();
    this.stop();
    clearSyncCredentials(this.getDataDir());
    this.client.setAccessToken(null);
    updateSyncState(this.getDb(), {
      lastError: null
    });
  }
  async trigger(opts) {
    if (this.running) {
      return this.getStatus();
    }
    const creds = readSyncCredentials(this.getDataDir());
    if (!creds) {
      return this.getStatus();
    }
    this.running = true;
    const db = this.getDb();
    const prefs = this.getPreferences();
    try {
      this.client.setAccessToken(creds.accessToken);
      const state = ensureSyncState(db);
      if (state.serverBaseUrl) {
        this.client.setBaseUrl(state.serverBaseUrl);
      }
      const forceRepush = this.needsForceLocalPush;
      enqueueMissingLocalEntities(db, prefs, this.getDataDir(), { forceRepush });
      this.needsForceLocalPush = false;
      await this.pushPending(db, state.deviceId, prefs);
      const doFull = this.needsFullReconcile || Boolean(opts?.fullReconcile) || forceRepush;
      if (doFull) {
        await this.pullChanges(db, state.deviceId, "0", prefs);
        this.needsFullReconcile = false;
      } else {
        const cursor = ensureSyncState(db).lastPulledCursor || "0";
        await this.pullChanges(db, state.deviceId, cursor, prefs);
      }
      updateSyncState(db, {
        lastSyncAt: nowIso(),
        lastError: null
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateSyncState(db, { lastError: message });
      if (err instanceof SyncApiError && err.code === 401) {
        this.logout();
      }
    } finally {
      this.running = false;
    }
    return this.getStatus();
  }
  async pushPending(db, deviceId, prefs) {
    const outbox = new SyncOutbox(db);
    const enabledTypes = SYNC_ENTITY_TYPES.filter(
      (t) => isSyncEntityEnabled(t, prefs)
    );
    for (; ; ) {
      const pending = outbox.listPendingOfTypes(enabledTypes, 200);
      if (!pending.length) break;
      const result = await this.client.push({
        deviceId,
        changes: pending.map((row) => ({
          clientChangeId: row.id,
          entityType: row.entityType,
          entityId: row.entityId,
          operation: row.operation,
          payload: row.payload,
          clientUpdatedAt: String(row.payload.updatedAt ?? row.createdAt),
          clientSyncVersion: row.clientSyncVersion
        }))
      });
      outbox.markMany(result.accepted, "pushed");
      for (const rej of result.rejected) {
        outbox.markStatus(rej.clientChangeId, "rejected");
      }
      for (const conflict of result.conflicts) {
        outbox.markStatus(conflict.clientChangeId, "discarded");
        applyRemoteChange(
          db,
          {
            revision: conflict.serverRevision,
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            operation: "upsert",
            payload: conflict.serverPayload,
            serverUpdatedAt: conflict.serverUpdatedAt,
            originDeviceId: null
          },
          {
            deviceId,
            dataDir: this.getDataDir(),
            onUiPreferencesApplied: (p) => this.broadcastUiPreferences(p)
          }
        );
        db.prepare(
          `INSERT INTO sync_conflicts (
            id, entity_type, entity_id, local_payload_json, server_payload_json, resolved_at, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?)`
        ).run(
          uuid.v4(),
          conflict.entityType,
          conflict.entityId,
          JSON.stringify(conflict.serverPayload),
          nowIso(),
          nowIso()
        );
      }
      updateSyncState(db, { lastPushedAt: nowIso() });
      if (result.accepted.length + result.rejected.length + result.conflicts.length === 0) {
        break;
      }
    }
  }
  /**
   * 增量或全量 Pull：按条应用并定期让出主线程，避免长时间占死 IPC。
   * @param startCursor `"0"` 表示从最早重放；否则为上次 cursor
   */
  async pullChanges(db, deviceId, startCursor, prefs) {
    let cursor = startCursor;
    let appliedInPage = 0;
    for (; ; ) {
      const page = await this.client.pull(cursor, 200);
      const sorted = sortPullChanges(page.changes);
      for (const change of sorted) {
        if (!isSyncEntityEnabled(change.entityType, prefs)) {
          continue;
        }
        const localTask = change.entityType === "task" ? new TaskRepository(db).findByIdIncludingDeleted(change.entityId) : null;
        applyRemoteChange(db, change, {
          deviceId,
          localSyncVersion: localTask?.syncVersion,
          dataDir: this.getDataDir(),
          onUiPreferencesApplied: (p) => this.broadcastUiPreferences(p)
        });
        appliedInPage += 1;
        if (appliedInPage % 8 === 0) {
          await yieldToMain();
        }
      }
      cursor = page.nextCursor;
      updateSyncState(db, { lastPulledCursor: cursor });
      await yieldToMain();
      if (!page.hasMore) break;
    }
  }
  broadcastUiPreferences(prefs) {
    for (const win of electron.BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.SYNC_UI_PREFERENCES_APPLIED, prefs);
    }
  }
}
function yieldToMain() {
  return new Promise((resolve) => setImmediate(resolve));
}
let engineSingleton = null;
function getSyncEngine(getDb, getDataDir) {
  if (!engineSingleton) {
    engineSingleton = new SyncEngine(getDb, getDataDir);
  }
  return engineSingleton;
}
function notifyAppSettingsChanged() {
  engineSingleton?.enqueueLocalAppSettings();
}
const LAYOUTS = ["list", "kanban", "timeline", "quadrant"];
const GROUP_BY = ["custom", "time", "tag", "priority", "status", "none"];
const SORT_BY = [
  "custom",
  "time",
  "createdAt",
  "completedAt",
  "remindAt",
  "title",
  "tag",
  "priority"
];
class TaskViewService {
  constructor(repo, taskRepo, outbox) {
    this.repo = repo;
    this.taskRepo = taskRepo;
    this.outbox = outbox;
  }
  list() {
    return this.repo.list();
  }
  withTx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  enqueueUpsert(view) {
    this.outbox?.record({
      entityType: "task_view",
      entityId: view.id,
      operation: "upsert",
      payload: taskViewToSyncPayload(view),
      clientSyncVersion: 1
    });
  }
  get(id) {
    const v = this.repo.findById(id);
    if (!v) throw new AppError("NOT_FOUND", "视图不存在");
    return v;
  }
  create(dto) {
    const name = dto.name?.trim();
    if (!name) throw new AppError("VALIDATION_ERROR", "视图名称不能为空");
    if (!LAYOUTS.includes(dto.layout)) {
      throw new AppError("VALIDATION_ERROR", "无效的布局类型");
    }
    const filterRule = dto.filterRule ?? null;
    if (filterRule) {
      const ruleErr = validateFilterNode(filterRule);
      if (ruleErr) throw new AppError("VALIDATION_ERROR", ruleErr);
    }
    const groupBy = normalizeGroupBy(dto.groupBy);
    const sortBy = normalizeSortBy(dto.sortBy);
    const kanbanBoardMode = normalizeKanbanMode(dto.layout, dto.kanbanBoardMode);
    const quadrantOptions = normalizeQuadrantOptions(dto.layout, dto.quadrantOptions);
    const ts = nowIso();
    const view = {
      id: uuid.v4(),
      name,
      layout: dto.layout,
      scopeKey: dto.scopeKey ?? null,
      filterRule,
      groupBy,
      sortBy,
      kanbanBoardMode,
      quadrantOptions,
      sortOrder: dto.sortOrder ?? this.repo.maxSortOrder() + 1,
      createdAt: ts,
      updatedAt: ts
    };
    this.withTx(() => {
      this.repo.insert(view);
      this.enqueueUpsert(view);
    });
    return this.get(view.id);
  }
  update(id, dto) {
    const existing = this.get(id);
    const layout = dto.layout ?? existing.layout;
    if (dto.layout !== void 0 && !LAYOUTS.includes(dto.layout)) {
      throw new AppError("VALIDATION_ERROR", "无效的布局类型");
    }
    const filterRule = dto.filterRule !== void 0 ? dto.filterRule : existing.filterRule;
    if (filterRule) {
      const ruleErr = validateFilterNode(filterRule);
      if (ruleErr) throw new AppError("VALIDATION_ERROR", ruleErr);
    }
    const name = dto.name !== void 0 ? dto.name.trim() : existing.name;
    if (!name) throw new AppError("VALIDATION_ERROR", "视图名称不能为空");
    const updated = {
      ...existing,
      name,
      layout,
      scopeKey: dto.scopeKey !== void 0 ? dto.scopeKey : existing.scopeKey,
      filterRule,
      groupBy: dto.groupBy !== void 0 ? normalizeGroupBy(dto.groupBy) : existing.groupBy,
      sortBy: dto.sortBy !== void 0 ? normalizeSortBy(dto.sortBy) : existing.sortBy,
      kanbanBoardMode: dto.kanbanBoardMode !== void 0 ? normalizeKanbanMode(layout, dto.kanbanBoardMode) : layout === "kanban" ? existing.kanbanBoardMode ?? "group" : null,
      quadrantOptions: dto.quadrantOptions !== void 0 ? normalizeQuadrantOptions(layout, dto.quadrantOptions) : layout === "quadrant" ? existing.quadrantOptions : null,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      updatedAt: nowIso()
    };
    this.withTx(() => {
      this.repo.update(updated);
      this.enqueueUpsert(updated);
    });
    return this.get(id);
  }
  delete(id) {
    this.get(id);
    this.withTx(() => {
      this.repo.delete(id);
      this.outbox?.record({
        entityType: "task_view",
        entityId: id,
        operation: "delete",
        payload: { id, updatedAt: nowIso() },
        clientSyncVersion: 1
      });
    });
  }
  /** 按模板名插入；重名则后缀 (2)、(3)... */
  createFromPreset(preset, baseName) {
    const desired = (baseName ?? preset.name).trim();
    if (!desired) return null;
    let name = desired;
    let n = 2;
    while (this.repo.findByName(name)) {
      name = `${desired} (${n})`;
      n++;
      if (n > 99) return null;
    }
    return this.create({ ...preset, name });
  }
  previewCount(rule, ctx) {
    const ruleErr = validateFilterNode(rule);
    if (ruleErr) throw new AppError("VALIDATION_ERROR", ruleErr);
    if (!this.taskRepo) return 0;
    const tasks = this.taskRepo.list({ hideDone: false, smartList: "all" });
    const hasSubtasksById = buildHasSubtasksMap(tasks);
    return tasks.filter((t) => matchTask(t, rule, { ...ctx, hasSubtasksById })).length;
  }
}
function normalizeGroupBy(value) {
  if (value && GROUP_BY.includes(value)) return value;
  return "none";
}
function normalizeSortBy(value) {
  if (value && SORT_BY.includes(value)) return value;
  return "custom";
}
function normalizeKanbanMode(layout, mode) {
  if (layout !== "kanban") return null;
  if (mode === "status" || mode === "priority" || mode === "time" || mode === "tag") return mode;
  return "group";
}
function normalizeQuadrantOptions(layout, options) {
  if (layout !== "quadrant") return null;
  if (!options) {
    return {
      showCompleted: false,
      enableGrouping: true,
      groupBy: "status",
      sortBy: "time"
    };
  }
  return {
    showCompleted: Boolean(options.showCompleted),
    enableGrouping: Boolean(options.enableGrouping),
    groupBy: options.groupBy ?? "status",
    sortBy: options.sortBy ?? "time"
  };
}
function buildHasSubtasksMap(tasks) {
  const map = /* @__PURE__ */ new Map();
  for (const t of tasks) {
    if (t.parentId) map.set(t.parentId, true);
  }
  return map;
}
class TaskActivityService {
  constructor(repo, getPolicy = readTaskActivityRetention) {
    this.repo = repo;
    this.getPolicy = getPolicy;
  }
  listByTask(taskId, limit = 100, before) {
    if (!taskId?.trim()) {
      throw new AppError("VALIDATION_ERROR", "任务 id 不能为空");
    }
    return this.repo.listByTask(taskId, limit, before);
  }
  countAll() {
    return this.repo.countAll();
  }
  recordMany(activities) {
    if (!activities.length) return;
    this.repo.insertMany(activities);
    this.purgeByCurrentPolicy();
  }
  getRetentionPolicy() {
    return this.getPolicy();
  }
  updateRetentionPolicy(policy) {
    const merged = mergeTaskActivityRetention(policy);
    const err = validateTaskActivityRetention(merged);
    if (err) {
      throw new AppError("VALIDATION_ERROR", err);
    }
    saveTaskActivityRetention(merged);
    return merged;
  }
  purgeByCurrentPolicy() {
    return this.repo.purgeByPolicy(this.getPolicy());
  }
  purgeByPolicy(policy) {
    const merged = mergeTaskActivityRetention(policy);
    const err = validateTaskActivityRetention(merged);
    if (err) {
      throw new AppError("VALIDATION_ERROR", err);
    }
    return this.repo.purgeByPolicy(merged);
  }
  deleteAll() {
    return this.repo.deleteAll();
  }
  deleteForTrashedTasks() {
    return this.repo.deleteForTrashedTasks();
  }
  deleteByTaskId(taskId) {
    return this.repo.deleteByTaskId(taskId);
  }
}
function sameTagList(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
class TaskActivityRecorder {
  constructor(categoryRepo, kanbanRepo) {
    this.categoryRepo = categoryRepo;
    this.kanbanRepo = kanbanRepo;
  }
  buildCreateEvents(task, dto) {
    const ts = task.createdAt;
    const events = [
      {
        taskId: task.id,
        type: "created",
        summary: dto.parentId ? "创建了子任务" : "创建了任务",
        createdAt: ts
      }
    ];
    if (dto.parentId) {
      events.push({
        taskId: dto.parentId,
        type: "subtask_added",
        summary: `添加子任务「${task.title}」`,
        createdAt: ts
      });
    }
    return events;
  }
  buildUpdateEvents(existing, updated, dto) {
    const ts = updated.updatedAt;
    const events = [];
    if (dto.title !== void 0 && dto.title.trim() !== existing.title) {
      events.push({
        taskId: updated.id,
        type: "title_updated",
        summary: "修改了标题",
        createdAt: ts
      });
    }
    if (dto.description !== void 0 && (dto.description ?? null) !== existing.description) {
      events.push({
        taskId: updated.id,
        type: "description_updated",
        summary: dto.description?.trim() ? "修改了正文" : "清空了正文",
        createdAt: ts
      });
    }
    if (dto.priority !== void 0 && dto.priority !== existing.priority) {
      events.push({
        taskId: updated.id,
        type: "priority_updated",
        summary: `将优先级设为「${getTaskPriorityMeta(updated.priority).label}」`,
        createdAt: ts
      });
    }
    if (dto.categoryId !== void 0 && (dto.categoryId ?? null) !== existing.categoryId) {
      events.push({
        taskId: updated.id,
        type: "category_updated",
        summary: this.categorySummary(updated.categoryId),
        createdAt: ts
      });
    }
    if (dto.tags !== void 0 && !sameTagList(existing.tags ?? [], updated.tags ?? [])) {
      events.push({
        taskId: updated.id,
        type: "tags_updated",
        summary: this.tagsSummary(updated.tags ?? []),
        createdAt: ts
      });
    }
    if (dto.dueAt !== void 0 && (dto.dueAt ?? null) !== existing.dueAt) {
      events.push({
        taskId: updated.id,
        type: "due_updated",
        summary: updated.dueAt ? "设置了截止时间" : "清除了截止时间",
        createdAt: ts
      });
    }
    if (dto.startAt !== void 0 && (dto.startAt ?? null) !== existing.startAt) {
      events.push({
        taskId: updated.id,
        type: "start_updated",
        summary: updated.startAt ? "设置了开始时间" : "清除了开始时间",
        createdAt: ts
      });
    }
    if (this.remindersChanged(existing, dto)) {
      events.push({
        taskId: updated.id,
        type: "reminders_updated",
        summary: "更新了提醒",
        createdAt: ts
      });
    }
    if (dto.recurrence !== void 0) {
      const prev = existing.recurrence ?? null;
      const next = updated.recurrence ?? null;
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        let summary = "修改了重复规则";
        if (!prev && next) summary = "设置了重复规则";
        else if (prev && !next) summary = "清除了重复规则";
        events.push({
          taskId: updated.id,
          type: "recurrence_updated",
          summary,
          createdAt: ts
        });
      }
    }
    if (dto.kanbanGroupId !== void 0 && (dto.kanbanGroupId ?? null) !== existing.kanbanGroupId) {
      events.push({
        taskId: updated.id,
        type: "kanban_group_updated",
        summary: this.kanbanGroupSummary(updated.kanbanGroupId),
        createdAt: ts
      });
    }
    if (dto.status !== void 0 && dto.status !== existing.status) {
      events.push(...this.statusEvents(existing, updated, dto.status, ts));
    }
    if (dto.completedOccurrenceDates !== void 0) {
      const prev = new Set(existing.completedOccurrenceDates ?? []);
      const next = new Set(updated.completedOccurrenceDates ?? []);
      for (const dateKey of next) {
        if (!prev.has(dateKey)) {
          events.push({
            taskId: updated.id,
            type: "completed",
            summary: `完成了 ${dateKey} 的重复实例`,
            createdAt: ts
          });
        }
      }
      for (const dateKey of prev) {
        if (!next.has(dateKey)) {
          events.push({
            taskId: updated.id,
            type: "reopened",
            summary: `取消了 ${dateKey} 的完成状态`,
            createdAt: ts
          });
        }
      }
    }
    return events;
  }
  buildDeleteEvent(task, ts) {
    return {
      taskId: task.id,
      type: "deleted",
      summary: "移入了垃圾桶",
      createdAt: ts
    };
  }
  buildRestoreEvent(taskId, ts) {
    return {
      taskId,
      type: "restored",
      summary: "从垃圾桶恢复",
      createdAt: ts
    };
  }
  buildPermanentDeleteEvent(taskId, ts) {
    return {
      taskId,
      type: "permanently_deleted",
      summary: "已彻底删除",
      createdAt: ts
    };
  }
  buildSubtaskParentEvents(parentId, child, kind, ts) {
    const typeMap = {
      removed: "subtask_removed",
      completed: "subtask_completed",
      reopened: "subtask_reopened"
    };
    const summaryMap = {
      removed: `删除子任务「${child.title}」`,
      completed: `完成子任务「${child.title}」`,
      reopened: `重新打开子任务「${child.title}」`
    };
    return {
      taskId: parentId,
      type: typeMap[kind],
      summary: summaryMap[kind],
      createdAt: ts
    };
  }
  toActivities(inputs) {
    return inputs.map((input) => ({
      id: uuid.v4(),
      taskId: input.taskId,
      type: input.type,
      summary: input.summary,
      createdAt: input.createdAt ?? nowIso()
    }));
  }
  statusEvents(existing, updated, nextStatus, ts) {
    const events = [];
    if (nextStatus === "DONE" && existing.status !== "DONE") {
      events.push({
        taskId: updated.id,
        type: "completed",
        summary: "标记为已完成",
        createdAt: ts
      });
      if (updated.parentId) {
        events.push(this.buildSubtaskParentEvents(updated.parentId, updated, "completed", ts));
      }
    } else if (existing.status === "DONE" && nextStatus !== "DONE") {
      events.push({
        taskId: updated.id,
        type: "reopened",
        summary: "重新打开任务",
        createdAt: ts
      });
      if (updated.parentId) {
        events.push(this.buildSubtaskParentEvents(updated.parentId, updated, "reopened", ts));
      }
    }
    return events;
  }
  remindersChanged(existing, dto) {
    if (dto.reminders === void 0 && dto.remindAt === void 0) {
      return false;
    }
    const prev = (existing.reminders ?? []).map((r) => ({
      remindAt: r.remindAt,
      offsetMinutes: r.offsetMinutes ?? null
    }));
    let next = [];
    if (dto.reminders !== void 0) {
      next = dto.reminders.map((r) => ({
        remindAt: r.remindAt,
        offsetMinutes: r.offsetMinutes ?? null
      }));
    } else if (dto.remindAt !== void 0) {
      next = dto.remindAt ? [{ remindAt: dto.remindAt, offsetMinutes: null }] : [];
    }
    return JSON.stringify(prev) !== JSON.stringify(next);
  }
  categorySummary(categoryId) {
    if (!categoryId) {
      return "移出了清单";
    }
    const category = this.categoryRepo.findById(categoryId);
    return category ? `移至清单「${category.name}」` : "更改了清单";
  }
  tagsSummary(tags) {
    if (!tags.length) {
      return "清除了标签";
    }
    return `设置标签为 ${tags.map((t) => `#${t}`).join(" ")}`;
  }
  kanbanGroupSummary(kanbanGroupId) {
    if (!kanbanGroupId) {
      return "移出了看板分组";
    }
    const group = this.kanbanRepo.findById(kanbanGroupId);
    return group ? `移至看板分组「${group.name}」` : "更改了看板分组";
  }
}
async function chatCompletion(config, systemPrompt, userContent) {
  const merged = mergeLlmConfig(config);
  if (!merged.apiKey.trim()) {
    throw new Error("未配置大模型 API Key");
  }
  const baseUrl = resolveLlmBaseUrl(merged);
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${merged.apiKey.trim()}`
    },
    body: JSON.stringify({
      model: merged.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.4
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`大模型请求失败 (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("大模型返回内容为空");
  }
  return content;
}
function summarySyncPayload(summary) {
  return {
    id: summary.id,
    name: summary.name,
    categoryIds: summary.categoryIds,
    scheduleType: summary.scheduleType,
    sendTime: summary.sendTime,
    sendWeekday: summary.sendWeekday,
    sendDay: summary.sendDay,
    useLlm: summary.useLlm,
    promptText: summary.promptText,
    reportConfig: summary.reportConfig,
    enabled: summary.enabled,
    lastSentAt: summary.lastSentAt,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt
  };
}
class ScheduledSummaryService {
  constructor(repo, taskRepo, categoryRepo, outbox) {
    this.repo = repo;
    this.taskRepo = taskRepo;
    this.categoryRepo = categoryRepo;
    this.outbox = outbox;
  }
  withTx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  enqueueUpsert(summary) {
    this.outbox?.record({
      entityType: "scheduled_summary",
      entityId: summary.id,
      operation: "upsert",
      payload: summarySyncPayload(summary),
      clientSyncVersion: 1
    });
  }
  list() {
    return this.repo.list();
  }
  get(id) {
    const item = this.repo.findById(id);
    if (!item) {
      throw new AppError("NOT_FOUND", "汇总任务不存在");
    }
    return item;
  }
  create(dto) {
    const name = dto.name?.trim();
    if (!name) {
      throw new AppError("VALIDATION_ERROR", "汇总名称不能为空");
    }
    this.validateSchedule(dto.scheduleType, dto.sendTime, dto.sendWeekday, dto.sendDay);
    const reportConfig = normalizeReportConfigV2(dto.reportConfig);
    this.validateReportConfigForSave(reportConfig);
    const ts = nowIso();
    const summary = {
      id: uuid.v4(),
      name,
      categoryIds: dto.categoryIds ?? [],
      scheduleType: dto.scheduleType,
      sendTime: normalizeSendTime(dto.sendTime),
      sendWeekday: dto.scheduleType === "weekly" ? dto.sendWeekday ?? dayjs().day() : null,
      sendDay: dto.scheduleType === "monthly" ? dto.sendDay ?? dayjs().date() : null,
      useLlm: dto.useLlm ?? false,
      promptText: dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT,
      reportConfig,
      enabled: dto.enabled ?? true,
      lastSentAt: null,
      createdAt: ts,
      updatedAt: ts
    };
    this.withTx(() => {
      this.repo.insert(summary);
      this.enqueueUpsert(summary);
    });
    return summary;
  }
  update(id, dto) {
    const existing = this.get(id);
    const scheduleType = dto.scheduleType ?? existing.scheduleType;
    const sendTime = normalizeSendTime(dto.sendTime ?? existing.sendTime);
    const sendWeekday = dto.sendWeekday !== void 0 ? dto.sendWeekday : scheduleType === "weekly" ? existing.sendWeekday : null;
    const sendDay = dto.sendDay !== void 0 ? dto.sendDay : scheduleType === "monthly" ? existing.sendDay : null;
    this.validateSchedule(scheduleType, sendTime, sendWeekday, sendDay);
    const reportConfig = dto.reportConfig !== void 0 ? normalizeReportConfigV2(dto.reportConfig) : normalizeReportConfigV2(existing.reportConfig);
    this.validateReportConfigForSave(reportConfig);
    const updated = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      categoryIds: dto.categoryIds ?? existing.categoryIds,
      scheduleType,
      sendTime,
      sendWeekday,
      sendDay,
      useLlm: dto.useLlm ?? existing.useLlm,
      promptText: dto.promptText !== void 0 ? dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT : existing.promptText,
      reportConfig,
      enabled: dto.enabled ?? existing.enabled,
      updatedAt: nowIso()
    };
    if (!updated.name.trim()) {
      throw new AppError("VALIDATION_ERROR", "汇总名称不能为空");
    }
    this.withTx(() => {
      this.repo.update(updated);
      this.enqueueUpsert(updated);
    });
    return updated;
  }
  delete(id) {
    this.get(id);
    this.withTx(() => {
      this.repo.delete(id);
      this.outbox?.record({
        entityType: "scheduled_summary",
        entityId: id,
        operation: "delete",
        payload: { id, updatedAt: nowIso() },
        clientSyncVersion: 1
      });
    });
  }
  /** 生成并返回汇总正文（供调度器发送 / 预览） */
  async buildSummaryBody(summary, now = dayjs()) {
    const reportConfig = normalizeReportConfigV2(summary.reportConfig);
    const raw = reportConfig.mode === "template" ? this.buildTemplateBody(summary, reportConfig.freeTemplate.body, now) : this.buildFormBody(summary, reportConfig, now);
    if (!summary.useLlm) {
      return raw;
    }
    try {
      const llmConfig = readLlmConfig();
      const prompt = summary.promptText?.trim() || DEFAULT_SUMMARY_PROMPT;
      const userContent = `汇总名称：${summary.name}

任务汇总数据：
${raw}`;
      return await chatCompletion(llmConfig, prompt, userContent);
    } catch (err) {
      console.error("[ScheduledSummaryService] LLM failed, fallback to raw", err);
      return `${raw}

（大模型优化失败，已展示原始列表）`;
    }
  }
  /**
   * 预览汇总正文：不落库、不 markSent、不发消息。
   */
  async previewSummaryBody(dto) {
    const existing = dto.id ? this.repo.findById(dto.id) : null;
    const summary = {
      id: existing?.id ?? "preview",
      name: dto.name?.trim() || existing?.name || "预览汇总",
      categoryIds: dto.categoryIds ?? existing?.categoryIds ?? [],
      scheduleType: dto.scheduleType ?? existing?.scheduleType ?? "daily",
      sendTime: normalizeSendTime(dto.sendTime ?? existing?.sendTime ?? "09:00"),
      sendWeekday: dto.sendWeekday !== void 0 ? dto.sendWeekday : existing?.sendWeekday ?? null,
      sendDay: dto.sendDay !== void 0 ? dto.sendDay : existing?.sendDay ?? null,
      useLlm: dto.useLlm ?? existing?.useLlm ?? false,
      promptText: dto.promptText !== void 0 ? dto.promptText?.trim() || DEFAULT_SUMMARY_PROMPT : existing?.promptText ?? DEFAULT_SUMMARY_PROMPT,
      reportConfig: normalizeReportConfigV2(dto.reportConfig ?? existing?.reportConfig),
      enabled: true,
      lastSentAt: existing?.lastSentAt ?? null,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: existing?.updatedAt ?? nowIso()
    };
    return this.buildSummaryBody(summary);
  }
  markSent(id, sentAt) {
    this.withTx(() => {
      this.repo.markSent(id, sentAt);
      const updated = this.repo.findById(id);
      if (updated) this.enqueueUpsert(updated);
    });
  }
  buildFormBody(summary, reportConfig, now) {
    const enabledSections = reportConfig.sections.filter((section) => section.enabled);
    if (!enabledSections.length) {
      return "未启用任何汇总区块，请在设置中配置报告内容。";
    }
    const categories = this.categoryRepo.list();
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    const todayBounds = localDayBounds(now);
    const sectionResults = enabledSections.map((section) => {
      const bounds = resolveSectionTimeBounds(
        section.time.preset,
        summary.scheduleType,
        now,
        summary.lastSentAt
      );
      const categoryIds = resolveSectionCategoryIds(section, summary.categoryIds);
      const tasks = this.taskRepo.listForSummaryReport(
        section.query.status,
        bounds.from,
        bounds.to,
        categoryIds,
        {
          dueBetween: section.query.dueScope === "due_today_only" ? todayBounds : null
        }
      );
      return { section, bounds, tasks };
    });
    return buildReportSummaryText(
      sectionResults,
      categoryNames,
      (id) => this.taskRepo.findById(id)
    );
  }
  buildTemplateBody(summary, body, now) {
    if (!body.trim()) {
      throw new AppError("VALIDATION_ERROR", "自由模板内容为空");
    }
    const categories = this.categoryRepo.list();
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));
    const byId = new Map(categories.map((c) => [c.id, c]));
    try {
      return renderSummaryFreeTemplate(body, {
        scheduleType: summary.scheduleType,
        now,
        lastSentAt: summary.lastSentAt,
        categoryNames,
        resolveListId: ({ listName, listId, line }) => {
          if (listId) {
            if (!byId.has(listId)) {
              throw new SummaryTemplateError(line, `找不到清单 id「${listId}」`);
            }
            return listId;
          }
          if (listName) {
            const hit = byName.get(listName.trim().toLowerCase());
            if (!hit) {
              throw new SummaryTemplateError(line, `找不到清单「${listName}」`);
            }
            return hit.id;
          }
          return void 0;
        },
        fetchTasks: ({ status, bounds, categoryIds, dueBetween }) => {
          const ids = categoryIds && categoryIds.length > 0 ? categoryIds : summary.categoryIds.length > 0 ? summary.categoryIds : void 0;
          return this.taskRepo.listForSummaryReport(status, bounds.from, bounds.to, ids, {
            dueBetween: dueBetween ?? null
          });
        },
        // 关键：提供 findById 供 layoutSummaryTaskTree 补齐未命中父任务锚点。
        resolveById: (id) => this.taskRepo.findById(id)
      });
    } catch (err) {
      if (err instanceof SummaryTemplateError) {
        throw new AppError("VALIDATION_ERROR", err.message);
      }
      throw err;
    }
  }
  validateReportConfigForSave(reportConfig) {
    if (reportConfig.mode === "template") {
      try {
        assertValidSummaryFreeTemplate(reportConfig.freeTemplate.body || "");
      } catch (err) {
        if (err instanceof SummaryTemplateError) {
          throw new AppError("VALIDATION_ERROR", err.message);
        }
        throw err;
      }
      if (!reportConfig.freeTemplate.body.trim()) {
        throw new AppError("VALIDATION_ERROR", "自由模板内容不能为空");
      }
      return;
    }
    const enabled = reportConfig.sections.filter((s) => s.enabled);
    if (!enabled.length) {
      throw new AppError("VALIDATION_ERROR", "请至少启用一个报告区块");
    }
  }
  validateSchedule(scheduleType, sendTimeRaw, sendWeekday, sendDay) {
    const sendTime = normalizeSendTime(sendTimeRaw);
    if (!/^\d{2}:\d{2}$/.test(sendTime)) {
      throw new AppError("VALIDATION_ERROR", "发送时间格式应为 HH:mm");
    }
    if (scheduleType === "weekly" && (sendWeekday == null || sendWeekday < 0 || sendWeekday > 6)) {
      throw new AppError("VALIDATION_ERROR", "每周汇总须选择星期");
    }
    if (scheduleType === "monthly" && (sendDay == null || sendDay < 1 || sendDay > 31)) {
      throw new AppError("VALIDATION_ERROR", "每月汇总须选择日期（1–31）");
    }
  }
}
const WIDGET_DISPLAY_MODES = ["hidden", "edge_tab", "mini", "expanded"];
const WIDGET_COLLAPSE_POLICIES = ["on_blur", "manual", "idle_timeout"];
const WIDGET_EDGE_ANCHORS = ["left", "right", "top", "bottom"];
const WIDGET_EDGE_TAB_WIDTH = 28;
const WIDGET_EDGE_TAB_MIN_ALONG = 64;
const WIDGET_EDGE_TAB_MAX_ALONG = 280;
const WIDGET_MINI_WIDTH = 148;
const WIDGET_MINI_HEIGHT = 56;
function defaultDisplayModeForKind(_kind) {
  return "expanded";
}
function defaultCollapsePolicyForKind(kind) {
  return kind === "notes" ? "manual" : "on_blur";
}
function isTaskWidgetKind(kind) {
  return kind === "matrix" || kind === "view";
}
function sanitizeDisplayMode(value, fallback) {
  return WIDGET_DISPLAY_MODES.includes(value) ? value : fallback;
}
function sanitizeCollapsePolicy(value, fallback) {
  return WIDGET_COLLAPSE_POLICIES.includes(value) ? value : fallback;
}
function sanitizeEdgeAnchor(value, fallback) {
  return WIDGET_EDGE_ANCHORS.includes(value) ? value : fallback;
}
function sanitizeKind(kind) {
  return WIDGET_KINDS.includes(kind) ? kind : "notes";
}
function mapInstance(row) {
  const kind = sanitizeKind(row.kind);
  const fallbackMode = defaultDisplayModeForKind();
  const fallbackPolicy = defaultCollapsePolicyForKind(kind);
  return {
    id: row.id,
    kind,
    viewId: row.view_id,
    name: row.name,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    alwaysOnTop: row.always_on_top === 1,
    sortOrder: row.sort_order,
    displayMode: sanitizeDisplayMode(row.display_mode, fallbackMode),
    collapsePolicy: sanitizeCollapsePolicy(row.collapse_policy, fallbackPolicy),
    idleTimeoutSec: row.idle_timeout_sec > 0 ? row.idle_timeout_sec : 30,
    edgeAnchor: sanitizeEdgeAnchor(row.edge_anchor, "right"),
    expandedX: row.expanded_x ?? row.x,
    expandedY: row.expanded_y ?? row.y,
    expandedWidth: row.expanded_width ?? row.width,
    expandedHeight: row.expanded_height ?? row.height,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
class WidgetInstanceRepository {
  constructor(db) {
    this.db = db;
  }
  list() {
    const rows = this.db.prepare(`SELECT * FROM widget_instances ORDER BY sort_order ASC, created_at ASC`).all();
    return rows.map(mapInstance);
  }
  find(id) {
    const row = this.db.prepare(`SELECT * FROM widget_instances WHERE id = ?`).get(id);
    return row ? mapInstance(row) : null;
  }
  create(dto) {
    const kind = sanitizeKind(dto.kind);
    if (kind === "view" && !dto.viewId?.trim()) {
      throw new AppError("VALIDATION_ERROR", "视图挂件必须选择视图");
    }
    if (kind !== "view" && dto.viewId) {
      throw new AppError("VALIDATION_ERROR", "仅视图挂件可绑定视图");
    }
    const ts = nowIso();
    const id = uuid.v4();
    const sortOrder = this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM widget_instances`).get().next ?? 0;
    const defaults = this.db.prepare(`SELECT x, y, width, height, always_on_top FROM widget_settings WHERE id = 'default'`).get();
    const viewId = kind === "view" ? dto.viewId.trim() : null;
    let width = defaults?.width ?? WIDGET_DEFAULT_WIDTH;
    let height = defaults?.height ?? WIDGET_DEFAULT_HEIGHT;
    if (kind === "view" && viewId) {
      const viewRow = this.db.prepare(`SELECT layout FROM task_views WHERE id = ?`).get(viewId);
      if (viewRow?.layout === "kanban") {
        width = WIDGET_KANBAN_DEFAULT_WIDTH;
        height = WIDGET_KANBAN_DEFAULT_HEIGHT;
      }
    }
    const x = defaults?.x ?? 200;
    const y = (defaults?.y ?? 200) + sortOrder * 32;
    const displayMode = defaultDisplayModeForKind();
    const collapsePolicy = defaultCollapsePolicyForKind(kind);
    const instance = {
      id,
      kind,
      viewId,
      name: dto.name?.trim() ?? "",
      x,
      y,
      width,
      height,
      alwaysOnTop: defaults?.always_on_top === 1,
      sortOrder,
      displayMode,
      collapsePolicy,
      idleTimeoutSec: 30,
      edgeAnchor: "right",
      expandedX: x,
      expandedY: y,
      expandedWidth: width,
      expandedHeight: height,
      createdAt: ts,
      updatedAt: ts
    };
    this.db.prepare(
      `INSERT INTO widget_instances (
          id, kind, view_id, name, x, y, width, height, always_on_top, sort_order,
          display_mode, collapse_policy, idle_timeout_sec, edge_anchor,
          expanded_x, expanded_y, expanded_width, expanded_height,
          created_at, updated_at
        ) VALUES (
          @id, @kind, @viewId, @name, @x, @y, @width, @height, @alwaysOnTop, @sortOrder,
          @displayMode, @collapsePolicy, @idleTimeoutSec, @edgeAnchor,
          @expandedX, @expandedY, @expandedWidth, @expandedHeight,
          @createdAt, @updatedAt
        )`
    ).run({
      id: instance.id,
      kind: instance.kind,
      viewId: instance.viewId,
      name: instance.name,
      x: instance.x,
      y: instance.y,
      width: instance.width,
      height: instance.height,
      alwaysOnTop: instance.alwaysOnTop ? 1 : 0,
      sortOrder: instance.sortOrder,
      displayMode: instance.displayMode,
      collapsePolicy: instance.collapsePolicy,
      idleTimeoutSec: instance.idleTimeoutSec,
      edgeAnchor: instance.edgeAnchor,
      expandedX: instance.expandedX,
      expandedY: instance.expandedY,
      expandedWidth: instance.expandedWidth,
      expandedHeight: instance.expandedHeight,
      createdAt: ts,
      updatedAt: ts
    });
    return instance;
  }
  update(id, dto) {
    const current = this.find(id);
    if (!current) {
      throw new AppError("NOT_FOUND", "挂件不存在");
    }
    const ts = nowIso();
    const next = {
      ...current,
      name: dto.name ?? current.name,
      x: dto.x ?? current.x,
      y: dto.y ?? current.y,
      width: dto.width ?? current.width,
      height: dto.height ?? current.height,
      alwaysOnTop: dto.alwaysOnTop ?? current.alwaysOnTop,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      displayMode: dto.displayMode ?? current.displayMode,
      collapsePolicy: dto.collapsePolicy ?? current.collapsePolicy,
      idleTimeoutSec: dto.idleTimeoutSec ?? current.idleTimeoutSec,
      edgeAnchor: dto.edgeAnchor ?? current.edgeAnchor,
      expandedX: dto.expandedX ?? current.expandedX,
      expandedY: dto.expandedY ?? current.expandedY,
      expandedWidth: dto.expandedWidth ?? current.expandedWidth,
      expandedHeight: dto.expandedHeight ?? current.expandedHeight,
      updatedAt: ts
    };
    this.db.prepare(
      `UPDATE widget_instances SET
          name = @name, x = @x, y = @y, width = @width, height = @height,
          always_on_top = @alwaysOnTop, sort_order = @sortOrder,
          display_mode = @displayMode, collapse_policy = @collapsePolicy,
          idle_timeout_sec = @idleTimeoutSec, edge_anchor = @edgeAnchor,
          expanded_x = @expandedX, expanded_y = @expandedY,
          expanded_width = @expandedWidth, expanded_height = @expandedHeight,
          updated_at = @updatedAt
         WHERE id = @id`
    ).run({
      id,
      name: next.name,
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
      alwaysOnTop: next.alwaysOnTop ? 1 : 0,
      sortOrder: next.sortOrder,
      displayMode: next.displayMode,
      collapsePolicy: next.collapsePolicy,
      idleTimeoutSec: next.idleTimeoutSec,
      edgeAnchor: next.edgeAnchor,
      expandedX: next.expandedX,
      expandedY: next.expandedY,
      expandedWidth: next.expandedWidth,
      expandedHeight: next.expandedHeight,
      updatedAt: ts
    });
    return next;
  }
  delete(id) {
    const result = this.db.prepare(`DELETE FROM widget_instances WHERE id = ?`).run(id);
    if (result.changes === 0) {
      throw new AppError("NOT_FOUND", "挂件不存在");
    }
  }
}
const WIDGET_EDGE_SNAP_THRESHOLD = 36;
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function clampY(y, height, workArea) {
  return clamp(y, workArea.y, workArea.y + workArea.height - height);
}
function clampX(x, width, workArea) {
  return clamp(x, workArea.x, workArea.x + workArea.width - width);
}
function isHorizontalEdge(anchor) {
  return anchor === "top" || anchor === "bottom";
}
function stripDimensionsForLabel(anchor, label) {
  const text = label.trim() || "挂件";
  const chars = [...text].length;
  if (isHorizontalEdge(anchor)) {
    return {
      width: clamp(chars * 13 + 24, WIDGET_EDGE_TAB_MIN_ALONG, WIDGET_EDGE_TAB_MAX_ALONG),
      height: WIDGET_EDGE_TAB_WIDTH
    };
  }
  return {
    width: WIDGET_EDGE_TAB_WIDTH,
    height: clamp(chars * 14 + 24, WIDGET_EDGE_TAB_MIN_ALONG, WIDGET_EDGE_TAB_MAX_ALONG)
  };
}
function detectNearestDockEdge(bounds, workArea, threshold = WIDGET_EDGE_SNAP_THRESHOLD) {
  const toLeft = bounds.x - workArea.x;
  const toRight = workArea.x + workArea.width - (bounds.x + bounds.width);
  const toTop = bounds.y - workArea.y;
  const toBottom = workArea.y + workArea.height - (bounds.y + bounds.height);
  const candidates = [
    { edge: "left", dist: toLeft },
    { edge: "right", dist: toRight },
    { edge: "top", dist: toTop },
    { edge: "bottom", dist: toBottom }
  ].filter((c) => c.dist >= 0 && c.dist <= threshold);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].edge;
}
function resolveStripAlongEdge(anchor, desiredAlong, stripAlongSize, workArea, occupied, gap = 6) {
  const minAlong = isHorizontalEdge(anchor) ? workArea.x : workArea.y;
  const maxAlong = isHorizontalEdge(anchor) ? workArea.x + workArea.width - stripAlongSize : workArea.y + workArea.height - stripAlongSize;
  const overlaps = (pos2, blocks) => blocks.some(
    (o) => pos2 < o.along + o.size + gap && pos2 + stripAlongSize + gap > o.along
  );
  let pos = clamp(desiredAlong, minAlong, maxAlong);
  if (!overlaps(pos, occupied)) {
    return pos;
  }
  const sorted = [...occupied].sort((a, b) => a.along - b.along);
  for (const block of sorted) {
    const after = block.along + block.size + gap;
    if (after <= maxAlong && !overlaps(after, occupied)) {
      return after;
    }
  }
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const before = sorted[i].along - stripAlongSize - gap;
    if (before >= minAlong && !overlaps(before, occupied)) {
      return before;
    }
  }
  return pos;
}
function stripBoundsForEdge(anchor, placement, workArea, dimensions) {
  const size = dimensions ?? stripDimensionsForLabel(anchor, placement.label ?? "挂件");
  const { width, height } = size;
  switch (anchor) {
    case "left":
      return { x: workArea.x, y: clampY(placement.alongEdge, height, workArea), width, height };
    case "right":
      return {
        x: workArea.x + workArea.width - width,
        y: clampY(placement.alongEdge, height, workArea),
        width,
        height
      };
    case "top":
      return { x: clampX(placement.alongEdge, width, workArea), y: workArea.y, width, height };
    case "bottom":
      return {
        x: clampX(placement.alongEdge, width, workArea),
        y: workArea.y + workArea.height - height,
        width,
        height
      };
    default:
      return {
        x: workArea.x + workArea.width - width,
        y: clampY(placement.alongEdge, height, workArea),
        width,
        height
      };
  }
}
function desiredStripAlongFromBounds(anchor, fromBounds, stripAlongSize) {
  if (isHorizontalEdge(anchor)) {
    return fromBounds.x + Math.round((fromBounds.width - stripAlongSize) / 2);
  }
  return fromBounds.y + Math.round((fromBounds.height - stripAlongSize) / 2);
}
function expandedWindowBounds(expanded, workArea) {
  return {
    x: clampX(expanded.x, expanded.width, workArea),
    y: clampY(expanded.y, expanded.height, workArea),
    width: expanded.width,
    height: expanded.height
  };
}
function peekExpandedBoundsNearStrip(anchor, strip, expanded, workArea) {
  const width = expanded.width;
  const height = expanded.height;
  if (anchor === "right") {
    return {
      x: clampX(strip.x + strip.width - width, width, workArea),
      y: clampY(strip.y + Math.round((strip.height - height) / 2), height, workArea),
      width,
      height
    };
  }
  if (anchor === "left") {
    return {
      x: clampX(strip.x, width, workArea),
      y: clampY(strip.y + Math.round((strip.height - height) / 2), height, workArea),
      width,
      height
    };
  }
  if (anchor === "top") {
    return {
      x: clampX(strip.x + Math.round((strip.width - width) / 2), width, workArea),
      y: clampY(strip.y, height, workArea),
      width,
      height
    };
  }
  return {
    x: clampX(strip.x + Math.round((strip.width - width) / 2), width, workArea),
    y: clampY(strip.y + strip.height - height, height, workArea),
    width,
    height
  };
}
function boundsForDisplayMode(mode, expanded, edgeAnchor, workArea, stripOptions) {
  {
    const width = WIDGET_MINI_WIDTH;
    const height = WIDGET_MINI_HEIGHT;
    return {
      x: clampX(expanded.x, width, workArea),
      y: clampY(expanded.y, height, workArea),
      width,
      height
    };
  }
}
function expandedBoundsFromInstance(instance) {
  return {
    x: instance.expandedX ?? instance.x,
    y: instance.expandedY ?? instance.y,
    width: instance.expandedWidth ?? instance.width,
    height: instance.expandedHeight ?? instance.height
  };
}
function stripAlongFromInstance(anchor, instance) {
  return isHorizontalEdge(anchor) ? instance.x : instance.y;
}
class WidgetWindowManager {
  windows = /* @__PURE__ */ new Map();
  saveBoundsTimers = /* @__PURE__ */ new Map();
  edgeSnapTimers = /* @__PURE__ */ new Map();
  applyingBounds = /* @__PURE__ */ new Set();
  /** 贴边悬停临时展开的实例：收起时不把 peek 坐标写入 expandedX/Y */
  peekingIds = /* @__PURE__ */ new Set();
  /** peek 期间按光标是否仍在窗内决定收起（避免 drag 标题栏误触 mouseleave） */
  peekWatchTimers = /* @__PURE__ */ new Map();
  taskToggleCursor = 0;
  get instanceRepo() {
    return new WidgetInstanceRepository(getDatabase());
  }
  get settingsRepo() {
    return new WidgetNoteRepository(getDatabase());
  }
  listInstances() {
    return this.instanceRepo.list();
  }
  getInstance(id) {
    return this.instanceRepo.find(id);
  }
  createInstance(dto) {
    const instance = this.instanceRepo.create(dto);
    this.showInstance(instance.id, { focus: true });
    return this.instanceRepo.find(instance.id) ?? instance;
  }
  updateInstance(id, dto) {
    const instance = this.instanceRepo.update(id, dto);
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      if (dto.alwaysOnTop !== void 0) {
        win.setAlwaysOnTop(instance.alwaysOnTop, "floating");
      }
      if (dto.displayMode !== void 0 || dto.edgeAnchor !== void 0) {
        this.syncWindowToInstance(id, { focus: false });
      }
    }
    return instance;
  }
  deleteInstance(id) {
    this.destroyWindow(id);
    this.instanceRepo.delete(id);
  }
  getSettings() {
    return this.settingsRepo.getSettings();
  }
  updateSettings(dto) {
    return this.settingsRepo.updateSettings(dto);
  }
  isVisible(id) {
    if (id) {
      const win = this.windows.get(id);
      return !!win && !win.isDestroyed() && win.isVisible();
    }
    return [...this.windows.values()].some((win) => !win.isDestroyed() && win.isVisible());
  }
  show(id) {
    if (id) {
      this.expand(id);
      return;
    }
    for (const instance of this.listInstances()) {
      if (instance.displayMode !== "hidden") {
        this.showInstance(instance.id, { focus: false });
      }
    }
    const last = this.listInstances().at(-1);
    last && this.windows.get(last.id)?.focus();
  }
  hide(id) {
    if (id) {
      this.setDisplayMode(id, "hidden");
      return;
    }
    for (const instance of this.listInstances()) {
      this.setDisplayMode(instance.id, "hidden");
    }
  }
  toggle(id) {
    if (id) {
      const instance = this.instanceRepo.find(id);
      if (!instance) return;
      if (instance.displayMode !== "expanded") {
        this.expand(id);
      }
      return;
    }
    this.toggleTaskWidgets();
  }
  /**
   * 展开挂件。
   * @param options.peek 贴边悬停预览：就地展开，移开后应收起且不污染记忆位置
   */
  expand(id, options) {
    const instance = this.instanceRepo.find(id);
    if (!instance) return;
    const win = this.ensureWindow(id);
    if (instance.displayMode === "expanded" && !options?.peek) {
      this.clearPeekState(id);
      win.show();
      win.focus();
      this.notifyDisplayMode(id, instance);
      return;
    }
    const workArea = electron.screen.getDisplayMatching(win.getBounds()).workArea;
    const expanded = expandedBoundsFromInstance(instance);
    let bounds;
    if (options?.peek && instance.displayMode === "edge_tab") {
      const strip = win.getBounds();
      bounds = peekExpandedBoundsNearStrip(instance.edgeAnchor, strip, expanded, workArea);
      this.peekingIds.add(id);
      this.startPeekPointerWatch(id);
    } else {
      this.clearPeekState(id);
      bounds = expandedWindowBounds(expanded, workArea);
    }
    const updated = this.instanceRepo.update(id, {
      displayMode: "expanded",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
      // peek 不改 expandedX/Y；正式展开也不在此处改记忆宽高，仅改当前窗位
    });
    this.applyWindowBounds(id, win, bounds, true);
    win.show();
    win.focus();
    this.notifyDisplayMode(id, updated);
  }
  collapse(id) {
    const instance = this.instanceRepo.find(id);
    const win = this.windows.get(id);
    if (!instance || !win || win.isDestroyed() || instance.displayMode !== "expanded") {
      this.clearPeekState(id);
      return;
    }
    const wasPeeking = this.clearPeekState(id);
    const bounds = win.getBounds();
    const workArea = electron.screen.getDisplayMatching(bounds).workArea;
    const edge = detectNearestDockEdge(bounds, workArea) ?? instance.edgeAnchor;
    this.dockToEdge(id, edge, bounds, { preserveExpandedMemory: wasPeeking });
  }
  setDisplayMode(id, mode, options) {
    if (mode === "hidden") {
      return this.hideInstance(id);
    }
    if (mode === "expanded") {
      this.expand(id);
      return this.instanceRepo.find(id);
    }
    return this.syncWindowToInstance(id, { focus: options?.focus ?? false });
  }
  toggleTaskWidgets() {
    const tasks = this.listInstances().filter((i) => isTaskWidgetKind(i.kind));
    if (tasks.length === 0) {
      this.show();
      return;
    }
    const compact = tasks.filter((i) => i.displayMode === "edge_tab" || i.displayMode === "mini");
    if (compact.length > 0) {
      this.taskToggleCursor = this.taskToggleCursor % compact.length;
      const target = compact[this.taskToggleCursor];
      this.taskToggleCursor += 1;
      this.expand(target.id);
      return;
    }
    const hidden = tasks.filter((i) => i.displayMode === "hidden");
    if (hidden.length > 0) {
      this.expand(hidden[0].id);
    }
  }
  restoreOnStartup() {
    const settings = this.getSettings();
    if (!settings.openOnStartup) return;
    for (const instance of this.listInstances()) {
      if (instance.displayMode === "hidden") continue;
      this.showInstance(instance.id, { focus: false });
    }
  }
  destroy() {
    for (const id of [...this.windows.keys()]) {
      this.destroyWindow(id);
    }
  }
  /** 拖近边缘时贴边（仅 expanded 状态触发） */
  tryDockFromExpanded(instanceId) {
    const instance = this.instanceRepo.find(instanceId);
    const win = this.windows.get(instanceId);
    if (!instance || !win || win.isDestroyed() || instance.displayMode !== "expanded") {
      return;
    }
    const bounds = win.getBounds();
    const workArea = electron.screen.getDisplayMatching(bounds).workArea;
    const edge = detectNearestDockEdge(bounds, workArea);
    if (!edge) return;
    this.dockToEdge(instanceId, edge, bounds);
  }
  dockToEdge(instanceId, anchor, fromBounds, options) {
    const instance = this.instanceRepo.find(instanceId);
    const win = this.windows.get(instanceId);
    if (!instance || !win || win.isDestroyed()) {
      throw new Error(`挂件实例不存在: ${instanceId}`);
    }
    const workArea = electron.screen.getDisplayMatching(fromBounds).workArea;
    const expanded = expandedBoundsFromInstance(instance);
    const expandedPosition = options?.preserveExpandedMemory ? { x: expanded.x, y: expanded.y } : {
      x: fromBounds.x,
      y: fromBounds.y
    };
    const label = widgetInstanceDisplayName(instance);
    const dims = stripDimensionsForLabel(anchor, label);
    const stripAlongSize = anchor === "top" || anchor === "bottom" ? dims.width : dims.height;
    const desiredAlong = desiredStripAlongFromBounds(anchor, fromBounds, stripAlongSize);
    const occupied = this.getOccupiedStripsOnEdge(anchor, instanceId);
    const alongEdge = resolveStripAlongEdge(anchor, desiredAlong, stripAlongSize, workArea, occupied);
    const strip = stripBoundsForEdge(anchor, { alongEdge, label }, workArea, dims);
    const updated = this.instanceRepo.update(instanceId, {
      displayMode: "edge_tab",
      edgeAnchor: anchor,
      expandedX: expandedPosition.x,
      expandedY: expandedPosition.y,
      x: strip.x,
      y: strip.y,
      width: strip.width,
      height: strip.height
    });
    this.applyWindowBounds(instanceId, win, strip, false);
    win.show();
    this.notifyDisplayMode(instanceId, updated);
    return updated;
  }
  hideInstance(instanceId) {
    this.clearPeekState(instanceId);
    const win = this.windows.get(instanceId);
    if (win && !win.isDestroyed()) {
      win.hide();
    }
    const updated = this.instanceRepo.update(instanceId, { displayMode: "hidden" });
    this.notifyDisplayMode(instanceId, updated);
    return updated;
  }
  showInstance(instanceId, options) {
    const instance = this.instanceRepo.find(instanceId);
    if (!instance || instance.displayMode === "hidden") return;
    if (instance.displayMode === "expanded") {
      this.expand(instanceId);
      if (!options.focus) {
        this.windows.get(instanceId)?.blur();
      }
      return;
    }
    this.syncWindowToInstance(instanceId, options);
  }
  syncWindowToInstance(instanceId, options) {
    const instance = this.instanceRepo.find(instanceId);
    if (!instance) {
      throw new Error(`挂件实例不存在: ${instanceId}`);
    }
    const win = this.ensureWindow(instanceId);
    const workArea = electron.screen.getDisplayMatching(win.getBounds()).workArea;
    const expanded = expandedBoundsFromInstance(instance);
    let bounds = null;
    if (instance.displayMode === "expanded") {
      bounds = expandedWindowBounds(expanded, workArea);
    } else if (instance.displayMode === "edge_tab") {
      const label = widgetInstanceDisplayName(instance);
      const alongEdge = stripAlongFromInstance(instance.edgeAnchor, instance);
      bounds = stripBoundsForEdge(
        instance.edgeAnchor,
        { alongEdge, label },
        workArea,
        stripDimensionsForLabel(instance.edgeAnchor, label)
      );
    } else if (instance.displayMode === "mini") {
      bounds = boundsForDisplayMode("mini", expanded, instance.edgeAnchor, workArea);
    }
    if (!bounds) {
      return this.hideInstance(instanceId);
    }
    const updated = this.instanceRepo.update(instanceId, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    this.applyWindowBounds(instanceId, win, bounds, instance.displayMode === "expanded");
    win.show();
    if (options.focus) {
      win.focus();
    }
    this.notifyDisplayMode(instanceId, updated);
    return updated;
  }
  applyWindowBounds(instanceId, win, bounds, resizable) {
    this.applyingBounds.add(instanceId);
    win.setResizable(resizable);
    if (resizable) {
      win.setMinimumSize(280, 360);
    } else {
      win.setMinimumSize(bounds.width, bounds.height);
      win.setMaximumSize(bounds.width, bounds.height);
    }
    win.setBounds(bounds);
    if (!resizable) {
      win.setMaximumSize(1e4, 1e4);
    }
    setTimeout(() => this.applyingBounds.delete(instanceId), 80);
  }
  notifyDisplayMode(instanceId, instance) {
    const win = this.windows.get(instanceId);
    if (!win || win.isDestroyed()) return;
    win.webContents.send(IPC.WIDGET_DISPLAY_MODE_CHANGED, instance);
  }
  destroyWindow(id) {
    this.clearPeekState(id);
    for (const map of [this.saveBoundsTimers, this.edgeSnapTimers]) {
      const timer = map.get(id);
      if (timer) {
        clearTimeout(timer);
        map.delete(id);
      }
    }
    this.applyingBounds.delete(id);
    const win = this.windows.get(id);
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.windows.delete(id);
  }
  /** 结束 peek：停止光标监听并返回是否曾在 peek */
  clearPeekState(id) {
    this.stopPeekPointerWatch(id);
    return this.peekingIds.delete(id);
  }
  /**
   * peek 收起以屏幕光标相对窗口 bounds 为准。
   * 标题栏 -webkit-app-region:drag 会让渲染进程误报 mouseleave，不能依赖 DOM leave。
   */
  startPeekPointerWatch(id) {
    this.stopPeekPointerWatch(id);
    const startedAt = Date.now();
    let outsideSince = null;
    this.peekWatchTimers.set(
      id,
      setInterval(() => {
        if (!this.peekingIds.has(id)) {
          this.stopPeekPointerWatch(id);
          return;
        }
        if (Date.now() - startedAt < 400) return;
        const win = this.windows.get(id);
        if (!win || win.isDestroyed()) {
          this.clearPeekState(id);
          return;
        }
        if (this.isCursorInsideWindow(win)) {
          outsideSince = null;
          return;
        }
        if (outsideSince == null) {
          outsideSince = Date.now();
          return;
        }
        if (Date.now() - outsideSince >= 180) {
          this.collapse(id);
        }
      }, 80)
    );
  }
  stopPeekPointerWatch(id) {
    const timer = this.peekWatchTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.peekWatchTimers.delete(id);
    }
  }
  isCursorInsideWindow(win) {
    const cursor = electron.screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    return cursor.x >= bounds.x && cursor.x < bounds.x + bounds.width && cursor.y >= bounds.y && cursor.y < bounds.y + bounds.height;
  }
  scheduleEdgeSnapCheck(instanceId, win) {
    const existing = this.edgeSnapTimers.get(instanceId);
    if (existing) clearTimeout(existing);
    this.edgeSnapTimers.set(
      instanceId,
      setTimeout(() => {
        this.edgeSnapTimers.delete(instanceId);
        if (this.applyingBounds.has(instanceId)) return;
        const instance = this.instanceRepo.find(instanceId);
        if (!instance || instance.displayMode !== "expanded") return;
        this.tryDockFromExpanded(instanceId);
      }, 120)
    );
  }
  ensureWindow(instanceId) {
    const existing = this.windows.get(instanceId);
    if (existing && !existing.isDestroyed()) {
      return existing;
    }
    const instance = this.instanceRepo.find(instanceId);
    if (!instance) {
      throw new Error(`挂件实例不存在: ${instanceId}`);
    }
    const win = new electron.BrowserWindow({
      x: instance.x,
      y: instance.y,
      width: instance.width,
      height: instance.height,
      minWidth: 280,
      minHeight: 360,
      frame: false,
      transparent: false,
      resizable: instance.displayMode === "expanded",
      skipTaskbar: true,
      alwaysOnTop: instance.alwaysOnTop,
      show: false,
      title: instance.name || "小柒todo 挂件",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "../preload/widget.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    const hash = `#${instanceId}`;
    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/widget.html${hash}`);
    } else {
      void win.loadFile(path.join(__dirname, "../renderer/widget.html"), { hash: instanceId });
    }
    win.on("close", (event) => {
      if (!electron.app.isQuitting) {
        event.preventDefault();
        this.hideInstance(instanceId);
      }
    });
    win.on("moved", () => {
      if (this.applyingBounds.has(instanceId)) return;
      const latest = this.instanceRepo.find(instanceId);
      if (latest?.displayMode === "edge_tab") {
        this.scheduleSaveStripPosition(instanceId, win);
        return;
      }
      this.clearPeekState(instanceId);
      this.scheduleSavePosition(instanceId, win);
      this.scheduleEdgeSnapCheck(instanceId, win);
    });
    win.on("resized", () => {
      if (this.applyingBounds.has(instanceId)) return;
      this.scheduleSaveExpandedBounds(instanceId, win);
    });
    win.webContents.on("did-finish-load", () => {
      const latest = this.instanceRepo.find(instanceId);
      if (latest) {
        this.notifyDisplayMode(instanceId, latest);
      }
    });
    this.windows.set(instanceId, win);
    return win;
  }
  /** 贴边细条沿边缘拖动时保存位置 */
  scheduleSaveStripPosition(instanceId, win) {
    const instance = this.instanceRepo.find(instanceId);
    if (!instance || instance.displayMode !== "edge_tab") return;
    const existing = this.saveBoundsTimers.get(instanceId);
    if (existing) clearTimeout(existing);
    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const latest = this.instanceRepo.find(instanceId);
        if (!latest || latest.displayMode !== "edge_tab") return;
        const bounds = win.getBounds();
        const workArea = electron.screen.getDisplayMatching(bounds).workArea;
        const label = widgetInstanceDisplayName(latest);
        const dims = stripDimensionsForLabel(latest.edgeAnchor, label);
        const alongEdge = stripAlongFromInstance(latest.edgeAnchor, bounds);
        const strip = stripBoundsForEdge(
          latest.edgeAnchor,
          { alongEdge, label },
          workArea,
          dims
        );
        this.instanceRepo.update(instanceId, {
          x: strip.x,
          y: strip.y,
          width: strip.width,
          height: strip.height
        });
        if (bounds.x !== strip.x || bounds.y !== strip.y || bounds.width !== strip.width || bounds.height !== strip.height) {
          this.applyWindowBounds(instanceId, win, strip, false);
        }
      }, 200)
    );
  }
  getOccupiedStripsOnEdge(anchor, excludeId) {
    const horizontal = anchor === "top" || anchor === "bottom";
    return this.listInstances().filter(
      (item) => item.id !== excludeId && item.displayMode === "edge_tab" && item.edgeAnchor === anchor
    ).map((item) => ({
      along: stripAlongFromInstance(anchor, item),
      size: horizontal ? item.width : item.height
    }));
  }
  /** 拖动时仅更新展开位置，不改变展开宽高 */
  scheduleSavePosition(instanceId, win) {
    const instance = this.instanceRepo.find(instanceId);
    if (!instance || instance.displayMode !== "expanded") return;
    const existing = this.saveBoundsTimers.get(instanceId);
    if (existing) clearTimeout(existing);
    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const bounds = win.getBounds();
        const expanded = expandedBoundsFromInstance(instance);
        this.instanceRepo.update(instanceId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          expandedX: bounds.x,
          expandedY: bounds.y,
          expandedWidth: expanded.width,
          expandedHeight: expanded.height
        });
      }, 200)
    );
  }
  /** 仅用户手动 resize 时更新展开宽高 */
  scheduleSaveExpandedBounds(instanceId, win) {
    const instance = this.instanceRepo.find(instanceId);
    if (!instance || instance.displayMode !== "expanded") return;
    const existing = this.saveBoundsTimers.get(instanceId);
    if (existing) clearTimeout(existing);
    this.saveBoundsTimers.set(
      instanceId,
      setTimeout(() => {
        const bounds = win.getBounds();
        this.instanceRepo.update(instanceId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          expandedX: bounds.x,
          expandedY: bounds.y,
          expandedWidth: bounds.width,
          expandedHeight: bounds.height
        });
      }, 200)
    );
  }
}
let manager$1 = null;
function getWidgetWindowManager() {
  if (!manager$1) {
    manager$1 = new WidgetWindowManager();
  }
  return manager$1;
}
const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 120;
class QuickCaptureWindowManager {
  window = null;
  lastToggleAt = 0;
  isVisible() {
    return !!this.window && !this.window.isDestroyed() && this.window.isVisible();
  }
  show() {
    const win = this.ensureWindow();
    this.centerWindow(win);
    win.show();
    win.focus();
    win.webContents.send(IPC.CAPTURE_FOCUS);
  }
  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }
  toggle() {
    const now = Date.now();
    if (now - this.lastToggleAt < 280) return;
    this.lastToggleAt = now;
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }
  destroy() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
  centerWindow(win) {
    const display = electron.screen.getPrimaryDisplay();
    const { width: sw, height: sh } = display.workAreaSize;
    const { x: wx, y: wy } = display.workArea;
    win.setBounds({
      x: wx + Math.round((sw - CAPTURE_WIDTH) / 2),
      y: wy + Math.round(sh * 0.2),
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT
    });
  }
  ensureWindow() {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }
    const win = new electron.BrowserWindow({
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: "快捷任务输入",
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "../preload/capture.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/capture.html`);
    } else {
      void win.loadFile(path.join(__dirname, "../renderer/capture.html"));
    }
    win.on("blur", () => {
      setTimeout(() => {
        if (win.isDestroyed() || !win.isVisible()) return;
        if (!win.isFocused()) {
          this.hide();
        }
      }, 120);
    });
    this.window = win;
    return win;
  }
}
let manager = null;
function getQuickCaptureWindowManager() {
  if (!manager) {
    manager = new QuickCaptureWindowManager();
  }
  return manager;
}
let tray = null;
let trayActions = null;
let updateReady = false;
function resolveTrayIconPath() {
  const candidates = [
    path.join(process.resourcesPath, "tray.png"),
    path.join(__dirname, "../../resources/tray.png"),
    path.join(electron.app.getAppPath(), "resources/tray.png")
  ];
  return candidates.find((path2) => fs.existsSync(path2)) ?? null;
}
async function loadTrayImage() {
  const iconPath = resolveTrayIconPath();
  if (iconPath) {
    const image = electron.nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16 });
    }
  }
  try {
    const exeIcon = await electron.app.getFileIcon(process.execPath, { size: "small" });
    if (!exeIcon.isEmpty()) {
      return exeIcon.resize({ width: 16, height: 16 });
    }
  } catch {
  }
  return electron.nativeImage.createEmpty();
}
async function createTray(mainWindow2, actions) {
  const image = await loadTrayImage();
  if (image.isEmpty()) {
    console.warn("[aiTodo] 托盘图标加载失败，托盘可能不可见");
  }
  tray = new electron.Tray(image);
  tray.setToolTip("小柒todo");
  trayActions = actions;
  rebuildTrayMenu(mainWindow2);
  tray.on("double-click", actions.onShow);
  return tray;
}
function rebuildTrayMenu(mainWindow2) {
  if (!tray || !trayActions) return;
  const actions = trayActions;
  const template = [
    { label: "显示主窗口", click: actions.onShow },
    { label: "打开挂件", click: actions.onToggleWidget },
    {
      label: "新建任务",
      click: () => {
        actions.onShow();
        mainWindow2.webContents.send(IPC.APP_ACTION, "newTask");
        actions.onNewTask();
      }
    }
  ];
  if (updateReady && actions.onQuitAndInstallUpdate) {
    template.push({ type: "separator" });
    template.push({
      label: "重启以更新",
      click: () => actions.onQuitAndInstallUpdate?.()
    });
  }
  template.push({ type: "separator" });
  template.push({ label: "退出", click: actions.onQuit });
  tray.setContextMenu(electron.Menu.buildFromTemplate(template));
  tray.setToolTip(updateReady ? "小柒todo（有更新可重启）" : "小柒todo");
}
function setTrayUpdateReady(ready, mainWindow2) {
  updateReady = ready;
  if (mainWindow2) rebuildTrayMenu(mainWindow2);
}
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  trayActions = null;
  updateReady = false;
}
function canAskRenderer(mainWindow2) {
  const wc = mainWindow2.webContents;
  if (wc.isDestroyed() || wc.isCrashed()) return false;
  if (wc.isLoadingMainFrame()) return false;
  const url2 = wc.getURL();
  return Boolean(url2) && url2 !== "about:blank";
}
function bindMinimizeToTray(mainWindow2, deps = {}) {
  const getCloseBehavior = deps.readCloseBehavior ?? readCloseBehavior;
  mainWindow2.on("close", (event) => {
    if (electron.app.isQuitting) {
      return;
    }
    const behavior = getCloseBehavior();
    if (behavior === "quit") {
      markQuitting();
      return;
    }
    if (behavior === "ask" && canAskRenderer(mainWindow2)) {
      event.preventDefault();
      mainWindow2.webContents.send(IPC.APP_CLOSE_REQUEST);
      return;
    }
    event.preventDefault();
    mainWindow2.hide();
  });
}
function markQuitting() {
  electron.app.isQuitting = true;
}
function toggleMainWindow(mainWindow2) {
  if (!mainWindow2 || mainWindow2.isDestroyed()) return;
  if (mainWindow2.isVisible()) {
    mainWindow2.hide();
    return;
  }
  mainWindow2.show();
  mainWindow2.focus();
}
const registered = /* @__PURE__ */ new Map();
function createDefaultShortcutHandlers(getMainWindow) {
  return {
    onAction: (win, action) => {
      win.show();
      win.focus();
      win.webContents.send(IPC.APP_ACTION, action);
    },
    onToggleWidget: () => getWidgetWindowManager().toggle(),
    onQuickCapture: () => getQuickCaptureWindowManager().toggle()
  };
}
function sendAction(win, action, handlers) {
  if (action === "showWindow") {
    toggleMainWindow(win);
    return;
  }
  if (action === "toggleWidget") {
    handlers.onToggleWidget?.();
    return;
  }
  if (action === "quickCapture") {
    handlers.onQuickCapture?.();
    return;
  }
  handlers.onAction(win, action);
}
function registerGlobalShortcuts(win, handlers, bindings) {
  unregisterGlobalShortcuts();
  const map = bindings ?? readShortcutBindings();
  for (const def of SHORTCUT_ACTIONS) {
    if (!def.globalWhenHidden) continue;
    const raw = map[def.id];
    if (!isShortcutBound(raw)) continue;
    const electronAccel = toElectronAccelerator(raw);
    if (registered.has(electronAccel)) {
      console.warn(`[shortcuts] skip duplicate global accelerator: ${electronAccel}`);
      continue;
    }
    const ok = electron.globalShortcut.register(electronAccel, () => {
      sendAction(win, def.id, handlers);
    });
    if (ok) {
      registered.set(electronAccel, def.id);
    } else {
      console.warn(`[shortcuts] failed to register global: ${electronAccel}`);
    }
  }
}
function unregisterGlobalShortcuts() {
  for (const accel of registered.keys()) {
    electron.globalShortcut.unregister(accel);
  }
  registered.clear();
}
function toIpcError(err) {
  if (err instanceof AppError) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  if (err instanceof SyncApiError) {
    return { ok: false, error: { code: "SYNC_API_ERROR", message: err.message } };
  }
  if (err instanceof NotifyApiError) {
    return { ok: false, error: { code: "NOTIFY_API_ERROR", message: err.message } };
  }
  if (err instanceof Error && "code" in err && err.code === "DB_NOT_WRITABLE") {
    return {
      ok: false,
      error: {
        code: "DB_NOT_WRITABLE",
        message: err.message
      }
    };
  }
  const message = err instanceof Error ? err.message : "未知错误";
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}
function wrapIpc(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    return toIpcError(err);
  }
}
async function wrapIpcAsync(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return toIpcError(err);
  }
}
function cloneTaskListFilter(filter) {
  const out = {};
  if (typeof filter.hideDone === "boolean") {
    out.hideDone = filter.hideDone;
  }
  if (filter.hideDoneScope) {
    out.hideDoneScope = filter.hideDoneScope;
  }
  if (filter.smartList) {
    out.smartList = filter.smartList;
  }
  if (filter.status) {
    out.status = filter.status;
  }
  if (filter.search?.trim()) {
    out.search = filter.search.trim();
  }
  if (Object.prototype.hasOwnProperty.call(filter, "categoryId")) {
    out.categoryId = filter.categoryId ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(filter, "parentId")) {
    out.parentId = filter.parentId ?? null;
  }
  if (filter.dateField) {
    out.dateField = filter.dateField;
  }
  if (filter.doneTimeRange) {
    out.doneTimeRange = filter.doneTimeRange;
  }
  if (filter.dateFrom) {
    out.dateFrom = filter.dateFrom;
  }
  if (filter.dateTo) {
    out.dateTo = filter.dateTo;
  }
  return out;
}
const ATTACHMENT_SCHEME = "aitodo-attachment://";
function isImageFileName(name) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}
function attachmentsDir() {
  const dir = path.join(getActiveDataDir(), "attachments");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120) || "file";
}
function saveAttachmentBuffer(name, buffer) {
  const safeName = sanitizeFileName(name);
  const stored = `${uuid.v4()}-${safeName}`;
  const rel = `attachments/${stored}`;
  const dir = attachmentsDir();
  fs.writeFileSync(path.join(dir, stored), buffer);
  return {
    uri: `${ATTACHMENT_SCHEME}${rel}`,
    name: safeName,
    isImage: isImageFileName(safeName)
  };
}
function attachmentRelFromUri(uri) {
  const normalized = decodeURIComponent(uri.trim());
  if (!normalized.startsWith(ATTACHMENT_SCHEME)) {
    return null;
  }
  let rel = normalized.slice(ATTACHMENT_SCHEME.length);
  if (rel.startsWith("/")) {
    rel = rel.slice(1);
  }
  if (rel.startsWith("attachments/") && !rel.includes("..")) {
    return rel;
  }
  try {
    const u = new URL(normalized);
    if (u.protocol === "aitodo-attachment:" && u.hostname === "attachments") {
      const fromHost = `attachments${u.pathname}`;
      if (!fromHost.includes("..")) {
        return fromHost;
      }
    }
  } catch {
  }
  return null;
}
function resolveAttachmentPath(uri) {
  const rel = attachmentRelFromUri(uri);
  if (!rel) {
    return null;
  }
  const full = path.join(getActiveDataDir(), rel);
  if (!fs.existsSync(full)) {
    return null;
  }
  return full;
}
function resolveAttachmentPathFromRequest(requestUrl) {
  const withoutQuery = requestUrl.split(/[?#]/)[0] ?? requestUrl;
  return resolveAttachmentPath(withoutQuery);
}
function resolveAttachmentFileUrl(uri) {
  const full = resolveAttachmentPath(uri);
  if (!full) return null;
  return `file:///${full.replace(/\\/g, "/")}`;
}
async function pickAndSaveAttachment(parent) {
  if (parent && !parent.isDestroyed()) {
    parent.focus();
  }
  const result = await electron.dialog.showOpenDialog(parent ?? void 0, {
    properties: ["openFile"]
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  const src = result.filePaths[0];
  const name = path.basename(src);
  const buffer = fs.readFileSync(src);
  return saveAttachmentBuffer(name, buffer);
}
function openAttachmentPath(uri) {
  const full = resolveAttachmentPath(uri);
  if (!full) {
    throw new Error("附件不存在");
  }
  void electron.shell.openPath(full);
}
async function downloadAttachment(parent, uri, suggestedName) {
  const full = resolveAttachmentPath(uri);
  if (!full) {
    throw new Error("附件不存在");
  }
  if (parent && !parent.isDestroyed()) {
    parent.focus();
  }
  const base = suggestedName?.trim() || path.basename(full);
  const result = await electron.dialog.showSaveDialog(parent ?? void 0, {
    defaultPath: base
  });
  if (result.canceled || !result.filePath) {
    return false;
  }
  fs.copyFileSync(full, result.filePath);
  return true;
}
function openAttachmentUriOrFileUrl(uriOrFile) {
  if (uriOrFile.startsWith("file://")) {
    void electron.shell.openPath(url.fileURLToPath(uriOrFile));
    return;
  }
  openAttachmentPath(uriOrFile);
}
const USER_CONFIG_EXPORT_VERSION = 1;
function buildUserConfigExport(payload) {
  return {
    version: USER_CONFIG_EXPORT_VERSION,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    shortcuts: payload.shortcuts,
    llm: payload.llm,
    aiPrompt: payload.aiPrompt,
    uiPreferences: payload.uiPreferences
  };
}
function parseUserConfigExport(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.version !== USER_CONFIG_EXPORT_VERSION) {
    throw new Error("不支持的配置文件版本");
  }
  if (!parsed.exportedAt) {
    throw new Error("配置文件格式无效");
  }
  return parsed;
}
function buildCurrentUserConfigExport(uiPreferences) {
  return buildUserConfigExport({
    shortcuts: readShortcutBindings(),
    llm: readLlmConfig(),
    aiPrompt: readAiPromptConfig(),
    uiPreferences
  });
}
async function exportUserConfigToFile(parent, uiPreferences) {
  if (parent && !parent.isDestroyed()) {
    parent.focus();
  }
  const result = await electron.dialog.showSaveDialog(parent ?? void 0, {
    title: "导出个人配置",
    defaultPath: `小柒todo-config-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  const payload = buildCurrentUserConfigExport(uiPreferences);
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
  return result.filePath;
}
async function importUserConfigFromFile(parent) {
  if (parent && !parent.isDestroyed()) {
    parent.focus();
  }
  const result = await electron.dialog.showOpenDialog(parent ?? void 0, {
    title: "导入个人配置",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  const raw = fs.readFileSync(result.filePaths[0], "utf-8");
  const parsed = parseUserConfigExport(raw);
  applyUserConfigImport(parsed);
  return { applied: parsed };
}
function applyUserConfigImport(data) {
  if (data.shortcuts) {
    saveShortcutBindings(mergeShortcutBindings(data.shortcuts));
  }
  if (data.llm) {
    saveLlmConfig(mergeLlmConfig(data.llm));
  }
  if (data.aiPrompt) {
    saveAiPromptConfig(mergeAiPromptConfig(data.aiPrompt));
  }
}
const TASK_DATA_EXPORT_VERSION = 1;
const TASK_DATA_EXPORT_KIND = "aitodo-tasks";
function categoryNameById(categories, id) {
  if (!id) return null;
  return categories.find((c) => c.id === id)?.name ?? null;
}
function buildTaskDataExport(payload) {
  const categories = payload.categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    keywords: c.keywords ?? []
  }));
  const kanbanGroups = (payload.kanbanGroups ?? []).map((g) => ({
    id: g.id,
    scopeKey: g.scopeKey,
    name: g.name,
    sortOrder: g.sortOrder
  }));
  const tasks = payload.tasks.filter((t) => !t.deletedAt).map((t) => taskToExportItem(t, payload.categories));
  return {
    kind: TASK_DATA_EXPORT_KIND,
    version: TASK_DATA_EXPORT_VERSION,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    categories,
    kanbanGroups,
    tasks
  };
}
function taskToExportItem(task, categories) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    categoryId: task.categoryId,
    categoryName: categoryNameById(categories, task.categoryId),
    parentId: task.parentId,
    startAt: task.startAt,
    dueAt: task.dueAt,
    remindAt: task.remindAt,
    completedAt: task.completedAt,
    sortOrder: task.sortOrder,
    kanbanGroupId: task.kanbanGroupId,
    tags: task.tags ?? [],
    reminders: task.reminders?.map((r) => ({
      remindAt: r.remindAt,
      offsetMinutes: r.offsetMinutes ?? null
    })),
    recurrence: task.recurrence ?? null,
    completedOccurrenceDates: task.completedOccurrenceDates ?? [],
    remindContinuous: task.remindContinuous ?? false,
    triagedAt: task.triagedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}
const STATUS_LABEL = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  DONE: "已完成"
};
function formatLine(text) {
  return text?.trim() ? text.trim() : "";
}
function tasksToMarkdown(tasks, categories) {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const key = task.categoryId ?? "__none__";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(task);
  }
  const lines = ["# 小柒 Todo 任务导出", ""];
  lines.push(`> 导出时间：${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}`);
  lines.push(`> 任务数：${tasks.length}`);
  lines.push("");
  const keys = [...byCategory.keys()].sort((a, b) => {
    const na = a === "__none__" ? "zzz" : catMap.get(a) ?? a;
    const nb = b === "__none__" ? "zzz" : catMap.get(b) ?? b;
    return na.localeCompare(nb, "zh-CN");
  });
  for (const key of keys) {
    const heading = key === "__none__" ? "未分类" : catMap.get(key) ?? key;
    lines.push(`## ${heading}`, "");
    for (const task of byCategory.get(key) ?? []) {
      const checked = task.status === "DONE" ? "x" : " ";
      lines.push(`- [${checked}] **${task.title}**（${STATUS_LABEL[task.status]}）`);
      if (task.dueAt) lines.push(`  - 截止：${task.dueAt}`);
      if (task.completedAt) lines.push(`  - 完成：${task.completedAt}`);
      if (task.tags?.length) lines.push(`  - 标签：${task.tags.join("、")}`);
      const desc = formatLine(task.description);
      if (desc) {
        lines.push("  - 描述：");
        for (const row of desc.split("\n")) {
          lines.push(`    ${row}`);
        }
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
function parseTaskDataExport(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.kind !== TASK_DATA_EXPORT_KIND) {
    throw new Error("不是有效的任务导出文件");
  }
  if (parsed.version !== TASK_DATA_EXPORT_VERSION) {
    throw new Error("不支持的任务导出版本");
  }
  if (!Array.isArray(parsed.tasks)) {
    throw new Error("任务导出格式无效");
  }
  return parsed;
}
class TaskDataService {
  constructor(taskRepo, categoryRepo, kanbanRepo, tagRepo, reminderRepo, outbox) {
    this.taskRepo = taskRepo;
    this.categoryRepo = categoryRepo;
    this.kanbanRepo = kanbanRepo;
    this.tagRepo = tagRepo;
    this.reminderRepo = reminderRepo;
    this.outbox = outbox;
  }
  withTx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  /** 拉取未删除任务并附带标签、提醒 */
  listExportableTasks() {
    const tasks = this.taskRepo.list({ hideDoneScope: "off", smartList: "all" });
    if (!tasks.length) return tasks;
    const tagMap = this.tagRepo.getTagsByTaskIds(tasks.map((t) => t.id));
    return tasks.map((task) => ({
      ...task,
      tags: tagMap.get(task.id) ?? [],
      reminders: this.reminderRepo.listByTaskId(task.id)
    }));
  }
  listAllKanbanGroups() {
    return this.kanbanRepo.listAll();
  }
  buildExportPayload() {
    const categories = this.categoryRepo.list();
    const tasks = this.listExportableTasks();
    const kanbanGroups = this.listAllKanbanGroups();
    return buildTaskDataExport({ tasks, categories, kanbanGroups });
  }
  async exportJsonToFile(parent) {
    if (parent && !parent.isDestroyed()) parent.focus();
    const result = await electron.dialog.showSaveDialog(parent ?? void 0, {
      title: "导出任务 JSON",
      defaultPath: `小柒todo-tasks-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return null;
    const payload = this.buildExportPayload();
    fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), "utf-8");
    return result.filePath;
  }
  async exportMarkdownToFile(parent) {
    if (parent && !parent.isDestroyed()) parent.focus();
    const result = await electron.dialog.showSaveDialog(parent ?? void 0, {
      title: "导出任务 Markdown",
      defaultPath: `小柒todo-tasks-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.md`,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
    });
    if (result.canceled || !result.filePath) return null;
    const payload = this.buildExportPayload();
    fs.writeFileSync(result.filePath, tasksToMarkdown(payload.tasks, payload.categories), "utf-8");
    return result.filePath;
  }
  async importJsonFromFile(parent) {
    if (parent && !parent.isDestroyed()) parent.focus();
    const result = await electron.dialog.showOpenDialog(parent ?? void 0, {
      title: "导入任务 JSON",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const raw = fs.readFileSync(result.filePaths[0], "utf-8");
    const parsed = parseTaskDataExport(raw);
    return this.applyImport(parsed);
  }
  /** 合并导入：按 id upsert 任务与清单，保留导出文件中的时间戳 */
  applyImport(data) {
    let importedTasks = 0;
    let updatedTasks = 0;
    let importedCategories = 0;
    const skippedTrash = 0;
    return this.withTx(() => {
      const categoryIdByName = /* @__PURE__ */ new Map();
      for (const cat of this.categoryRepo.list()) {
        categoryIdByName.set(cat.name, cat.id);
      }
      for (const item of data.categories ?? []) {
        const existing = this.categoryRepo.findById(item.id);
        const ts = nowIso();
        if (existing) {
          this.categoryRepo.update(item.id, {
            name: item.name,
            color: item.color,
            sortOrder: item.sortOrder,
            keywords: item.keywords ?? [],
            updatedAt: ts
          });
          categoryIdByName.set(item.name, item.id);
        } else {
          const existingNameId = categoryIdByName.get(item.name);
          if (existingNameId) {
            categoryIdByName.set(item.name, existingNameId);
          } else {
            this.categoryRepo.insert({
              id: item.id,
              name: item.name,
              color: item.color,
              sortOrder: item.sortOrder,
              keywords: item.keywords ?? [],
              createdAt: ts,
              updatedAt: ts,
              deletedAt: null
            });
            categoryIdByName.set(item.name, item.id);
            importedCategories += 1;
          }
        }
      }
      for (const g of data.kanbanGroups ?? []) {
        if (this.kanbanRepo.findById(g.id)) {
          this.kanbanRepo.update({
            id: g.id,
            scopeKey: g.scopeKey,
            name: g.name,
            sortOrder: g.sortOrder,
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
        } else {
          this.kanbanRepo.insert({
            id: g.id,
            scopeKey: g.scopeKey,
            name: g.name,
            sortOrder: g.sortOrder,
            createdAt: nowIso(),
            updatedAt: nowIso()
          });
        }
      }
      const sorted = sortTasksForImport(data.tasks);
      for (const item of sorted) {
        const categoryId = resolveCategoryId(item, categoryIdByName);
        const existing = this.taskRepo.findById(item.id);
        const task = buildTaskFromExportItem(item, categoryId);
        if (existing) {
          this.taskRepo.update({
            ...task,
            remindFiredAt: existing.remindFiredAt,
            syncVersion: existing.syncVersion + 1,
            deletedAt: null
          });
          updatedTasks += 1;
        } else {
          this.taskRepo.insert({ ...task, remindFiredAt: null, syncVersion: 1, deletedAt: null });
          importedTasks += 1;
        }
        const tags = normalizeTagNames(item.tags ?? []);
        this.tagRepo.setTaskTags(item.id, tags, nowIso());
        const reminders = normalizeReminders(item);
        this.reminderRepo.replaceForTask(item.id, reminders, nowIso());
      }
      return { importedTasks, updatedTasks, importedCategories, skippedTrash };
    });
  }
}
function sortTasksForImport(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depthCache = /* @__PURE__ */ new Map();
  function depth(id, stack = /* @__PURE__ */ new Set()) {
    if (depthCache.has(id)) return depthCache.get(id);
    if (stack.has(id)) return 0;
    stack.add(id);
    const task = byId.get(id);
    if (!task?.parentId || !byId.has(task.parentId)) {
      depthCache.set(id, 0);
      return 0;
    }
    const d = depth(task.parentId, stack) + 1;
    depthCache.set(id, d);
    return d;
  }
  return [...tasks].sort((a, b) => depth(a.id) - depth(b.id));
}
function resolveCategoryId(item, categoryIdByName) {
  if (item.categoryName && categoryIdByName.has(item.categoryName)) {
    return categoryIdByName.get(item.categoryName);
  }
  if (item.categoryId) {
    return item.categoryId;
  }
  return null;
}
function normalizeReminders(item) {
  if (item.reminders?.length) return item.reminders;
  if (item.remindAt) return [{ remindAt: item.remindAt, offsetMinutes: null }];
  return [];
}
function buildTaskFromExportItem(item, categoryId) {
  const reminders = normalizeReminders(item);
  return {
    id: item.id,
    title: item.title.trim(),
    description: item.description,
    status: item.status,
    priority: coerceTaskPriority(item.priority, DEFAULT_TASK_PRIORITY),
    categoryId,
    parentId: item.parentId,
    startAt: item.startAt,
    dueAt: item.dueAt,
    remindAt: primaryRemindAt(reminders) ?? item.remindAt,
    remindFiredAt: null,
    completedAt: item.completedAt,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletedAt: null,
    syncVersion: 1,
    kanbanGroupId: item.kanbanGroupId,
    recurrence: item.recurrence ?? null,
    completedOccurrenceDates: normalizeCompletedOccurrenceDates(item.completedOccurrenceDates ?? []),
    remindContinuous: item.remindContinuous ?? false,
    tags: normalizeTagNames(item.tags ?? []),
    triagedAt: item.triagedAt
  };
}
async function exportTasksJsonToFile(service, parent) {
  return service.exportJsonToFile(parent);
}
async function exportTasksMarkdownToFile(service, parent) {
  return service.exportMarkdownToFile(parent);
}
async function importTasksJsonFromFile(service, parent) {
  return service.importJsonFromFile(parent);
}
const WEEKDAY_MAP = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0
};
const CN_DIGITS = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12
};
const PERIOD_DEFAULT_HOUR = {
  凌晨: 6,
  早上: 7,
  上午: 9,
  中午: 12,
  下午: 13,
  傍晚: 17,
  晚上: 20,
  今晚: 20,
  夜里: 21
};
function toIso(d) {
  return d.format("YYYY-MM-DDTHH:mm:ss");
}
function parseNumberToken(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed in CN_DIGITS) return CN_DIGITS[trimmed];
  const cnHour = trimmed.match(/^([一二三四五六七八九十]+)点?$/);
  if (cnHour && cnHour[1] in CN_DIGITS) return CN_DIGITS[cnHour[1]];
  return null;
}
function removeParts(text, parts) {
  let working = text;
  for (const part of parts) {
    if (part) working = working.split(part).join(" ");
  }
  return working;
}
function cleanupTitle(raw) {
  return raw.replace(/[，,。；;、]/g, " ").replace(/\s+/g, " ").trim();
}
function nearestWeekday(base, targetDow, hour, minute) {
  let cursor = base.startOf("day");
  for (let i = 0; i < 8; i += 1) {
    const candidate = cursor.day(targetDow).hour(hour).minute(minute).second(0);
    const adjusted = candidate.isBefore(cursor.startOf("day")) ? candidate.add(1, "week") : candidate;
    if (!adjusted.isBefore(base)) return adjusted;
    cursor = cursor.add(1, "day");
  }
  return base.add(1, "week").day(targetDow).hour(hour).minute(minute).second(0);
}
function nearestWorkday(base, hour, minute) {
  let cursor = base.startOf("day");
  for (let i = 0; i < 14; i += 1) {
    const dow = cursor.day();
    if (dow >= 1 && dow <= 5) {
      const candidate = cursor.hour(hour).minute(minute).second(0);
      if (!candidate.isBefore(base)) return candidate;
    }
    cursor = cursor.add(1, "day");
  }
  return base.add(1, "day").hour(hour).minute(0).second(0);
}
function nearestWeekendDay(base, hour, minute) {
  let cursor = base.startOf("day");
  for (let i = 0; i < 14; i += 1) {
    const dow = cursor.day();
    if (dow === 0 || dow === 6) {
      const candidate = cursor.hour(hour).minute(minute).second(0);
      if (!candidate.isBefore(base)) return candidate;
    }
    cursor = cursor.add(1, "day");
  }
  return base.add(1, "day").hour(hour).minute(0).second(0);
}
function endOfMonth(d) {
  return d.endOf("month").startOf("day");
}
function nearestMonthLastDay(base) {
  const thisMonthLast = endOfMonth(base).hour(9).minute(0).second(0);
  if (!thisMonthLast.isBefore(base)) return thisMonthLast;
  return endOfMonth(base.add(1, "month")).hour(9).minute(0).second(0);
}
function resolveBareHour(hour, day, base) {
  const am = day.hour(hour).minute(0).second(0);
  if (!am.isBefore(base)) return am;
  if (hour >= 1 && hour <= 11) {
    const pm = day.hour(hour + 12).minute(0).second(0);
    if (!pm.isBefore(base)) return pm;
  }
  const nextDay = day.add(1, "day");
  const nextAm = nextDay.hour(hour).minute(0).second(0);
  if (!nextAm.isBefore(base)) return nextAm;
  if (hour >= 1 && hour <= 11) {
    return nextDay.hour(hour + 12).minute(0).second(0);
  }
  return nextAm;
}
function resolveDayAnchor(text, base) {
  if (/今天|今日/.test(text)) return base.startOf("day");
  if (/明天|明日/.test(text)) return base.add(1, "day").startOf("day");
  if (/后天/.test(text)) return base.add(2, "day").startOf("day");
  if (/大后天/.test(text)) return base.add(3, "day").startOf("day");
  if (/今晚|夜里/.test(text)) return base.startOf("day");
  const weekday = text.match(/(?:周|星期|礼拜)([一二三四五六日天])/);
  if (weekday) {
    const dow = WEEKDAY_MAP[weekday[1]];
    if (dow != null) return nearestWeekday(base, dow, 9, 0).startOf("day");
  }
  const iso = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})\s*日?/);
  if (iso) {
    const candidate = dayjs(
      `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`
    ).startOf("day");
    return candidate.isValid() ? candidate : null;
  }
  const md = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (md) {
    const month = Number(md[1]);
    const dayNum = Number(md[2]);
    let candidate = base.month(month - 1).date(dayNum).startOf("day");
    if (candidate.isBefore(base.startOf("day"))) {
      candidate = candidate.add(1, "year");
    }
    return candidate;
  }
  const monthOnly = text.match(/(\d{1,2})\s*月(?!\s*\d)/);
  if (monthOnly) {
    const month = Number(monthOnly[1]);
    let candidate = base.month(month - 1).date(1).startOf("day");
    if (candidate.isBefore(base.startOf("day"))) {
      candidate = candidate.add(1, "year");
    }
    return candidate;
  }
  const slash = text.match(/(?:^|[^\d])(\d{1,2})[/-](\d{1,2})(?:[^\d]|$)/);
  if (slash) {
    const month = Number(slash[1]);
    const dayNum = Number(slash[2]);
    let candidate = base.month(month - 1).date(dayNum).startOf("day");
    if (candidate.isBefore(base.startOf("day"))) {
      candidate = candidate.add(1, "year");
    }
    return candidate;
  }
  return null;
}
function resolveClock(text, day, base, rollPastToNextDay) {
  const finalize = (candidate) => {
    if (!rollPastToNextDay) return candidate;
    return candidate.isBefore(base) ? candidate.add(1, "day") : candidate;
  };
  for (const [period, defaultHour] of Object.entries(PERIOD_DEFAULT_HOUR)) {
    if (text.includes(period) && !/\d{1,2}\s*点/.test(text) && !/\d{1,2}:\d{2}/.test(text)) {
      return finalize(day.hour(defaultHour).minute(0).second(0));
    }
  }
  const colon = text.match(/(\d{1,2}):(\d{2})/);
  if (colon) {
    const hour = Number(colon[1]);
    const minute = Number(colon[2]);
    return finalize(day.hour(hour).minute(minute).second(0));
  }
  const half = text.match(
    /(凌晨|早上|上午|下午|晚上|中午|傍晚|今晚|夜里)?\s*(\d{1,2}|[一二三四五六七八九十]+)\s*点半/
  );
  if (half) {
    const hour = parseNumberToken(half[2]) ?? 9;
    let h = hour;
    const period = half[1];
    if (period === "下午" || period === "晚上" || period === "傍晚" || period === "今晚" || period === "夜里") {
      if (h < 12) h += 12;
    } else if (period === "中午" && h <= 12) {
      h = h === 12 ? 12 : h + 12;
    } else if (period === "凌晨" && h === 12) {
      h = 0;
    }
    return finalize(day.hour(h).minute(30).second(0));
  }
  const full = text.match(
    /(凌晨|早上|上午|下午|晚上|中午|傍晚|今晚|夜里)?\s*(\d{1,2}|[一二三四五六七八九十]+)\s*点\s*(\d{1,2})?\s*分?/
  );
  if (full) {
    const hour = parseNumberToken(full[2]) ?? 9;
    const minute = full[3] ? Number(full[3]) : 0;
    let h = hour;
    const period = full[1];
    if (period === "下午" || period === "晚上" || period === "傍晚" || period === "今晚" || period === "夜里") {
      if (h < 12) h += 12;
    } else if (period === "中午") {
      h = h <= 12 ? h === 12 ? 12 : h + 12 : h;
    } else if (period === "凌晨") {
      if (h === 12) h = 0;
    } else if (!period) {
      if (!rollPastToNextDay) {
        return day.hour(hour).minute(minute).second(0);
      }
      return resolveBareHour(hour, day, base).minute(minute).second(0);
    }
    return finalize(day.hour(h).minute(minute).second(0));
  }
  return day.hour(9).minute(0).second(0);
}
function extractDue(text, base) {
  const patterns = [
    /(?:截止|到期|ddl|DDL)\s*(?:于|为|是)?\s*(?:今天|今日|明天|明日|后天|大后天)(?:的)?(?:\s*(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})?/,
    /(?:截止|到期|ddl|DDL)\s*(?:于|为|是)?\s*(?:周|星期|礼拜)[一二三四五六日天](?:\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|点|:|\d{1,2}:\d{2})?)?/,
    /(?:截止|到期|ddl|DDL)\s*(?:于|为|是)?\s*\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)(?:\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|点|:|\d{1,2}:\d{2})?)?/,
    /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}\s*日?(?:\s*(?:\d{1,2}:\d{2}|(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|点)))?/,
    /(?:今天|今日|明天|明日|后天|大后天|今晚)(?:的)?(?:\s*(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})/,
    /(?:今天|今日|明天|明日|后天|大后天|今晚)(?:的)?(?:\s*(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨))/,
    /(?:今晚|夜里)/,
    /(?:周|星期|礼拜)[一二三四五六日天](?:\s*(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)?\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})?/,
    /\d{1,2}\s*月\s*\d{1,2}\s*(?:日|号)(?:\s*(?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨))?\s*(?:\d{1,2}|[一二三四五六七八九十]+)?\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2})?/,
    /\d{1,2}\s*月(?!\s*\d)/,
    /(?:^|[，,\s])((?:早上|上午|下午|晚上|中午|傍晚|今晚|夜里|凌晨)?\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|:|点\s*\d{0,2}\s*分?|\d{1,2}:\d{2}))(?:\s*提醒我)?/,
    /(?:^|[，,\s])(\d{1,2}[/-]\d{1,2})(?:\s*(?:\d{1,2}|[一二三四五六七八九十]+)\s*(?:点半|点))?/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const fragment = match[0];
    const dayAnchor = resolveDayAnchor(fragment, base);
    const day = dayAnchor ?? base.startOf("day");
    const due = resolveClock(fragment, day, base, dayAnchor == null);
    return { dueAt: toIso(due), consumed: [fragment] };
  }
  return { dueAt: null, consumed: [] };
}
function offsetUnitToMinutes(amount, unit) {
  switch (unit) {
    case "分钟":
    case "分":
      return amount;
    case "小时":
      return amount * 60;
    case "天":
      return amount * 24 * 60;
    case "周":
      return amount * 7 * 24 * 60;
    case "个月":
    case "月":
      return amount * 30 * 24 * 60;
    case "年":
      return amount * 365 * 24 * 60;
    default:
      return amount;
  }
}
function extractRelativeAfter(text, base) {
  const compound = text.match(
    /(\d+)\s*小时\s*(\d+)\s*(?:分钟|分)\s*(?:后|之后|以后)/
  );
  if (compound) {
    const due = base.add(Number(compound[1]), "hour").add(Number(compound[2]), "minute");
    return { dueAt: toIso(due), consumed: [compound[0]] };
  }
  const simple = text.match(
    /(\d+)\s*(分钟|分|小时|天|周|个月|月|年)\s*(?:后|之后|以后)/
  );
  if (simple) {
    const minutes = offsetUnitToMinutes(Number(simple[1]), simple[2]);
    const due = base.add(minutes, "minute");
    return { dueAt: toIso(due), consumed: [simple[0]] };
  }
  return { dueAt: null, consumed: [] };
}
function extractRecurrence(text, base) {
  const rules = [
    {
      pattern: /每月最后(?:一)?天/,
      build: () => ({
        recurrence: { type: "monthly" },
        dueAnchor: nearestMonthLastDay(base),
        consumed: [text.match(/每月最后(?:一)?天/)[0]]
      })
    },
    {
      pattern: /每月第(\d+)天/,
      build: (m) => {
        const dayNum = Number(m[1]);
        let anchor = base.date(dayNum).startOf("day");
        if (anchor.isBefore(base.startOf("day"))) anchor = anchor.add(1, "month");
        return {
          recurrence: { type: "monthly" },
          dueAnchor: anchor,
          consumed: [m[0]]
        };
      }
    },
    {
      pattern: /每个工作日|每工作日|工作日重复/,
      build: (m) => ({
        recurrence: { type: "workdays" },
        dueAnchor: nearestWorkday(base, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每周末(?:重复)?/,
      build: (m) => ({
        recurrence: { type: "weekend" },
        dueAnchor: nearestWeekendDay(base, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每年(\d{1,2})月(\d{1,2})日/,
      build: (m) => {
        const month = Number(m[1]);
        const dayNum = Number(m[2]);
        let anchor = base.month(month - 1).date(dayNum).startOf("day");
        if (anchor.isBefore(base.startOf("day"))) anchor = anchor.add(1, "year");
        return {
          recurrence: { type: "yearly" },
          dueAnchor: anchor,
          consumed: [m[0]]
        };
      }
    },
    {
      pattern: /每年(\d{1,2})月/,
      build: (m) => {
        const month = Number(m[1]);
        let anchor = base.month(month - 1).date(1).startOf("day");
        if (anchor.isBefore(base.startOf("day"))) anchor = anchor.add(1, "year");
        return {
          recurrence: { type: "yearly" },
          dueAnchor: anchor,
          consumed: [m[0]]
        };
      }
    },
    {
      pattern: /每(\d+)天/,
      build: (m) => ({
        recurrence: { type: "custom", interval: Number(m[1]), unit: "day" },
        dueAnchor: base.startOf("day").hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每(\d+)周/,
      build: (m) => ({
        recurrence: { type: "custom", interval: Number(m[1]), unit: "week" },
        dueAnchor: nearestWeekday(base, 1, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每(\d+)月/,
      build: (m) => ({
        recurrence: { type: "custom", interval: Number(m[1]), unit: "month" },
        dueAnchor: base.startOf("month").hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每周([一二三四五六日天])/,
      build: (m) => {
        const dow = WEEKDAY_MAP[m[1]];
        return {
          recurrence: { type: "weekly" },
          dueAnchor: nearestWeekday(base, dow ?? 1, 9, 0),
          consumed: [m[0]]
        };
      }
    },
    {
      pattern: /每周/,
      build: (m) => ({
        recurrence: { type: "weekly" },
        dueAnchor: nearestWeekday(base, 1, 9, 0),
        consumed: [m[0]]
      })
    },
    {
      pattern: /每天/,
      build: (m) => ({
        recurrence: { type: "daily" },
        dueAnchor: base.startOf("day").hour(9).minute(0).second(0),
        consumed: [m[0]]
      })
    }
  ];
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (match) return rule.build(match);
  }
  return null;
}
function extractEarlyReminderOffsets(text) {
  const consumed = [];
  const generic = text.match(/(?:提前|提早)提醒我/);
  if (generic) {
    consumed.push(generic[0]);
    return { offsets: [5], consumed };
  }
  if (/(?:提前|提早)半小时/.test(text)) {
    const m = text.match(/(?:提前|提早)半小时/);
    consumed.push(m[0]);
    return { offsets: [30], consumed };
  }
  const unitMatch = text.match(/(?:提前|提早)\s*(\d+)\s*(分钟|分|小时|天|周)/);
  if (unitMatch) {
    consumed.push(unitMatch[0]);
    return { offsets: [offsetUnitToMinutes(Number(unitMatch[1]), unitMatch[2])], consumed };
  }
  const hourMatch = text.match(/(?:提前|提早)\s*(\d+)\s*个?\s*小时/);
  if (hourMatch) {
    consumed.push(hourMatch[0]);
    return { offsets: [Number(hourMatch[1]) * 60], consumed };
  }
  const minMatch = text.match(/(?:提前|提早)\s*(\d+)\s*分钟/);
  if (minMatch) {
    consumed.push(minMatch[0]);
    return { offsets: [Number(minMatch[1])], consumed };
  }
  return { offsets: [], consumed: [] };
}
function extractCategory(text, categories) {
  const consumed = [];
  const explicit = text.match(
    /(?:归到|分到|放入|记在)\s*[「"']?(.+?)[」"']?\s*(?:分类|里|下|类别)/
  );
  if (explicit) {
    const name = explicit[1].trim();
    const hit = categories.find((c) => c.name === name || name.includes(c.name));
    if (hit) {
      consumed.push(explicit[0]);
      return { category: hit, consumed };
    }
  }
  const label = text.match(/分类\s*[：:]\s*[「"']?(.+?)[」"']?(?=[，,。；;\s]|$)/);
  if (label) {
    const name = label[1].trim();
    const hit = categories.find((c) => c.name === name || name.includes(c.name));
    if (hit) {
      consumed.push(label[0]);
      return { category: hit, consumed };
    }
  }
  const sorted = [...categories].sort((a, b) => b.name.length - a.name.length);
  for (const cat of sorted) {
    if (text.includes(cat.name)) {
      consumed.push(cat.name);
      return { category: cat, consumed };
    }
  }
  return { category: null, consumed: [] };
}
function emptyDraft(warnings = []) {
  return {
    title: "",
    dueAt: null,
    remindAt: null,
    reminders: [],
    recurrence: null,
    category: null,
    warnings,
    highlights: []
  };
}
function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}
function markHighlights(source, fragments, kind, highlights) {
  for (const fragment of fragments) {
    if (!fragment?.trim()) continue;
    let searchFrom = 0;
    while (searchFrom < source.length) {
      const idx = source.indexOf(fragment, searchFrom);
      if (idx < 0) break;
      const candidate = { start: idx, end: idx + fragment.length, kind };
      if (!highlights.some((h) => rangesOverlap(h, candidate))) {
        highlights.push(candidate);
        break;
      }
      searchFrom = idx + 1;
    }
  }
}
function parseAiTaskInput(input, options) {
  const warnings = [];
  const base = options.now ?? dayjs();
  let working = input.trim();
  if (!working) {
    return emptyDraft(["请输入任务描述"]);
  }
  let recurrence = null;
  let dueAt = null;
  const recurrenceHit = extractRecurrence(working, base);
  if (recurrenceHit) {
    recurrence = recurrenceHit.recurrence;
    working = removeParts(working, recurrenceHit.consumed);
    if (recurrenceHit.dueAnchor) {
      dueAt = toIso(recurrenceHit.dueAnchor);
    }
  }
  const relativeAfter = extractRelativeAfter(working, base);
  if (relativeAfter.dueAt) {
    dueAt = relativeAfter.dueAt;
    working = removeParts(working, relativeAfter.consumed);
  }
  const earlyReminder = extractEarlyReminderOffsets(working);
  working = removeParts(working, earlyReminder.consumed);
  const dueHit = extractDue(working, base);
  if (dueHit.dueAt) {
    dueAt = dueHit.dueAt;
    working = removeParts(working, dueHit.consumed);
  }
  const wantsRemind = /提醒我|记得提醒|别忘了/.test(input);
  const { category, consumed: catConsumed } = extractCategory(working, options.categories);
  working = removeParts(working, catConsumed);
  let reminders = [];
  if (dueAt && earlyReminder.offsets.length > 0) {
    reminders = buildRemindersFromOffsets(dueAt, earlyReminder.offsets);
  } else if (dueAt && wantsRemind) {
    reminders = buildRemindersFromOffsets(dueAt, [0]);
  }
  working = working.replace(/(?:提前|提早)提醒我/g, " ").replace(/(?:提前|提早)\s*\d+\s*(?:分钟|分|小时|天|周|个半小时)?/g, " ").replace(/提醒我/g, " ").replace(/记得提醒/g, " ").replace(/别忘了/g, " ").replace(/重复/g, " ");
  let title = cleanupTitle(working);
  if (!title) {
    const fallback = input.split(/[，,。]/)[0]?.trim() || input.trim();
    title = fallback.slice(0, 32);
  }
  if (title.length > 200) {
    title = title.slice(0, 200);
    warnings.push("标题过长，已截断至 200 字");
  }
  if (earlyReminder.offsets.length > 0 && !dueAt) {
    warnings.push("已识别提醒提前量，但未识别截止时间，请补充或创建后编辑");
  }
  if (!dueAt && /点|月|日|今天|明天|后天|周|每/.test(input)) {
    warnings.push("未能完全识别时间，创建后可在详情中修改");
  }
  const remindAt = reminders.length ? primaryRemindAt(reminders) : null;
  const highlights = [];
  if (recurrenceHit) markHighlights(input, recurrenceHit.consumed, "recurrence", highlights);
  if (relativeAfter.consumed.length) markHighlights(input, relativeAfter.consumed, "due", highlights);
  if (earlyReminder.consumed.length) markHighlights(input, earlyReminder.consumed, "remind", highlights);
  if (dueHit.consumed.length) markHighlights(input, dueHit.consumed, "due", highlights);
  if (catConsumed.length) markHighlights(input, catConsumed, "category", highlights);
  if (wantsRemind && earlyReminder.consumed.length === 0) {
    for (const phrase of ["记得提醒", "别忘了", "提醒我"]) {
      markHighlights(input, [phrase], "remind", highlights);
    }
  }
  return { title, dueAt, remindAt, reminders, recurrence, category, warnings, highlights };
}
function buildCreateTaskDtoFromParsed(draft, overrides, options) {
  const categoryId = resolveCreateCategoryId(
    options?.rawInput ?? draft.title,
    draft.category?.id,
    overrides?.categoryId,
    options?.parseCategories ?? []
  );
  const dto = {
    ...overrides,
    title: draft.title,
    dueAt: draft.dueAt,
    recurrence: draft.recurrence,
    categoryId
  };
  if (draft.reminders.length > 0) {
    dto.reminders = draft.reminders;
    dto.remindAt = primaryRemindAt(draft.reminders);
  } else if (draft.remindAt) {
    dto.remindAt = draft.remindAt;
  }
  return dto;
}
function toParseCategories(categories) {
  return categories.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    keywords: Array.isArray(c.keywords) ? c.keywords.map((k) => String(k)) : []
  }));
}
function buildQuickCreateTaskDtoFromDraft(draft, rawInput, categories, overrides) {
  const parseCategories = toParseCategories(categories);
  return buildCreateTaskDtoFromParsed(draft, overrides, {
    rawInput: rawInput.trim() || rawInput,
    parseCategories
  });
}
function buildQuickCreateTaskDto(rawInput, categories, overrides) {
  const parseCategories = toParseCategories(categories);
  const trimmed = rawInput.trim();
  const parsed = parseAiTaskInput(trimmed || rawInput, { categories: parseCategories });
  return buildQuickCreateTaskDtoFromDraft(parsed, trimmed || rawInput, categories, overrides);
}
function notePayload(note) {
  return {
    id: note.id,
    content: note.content,
    color: note.color,
    pinned: note.pinned,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}
class WidgetNoteService {
  constructor(repo, taskService, categoryRepo, outbox) {
    this.repo = repo;
    this.taskService = taskService;
    this.categoryRepo = categoryRepo;
    this.outbox = outbox;
  }
  tx(fn) {
    return this.outbox ? this.outbox.runInTransaction(fn) : fn();
  }
  enqueueUpsert(note) {
    this.outbox?.record({
      entityType: "widget_note",
      entityId: note.id,
      operation: "upsert",
      payload: notePayload(note),
      clientSyncVersion: 1
    });
  }
  enqueueDelete(note, ts) {
    this.outbox?.record({
      entityType: "widget_note",
      entityId: note.id,
      operation: "delete",
      payload: { ...notePayload(note), updatedAt: ts, deletedAt: ts },
      clientSyncVersion: 1
    });
  }
  list() {
    return this.repo.listNotes();
  }
  create(dto = {}) {
    return this.tx(() => {
      const note = this.repo.createNote(dto);
      this.enqueueUpsert(note);
      return note;
    });
  }
  update(id, dto) {
    return this.tx(() => {
      const note = this.repo.updateNote(id, dto);
      this.enqueueUpsert(note);
      return note;
    });
  }
  delete(id) {
    this.tx(() => {
      const note = this.repo.findNote(id);
      if (!note) {
        throw new AppError("NOT_FOUND", "便签不存在");
      }
      const ts = nowIso();
      this.repo.deleteNote(id);
      this.enqueueDelete(note, ts);
    });
  }
  /** 将便签转为任务：与快捷添加相同解析逻辑，默认进收件箱（triagedAt = null） */
  convertToTask(noteId, dto = {}) {
    return this.tx(() => {
      const note = this.repo.findNote(noteId);
      if (!note) {
        throw new AppError("NOT_FOUND", "便签不存在");
      }
      const categories = this.categoryRepo.list();
      const createDto = buildQuickCreateTaskDto(note.content, categories, {
        description: note.content.trim() || null,
        triagedAt: null
      });
      if (!createDto.title.trim()) {
        createDto.title = "便签任务";
      }
      const task = this.taskService.create(createDto);
      if (dto.deleteNote !== false) {
        const ts = nowIso();
        this.repo.deleteNote(noteId);
        this.enqueueDelete(note, ts);
      }
      return task;
    });
  }
}
function stripMarkdownFence(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}
function asNullableString(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || t.toLowerCase() === "null") return null;
  return t;
}
function looksLikeLocalIso(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value);
}
function normalizeLocalIso(value) {
  if (!value) return null;
  if (!looksLikeLocalIso(value)) return null;
  return value.length === 16 ? `${value}:00` : value;
}
function matchCategory(name, categories) {
  if (!name) return null;
  const exact = categories.find((c) => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null;
}
function draftFromLlmTaskResponse(rawContent, categories, fallbackTitle) {
  const jsonText = stripMarkdownFence(rawContent);
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("大模型返回不是合法 JSON");
  }
  const title = asNullableString(parsed.title)?.slice(0, 200) || fallbackTitle.trim() || "未命名任务";
  const dueAt = normalizeLocalIso(asNullableString(parsed.dueAt));
  let remindAt = normalizeLocalIso(asNullableString(parsed.remindAt));
  if (remindAt && dueAt && remindAt > dueAt) {
    remindAt = dueAt;
  }
  const category = matchCategory(asNullableString(parsed.categoryName), categories);
  const reminders = remindAt != null ? [{ remindAt, offsetMinutes: null }] : [];
  return {
    title,
    dueAt,
    remindAt: reminders.length > 0 ? primaryRemindAt(reminders) : null,
    reminders,
    recurrence: null,
    category,
    warnings: [],
    highlights: []
  };
}
function parseLocal(text, categories) {
  return parseAiTaskInput(text, { categories });
}
async function parseTaskInputWithConfig(text, categories) {
  const trimmed = text.trim();
  const promptCfg = readAiPromptConfig();
  if (promptCfg.taskParseMode !== "llm") {
    return {
      draft: parseLocal(trimmed || text, categories),
      usedLlm: false,
      fellBackToLocal: false
    };
  }
  const llmCfg = readLlmConfig();
  if (!llmCfg.apiKey.trim()) {
    const draft = parseLocal(trimmed || text, categories);
    draft.warnings = [...draft.warnings, "未配置 API Key，已使用本地解析"];
    return { draft, usedLlm: false, fellBackToLocal: true };
  }
  try {
    const categoryList = categories.map((c) => c.name).join("、") || "（无）";
    const userContent = renderAiUserPrompt(promptCfg.userTemplate, {
      input: trimmed || text,
      today: dayjs().format("YYYY-MM-DD"),
      categories: categoryList
    });
    const raw = await chatCompletion(llmCfg, promptCfg.systemPrompt, userContent);
    const draft = draftFromLlmTaskResponse(raw, categories, trimmed || text);
    return { draft, usedLlm: true, fellBackToLocal: false };
  } catch (err) {
    const draft = parseLocal(trimmed || text, categories);
    const reason = err instanceof Error ? err.message : "未知错误";
    draft.warnings = [...draft.warnings, `大模型解析失败，已回落本地：${reason}`];
    return { draft, usedLlm: false, fellBackToLocal: true };
  }
}
function createIdleUpdateStatus(currentVersion, installShape) {
  return {
    state: "idle",
    currentVersion,
    availableVersion: null,
    installShape,
    feedSource: null,
    progress: null,
    errorMessage: null,
    message: null
  };
}
function envOr(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}
function getUpdateFeedConfig() {
  return {
    gitee: {
      owner: envOr("AITODO_UPDATE_GITEE_OWNER", "GenkiDoudou"),
      repo: envOr("AITODO_UPDATE_GITEE_REPO", "aitodo-desktop")
    },
    github: {
      owner: envOr("AITODO_UPDATE_GITHUB_OWNER", "GenkiDoudou"),
      repo: envOr("AITODO_UPDATE_GITHUB_REPO", "aitodo-desktop")
    }
  };
}
function parseUpdateYml(text) {
  const version = matchField(text, "version");
  const path2 = matchField(text, "path");
  const sha512 = matchField(text, "sha512");
  if (!version || !path2 || !sha512) {
    throw new Error("更新清单缺少 version / path / sha512");
  }
  const parts = [];
  const partRe = /^part:\s*(.+?)\s*$/gm;
  let m;
  while ((m = partRe.exec(text)) !== null) {
    const name = m[1]?.trim();
    if (name) parts.push(name);
  }
  return {
    version: version.trim(),
    path: path2.trim(),
    sha512: sha512.trim(),
    parts
  };
}
function matchField(text, key) {
  const re = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m");
  const m = text.match(re);
  return m?.[1] ?? null;
}
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}
function parseSemver(v) {
  const cleaned = v.trim().replace(/^v/i, "").split("-")[0] ?? "0.0.0";
  const parts = cleaned.split(".").map((p) => Number.parseInt(p, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
const MANIFEST_FILE = {
  nsis: "latest.yml",
  mac: "latest-mac.yml",
  portable: "latest-portable.yml"
};
class FeedResolver {
  config;
  fetchText;
  constructor(options = {}) {
    this.config = options.config ?? getUpdateFeedConfig();
    this.fetchText = options.fetchText ?? defaultFetchText$1;
  }
  async resolve(kind) {
    const errors = [];
    try {
      return await this.resolveFrom("gitee", kind);
    } catch (err) {
      errors.push(`gitee: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      return await this.resolveFrom("github", kind);
    } catch (err) {
      errors.push(`github: ${err instanceof Error ? err.message : String(err)}`);
    }
    throw new Error(`更新源均不可用：${errors.join(" | ")}`);
  }
  async resolveFrom(source, kind) {
    const manifestName = MANIFEST_FILE[kind];
    const { manifestUrl, baseUrl, resolveAsset } = await this.resolveUrls(source, manifestName);
    const text = await this.fetchText(manifestUrl);
    const manifest = parseUpdateYml(text);
    const single = resolveAsset(manifest.path);
    const partUrls = manifest.parts.map((p) => {
      const url2 = resolveAsset(p);
      if (!url2) throw new Error(`更新源缺少分卷 ${p}`);
      return url2;
    });
    if (!single && partUrls.length === 0) {
      throw new Error(`更新源缺少安装包 ${manifest.path}`);
    }
    if (!single && partUrls.length > 0 && manifest.parts.length === 0) {
      throw new Error(`更新源缺少安装包 ${manifest.path}`);
    }
    if (!single && manifest.parts.length > 0 && partUrls.length !== manifest.parts.length) {
      throw new Error(`更新源分卷不完整`);
    }
    return {
      source,
      baseUrl,
      manifest,
      assetUrl: single,
      partUrls: single ? [] : partUrls
    };
  }
  async resolveUrls(source, manifestName) {
    if (source === "github") {
      const { owner: owner2, repo: repo2 } = this.config.github;
      const baseUrl2 = `https://github.com/${owner2}/${repo2}/releases/latest/download/`;
      return {
        baseUrl: baseUrl2,
        manifestUrl: `${baseUrl2}${manifestName}`,
        // GitHub latest/download 对存在的文件直接可下；整包优先
        resolveAsset: (fileName) => `${baseUrl2}${fileName}`
      };
    }
    const { owner, repo } = this.config.gitee;
    const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/releases/latest`;
    const raw = await this.fetchText(apiUrl);
    let release;
    try {
      release = JSON.parse(raw);
    } catch {
      throw new Error("Gitee release JSON 解析失败");
    }
    const assets = release.assets ?? [];
    const manifestAsset = assets.find((a) => a.name === manifestName);
    if (!manifestAsset?.browser_download_url) {
      throw new Error(`Gitee release 缺少 ${manifestName}`);
    }
    const manifestUrl = manifestAsset.browser_download_url;
    const slash = manifestUrl.lastIndexOf("/");
    const baseUrl = slash >= 0 ? manifestUrl.slice(0, slash + 1) : manifestUrl;
    return {
      baseUrl,
      manifestUrl,
      resolveAsset: (fileName) => {
        const hit = assets.find((a) => a.name === fileName);
        return hit?.browser_download_url ?? null;
      }
    };
  }
}
async function defaultFetchText$1(url2) {
  const res = await fetch(url2, {
    headers: { Accept: "application/json, text/plain, */*", "User-Agent": "ai-todo-desktop-updater" }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url2}`);
  }
  return await res.text();
}
function detectInstallShape(input) {
  if (input.platform === "darwin") return "mac";
  if (input.platform !== "win32") {
    return "portable-dir";
  }
  if (!input.isPackaged) {
    return "portable-dir";
  }
  return hasNsisUninstaller(path.dirname(input.execPath)) ? "nsis" : "portable-dir";
}
function hasNsisUninstaller(appDir) {
  if (!fs.existsSync(appDir)) return false;
  let names = [];
  try {
    names = fs.readdirSync(appDir);
  } catch {
    return false;
  }
  return names.some(
    (name) => /^Uninstall .+\.exe$/i.test(name) || /^uninstall\.exe$/i.test(name) || name.toLowerCase() === "uninstall.exe"
  );
}
function resolveAppRootDir(execPath) {
  return path.dirname(execPath);
}
const PORTABLE_DATA_DIR_NAME = "data";
const PORTABLE_STAGING_DIR_NAME = ".aitodo-update-staging";
const PORTABLE_PENDING_FILE_NAME = ".aitodo-update-pending.json";
function portableStagingPath(appRoot) {
  return path.join(path.dirname(appRoot), PORTABLE_STAGING_DIR_NAME);
}
function portablePendingPath(appRoot) {
  return path.join(appRoot, PORTABLE_PENDING_FILE_NAME);
}
class NsisMacUpdater {
  feedResolver;
  kind;
  getCurrentVersion;
  hooks = {};
  bound = false;
  constructor(options) {
    this.feedResolver = options.feedResolver;
    this.kind = options.kind;
    this.getCurrentVersion = options.getCurrentVersion;
  }
  setHooks(hooks) {
    this.hooks = hooks;
  }
  ensureListeners() {
    if (this.bound) return;
    this.bound = true;
    electronUpdater.autoUpdater.autoDownload = true;
    electronUpdater.autoUpdater.autoInstallOnAppQuit = false;
    electronUpdater.autoUpdater.allowDowngrade = false;
    electronUpdater.autoUpdater.on("checking-for-update", () => this.hooks.onChecking?.());
    electronUpdater.autoUpdater.on("update-available", (info) => {
      this.hooks.onAvailable?.(info.version, this.lastSource);
    });
    electronUpdater.autoUpdater.on("update-not-available", () => this.hooks.onUpToDate?.());
    electronUpdater.autoUpdater.on("download-progress", (p) => {
      this.hooks.onProgress?.(Math.round(p.percent));
    });
    electronUpdater.autoUpdater.on("update-downloaded", (info) => {
      this.hooks.onDownloaded?.(info.version);
    });
    electronUpdater.autoUpdater.on("error", (err) => {
      this.hooks.onError?.(err instanceof Error ? err.message : String(err));
    });
  }
  lastSource = "gitee";
  async checkAndDownload() {
    this.ensureListeners();
    const feed = await this.feedResolver.resolve(this.kind);
    this.lastSource = feed.source;
    if (compareSemver(feed.manifest.version, this.getCurrentVersion()) <= 0) {
      this.hooks.onUpToDate?.();
      return;
    }
    this.hooks.onAvailable?.(feed.manifest.version, feed.source);
    electronUpdater.autoUpdater.setFeedURL({ provider: "generic", url: feed.baseUrl });
    await electronUpdater.autoUpdater.checkForUpdates();
  }
  quitAndInstall() {
    electronUpdater.autoUpdater.quitAndInstall(false, true);
  }
}
function withNoAsar(fn) {
  const proc = process;
  const prev = proc.noAsar;
  proc.noAsar = true;
  try {
    return fn();
  } finally {
    proc.noAsar = prev;
  }
}
async function withNoAsarAsync(fn) {
  const proc = process;
  const prev = proc.noAsar;
  proc.noAsar = true;
  try {
    return await fn();
  } finally {
    proc.noAsar = prev;
  }
}
const PORTABLE_PRESERVE_NAMES = /* @__PURE__ */ new Set([
  PORTABLE_DATA_DIR_NAME,
  ".aitodo-update-pending.json",
  ".aitodo-update-staging"
]);
function shouldPreservePortableEntry(name) {
  return PORTABLE_PRESERVE_NAMES.has(name) || name.startsWith(".aitodo-update");
}
function sha512FileBase64(filePath, readFile) {
  const hash = crypto.createHash("sha512");
  hash.update(readFile(filePath));
  return hash.digest("base64");
}
function assertSha512Match(actual, expected) {
  if (actual !== expected) {
    throw new Error("更新包校验失败（sha512 不匹配）");
  }
}
function applyPortableStaging(appRoot, stagingDir) {
  withNoAsar(() => {
    if (!fs.existsSync(stagingDir)) {
      throw new Error(`staging 不存在: ${stagingDir}`);
    }
    const contentRoot = resolveZipContentRoot(stagingDir);
    const names = fs.readdirSync(contentRoot);
    for (const name of names) {
      if (shouldPreservePortableEntry(name)) continue;
      const from = path.join(contentRoot, name);
      const to = path.join(appRoot, name);
      const st = fs.statSync(from);
      if (st.isDirectory()) {
        if (fs.existsSync(to)) {
          fs.rmSync(to, { recursive: true, force: true });
        }
        fs.cpSync(from, to, { recursive: true });
      } else {
        fs.copyFileSync(from, to);
      }
    }
  });
}
function resolveZipContentRoot(stagingDir) {
  const names = fs.readdirSync(stagingDir).filter((n) => n !== "__MACOSX");
  if (names.length === 1) {
    const only = path.join(stagingDir, names[0]);
    if (fs.statSync(only).isDirectory()) {
      const inner = fs.readdirSync(only);
      if (inner.includes("resources") || inner.some((n) => n.endsWith(".exe"))) {
        return only;
      }
    }
  }
  return stagingDir;
}
function ensureEmptyDir(dir) {
  withNoAsar(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  });
}
function removeDirForce(dir) {
  withNoAsar(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
function writePendingMarker(filePath, marker) {
  fs.writeFileSync(filePath, JSON.stringify(marker, null, 2), "utf8");
}
class PortableZipUpdater {
  feedResolver;
  getCurrentVersion;
  getExecPath;
  downloadToFile;
  hooks = {};
  constructor(options) {
    this.feedResolver = options.feedResolver;
    this.getCurrentVersion = options.getCurrentVersion;
    this.getExecPath = options.getExecPath;
    this.downloadToFile = options.downloadToFile ?? defaultDownloadToFile;
  }
  setHooks(hooks) {
    this.hooks = hooks;
  }
  async checkAndDownload() {
    this.hooks.onChecking?.();
    const feed = await this.feedResolver.resolve("portable");
    if (compareSemver(feed.manifest.version, this.getCurrentVersion()) <= 0) {
      this.hooks.onUpToDate?.();
      return;
    }
    this.hooks.onAvailable?.(feed.manifest.version, feed.source);
    const appRoot = resolveAppRootDir(this.getExecPath());
    const stagingDir = portableStagingPath(appRoot);
    ensureEmptyDir(stagingDir);
    const zipPath = path.join(stagingDir, feed.manifest.path);
    try {
      await this.downloadPackage(feed, zipPath);
      const actual = sha512FileBase64(zipPath, (p) => fs.readFileSync(p));
      assertSha512Match(actual, feed.manifest.sha512);
      const extractDir = path.join(stagingDir, "_extracted");
      ensureEmptyDir(extractDir);
      await withNoAsarAsync(() => extractZip(zipPath, { dir: extractDir }));
      fs.rmSync(zipPath, { force: true });
      for (const name of feed.manifest.parts) {
        fs.rmSync(path.join(stagingDir, name), { force: true });
      }
      const marker = {
        version: feed.manifest.version,
        stagingDir: extractDir,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      writePendingMarker(portablePendingPath(appRoot), marker);
      this.hooks.onReady?.(feed.manifest.version, feed.source);
    } catch (err) {
      try {
        removeDirForce(stagingDir);
        fs.rmSync(portablePendingPath(appRoot), { force: true });
      } catch {
      }
      throw err;
    }
  }
  async downloadPackage(feed, zipPath) {
    if (feed.assetUrl) {
      await this.downloadToFile(feed.assetUrl, zipPath, (p) => this.hooks.onProgress?.(p));
      return;
    }
    if (!feed.partUrls.length) {
      throw new Error("更新源既无完整包也无分卷");
    }
    const stagingDir = path.join(zipPath, "..");
    const partFiles = [];
    const total = feed.partUrls.length;
    for (let i = 0; i < feed.partUrls.length; i++) {
      const url2 = feed.partUrls[i];
      const partName = feed.manifest.parts[i] ?? `part-${i + 1}`;
      const partPath = path.join(stagingDir, partName);
      await this.downloadToFile(url2, partPath, (p) => {
        const overall = Math.round((i + p / 100) / total * 100);
        this.hooks.onProgress?.(overall);
      });
      partFiles.push(partPath);
    }
    await concatFiles(partFiles, zipPath);
    this.hooks.onProgress?.(100);
  }
  /** 启动时若有 pending，则应用并清理；失败抛错且不删用户 data */
  static applyPendingIfAny(execPath) {
    const appRoot = resolveAppRootDir(execPath);
    const pendingFile = portablePendingPath(appRoot);
    if (!fs.existsSync(pendingFile)) return { applied: false };
    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(pendingFile, "utf8"));
    } catch {
      fs.rmSync(pendingFile, { force: true });
      return { applied: false };
    }
    applyPortableStaging(appRoot, marker.stagingDir);
    fs.rmSync(pendingFile, { force: true });
    const stagingParent = portableStagingPath(appRoot);
    removeDirForce(stagingParent);
    return { applied: true, version: marker.version };
  }
}
async function concatFiles(partPaths, outPath) {
  fs.mkdirSync(path.join(outPath, ".."), { recursive: true });
  const out = fs.createWriteStream(outPath);
  for (const part of partPaths) {
    const data = fs.readFileSync(part);
    const ok = out.write(data);
    if (!ok) {
      await new Promise((resolve) => out.once("drain", resolve));
    }
  }
  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });
}
async function defaultDownloadToFile(url2, destPath, onProgress) {
  const res = await fetch(url2, { headers: { "User-Agent": "ai-todo-desktop-updater" } });
  if (!res.ok) {
    throw new Error(`下载失败 HTTP ${res.status}`);
  }
  onProgress?.(10);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.join(destPath, ".."), { recursive: true });
  fs.writeFileSync(destPath, buf);
  onProgress?.(100);
}
const AUTO_CHECK_DELAY_MS = 8e3;
class UpdateOrchestrator {
  status;
  listeners = /* @__PURE__ */ new Set();
  feedResolver;
  installShape;
  nsisMac = null;
  portable = null;
  autoCheckTimer = null;
  busy = false;
  getMainWindow = () => null;
  constructor(options) {
    this.feedResolver = options?.feedResolver ?? new FeedResolver();
    this.installShape = detectInstallShape({
      platform: process.platform,
      isPackaged: electron.app.isPackaged,
      execPath: process.execPath
    });
    this.status = createIdleUpdateStatus(electron.app.getVersion(), this.installShape);
    this.initBackends();
  }
  initBackends() {
    if (this.installShape === "portable-dir") {
      this.portable = new PortableZipUpdater({
        feedResolver: this.feedResolver,
        getCurrentVersion: () => electron.app.getVersion(),
        getExecPath: () => process.execPath
      });
      this.portable.setHooks({
        onChecking: () => this.patch({ state: "checking", errorMessage: null, message: "正在检查更新…" }),
        onAvailable: (version, source) => this.patch({
          state: "available",
          availableVersion: version,
          feedSource: source,
          message: `发现新版本 ${version}`
        }),
        onProgress: (progress) => this.patch({ state: "downloading", progress }),
        onReady: (version, source) => {
          this.patch({
            state: "ready",
            availableVersion: version,
            feedSource: source,
            progress: 100,
            message: "更新已下载，重启后生效"
          });
          this.notifyReady();
        },
        onUpToDate: () => this.patch({
          state: "up-to-date",
          availableVersion: null,
          progress: null,
          message: "已是最新版本"
        }),
        onError: (errorMessage) => this.patch({ state: "error", errorMessage, message: null })
      });
      return;
    }
    this.nsisMac = new NsisMacUpdater({
      feedResolver: this.feedResolver,
      kind: this.installShape === "mac" ? "mac" : "nsis",
      getCurrentVersion: () => electron.app.getVersion()
    });
    this.nsisMac.setHooks({
      onChecking: () => this.patch({ state: "checking", errorMessage: null, message: "正在检查更新…" }),
      onAvailable: (version, source) => this.patch({
        state: "available",
        availableVersion: version,
        feedSource: source,
        message: `发现新版本 ${version}`
      }),
      onProgress: (progress) => this.patch({ state: "downloading", progress }),
      onDownloaded: (version) => {
        this.patch({
          state: "ready",
          availableVersion: version,
          progress: 100,
          message: "更新已下载，重启后生效"
        });
        this.notifyReady();
      },
      onUpToDate: () => this.patch({
        state: "up-to-date",
        availableVersion: null,
        progress: null,
        message: "已是最新版本"
      }),
      onError: (errorMessage) => this.patch({ state: "error", errorMessage, message: null })
    });
  }
  setMainWindowGetter(getter) {
    this.getMainWindow = getter;
  }
  getStatus() {
    return { ...this.status };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }
  /** 启动后延迟自动检查；dev / 未打包不下载 */
  scheduleAutoCheck() {
    if (!electron.app.isPackaged) return;
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = setTimeout(() => {
      void this.checkForUpdates({ manual: false });
    }, AUTO_CHECK_DELAY_MS);
  }
  async checkForUpdates(options) {
    const manual = options?.manual === true;
    if (!electron.app.isPackaged) {
      this.patch({
        state: "up-to-date",
        message: manual ? "开发模式不检查线上更新" : null,
        errorMessage: null
      });
      return this.getStatus();
    }
    if (this.busy) return this.getStatus();
    this.busy = true;
    try {
      if (this.portable) {
        await this.portable.checkAndDownload();
      } else if (this.nsisMac) {
        await this.nsisMac.checkAndDownload();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.patch({ state: "error", errorMessage, message: null });
      if (!manual) {
        console.warn("[aiTodo] 自动检查更新失败", errorMessage);
      }
    } finally {
      this.busy = false;
    }
    return this.getStatus();
  }
  quitAndInstall() {
    if (this.status.state !== "ready") {
      throw new Error("当前没有待安装的更新");
    }
    this.patch({ state: "applying", message: "正在应用更新…" });
    if (this.installShape === "portable-dir") {
      electron.app.relaunch();
      electron.app.exit(0);
      return;
    }
    this.nsisMac?.quitAndInstall();
  }
  notifyReady() {
    try {
      if (electron.Notification.isSupported()) {
        const n = new electron.Notification({
          title: "小柒todo",
          body: `新版本 ${this.status.availableVersion ?? ""} 已就绪，可重启更新`
        });
        n.on("click", () => {
          const win = this.getMainWindow();
          win?.show();
          win?.focus();
          win?.webContents.send(IPC.APP_NAVIGATE, "/settings?section=about");
        });
        n.show();
      }
    } catch {
    }
  }
  patch(partial) {
    this.status = { ...this.status, ...partial };
    const snap = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
      }
    }
    const win = this.getMainWindow();
    win?.webContents.send(IPC.APP_UPDATE_STATUS, snap);
  }
}
let singleton = null;
function getUpdateOrchestrator() {
  if (!singleton) singleton = new UpdateOrchestrator();
  return singleton;
}
function applyPortableUpdateIfPending() {
  if (process.platform !== "win32" || !electron.app.isPackaged) return;
  try {
    const result = PortableZipUpdater.applyPendingIfAny(process.execPath);
    if (result.applied) {
      console.log("[aiTodo] 已应用免解压更新", result.version);
    }
  } catch (err) {
    console.error("[aiTodo] 免解压更新应用失败，继续使用当前版本", err);
  }
}
function defaultFetchText(url2) {
  return fetch(url2, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ai-todo-desktop-changelog"
    }
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url2}`);
    return res.text();
  });
}
function normalizeItems(raw, limit) {
  if (!Array.isArray(raw)) throw new Error("Release 列表格式无效");
  const items = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry;
    const tag = typeof r.tag_name === "string" ? r.tag_name.trim() : "";
    if (!tag) continue;
    const title = typeof r.name === "string" && r.name.trim() ? r.name.trim() : tag;
    const body = typeof r.body === "string" ? r.body.trim() : "";
    items.push({
      tag,
      title,
      body: body || "（本版本未填写发版说明）",
      publishedAt: r.published_at ?? r.created_at ?? null,
      htmlUrl: r.html_url ?? r.url ?? null
    });
    if (items.length >= limit) break;
  }
  return items;
}
function releasesApiUrl(source, config, limit) {
  if (source === "gitee") {
    const { owner: owner2, repo: repo2 } = config.gitee;
    return `https://gitee.com/api/v5/repos/${owner2}/${repo2}/releases?per_page=${limit}&page=1`;
  }
  const { owner, repo } = config.github;
  return `https://api.github.com/repos/${owner}/${repo}/releases?per_page=${limit}&page=1`;
}
async function fetchFrom(source, config, fetchText, limit) {
  const url2 = releasesApiUrl(source, config, limit);
  const text = await fetchText(url2);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${source} Release JSON 解析失败`);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const msg = parsed.message;
    throw new Error(msg ? `${source}: ${msg}` : `${source} Release 响应无效`);
  }
  const items = normalizeItems(parsed, limit);
  if (items.length === 0) throw new Error(`${source} 暂无 Release`);
  return { source, items };
}
async function fetchReleaseChangelog(options = {}) {
  const config = options.config ?? getUpdateFeedConfig();
  const fetchText = options.fetchText ?? defaultFetchText;
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 30);
  const errors = [];
  try {
    return await fetchFrom("gitee", config, fetchText, limit);
  } catch (err) {
    errors.push(`gitee: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    return await fetchFrom("github", config, fetchText, limit);
  } catch (err) {
    errors.push(`github: ${err instanceof Error ? err.message : String(err)}`);
  }
  throw new Error(`无法获取更新日志：${errors.join(" | ")}`);
}
function services() {
  const db = getDatabase();
  const taskRepo = new TaskRepository(db);
  const tagRepo = new TagRepository(db);
  const categoryRepo = new CategoryRepository(db);
  const kanbanRepo = new KanbanGroupRepository(db);
  const messageRepo = new AppMessageRepository(db);
  const reminderRepo = new TaskReminderRepository(db);
  const summaryRepo = new ScheduledSummaryRepository(db);
  const viewRepo = new TaskViewRepository(db);
  const activityRepo = new TaskActivityRepository(db);
  const activityService = new TaskActivityService(activityRepo);
  const activityRecorder = new TaskActivityRecorder(categoryRepo, kanbanRepo);
  const widgetNoteRepo = new WidgetNoteRepository(db);
  const syncOutbox = new SyncOutbox(db);
  const taskService = new TaskService(
    taskRepo,
    reminderRepo,
    tagRepo,
    activityService,
    activityRecorder,
    syncOutbox
  );
  return {
    tasks: taskService,
    tags: tagRepo,
    categories: new CategoryService(categoryRepo, syncOutbox),
    kanbanGroups: new KanbanGroupService(kanbanRepo),
    taskData: new TaskDataService(
      taskRepo,
      categoryRepo,
      kanbanRepo,
      tagRepo,
      reminderRepo,
      syncOutbox
    ),
    messages: new AppMessageService(
      messageRepo,
      syncOutbox,
      () => readSyncPreferences(getActiveDataDir())
    ),
    scheduledSummaries: new ScheduledSummaryService(summaryRepo, taskRepo, categoryRepo, syncOutbox),
    taskViews: new TaskViewService(viewRepo, taskRepo, syncOutbox),
    taskActivities: activityService,
    widgetNotes: new WidgetNoteService(widgetNoteRepo, taskService, categoryRepo, syncOutbox),
    widgetSettings: widgetNoteRepo,
    syncOutbox
  };
}
let getMainWindowRef = () => null;
function pushAppMessageToRenderer(message, opts) {
  getMainWindowRef()?.webContents.send(IPC.APP_MESSAGE_PUSH, message);
  if (opts?.skipExternalNotify) return;
  if (message.kind !== "notification") return;
  const event = message.source === "task_reminder" ? "task_reminder" : message.source === "scheduled_summary" ? "scheduled_summary" : null;
  if (!event) return;
  let title = event === "task_reminder" ? "任务提醒" : message.title.replace(/^定时汇总：/, "").trim() || "定时汇总";
  let body = (message.body ?? message.title).trim();
  if (event === "task_reminder" && message.taskId) {
    try {
      const task = new TaskRepository(getDatabase()).findById(message.taskId);
      if (task) {
        const copy = buildTaskReminderExternalCopy(task);
        title = copy.title;
        body = copy.body;
      } else if (message.body) {
        title = message.body.trim();
        body = message.body.trim();
      }
    } catch {
    }
  }
  void getNotifyRuntime(
    () => getDatabase(),
    () => getActiveDataDir()
  ).dispatcher().dispatch({
    event,
    title,
    body,
    entityId: message.taskId ?? message.id
  }).catch((err) => console.error("[notify] dispatch failed", err));
}
let summarySchedulerRef = null;
function setSummarySchedulerService(scheduler) {
  summarySchedulerRef = scheduler;
}
let holidayServiceRef = null;
function setHolidayService(service) {
  holidayServiceRef = service;
}
function registerIpcHandlers(getMainWindow) {
  getMainWindowRef = getMainWindow;
  electron.ipcMain.handle(
    IPC.TASKS_LIST,
    (_e, filter) => wrapIpc(() => services().tasks.list(cloneTaskListFilter(filter ?? {})))
  );
  electron.ipcMain.handle(IPC.TASKS_GET, (_e, id) => wrapIpc(() => services().tasks.get(id)));
  electron.ipcMain.handle(
    IPC.TASKS_GET_IN_TRASH,
    (_e, id) => wrapIpc(() => services().tasks.getInTrash(id))
  );
  electron.ipcMain.handle(
    IPC.TASKS_CREATE,
    (_e, dto) => wrapIpc(() => services().tasks.create(dto))
  );
  electron.ipcMain.handle(
    IPC.TASKS_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().tasks.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.TASKS_DELETE,
    (_e, id, options) => wrapIpc(() => {
      services().tasks.delete(id, options);
      return void 0;
    })
  );
  electron.ipcMain.handle(IPC.TASKS_RESTORE, (_e, id) => wrapIpc(() => services().tasks.restore(id)));
  electron.ipcMain.handle(
    IPC.TASKS_PERMANENT_DELETE,
    (_e, id, options) => wrapIpc(() => {
      services().tasks.permanentDelete(id, options);
      return void 0;
    })
  );
  electron.ipcMain.handle(IPC.TASKS_EMPTY_TRASH, () => wrapIpc(() => services().tasks.emptyTrash()));
  electron.ipcMain.handle(IPC.TASKS_COUNT_TRASH, () => wrapIpc(() => services().tasks.countTrash()));
  electron.ipcMain.handle(IPC.TASKS_COUNT_DONE, () => wrapIpc(() => services().tasks.countDone()));
  electron.ipcMain.handle(
    IPC.TASKS_REORDER,
    (_e, ids) => wrapIpc(() => services().tasks.reorder(ids ?? []))
  );
  electron.ipcMain.handle(
    IPC.KANBAN_GROUPS_LIST,
    (_e, scopeKey) => wrapIpc(() => services().kanbanGroups.listBoard(scopeKey))
  );
  electron.ipcMain.handle(
    IPC.KANBAN_GROUPS_CREATE,
    (_e, dto) => wrapIpc(() => services().kanbanGroups.create(dto))
  );
  electron.ipcMain.handle(
    IPC.KANBAN_GROUPS_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().kanbanGroups.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.KANBAN_GROUPS_DELETE,
    (_e, id) => wrapIpc(() => {
      services().kanbanGroups.delete(id);
      return void 0;
    })
  );
  electron.ipcMain.handle(
    IPC.MESSAGES_LIST,
    (_e, kind, source) => wrapIpc(() => services().messages.list(kind, source))
  );
  electron.ipcMain.handle(
    IPC.MESSAGES_COUNT_UNREAD,
    (_e, kind) => wrapIpc(() => services().messages.countUnread(kind))
  );
  electron.ipcMain.handle(
    IPC.MESSAGES_MARK_READ,
    (_e, id) => wrapIpc(() => services().messages.markRead(id))
  );
  electron.ipcMain.handle(
    IPC.MESSAGES_MARK_ALL_READ,
    (_e, kind) => wrapIpc(() => services().messages.markAllRead(kind))
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_LIST,
    () => wrapIpc(() => services().scheduledSummaries.list())
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_CREATE,
    (_e, dto) => wrapIpc(() => services().scheduledSummaries.create(dto))
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().scheduledSummaries.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_DELETE,
    (_e, id) => wrapIpc(() => {
      services().scheduledSummaries.delete(id);
      return void 0;
    })
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_PREVIEW,
    (_e, dto) => wrapIpcAsync(() => services().scheduledSummaries.previewSummaryBody(dto))
  );
  electron.ipcMain.handle(
    IPC.SCHEDULED_SUMMARIES_RUN_NOW,
    (_e, id) => wrapIpcAsync(async () => {
      if (!summarySchedulerRef) {
        throw new AppError("INTERNAL_ERROR", "汇总调度器尚未就绪，请稍后重试");
      }
      return summarySchedulerRef.runNow(id);
    })
  );
  electron.ipcMain.handle(IPC.CATEGORIES_LIST, () => wrapIpc(() => services().categories.list()));
  electron.ipcMain.handle(
    IPC.CATEGORIES_CREATE,
    (_e, dto) => wrapIpc(() => services().categories.create(dto))
  );
  electron.ipcMain.handle(
    IPC.CATEGORIES_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().categories.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.CATEGORIES_DELETE,
    (_e, id) => wrapIpc(() => {
      services().categories.delete(id);
      return void 0;
    })
  );
  electron.ipcMain.handle(
    IPC.CATEGORIES_REORDER,
    (_e, ids) => wrapIpc(() => services().categories.reorder(ids ?? []))
  );
  electron.ipcMain.handle(IPC.TAGS_LIST, () => wrapIpc(() => services().tags.listAllNames()));
  electron.ipcMain.handle(IPC.APP_GET_DATA_PATH, () => wrapIpc(() => getActiveDataDir()));
  electron.ipcMain.handle(
    IPC.APP_SET_DATA_PATH,
    (_e, newPath) => wrapIpc(() => {
      const source = getActiveDataDir();
      closeDatabase();
      const pendingPath = relocateDataDir(newPath, { sourceDir: source });
      setImmediate(() => {
        markQuitting();
        electron.app.relaunch();
        electron.app.exit(0);
      });
      return { requiresRestart: true, pendingPath, migrated: true };
    })
  );
  electron.ipcMain.handle(IPC.APP_GET_VERSION, () => wrapIpc(() => electron.app.getVersion()));
  electron.ipcMain.handle(
    IPC.APP_GET_INFO,
    () => wrapIpc(() => {
      const dataPath = getActiveDataDir();
      return {
        version: electron.app.getVersion(),
        dataPath,
        defaultDataPath: getDefaultDataDir(),
        writable: isDirectoryWritable(dataPath)
      };
    })
  );
  electron.ipcMain.handle(
    IPC.APP_PICK_DATA_DIR,
    async () => wrapIpcAsync(async () => {
      const win = getMainWindow();
      const result = win && !win.isDestroyed() ? await electron.dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] }) : await electron.dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
      if (result.canceled || !result.filePaths[0]) {
        return null;
      }
      return result.filePaths[0];
    })
  );
  electron.ipcMain.handle(
    IPC.APP_EXPORT_USER_CONFIG,
    async (_e, uiPreferences) => wrapIpcAsync(() => exportUserConfigToFile(getMainWindow() ?? void 0, uiPreferences))
  );
  electron.ipcMain.handle(
    IPC.APP_IMPORT_USER_CONFIG,
    async () => wrapIpcAsync(async () => {
      const result = await importUserConfigFromFile(getMainWindow() ?? void 0);
      if (!result) return null;
      const win = getMainWindow();
      if (win && result.applied.shortcuts) {
        registerGlobalShortcuts(
          win,
          createDefaultShortcutHandlers(getMainWindow),
          mergeShortcutBindings(result.applied.shortcuts)
        );
      }
      return result;
    })
  );
  electron.ipcMain.handle(
    IPC.APP_EXPORT_TASKS_JSON,
    async () => wrapIpcAsync(() => exportTasksJsonToFile(services().taskData, getMainWindow() ?? void 0))
  );
  electron.ipcMain.handle(
    IPC.APP_EXPORT_TASKS_MARKDOWN,
    async () => wrapIpcAsync(() => exportTasksMarkdownToFile(services().taskData, getMainWindow() ?? void 0))
  );
  electron.ipcMain.handle(
    IPC.APP_IMPORT_TASKS_JSON,
    async () => wrapIpcAsync(() => importTasksJsonFromFile(services().taskData, getMainWindow() ?? void 0))
  );
  electron.ipcMain.handle(IPC.APP_GET_SHORTCUTS, () => wrapIpc(() => readShortcutBindings()));
  electron.ipcMain.handle(
    IPC.APP_SET_SHORTCUTS,
    (_e, bindings) => wrapIpc(() => {
      const conflicts = findShortcutConflicts(bindings);
      if (conflicts.size > 0) {
        const first = [...conflicts.entries()][0];
        const [accel, ids] = first;
        throw new AppError(
          "SHORTCUT_CONFLICT",
          formatShortcutConflictMessage(accel, ids)
        );
      }
      saveShortcutBindings(bindings);
      notifyAppSettingsChanged();
      const win = getMainWindow();
      if (win) {
        registerGlobalShortcuts(win, createDefaultShortcutHandlers(getMainWindow), bindings);
      }
      return bindings;
    })
  );
  electron.ipcMain.handle(IPC.APP_GET_LLM_CONFIG, () => wrapIpc(() => readLlmConfig()));
  electron.ipcMain.handle(
    IPC.APP_SET_LLM_CONFIG,
    (_e, config) => wrapIpc(() => {
      saveLlmConfig(config);
      notifyAppSettingsChanged();
      return readLlmConfig();
    })
  );
  electron.ipcMain.handle(IPC.APP_GET_AI_PROMPT, () => wrapIpc(() => readAiPromptConfig()));
  electron.ipcMain.handle(
    IPC.APP_SET_AI_PROMPT,
    (_e, config) => wrapIpc(() => {
      saveAiPromptConfig(config);
      notifyAppSettingsChanged();
      return readAiPromptConfig();
    })
  );
  electron.ipcMain.handle(
    IPC.APP_PARSE_TASK_INPUT,
    (_e, text, categories) => wrapIpcAsync(() => parseTaskInputWithConfig(text ?? "", categories ?? []))
  );
  electron.ipcMain.handle(IPC.APP_GET_CLOSE_BEHAVIOR, () => wrapIpc(() => readCloseBehavior()));
  electron.ipcMain.handle(
    IPC.APP_SET_CLOSE_BEHAVIOR,
    (_e, behavior) => wrapIpc(() => {
      saveCloseBehavior(behavior);
      notifyAppSettingsChanged();
      return readCloseBehavior();
    })
  );
  electron.ipcMain.handle(
    IPC.APP_GET_LAUNCH_AT_LOGIN,
    () => wrapIpc(() => {
      const local = readLaunchAtLoginPrefs();
      const { prefs, syncedFromSystem } = reconcileLaunchAtLoginPrefs(local, electron.app);
      if (syncedFromSystem) {
        saveLaunchAtLoginPrefs(prefs);
      }
      return {
        ...prefs,
        packaged: electron.app.isPackaged,
        syncedFromSystem
      };
    })
  );
  electron.ipcMain.handle(
    IPC.APP_SET_LAUNCH_AT_LOGIN,
    (_e, prefs) => wrapIpc(() => {
      const merged = mergeLaunchAtLoginPrefs(prefs);
      try {
        applyLaunchAtLoginToSystem(merged, electron.app);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "设置开机自启失败");
      }
      saveLaunchAtLoginPrefs(merged);
      notifyAppSettingsChanged();
      return merged;
    })
  );
  electron.ipcMain.handle(
    IPC.APP_CONFIRM_CLOSE,
    (_e, payload) => wrapIpc(() => {
      if (payload?.behavior !== "tray" && payload?.behavior !== "quit") {
        throw new AppError("VALIDATION_ERROR", "未知关闭行为");
      }
      if (payload.remember) {
        saveCloseBehavior(payload.behavior);
      }
      const win = getMainWindow();
      if (payload.behavior === "tray") {
        win?.hide();
        return void 0;
      }
      markQuitting();
      electron.app.quit();
      return void 0;
    })
  );
  electron.ipcMain.handle(
    IPC.APP_SHOW_WINDOW,
    () => wrapIpc(() => {
      toggleMainWindow(getMainWindow());
    })
  );
  electron.ipcMain.handle(
    IPC.APP_PICK_ATTACHMENT,
    async () => wrapIpcAsync(() => pickAndSaveAttachment(getMainWindow() ?? void 0))
  );
  electron.ipcMain.handle(
    IPC.APP_SAVE_ATTACHMENT,
    (_e, dto) => wrapIpc(() => saveAttachmentBuffer(dto.name, Buffer.from(dto.base64, "base64")))
  );
  electron.ipcMain.handle(
    IPC.APP_RESOLVE_ATTACHMENT_URL,
    (_e, uri) => wrapIpc(() => resolveAttachmentFileUrl(uri))
  );
  electron.ipcMain.handle(
    IPC.APP_OPEN_ATTACHMENT,
    (_e, uri) => wrapIpc(() => {
      openAttachmentUriOrFileUrl(uri);
      return void 0;
    })
  );
  electron.ipcMain.handle(
    IPC.APP_DOWNLOAD_ATTACHMENT,
    async (_e, uri, suggestedName) => wrapIpcAsync(() => downloadAttachment(getMainWindow() ?? void 0, uri, suggestedName))
  );
  electron.ipcMain.handle(
    IPC.HOLIDAYS_CALENDAR_MARKS,
    async (_e, years) => wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError("INTERNAL", "节假日服务未初始化");
      }
      const list = Array.isArray(years) ? years.filter((y) => Number.isInteger(y) && y >= 2e3 && y <= 2100) : [];
      return holidayServiceRef.getCalendarMarks(list);
    })
  );
  electron.ipcMain.handle(
    IPC.HOLIDAYS_STATUS,
    async () => wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError("INTERNAL", "节假日服务未初始化");
      }
      return holidayServiceRef.getStatus();
    })
  );
  electron.ipcMain.handle(
    IPC.HOLIDAYS_REFRESH,
    async (_e, years) => wrapIpcAsync(async () => {
      if (!holidayServiceRef) {
        throw new AppError("INTERNAL", "节假日服务未初始化");
      }
      const list = Array.isArray(years) ? years.filter((y) => Number.isInteger(y) && y >= 2e3 && y <= 2100) : [];
      return holidayServiceRef.refreshYears(list);
    })
  );
  electron.ipcMain.handle(IPC.TASK_VIEWS_LIST, () => wrapIpc(() => services().taskViews.list()));
  electron.ipcMain.handle(
    IPC.TASK_VIEWS_CREATE,
    (_e, dto) => wrapIpc(() => services().taskViews.create(dto))
  );
  electron.ipcMain.handle(
    IPC.TASK_VIEWS_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().taskViews.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.TASK_VIEWS_DELETE,
    (_e, id) => wrapIpc(() => {
      services().taskViews.delete(id);
    })
  );
  electron.ipcMain.handle(
    IPC.TASK_VIEWS_PREVIEW_COUNT,
    (_e, rule) => wrapIpc(() => services().taskViews.previewCount(rule))
  );
  electron.ipcMain.handle(
    IPC.TASK_VIEWS_CREATE_FROM_TEMPLATE,
    (_e, templateId) => wrapIpc(() => {
      const tpl = getViewTemplate(templateId);
      if (!tpl) throw new AppError("VALIDATION_ERROR", "未知模板");
      const created = services().taskViews.createFromPreset(tpl.preset, tpl.preset.name);
      if (!created) throw new AppError("VALIDATION_ERROR", "无法添加视图");
      return created;
    })
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITIES_LIST_BY_TASK,
    (_e, taskId, limit, before) => wrapIpc(() => services().taskActivities.listByTask(taskId, limit, before))
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITIES_COUNT,
    () => wrapIpc(() => services().taskActivities.countAll())
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITIES_DELETE_ALL,
    () => wrapIpc(() => services().taskActivities.deleteAll())
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITIES_PURGE,
    () => wrapIpc(() => services().taskActivities.purgeByCurrentPolicy())
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITIES_DELETE_TRASHED,
    () => wrapIpc(() => services().taskActivities.deleteForTrashedTasks())
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITY_RETENTION_GET,
    () => wrapIpc(() => services().taskActivities.getRetentionPolicy())
  );
  electron.ipcMain.handle(
    IPC.TASK_ACTIVITY_RETENTION_SET,
    (_e, policy) => wrapIpc(() => {
      const next = services().taskActivities.updateRetentionPolicy(policy);
      notifyAppSettingsChanged();
      return next;
    })
  );
  const widgetManager = () => getWidgetWindowManager();
  electron.ipcMain.handle(
    IPC.WIDGET_TOGGLE,
    () => wrapIpc(() => {
      widgetManager().toggle();
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_SHOW,
    () => wrapIpc(() => {
      widgetManager().show();
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_HIDE,
    () => wrapIpc(() => {
      widgetManager().hide();
    })
  );
  electron.ipcMain.handle(IPC.WIDGET_INSTANCES_LIST, () => wrapIpc(() => widgetManager().listInstances()));
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCES_GET,
    (_e, id) => wrapIpc(() => {
      const instance = widgetManager().getInstance(id);
      if (!instance) {
        throw new AppError("NOT_FOUND", "挂件不存在");
      }
      return instance;
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCES_CREATE,
    (_e, dto) => wrapIpc(() => widgetManager().createInstance(dto))
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCES_UPDATE,
    (_e, id, dto) => wrapIpc(() => widgetManager().updateInstance(id, dto))
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCES_DELETE,
    (_e, id) => wrapIpc(() => {
      widgetManager().deleteInstance(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_SHOW,
    (_e, id) => wrapIpc(() => {
      widgetManager().expand(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_HIDE,
    (_e, id) => wrapIpc(() => {
      widgetManager().hide(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_TOGGLE,
    (_e, id) => wrapIpc(() => {
      widgetManager().toggle(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_EXPAND,
    (_e, id, options) => wrapIpc(() => {
      widgetManager().expand(id, options);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_COLLAPSE,
    (_e, id) => wrapIpc(() => {
      widgetManager().collapse(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_INSTANCE_SET_DISPLAY_MODE,
    (_e, id, mode) => wrapIpc(() => widgetManager().setDisplayMode(id, mode))
  );
  const captureManager = () => getQuickCaptureWindowManager();
  electron.ipcMain.handle(
    IPC.CAPTURE_TOGGLE,
    () => wrapIpc(() => {
      captureManager().toggle();
    })
  );
  electron.ipcMain.handle(
    IPC.CAPTURE_SHOW,
    () => wrapIpc(() => {
      captureManager().show();
    })
  );
  electron.ipcMain.handle(
    IPC.CAPTURE_HIDE,
    () => wrapIpc(() => {
      captureManager().hide();
    })
  );
  electron.ipcMain.handle(IPC.WIDGET_GET_SETTINGS, () => wrapIpc(() => widgetManager().getSettings()));
  electron.ipcMain.handle(
    IPC.WIDGET_UPDATE_SETTINGS,
    (_e, dto) => wrapIpc(() => {
      const next = widgetManager().updateSettings(dto);
      notifyAppSettingsChanged();
      return next;
    })
  );
  electron.ipcMain.handle(IPC.WIDGET_NOTES_LIST, () => wrapIpc(() => services().widgetNotes.list()));
  electron.ipcMain.handle(
    IPC.WIDGET_NOTES_CREATE,
    (_e, dto) => wrapIpc(() => services().widgetNotes.create(dto))
  );
  electron.ipcMain.handle(
    IPC.WIDGET_NOTES_UPDATE,
    (_e, id, dto) => wrapIpc(() => services().widgetNotes.update(id, dto))
  );
  electron.ipcMain.handle(
    IPC.WIDGET_NOTES_DELETE,
    (_e, id) => wrapIpc(() => {
      services().widgetNotes.delete(id);
    })
  );
  electron.ipcMain.handle(
    IPC.WIDGET_NOTES_CONVERT_TO_TASK,
    (_e, id, dto) => wrapIpc(() => services().widgetNotes.convertToTask(id, dto ?? {}))
  );
  electron.ipcMain.handle(
    IPC.APP_OPEN_MAIN,
    (_e, route) => wrapIpc(() => {
      const win = getMainWindow();
      if (!win) return;
      win.show();
      win.focus();
      if (typeof route === "string" && route.trim()) {
        win.webContents.send(IPC.APP_NAVIGATE, route.trim());
      }
    })
  );
  const syncEngine = () => getSyncEngine(
    () => getDatabase(),
    () => getActiveDataDir()
  );
  electron.ipcMain.handle(
    IPC.SYNC_LOGIN,
    (_e, dto) => wrapIpcAsync(() => syncEngine().login(dto))
  );
  electron.ipcMain.handle(
    IPC.SYNC_REGISTER,
    (_e, dto) => wrapIpcAsync(() => syncEngine().register(dto))
  );
  electron.ipcMain.handle(
    IPC.SYNC_COMPLETE_LOGIN,
    (_e, request) => wrapIpcAsync(() => syncEngine().completeLogin(request ?? { policy: "cancel" }))
  );
  electron.ipcMain.handle(
    IPC.SYNC_LOGOUT,
    () => wrapIpc(() => {
      syncEngine().logout();
    })
  );
  electron.ipcMain.handle(IPC.SYNC_GET_STATUS, () => wrapIpc(() => syncEngine().getStatus()));
  electron.ipcMain.handle(
    IPC.SYNC_TRIGGER,
    () => wrapIpcAsync(() => syncEngine().trigger({ fullReconcile: true }))
  );
  electron.ipcMain.handle(
    IPC.SYNC_SET_SERVER_URL,
    (_e, url2) => wrapIpc(() => syncEngine().setServerUrl(typeof url2 === "string" ? url2 : ""))
  );
  electron.ipcMain.handle(
    IPC.SYNC_SET_PREFERENCES,
    (_e, partial) => wrapIpc(() => syncEngine().setPreferences(partial ?? {}))
  );
  electron.ipcMain.handle(
    IPC.SYNC_TEST_SERVER_URL,
    (_e, url2) => wrapIpcAsync(() => syncEngine().testServerUrl(typeof url2 === "string" ? url2 : void 0))
  );
  electron.ipcMain.handle(
    IPC.SYNC_REPORT_UI_PREFERENCES,
    (_e, prefs) => wrapIpc(() => {
      syncEngine().reportUiPreferences(
        prefs && typeof prefs === "object" ? prefs : {}
      );
    })
  );
  const notifyRuntime = () => getNotifyRuntime(
    () => getDatabase(),
    () => getActiveDataDir()
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_GET_CONFIG,
    () => wrapIpc(() => readNotificationConfig(getActiveDataDir()))
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_SET_CONFIG,
    (_e, config) => wrapIpcAsync(() => notifyRuntime().saveConfig(config))
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_TEST_IYUU,
    (_e, token) => wrapIpcAsync(
      () => notifyRuntime().dispatcher().testIyuu(typeof token === "string" ? token : void 0)
    )
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_TEST_WEBHOOK,
    (_e, url2, headers) => wrapIpcAsync(
      () => notifyRuntime().dispatcher().testWebhook(typeof url2 === "string" ? url2 : "", headers)
    )
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_LIST_DELIVERIES,
    () => wrapIpcAsync(() => notifyRuntime().listDeliveries())
  );
  electron.ipcMain.handle(
    IPC.NOTIFY_LIST_PENDING,
    () => wrapIpcAsync(() => notifyRuntime().listPending())
  );
  electron.ipcMain.handle(IPC.APP_UPDATE_GET_STATUS, () => wrapIpc(() => getUpdateOrchestrator().getStatus()));
  electron.ipcMain.handle(
    IPC.APP_UPDATE_CHECK,
    () => wrapIpcAsync(() => getUpdateOrchestrator().checkForUpdates({ manual: true }))
  );
  electron.ipcMain.handle(
    IPC.APP_UPDATE_QUIT_AND_INSTALL,
    () => wrapIpc(() => {
      getUpdateOrchestrator().quitAndInstall();
    })
  );
  electron.ipcMain.handle(
    IPC.APP_UPDATE_LIST_CHANGELOG,
    () => wrapIpcAsync(() => fetchReleaseChangelog({ limit: 10 }))
  );
}
const SCAN_INTERVAL_MS$1 = 6e4;
class ReminderService {
  constructor(taskRepo, reminderRepo, messageService, holidayService, onInAppMessage) {
    this.taskRepo = taskRepo;
    this.reminderRepo = reminderRepo;
    this.messageService = messageService;
    this.holidayService = holidayService;
    this.onInAppMessage = onInAppMessage;
  }
  timer = null;
  pendingIds = /* @__PURE__ */ new Set();
  ticking = false;
  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), SCAN_INTERVAL_MS$1);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pendingIds.clear();
  }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = nowIso();
      const due = this.reminderRepo.findDue(now);
      for (const reminder of due) {
        if (this.pendingIds.has(reminder.id)) continue;
        this.pendingIds.add(reminder.id);
        const task = this.taskRepo.findById(reminder.taskId);
        if (!task) {
          this.pendingIds.delete(reminder.id);
          continue;
        }
        const inApp = this.messageService.createTaskReminder({
          ...task,
          title: task.title,
          id: task.id
        });
        this.onInAppMessage?.(inApp);
        const continuous = task.remindContinuous;
        const recurrence = task.recurrence;
        if (!continuous) {
          this.reminderRepo.markFired(reminder.id, now);
        }
        if (recurrence && task.dueAt) {
          const nextDue = await this.resolveNextDue(task.dueAt, recurrence);
          if (nextDue) {
            const updated = {
              ...task,
              dueAt: nextDue,
              remindAt: reminder.offsetMinutes != null ? remindAtFromDueOffset(nextDue, reminder.offsetMinutes) : task.remindAt,
              updatedAt: now
            };
            this.taskRepo.update(updated);
            this.reminderRepo.rebuildOffsetsForTask(task.id, nextDue);
            if (continuous) {
              this.reminderRepo.clearFiredForTask(task.id);
            }
          }
        }
        this.pendingIds.delete(reminder.id);
      }
    } finally {
      this.ticking = false;
    }
  }
  async resolveNextDue(dueAt, recurrence) {
    if (recurrence.type === "legal_holidays") {
      try {
        return await this.holidayService.nextLegalHolidayDueAfter(dueAt);
      } catch (err) {
        console.error("[ReminderService] 法定节假日数据获取失败", err);
        return null;
      }
    }
    return nextDueAfterRecurrence(dueAt, recurrence);
  }
}
const SCAN_INTERVAL_MS = 6e4;
class SummarySchedulerService {
  constructor(summaryRepo, summaryService, messageService, onInAppMessage) {
    this.summaryRepo = summaryRepo;
    this.summaryService = summaryService;
    this.messageService = messageService;
    this.onInAppMessage = onInAppMessage;
  }
  timer = null;
  ticking = false;
  // 防并发：同一个 summary 在同一时刻只能生成/发送一次。
  runningIds = /* @__PURE__ */ new Set();
  start() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), SCAN_INTERVAL_MS);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  /**
   * 立即生成并发送一条汇总（写消息 + 通知外发）。
   * 不更新 lastSentAt，避免占用自动到点名额。
   */
  async runNow(id) {
    if (this.runningIds.has(id)) {
      throw new AppError("VALIDATION_ERROR", "该汇总正在生成中，请稍候");
    }
    const summary = this.summaryRepo.findById(id);
    if (!summary) {
      throw new AppError("NOT_FOUND", "汇总任务不存在");
    }
    this.runningIds.add(id);
    try {
      await this.dispatch(summary, dayjs(), { updateLastSentAt: false });
      const updated = this.summaryRepo.findById(id);
      if (!updated) {
        throw new AppError("NOT_FOUND", "汇总任务不存在");
      }
      return updated;
    } finally {
      this.runningIds.delete(id);
    }
  }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = dayjs();
      for (const summary of this.summaryRepo.list()) {
        if (!shouldSendSummaryNow(summary, now)) continue;
        if (this.runningIds.has(summary.id)) continue;
        this.runningIds.add(summary.id);
        try {
          await this.dispatch(summary, now, { updateLastSentAt: true });
        } catch (err) {
          console.error("[SummarySchedulerService] send failed", summary.id, err);
        } finally {
          this.runningIds.delete(summary.id);
        }
      }
    } finally {
      this.ticking = false;
    }
  }
  async dispatch(summary, now, opts) {
    const body = await this.summaryService.buildSummaryBody(summary, now);
    const inApp = this.messageService.create({
      kind: "notification",
      title: `定时汇总：${summary.name}`,
      body,
      taskId: null,
      source: "scheduled_summary"
    });
    this.onInAppMessage?.(inApp);
    if (opts.updateLastSentAt) {
      this.summaryService.markSent(summary.id, nowIso());
    }
  }
}
const HOLIDAY_DATA_SOURCE_TIMOR = "timor.tech";
const HOLIDAY_DATA_SOURCE_LABEL_TIMOR = "中国法定节假日（timor.tech）";
const HOLIDAY_DATA_SOURCE_LABEL_SERVER = "中国法定节假日（同步服务器）";
function holidaySourceLabel(source) {
  return source === "server" ? HOLIDAY_DATA_SOURCE_LABEL_SERVER : HOLIDAY_DATA_SOURCE_LABEL_TIMOR;
}
function normalizeHolidayYears(years) {
  if (!Array.isArray(years)) return [];
  const out = [];
  for (const y of years) {
    if (typeof y !== "number" || !Number.isInteger(y)) continue;
    if (y < 2e3 || y > 2100) continue;
    if (!out.includes(y)) out.push(y);
  }
  return out.sort((a, b) => a - b);
}
const TIMOR_HOLIDAY_YEAR_URL = "https://timor.tech/api/holiday/year";
function timorHolidayYearUrl(year) {
  return `${TIMOR_HOLIDAY_YEAR_URL}/${year}/`;
}
function toFullDate(year, mmdd, entryDate) {
  if (entryDate && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return entryDate;
  const parts = mmdd.split("-");
  if (parts.length !== 2) return null;
  return `${year}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
}
function buildHolidayCalendarMap(response, year) {
  const map = /* @__PURE__ */ new Map();
  if (response.code !== 0 || !response.holiday) return map;
  for (const [mmdd, entry] of Object.entries(response.holiday)) {
    if (!entry || typeof entry.holiday !== "boolean") continue;
    const full = toFullDate(year, mmdd, entry.date);
    if (!full) continue;
    map.set(full, {
      date: full,
      kind: entry.holiday ? "holiday" : "workday",
      name: entry.name || (entry.holiday ? "法定节假日" : "调休上班")
    });
  }
  return map;
}
function legalHolidayMapFromCalendar(calendar) {
  const map = /* @__PURE__ */ new Map();
  for (const [date, day] of calendar) {
    if (day.kind !== "holiday") continue;
    map.set(date, { holiday: true, name: day.name, date });
  }
  return map;
}
function findNextLegalHolidayDueAfter(fromIso, yearMaps, maxDays = 400) {
  const from = dayjs(fromIso);
  if (!from.isValid()) return null;
  let cursor = from.add(1, "day").startOf("day");
  for (let i = 0; i < maxDays; i++) {
    const y = cursor.year();
    const map = yearMaps.get(y);
    const key = cursor.format("YYYY-MM-DD");
    if (map?.has(key)) {
      return cursor.hour(from.hour()).minute(from.minute()).second(from.second()).format("YYYY-MM-DDTHH:mm:ss");
    }
    cursor = cursor.add(1, "day");
  }
  return null;
}
const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1e3;
const CACHE_FILE_SUFFIX = "-calendar-v2.json";
const ORIGIN_FILE_SUFFIX = "-origin-v2.json";
class HolidayService {
  constructor(cacheDir, resolveAuth = () => null) {
    this.resolveAuth = resolveAuth;
    this.cacheDir = cacheDir ?? path.join(resolveDataDir(), "holiday-cache");
  }
  cacheDir;
  /** 含法定放假 + 调休上班的全量日历标注 */
  calendarMemory = /* @__PURE__ */ new Map();
  /** 计算下一次法定节假日对应的 dueAt（保留原时刻） */
  async nextLegalHolidayDueAfter(fromIso) {
    const fromYear = new Date(fromIso.replace(" ", "T")).getFullYear();
    await this.ensureYearsLoaded([fromYear, fromYear + 1]);
    const legalByYear = /* @__PURE__ */ new Map();
    for (const y of [fromYear, fromYear + 1]) {
      const cal = this.calendarMemory.get(y);
      if (cal) legalByYear.set(y, legalHolidayMapFromCalendar(cal));
    }
    return findNextLegalHolidayDueAfter(fromIso, legalByYear);
  }
  /** 返回多年日历标注（YYYY-MM-DD → day）供月历展示 */
  async getCalendarMarks(years) {
    const list = normalizeHolidayYears(years);
    await this.ensureYearsLoaded(list);
    const out = {};
    for (const year of list) {
      const map = this.calendarMemory.get(year);
      if (!map) continue;
      for (const [date, day] of map) {
        out[date] = day;
      }
    }
    return out;
  }
  /** 扫描磁盘 v2 缓存，汇总设置页状态 */
  getStatus() {
    const yearsMeta = [];
    let latestOrigin = null;
    try {
      if (fs.existsSync(this.cacheDir)) {
        for (const name of fs.readdirSync(this.cacheDir)) {
          if (!name.endsWith(CACHE_FILE_SUFFIX)) continue;
          const yearStr = name.slice(0, -CACHE_FILE_SUFFIX.length);
          const year = Number(yearStr);
          if (!Number.isInteger(year) || year < 2e3 || year > 2100) continue;
          const filePath = path.join(this.cacheDir, name);
          let updatedAt = null;
          try {
            updatedAt = new Date(fs.statSync(filePath).mtimeMs).toISOString();
          } catch {
            updatedAt = null;
          }
          yearsMeta.push({ year, updatedAt });
          const origin = this.readOrigin(year);
          if (origin && (!latestOrigin || Date.parse(origin.fetchedAt) >= Date.parse(latestOrigin.fetchedAt))) {
            latestOrigin = origin;
          }
        }
      }
    } catch {
    }
    yearsMeta.sort((a, b) => a.year - b.year);
    const source = latestOrigin?.source ?? HOLIDAY_DATA_SOURCE_TIMOR;
    return {
      source,
      sourceLabel: holidaySourceLabel(source),
      cachedYears: yearsMeta.map((m) => m.year),
      yearsMeta
    };
  }
  /**
   * 强制刷新：清内存与磁盘缓存后重新拉取。
   * 返回合并后的 marks 与最新 status。
   */
  async refreshYears(years) {
    const list = normalizeHolidayYears(years);
    for (const year of list) {
      this.calendarMemory.delete(year);
      const filePath = this.cacheFilePath(year);
      const originPath = this.originFilePath(year);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
      }
      try {
        if (fs.existsSync(originPath)) fs.unlinkSync(originPath);
      } catch {
      }
    }
    const marks = await this.getCalendarMarks(list);
    return { marks, status: this.getStatus() };
  }
  cacheFilePath(year) {
    return path.join(this.cacheDir, `${year}${CACHE_FILE_SUFFIX}`);
  }
  originFilePath(year) {
    return path.join(this.cacheDir, `${year}${ORIGIN_FILE_SUFFIX}`);
  }
  writeOrigin(year, source) {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const payload = { source, fetchedAt: (/* @__PURE__ */ new Date()).toISOString() };
    fs.writeFileSync(this.originFilePath(year), JSON.stringify(payload), "utf8");
  }
  readOrigin(year) {
    try {
      const raw = JSON.parse(fs.readFileSync(this.originFilePath(year), "utf8"));
      if (raw?.source !== "server" && raw?.source !== "timor.tech") return null;
      if (typeof raw.fetchedAt !== "string") return null;
      return raw;
    } catch {
      return null;
    }
  }
  async ensureYearsLoaded(years) {
    const unique = [...new Set(years)];
    await Promise.all(unique.map((y) => this.loadYear(y)));
  }
  async loadYear(year) {
    if (this.calendarMemory.has(year)) {
      return this.calendarMemory.get(year);
    }
    const filePath = this.cacheFilePath(year);
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs < CACHE_MAX_AGE_MS) {
          const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const map2 = new Map(Object.entries(parsed));
          this.calendarMemory.set(year, map2);
          return map2;
        }
      }
    } catch {
    }
    const map = await this.fetchYearFromApi(year);
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(Object.fromEntries(map)), "utf8");
    this.calendarMemory.set(year, map);
    return map;
  }
  async fetchYearFromApi(year) {
    const auth = this.resolveAuth();
    if (auth?.baseUrl && auth.accessToken) {
      try {
        const map2 = await this.fetchYearFromServer(year, auth.baseUrl, auth.accessToken);
        this.writeOrigin(year, "server");
        return map2;
      } catch {
      }
    }
    const map = await this.fetchYearFromTimor(year);
    this.writeOrigin(year, "timor.tech");
    return map;
  }
  async fetchYearFromServer(year, baseUrl, accessToken) {
    const url2 = `${baseUrl.replace(/\/+$/, "")}/api/holidays/year/${year}`;
    const res = await fetch(url2, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      throw new Error(`节假日服务端请求失败: ${res.status}`);
    }
    const envelope = await res.json();
    if (envelope.code !== 0 || !envelope.data?.days) {
      throw new Error(envelope.message || "节假日服务端返回无效数据");
    }
    return new Map(Object.entries(envelope.data.days));
  }
  async fetchYearFromTimor(year) {
    const url2 = timorHolidayYearUrl(year);
    const res = await fetch(url2, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`节假日 API 请求失败: ${res.status}`);
    }
    const data = await res.json();
    return buildHolidayCalendarMap(data, year);
  }
  /** 测试用：注入内存数据 */
  seedYearForTest(year, map) {
    const calendar = /* @__PURE__ */ new Map();
    for (const [date, entry] of map) {
      calendar.set(date, {
        date,
        kind: entry.holiday ? "holiday" : "workday",
        name: entry.name
      });
    }
    this.calendarMemory.set(year, calendar);
  }
  /** 测试用：写入磁盘缓存（不经 API） */
  writeCacheFileForTest(year, marks) {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(this.cacheFilePath(year), JSON.stringify(marks), "utf8");
  }
  clearMemory() {
    this.calendarMemory.clear();
  }
}
function registerAttachmentProtocol() {
  electron.protocol.registerFileProtocol("aitodo-attachment", (request, callback) => {
    const filePath = resolveAttachmentPathFromRequest(request.url);
    if (!filePath) {
      callback({ error: -6 });
      return;
    }
    callback({ path: filePath });
  });
}
let mainWindow = null;
let reminderService = null;
let summarySchedulerService = null;
registerNotificationSupport();
function createWindow(options) {
  const startHidden = Boolean(options?.startHidden);
  const win = new electron.BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 560,
    title: "小柒todo",
    /** 不显示系统菜单栏（File / Edit / View …） */
    autoHideMenuBar: true,
    /** 登录项静默托盘启动时不闪主窗 */
    show: !startHidden,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  bindMinimizeToTray(win);
  return win;
}
function bootstrapDatabase() {
  try {
    getDatabase();
    return true;
  } catch (err) {
    if (err instanceof DatabaseNotWritableError) {
      electron.dialog.showErrorBox(
        "数据目录不可写",
        `${err.message}

请安装到可写目录，或在设置中更改数据存储位置后重启应用。`
      );
    } else {
      electron.dialog.showErrorBox("数据库初始化失败", err instanceof Error ? err.message : String(err));
    }
    return false;
  }
}
electron.app.whenReady().then(() => {
  if (!bootstrapDatabase()) {
    electron.app.quit();
    return;
  }
  applyPortableUpdateIfPending();
  electron.Menu.setApplicationMenu(null);
  registerAttachmentProtocol();
  registerIpcHandlers(() => mainWindow);
  try {
    const orch = getUpdateOrchestrator();
    orch.setMainWindowGetter(() => mainWindow);
    orch.scheduleAutoCheck();
  } catch (err) {
    console.warn("[aiTodo] 更新编排初始化失败", err);
  }
  try {
    const notify = getNotifyRuntime(
      () => getDatabase(),
      () => getActiveDataDir()
    );
    notify.setOnInAppPush(pushAppMessageToRenderer);
    notify.ensureDeferredFlush();
    getSyncEngine(
      () => getDatabase(),
      () => getActiveDataDir()
    ).start();
  } catch {
  }
  try {
    const db2 = getDatabase();
    new TaskActivityService(new TaskActivityRepository(db2)).purgeByCurrentPolicy();
  } catch {
  }
  mainWindow = createWindow({
    startHidden: shouldStartHidden(
      process.argv,
      electron.app.getLoginItemSettings(),
      readLaunchAtLoginPrefs()
    )
  });
  registerGlobalShortcuts(mainWindow, createDefaultShortcutHandlers());
  const db = getDatabase();
  const taskRepo = new TaskRepository(db);
  const syncOutbox = new SyncOutbox(db);
  const messageService = new AppMessageService(
    new AppMessageRepository(db),
    syncOutbox,
    () => readSyncPreferences(getActiveDataDir())
  );
  const reminderRepo = new TaskReminderRepository(db);
  const holidayService = new HolidayService(void 0, () => {
    const creds = readSyncCredentials(getActiveDataDir());
    const state = ensureSyncState(getDatabase());
    if (!creds?.accessToken || !state.serverBaseUrl) return null;
    return { baseUrl: state.serverBaseUrl, accessToken: creds.accessToken };
  });
  setHolidayService(holidayService);
  reminderService = new ReminderService(
    taskRepo,
    reminderRepo,
    messageService,
    holidayService,
    pushAppMessageToRenderer
  );
  reminderService.start();
  const summaryRepo = new ScheduledSummaryRepository(db);
  const categoryRepo = new CategoryRepository(db);
  summarySchedulerService = new SummarySchedulerService(
    summaryRepo,
    new ScheduledSummaryService(summaryRepo, taskRepo, categoryRepo, syncOutbox),
    messageService,
    pushAppMessageToRenderer
  );
  setSummarySchedulerService(summarySchedulerService);
  summarySchedulerService.start();
  createTray(mainWindow, {
    onShow: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
    onToggleWidget: () => {
      getWidgetWindowManager().toggle();
    },
    onNewTask: () => {
      getQuickCaptureWindowManager().toggle();
    },
    onQuit: () => {
      markQuitting();
      electron.app.quit();
    },
    onQuitAndInstallUpdate: () => {
      try {
        getUpdateOrchestrator().quitAndInstall();
      } catch (err) {
        console.warn("[aiTodo] 托盘重启更新失败", err);
      }
    }
  }).catch((err) => {
    console.error("[aiTodo] 创建托盘失败", err);
  });
  try {
    getUpdateOrchestrator().subscribe((status) => {
      setTrayUpdateReady(status.state === "ready", mainWindow);
    });
  } catch {
  }
  try {
    getWidgetWindowManager().restoreOnStartup();
  } catch {
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});
electron.app.on("before-quit", () => {
  markQuitting();
  unregisterGlobalShortcuts();
  getWidgetWindowManager().destroy();
  getQuickCaptureWindowManager().destroy();
  reminderService?.stop();
  summarySchedulerService?.stop();
  destroyTray();
  closeDatabase();
});
electron.app.on("window-all-closed", () => {
  if (electron.app.isQuitting) {
    electron.app.quit();
  }
});
if (!electron.app.isPackaged) {
  console.log("[aiTodo] data dir:", resolveDataDir());
}
exports.ScheduledSummaryRepository = ScheduledSummaryRepository;
exports.TaskRepository = TaskRepository;
exports.readDeferredNotifies = readDeferredNotifies;
exports.shouldSendSummaryNow = shouldSendSummaryNow;
