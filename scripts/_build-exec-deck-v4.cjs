// Exec Awareness Deck V4 — "everything an executive can do, how to do it,
// every insight available, and exactly where it lives in the portal."
// Output: Desktop/PMO-Portal-Deliverables/PMO-Exec-Deck-V4.{html,pdf}
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PMO Portal — Executive Awareness Deck V4</title>
<style>
  /* GT Planar — Tree Digital's official English typeface. Loaded locally
     from the brand-assets folder so the PDF embeds the true brand font.
     Falls back to Inter if the file path is unavailable (e.g. when the
     HTML is opened on a machine without the asset pack). */
  @font-face {
    font-family: 'GT Planar';
    font-weight: 300;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Light-Trial-BF63bcd77b74df6.otf') format('opentype');
  }
  @font-face {
    font-family: 'GT Planar';
    font-weight: 400;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Regular-Trial-BF63bcd9a5c44bb.otf') format('opentype');
  }
  @font-face {
    font-family: 'GT Planar';
    font-weight: 500;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Medium-Trial-BF63bcd77600d58.otf') format('opentype');
  }
  @font-face {
    font-family: 'GT Planar';
    font-weight: 700;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Bold-Trial-BF63bcd77557486.otf') format('opentype');
  }
  @font-face {
    font-family: 'GT Planar';
    font-weight: 900;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Black-Trial-BF63bcd77b41460.otf') format('opentype');
  }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --canopy: #003932; --canopy-2: #005c4b; --canopy-3: #007a62;
    --sea: #00FFB3; --sea-mid: #00b894; --sea-lt: #e6f9f5;
    --orange: #FF5000; --orange-tint: #ffd9c2; --orange-soft: #fff5ee;
    --maroon: #490300; --maroon-tint: #f0d4d0;
    --moss: #A1B9AB; --moss-dark: #5a7a6e;
    --lichen: #C9D5C9; --lichen-lt: #ecf2ed;
    --amber: #f59e0b; --amber-lt: #fffbeb;
    --blue: #3b82f6; --blue-lt: #eff6ff; --blue-dark: #1e40af;
    --red: #ef4444; --red-lt: #fef2f2;
    --ink: #0d1f1c; --muted: #4b6c67; --border: #d1e8e4;
    --bg: #f5faf9; --white: #ffffff;
  }
  body {
    font-family: 'GT Planar', 'Inter', sans-serif;
    background: #1a1a1a;
    color: var(--ink);
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .slide {
    width: 297mm; min-height: 210mm;
    background: white;
    margin: 8mm auto;
    position: relative;
    box-shadow: 0 6px 40px rgba(0,0,0,0.35);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  @media print {
    body { background: white; }
    .slide { margin: 0; box-shadow: none; page-break-after: always; }
    .slide:last-child { page-break-after: avoid; }
    @page { size: A4 landscape; margin: 0; }
  }

  /* ── SLIDE HEAD / FOOT ── */
  .s-head {
    padding: 12px 32px;
    display: flex; align-items: center; gap: 10px;
    background: var(--white);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .s-head .logo {
    background: var(--canopy); color: var(--sea);
    font-weight: 900; font-size: 10px;
    padding: 4px 9px; border-radius: 4px; letter-spacing: 0.5px;
  }
  .s-head .crumb { color: var(--moss-dark); font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
  .s-head .num { margin-left: auto; color: var(--canopy); font-size: 10px; font-weight: 800; }
  .s-foot {
    padding: 9px 32px;
    display: flex; justify-content: space-between; align-items: center;
    background: var(--lichen-lt);
    border-top: 1px solid var(--border);
    font-size: 9px; color: var(--moss-dark); flex-shrink: 0;
  }
  .s-foot .doc-name { font-weight: 700; color: var(--canopy); }

  .body { flex: 1; padding: 18px 36px 14px; display: flex; flex-direction: column; }

  /* ── COVER ── */
  .cover-body {
    background: linear-gradient(140deg, #001f1a 0%, #003932 50%, #007a62 100%);
    color: white;
    padding: 30mm 24mm 22mm;
    flex: 1;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative; overflow: hidden;
    border-bottom: 5px solid var(--sea);
  }
  .cover-body::after {
    content: ''; position: absolute;
    bottom: -160px; right: -160px;
    width: 500px; height: 500px;
    background: rgba(0,255,179,0.08);
    border-radius: 50%;
  }
  .cover-body::before {
    content: ''; position: absolute;
    top: -100px; left: -100px;
    width: 280px; height: 280px;
    background: rgba(0,255,179,0.05);
    border-radius: 50%;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: center; z-index: 2; }
  .cover-brand { display: flex; align-items: center; gap: 14px; }
  /* Official Tree wordmark — sea-green variant for dark Canopy backgrounds */
  .cover-brand .logo { height: 44px; width: auto; display: block; }
  .cover-brand .name { color: white; font-weight: 800; font-size: 13px; }
  .cover-brand .sub { color: rgba(255,255,255,0.55); font-size: 9.5px; font-weight: 400; margin-top: 1px; }
  .cover-version {
    background: var(--sea); color: var(--canopy);
    padding: 5px 14px; border-radius: 10px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
  }

  .cover-mid { z-index: 2; }
  .cover-mid .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,255,179,0.18);
    border: 1px solid rgba(0,255,179,0.35);
    color: var(--sea);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 22px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
  }
  .cover-mid .badge .d { width: 7px; height: 7px; background: var(--sea); border-radius: 50%; box-shadow: 0 0 8px var(--sea); }
  .cover-mid h1 { color: white; font-size: 46pt; font-weight: 900; letter-spacing: -1.4px; line-height: 1.0; margin-bottom: 14px; }
  .cover-mid h1 em { color: var(--sea); font-style: normal; }
  .cover-mid .lead { color: rgba(255,255,255,0.74); font-size: 13pt; font-weight: 400; line-height: 1.55; max-width: 70%; }

  .cover-foot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; z-index: 2; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 20px; }
  .cover-foot .item .l { color: rgba(0,255,179,0.75); font-size: 9pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-foot .item .v { color: white; font-size: 10.5pt; font-weight: 600; line-height: 1.35; }

  /* ── SLIDE TITLE ── */
  .s-title-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
  .s-label {
    display: inline-block;
    background: var(--sea-lt); color: var(--canopy);
    border: 1px solid #a7f3d0;
    padding: 4px 12px; border-radius: 14px;
    font-size: 9pt; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
    margin-bottom: 8px;
  }
  h2.s-title { font-size: 24pt; font-weight: 900; color: var(--canopy); letter-spacing: -0.5px; line-height: 1.05; }
  .s-sub { font-size: 11pt; color: var(--muted); margin-top: 4px; }

  /* ── 2-COL LAYOUT ── */
  .col2 { display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px; flex: 1; }
  .col-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; flex: 1; }
  .col3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; flex: 1; }

  /* ── UI MOCKUP CARD ── */
  .mock {
    background: linear-gradient(180deg, var(--lichen-lt) 0%, white 100%);
    border: 1.5px solid var(--lichen);
    border-radius: 12px;
    padding: 14px;
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .mock .mock-cap {
    font-size: 8.5pt; color: var(--moss-dark); font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-top: 10px; text-align: center; padding-top: 8px; border-top: 1px dashed var(--border);
  }

  /* ── DESCRIPTIVE CARD ── */
  .desc { display: flex; flex-direction: column; gap: 12px; }
  .desc h3 { font-size: 13pt; font-weight: 800; color: var(--canopy); margin-bottom: 4px; }
  .desc p { font-size: 10.5pt; color: var(--ink); line-height: 1.55; }
  .desc .bullets { margin: 6px 0 0 16px; }
  .desc .bullets li { font-size: 10pt; color: var(--ink); line-height: 1.6; margin-bottom: 4px; }

  /* ── BLOCK: "WHAT YOU SEE / DO" ── */
  .ws {
    background: var(--white);
    border: 1.5px solid var(--lichen);
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
  }
  .ws .lbl {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 8.5pt; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;
    color: var(--canopy); margin-bottom: 7px;
  }
  .ws.see .lbl::before { content: '👁'; font-size: 11pt; }
  .ws.do .lbl::before  { content: '⚡'; font-size: 11pt; }
  .ws.where .lbl::before { content: '📍'; font-size: 11pt; }
  .ws.act .lbl::before { content: '🎯'; font-size: 11pt; }
  .ws p { font-size: 10pt; color: var(--ink); line-height: 1.55; margin-bottom: 4px; }
  .ws ul { margin: 4px 0 0 16px; }
  .ws li { font-size: 9.5pt; color: var(--ink); line-height: 1.55; margin-bottom: 2px; }
  .ws code {
    background: var(--lichen-lt); color: var(--canopy);
    padding: 1px 6px; border-radius: 4px;
    font-family: 'JetBrains Mono', monospace; font-size: 9pt;
  }

  /* ── CHIPS ── */
  .chip { display: inline-block; padding: 2px 9px; border-radius: 10px; font-size: 9pt; font-weight: 700; }
  .chip.green { background: #dcfce7; color: #166534; }
  .chip.amber { background: #fef3c7; color: #92400e; }
  .chip.orange { background: var(--orange-tint); color: #9a3412; }
  .chip.red { background: var(--maroon-tint); color: var(--maroon); }
  .chip.blue { background: var(--blue-lt); color: var(--blue-dark); }
  .chip.grey { background: var(--lichen); color: var(--moss-dark); }
  .chip.sea { background: #ccfff0; color: var(--canopy); }

  /* ── TOC ── */
  .toc { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin-top: 8px; flex: 1; align-content: start; }
  .toc-item { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px dashed var(--border); }
  .toc-item .n { width: 26px; height: 26px; background: var(--sea-lt); color: var(--canopy); border-radius: 50%; font-size: 10pt; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; }
  .toc-item .t { flex: 1; }
  .toc-item .tn { font-size: 11pt; font-weight: 700; color: var(--canopy); }
  .toc-item .td { font-size: 9.5pt; color: var(--muted); margin-top: 1px; }
  .toc-item .p { background: var(--canopy); color: var(--sea); font-size: 8.5pt; font-weight: 700; padding: 3px 8px; border-radius: 10px; }

  /* ── TABLES ── */
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 6px 0; }
  table th {
    background: var(--canopy); color: white;
    padding: 7px 12px; text-align: left;
    font-size: 9pt; font-weight: 700; letter-spacing: 0.3px;
  }
  table th:first-child { border-radius: 6px 0 0 0; }
  table th:last-child { border-radius: 0 6px 0 0; }
  table td { padding: 8px 12px; border-bottom: 1px solid var(--border); line-height: 1.45; }
  table tr:nth-child(even) td { background: var(--lichen-lt); }
  table td.k { font-weight: 700; color: var(--canopy); }

  /* ── PLAIN-LANGUAGE BOX ── */
  .plain { background: var(--lichen-lt); border-left: 4px solid var(--moss-dark); border-radius: 0 10px 10px 0; padding: 11px 14px; display: flex; gap: 10px; margin-top: 10px; }
  .plain .ic { font-size: 19px; flex-shrink: 0; line-height: 1; padding-top: 2px; }
  .plain .ct { flex: 1; }
  .plain .lb { font-size: 8.5pt; font-weight: 800; color: var(--canopy); letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 3px; }
  .plain p { font-size: 10.5pt; line-height: 1.5; color: var(--ink); margin: 0; font-weight: 500; }

  /* ── STAT TILES ── */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0; }
  .stat { background: white; border: 1.5px solid var(--lichen); border-radius: 10px; padding: 14px; text-align: center; }
  .stat .num { font-family: 'JetBrains Mono', monospace; font-size: 26pt; font-weight: 700; color: var(--canopy); line-height: 1; }
  .stat .lbl { font-size: 8.5pt; color: var(--moss-dark); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
  .stat .sub { font-size: 9pt; color: var(--muted); margin-top: 3px; }

  /* ── ROUTE PATH ── */
  .route {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--canopy); color: var(--sea);
    padding: 3px 10px; border-radius: 7px;
    font-family: 'JetBrains Mono', monospace; font-size: 9pt; font-weight: 600;
  }
  .route .sep { color: rgba(0,255,179,0.4); }
</style>
</head>
<body>

<!-- ═══════════════════════ COVER ═══════════════════════ -->
<div class="slide">
  <div class="cover-body">
    <div class="cover-top">
      <div class="cover-brand">
        <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree" />
        <div>
          <div class="name">Tree Digital Insurance Company</div>
          <div class="sub">Project Management Office · Enterprise Portal</div>
        </div>
      </div>
      <div class="cover-version">V4 · 23 June 2026</div>
    </div>

    <div class="cover-mid">
      <div class="badge"><div class="d"></div><span>Executive Awareness Deck</span></div>
      <h1>The PMO Portal,<br>at your<br><em>executive lens</em></h1>
      <div class="lead">Every capability the portal places at your disposal — what you can do, how to do it, every insight available, and where to find each one. Issued by the Project Management Office for executive, departmental, and audit leadership.</div>
    </div>

    <div class="cover-foot">
      <div class="item"><div class="l">Issued by</div><div class="v">Project Management Office<br>Tree Digital Insurance Company</div></div>
      <div class="item"><div class="l">Effective</div><div class="v">23 June 2026<br>Version 4</div></div>
      <div class="item"><div class="l">Audience</div><div class="v">Executive Committee<br>Department Heads · Internal Audit</div></div>
    </div>
  </div>
</div>

<!-- ═══════════════════════ TOC ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Executive Awareness Deck · Contents</div><div class="num">02</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Navigation</div>
        <h2 class="s-title">What this deck covers</h2>
        <div class="s-sub">Fifteen slides · scan from cover to cover in ten minutes, or jump straight to the screen you want to understand.</div>
      </div>
    </div>
    <div class="toc">
      <div class="toc-item"><div class="n">01</div><div class="t"><div class="tn">The Executive Lens</div><div class="td">What the portal gives leadership</div></div><div class="p">p.3</div></div>
      <div class="toc-item"><div class="n">02</div><div class="t"><div class="tn">Your morning check, in 60 seconds</div><div class="td">The daily routine in one slide</div></div><div class="p">p.4</div></div>
      <div class="toc-item"><div class="n">03</div><div class="t"><div class="tn">Home — anatomy of the dashboard</div><div class="td">Every region labelled, what each tells you</div></div><div class="p">p.5</div></div>
      <div class="toc-item"><div class="n">04</div><div class="t"><div class="tn">Executive Intervention Panel</div><div class="td">Projects flagged for your attention</div></div><div class="p">p.6</div></div>
      <div class="toc-item"><div class="n">05</div><div class="t"><div class="tn">Portfolio IPI &amp; Forecast Overrun</div><div class="td">The headline numbers and where they sit</div></div><div class="p">p.7</div></div>
      <div class="toc-item"><div class="n">06</div><div class="t"><div class="tn">Gate Pipeline &amp; Approvals</div><div class="td">Where work is queued, what awaits sign-off</div></div><div class="p">p.8</div></div>
      <div class="toc-item"><div class="n">07</div><div class="t"><div class="tn">Department Performance</div><div class="td">Comparison view across all twelve units</div></div><div class="p">p.9</div></div>
      <div class="toc-item"><div class="n">08</div><div class="t"><div class="tn">Project header &amp; Performance banner</div><div class="td">The two answers an executive scans for first</div></div><div class="p">p.10</div></div>
      <div class="toc-item"><div class="n">09</div><div class="t"><div class="tn">Reading the IPI breakdown</div><div class="td">SPI, CPI, MCI — and the anticipated drop</div></div><div class="p">p.11</div></div>
      <div class="toc-item"><div class="n">10</div><div class="t"><div class="tn">Activities &amp; Gantt</div><div class="td">Visual schedule with past-time fade</div></div><div class="p">p.12</div></div>
      <div class="toc-item"><div class="n">11</div><div class="t"><div class="tn">Project Print Report</div><div class="td">The executive one-pager you can hand around</div></div><div class="p">p.13</div></div>
      <div class="toc-item"><div class="n">12</div><div class="t"><div class="tn">GRC Risk Intelligence Dashboard</div><div class="td">KRIs, risks, audit findings in one view</div></div><div class="p">p.14</div></div>
      <div class="toc-item"><div class="n">13</div><div class="t"><div class="tn">GRC Quarterly Print Report</div><div class="td">Executive Command Centre on paper</div></div><div class="p">p.15</div></div>
      <div class="toc-item"><div class="n">14</div><div class="t"><div class="tn">Reading the colour code</div><div class="td">One legend for every status badge</div></div><div class="p">p.16</div></div>
      <div class="toc-item"><div class="n">15</div><div class="t"><div class="tn">Where to find what</div><div class="td">Navigation cheat sheet · governance reference</div></div><div class="p">p.17</div></div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 01 EXEC LENS ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 1 · The Executive Lens</div><div class="num">03</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 1</div>
        <h2 class="s-title">The Executive Lens</h2>
        <div class="s-sub">What the portal puts at leadership's disposal — at a glance.</div>
      </div>
    </div>
    <div class="col-eq">
      <div class="desc">
        <h3>One window onto the enterprise</h3>
        <p>The PMO Portal consolidates every active project across twelve departments into one operational view. For an executive, it answers four standing questions on demand:</p>
        <ul class="bullets">
          <li><strong>Is the portfolio healthy?</strong> One number (Portfolio IPI), updated live as projects change.</li>
          <li><strong>What needs my attention today?</strong> The Executive Intervention Panel flags projects against eight signals — delayed, critical risk, stale updates, budget overrun, overdue milestones.</li>
          <li><strong>Where is the capital going?</strong> Budget utilisation, forecast overrun, and per-project cost performance, rolled up.</li>
          <li><strong>Where are the bottlenecks?</strong> Gate pipeline, pending approvals, overdue milestones — every queue made visible.</li>
        </ul>
        <div class="plain">
          <div class="ic">💡</div>
          <div class="ct">
            <div class="lb">Why it matters</div>
            <p>Before the portal, the portfolio lived in emails, scattered Excel sheets, and monthly steering decks. The same picture now arrives in ten seconds, refreshed in real time, with full drill-down to the underlying project.</p>
          </div>
        </div>
      </div>

      <div class="stats" style="grid-template-columns: repeat(2, 1fr); align-content: start;">
        <div class="stat"><div class="num">12</div><div class="lbl">Departments</div><div class="sub">All operating units onboarded</div></div>
        <div class="stat"><div class="num">10+</div><div class="lbl">Projects per year</div><div class="sub">Live tracking + reporting</div></div>
        <div class="stat"><div class="num">91</div><div class="lbl">Key Risk Indicators</div><div class="sub">GRC dashboard, live readings</div></div>
        <div class="stat"><div class="num">9</div><div class="lbl">User roles</div><div class="sub">From PM to Executive to Audit</div></div>
        <div class="stat"><div class="num">5</div><div class="lbl">Project gates</div><div class="sub">Initiation → Closure lifecycle</div></div>
        <div class="stat"><div class="num">∞</div><div class="lbl">Live access</div><div class="sub">Browser only · single sign-on</div></div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 02 60-SECOND MORNING CHECK ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 2 · Daily Routine</div><div class="num">04</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 2</div>
        <h2 class="s-title">Your morning check, in 60 seconds</h2>
        <div class="s-sub">A four-step routine that surfaces every signal a portfolio executive needs before the first meeting of the day.</div>
      </div>
    </div>

    <div class="col-eq" style="align-items: stretch;">
      <div class="mock">
        <svg width="100%" viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">
          <!-- Step 1: Open the Home dashboard -->
          <rect x="10" y="14" width="460" height="60" rx="8" fill="#003932"/>
          <text x="28" y="38" font-family="Inter" font-size="11" font-weight="800" fill="#00FFB3">STEP 1 · OPEN</text>
          <text x="28" y="55" font-family="Inter" font-size="13" font-weight="700" fill="white">Home dashboard loads automatically on login</text>
          <text x="28" y="68" font-family="Inter" font-size="10" fill="rgba(255,255,255,0.6)">Single sign-on with your Tree Digital account</text>

          <!-- Step 2: Scan intervention panel -->
          <rect x="10" y="86" width="460" height="60" rx="8" fill="#fee2e2" stroke="#dc2626" stroke-width="1.5"/>
          <text x="28" y="110" font-family="Inter" font-size="11" font-weight="800" fill="#991b1b">STEP 2 · SCAN</text>
          <text x="28" y="127" font-family="Inter" font-size="13" font-weight="700" fill="#7f1d1d">Requires Attention panel · projects flagged today</text>
          <text x="28" y="140" font-family="Inter" font-size="10" fill="#991b1b">Click any flagged project to drill straight in</text>

          <!-- Step 3: Check Portfolio IPI -->
          <rect x="10" y="158" width="460" height="60" rx="8" fill="#ccfff0" stroke="#00b894" stroke-width="1.5"/>
          <text x="28" y="182" font-family="Inter" font-size="11" font-weight="800" fill="#003932">STEP 3 · READ</text>
          <text x="28" y="199" font-family="Inter" font-size="13" font-weight="700" fill="#003932">Portfolio IPI &amp; Forecast Overrun · headline metrics</text>
          <text x="28" y="212" font-family="Inter" font-size="10" fill="#005c4b">One number for health, one number for budget risk</text>

          <!-- Step 4: Decide where to dig -->
          <rect x="10" y="230" width="460" height="60" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5"/>
          <text x="28" y="254" font-family="Inter" font-size="11" font-weight="800" fill="#1e40af">STEP 4 · DECIDE</text>
          <text x="28" y="271" font-family="Inter" font-size="13" font-weight="700" fill="#1e3a8a">Drill into a Department or a flagged Project</text>
          <text x="28" y="284" font-family="Inter" font-size="10" fill="#1e40af">Sidebar navigation · every screen one click away</text>
        </svg>
        <div class="mock-cap">Sixty seconds · four decisions surfaced</div>
      </div>

      <div class="desc">
        <h3>What you walk away with</h3>
        <p>By the end of step 4, you know:</p>
        <ul class="bullets">
          <li><strong>How many projects are in trouble today</strong> — the Intervention Panel counts them, ranks them, and names them.</li>
          <li><strong>Whether the enterprise portfolio is on plan</strong> — Portfolio IPI gives one number with a comparison to last month.</li>
          <li><strong>How much capital is at risk of overrun</strong> — Forecast Overrun shows the SAR exposure plus the count of projects driving it.</li>
          <li><strong>Where to spend the next thirty minutes</strong> — every flag is clickable straight to the project view.</li>
        </ul>

        <div class="ws act">
          <div class="lbl">Recommended cadence</div>
          <p>Daily — 60 seconds on Home. Weekly — drill into the lowest-IPI department. Monthly — open the GRC Risk Intelligence Report (printable) and circulate.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 03 HOME ANATOMY ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 3 · Home Dashboard Anatomy</div><div class="num">05</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 3</div>
        <h2 class="s-title">Home — anatomy of the dashboard</h2>
        <div class="s-sub">Every region of the Home screen, what it tells you, and what to do if it's flashing.</div>
      </div>
    </div>

    <div class="mock" style="padding: 16px;">
      <svg width="100%" viewBox="0 0 880 380" xmlns="http://www.w3.org/2000/svg" style="display:block; margin: 0 auto; max-height: 360px;">
        <!-- Background frame -->
        <rect x="0" y="0" width="880" height="380" fill="white" rx="6"/>

        <!-- Title bar -->
        <rect x="0" y="0" width="880" height="32" fill="#003932"/>
        <text x="14" y="22" font-family="Inter" font-size="11" font-weight="700" fill="#00FFB3">Enterprise Portfolio Dashboard</text>

        <!-- 1. Intervention Panel -->
        <rect x="14" y="42" width="852" height="42" rx="6" fill="#fef2f2" stroke="#fca5a5"/>
        <text x="26" y="60" font-family="Inter" font-size="11" font-weight="800" fill="#991b1b">🚨 Requires Attention</text>
        <text x="26" y="74" font-family="Inter" font-size="9" fill="#7f1d1d">8 projects flagged · click to drill</text>
        <text x="800" y="68" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 1</text>

        <!-- 2. Hero row: Portfolio IPI + Forecast Overrun -->
        <rect x="14" y="94" width="420" height="64" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="26" y="112" font-family="Inter" font-size="9" font-weight="600" fill="#5a7a6e">Portfolio IPI</text>
        <text x="26" y="142" font-family="Inter" font-size="22" font-weight="900" fill="#15803d">87</text>
        <text x="68" y="142" font-family="Inter" font-size="11" fill="#15803d" font-weight="700">On Track</text>
        <text x="400" y="108" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 2</text>

        <rect x="446" y="94" width="420" height="64" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="458" y="112" font-family="Inter" font-size="9" font-weight="600" fill="#5a7a6e">Forecast Overrun</text>
        <text x="458" y="142" font-family="Inter" font-size="22" font-weight="900" fill="#dc2626">4</text>
        <text x="500" y="142" font-family="Inter" font-size="11" fill="#dc2626" font-weight="700">SAR 18M exposure</text>
        <text x="832" y="108" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 3</text>

        <!-- 3. KPI strip -->
        <rect x="14" y="168" width="852" height="38" rx="6" fill="#f5faf9" stroke="#C9D5C9"/>
        <text x="22" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">Total Projects</text>
        <text x="22" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#003932">22</text>
        <text x="148" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">Delayed</text>
        <text x="148" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#dc2626">3</text>
        <text x="270" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">At Risk</text>
        <text x="270" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#ea580c">5</text>
        <text x="400" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">Overdue Milestones</text>
        <text x="400" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#dc2626">12</text>
        <text x="568" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">Pending Approvals</text>
        <text x="568" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#d97706">3</text>
        <text x="730" y="186" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">Budget Util.</text>
        <text x="730" y="200" font-family="Inter" font-size="13" font-weight="900" fill="#15803d">62%</text>
        <text x="832" y="186" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 4</text>

        <!-- 4. Gate Pipeline / Overdue / Pending -->
        <rect x="14" y="216" width="540" height="76" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="26" y="234" font-family="Inter" font-size="11" font-weight="700" fill="#003932">Gate Pipeline</text>
        <rect x="26" y="246" width="200" height="6" fill="#00b894" rx="3"/>
        <rect x="26" y="258" width="120" height="6" fill="#00b894" rx="3"/>
        <rect x="26" y="270" width="320" height="6" fill="#f59e0b" rx="3"/>
        <text x="540" y="232" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 5</text>

        <rect x="566" y="216" width="300" height="76" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="578" y="234" font-family="Inter" font-size="11" font-weight="700" fill="#003932">Overdue Milestones · Pending Approvals</text>
        <rect x="578" y="246" width="270" height="14" rx="3" fill="#fee2e2"/>
        <rect x="578" y="266" width="270" height="14" rx="3" fill="#fef3c7"/>
        <text x="852" y="232" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 6</text>

        <!-- 5. Department IPI chart + Budget -->
        <rect x="14" y="302" width="540" height="70" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="26" y="320" font-family="Inter" font-size="11" font-weight="700" fill="#003932">Department IPI Scores</text>
        <rect x="26" y="334" width="14" height="24" fill="#003932"/>
        <rect x="48" y="338" width="14" height="20" fill="#005c4b"/>
        <rect x="70" y="332" width="14" height="26" fill="#15803d"/>
        <rect x="92" y="344" width="14" height="14" fill="#ea580c"/>
        <rect x="114" y="328" width="14" height="30" fill="#15803d"/>
        <rect x="136" y="340" width="14" height="18" fill="#854d0e"/>
        <rect x="158" y="338" width="14" height="20" fill="#005c4b"/>
        <rect x="180" y="350" width="14" height="8" fill="#991b1b"/>
        <text x="540" y="316" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 7</text>

        <rect x="566" y="302" width="300" height="70" rx="6" fill="white" stroke="#C9D5C9"/>
        <text x="578" y="320" font-family="Inter" font-size="11" font-weight="700" fill="#003932">Portfolio Budget</text>
        <text x="578" y="338" font-family="Inter" font-size="9" fill="#5a7a6e">Approved · Spent · Remaining</text>
        <rect x="578" y="346" width="270" height="14" rx="3" fill="#C9D5C9"/>
        <rect x="578" y="346" width="170" height="14" rx="3" fill="#00b894"/>
        <text x="852" y="316" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">REGION 8</text>
      </svg>
      <div class="mock-cap">Home dashboard · eight regions, each scanned in seconds</div>
    </div>

    <table style="margin-top: 10px;">
      <thead><tr><th style="width:6%">#</th><th style="width:24%">Region</th><th>What it tells you</th><th style="width:24%">If it's flashing</th></tr></thead>
      <tbody>
        <tr><td class="k">1</td><td class="k">Requires Attention</td><td>Projects flagged across 8 signals (delayed, critical risk, overdue, budget, stale, etc.)</td><td>Open the top entry — that's where to spend the next 30 min.</td></tr>
        <tr><td class="k">2</td><td class="k">Portfolio IPI</td><td>One blended health number (budget × priority weighted)</td><td>Below 90: review the Department IPI Chart for the weakest dept.</td></tr>
        <tr><td class="k">3</td><td class="k">Forecast Overrun</td><td>Count of projects exceeding budget + total SAR exposure</td><td>Click to filter All Projects to those overruning.</td></tr>
        <tr><td class="k">5</td><td class="k">Gate Pipeline</td><td>Active projects per gate · highlights bottlenecks</td><td>Look for the BOTTLENECK chip · which stage is jamming?</td></tr>
        <tr><td class="k">6</td><td class="k">Overdue &amp; Approvals</td><td>Aged buckets (≤7d, 8–30d, 30+d) and queue size</td><td>30+ days red = chase those owners by name.</td></tr>
      </tbody>
    </table>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 04 INTERVENTION PANEL ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 4 · Executive Intervention Panel</div><div class="num">06</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 4</div>
        <h2 class="s-title">Executive Intervention Panel</h2>
        <div class="s-sub">The single most important region on Home — projects automatically flagged across eight independent signals.</div>
      </div>
    </div>

    <div class="col2">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg">
          <!-- Card frame -->
          <rect x="6" y="6" width="448" height="268" rx="10" fill="white" stroke="#fca5a5" stroke-width="1.5"/>

          <!-- Header -->
          <text x="22" y="32" font-family="Inter" font-size="13" font-weight="800" fill="#dc2626">🚨 Requires Attention</text>
          <text x="22" y="48" font-family="Inter" font-size="10" fill="#5a7a6e">8 projects flagged</text>

          <!-- Item 1: High severity -->
          <rect x="22" y="60" width="416" height="42" rx="8" fill="rgba(220,38,38,0.05)" stroke="rgba(220,38,38,0.2)"/>
          <text x="35" y="80" font-family="Inter" font-size="13">🔴</text>
          <text x="55" y="78" font-family="Inter" font-size="11" font-weight="700" fill="#0d1f1c">PRJ-2026-12 — Claims AI Phase 2</text>
          <text x="55" y="93" font-family="Inter" font-size="9" fill="#5a7a6e">Delayed — 14d behind · Critical risk · 2 overdue milestones (18d)</text>
          <text x="430" y="86" text-anchor="end" font-family="Inter" font-size="11" fill="#5a7a6e">→</text>

          <!-- Item 2: High severity -->
          <rect x="22" y="110" width="416" height="42" rx="8" fill="rgba(220,38,38,0.05)" stroke="rgba(220,38,38,0.2)"/>
          <text x="35" y="130" font-family="Inter" font-size="13">🔴</text>
          <text x="55" y="128" font-family="Inter" font-size="11" font-weight="700" fill="#0d1f1c">PRJ-2026-18 — UAE Regulator Submission</text>
          <text x="55" y="143" font-family="Inter" font-size="9" fill="#5a7a6e">High risk · Budget 96% · No update 22d</text>
          <text x="430" y="136" text-anchor="end" font-family="Inter" font-size="11" fill="#5a7a6e">→</text>

          <!-- Item 3: Medium severity -->
          <rect x="22" y="160" width="416" height="42" rx="8" fill="rgba(217,119,6,0.05)" stroke="rgba(217,119,6,0.2)"/>
          <text x="35" y="180" font-family="Inter" font-size="13">🟡</text>
          <text x="55" y="178" font-family="Inter" font-size="11" font-weight="700" fill="#0d1f1c">PRJ-2026-23 — Najm Integration</text>
          <text x="55" y="193" font-family="Inter" font-size="9" fill="#5a7a6e">High risk · No update 18d · 1 overdue milestone (5d)</text>
          <text x="430" y="186" text-anchor="end" font-family="Inter" font-size="11" fill="#5a7a6e">→</text>

          <!-- Item 4: Medium severity -->
          <rect x="22" y="210" width="416" height="42" rx="8" fill="rgba(217,119,6,0.05)" stroke="rgba(217,119,6,0.2)"/>
          <text x="35" y="230" font-family="Inter" font-size="13">🟡</text>
          <text x="55" y="228" font-family="Inter" font-size="11" font-weight="700" fill="#0d1f1c">PRJ-2026-31 — Tawuniya Data Migration</text>
          <text x="55" y="243" font-family="Inter" font-size="9" fill="#5a7a6e">Budget 88% · 3 overdue milestones</text>
          <text x="430" y="236" text-anchor="end" font-family="Inter" font-size="11" fill="#5a7a6e">→</text>

          <text x="22" y="270" font-family="Inter" font-size="9" font-style="italic" fill="#5a7a6e">+ 4 more flagged (sorted by severity)</text>
        </svg>
        <div class="mock-cap">Top of Home · sorted by severity score</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">What surfaces in the panel</div>
          <p>Every active project is scored across 8 signals. Projects with any non-zero signal appear, ranked by severity:</p>
          <ul>
            <li><strong>Delayed status</strong> — past plannedEnd</li>
            <li><strong>Critical or High risk</strong> — derived from open risks</li>
            <li><strong>Stale</strong> — no update in 14+ days</li>
            <li><strong>Budget burn</strong> — actual cost &gt;85% or &gt;95% of budget</li>
            <li><strong>Overdue milestones</strong> — date passed, status not Completed</li>
            <li><strong>Aged overdue</strong> — 14+ days past milestone date</li>
          </ul>
          <p>Top 8 always shown; click for the project view.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to use it</div>
          <p>Open Home once daily. Click the top entry — that's where your time goes. The 🔴 markers are high severity (multiple signals firing). 🟡 are medium (one or two signals).</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Home <span class="sep">›</span> top of page</span> · always visible above the KPI strip when any projects are flagged.</p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 05 PORTFOLIO IPI & FORECAST ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 5 · Portfolio IPI &amp; Forecast Overrun</div><div class="num">07</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 5</div>
        <h2 class="s-title">The headline numbers</h2>
        <div class="s-sub">Two cards sit directly below the Intervention Panel — the answers an executive asks first.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 240" xmlns="http://www.w3.org/2000/svg">
          <!-- Portfolio IPI card -->
          <rect x="6" y="6" width="448" height="100" rx="10" fill="white" stroke="#00b894" stroke-width="1.5"/>
          <text x="22" y="28" font-family="Inter" font-size="10" font-weight="600" fill="#5a7a6e">Portfolio IPI</text>
          <text x="22" y="78" font-family="Inter" font-size="40" font-weight="900" fill="#15803d">87</text>
          <rect x="105" y="56" width="86" height="22" rx="11" fill="#dcfce7"/>
          <text x="148" y="71" text-anchor="middle" font-family="Inter" font-size="11" font-weight="700" fill="#15803d">Watch</text>
          <text x="22" y="93" font-family="Inter" font-size="10" font-weight="600" fill="#16a34a">▲ +3 vs last month</text>
          <text x="430" y="93" text-anchor="end" font-family="Inter" font-size="9" fill="#5a7a6e">SPI 50% · CPI 25% · MCI 25%</text>

          <!-- Forecast Overrun card -->
          <rect x="6" y="118" width="448" height="100" rx="10" fill="white" stroke="#dc2626" stroke-width="1.5"/>
          <text x="22" y="140" font-family="Inter" font-size="10" font-weight="600" fill="#5a7a6e">Forecast Overrun</text>
          <text x="22" y="190" font-family="Inter" font-size="40" font-weight="900" fill="#dc2626">4</text>
          <text x="22" y="208" font-family="Inter" font-size="10" font-weight="600" fill="#dc2626">SAR 18,432,000 exposure</text>
        </svg>
        <div class="mock-cap">Two clickable hero cards · top of Home, just below intervention</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">Portfolio IPI</div>
          <p>A single 0-to-115 score blending schedule, cost, and compliance across every active project. Weighted by budget × priority — a Critical regulatory programme drives this number more than a Low-priority pilot.</p>
          <p style="margin-top:6px"><strong>The arrow:</strong> ▲ green = improving vs 30 days ago. ▼ red = deteriorating. — grey = unchanged.</p>
        </div>

        <div class="ws see">
          <div class="lbl">Forecast Overrun</div>
          <p>Counts how many projects have forecast cost exceeding approved budget. The SAR figure below is the total exposure — capital at risk if every overrun materialises.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to use them</div>
          <p>If Portfolio IPI is dropping, the Department IPI chart further down tells you which unit is responsible. If Forecast Overrun is rising, click the card → filters All Projects to the overrunners.</p>
        </div>
      </div>
    </div>

    <div class="plain">
      <div class="ic">📐</div>
      <div class="ct">
        <div class="lb">In plain language</div>
        <p>Portfolio IPI is the report card for the whole enterprise — one number you can quote in a board meeting. Forecast Overrun is the warning light on the dashboard — count and cost of projects driving toward a money fire.</p>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 06 GATE PIPELINE ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 6 · Gate Pipeline &amp; Approvals</div><div class="num">08</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 6</div>
        <h2 class="s-title">Gate Pipeline &amp; pending approvals</h2>
        <div class="s-sub">Two regions on Home that surface flow problems — where projects stack up, who's slow to sign off.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 270" xmlns="http://www.w3.org/2000/svg">
          <!-- Gate Pipeline card -->
          <rect x="6" y="6" width="448" height="258" rx="10" fill="white" stroke="#C9D5C9"/>
          <text x="22" y="28" font-family="Inter" font-size="12" font-weight="700" fill="#003932">Gate Pipeline</text>
          <text x="22" y="44" font-family="Inter" font-size="9" fill="#5a7a6e">Active projects by current gate</text>

          <!-- Gate rows -->
          <g font-family="Inter" font-size="10">
            <text x="22" y="68" font-weight="700" fill="#003932">Gate 1</text>
            <text x="70" y="68" fill="#5a7a6e">Initiation</text>
            <text x="430" y="68" text-anchor="end" font-weight="800" fill="#003932">3</text>
            <rect x="22" y="74" width="408" height="9" rx="4" fill="#C9D5C9"/>
            <rect x="22" y="74" width="100" height="9" rx="4" fill="#00b894"/>

            <text x="22" y="105" font-weight="700" fill="#003932">Gate 2</text>
            <text x="70" y="105" fill="#5a7a6e">Planning</text>
            <text x="430" y="105" text-anchor="end" font-weight="800" fill="#003932">2</text>
            <rect x="22" y="111" width="408" height="9" rx="4" fill="#C9D5C9"/>
            <rect x="22" y="111" width="60" height="9" rx="4" fill="#00b894"/>

            <text x="22" y="142" font-weight="700" fill="#003932">Gate 3</text>
            <text x="70" y="142" fill="#5a7a6e">Plan Submit</text>
            <rect x="148" y="132" width="78" height="14" rx="6" fill="#fef9c3"/>
            <text x="187" y="142" text-anchor="middle" font-size="8.5" font-weight="800" fill="#854d0e">BOTTLENECK</text>
            <text x="430" y="142" text-anchor="end" font-weight="800" fill="#003932">8</text>
            <rect x="22" y="148" width="408" height="9" rx="4" fill="#C9D5C9"/>
            <rect x="22" y="148" width="408" height="9" rx="4" fill="#eab308"/>

            <text x="22" y="179" font-weight="700" fill="#003932">Gate 4</text>
            <text x="70" y="179" fill="#5a7a6e">Execution</text>
            <text x="430" y="179" text-anchor="end" font-weight="800" fill="#003932">7</text>
            <rect x="22" y="185" width="408" height="9" rx="4" fill="#C9D5C9"/>
            <rect x="22" y="185" width="356" height="9" rx="4" fill="#00b894"/>

            <text x="22" y="216" font-weight="700" fill="#003932">Gate 5</text>
            <text x="70" y="216" fill="#5a7a6e">Closure</text>
            <text x="430" y="216" text-anchor="end" font-weight="800" fill="#003932">2</text>
            <rect x="22" y="222" width="408" height="9" rx="4" fill="#C9D5C9"/>
            <rect x="22" y="222" width="60" height="9" rx="4" fill="#00b894"/>
          </g>
          <text x="22" y="252" font-family="Inter" font-size="9" font-style="italic" fill="#5a7a6e">avg 14d wait shown next to each gate</text>
        </svg>
        <div class="mock-cap">Bottleneck chip auto-fires on the most-loaded gate</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">Gate Pipeline</div>
          <p>Each gate carries a bar sized by the count of active projects sitting there. The widest bar gets the BOTTLENECK chip — a hint that approvals at that stage need attention.</p>
          <ul>
            <li><strong>Gate 1</strong> — new requests awaiting PMO triage</li>
            <li><strong>Gate 2</strong> — Charter / Business Case under stakeholder review</li>
            <li><strong>Gate 3</strong> — detailed plan awaiting approval</li>
            <li><strong>Gate 4</strong> — in execution (usually the heaviest gate)</li>
            <li><strong>Gate 5</strong> — closure / sign-off pending</li>
          </ul>
        </div>

        <div class="ws see">
          <div class="lbl">Pending Approvals (right column)</div>
          <p>List of items awaiting decision (gates submitted to a sponsor, requests pending PMO triage, closures awaiting stakeholders). Oldest shown first with the age in days — 10+ days reads in red.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to act</div>
          <p>Click any pending item to land on the My Actions queue, where the project context and Approval Log are visible. From there, you can route the conversation to the right approver by name.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Home <span class="sep">›</span> Gate Pipeline panel (left)</span> · adjacent to <span class="route">Overdue + Pending stack (right)</span></p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 07 DEPARTMENT PERFORMANCE ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 7 · Department Performance</div><div class="num">09</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 7</div>
        <h2 class="s-title">Department Performance</h2>
        <div class="s-sub">Full comparison across all twelve departments — IPI ranking, project-by-status breakdown, budget utilisation per unit.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="448" height="268" rx="10" fill="white" stroke="#C9D5C9"/>
          <!-- Header -->
          <text x="22" y="28" font-family="Inter" font-size="13" font-weight="800" fill="#003932">Departments Overview</text>
          <text x="22" y="44" font-family="Inter" font-size="9" fill="#5a7a6e">Sort by: IPI ↓ High first</text>

          <!-- Dept cards mini -->
          <g font-family="Inter" font-size="10">
            <rect x="22" y="58" width="200" height="90" rx="8" fill="white" stroke="#15803d" stroke-width="1.5"/>
            <text x="34" y="78" font-weight="800" fill="#003932">Digital</text>
            <text x="34" y="92" font-size="9" fill="#5a7a6e">12 projects · #1</text>
            <rect x="170" y="68" width="40" height="32" rx="6" fill="#dcfce7"/>
            <text x="190" y="86" text-anchor="middle" font-size="14" font-weight="900" fill="#15803d">95</text>
            <text x="190" y="96" text-anchor="middle" font-size="6.5" font-weight="700" fill="#15803d">IPI</text>
            <rect x="34" y="120" width="22" height="14" rx="3" fill="#16a34a"/>
            <rect x="60" y="120" width="14" height="14" rx="3" fill="#ea580c"/>
            <rect x="78" y="120" width="40" height="14" rx="3" fill="#3b82f6"/>

            <rect x="238" y="58" width="200" height="90" rx="8" fill="white" stroke="#15803d" stroke-width="1.5"/>
            <text x="250" y="78" font-weight="800" fill="#003932">Strategy &amp; PMO</text>
            <text x="250" y="92" font-size="9" fill="#5a7a6e">6 projects · #2</text>
            <rect x="386" y="68" width="40" height="32" rx="6" fill="#dcfce7"/>
            <text x="406" y="86" text-anchor="middle" font-size="14" font-weight="900" fill="#15803d">89</text>
            <text x="406" y="96" text-anchor="middle" font-size="6.5" font-weight="700" fill="#15803d">IPI</text>
            <rect x="250" y="120" width="14" height="14" rx="3" fill="#16a34a"/>
            <rect x="268" y="120" width="22" height="14" rx="3" fill="#ea580c"/>
            <rect x="294" y="120" width="20" height="14" rx="3" fill="#3b82f6"/>

            <rect x="22" y="158" width="200" height="90" rx="8" fill="white" stroke="#854d0e" stroke-width="1.5"/>
            <text x="34" y="178" font-weight="800" fill="#003932">Finance</text>
            <text x="34" y="192" font-size="9" fill="#5a7a6e">8 projects · #3</text>
            <rect x="170" y="168" width="40" height="32" rx="6" fill="#fef9c3"/>
            <text x="190" y="186" text-anchor="middle" font-size="14" font-weight="900" fill="#854d0e">78</text>
            <text x="190" y="196" text-anchor="middle" font-size="6.5" font-weight="700" fill="#854d0e">IPI</text>
            <rect x="34" y="220" width="18" height="14" rx="3" fill="#16a34a"/>
            <rect x="56" y="220" width="30" height="14" rx="3" fill="#ea580c"/>
            <rect x="90" y="220" width="18" height="14" rx="3" fill="#dc2626"/>

            <rect x="238" y="158" width="200" height="90" rx="8" fill="white" stroke="#854d0e" stroke-width="1.5"/>
            <text x="250" y="178" font-weight="800" fill="#003932">Operations</text>
            <text x="250" y="192" font-size="9" fill="#5a7a6e">5 projects · #4</text>
            <rect x="386" y="168" width="40" height="32" rx="6" fill="#fef9c3"/>
            <text x="406" y="186" text-anchor="middle" font-size="14" font-weight="900" fill="#854d0e">72</text>
            <text x="406" y="196" text-anchor="middle" font-size="6.5" font-weight="700" fill="#854d0e">IPI</text>
            <rect x="250" y="220" width="14" height="14" rx="3" fill="#16a34a"/>
            <rect x="268" y="220" width="36" height="14" rx="3" fill="#ea580c"/>
          </g>
          <text x="230" y="268" text-anchor="middle" font-family="Inter" font-size="9" font-style="italic" fill="#5a7a6e">+ 8 more departments ranked</text>
        </svg>
        <div class="mock-cap">Ranked grid · rank #N badge on every card</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">Per-department card</div>
          <p>Each card shows the unit's name, project count, IPI score (colour-coded), the avg-progress bar, project-status breakdown (On Track / At Risk / Delayed / Done / Not Started), and budget utilisation. A rank chip in the footer tells you where the unit sits relative to peers.</p>
        </div>

        <div class="ws see">
          <div class="lbl">The Portfolio IPI banner (top of page)</div>
          <p>One large card at the top: enterprise IPI computed across all active projects, with a mini bar chart of each department's IPI for at-a-glance comparison.</p>
        </div>

        <div class="ws act">
          <div class="lbl">Sort &amp; filter</div>
          <p>Sort by: IPI high-first, IPI low-first, project count, or name. The "low-first" sort surfaces underperforming units immediately for management conversation.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Sidebar <span class="sep">›</span> Departments IPI</span></p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 08 PROJECT HEADER ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 8 · Project Header</div><div class="num">10</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 8</div>
        <h2 class="s-title">Project header &amp; performance banner</h2>
        <div class="s-sub">When you open any project, the top two centimetres of the screen answer the two questions an executive cares about first.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 260" xmlns="http://www.w3.org/2000/svg">
          <!-- Header card -->
          <rect x="6" y="6" width="448" height="248" rx="12" fill="#003932"/>

          <!-- Top toolbar -->
          <g font-family="Inter" font-size="9">
            <rect x="18" y="20" width="68" height="18" rx="9" fill="#00b894"/>
            <text x="52" y="32" text-anchor="middle" font-weight="800" fill="#003932">PRJ-2026-45</text>
            <rect x="92" y="20" width="72" height="18" rx="9" fill="rgba(255,255,255,0.15)"/>
            <text x="128" y="32" text-anchor="middle" font-weight="700" fill="white">Gate 4 · Day 76</text>
            <rect x="170" y="20" width="40" height="18" rx="9" fill="rgba(255,255,255,0.15)"/>
            <text x="190" y="32" text-anchor="middle" font-weight="700" fill="white">High</text>

            <!-- Right side: status + buttons -->
            <rect x="276" y="20" width="58" height="20" rx="10" fill="#ccfff0"/>
            <text x="305" y="33" text-anchor="middle" font-weight="800" fill="#003932">On Track</text>
            <rect x="340" y="20" width="50" height="20" rx="6" fill="#00FFB3"/>
            <text x="365" y="33" text-anchor="middle" font-weight="800" fill="#003932">✏ Update</text>
            <rect x="395" y="20" width="48" height="20" rx="6" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)"/>
            <text x="419" y="33" text-anchor="middle" font-weight="700" fill="white">📄 Print</text>
          </g>

          <!-- Project name -->
          <text x="18" y="68" font-family="Inter" font-size="18" font-weight="900" fill="white">Digital Insurer Transformation</text>

          <!-- Description -->
          <text x="18" y="86" font-family="Inter" font-size="9" fill="rgba(255,255,255,0.65)">Transition Tree from a digital agency into a licensed insurer...</text>

          <!-- Performance banner -->
          <rect x="18" y="102" width="424" height="100" rx="10" fill="rgba(0,0,0,0.3)"/>

          <!-- Progress block -->
          <rect x="30" y="114" width="170" height="76" rx="8" fill="rgba(0,184,148,0.10)" stroke="rgba(0,184,148,0.25)"/>
          <text x="42" y="138" font-family="Inter" font-size="22" font-weight="900" fill="#00FFB3">41%</text>
          <text x="100" y="138" font-family="Inter" font-size="8" font-weight="800" fill="#00FFB3" letter-spacing="0.7">PROGRESS</text>
          <rect x="42" y="148" width="146" height="5" rx="2.5" fill="rgba(255,255,255,0.1)"/>
          <rect x="42" y="148" width="60" height="5" rx="2.5" fill="#00FFB3"/>
          <text x="42" y="170" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.6)">Auto-rolled from Activities</text>

          <!-- IPI block -->
          <rect x="210" y="114" width="120" height="76" rx="8" fill="#ccfff0"/>
          <text x="270" y="148" text-anchor="middle" font-family="Inter" font-size="22" font-weight="900" fill="#003932">95</text>
          <text x="270" y="166" text-anchor="middle" font-family="Inter" font-size="8" font-weight="800" fill="#003932" letter-spacing="0.7">IPI SCORE</text>
          <text x="270" y="180" text-anchor="middle" font-family="Inter" font-size="8" fill="#003932" opacity="0.7">Watch</text>

          <!-- Breakdown -->
          <g font-family="Inter" font-size="8" fill="white">
            <text x="340" y="124"><tspan fill="#00FFB3" font-weight="700">SPI</tspan> 0.907 × 50%</text>
            <text x="340" y="138"><tspan fill="#00FFB3" font-weight="700">CPI</tspan> 1.0 × 25%</text>
            <text x="340" y="152"><tspan fill="#00FFB3" font-weight="700">MCI</tspan> 100% × 25%</text>
            <text x="340" y="168" fill="#fbbf24">⚠ Anticipated at Gate 5: 67%</text>
            <text x="340" y="182" fill="#86efac">✓ Within roadmap</text>
          </g>

          <!-- Metadata bar -->
          <line x1="18" y1="218" x2="442" y2="218" stroke="rgba(255,255,255,0.15)"/>
          <g font-family="Inter" font-size="8" fill="rgba(255,255,255,0.65)">
            <text x="20" y="235">PM</text>
            <text x="20" y="246" font-weight="700" fill="white">Naif AlDakheel</text>
            <text x="100" y="235">DEPT</text>
            <text x="100" y="246" font-weight="700" fill="white">Digital</text>
            <text x="180" y="235">START</text>
            <text x="180" y="246" font-weight="700" fill="white">2026-01-01</text>
            <text x="260" y="235">PLANNED END</text>
            <text x="260" y="246" font-weight="700" fill="white">2027-01-01</text>
            <text x="370" y="235">SPONSOR</text>
            <text x="370" y="246" font-weight="700" fill="white">B. Alhathal</text>
          </g>
        </svg>
        <div class="mock-cap">Project header · status chip + actions, then headline metrics, then metadata</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">Top toolbar (row 1)</div>
          <p>Code, current gate (with days at gate), priority, project type, roadmap flag — all chips. To the right: <span class="chip green">Status badge</span>, ✏️ Update, Edit Fields (PMO/admin), 📄 Print Report.</p>
        </div>

        <div class="ws see">
          <div class="lbl">Performance banner (row 2)</div>
          <p>Two equal-weight blocks: <strong>Progress</strong> (auto-rolled from Activities, with bar) and <strong>IPI Score</strong> (colour-coded). Beside them: the SPI/CPI/MCI breakdown that mathematically composes the IPI, plus the Anticipated MCI warning if the next gate will hurt the score, plus a roadmap-deadline indicator.</p>
        </div>

        <div class="ws see">
          <div class="lbl">Metadata bar (row 3)</div>
          <p>PM, Sponsor, Department, Start date, Planned End — the basic frame, always visible.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to act</div>
          <p><strong>Update</strong> opens a side panel for the PM to push status/progress/risks. <strong>Edit Fields</strong> is admin-only for project setup. <strong>Print Report</strong> opens an executive one-pager (see chapter 11).</p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 09 IPI BREAKDOWN ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 9 · IPI Breakdown</div><div class="num">11</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 9</div>
        <h2 class="s-title">Reading the IPI breakdown</h2>
        <div class="s-sub">The component breakdown beside the IPI Score block is the math behind the headline number — and the early-warning line that follows.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="desc">
        <h3>Three components, three colours</h3>
        <table>
          <thead><tr><th style="width:18%">Letter</th><th>Reads as</th><th style="width:18%">Weight</th></tr></thead>
          <tbody>
            <tr><td class="k">SPI</td><td>Schedule Performance · "On time?"</td><td>50%</td></tr>
            <tr><td class="k">CPI</td><td>Cost Performance · "Spending efficiently?"</td><td>25%</td></tr>
            <tr><td class="k">MCI</td><td>Maturity / Compliance · "Documents in place?"</td><td>25%</td></tr>
          </tbody>
        </table>

        <h3>The Anticipated MCI line</h3>
        <p>If the project is approaching a gate where new documents become due, an amber line appears under MCI:</p>
        <div class="ws see" style="background: #fffbeb; border-color: #fcd34d;">
          <div class="lbl" style="color: #92400e;">⚠ Anticipated at Gate 5: 67%</div>
          <p>(1 new doc becomes due)</p>
        </div>
        <p>It says: <em>"if today's documents don't change but the project crosses into the next gate, your MCI will fall from 100% to 67%"</em>. Time to chase the owner of that document now.</p>

        <div class="plain">
          <div class="ic">🔮</div>
          <div class="ct">
            <div class="lb">Why it matters</div>
            <p>Like a weather forecast for compliance. The MCI looks healthy today, but the system flags the cloudy week ahead so you can act before the score actually drops.</p>
          </div>
        </div>
      </div>

      <div class="mock">
        <svg width="100%" viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg">
          <!-- IPI banner closer view -->
          <rect x="6" y="6" width="448" height="268" rx="12" fill="#003932"/>
          <rect x="18" y="18" width="424" height="244" rx="10" fill="rgba(0,0,0,0.3)"/>

          <!-- Progress block -->
          <rect x="30" y="30" width="170" height="146" rx="8" fill="rgba(0,184,148,0.10)" stroke="rgba(0,184,148,0.25)"/>
          <text x="42" y="80" font-family="Inter" font-size="36" font-weight="900" fill="#00FFB3">41%</text>
          <text x="155" y="80" font-family="Inter" font-size="9" font-weight="800" fill="#00FFB3" letter-spacing="0.7">PROGRESS</text>
          <rect x="42" y="100" width="146" height="7" rx="3.5" fill="rgba(255,255,255,0.1)"/>
          <rect x="42" y="100" width="60" height="7" rx="3.5" fill="#00FFB3"/>
          <text x="42" y="130" font-family="Inter" font-size="9" fill="rgba(255,255,255,0.7)">Auto-rolled from</text>
          <text x="42" y="143" font-family="Inter" font-size="9" fill="rgba(255,255,255,0.7)">Activities</text>

          <!-- IPI block -->
          <rect x="212" y="30" width="120" height="146" rx="8" fill="#ccfff0"/>
          <text x="272" y="98" text-anchor="middle" font-family="Inter" font-size="36" font-weight="900" fill="#003932">95</text>
          <text x="272" y="118" text-anchor="middle" font-family="Inter" font-size="9" font-weight="800" fill="#003932" letter-spacing="0.7">IPI SCORE</text>
          <text x="272" y="138" text-anchor="middle" font-family="Inter" font-size="9" fill="#003932" opacity="0.7">Watch</text>

          <!-- Breakdown -->
          <g font-family="Inter" font-size="10" fill="white">
            <text x="344" y="50"><tspan fill="#00FFB3" font-weight="800">SPI</tspan> 0.907 → 0.907 × 50%</text>
            <text x="344" y="72"><tspan fill="#00FFB3" font-weight="800">CPI</tspan> 1.0 × 25%</text>
            <text x="344" y="94"><tspan fill="#00FFB3" font-weight="800">MCI</tspan> 100% docs × 25%</text>
            <text x="344" y="120" fill="#fbbf24" font-size="9">⚠ Anticipated at Gate 5: 67%</text>
            <text x="344" y="132" font-size="8" fill="rgba(251,191,36,0.7)">(1 new doc becomes due)</text>
            <text x="344" y="158" fill="#86efac" font-size="9">✓ Within roadmap (2027-01-01)</text>
          </g>

          <!-- Highlight callouts -->
          <text x="30" y="210" font-family="Inter" font-size="9" font-weight="700" fill="#00FFB3">▼ Read</text>
          <text x="30" y="225" font-family="Inter" font-size="9" fill="white">Progress and IPI are the two answers.</text>
          <text x="30" y="240" font-family="Inter" font-size="9" fill="white">Breakdown tells you which component drives the score.</text>
          <text x="30" y="252" font-family="Inter" font-size="9" fill="#fbbf24">Anticipated MCI tells you what's coming.</text>
        </svg>
        <div class="mock-cap">The IPI banner · everything an executive needs in one glance</div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 10 ACTIVITIES & GANTT ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 10 · Activities &amp; Gantt</div><div class="num">12</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 10</div>
        <h2 class="s-title">Activities &amp; Gantt</h2>
        <div class="s-sub">The schedule lives on the Activities tab — milestones as diamonds, activities as bars, with a soft past-time fade.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="448" height="268" rx="10" fill="white" stroke="#C9D5C9"/>
          <text x="22" y="28" font-family="Inter" font-size="11" font-weight="800" fill="#003932">Gantt Chart</text>

          <!-- Month ticks -->
          <g font-family="Inter" font-size="8" fill="#5a7a6e" font-weight="600">
            <text x="180" y="46" text-anchor="middle">Apr</text>
            <text x="240" y="46" text-anchor="middle">May</text>
            <text x="300" y="46" text-anchor="middle">Jun</text>
            <text x="360" y="46" text-anchor="middle">Jul</text>
            <text x="420" y="46" text-anchor="middle">Aug</text>
          </g>

          <!-- Past-time fade -->
          <rect x="150" y="56" width="160" height="170" fill="rgba(161,185,171,0.18)"/>

          <!-- Today marker -->
          <line x1="310" y1="50" x2="310" y2="232" stroke="#00FFB3" stroke-width="2" opacity="0.85"/>
          <text x="310" y="244" text-anchor="middle" font-family="Inter" font-size="8" font-weight="800" fill="#00b894">▲ TODAY</text>

          <!-- Milestone 1 with activities -->
          <text x="22" y="68" font-family="Inter" font-size="10" font-weight="800" fill="#003932">📍 Governance Framework</text>
          <rect x="296" y="60" width="14" height="14" rx="2" fill="#3b82f6" stroke="#1e40af" stroke-width="2" transform="rotate(45,303,67)"/>

          <text x="34" y="88" font-family="Inter" font-size="9" fill="#3a5547">↳ Charter approval</text>
          <rect x="190" y="80" width="80" height="12" rx="3" fill="#00FFB3" stroke="#00b894"/>
          <text x="230" y="89" text-anchor="middle" font-family="Inter" font-size="7" font-weight="800" fill="#003932">66%</text>

          <text x="34" y="108" font-family="Inter" font-size="9" fill="#3a5547">↳ Policy alignment</text>
          <rect x="190" y="100" width="100" height="12" rx="3" fill="#00FFB3" stroke="#00b894"/>
          <text x="240" y="109" text-anchor="middle" font-family="Inter" font-size="7" font-weight="800" fill="#003932">50%</text>

          <!-- Milestone 2 -->
          <text x="22" y="132" font-family="Inter" font-size="10" font-weight="800" fill="#003932">📍 Capital Injection</text>
          <rect x="394" y="124" width="14" height="14" rx="2" fill="#A1B9AB" stroke="#7a9485" stroke-width="2" transform="rotate(45,401,131)"/>

          <!-- Milestone 3 -->
          <text x="22" y="152" font-family="Inter" font-size="10" font-weight="800" fill="#003932">📍 Capability Gates</text>
          <rect x="276" y="144" width="14" height="14" rx="2" fill="#00FFB3" stroke="#00b894" stroke-width="2" transform="rotate(45,283,151)"/>

          <text x="34" y="172" font-family="Inter" font-size="9" fill="#3a5547">↳ Najm integration</text>
          <rect x="200" y="164" width="60" height="12" rx="3" fill="#00FFB3" stroke="#00b894"/>

          <text x="34" y="192" font-family="Inter" font-size="9" fill="#3a5547">↳ Closure (delayed)</text>
          <rect x="160" y="184" width="40" height="12" rx="3" fill="#490300" stroke="#2c0200"/>
          <text x="180" y="193" text-anchor="middle" font-family="Inter" font-size="7" font-weight="800" fill="white">OVERDUE</text>

          <!-- Legend -->
          <g font-family="Inter" font-size="8" fill="#5a7a6e">
            <rect x="22" y="252" width="12" height="8" fill="#3b82f6" rx="2"/>
            <text x="38" y="259">Completed</text>
            <rect x="100" y="252" width="12" height="8" fill="#00FFB3" rx="2"/>
            <text x="116" y="259">In Progress</text>
            <rect x="190" y="252" width="12" height="8" fill="#490300" rx="2"/>
            <text x="206" y="259">Delayed</text>
            <rect x="262" y="252" width="12" height="8" fill="#A1B9AB" rx="2"/>
            <text x="278" y="259">Upcoming</text>
          </g>
        </svg>
        <div class="mock-cap">Gantt · past-time mist · diamonds for milestones, bars for activities</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">What the visual conveys</div>
          <ul>
            <li><strong>Diamonds</strong> = top-level milestones with a single target date</li>
            <li><strong>Bars</strong> = activities with a start–end duration (or milestone with duration)</li>
            <li><strong>Past-time fade</strong> — soft Lichen mist over completed days, fading at the Today line</li>
            <li><strong>Today marker</strong> — vertical Sea line with soft glow</li>
            <li><strong>Overdue</strong> — bar turns Maroon and shows "OVERDUE"</li>
          </ul>
        </div>

        <div class="ws see">
          <div class="lbl">Below the Gantt — Milestone Details</div>
          <p>Each milestone gets a card with status, weight, owner, dates, and a progress bar. Activities under a milestone are indented and linked with dashed connector lines, so the parent-child relationship is unmistakable.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to act</div>
          <p>If you see a Maroon bar (overdue), open the project — the PM owes a Status update. If you see a milestone with all green activities but no progress bar fill, the parent's rollup is not yet flowing — chase the WBS data, not the project itself.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Any Project <span class="sep">›</span> Activities tab</span></p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 11 PRINT REPORT ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 11 · Project Print Report</div><div class="num">13</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 11</div>
        <h2 class="s-title">The Project Print Report</h2>
        <div class="s-sub">A one-click executive one-pager. The status report you used to compose manually for steering committees, now generated live from the live data.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 320" xmlns="http://www.w3.org/2000/svg">
          <!-- Sheet -->
          <rect x="20" y="6" width="420" height="308" rx="6" fill="white" stroke="#003932"/>
          <!-- Cover gradient bar -->
          <rect x="20" y="6" width="420" height="58" fill="#003932"/>
          <rect x="20" y="62" width="420" height="3" fill="#00FFB3"/>
          <text x="36" y="28" font-family="Inter" font-size="8" font-weight="800" fill="#00FFB3" letter-spacing="0.5">DIGITAL · PROJECT STATUS REPORT</text>
          <text x="36" y="48" font-family="Inter" font-size="14" font-weight="900" fill="white">Digital Insurer Transformation</text>
          <text x="36" y="60" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.7)">PRJ-2026-45 · As of 23 Jun 2026</text>
          <rect x="370" y="22" width="56" height="20" rx="10" fill="#ccfff0"/>
          <text x="398" y="35" text-anchor="middle" font-family="Inter" font-size="9" font-weight="800" fill="#003932">On Track</text>

          <!-- KPI strip -->
          <rect x="20" y="65" width="420" height="36" fill="white"/>
          <g font-family="Inter" font-size="6.5">
            <text x="36" y="78" font-weight="700" fill="#5a7a6e">PM</text>
            <text x="36" y="91" font-weight="800" fill="#003932">Naif</text>
            <text x="90" y="78" font-weight="700" fill="#5a7a6e">PROGRESS</text>
            <text x="90" y="91" font-weight="800" fill="#003932">41%</text>
            <text x="144" y="78" font-weight="700" fill="#5a7a6e">IPI</text>
            <text x="144" y="91" font-weight="800" fill="#15803d">95</text>
            <text x="180" y="78" font-weight="700" fill="#5a7a6e">BUDGET</text>
            <text x="180" y="91" font-weight="800" fill="#003932">50M</text>
            <text x="240" y="78" font-weight="700" fill="#5a7a6e">START</text>
            <text x="240" y="91" font-weight="800" fill="#003932">1 Jan</text>
            <text x="290" y="78" font-weight="700" fill="#5a7a6e">END</text>
            <text x="290" y="91" font-weight="800" fill="#003932">1 Jan 27</text>
            <text x="350" y="78" font-weight="700" fill="#5a7a6e">SPONSOR</text>
            <text x="350" y="91" font-weight="800" fill="#003932">B.A.</text>
          </g>

          <!-- Section: Delivery Timeline -->
          <line x1="36" y1="115" x2="424" y2="115" stroke="#003932" stroke-width="1.5"/>
          <text x="36" y="113" font-family="Inter" font-size="8" font-weight="900" fill="#003932">▸ DELIVERY TIMELINE</text>

          <rect x="120" y="124" width="180" height="80" fill="rgba(161,185,171,0.15)"/>
          <line x1="300" y1="120" x2="300" y2="208" stroke="#00FFB3" stroke-width="1.5"/>
          <g>
            <rect x="142" y="128" width="60" height="6" rx="2" fill="#00FFB3"/>
            <rect x="160" y="140" width="80" height="6" rx="2" fill="#00FFB3"/>
            <rect x="284" y="152" width="10" height="10" rx="2" fill="#3b82f6" transform="rotate(45,289,157)"/>
            <rect x="180" y="166" width="40" height="6" rx="2" fill="#00FFB3"/>
            <rect x="150" y="178" width="30" height="6" rx="2" fill="#490300"/>
            <rect x="384" y="190" width="10" height="10" rx="2" fill="#A1B9AB" transform="rotate(45,389,195)"/>
          </g>

          <!-- Bottom grid: Risks + Cards -->
          <line x1="36" y1="226" x2="424" y2="226" stroke="#003932" stroke-width="1.5"/>
          <text x="36" y="224" font-family="Inter" font-size="8" font-weight="900" fill="#003932">▸ RISKS &amp; ISSUES</text>
          <text x="320" y="224" font-family="Inter" font-size="8" font-weight="900" fill="#003932">▸ COMPLETED · NEXT 14D</text>

          <g font-family="Inter" font-size="7">
            <rect x="36" y="236" width="40" height="14" rx="3" fill="#f0d4d0"/>
            <text x="56" y="246" text-anchor="middle" font-weight="800" fill="#490300">Critical</text>
            <text x="84" y="244" font-weight="700" fill="#003932">MMP delay</text>
            <text x="84" y="254" fill="#5a7a6e">Mitigated by daily reviews</text>

            <rect x="36" y="262" width="40" height="14" rx="3" fill="#ffd9c2"/>
            <text x="56" y="272" text-anchor="middle" font-weight="800" fill="#FF5000">High</text>
            <text x="84" y="270" font-weight="700" fill="#003932">Reinsurance pending</text>
            <text x="84" y="280" fill="#5a7a6e">Awaiting board sign-off</text>

            <rect x="36" y="288" width="40" height="14" rx="3" fill="#dde7df"/>
            <text x="56" y="298" text-anchor="middle" font-weight="800" fill="#3a5547">Medium</text>
            <text x="84" y="296" font-weight="700" fill="#003932">Data sharing scope</text>

            <text x="320" y="244" font-weight="700" fill="#3b82f6">● Charter approved</text>
            <text x="320" y="254" fill="#5a7a6e">15 Jun</text>
            <text x="320" y="268" font-weight="700" fill="#00b894">○ Najm go-live</text>
            <text x="320" y="278" fill="#5a7a6e">30 Jun</text>
          </g>
        </svg>
        <div class="mock-cap">A4 landscape · one page · ready for the email or boardroom</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">Six sections, one page</div>
          <ul>
            <li><strong>Cover banner</strong> — Department · Project · Status chip</li>
            <li><strong>KPI strip</strong> — PM · Progress · Gate · IPI · Budget · Start · Delivery · Sponsor</li>
            <li><strong>Delivery Timeline</strong> — full Gantt with the past-time fade</li>
            <li><strong>Risks &amp; Issues</strong> — top 5 open risks by severity</li>
            <li><strong>Recently Completed</strong> — last 30 days</li>
            <li><strong>Next 14 Days</strong> — upcoming activities</li>
          </ul>
        </div>

        <div class="ws act">
          <div class="lbl">How to generate it</div>
          <p>Click <strong>📄 Print Report</strong> on the project header. A new browser tab opens with the report. Press <code>Ctrl+P</code> → "Save as PDF" → done. Drop the PDF into an email, a steering deck, or print it for the boardroom.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Any Project <span class="sep">›</span> top right of header <span class="sep">›</span> 📄 Print Report</span></p>
        </div>

        <div class="plain">
          <div class="ic">📄</div>
          <div class="ct">
            <div class="lb">Why it matters</div>
            <p>Steering decks used to take an hour of copy-paste. Now: one click, three seconds, branded with Tree colours, always current with whatever the data says today.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 12 GRC DASHBOARD ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 12 · GRC Risk Intelligence</div><div class="num">14</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 12</div>
        <h2 class="s-title">GRC Risk Intelligence Dashboard</h2>
        <div class="s-sub">The risk-side counterpart to the portfolio view — 91 Key Risk Indicators, the Risk Register, the Risk Appetite monitor, audit findings, corrective actions — all live.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="6" width="448" height="268" rx="10" fill="white" stroke="#C9D5C9"/>
          <!-- Header -->
          <rect x="6" y="6" width="448" height="40" rx="10" fill="#003932"/>
          <text x="22" y="32" font-family="Inter" font-size="13" font-weight="900" fill="white">🛡 GRC Risk Intelligence Dashboard</text>

          <!-- KPI strip -->
          <g font-family="Inter" font-size="9">
            <rect x="20" y="58" width="80" height="46" rx="6" fill="white" stroke="#003932" stroke-width="2"/>
            <text x="60" y="78" text-anchor="middle" font-size="18" font-weight="900" fill="#003932">91</text>
            <text x="60" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#5a7a6e">TOTAL KRIs</text>

            <rect x="108" y="58" width="80" height="46" rx="6" fill="white" stroke="#dc2626" stroke-width="2"/>
            <text x="148" y="78" text-anchor="middle" font-size="18" font-weight="900" fill="#dc2626">4</text>
            <text x="148" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#5a7a6e">BREACHING</text>

            <rect x="196" y="58" width="80" height="46" rx="6" fill="white" stroke="#d97706" stroke-width="2"/>
            <text x="236" y="78" text-anchor="middle" font-size="18" font-weight="900" fill="#d97706">2</text>
            <text x="236" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#5a7a6e">AT RISK</text>

            <rect x="284" y="58" width="80" height="46" rx="6" fill="white" stroke="#16a34a" stroke-width="2"/>
            <text x="324" y="78" text-anchor="middle" font-size="18" font-weight="900" fill="#16a34a">75</text>
            <text x="324" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#5a7a6e">WITHIN</text>

            <rect x="372" y="58" width="80" height="46" rx="6" fill="white" stroke="#FF5000" stroke-width="2"/>
            <text x="412" y="78" text-anchor="middle" font-size="18" font-weight="900" fill="#FF5000">0</text>
            <text x="412" y="96" text-anchor="middle" font-size="7" font-weight="700" fill="#5a7a6e">BREACHES</text>
          </g>

          <!-- KRI table preview -->
          <rect x="20" y="116" width="432" height="146" rx="8" fill="white" stroke="#C9D5C9"/>
          <text x="32" y="134" font-family="Inter" font-size="10" font-weight="800" fill="#003932">KRI Status Board</text>
          <line x1="20" y1="142" x2="452" y2="142" stroke="#C9D5C9"/>

          <g font-family="Inter" font-size="8.5">
            <text x="32" y="158" font-weight="700" fill="#003932">Solvency II ratio</text>
            <text x="32" y="170" fill="#5a7a6e">Compliance</text>
            <rect x="250" y="152" width="30" height="12" rx="6" fill="#dc2626"/>
            <text x="265" y="161" text-anchor="middle" font-size="7" font-weight="800" fill="white">RED</text>
            <text x="300" y="161" fill="#5a7a6e">↑ Worsening</text>

            <line x1="20" y1="180" x2="452" y2="180" stroke="#ecf2ed"/>

            <text x="32" y="194" font-weight="700" fill="#003932">Outsourcing review delay</text>
            <text x="32" y="206" fill="#5a7a6e">Operational</text>
            <rect x="250" y="188" width="30" height="12" rx="6" fill="#d97706"/>
            <text x="265" y="197" text-anchor="middle" font-size="7" font-weight="800" fill="white">AMB</text>
            <text x="300" y="197" fill="#5a7a6e">→ Stable</text>

            <line x1="20" y1="216" x2="452" y2="216" stroke="#ecf2ed"/>

            <text x="32" y="230" font-weight="700" fill="#003932">Customer complaints index</text>
            <text x="32" y="242" fill="#5a7a6e">CX</text>
            <rect x="250" y="224" width="30" height="12" rx="6" fill="#16a34a"/>
            <text x="265" y="233" text-anchor="middle" font-size="7" font-weight="800" fill="white">GRN</text>
            <text x="300" y="233" fill="#5a7a6e">↓ Improving</text>

            <text x="232" y="258" text-anchor="middle" font-style="italic" font-size="8" fill="#5a7a6e">+ 88 more · sortable, filterable, searchable</text>
          </g>
        </svg>
        <div class="mock-cap">KRI Status Board · live, filterable, sortable</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">What's tracked</div>
          <ul>
            <li><strong>91 Key Risk Indicators</strong> across 12 business units, 372+ historical readings (5 quarters)</li>
            <li><strong>Risk Register</strong> with probability × impact heatmap</li>
            <li><strong>Risk Appetite Monitor</strong> — tolerance per category, current exposure, utilisation</li>
            <li><strong>Audit Findings</strong> by severity (Critical / High / Medium / Low)</li>
            <li><strong>Corrective Actions</strong> with completion %, target date, finding linkage</li>
          </ul>
        </div>

        <div class="ws see">
          <div class="lbl">Live signals</div>
          <p>Sparklines on each KRI show the trend over the last 5–6 reading periods. RAG status auto-suggests from numeric or text thresholds; PMO can override. Trends and escalations bubble up to the top of the table.</p>
        </div>

        <div class="ws act">
          <div class="lbl">How to use it</div>
          <p>Open weekly. Sort by RAG to surface Red KRIs first. Click into any row to see the Justification + Action Plan for the latest reading.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">Sidebar <span class="sep">›</span> GRC</span> · access controlled by GRC role</p>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 13 GRC PRINT REPORT ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 13 · GRC Quarterly Print Report</div><div class="num">15</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 13</div>
        <h2 class="s-title">GRC Quarterly Print Report</h2>
        <div class="s-sub">A boardroom-grade printable report — Executive Command Centre with three dashboards, full KRI roll, risk register, audit findings, corrective actions. One click.</div>
      </div>
    </div>

    <div class="col-eq">
      <div class="mock">
        <svg width="100%" viewBox="0 0 460 320" xmlns="http://www.w3.org/2000/svg">
          <!-- Sheet -->
          <rect x="14" y="6" width="432" height="308" rx="4" fill="white" stroke="#003932"/>
          <!-- Cover -->
          <rect x="14" y="6" width="432" height="56" fill="#003932"/>
          <rect x="14" y="62" width="432" height="3" fill="#00FFB3"/>
          <text x="28" y="30" font-family="Inter" font-size="11" font-weight="900" fill="white">🛡 GRC Risk Intelligence — Quarterly Report</text>
          <text x="28" y="48" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.65)">Key Risk Indicators · Risk Register · Risk Appetite · Audit Findings · Corrective Actions</text>

          <!-- Exec Summary 3 cards -->
          <text x="28" y="84" font-family="Inter" font-size="10" font-weight="900" fill="#003932">▌Executive Summary</text>

          <g font-family="Inter" font-size="8">
            <rect x="28" y="92" width="130" height="84" rx="6" fill="white" stroke="#003932"/>
            <rect x="28" y="92" width="130" height="3" fill="#003932"/>
            <text x="36" y="108" font-weight="800" font-size="7" fill="#5a7a6e">📊 KEY RISK INDICATORS</text>
            <text x="36" y="130" font-family="JetBrains Mono" font-size="20" font-weight="800" fill="#003932">91</text>
            <text x="36" y="142" font-size="7" fill="#5a7a6e">Active · 13 BUs</text>
            <rect x="36" y="148" width="116" height="4" fill="#dc2626" rx="2"/>
            <text x="36" y="166" font-size="7" fill="#dc2626" font-weight="700">4 breaching · 7% exposure</text>

            <rect x="166" y="92" width="130" height="84" rx="6" fill="white" stroke="#003932"/>
            <rect x="166" y="92" width="130" height="3" fill="#d97706"/>
            <text x="174" y="108" font-weight="800" font-size="7" fill="#5a7a6e">⚠ OPEN RISKS</text>
            <text x="174" y="130" font-family="JetBrains Mono" font-size="20" font-weight="800" fill="#d97706">12</text>
            <text x="174" y="142" font-size="7" fill="#5a7a6e">2 Critical (≥15)</text>
            <rect x="174" y="148" width="116" height="4" fill="#dc2626" rx="2"/>
            <text x="174" y="166" font-size="7" fill="#dc2626" font-weight="700">2 Critical-score risks</text>

            <rect x="304" y="92" width="130" height="84" rx="6" fill="white" stroke="#003932"/>
            <rect x="304" y="92" width="130" height="3" fill="#7c3aed"/>
            <text x="312" y="108" font-weight="800" font-size="7" fill="#5a7a6e">🔍 AUDIT &amp; ACTIONS</text>
            <text x="312" y="130" font-family="JetBrains Mono" font-size="20" font-weight="800" fill="#7c3aed">8</text>
            <text x="312" y="142" font-size="7" fill="#5a7a6e">Open · 16 total</text>
            <rect x="312" y="148" width="116" height="4" fill="#dc2626" rx="2"/>
            <text x="312" y="166" font-size="7" fill="#dc2626" font-weight="700">5 Critical/High · CAPs 68% complete</text>
          </g>

          <!-- KRI Status Board section -->
          <text x="28" y="196" font-family="Inter" font-size="10" font-weight="900" fill="#003932">▌KRI Status Board</text>
          <line x1="28" y1="200" x2="432" y2="200" stroke="#003932" stroke-width="1.5"/>

          <g font-family="Inter" font-size="7.5">
            <text x="28" y="214" font-weight="700" fill="#003932">Solvency II ratio</text>
            <rect x="280" y="208" width="22" height="10" rx="5" fill="#dc2626"/>
            <text x="291" y="216" text-anchor="middle" font-size="6" font-weight="800" fill="white">RED</text>
            <text x="310" y="216" fill="#5a7a6e">↑ Worsening</text>

            <rect x="28" y="222" width="404" height="22" fill="#fff7ed"/>
            <text x="36" y="234" font-weight="800" font-size="7" fill="#92400e">💡 JUSTIFICATION</text>
            <text x="36" y="244" font-size="7" fill="#78350f">Capital base eroded by Q1 catastrophe losses; mitigation in progress with reinsurance</text>

            <line x1="28" y1="252" x2="432" y2="252" stroke="#5a7a6e" stroke-width="1.5"/>

            <text x="28" y="266" font-weight="700" fill="#003932">Outsourcing review delay</text>
            <rect x="280" y="260" width="22" height="10" rx="5" fill="#d97706"/>
            <text x="291" y="268" text-anchor="middle" font-size="6" font-weight="800" fill="white">AMB</text>
          </g>
        </svg>
        <div class="mock-cap">Executive Command Centre on page 1 · KRI roll on pages 2+</div>
      </div>

      <div>
        <div class="ws see">
          <div class="lbl">What the report contains</div>
          <ul>
            <li><strong>Cover</strong> · brand banner, scope (12 BUs · 91 KRIs)</li>
            <li><strong>Executive Summary</strong> — 3 self-contained dashboard cards (KRIs · Risks · Audit) with stacked bars, severity chips, and a one-line insight each</li>
            <li><strong>KRI Status Board</strong> — sorted by RAG severity, with Justification + Action Plan inline under each row</li>
            <li><strong>Risk Register</strong> — top 5 open risks by score, with mitigation</li>
            <li><strong>Risk Appetite Monitor</strong>, <strong>Audit Findings</strong>, <strong>Corrective Actions</strong> — each as its own section</li>
          </ul>
        </div>

        <div class="ws act">
          <div class="lbl">How to generate it</div>
          <p>Open GRC dashboard → click <strong>Print Report</strong>. A new tab opens with the full report. <code>Ctrl+P</code> → "Save as PDF". Quarterly: print, sign, file. Monthly: email PDF to executive committee.</p>
        </div>

        <div class="ws where">
          <div class="lbl">Where to find it</div>
          <p><span class="route">GRC Dashboard <span class="sep">›</span> top toolbar <span class="sep">›</span> Print Report</span></p>
        </div>

        <div class="plain">
          <div class="ic">📑</div>
          <div class="ct">
            <div class="lb">Regulator-ready</div>
            <p>Designed for the same audiences that read your steering deck — Executive Committee, Internal Audit, the regulator. Branded with Tree colours; classification-free for distribution discretion.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 14 COLOUR LEGEND ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 14 · Colour Code Reference</div><div class="num">16</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 14</div>
        <h2 class="s-title">Reading the colour code</h2>
        <div class="s-sub">Every status badge, every chart, every chip across the portal uses the same five-colour vocabulary. Once learned, the entire interface reads at a glance.</div>
      </div>
    </div>

    <div class="col-eq">
      <div>
        <h3 style="font-size:13pt; font-weight:800; color:var(--canopy); margin-bottom:10px;">Project &amp; IPI status</h3>
        <table>
          <thead><tr><th style="width:30%">Colour</th><th>Meaning</th><th style="width:18%">Score / state</th></tr></thead>
          <tbody>
            <tr><td><span class="chip green">On Track</span></td><td>Plan is being met or exceeded</td><td>IPI ≥ 100</td></tr>
            <tr><td><span class="chip amber">Watch</span></td><td>Minor variance; observe</td><td>90–99</td></tr>
            <tr><td><span class="chip orange">At Risk</span></td><td>Material variance; PMO escalation</td><td>70–89</td></tr>
            <tr><td><span class="chip red">Critical</span></td><td>Leadership intervention required</td><td>&lt; 70</td></tr>
            <tr><td><span class="chip grey">Pending Plan</span></td><td>No schedule / cost / doc data yet</td><td>null</td></tr>
            <tr><td><span class="chip red">Delayed</span></td><td>Past planned end, not at 100%</td><td>derived</td></tr>
            <tr><td><span class="chip blue">Completed</span></td><td>100% and at Gate 5</td><td>derived</td></tr>
          </tbody>
        </table>

        <h3 style="font-size:13pt; font-weight:800; color:var(--canopy); margin: 16px 0 10px;">Risk severity</h3>
        <table>
          <thead><tr><th style="width:30%">Severity</th><th>Score range (L × I)</th></tr></thead>
          <tbody>
            <tr><td><span class="chip red">Critical</span></td><td>15 – 25</td></tr>
            <tr><td><span class="chip orange">High</span></td><td>9 – 14</td></tr>
            <tr><td><span class="chip amber">Medium</span></td><td>4 – 8</td></tr>
            <tr><td><span class="chip green">Low</span></td><td>1 – 3</td></tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3 style="font-size:13pt; font-weight:800; color:var(--canopy); margin-bottom:10px;">Activity &amp; milestone (Gantt)</h3>
        <table>
          <thead><tr><th style="width:30%">Colour</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><span class="chip blue">Completed</span></td><td>Activity finished · universal "done"</td></tr>
            <tr><td><span class="chip sea">In Progress</span></td><td>Currently in flight (Tree mint)</td></tr>
            <tr><td><span class="chip red">Delayed / Overdue</span></td><td>Past target, not done (Tree maroon)</td></tr>
            <tr><td><span class="chip grey">Upcoming</span></td><td>Not yet started (Tree moss)</td></tr>
          </tbody>
        </table>

        <h3 style="font-size:13pt; font-weight:800; color:var(--canopy); margin: 16px 0 10px;">KRI RAG (GRC dashboard)</h3>
        <table>
          <thead><tr><th style="width:30%">RAG</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><span class="chip red">Red</span></td><td>Breaching threshold · escalation</td></tr>
            <tr><td><span class="chip orange">Amber</span></td><td>Approaching threshold · monitor closely</td></tr>
            <tr><td><span class="chip green">Green</span></td><td>Within tolerance</td></tr>
          </tbody>
        </table>

        <div class="plain">
          <div class="ic">🎨</div>
          <div class="ct">
            <div class="lb">Tree brand palette</div>
            <p>Sea mint accents the live and energetic. Canopy green is the deep brand anchor. Orange warns. Maroon signals gravity. Moss and Lichen carry the neutrals. Every status chip in the portal pulls from this palette — by design.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

