"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const index = require("./index.js");
const dayjs = require("dayjs");
function listLocalPending(db, dataDir) {
  const out = [];
  const now = dayjs();
  for (const t of new index.TaskRepository(db).list({})) {
    if (!t.remindAt || t.deletedAt) continue;
    const due = dayjs(t.remindAt);
    if (!due.isValid()) continue;
    if (due.isAfter(now)) {
      out.push({
        id: `local-upcoming-task-${t.id}`,
        kind: "upcoming",
        event: "task_reminder",
        entityId: t.id,
        title: t.title,
        bodyPreview: t.description ?? t.title,
        fireAt: due.toISOString(),
        deferredTo: null,
        source: "local"
      });
    }
  }
  for (const s of new index.ScheduledSummaryRepository(db).list()) {
    if (!s.enabled) continue;
    if (index.shouldSendSummaryNow(s, now)) continue;
    const [hh, mm] = s.sendTime.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    let next = now.hour(hh).minute(mm).second(0).millisecond(0);
    if (s.scheduleType === "weekly") {
      if (s.sendWeekday == null || now.day() !== s.sendWeekday) continue;
    }
    if (s.scheduleType === "monthly") {
      if (s.sendDay == null || now.date() !== s.sendDay) continue;
    }
    if (!next.isAfter(now)) continue;
    out.push({
      id: `local-upcoming-summary-${s.id}`,
      kind: "upcoming",
      event: "scheduled_summary",
      entityId: s.id,
      title: s.name,
      bodyPreview: s.name,
      fireAt: next.toISOString(),
      deferredTo: null,
      source: "local"
    });
  }
  for (const d of index.readDeferredNotifies(dataDir)) {
    out.push({
      id: `local-deferred-${d.id}`,
      kind: "deferred",
      event: d.event,
      entityId: d.entityId,
      title: d.title,
      bodyPreview: d.body,
      fireAt: d.fireAt,
      deferredTo: d.deferredTo,
      source: "local"
    });
  }
  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}
function mergePendingLists(local, server) {
  const map = /* @__PURE__ */ new Map();
  for (const item of local) {
    map.set(`${item.event}|${item.entityId}|${item.fireAt}`, item);
  }
  for (const item of server) {
    map.set(`${item.event}|${item.entityId}|${item.fireAt}`, item);
  }
  return [...map.values()].sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}
exports.listLocalPending = listLocalPending;
exports.mergePendingLists = mergePendingLists;
