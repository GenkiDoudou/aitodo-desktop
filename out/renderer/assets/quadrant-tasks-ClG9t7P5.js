import { Q as dayjs, af as getTaskPriorityMeta, aL as normalizeTaskPriority } from "./_plugin-vue_export-helper-D7E7GOLT.js";
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
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function resolveTaskCompletedAt(task) {
  if (task.status !== "DONE") return null;
  return task.completedAt ?? task.updatedAt ?? null;
}
function formatCompletedGroupLabel(dateKey) {
  const d = dayjs(dateKey);
  if (!d.isValid()) return dateKey;
  const weekday = WEEKDAY_LABELS[d.day()];
  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  if (dateKey === today) return `今天 ${weekday}`;
  if (dateKey === yesterday) return `昨天 ${weekday}`;
  if (d.year() === dayjs().year()) return `${d.format("M月D日")} ${weekday}`;
  return `${d.format("YYYY年M月D日")} ${weekday}`;
}
function groupCompletedTasksByDate(tasks, categoryId) {
  let list = tasks.filter((t) => t.status === "DONE");
  if (categoryId !== void 0) {
    list = list.filter((t) => t.categoryId === categoryId);
  }
  const byDate = /* @__PURE__ */ new Map();
  for (const task of list) {
    const iso = resolveTaskCompletedAt(task);
    if (!iso) continue;
    const key = iso.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(task);
  }
  const sortByCompleted = (a, b) => {
    const ta = resolveTaskCompletedAt(a) ?? "";
    const tb = resolveTaskCompletedAt(b) ?? "";
    return tb.localeCompare(ta);
  };
  return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, groupTasks]) => ({
    key,
    label: formatCompletedGroupLabel(key),
    tasks: [...groupTasks].sort(sortByCompleted)
  }));
}
function completedTaskDisplayTitle(task, taskById) {
  if (!task.parentId) return task.title;
  const parent = taskById.get(task.parentId);
  if (!parent) return task.title;
  return `${parent.title} / ${task.title}`;
}
const TASK_DATE_FIELD_LABELS = {
  dueAt: "到期时间",
  createdAt: "创建时间",
  completedAt: "完成时间"
};
const DONE_TIME_RANGE_LABELS = {
  all: "全部",
  today: "本日",
  week: "本周",
  month: "本月",
  custom: "自定义"
};
const CALENDAR_RANGE_PRESET_LABELS = {
  day: "日",
  week: "周",
  month: "月",
  year: "年",
  custom: "自定义"
};
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
  if (dateField === "dueAt") {
    return { upperOnly: dueCutoffIsoForSmartList(smart, base) };
  }
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
function calendarPresetBounds(preset, base = dayjs(), custom) {
  if (preset === "day") {
    return { from: startOfDayIso(base), to: endOfDayIso(base) };
  }
  if (preset === "week") {
    const start = startOfWeekMonday(base);
    return { from: startOfDayIso(start), to: endOfDayIso(endOfWeekSunday(base)) };
  }
  if (preset === "month") {
    return {
      from: startOfDayIso(base.startOf("month")),
      to: endOfDayIso(base.endOf("month"))
    };
  }
  if (preset === "year") {
    return {
      from: startOfDayIso(base.startOf("year")),
      to: endOfDayIso(base.endOf("year"))
    };
  }
  if (preset === "custom" && custom?.from && custom?.to) {
    const fromD = dayjs(custom.from.slice(0, 10));
    const toD = dayjs(custom.to.slice(0, 10));
    if (!fromD.isValid() || !toD.isValid()) return null;
    return { from: startOfDayIso(fromD), to: endOfDayIso(toD) };
  }
  return null;
}
function isoInClosedRange(iso, bounds) {
  return iso >= bounds.from && iso <= bounds.to;
}
function taskMatchesSmartListDate(task, smart, dateField = "dueAt", base = dayjs()) {
  if (dateField === "completedAt") {
    if (task.status !== "DONE") return false;
    const iso = resolveTaskDateIso(task, "completedAt");
    if (!iso) return false;
    const bounds2 = smartListDateBounds(smart, dateField, base);
    if (!("from" in bounds2)) return false;
    return isoInClosedRange(iso, bounds2);
  }
  if (dateField === "createdAt") {
    const iso = task.createdAt;
    if (!iso) return false;
    const bounds2 = smartListDateBounds(smart, dateField, base);
    if (!("from" in bounds2)) return false;
    if (!isoInClosedRange(iso, bounds2)) return false;
    return task.status !== "DONE";
  }
  if (task.status === "DONE") return false;
  if (!task.dueAt) return false;
  const bounds = smartListDateBounds(smart, "dueAt", base);
  if ("upperOnly" in bounds) {
    return task.dueAt <= bounds.upperOnly;
  }
  return false;
}
function taskDateIsoInRange(task, field, bounds) {
  const iso = resolveTaskDateIso(task, field);
  if (!iso) return false;
  return isoInClosedRange(iso, bounds);
}
function nextTaskStatus(current) {
  if (current === "TODO") {
    return "IN_PROGRESS";
  }
  if (current === "IN_PROGRESS") {
    return "DONE";
  }
  return "TODO";
}
function taskStatusLabel(status) {
  if (status === "IN_PROGRESS") {
    return "进行中";
  }
  if (status === "DONE") {
    return "已完成";
  }
  return "待办";
}
const TIME_FIELDS = ["dueAt", "createdAt", "completedAt"];
function createEmptyAndGroup() {
  return { type: "group", op: "and", children: [] };
}
function isEmptyFilterNode(node) {
  if (!node) return true;
  const n = normalizeFilterNode(node);
  return n.type === "group" && n.children.length === 0;
}
function filterNodeToPersist(node) {
  if (isEmptyFilterNode(node)) return null;
  return normalizeFilterNode(node);
}
function filterNodeForEditor(node) {
  if (isEmptyFilterNode(node)) return createEmptyAndGroup();
  return normalizeFilterNode(node);
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
      return matchCategory(task, op, value);
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
function matchCategory(task, op, value) {
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
function deriveAppliedViewState(view) {
  if (view.layout === "quadrant") {
    return {
      viewLayout: "quadrant",
      layout: "list",
      groupBy: view.groupBy,
      sortBy: view.sortBy,
      kanbanBoardMode: null,
      filterRule: view.filterRule,
      quadrantOptions: view.quadrantOptions ?? null
    };
  }
  return {
    viewLayout: view.layout,
    layout: view.layout,
    groupBy: view.groupBy,
    sortBy: view.sortBy,
    kanbanBoardMode: view.layout === "kanban" ? view.kanbanBoardMode ?? "group" : null,
    filterRule: view.filterRule,
    quadrantOptions: null
  };
}
function isFilterRuleActive(rule) {
  if (!rule) return false;
  if (rule.type === "group" && rule.children.length === 0) return false;
  return true;
}
const DEFAULT_TASK_VIEW_ALL_ID = "view-default-all";
const DEFAULT_TASK_VIEW_KANBAN_ID = "view-default-kanban";
function findFallbackViewId(views, excludeId) {
  const ordered = [...views].sort((a, b) => a.sortOrder - b.sortOrder);
  const pick = ordered.find((v) => v.id !== excludeId);
  return pick?.id ?? null;
}
function buildHasSubtasksMap(tasks) {
  const map = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    if (task.parentId && !task.deletedAt) {
      map.set(task.parentId, true);
    }
  }
  return map;
}
function filterTasksForViewWidget(allTasks, view, options = {}) {
  const hideDone = options.hideDone ?? true;
  const alive = allTasks.filter((task) => !task.deletedAt);
  const pool = hideDone ? alive.filter((task) => task.status !== "DONE") : alive;
  const rule = view.filterRule;
  const hasSubtasksById = buildHasSubtasksMap(alive);
  const ctx = { hasSubtasksById, now: options.now };
  if (view.layout === "quadrant") {
    if (!isFilterRuleActive(rule)) {
      return pool;
    }
    const matchedRootIds = new Set(
      pool.filter((task) => !task.parentId && matchTask(task, rule, ctx)).map((task) => task.id)
    );
    return pool.filter(
      (task) => matchedRootIds.has(task.id) || task.parentId != null && matchedRootIds.has(task.parentId)
    );
  }
  if (!isFilterRuleActive(rule)) {
    return pool;
  }
  const base = pool.filter((task) => matchTask(task, rule, ctx));
  if (view.layout !== "kanban") {
    return base;
  }
  const rootIds = new Set(base.filter((task) => !task.parentId).map((task) => task.id));
  const idSet = new Set(base.map((task) => task.id));
  const extras = pool.filter(
    (task) => task.parentId && rootIds.has(task.parentId) && !idSet.has(task.id)
  );
  return extras.length ? [...base, ...extras] : base;
}
function flattenTasksForViewWidget(tasks) {
  const idSet = new Set(tasks.map((task) => task.id));
  const byParent = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const key = task.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(task);
  }
  const result = [];
  const listed = /* @__PURE__ */ new Set();
  function walk(parentId, depth) {
    for (const task of byParent.get(parentId) ?? []) {
      result.push({ task, depth });
      listed.add(task.id);
      walk(task.id, depth + 1);
    }
  }
  walk(null, 0);
  for (const task of tasks) {
    if (listed.has(task.id)) continue;
    if (task.parentId && !idSet.has(task.parentId)) {
      result.push({ task, depth: 0 });
    }
  }
  return result;
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
function extractTaskTags(task) {
  if (task.tags?.length) {
    return [...task.tags].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }
  return extractTagsFromText(task.title, task.description);
}
function primaryTaskTag(task) {
  return extractTaskTags(task)[0] ?? "";
}
const TASK_GROUP_BY_LABELS = {
  custom: "自定义",
  time: "时间",
  tag: "标签",
  priority: "任务级别",
  status: "任务状态",
  none: "无"
};
const TASK_SORT_BY_LABELS = {
  custom: "自定义",
  time: "截止时间",
  createdAt: "创建时间",
  completedAt: "完成时间",
  remindAt: "提醒时间",
  priority: "任务级别",
  title: "标题",
  tag: "标签"
};
function taskSortTimeIso(task) {
  return task.dueAt ?? task.createdAt ?? null;
}
function compareByTimeField(a, b, field) {
  const ia = a[field] ?? null;
  const ib = b[field] ?? null;
  if (!ia && !ib) return a.title.localeCompare(b.title, "zh-CN");
  if (!ia) return 1;
  if (!ib) return -1;
  const cmp = ia.localeCompare(ib);
  if (cmp !== 0) return cmp;
  return a.title.localeCompare(b.title, "zh-CN");
}
function compareTasks(a, b, sortBy) {
  if (sortBy === "custom") {
    const so = a.sortOrder - b.sortOrder;
    if (so !== 0) return so;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  }
  if (sortBy === "title") {
    return a.title.localeCompare(b.title, "zh-CN");
  }
  if (sortBy === "priority") {
    const pa = a.priority ?? 4;
    const pb = b.priority ?? 4;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title, "zh-CN");
  }
  if (sortBy === "tag") {
    const ta = primaryTaskTag(a);
    const tb = primaryTaskTag(b);
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb, "zh-CN");
    }
    return a.title.localeCompare(b.title, "zh-CN");
  }
  if (sortBy === "createdAt") {
    return -compareByTimeField(a, b, "createdAt");
  }
  if (sortBy === "completedAt") {
    return compareByTimeField(a, b, "completedAt");
  }
  if (sortBy === "remindAt") {
    return compareByTimeField(a, b, "remindAt");
  }
  const ia = taskSortTimeIso(a);
  const ib = taskSortTimeIso(b);
  if (!ia && !ib) return a.title.localeCompare(b.title, "zh-CN");
  if (!ia) return 1;
  if (!ib) return -1;
  const cmp = ia.localeCompare(ib);
  if (cmp !== 0) return cmp;
  return a.title.localeCompare(b.title, "zh-CN");
}
function timeGroupKey(task, base = dayjs()) {
  if (!task.dueAt) {
    return { key: "no-date", label: "无日期", order: 50 };
  }
  const due = dayjs(task.dueAt);
  if (!due.isValid()) {
    return { key: "no-date", label: "无日期", order: 50 };
  }
  const today = base.startOf("day");
  const dueDay = due.startOf("day");
  if (task.status !== "DONE" && dueDay.isBefore(today)) {
    return { key: "overdue", label: "已过期", order: 0 };
  }
  if (dueDay.isSame(today, "day")) {
    return { key: "today", label: "今天", order: 10 };
  }
  if (dueDay.isSame(today.add(1, "day"), "day")) {
    return { key: "tomorrow", label: "明天", order: 20 };
  }
  const weekStart = startOfWeekMonday(base);
  const weekEnd = endOfWeekSunday(base);
  if (!dueDay.isBefore(weekStart, "day") && !dueDay.isAfter(weekEnd, "day")) {
    return { key: "this-week", label: "本周", order: 30 };
  }
  if (dueDay.isAfter(weekEnd, "day")) {
    return { key: "later", label: "以后", order: 40 };
  }
  return { key: dueDay.format("YYYY-MM-DD"), label: dueDay.format("M月D日"), order: 35 };
}
function priorityGroup(task) {
  const p = task.priority ?? 4;
  const meta = getTaskPriorityMeta(p);
  return { key: `p${p}`, label: meta.label, order: p };
}
function tagGroup(task) {
  const tag = primaryTaskTag(task);
  if (!tag) return { key: "__none__", label: "无标签", order: 9999 };
  return { key: tag, label: `#${tag}`, order: 0 };
}
function statusGroup(task) {
  if (task.status === "IN_PROGRESS") {
    return { key: "IN_PROGRESS", label: "进行中", order: 1 };
  }
  if (task.status === "DONE") {
    return { key: "DONE", label: "已完成", order: 2 };
  }
  return { key: "TODO", label: "待办", order: 0 };
}
function sortTaskList(tasks, sortBy) {
  return [...tasks].sort((a, b) => compareTasks(a, b, sortBy));
}
function bucketRoots(roots, groupBy, base = dayjs()) {
  const map = /* @__PURE__ */ new Map();
  for (const task of roots) {
    let meta;
    if (groupBy === "time") meta = timeGroupKey(task, base);
    else if (groupBy === "priority") meta = priorityGroup(task);
    else if (groupBy === "tag") meta = tagGroup(task);
    else if (groupBy === "status") meta = statusGroup(task);
    else continue;
    if (!map.has(meta.key)) {
      map.set(meta.key, { key: meta.key, label: meta.label, order: meta.order, tasks: [] });
    }
    map.get(meta.key).tasks.push(task);
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh-CN"));
}
function buildTaskListLayout(allTasks, groupBy, sortBy, base = dayjs()) {
  const idSet = new Set(allTasks.map((t) => t.id));
  const byParent = /* @__PURE__ */ new Map();
  for (const t of allTasks) {
    const key = t.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  }
  let roots = byParent.get(null) ?? [];
  const orphans = allTasks.filter((t) => t.parentId && !idSet.has(t.parentId));
  roots = [...roots, ...orphans.filter((o) => !roots.some((r) => r.id === o.id))];
  const result = [];
  const listed = /* @__PURE__ */ new Set();
  function walk(task, depth) {
    result.push({ type: "task", task, depth });
    listed.add(task.id);
    const children = sortTaskList(byParent.get(task.id) ?? [], sortBy);
    for (const child of children) {
      walk(child, depth + 1);
    }
  }
  const shouldGroup = groupBy === "time" || groupBy === "tag" || groupBy === "priority" || groupBy === "status";
  if (!shouldGroup) {
    const sortedRoots = sortTaskList(roots, sortBy);
    for (const root of sortedRoots) {
      walk(root, 0);
    }
  } else {
    const buckets = bucketRoots(roots, groupBy, base);
    for (const bucket of buckets) {
      result.push({ type: "group", key: bucket.key, label: bucket.label });
      const sorted = sortTaskList(bucket.tasks, sortBy);
      for (const root of sorted) {
        walk(root, 0);
      }
    }
  }
  for (const task of allTasks) {
    if (listed.has(task.id)) continue;
    if (task.parentId && !idSet.has(task.parentId)) {
      walk(task, 0);
    }
  }
  return result;
}
const DEFAULT_TASK_LIST_META_VISIBILITY = {
  createdAt: true,
  dueAt: true,
  remindAt: true,
  completedAt: true
};
const KEY_PREFIX = "aitodo_view_display_";
function storageKey(viewId) {
  return `${KEY_PREFIX}${viewId}`;
}
function defaultViewDisplayPreferences(kanbanBoardMode) {
  return {
    // 状态看板默认展示已完成列
    hideDone: kanbanBoardMode === "status" ? false : true,
    detailStyle: "sidebar",
    metaVisibility: { ...DEFAULT_TASK_LIST_META_VISIBILITY }
  };
}
function readViewDisplayPreferences(viewId, kanbanBoardMode) {
  const fallback = defaultViewDisplayPreferences(kanbanBoardMode);
  try {
    const raw = localStorage.getItem(storageKey(viewId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      hideDone: typeof parsed.hideDone === "boolean" ? parsed.hideDone : fallback.hideDone,
      detailStyle: parsed.detailStyle === "dialog" || parsed.detailStyle === "sidebar" ? parsed.detailStyle : fallback.detailStyle,
      metaVisibility: {
        ...fallback.metaVisibility,
        ...parsed.metaVisibility ?? {}
      }
    };
  } catch {
    return fallback;
  }
}
function persistViewDisplayPreferences(viewId, prefs) {
  try {
    localStorage.setItem(storageKey(viewId), JSON.stringify(prefs));
  } catch {
  }
}
const DEFAULT_KANBAN_STATUS_LABELS = {
  todo: "未开始",
  inProgress: "进行中",
  done: "已完成"
};
const DEFAULT_KANBAN_CONFIG = {
  defaultMode: "group",
  statusColumnLabels: { ...DEFAULT_KANBAN_STATUS_LABELS }
};
const KANBAN_STATUS_COLUMNS = ["TODO", "IN_PROGRESS", "DONE"];
function mergeKanbanConfig(partial) {
  const labels = partial?.statusColumnLabels ?? {};
  const mode = partial?.defaultMode;
  let defaultMode = "group";
  if (mode === "status" || mode === "priority" || mode === "time" || mode === "tag") {
    defaultMode = mode;
  }
  return {
    defaultMode,
    statusColumnLabels: {
      todo: trimLabel(labels.todo, DEFAULT_KANBAN_STATUS_LABELS.todo),
      inProgress: trimLabel(labels.inProgress, DEFAULT_KANBAN_STATUS_LABELS.inProgress),
      done: trimLabel(labels.done, DEFAULT_KANBAN_STATUS_LABELS.done)
    }
  };
}
function trimLabel(value, fallback) {
  const t = value?.trim();
  return t || fallback;
}
function statusLabelFor(status, labels) {
  if (status === "TODO") return labels.todo;
  if (status === "IN_PROGRESS") return labels.inProgress;
  return labels.done;
}
const KANBAN_UNGROUPED_ID = "__ungrouped__";
const KANBAN_DONE_COLUMN_ID = "__DONE__";
function kanbanScopeKey(opts) {
  if (opts.categoryId !== void 0) {
    return opts.categoryId === null ? "scope:uncategorized" : `scope:cat:${opts.categoryId}`;
  }
  return `scope:smart:${opts.smart ?? "all"}`;
}
const CONFIG_KEY = "aitodo_kanban_config";
const CURRENT_MODE_KEY = "aitodo_kanban_board_mode";
function readKanbanConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_KANBAN_CONFIG, statusColumnLabels: { ...DEFAULT_KANBAN_CONFIG.statusColumnLabels } };
    return mergeKanbanConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_KANBAN_CONFIG, statusColumnLabels: { ...DEFAULT_KANBAN_CONFIG.statusColumnLabels } };
  }
}
function readKanbanBoardMode() {
  try {
    const raw = localStorage.getItem(CURRENT_MODE_KEY);
    if (raw === "group" || raw === "status" || raw === "priority" || raw === "time" || raw === "tag") {
      return raw;
    }
  } catch {
  }
  return readKanbanConfig().defaultMode;
}
function persistKanbanBoardMode(mode) {
  try {
    localStorage.setItem(CURRENT_MODE_KEY, mode);
  } catch {
  }
}
const WIDGET_NOTE_COLORS = ["yellow", "green", "blue", "pink", "gray"];
const WIDGET_KIND_LABELS = {
  notes: "便签",
  matrix: "四象限",
  view: "视图"
};
const WIDGET_KANBAN_DEFAULT_WIDTH = 392;
const WIDGET_KANBAN_DEFAULT_HEIGHT = 520;
function categoryLogoInitial(name) {
  const text = name?.trim();
  if (!text) return "未";
  return text.charAt(0).toUpperCase();
}
function widgetInstanceDisplayName(instance) {
  if (instance.name.trim()) {
    return instance.name.trim();
  }
  return WIDGET_KIND_LABELS[instance.kind];
}
function splitTasksByPriority(tasks) {
  const idSet = new Set(tasks.map((t) => t.id));
  const buckets = { 1: [], 2: [], 3: [], 4: [] };
  for (const task of tasks) {
    if (task.parentId && idSet.has(task.parentId)) continue;
    const p = normalizeTaskPriority(task.priority);
    buckets[p].push(task);
  }
  return buckets;
}
function buildChildCountMap(allTasks) {
  const counts = /* @__PURE__ */ new Map();
  for (const t of allTasks) {
    if (!t.parentId) continue;
    counts.set(t.parentId, (counts.get(t.parentId) ?? 0) + 1);
  }
  return counts;
}
function flattenQuadrantTaskTree(roots, allTasks, expandedIds) {
  const byParent = /* @__PURE__ */ new Map();
  for (const t of allTasks) {
    if (!t.parentId) continue;
    if (!byParent.has(t.parentId)) byParent.set(t.parentId, []);
    byParent.get(t.parentId).push(t);
  }
  const result = [];
  const walk = (items, depth) => {
    for (const task of items) {
      result.push({ task, depth });
      if (expandedIds.has(task.id)) {
        walk(byParent.get(task.id) ?? [], depth + 1);
      }
    }
  };
  walk(roots, 0);
  return result;
}
export {
  widgetInstanceDisplayName as $,
  KANBAN_STATUS_COLUMNS as A,
  statusLabelFor as B,
  readKanbanConfig as C,
  DEFAULT_TASK_VIEW_ALL_ID as D,
  startOfWeekMonday as E,
  buildTaskListLayout as F,
  completedTaskDisplayTitle as G,
  groupCompletedTasksByDate as H,
  flattenQuadrantTaskTree as I,
  splitTasksByPriority as J,
  KANBAN_DONE_COLUMN_ID as K,
  buildChildCountMap as L,
  normalizeTagName as M,
  normalizeTagNames as N,
  kanbanScopeKey as O,
  readKanbanBoardMode as P,
  persistKanbanBoardMode as Q,
  TASK_DATE_FIELD_LABELS as R,
  DONE_TIME_RANGE_LABELS as S,
  TASK_SORT_BY_LABELS as T,
  isFilterRuleActive as U,
  matchTask as V,
  WIDGET_NOTE_COLORS as W,
  resolveTaskDateIso as X,
  CALENDAR_RANGE_PRESET_LABELS as Y,
  calendarPresetBounds as Z,
  WIDGET_KIND_LABELS as _,
  taskDateIsoInRange as a,
  categoryLogoInitial as a0,
  DEFAULT_KANBAN_STATUS_LABELS as a1,
  WIDGET_KANBAN_DEFAULT_WIDTH as a2,
  WIDGET_KANBAN_DEFAULT_HEIGHT as a3,
  filterTasksForViewWidget as a4,
  flattenTasksForViewWidget as a5,
  deriveAppliedViewState as b,
  DEFAULT_TASK_VIEW_KANBAN_ID as c,
  doneTimeRangeBounds as d,
  compareTasks as e,
  findFallbackViewId as f,
  timeGroupKey as g,
  normalizeFilterNode as h,
  isDueSmartList as i,
  createEmptyAndGroup as j,
  filterNodeForEditor as k,
  defaultViewDisplayPreferences as l,
  isEmptyFilterNode as m,
  nextTaskStatus as n,
  TASK_GROUP_BY_LABELS as o,
  primaryTaskTag as p,
  DEFAULT_TASK_LIST_META_VISIBILITY as q,
  readViewDisplayPreferences as r,
  filterNodeToPersist as s,
  taskMatchesSmartListDate as t,
  persistViewDisplayPreferences as u,
  validateFilterNode as v,
  taskStatusLabel as w,
  endOfWeekSunday as x,
  extractTaskTags as y,
  KANBAN_UNGROUPED_ID as z
};
