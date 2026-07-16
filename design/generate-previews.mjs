import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const THEMES = {
  notion: {
    file: 'home-notion-preview.html',
    title: 'Notion',
    ref: 'DESIGN-notion.md',
    font: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    fontDisplay: '"Inter", sans-serif',
    primary: '#0075de',
    primaryActive: '#005bab',
    ink: '#000000',
    body: '#31302e',
    muted: '#615d59',
    canvas: '#ffffff',
    canvasSoft: '#f6f5f4',
    hairline: '#e6e6e6',
    radius: '8px',
    radiusLg: '12px',
    radiusPill: '9999px',
    btnStyle: 'pill',
    headerBg: '#ffffff',
    panelBg: '#f6f5f4',
    accent: '#62aef0',
    accent2: '#d6b6f6',
    accent3: '#ff64c8',
    shadow: 'none',
    topBar: 'light',
    tagline: '温暖纸感 · 单一蓝色 · 贴纸色点缀'
  },
  figma: {
    file: 'home-figma-preview.html',
    title: 'Figma',
    ref: 'DESIGN-figma.md',
    font: '"DM Sans", -apple-system, sans-serif',
    fontDisplay: '"DM Sans", sans-serif',
    primary: '#000000',
    primaryActive: '#000000',
    ink: '#000000',
    body: '#000000',
    muted: '#666666',
    canvas: '#ffffff',
    canvasSoft: '#f7f7f5',
    hairline: '#e6e6e6',
    radius: '8px',
    radiusLg: '24px',
    radiusPill: '50px',
    btnStyle: 'pill-black',
    headerBg: '#ffffff',
    panelBg: '#dceeb1',
    accent: '#c5b0f4',
    accent2: '#f4ecd6',
    accent3: '#ff3d8b',
    shadow: 'none',
    topBar: 'light',
    tagline: '黑白编辑框 · 超大粉彩色块 · 药丸 CTA'
  },
  cursor: {
    file: 'home-cursor-preview.html',
    title: 'Cursor',
    ref: 'DESIGN-cursor.md',
    font: '"IBM Plex Sans", -apple-system, sans-serif',
    fontDisplay: '"IBM Plex Sans", sans-serif',
    primary: '#f54e00',
    primaryActive: '#d04200',
    ink: '#26251e',
    body: '#5a5852',
    muted: '#807d72',
    canvas: '#f7f7f4',
    canvasSoft: '#fafaf7',
    hairline: '#e6e5e0',
    radius: '8px',
    radiusLg: '12px',
    radiusPill: '8px',
    btnStyle: 'rect',
    headerBg: '#f7f7f4',
    panelBg: '#fafaf7',
    accent: '#dfa88f',
    accent2: '#9fc9a2',
    accent3: '#9fbbe0',
    shadow: 'none',
    topBar: 'cream',
    tagline: '暖奶油画布 · Cursor Orange · 时间线粉彩'
  },
  clay: {
    file: 'home-clay-preview.html',
    title: 'Clay',
    ref: 'DESIGN-clay.md',
    font: '"Inter", sans-serif',
    fontDisplay: '"Inter", sans-serif',
    primary: '#0a0a0a',
    primaryActive: '#1f1f1f',
    ink: '#0a0a0a',
    body: '#3a3a3a',
    muted: '#6a6a6a',
    canvas: '#fffaf0',
    canvasSoft: '#faf5e8',
    hairline: '#e5e5e5',
    radius: '12px',
    radiusLg: '16px',
    radiusPill: '12px',
    btnStyle: 'rect',
    headerBg: '#fffaf0',
    panelBg: '#f5f0e0',
    accent: '#ff4d8b',
    accent2: '#b8a4ed',
    accent3: '#ffb084',
    shadow: '0 4px 20px rgba(0,0,0,0.06)',
    topBar: 'warm',
    tagline: '奶油画布 · 饱和色卡 · 圆润 Display'
  },
  claude: {
    file: 'home-claude-preview.html',
    title: 'Claude',
    ref: 'DESIGN-claude.md',
    font: '"Source Sans 3", sans-serif',
    fontDisplay: '"Libre Baskerville", Georgia, serif',
    primary: '#cc785c',
    primaryActive: '#a9583e',
    ink: '#141413',
    body: '#3d3d3a',
    muted: '#6c6a64',
    canvas: '#faf9f5',
    canvasSoft: '#f5f0e8',
    hairline: '#e6dfd8',
    radius: '8px',
    radiusLg: '12px',
    radiusPill: '8px',
    btnStyle: 'rect',
    headerBg: '#faf9f5',
    panelBg: '#efe9de',
    accent: '#5db8a6',
    accent2: '#e8a55a',
    accent3: '#cc785c',
    shadow: 'none',
    topBar: 'cream',
    tagline: '奶油编辑 · 珊瑚 CTA · 衬线标题'
  },
  airtable: {
    file: 'home-airtable-preview.html',
    title: 'Airtable',
    ref: 'DESIGN-airtable.md',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontDisplay: '"Helvetica Neue", sans-serif',
    primary: '#181d26',
    primaryActive: '#0d1218',
    ink: '#181d26',
    body: '#333840',
    muted: '#41454d',
    canvas: '#ffffff',
    canvasSoft: '#f8fafc',
    hairline: '#dddddd',
    radius: '10px',
    radiusLg: '12px',
    radiusPill: '9999px',
    btnStyle: 'pill-dark',
    headerBg: '#ffffff',
    panelBg: '#f8fafc',
    accent: '#aa2d00',
    accent2: '#0a2e0e',
    accent3: '#fcab79',
    shadow: 'none',
    topBar: 'light',
    tagline: '编辑工作流 · 近黑药丸 CTA · 签名色卡'
  },
  airbnb: {
    file: 'home-airbnb-preview.html',
    title: 'Airbnb',
    ref: 'DESIGN-airbnb.md',
    font: '"Circular", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontDisplay: '"Circular", sans-serif',
    primary: '#ff385c',
    primaryActive: '#e00b41',
    ink: '#222222',
    body: '#3f3f3f',
    muted: '#6a6a6a',
    canvas: '#ffffff',
    canvasSoft: '#f7f7f7',
    hairline: '#dddddd',
    radius: '14px',
    radiusLg: '20px',
    radiusPill: '9999px',
    btnStyle: 'airbnb',
    headerBg: '#ffffff',
    panelBg: '#f7f7f7',
    accent: '#ff385c',
    accent2: '#460479',
    accent3: '#92174d',
    shadow: '0 6px 16px rgba(0,0,0,0.08)',
    topBar: 'light',
    tagline: 'Rausch 红 · 药丸搜索 · 圆润友好'
  }
}