<!-- ═══════════════════════ 15 NAVIGATION CHEAT SHEET ═══════════════════════ -->
<div class="slide">
  <div class="s-head"><div class="logo">PMO</div><div class="crumb">Chapter 15 · Navigation Cheat Sheet</div><div class="num">17</div></div>
  <div class="body">
    <div class="s-title-row">
      <div>
        <div class="s-label">Chapter 15</div>
        <h2 class="s-title">Where to find what</h2>
        <div class="s-sub">One reference page — every insight in the portal, mapped to the screen and the click path. Save this slide as the bookmark.</div>
      </div>
    </div>

    <table>
      <thead><tr><th style="width:25%">If you want to see…</th><th>Open</th><th style="width:14%">Page</th></tr></thead>
      <tbody>
        <tr><td class="k">Today's flagged projects</td><td><span class="route">Home <span class="sep">›</span> Requires Attention (top)</span></td><td>p.6</td></tr>
        <tr><td class="k">Enterprise health (one number)</td><td><span class="route">Home <span class="sep">›</span> Portfolio IPI card</span></td><td>p.7</td></tr>
        <tr><td class="k">Capital at risk of overrun</td><td><span class="route">Home <span class="sep">›</span> Forecast Overrun card</span></td><td>p.7</td></tr>
        <tr><td class="k">Bottlenecks by gate</td><td><span class="route">Home <span class="sep">›</span> Gate Pipeline panel</span></td><td>p.8</td></tr>
        <tr><td class="k">Pending approvals queue</td><td><span class="route">Home <span class="sep">›</span> Pending Approvals (right column)</span></td><td>p.8</td></tr>
        <tr><td class="k">Overdue milestones (all projects)</td><td><span class="route">Home <span class="sep">›</span> Overdue Milestones (right column)</span></td><td>p.8</td></tr>
        <tr><td class="k">Department comparison + ranking</td><td><span class="route">Sidebar <span class="sep">›</span> Departments IPI</span></td><td>p.9</td></tr>
        <tr><td class="k">All projects (table + filters + sort)</td><td><span class="route">Sidebar <span class="sep">›</span> All Projects</span></td><td>—</td></tr>
        <tr><td class="k">A single project's full view</td><td><span class="route">Click any project anywhere → Project View</span></td><td>p.10</td></tr>
        <tr><td class="k">Project IPI breakdown + Anticipated MCI</td><td><span class="route">Project <span class="sep">›</span> header (IPI banner)</span></td><td>p.11</td></tr>
        <tr><td class="k">Project schedule (Gantt)</td><td><span class="route">Project <span class="sep">›</span> Activities tab</span></td><td>p.12</td></tr>
        <tr><td class="k">Project documents &amp; compliance</td><td><span class="route">Project <span class="sep">›</span> Documents tab</span></td><td>—</td></tr>
        <tr><td class="k">Project risks &amp; issues</td><td><span class="route">Project <span class="sep">›</span> Risks &amp; Issues tab</span></td><td>—</td></tr>
        <tr><td class="k">Project executive one-pager</td><td><span class="route">Project <span class="sep">›</span> header <span class="sep">›</span> 📄 Print Report</span></td><td>p.13</td></tr>
        <tr><td class="k">My pending approvals (as user)</td><td><span class="route">Sidebar <span class="sep">›</span> My Actions</span></td><td>—</td></tr>
        <tr><td class="k">My open project requests</td><td><span class="route">Sidebar <span class="sep">›</span> My Requests</span></td><td>—</td></tr>
        <tr><td class="k">GRC: KRI status + risk register</td><td><span class="route">Sidebar <span class="sep">›</span> GRC</span></td><td>p.14</td></tr>
        <tr><td class="k">GRC quarterly print report</td><td><span class="route">GRC <span class="sep">›</span> Print Report (top right)</span></td><td>p.15</td></tr>
        <tr><td class="k">Admin: CRUD projects / departments</td><td><span class="route">Sidebar <span class="sep">›</span> Admin Panel</span> (admin only)</td><td>—</td></tr>
      </tbody>
    </table>

    <div class="plain" style="margin-top: 12px;">
      <div class="ic">💬</div>
      <div class="ct">
        <div class="lb">Support &amp; questions</div>
        <p>Methodology questions → see the companion IPI Methodology document (Version 2). Operational issues → contact the Project Management Office. Access &amp; role questions → contact IT Service Desk for SharePoint permissions.</p>
      </div>
    </div>
  </div>
  <div class="s-foot"><span class="doc-name">Executive Awareness Deck V4</span><span>PMO · Tree Digital Insurance Company</span></div>
</div>

</body>
</html>`;

const outPath = path.join('C:', 'Users', 'nioh1', 'Desktop', 'PMO-Portal-Deliverables', 'PMO-Exec-Deck-V4.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath, '·', html.length, 'bytes');
