import { Q as dayjs, d as defineComponent, G as watch, b as openBlock, c as createElementBlock, n as normalizeClass, e as createBaseVNode, M as Fragment, N as renderList, t as toDisplayString, aj as withKeys, h as withModifiers, g as createCommentVNode, O as createTextVNode, i as ref, F as computed, _ as _export_sfc, a5 as normalizeStyle, ai as useModel, r as resolveComponent, L as createBlock, w as withCtx, f as createVNode, u as unref, ab as TASK_PRIORITIES, aK as check_default, af as getTaskPriorityMeta } from "./_plugin-vue_export-helper-D7E7GOLT.js";
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
const RECURRENCE_CUSTOM_UNITS = [
  { key: "day", label: "天" },
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "year", label: "年" }
];
const REMIND_OFFSET_PRESETS = [
  { key: "on-time", label: "准时", minutes: 0 },
  { key: "m5", label: "提前5分钟", minutes: 5 },
  { key: "m30", label: "提前30分钟", minutes: 30 },
  { key: "h1", label: "提前1小时", minutes: 60 },
  { key: "d1", label: "提前1天", minutes: 24 * 60 }
];
const REMIND_CUSTOM_UNITS = [
  { key: "minute", label: "分钟" },
  { key: "hour", label: "小时" },
  { key: "day", label: "天" },
  { key: "week", label: "周" }
];
function remindAtFromDueOffset(dueAt, offsetMinutes) {
  return dayjs(dueAt).subtract(offsetMinutes, "minute").format("YYYY-MM-DDTHH:mm:ss");
}
function customOffsetToMinutes(amount, unit) {
  switch (unit) {
    case "minute":
      return amount;
    case "hour":
      return amount * 60;
    case "day":
      return amount * 24 * 60;
    case "week":
      return amount * 7 * 24 * 60;
  }
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
function recurrenceLabel(rule, dueAt) {
  if (!rule || rule.type === "none") return "重复";
  const d = dueAt ? dayjs(dueAt) : dayjs();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  switch (rule.type) {
    case "daily":
      return "每天";
    case "weekly":
      return `每周（周${weekdays[d.day()]}）`;
    case "monthly":
      return `每月（${d.date()}日）`;
    case "yearly":
      return `每年（${d.month() + 1}月${d.date()}日）`;
    case "workdays":
      return "工作日";
    case "weekend":
      return "每周末";
    case "legal_holidays":
      return "法定节假日";
    case "custom":
      return `每${rule.interval ?? 1}${unitLabel(rule.unit ?? "day")}`;
    default:
      return "重复";
  }
}
function unitLabel(unit) {
  const map = {
    day: "天",
    week: "周",
    month: "月",
    year: "年"
  };
  return map[unit];
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
function buildParseTextSegments(source, highlights) {
  if (!source) return [];
  const sorted = [...highlights].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const h of sorted) {
    const last = merged[merged.length - 1];
    if (last && rangesOverlap(last, h)) continue;
    merged.push(h);
  }
  const segments = [];
  let cursor = 0;
  for (const h of merged) {
    if (h.start > cursor) {
      segments.push({ text: source.slice(cursor, h.start), kind: "plain" });
    }
    if (h.end > h.start) {
      segments.push({ text: source.slice(h.start, h.end), kind: h.kind });
    }
    cursor = Math.max(cursor, h.end);
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), kind: "plain" });
  }
  return segments;
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
const _hoisted_1$2 = { class: "quick-add-input__field" };
const _hoisted_2$1 = ["value", "placeholder"];
const _hoisted_3$1 = {
  key: 0,
  class: "quick-add-input__meta"
};
const _hoisted_4$1 = {
  key: 0,
  class: "quick-add-input__tag is-due"
};
const _hoisted_5$1 = {
  key: 1,
  class: "quick-add-input__tag is-remind"
};
const _hoisted_6 = {
  key: 2,
  class: "quick-add-input__tag is-recurrence"
};
const _hoisted_7 = {
  key: 3,
  class: "quick-add-input__tag is-category"
};
const _hoisted_8 = {
  key: 4,
  class: "quick-add-input__tag is-title"
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "QuickAddInput",
  props: {
    modelValue: {},
    placeholder: { default: "" },
    categories: { default: () => [] },
    showMeta: { type: Boolean, default: true }
  },
  emits: ["update:modelValue", "enter", "escape", "blur"],
  setup(__props, { expose: __expose, emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const inputRef = ref();
    const mirrorRef = ref();
    const focused = ref(false);
    const draft = ref(null);
    let parseTimer = null;
    const segments = computed(
      () => buildParseTextSegments(props.modelValue, draft.value?.highlights ?? [])
    );
    const hasHighlights = computed(() => (draft.value?.highlights.length ?? 0) > 0);
    const showMeta = computed(() => {
      if (!props.showMeta || !props.modelValue.trim()) return false;
      const d = draft.value;
      if (!d) return false;
      return Boolean(d.dueAt || d.remindAt || d.recurrence || d.category || hasHighlights.value);
    });
    const recurrenceText = computed(
      () => draft.value?.recurrence ? recurrenceLabel(draft.value.recurrence, draft.value.dueAt) : ""
    );
    function formatIso(iso) {
      return iso.slice(0, 16).replace("T", " ");
    }
    function runParse() {
      const text = props.modelValue;
      if (!text.trim()) {
        draft.value = null;
        return;
      }
      const cats = toParseCategories(props.categories);
      const parsed = parseAiTaskInput(text, { categories: cats });
      if (!parsed.category) {
        const byKeyword = matchCategoryByKeywords(text, cats);
        if (byKeyword) {
          draft.value = { ...parsed, category: byKeyword };
          return;
        }
      }
      draft.value = parsed;
    }
    function scheduleParse() {
      if (parseTimer) clearTimeout(parseTimer);
      parseTimer = setTimeout(runParse, 120);
    }
    function onInput(event) {
      emit("update:modelValue", event.target.value);
      scheduleParse();
    }
    function onEnterKey(event) {
      if (event.isComposing) {
        return;
      }
      event.preventDefault();
      emit("enter");
    }
    function onFocus() {
      focused.value = true;
      runParse();
    }
    function onBlurAndEmit() {
      focused.value = false;
      emit("blur");
    }
    function syncScroll() {
      if (!inputRef.value || !mirrorRef.value) return;
      mirrorRef.value.scrollLeft = inputRef.value.scrollLeft;
    }
    watch(
      () => props.modelValue,
      () => scheduleParse()
    );
    watch(
      () => props.categories,
      () => scheduleParse(),
      { deep: true }
    );
    __expose({
      focus: () => inputRef.value?.focus()
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", {
        class: normalizeClass(["quick-add-input", { "is-focused": focused.value, "has-preview": showMeta.value }])
      }, [
        createBaseVNode("div", _hoisted_1$2, [
          createBaseVNode("div", {
            ref_key: "mirrorRef",
            ref: mirrorRef,
            class: "quick-add-input__mirror",
            "aria-hidden": "true"
          }, [
            (openBlock(true), createElementBlock(Fragment, null, renderList(segments.value, (seg, index) => {
              return openBlock(), createElementBlock("span", {
                key: index,
                class: normalizeClass(["quick-add-input__seg", seg.kind !== "plain" ? `is-${seg.kind}` : void 0])
              }, toDisplayString(seg.text), 3);
            }), 128))
          ], 512),
          createBaseVNode("input", {
            ref_key: "inputRef",
            ref: inputRef,
            value: __props.modelValue,
            class: "quick-add-input__control",
            placeholder: __props.placeholder,
            spellcheck: "false",
            onInput,
            onKeydown: [
              withKeys(onEnterKey, ["enter"]),
              _cache[0] || (_cache[0] = withKeys(withModifiers(($event) => emit("escape"), ["prevent"]), ["esc"]))
            ],
            onFocus,
            onBlur: onBlurAndEmit,
            onScroll: syncScroll
          }, null, 40, _hoisted_2$1)
        ]),
        showMeta.value ? (openBlock(), createElementBlock("div", _hoisted_3$1, [
          draft.value?.dueAt ? (openBlock(), createElementBlock("span", _hoisted_4$1, " 截止 " + toDisplayString(formatIso(draft.value.dueAt)), 1)) : createCommentVNode("", true),
          draft.value?.remindAt ? (openBlock(), createElementBlock("span", _hoisted_5$1, [
            createTextVNode(" 提醒 " + toDisplayString(formatIso(draft.value.remindAt)) + " ", 1),
            draft.value.reminders.length > 1 ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
              createTextVNode("等 " + toDisplayString(draft.value.reminders.length) + " 条", 1)
            ], 64)) : createCommentVNode("", true)
          ])) : createCommentVNode("", true),
          draft.value?.recurrence ? (openBlock(), createElementBlock("span", _hoisted_6, toDisplayString(recurrenceText.value), 1)) : createCommentVNode("", true),
          draft.value?.category ? (openBlock(), createElementBlock("span", _hoisted_7, toDisplayString(draft.value.category.name), 1)) : createCommentVNode("", true),
          draft.value?.title && hasHighlights.value ? (openBlock(), createElementBlock("span", _hoisted_8, " 标题 " + toDisplayString(draft.value.title), 1)) : createCommentVNode("", true)
        ])) : createCommentVNode("", true)
      ], 2);
    };
  }
});
const QuickAddInput = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-897654df"]]);
const _hoisted_1$1 = ["fill", "stroke"];
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "TaskPriorityFlagIcon",
  props: {
    color: {},
    outline: { type: Boolean }
  },
  setup(__props) {
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("svg", {
        class: normalizeClass(["priority-flag-icon", { "is-outline": __props.outline }]),
        style: normalizeStyle({ color: __props.color }),
        width: "18",
        height: "18",
        viewBox: "0 0 18 18",
        "aria-hidden": "true"
      }, [
        _cache[0] || (_cache[0] = createBaseVNode("path", {
          class: "priority-flag-icon__pole",
          d: "M4 2.5v13",
          stroke: "currentColor",
          "stroke-width": "1.5",
          "stroke-linecap": "round"
        }, null, -1)),
        createBaseVNode("path", {
          class: "priority-flag-icon__cloth",
          d: "M4 3.5h10.5l-2.8 3.2 2.8 3.6H4V3.5z",
          fill: __props.outline ? "none" : "currentColor",
          stroke: __props.outline ? "currentColor" : "none",
          "stroke-width": "1.2",
          "stroke-linejoin": "round"
        }, null, 8, _hoisted_1$1)
      ], 6);
    };
  }
});
const TaskPriorityFlagIcon = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-db3c8bc7"]]);
const _hoisted_1 = ["title", "aria-label"];
const _hoisted_2 = { class: "priority-flag-menu__item" };
const _hoisted_3 = { class: "priority-flag-menu__label" };
const _hoisted_4 = { class: "priority-flag-menu__code" };
const _hoisted_5 = { class: "priority-flag-menu__desc" };
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "TaskPriorityFlagMenu",
  props: {
    "modelValue": { required: true },
    "modelModifiers": {}
  },
  emits: ["update:modelValue"],
  setup(__props) {
    const modelValue = useModel(__props, "modelValue");
    const currentMeta = computed(() => getTaskPriorityMeta(modelValue.value));
    function onCommand(value) {
      modelValue.value = value;
    }
    return (_ctx, _cache) => {
      const _component_el_icon = resolveComponent("el-icon");
      const _component_el_dropdown_item = resolveComponent("el-dropdown-item");
      const _component_el_dropdown_menu = resolveComponent("el-dropdown-menu");
      const _component_el_dropdown = resolveComponent("el-dropdown");
      return openBlock(), createBlock(_component_el_dropdown, {
        trigger: "click",
        onCommand
      }, {
        dropdown: withCtx(() => [
          createVNode(_component_el_dropdown_menu, { class: "priority-flag-menu__dropdown" }, {
            default: withCtx(() => [
              (openBlock(true), createElementBlock(Fragment, null, renderList(unref(TASK_PRIORITIES), (p) => {
                return openBlock(), createBlock(_component_el_dropdown_item, {
                  key: p.value,
                  command: p.value,
                  class: normalizeClass({ "is-selected": modelValue.value === p.value })
                }, {
                  default: withCtx(() => [
                    createBaseVNode("span", _hoisted_2, [
                      createVNode(TaskPriorityFlagIcon, {
                        color: p.flagColor,
                        outline: p.flagOutline
                      }, null, 8, ["color", "outline"]),
                      createBaseVNode("span", _hoisted_3, [
                        createBaseVNode("span", _hoisted_4, toDisplayString(p.code), 1),
                        createBaseVNode("span", _hoisted_5, toDisplayString(p.label), 1)
                      ]),
                      modelValue.value === p.value ? (openBlock(), createBlock(_component_el_icon, {
                        key: 0,
                        class: "priority-flag-menu__check"
                      }, {
                        default: withCtx(() => [
                          createVNode(unref(check_default))
                        ]),
                        _: 1
                      })) : createCommentVNode("", true)
                    ])
                  ]),
                  _: 2
                }, 1032, ["command", "class"]);
              }), 128))
            ]),
            _: 1
          })
        ]),
        default: withCtx(() => [
          createBaseVNode("button", {
            type: "button",
            class: "priority-flag-menu__trigger",
            title: `${currentMeta.value.code} · ${currentMeta.value.label}`,
            "aria-label": `任务级别：${currentMeta.value.code} ${currentMeta.value.label}`
          }, [
            createVNode(TaskPriorityFlagIcon, {
              color: currentMeta.value.flagColor,
              outline: currentMeta.value.flagOutline
            }, null, 8, ["color", "outline"])
          ], 8, _hoisted_1)
        ]),
        _: 1
      });
    };
  }
});
const TaskPriorityFlagMenu = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-32026a50"]]);
export {
  QuickAddInput as Q,
  REMIND_CUSTOM_UNITS as R,
  TaskPriorityFlagMenu as T,
  normalizeCategoryKeyword as a,
  buildQuickCreateTaskDtoFromDraft as b,
  customOffsetToMinutes as c,
  REMIND_OFFSET_PRESETS as d,
  buildRemindersFromOffsets as e,
  findCategoryKeywordConflict as f,
  RECURRENCE_CUSTOM_UNITS as g,
  nextDueAfterRecurrence as h,
  recurrenceLabel as i,
  assertRemindersBeforeDue as j,
  normalizeCategoryKeywords as n,
  remindAtFromDueOffset as r,
  toParseCategories as t
};