function btnRadius(t) {
  if (t.btnStyle === 'pill' || t.btnStyle === 'pill-black' || t.btnStyle === 'pill-dark' || t.btnStyle === 'airbnb') {
    return t.radiusPill
  }
  return t.radius
}

function btnPrimary(t) {
  const r = btnRadius(t)
  const bg = t.btnStyle === 'pill-black' ? '#000' : t.primary
  const color = '#fff'
  return `background:${bg};color:${color};border-radius:${r};border:none;`
}

function buildHtml(key, t) {
  const btnR = btnRadius(t)
  const topColor = t.topBar === 'cream' || t.topBar === 'warm' ? t.ink : t.topBar === 'light' ? t.ink : '#fff'
  const topBg = t.headerBg

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>aiTodo Desktop — ${t.title} 风格首页概念稿</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=IBM+Plex+Sans:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: ${t.primary};
      --primary-active: ${t.primaryActive};
      --ink: ${t.ink};
      --body: ${t.body};
      --muted: ${t.muted};
      --canvas: ${t.canvas};
      --canvas-soft: ${t.canvasSoft};
      --hairline: ${t.hairline};
      --accent: ${t.accent};
      --accent2: ${t.accent2};
      --accent3: ${t.accent3};
      --font: ${t.font};
      --font-display: ${t.fontDisplay};
      --radius: ${t.radius};
      --radius-lg: ${t.radiusLg};
      --radius-pill: ${t.radiusPill};
      --shadow: ${t.shadow};
      --panel-w: 248px;
      --rail-w: 52px;
      --detail-w: 380px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.5;
      color: var(--ink);
      background: var(--canvas-soft);
      -webkit-font-smoothing: antialiased;
    }
    .shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .topbar {
      height: 52px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${topBg};
      border-bottom: 1px solid var(--hairline);
      flex-shrink: 0;
    }
    .topbar__brand {
      display: flex; align-items: center; gap: 10px;
      font-family: var(--font-display);
      font-size: 18px; font-weight: 600; color: ${topColor};
      letter-spacing: -0.3px;
    }
    .topbar__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    .topbar__nav { display: flex; gap: 18px; list-style: none; }
    .topbar__link {
      font-size: 14px; color: var(--muted); text-decoration: none;
    }
    .topbar__link.is-active { color: var(--ink); font-weight: 600; }
    .topbar__actions { display: flex; gap: 8px; align-items: center; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      height: 36px; padding: 0 16px; font-size: 14px; font-weight: 500;
      cursor: pointer; transition: transform .12s, opacity .12s;
      ${btnPrimary(t)}
    }
    .btn:active { transform: scale(0.96); }
    .btn--ghost {
      background: transparent; color: var(--ink);
      border: 1px solid var(--hairline); border-radius: ${btnR};
    }
    .btn--secondary {
      background: var(--canvas); color: var(--ink);
      border: 1px solid var(--hairline); border-radius: ${btnR};
    }
    .app { flex: 1; display: flex; min-height: 0; }
    .rail {
      width: var(--rail-w); background: var(--canvas);
      border-right: 1px solid var(--hairline);
      display: flex; flex-direction: column; align-items: center;
      padding: 10px 0; gap: 4px; flex-shrink: 0;
    }
    .rail__btn {
      width: 38px; height: 38px; border: none; border-radius: var(--radius);
      background: transparent; color: var(--muted); cursor: pointer;
      display: grid; place-items: center;
    }
    .rail__btn.is-active { background: var(--canvas-soft); color: var(--primary); }
    .rail__btn svg { width: 18px; height: 18px; }
    .panel {
      width: var(--panel-w); background: ${t.panelBg};
      border-right: 1px solid var(--hairline);
      display: flex; flex-direction: column; flex-shrink: 0;
    }
    .panel__search { padding: 12px 14px; }
    .search {
      width: 100%; height: 36px; padding: 0 12px;
      border: 1px solid var(--hairline); border-radius: var(--radius-pill);
      background: var(--canvas); font-family: var(--font); font-size: 14px;
      outline: none;
    }
    .search:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent); }
    .panel__scroll { flex: 1; overflow-y: auto; padding: 6px 8px 16px; }
    .panel__label {
      padding: 10px 10px 4px; font-size: 11px; font-weight: 600;
      color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px;
    }
    .panel__row {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 8px 10px; border: none; border-radius: var(--radius);
      background: transparent; color: var(--body); font-size: 14px;
      text-align: left; cursor: pointer;
    }
    .panel__row:hover { background: color-mix(in srgb, var(--ink) 4%, transparent); }
    .panel__row.is-active {
      background: var(--canvas); color: var(--ink); font-weight: 500;
      box-shadow: var(--shadow);
    }
    .panel__count { margin-left: auto; font-size: 12px; color: var(--muted); }
    .workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--canvas); position: relative; }
    .header {
      padding: 18px 24px 14px;
      border-bottom: 1px solid var(--hairline);
      display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    }
    .header__title {
      font-family: var(--font-display);
      font-size: 28px; font-weight: 600; letter-spacing: -0.5px;
      color: var(--ink); line-height: 1.15;
    }
    .header__meta { margin-top: 4px; font-size: 13px; color: var(--muted); }
    .header__actions { display: flex; gap: 8px; }
    .color-band {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
      padding: 16px 24px 8px;
    }
    .stat {
      padding: 16px; border-radius: var(--radius-lg);
      border: 1px solid var(--hairline); background: var(--canvas);
    }
    .stat:nth-child(1) { background: color-mix(in srgb, var(--accent) 22%, var(--canvas)); border-color: transparent; }
    .stat:nth-child(2) { background: color-mix(in srgb, var(--accent2) 28%, var(--canvas)); border-color: transparent; }
    .stat:nth-child(3) { background: color-mix(in srgb, var(--accent3) 18%, var(--canvas)); border-color: transparent; }
    .stat__n { font-family: var(--font-display); font-size: 26px; font-weight: 600; }
    .stat__l { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .chips { display: flex; gap: 8px; padding: 8px 24px 12px; flex-wrap: wrap; }
    .chip {
      height: 32px; padding: 0 14px; border-radius: var(--radius-pill);
      border: 1px solid var(--hairline); background: var(--canvas);
      font-size: 13px; color: var(--body); cursor: pointer;
    }
    .chip.is-on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .main { flex: 1; display: flex; min-height: 0; padding-right: var(--detail-w); }
    .quick {
      margin: 0 24px 12px; display: flex; align-items: center; gap: 10px;
      height: 44px; padding: 0 14px; border-radius: var(--radius-pill);
      border: 1px solid var(--hairline); background: var(--canvas-soft);
    }
    .quick input {
      flex: 1; border: none; background: transparent; font-size: 15px;
      font-family: var(--font); outline: none; color: var(--ink);
    }
    .tasks { flex: 1; overflow-y: auto; padding: 0 24px 24px; }
    .group { margin-bottom: 18px; }
    .group__h { font-size: 12px; font-weight: 600; color: var(--muted); padding: 8px 4px; }
    .task {
      display: flex; gap: 12px; padding: 12px; margin-bottom: 6px;
      border-radius: var(--radius-lg); border: 1px solid transparent; cursor: pointer;
    }
    .task:hover { background: var(--canvas-soft); }
    .task.is-on { border-color: var(--hairline); background: var(--canvas); box-shadow: var(--shadow); }
    .check {
      width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--hairline);
      flex-shrink: 0; margin-top: 2px;
    }
    .task__title { font-size: 15px; color: var(--ink); }
    .task__meta { margin-top: 4px; font-size: 12px; color: var(--muted); display: flex; gap: 8px; flex-wrap: wrap; }
    .tag {
      padding: 2px 8px; border-radius: var(--radius-pill); font-size: 11px;
      background: color-mix(in srgb, var(--primary) 10%, var(--canvas));
      color: var(--primary);
    }
    .detail {
      position: absolute; top: 0; right: 0; bottom: 0; width: var(--detail-w);
      background: var(--canvas-soft); border-left: 1px solid var(--hairline);
      display: flex; flex-direction: column;
    }
    .detail__head { padding: 22px 22px 14px; background: var(--canvas); border-bottom: 1px solid var(--hairline); }
    .detail__eyebrow { font-size: 11px; color: var(--muted); margin-bottom: 6px; }
    .detail__title { font-family: var(--font-display); font-size: 22px; font-weight: 600; line-height: 1.25; }
    .detail__body { flex: 1; overflow-y: auto; padding: 18px 22px; font-size: 14px; color: var(--body); line-height: 1.55; }
    .detail__foot { padding: 14px 22px; border-top: 1px solid var(--hairline); display: flex; gap: 8px; background: var(--canvas); }
    .detail__foot .btn, .detail__foot .btn--ghost { flex: 1; height: 40px; }
    .footer {
      padding: 8px 24px; font-size: 11px; color: var(--muted);
      border-top: 1px solid var(--hairline); background: var(--canvas-soft);
      display: flex; justify-content: space-between;
    }
    .ref-badge {
      display: inline-block; margin-left: 8px; padding: 2px 8px;
      border-radius: var(--radius-pill); font-size: 10px; font-weight: 600;
      background: color-mix(in srgb, var(--primary) 12%, var(--canvas));
      color: var(--primary); vertical-align: middle;
    }
    @media (max-width: 1100px) {
      .detail { display: none; }
      .main { padding-right: 0; }
      .color-band { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) { .panel { display: none; } }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="topbar__brand"><span class="topbar__dot"></span>aiTodo <span class="ref-badge">${t.title}</span></div>
      <ul class="topbar__nav">
        <li><a class="topbar__link is-active" href="#">任务</a></li>
        <li><a class="topbar__link" href="#">日历</a></li>
        <li><a class="topbar__link" href="#">看板</a></li>
        <li><a class="topbar__link" href="#">四象限</a></li>
      </ul>
      <div class="topbar__actions">
        <button class="btn--ghost btn" style="height:32px;padding:0 12px">消息</button>
        <button class="btn" style="height:32px;padding:0 14px">设置</button>
      </div>
    </header>
    <div class="app">
      <nav class="rail">
        <button class="rail__btn is-active" title="任务"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg></button>
        <button class="rail__btn" title="日历"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg></button>
        <button class="rail__btn" title="看板"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h10M4 18h14"/></svg></button>
      </nav>
      <aside class="panel">
        <div class="panel__search"><input class="search" placeholder="搜索任务…" /></div>
        <div class="panel__scroll">
          <div class="panel__label">智能清单</div>
          <button class="panel__row"><span>全部</span><span class="panel__count">24</span></button>
          <button class="panel__row is-active"><span>今天</span><span class="panel__count">5</span></button>
          <button class="panel__row"><span>本周</span><span class="panel__count">12</span></button>
          <button class="panel__row"><span>收件箱</span><span class="panel__count">3</span></button>
          <div class="panel__label">清单</div>
          <button class="panel__row"><span>工作</span><span class="panel__count">9</span></button>
          <button class="panel__row"><span>个人</span><span class="panel__count">6</span></button>
          <button class="panel__row"><span>学习</span><span class="panel__count">4</span></button>
        </div>
      </aside>
      <main class="workspace">
        <header class="header">
          <div>
            <h1 class="header__title">今天</h1>
            <p class="header__meta">5 项待办 · 2 项今日到期 · ${t.tagline}</p>
          </div>
          <div class="header__actions">
            <button class="btn--ghost btn" style="height:34px">筛选</button>
            <button class="btn" style="height:34px">+ 新建任务</button>
          </div>
        </header>
        <div class="main">
          <section style="flex:1;display:flex;flex-direction:column;min-width:0">
            <div class="color-band">
              <div class="stat"><div class="stat__n">5</div><div class="stat__l">待办</div></div>
              <div class="stat"><div class="stat__n">2</div><div class="stat__l">今日到期</div></div>
              <div class="stat"><div class="stat__n">1</div><div class="stat__l">进行中</div></div>
              <div class="stat"><div class="stat__n">3</div><div class="stat__l">高优先级</div></div>
            </div>
            <nav class="chips">
              <button class="chip is-on">列表</button>
              <button class="chip">看板</button>
              <button class="chip">日历</button>
              <button class="chip">四象限</button>
            </nav>
            <div class="quick">
              <input placeholder="添加任务，按回车创建" />
              <button class="btn" style="height:30px;padding:0 12px;font-size:12px">截止</button>
            </div>
            <div class="tasks">
              <div class="group">
                <div class="group__h">已逾期</div>
                <article class="task is-on">
                  <div class="check"></div>
                  <div>
                    <div class="task__title">完成 Desktop 首页 ${t.title} 风格视觉稿</div>
                    <div class="task__meta"><span class="tag">昨天 18:00</span><span class="tag">#设计</span><span>进行中</span></div>
                  </div>
                </article>
              </div>
              <div class="group">
                <div class="group__h">今天</div>
                <article class="task">
                  <div class="check"></div>
                  <div>
                    <div class="task__title">联调多提醒与法定节假日循环</div>
                    <div class="task__meta"><span class="tag">今天 14:30</span><span>工作</span></div>
                  </div>
                </article>
                <article class="task">
                  <div class="check"></div>
                  <div>
                    <div class="task__title">Review PR：看板分组拖拽修复</div>
                    <div class="task__meta"><span>今天</span><span>#代码审查</span></div>
                  </div>
                </article>
              </div>
            </div>
          </section>
          <aside class="detail">
            <header class="detail__head">
              <div class="detail__eyebrow">任务详情 · 参照 ${t.ref}</div>
              <h2 class="detail__title">完成 Desktop 首页 ${t.title} 风格视觉稿</h2>
            </header>
            <div class="detail__body">
              本页为 aiTodo Desktop 首页概念稿，沿用三栏布局（图标轨 + 侧栏 + 列表 + 详情），视觉语言取自 <strong>${t.ref}</strong>：${t.tagline}。
            </div>
            <footer class="detail__foot">
              <button class="btn--ghost btn">删除</button>
              <button class="btn">保存</button>
            </footer>
          </aside>
        </div>
        <footer class="footer">
          <span>aiTodo Desktop · ${t.title} Design Concept</span>
          <span>本地 SQLite · 无云同步</span>
        </footer>
      </main>
    </div>
  </div>
</body>
</html>`
}

for (const [key, theme] of Object.entries(THEMES)) {
  const out = path.join(__dirname, theme.file)
  fs.writeFileSync(out, buildHtml(key, theme), 'utf8')
  console.log('wrote', theme.file)
}
