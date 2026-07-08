// Builds a polished 12-slide technical deck for the PMO Portal.
// A4 landscape, one slide per page, designed for both screen viewing and print.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PMO Portal — Technical Overview</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --brand:   #003932;
    --brand-2: #006b5d;
    --mint:    #00b894;
    --mint-lt: #e6f9f5;
    --amber:   #f59e0b;
    --red:     #ef4444;
    --blue:    #3b82f6;
    --purple:  #a855f7;
    --ink:     #0d1f1c;
    --muted:   #4b6c67;
    --border:  #d1e8e4;
    --bg:      #f5faf9;
    --white:   #ffffff;
  }
  body {
    font-family: 'Inter', sans-serif;
    background: #c8d8d5;
    color: var(--ink);
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .slide {
    width: 297mm;
    height: 210mm;
    background: var(--white);
    margin: 10mm auto;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 40px rgba(0,57,50,0.14);
    display: flex;
    flex-direction: column;
  }
  @media print {
    body { background: white; }
    .slide { margin: 0; box-shadow: none; page-break-after: always; }
    .slide:last-child { page-break-after: avoid; }
  }
  @page { size: A4 landscape; margin: 0; }

  /* SLIDE HEADER (small bar) */
  .slide-head {
    background: var(--brand);
    height: 8mm;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 0 12mm;
    gap: 10px;
  }
  .slide-head .logo {
    background: var(--mint);
    color: var(--brand);
    font-weight: 900;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .slide-head .doc {
    color: rgba(255,255,255,0.6);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .slide-head .num {
    margin-left: auto;
    color: var(--mint);
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .slide-body {
    flex: 1;
    padding: 12mm 14mm 10mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .slide-foot {
    background: var(--brand);
    height: 4mm;
    flex-shrink: 0;
  }

  h1.title {
    font-size: 28px;
    font-weight: 900;
    color: var(--brand);
    letter-spacing: -0.6px;
    line-height: 1.1;
    margin-bottom: 4px;
  }
  .subtitle {
    font-size: 13px;
    color: var(--muted);
    margin-bottom: 18px;
    font-weight: 500;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--mint-lt);
    border: 1px solid #a7f3d0;
    color: var(--brand);
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .tag .dot { width: 6px; height: 6px; background: var(--mint); border-radius: 50%; }

  /* COVER SLIDE */
  .cover {
    background: linear-gradient(135deg, #003932 0%, #005c4b 50%, #007a62 100%);
    color: white;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    bottom: -100px; right: -100px;
    width: 400px; height: 400px;
    background: rgba(0,184,148,0.08);
    border-radius: 50%;
  }
  .cover::after {
    content: '';
    position: absolute;
    top: -50px; left: -50px;
    width: 200px; height: 200px;
    background: rgba(0,184,148,0.05);
    border-radius: 50%;
  }
  .cover .slide-body {
    justify-content: center;
    align-items: flex-start;
    padding-left: 20mm;
    position: relative;
    z-index: 2;
  }
  .cover .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,184,148,0.18);
    border: 1px solid rgba(0,184,148,0.35);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 20px;
  }
  .cover .badge .d { width: 7px; height: 7px; background: var(--mint); border-radius: 50%; }
  .cover .badge span { color: var(--mint); font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover h1 {
    color: white;
    font-size: 56px;
    font-weight: 900;
    letter-spacing: -1.5px;
    line-height: 1.0;
    margin-bottom: 14px;
  }
  .cover h1 em { color: var(--mint); font-style: normal; }
  .cover .lead {
    color: rgba(255,255,255,0.7);
    font-size: 18px;
    max-width: 70%;
    font-weight: 400;
    line-height: 1.4;
    margin-bottom: 32px;
  }
  .cover .meta-strip {
    display: flex;
    gap: 28px;
    margin-top: 8px;
  }
  .cover .meta-strip .item .l { font-size: 10px; color: rgba(0,184,148,0.7); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
  .cover .meta-strip .item .v { font-size: 14px; color: white; font-weight: 600; }

  /* GRIDS */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; flex: 1; }
  .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; flex: 1; }
  .four-col { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

  /* CARDS */
  .card {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .card.dark { background: var(--brand); color: white; border: none; }
  .card.dark .ck { color: var(--mint); }
  .card.mint { background: var(--mint-lt); border-color: #a7f3d0; }
  .card .ck {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--mint);
    margin-bottom: 6px;
  }
  .card .h { font-size: 14px; font-weight: 800; color: var(--brand); margin-bottom: 6px; letter-spacing: -0.3px; }
  .card.dark .h { color: white; }
  .card .b { font-size: 11px; color: var(--muted); line-height: 1.6; }
  .card.dark .b { color: rgba(255,255,255,0.85); }

  /* STAT TILES */
  .stat {
    background: var(--brand);
    color: white;
    border-radius: 12px;
    padding: 14px 16px;
    text-align: center;
  }
  .stat .n { font-size: 32px; font-weight: 900; color: var(--mint); letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
  .stat .l { font-size: 10px; color: rgba(255,255,255,0.7); font-weight: 600; line-height: 1.3; }

  /* BEFORE/AFTER */
  .compare { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1; }
  .compare .pane {
    border-radius: 14px;
    padding: 18px 20px;
  }
  .compare .pane.before { background: #fef2f2; border: 1.5px solid #fecaca; }
  .compare .pane.after  { background: var(--mint-lt); border: 1.5px solid #a7f3d0; }
  .compare h3 { font-size: 12px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 12px; }
  .compare .pane.before h3 { color: #991b1b; }
  .compare .pane.after  h3 { color: var(--brand); }
  .compare ul { list-style: none; }
  .compare ul li {
    font-size: 11.5px;
    padding: 6px 0;
    line-height: 1.45;
    border-bottom: 1px dashed rgba(0,0,0,0.06);
  }
  .compare ul li:last-child { border: none; }
  .compare .pane.before li::before { content: "✕ "; color: #dc2626; font-weight: 800; }
  .compare .pane.after  li::before { content: "✓ "; color: var(--brand); font-weight: 800; }

  /* TECH STACK GRID */
  .stack { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stack .row { background: var(--bg); border: 1.5px solid var(--border); border-radius: 10px; padding: 10px 12px; }
  .stack .row .role { font-size: 9px; color: var(--mint); font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .stack .row .name { font-size: 13px; font-weight: 700; color: var(--brand); margin-bottom: 2px; }
  .stack .row .why  { font-size: 10px; color: var(--muted); line-height: 1.4; }

  /* ARCHITECTURE DIAGRAM */
  .arch {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
  }
  .arch .layer {
    display: flex;
    gap: 10px;
    justify-content: center;
    align-items: stretch;
  }
  .arch .box {
    background: white;
    border: 2px solid var(--brand);
    border-radius: 10px;
    padding: 12px 16px;
    text-align: center;
    flex: 1;
    max-width: 220px;
  }
  .arch .box.client { border-color: var(--mint); background: var(--mint-lt); }
  .arch .box.msft { border-color: var(--blue); background: #eff6ff; }
  .arch .box.cloud { border-color: var(--purple); background: #faf5ff; }
  .arch .box .lbl { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: var(--brand); margin-bottom: 4px; }
  .arch .box .name { font-size: 13px; font-weight: 800; color: var(--brand); margin-bottom: 2px; }
  .arch .box .role { font-size: 10px; color: var(--muted); line-height: 1.35; }
  .arch .arrows {
    display: flex;
    justify-content: center;
    gap: 60px;
    color: var(--mint);
    font-size: 22px;
    font-weight: 900;
  }
  .arch .ground {
    background: var(--brand);
    color: white;
    border-radius: 10px;
    padding: 12px 18px;
    font-size: 11px;
    text-align: center;
    margin-top: 4px;
    font-weight: 600;
  }
  .arch .ground .strong { color: var(--mint); font-weight: 800; }

  /* AUTH FLOW STEPS */
  .flow { display: flex; gap: 8px; align-items: stretch; flex: 1; }
  .flow .step {
    flex: 1;
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    position: relative;
  }
  .flow .step .num {
    width: 24px; height: 24px;
    background: var(--brand);
    color: white;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .flow .step .ic { font-size: 24px; margin-bottom: 6px; }
  .flow .step .t { font-size: 12px; font-weight: 800; color: var(--brand); margin-bottom: 4px; line-height: 1.2; }
  .flow .step .d { font-size: 10px; color: var(--muted); line-height: 1.45; }
  .flow .arr {
    display: flex;
    align-items: center;
    color: var(--mint);
    font-size: 18px;
    font-weight: 900;
  }

  /* TABLES */
  table.ref {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.ref th {
    background: var(--brand);
    color: white;
    padding: 7px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  table.ref th:first-child { border-radius: 8px 0 0 0; }
  table.ref th:last-child  { border-radius: 0 8px 0 0; }
  table.ref td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    line-height: 1.45;
    vertical-align: top;
  }
  table.ref tr:nth-child(even) td { background: var(--bg); }
  table.ref td.col-name { font-weight: 700; color: var(--brand); white-space: nowrap; }
  table.ref code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--brand);
  }

  /* CODE BLOCKS */
  pre.code {
    background: #0d1f1c;
    color: #d1e8e4;
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.55;
    overflow-x: auto;
  }
  pre.code .k { color: #00b894; font-weight: 600; }
  pre.code .s { color: #f59e0b; }
  pre.code .c { color: #6b7280; font-style: italic; }
  pre.code .v { color: #93c5fd; }

  /* FEATURE LIST */
  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .feat {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .feat .ic { font-size: 22px; margin-bottom: 6px; }
  .feat .n { font-size: 12px; font-weight: 800; color: var(--brand); margin-bottom: 3px; }
  .feat .d { font-size: 10px; color: var(--muted); line-height: 1.4; }

  /* IPI SCENARIOS */
  .ipi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .ipi-tile {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }
  .ipi-tile .n { font-size: 28px; font-weight: 900; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
  .ipi-tile .l { font-size: 10px; color: var(--muted); font-weight: 600; line-height: 1.35; }
  .ipi-tile.green { border-color: #86efac; background: #f0fdf4; } .ipi-tile.green .n { color: #15803d; }
  .ipi-tile.blue  { border-color: #93c5fd; background: #eff6ff; } .ipi-tile.blue  .n { color: #1d4ed8; }
  .ipi-tile.amber { border-color: #fcd34d; background: #fffbeb; } .ipi-tile.amber .n { color: #92400e; }
  .ipi-tile.red   { border-color: #fca5a5; background: #fef2f2; } .ipi-tile.red   .n { color: #991b1b; }
  .ipi-tile.gray  { border-color: #d1d5db; background: #f9fafb; } .ipi-tile.gray  .n { color: #6b7280; }

  /* INFO STRIPS */
  .info {
    background: #eff6ff;
    border: 1.5px solid #bfdbfe;
    border-left: 4px solid #1d4ed8;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    font-size: 11px;
    color: #1e3a8a;
    line-height: 1.5;
  }
  .info strong { color: #1d4ed8; font-weight: 800; }
  .warn {
    background: #fffbeb;
    border: 1.5px solid #fde68a;
    border-left: 4px solid var(--amber);
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    font-size: 11px;
    color: #78350f;
    line-height: 1.5;
  }

  /* GAP ANALYSIS */
  .gap-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; flex: 1; }
  .gap {
    background: white;
    border: 1.5px solid var(--border);
    border-left: 5px solid #6b7280;
    border-radius: 8px;
    padding: 9px 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .gap.crit { border-left-color: #dc2626; background: #fef2f2; }
  .gap.med  { border-left-color: #f59e0b; background: #fffbeb; }
  .gap.low  { border-left-color: #3b82f6; background: #eff6ff; }
  .gap .pri {
    flex-shrink: 0;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-top: 1px;
  }
  .gap.crit .pri { background: #fee2e2; color: #991b1b; }
  .gap.med .pri  { background: #fef3c7; color: #854d0e; }
  .gap.low .pri  { background: #dbeafe; color: #1d4ed8; }
  .gap .body { flex: 1; }
  .gap .t { font-size: 11.5px; font-weight: 800; color: var(--brand); margin-bottom: 2px; line-height: 1.2; }
  .gap .d { font-size: 10px; color: var(--muted); line-height: 1.4; }

  /* PLAN TABLE */
  table.plan {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  table.plan th {
    background: var(--brand);
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  table.plan th:first-child { border-radius: 8px 0 0 0; }
  table.plan th:last-child  { border-radius: 0 8px 0 0; }
  table.plan td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    line-height: 1.4;
    vertical-align: top;
  }
  table.plan tr:nth-child(even) td { background: var(--bg); }
  table.plan .p-chip {
    display: inline-block;
    font-size: 9px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  table.plan .p-chip.crit { background: #fee2e2; color: #991b1b; }
  table.plan .p-chip.med  { background: #fef3c7; color: #854d0e; }
  table.plan .p-chip.low  { background: #dbeafe; color: #1d4ed8; }
  table.plan td.task { font-weight: 600; color: var(--brand); }
  table.plan td.eff { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); white-space: nowrap; }
  table.plan tfoot td {
    background: var(--brand);
    color: white;
    font-weight: 800;
    font-size: 12px;
  }

  /* CLOSING SLIDE */
  .closing {
    background: linear-gradient(135deg, #003932 0%, #005c4b 100%);
    color: white;
  }
  .closing .slide-body {
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .closing h1 { color: white; font-size: 48px; font-weight: 900; letter-spacing: -1px; margin-bottom: 10px; }
  .closing .sub { color: rgba(255,255,255,0.65); font-size: 15px; margin-bottom: 28px; max-width: 600px; }
  .closing .links { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .closing .link {
    background: rgba(0,184,148,0.15);
    border: 1px solid rgba(0,184,148,0.4);
    border-radius: 22px;
    padding: 8px 18px;
    color: var(--mint);
    font-size: 11px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }
</style>
</head>
<body>

<!-- ════════════ SLIDE 1 — COVER ════════════ -->
<div class="slide cover">
  <div class="slide-body">
    <div class="badge"><div class="d"></div><span>Technical Overview · v1.0</span></div>
    <h1>PMO <em>Portal</em></h1>
    <div class="lead">Enterprise Project &amp; Risk Governance — built as a serverless React SPA over SharePoint, Azure AD, and Power Automate.</div>
    <div class="meta-strip">
      <div class="item"><div class="l">Audience</div><div class="v">Technical Team</div></div>
      <div class="item"><div class="l">Stack</div><div class="v">React · SharePoint · Azure AD</div></div>
      <div class="item"><div class="l">Owner</div><div class="v">Tree Digital Insurance · PMO</div></div>
    </div>
  </div>
</div>

<!-- ════════════ SLIDE 2 — PROBLEM / SOLUTION ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">02 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>Why it exists</div>
    <h1 class="title">What problem are we solving?</h1>
    <div class="subtitle">Replace scattered emails, manual tracking, and status calls with a single source of truth.</div>
    <div class="compare">
      <div class="pane before">
        <h3>Before — fragmented workflow</h3>
        <ul>
          <li>Email threads to initiate any project request</li>
          <li>Word/PDF gate checklists circulated manually</li>
          <li>Stakeholder approvals tracked in separate spreadsheets</li>
          <li>PMO chases PMs for status; portfolio view rebuilt monthly</li>
          <li>No reliable IPI; no early warning when projects drift</li>
          <li>Risk Register and KRIs live in separate Excel files per dept</li>
        </ul>
      </div>
      <div class="pane after">
        <h3>After — one portal</h3>
        <ul>
          <li>Structured intake form with role-based routing</li>
          <li>Live dashboards updated automatically by the data layer</li>
          <li>Stakeholder approvals logged with timestamps via Power Automate</li>
          <li>PMs update once; the portfolio view recomputes in real time</li>
          <li>Governance-grade IPI engine, auditor-ready</li>
          <li>GRC dashboard ingests 91 KRIs across 12 departments</li>
        </ul>
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 3 — AT A GLANCE ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">03 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>By the numbers</div>
    <h1 class="title">At a glance</h1>
    <div class="subtitle">Where the portal stands today on production.</div>
    <div class="four-col" style="margin-bottom: 14px;">
      <div class="stat"><div class="n">~5K</div><div class="l">Lines of application code</div></div>
      <div class="stat"><div class="n">12</div><div class="l">Departments tracked</div></div>
      <div class="stat"><div class="n">91</div><div class="l">Key Risk Indicators (KRIs)</div></div>
      <div class="stat"><div class="n">372</div><div class="l">Historical KRI readings imported</div></div>
    </div>
    <div class="four-col" style="margin-bottom: 14px;">
      <div class="stat"><div class="n">11</div><div class="l">SharePoint Lists wired in</div></div>
      <div class="stat"><div class="n">9</div><div class="l">User roles with RBAC matrix</div></div>
      <div class="stat"><div class="n">6+</div><div class="l">Power Automate flows</div></div>
      <div class="stat"><div class="n">∞</div><div class="l">Vercel auto-deploys on push to main</div></div>
    </div>
    <div class="info" style="margin-top: 6px;">
      <strong>Production URL:</strong> <code>pmo-portal-seven.vercel.app</code> — Auto-deployed from GitHub, secured behind Azure AD, backed by Tree Digital Insurance's SharePoint Online tenant.
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 4 — TECH STACK ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">04 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>The stack</div>
    <h1 class="title">Tech choices &amp; why</h1>
    <div class="subtitle">Boring, proven pieces — fast to ship and easy to maintain at this scale.</div>
    <div class="stack">
      <div class="row"><div class="role">UI Framework</div><div class="name">React 18</div><div class="why">Component model, mature ecosystem, hooks for state</div></div>
      <div class="row"><div class="role">Build &amp; Dev Server</div><div class="name">Vite 5</div><div class="why">Sub-second HMR, ESM-native, zero-config for our scale</div></div>
      <div class="row"><div class="role">State Management</div><div class="name">useState / useMemo</div><div class="why">No Redux — app is small enough for local + lifted state</div></div>
      <div class="row"><div class="role">Styling</div><div class="name">Inline + design tokens</div><div class="why">No Tailwind / no CSS framework — tokens via the theme object</div></div>
      <div class="row"><div class="role">Charts</div><div class="name">Recharts</div><div class="why">Declarative, composes with React; Sparklines done in raw SVG for speed</div></div>
      <div class="row"><div class="role">Authentication</div><div class="name">MSAL Browser + React</div><div class="why">Microsoft's official SDK for Azure AD / Entra ID</div></div>
      <div class="row"><div class="role">Backend / Database</div><div class="name">SharePoint Online (REST)</div><div class="why">Already provisioned by IT, free with M365, no infra to run</div></div>
      <div class="row"><div class="role">Workflow Engine</div><div class="name">Power Automate</div><div class="why">Approval routing, ApprovalLog updates, email notifications</div></div>
      <div class="row"><div class="role">Hosting</div><div class="name">Vercel</div><div class="why">Static SPA hosting + auto-deploy from GitHub on every push to main</div></div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 5 — ARCHITECTURE ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">05 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>How it fits together</div>
    <h1 class="title">High-level architecture</h1>
    <div class="subtitle">Browser → React SPA → three Microsoft cloud services. No app server, no database server.</div>
    <div class="arch">
      <div class="layer">
        <div class="box client">
          <div class="lbl">User Tier</div>
          <div class="name">Web Browser</div>
          <div class="role">Edge / Chrome / Safari · MSAL session in sessionStorage</div>
        </div>
      </div>
      <div class="arrows"><span>↓</span></div>
      <div class="layer">
        <div class="box client">
          <div class="lbl">Application Tier</div>
          <div class="name">React SPA</div>
          <div class="role">Static bundle served by Vercel CDN · client-side routing</div>
        </div>
      </div>
      <div class="arrows"><span>↓</span><span>↓</span><span>↓</span></div>
      <div class="layer">
        <div class="box msft">
          <div class="lbl">Identity</div>
          <div class="name">Azure AD (Entra ID)</div>
          <div class="role">OAuth 2.0 tokens · scoped to SharePoint resource origin</div>
        </div>
        <div class="box msft">
          <div class="lbl">Data Layer</div>
          <div class="name">SharePoint Online</div>
          <div class="role">REST API · 11 lists serve as our database tables</div>
        </div>
        <div class="box cloud">
          <div class="lbl">Workflow</div>
          <div class="name">Power Automate</div>
          <div class="role">Triggered by SP item changes · writes ApprovalLog back</div>
        </div>
      </div>
      <div class="ground">
        <span class="strong">No backend server.</span> No Node, no Python, no managed database. Every read/write goes from the browser directly to SharePoint with an MSAL-issued Bearer token.
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 6 — AUTH FLOW ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">06 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>Sign-in path</div>
    <h1 class="title">Authentication flow (MSAL)</h1>
    <div class="subtitle">The user signs into Microsoft once; the same token authorises every SharePoint call.</div>
    <div class="flow">
      <div class="step">
        <div class="num">1</div><div class="ic">🌐</div>
        <div class="t">Open Portal</div>
        <div class="d">Vercel serves index.html + JS bundle to the browser.</div>
      </div>
      <div class="arr">→</div>
      <div class="step">
        <div class="num">2</div><div class="ic">🔵</div>
        <div class="t">MSAL redirects</div>
        <div class="d">First load triggers <code>loginRedirect</code> to login.microsoftonline.com.</div>
      </div>
      <div class="arr">→</div>
      <div class="step">
        <div class="num">3</div><div class="ic">🏢</div>
        <div class="t">User authenticates</div>
        <div class="d">Tenant-scoped sign-in with Tree Digital corporate credentials + MFA.</div>
      </div>
      <div class="arr">→</div>
      <div class="step">
        <div class="num">4</div><div class="ic">🔑</div>
        <div class="t">Acquire SP token</div>
        <div class="d"><code>acquireTokenSilent</code> with scope <code>AllSites.Write</code> for the SP origin.</div>
      </div>
      <div class="arr">→</div>
      <div class="step">
        <div class="num">5</div><div class="ic">📡</div>
        <div class="t">REST calls</div>
        <div class="d">Every SP fetch carries <code>Authorization: Bearer &lt;token&gt;</code>.</div>
      </div>
    </div>
    <div class="info" style="margin-top: 16px;">
      <strong>Mock mode:</strong> when the env var <code>VITE_USE_MOCK=true</code>, MSAL is bypassed entirely. The role is set from <code>localStorage.pmo_mock_email</code>, and all SP writes are no-ops — useful for local dev and demos without a tenant.
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 7 — DATA LAYER ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">07 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>The "database"</div>
    <h1 class="title">SharePoint as the backend</h1>
    <div class="subtitle">11 SP Lists. JSON-encoded sub-collections (risks, milestones, etc.) inside text columns where Lists can't model 1:N cleanly.</div>
    <table class="ref">
      <thead><tr><th style="width:25%">List</th><th style="width:18%">Site</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td class="col-name">PMO_Projects</td><td>PMO-2026</td><td>Every project record — 52 columns including the JSON sub-fields for milestones, risks, documents, approvals, ipiHistory</td></tr>
        <tr><td class="col-name">PMO_Departments</td><td>PMO-2026</td><td>Department reference for filtering and dept-level rollups</td></tr>
        <tr><td class="col-name">PMO_Users</td><td>PMO-2026</td><td>Email → role mapping for the RBAC matrix</td></tr>
        <tr><td class="col-name">New Project Request</td><td>PMO-2026</td><td>Intake form submissions before they become projects</td></tr>
        <tr><td class="col-name">G1 - Project Initiation</td><td>PMO-2026</td><td>Gate-1 approval submissions, with ApprovalLog from Power Automate</td></tr>
        <tr><td class="col-name">Project Closure - E-Signoff</td><td>PMO-2026</td><td>Closure approvals, same ApprovalLog pattern</td></tr>
        <tr><td class="col-name">GRC_KRI_Master</td><td>GRC-Dashboard</td><td>KRI definitions: thresholds, frequency, category, owner</td></tr>
        <tr><td class="col-name">GRC_KRI_Readings</td><td>GRC-Dashboard</td><td>Period readings + Justification + ActionPlan governance fields</td></tr>
        <tr><td class="col-name">GRC_RiskRegister · GRC_RiskAppetite</td><td>GRC-Dashboard</td><td>Risk inventory and appetite thresholds per category</td></tr>
        <tr><td class="col-name">GRC_AuditFindings · GRC_CorrectiveActions</td><td>GRC-Dashboard</td><td>Internal audit observations and remediation tracking</td></tr>
      </tbody>
    </table>
    <div class="info" style="margin-top: 14px;">
      <strong>Why SharePoint?</strong> Auth (Azure AD), permissions, versioning, recycle bin, and REST API are all "free" with our M365 tenant. Trade-off: queries are limited (no JOINs, OData syntax) — but at 10–16 projects/year we never hit those limits.
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 8 — WORKFLOW AUTOMATION ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">08 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>What Power Automate does</div>
    <h1 class="title">Workflows that don't belong in the SPA</h1>
    <div class="subtitle">Approval routing and audit trails happen server-side in Power Automate, then write back to SP for the portal to display.</div>
    <div class="two-col">
      <div>
        <div class="card mint">
          <div class="ck">Example flow · G1 Approval</div>
          <div class="b" style="font-size: 11.5px; line-height: 1.6;">
            1. PM submits the G1 form (SP list "G1 - Project Initiation")<br>
            2. Power Automate triggers on item create<br>
            3. Flow routes the approval task to Project Sponsor → Stakeholders → PMO → Finance, conditionally on item fields<br>
            4. Each approver's decision is appended to the <code>ApprovalLog</code> text column<br>
            5. Final status is written back; portal picks it up on next refresh
          </div>
        </div>
        <div class="info" style="margin-top: 12px;">
          <strong>The ApprovalLog column</strong> is just a multi-line text field. Portal reads it, parses each line into structured rows, and renders the audit trail as a collapsible panel in MyActions and MyRequests.
        </div>
      </div>
      <div>
        <pre class="code"><span class="c">// Example line written by Power Automate:</span>
✅ Mohammed Alabdulmuhsin (Stakeholder)
   — Approve — 11/06/2026 15:18 — No comment

❌ Sara Almutairi (Finance)
   — Reject — 12/06/2026 09:45
   — Budget needs revision before approval

<span class="c">// Portal parses to:</span>
[
  { emoji: <span class="s">"✅"</span>, name: <span class="s">"Mohammed..."</span>,
    role: <span class="s">"Stakeholder"</span>,
    decision: <span class="s">"Approve"</span>,
    when: <span class="s">"11/06/2026 15:18"</span>,
    comment: <span class="s">""</span> },
  { emoji: <span class="s">"❌"</span>, name: <span class="s">"Sara..."</span>,
    role: <span class="s">"Finance"</span>,
    decision: <span class="s">"Reject"</span>,
    when: <span class="s">"12/06/2026 09:45"</span>,
    comment: <span class="s">"Budget needs revision..."</span> }
]</pre>
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 9 — KEY FEATURES ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">09 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>What the portal does</div>
    <h1 class="title">Feature surface</h1>
    <div class="subtitle">Three main pillars: Executive view, PM workspace, GRC dashboard.</div>
    <div class="features">
      <div class="feat">
        <div class="ic">📊</div>
        <div class="n">Portfolio Dashboard</div>
        <div class="d">Live KPIs, executive intervention panel, dept summary cards, portfolio timeline (Gantt).</div>
      </div>
      <div class="feat">
        <div class="ic">📁</div>
        <div class="n">Project Workspace</div>
        <div class="d">5-tab project view: Overview, Activities (WBS), Budget, Risks &amp; Issues, Documents, Updates.</div>
      </div>
      <div class="feat">
        <div class="ic">🛡️</div>
        <div class="n">GRC Dashboard</div>
        <div class="d">91 KRIs across 12 departments. 5 quarters of history. Sparklines, multi-filter table, Risk Register, Audit Findings.</div>
      </div>
      <div class="feat">
        <div class="ic">🎯</div>
        <div class="n">WBS Activities</div>
        <div class="d">Hierarchical milestones with nested activities. Weighted progress rolls up automatically.</div>
      </div>
      <div class="feat">
        <div class="ic">⚙️</div>
        <div class="n">IPI Engine</div>
        <div class="d">Governance-grade Schedule + Cost + Doc compliance index, with roadmap deadline penalty.</div>
      </div>
      <div class="feat">
        <div class="ic">📜</div>
        <div class="n">Approval Log</div>
        <div class="d">Parsed audit trail of who approved/rejected each gate and closure, with timestamps and comments.</div>
      </div>
      <div class="feat">
        <div class="ic">✅</div>
        <div class="n">My Actions</div>
        <div class="d">Personal work queue: pending validations, overdue milestones, gates awaiting your decision.</div>
      </div>
      <div class="feat">
        <div class="ic">📨</div>
        <div class="n">My Requests</div>
        <div class="d">Requester &amp; PM view: submitted requests, gate statuses, closure progress, all in one place.</div>
      </div>
      <div class="feat">
        <div class="ic">🔧</div>
        <div class="n">Admin Panel</div>
        <div class="d">Archive / restore / delete projects, manage departments, control deferred lifecycle items.</div>
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 10 — IPI ENGINE ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">10 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>The crown jewel</div>
    <h1 class="title">IPI engine — governance-grade</h1>
    <div class="subtitle">The metric the regulator audits. Transparent formula, time-based EVM, 1% per day roadmap penalty, null-aware rollups.</div>
    <div class="two-col" style="margin-bottom: 12px;">
      <div>
        <pre class="code"><span class="c">// Formula (metrics.js)</span>
SPI = Σ(weight × actual%) / Σ(weight × planned%)
       <span class="c">// planned% is LINEAR over each activity's
       //  startDate → endDate at asOfDate</span>

CPI = (progress × budget) / actualCost

MCI = approved required docs / total required

penalty = max(0, 1 - daysPastRoadmap / 100)
       <span class="c">// = 1% per day past roadmap deadline</span>

spiFinal = SPI × penalty

IPI = 0.50·spiFinal + 0.25·CPI + 0.25·MCI
       <span class="c">// each component capped at 1.20</span></pre>
      </div>
      <div>
        <div class="card">
          <div class="h">Reference scenarios — what to expect</div>
          <div class="ipi-grid" style="margin-top: 10px;">
            <div class="ipi-tile gray"><div class="n">—</div><div class="l">Empty project<br>"Pending Plan"</div></div>
            <div class="ipi-tile blue"><div class="n">104</div><div class="l">50% done at 50% timeline</div></div>
            <div class="ipi-tile green"><div class="n">110</div><div class="l">100% done at 25% timeline (early)</div></div>
            <div class="ipi-tile amber"><div class="n">80</div><div class="l">30 days past roadmap, 60% done</div></div>
          </div>
          <div class="b" style="margin-top: 10px; font-size: 10.5px;">
            Max theoretical IPI ≈ 115 when SPI &amp; CPI hit the 1.20 cap and MCI is full.
            "Over Achieved" = above 100. Department &amp; portfolio rollups skip null-IPI projects so unstarted work doesn't pollute the average.
          </div>
        </div>
      </div>
    </div>
    <div class="info">
      <strong>Auditability:</strong> All thresholds (cap, decay window, weights) live in a single <code>IPI_DEFAULTS</code> constant in <code>src/utils/metrics.js</code>. Every step is commented so an auditor can re-derive any score from the raw fields.
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 11 — SECURITY & DEVOPS ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">11 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>Security &amp; delivery</div>
    <h1 class="title">RBAC, branches, deploys</h1>
    <div class="subtitle">9 roles enforced at UI + write layers. Two-branch workflow. Vercel deploys on every push to main.</div>
    <div class="three-col">
      <div class="card">
        <div class="ck">Role Matrix · PMO_Users</div>
        <div class="h">9 roles</div>
        <div class="b">
          <strong>admin · pmo_head</strong> — full access<br>
          <strong>pmo_staff</strong> — validate only<br>
          <strong>pm</strong> — own projects, 5 tabs<br>
          <strong>dept_head</strong> — dept-filtered view<br>
          <strong>executive</strong> — read-only summary<br>
          <strong>grc · grc_admin</strong> — GRC dashboard<br>
          <strong>locked</strong> — full lockout screen
        </div>
      </div>
      <div class="card">
        <div class="ck">Write protection · Step 8</div>
        <div class="h">Client-side field stripping</div>
        <div class="b">
          When <code>pm</code> or <code>dept_head</code> submit an update, the SP MERGE payload strips:<br>
          • PMOValidationNote<br>
          • PMOValidatedBy<br>
          • PMOValidatedDate<br>
          • PMONotes<br>
          • RoadmapDeadline<br>
          So a PM can never overwrite PMO-owned data.
        </div>
      </div>
      <div class="card">
        <div class="ck">Branch policy</div>
        <div class="h">dev → main → prod</div>
        <div class="b">
          <strong>main</strong> = production-only. Vercel auto-deploys on every push.<br>
          <strong>dev</strong> = working branch. Every feature lands here first.<br>
          <strong>Merge to main</strong> only on explicit instruction. Fast-forward only — no merge commits.
        </div>
      </div>
    </div>
    <div class="two-col" style="margin-top: 14px;">
      <div class="warn">
        <strong>Threat model:</strong> A determined PM could still craft a raw SP REST call to overwrite PMO fields — the portal can't prevent that. The real defence is SP item-level permissions, configured separately. Step 8 is defence-in-depth, not the only line.
      </div>
      <div class="info">
        <strong>Env vars:</strong> All public values (Azure Client ID, Tenant ID, SP URLs) are exposed in the bundle via <code>VITE_</code> prefix — that's expected for SPAs. No secrets ever go client-side.
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 12 — CLOSING / ROADMAP ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">12 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>What's next</div>
    <h1 class="title">Roadmap &amp; open questions</h1>
    <div class="subtitle">What's queued, what's intentionally deferred, and where we'd love input from the technical team.</div>
    <div class="two-col">
      <div>
        <div class="card mint">
          <div class="ck">Next 90 days</div>
          <div class="h">Ship + polish</div>
          <div class="b">
            • Phase 3 of the simplification sprint (drop dead SP columns)<br>
            • Mobile responsive polish for PM &amp; field roles<br>
            • Power Automate notifications when a KRI breaches its threshold<br>
            • Power BI export for executive monthly reports<br>
            • Audit log SP list — who changed what when, for 2027 license readiness
          </div>
        </div>
        <div class="card" style="margin-top: 12px;">
          <div class="ck">Deferred — known constraints</div>
          <div class="h">Conscious trade-offs</div>
          <div class="b">
            • No real-time updates (need to refresh). SP doesn't push.<br>
            • No queries across SP lists. Joins happen client-side.<br>
            • GRC dashboard could be extracted to its own app later.<br>
            • IAM migration to internal IAM is on the horizon.
          </div>
        </div>
      </div>
      <div>
        <div class="card dark">
          <div class="ck">Open questions for this team</div>
          <div class="h" style="margin-bottom: 10px;">Help us decide</div>
          <div class="b">
            • Are SP item-level permissions configured tightly enough to make Step 8 a complete defence, or should we add a Logic Apps proxy in front of SP for write operations?<br>
            <br>
            • Should the GRC dashboard graduate to its own app/sub-domain once the SharePoint license model for the GRC team is finalised?<br>
            <br>
            • When IAM migration happens, do we keep MSAL or switch to a generic OIDC client?<br>
            <br>
            • Any concerns about the JSON-in-text-column pattern for sub-collections (risks, milestones, etc.)?
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 13 — HANDOVER GAP ANALYSIS ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">13 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>For technical handover</div>
    <h1 class="title">Production handover — honest gap analysis</h1>
    <div class="subtitle">Functionally the portal works and is already in production. What's missing before a formal handover under the company's name.</div>
    <div class="gap-grid">
      <div class="gap crit">
        <span class="pri">Critical</span>
        <div class="body">
          <div class="t">GitHub repo + Vercel under personal account</div>
          <div class="d">Both currently owned by the developer's account. Must migrate to a company GitHub org and a company Vercel team (or Azure Static Web Apps).</div>
        </div>
      </div>
      <div class="gap crit">
        <span class="pri">Critical</span>
        <div class="body">
          <div class="t">Power Automate flows in personal scope</div>
          <div class="d">If the developer leaves, the flows stop. Must be re-authored under a service account / shared mailbox owned by IT.</div>
        </div>
      </div>
      <div class="gap crit">
        <span class="pri">Critical</span>
        <div class="body">
          <div class="t">Mock mode still in production bundle</div>
          <div class="d"><code>VITE_USE_MOCK=true</code> bypasses MSAL and SP entirely. Acceptable for dev, risky if mis-set in prod. Strip from the prod build.</div>
        </div>
      </div>
      <div class="gap crit">
        <span class="pri">Critical</span>
        <div class="body">
          <div class="t">Zero automated tests</div>
          <div class="d">~5,000 LOC with no unit tests, no integration tests. Every change relies on lint + manual smoke. Regulator-grade IPI logic deserves a test suite.</div>
        </div>
      </div>
      <div class="gap med">
        <span class="pri">Medium</span>
        <div class="body">
          <div class="t">No CI / no staging environment</div>
          <div class="d">Push to main → Vercel auto-deploys to production. No staging URL for the PMO to vet before users see it. No automated rollback.</div>
        </div>
      </div>
      <div class="gap med">
        <span class="pri">Medium</span>
        <div class="body">
          <div class="t">No monitoring or alerting</div>
          <div class="d">If SP returns 500s, MSAL token refresh breaks, or a Vercel deploy fails — nobody knows until users complain. Need uptime checks + Slack/Teams alerts.</div>
        </div>
      </div>
      <div class="gap med">
        <span class="pri">Medium</span>
        <div class="body">
          <div class="t">No aggregate audit log</div>
          <div class="d">SharePoint tracks versions per item, but there is no central "who changed what when" log. Required for 2027 insurance license readiness.</div>
        </div>
      </div>
      <div class="gap med">
        <span class="pri">Medium</span>
        <div class="body">
          <div class="t">Bus factor = 1</div>
          <div class="d">One person knows how it works end-to-end. Admin Guide exists but no developer onboarding doc, no architecture decision records, no runbook for "what to do when X breaks".</div>
        </div>
      </div>
      <div class="gap low">
        <span class="pri">Low</span>
        <div class="body">
          <div class="t">Rapid recent change velocity</div>
          <div class="d">Phase 1, Phase 2, WBS, IPI rewrite all shipped in the past week. The code is fresh — needs 2–3 weeks of actual usage to surface field-edge bugs.</div>
        </div>
      </div>
      <div class="gap low">
        <span class="pri">Low</span>
        <div class="body">
          <div class="t">Dead fields in mock data &amp; lack of DR plan</div>
          <div class="d">Legacy fields (<code>phase</code>, <code>health</code>, <code>spi</code>...) still in mockData. No documented disaster-recovery plan if SP site, Vercel account, or Azure AD app fails.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 14 — HANDOVER PLAN ════════════ -->
<div class="slide">
  <div class="slide-head"><div class="logo">PMO</div><div class="doc">Technical Overview</div><div class="num">14 / 14</div></div>
  <div class="slide-body">
    <div class="tag"><div class="dot"></div>Recommended path</div>
    <h1 class="title">The 2-3 week handover plan</h1>
    <div class="subtitle">Concrete tasks, owners, effort. Close the criticals first, then ship the medium-priority items, then sign off.</div>
    <table class="plan">
      <thead>
        <tr><th style="width:11%">Priority</th><th>Task</th><th style="width:18%">Owner / Skill</th><th style="width:10%">Effort</th></tr>
      </thead>
      <tbody>
        <tr><td><span class="p-chip crit">Critical</span></td><td class="task">Transfer GitHub repository to a company-owned org</td><td>IT + Developer</td><td class="eff">1 day</td></tr>
        <tr><td><span class="p-chip crit">Critical</span></td><td class="task">Move Vercel hosting to company Vercel team (or migrate to Azure Static Web Apps)</td><td>IT + DevOps</td><td class="eff">1 day</td></tr>
        <tr><td><span class="p-chip crit">Critical</span></td><td class="task">Re-author Power Automate flows under a service account; rotate triggers</td><td>M365 admin</td><td class="eff">2 days</td></tr>
        <tr><td><span class="p-chip crit">Critical</span></td><td class="task">Strip mock mode from production bundle (compile-time guard)</td><td>Developer</td><td class="eff">1 day</td></tr>
        <tr><td><span class="p-chip med">Medium</span></td><td class="task">Add unit tests around IPI engine (~20 tests covering the reference scenarios)</td><td>Developer</td><td class="eff">3 days</td></tr>
        <tr><td><span class="p-chip med">Medium</span></td><td class="task">Create an "AuditLog" SP list and write to it on every save (project, KRI, reading)</td><td>Developer</td><td class="eff">3 days</td></tr>
        <tr><td><span class="p-chip med">Medium</span></td><td class="task">Wire Vercel preview branches as a staging environment for PMO sign-off</td><td>DevOps</td><td class="eff">1 day</td></tr>
        <tr><td><span class="p-chip med">Medium</span></td><td class="task">Uptime monitoring (UptimeRobot or similar) + deploy alerts to Teams</td><td>DevOps</td><td class="eff">0.5 day</td></tr>
        <tr><td><span class="p-chip low">Low</span></td><td class="task">Developer onboarding doc + architecture decision records (ADRs)</td><td>Developer</td><td class="eff">2 days</td></tr>
        <tr><td><span class="p-chip low">Low</span></td><td class="task">Clean dead fields from mockData (cosmetic)</td><td>Developer</td><td class="eff">0.5 day</td></tr>
        <tr><td><span class="p-chip low">Low</span></td><td class="task">Disaster recovery runbook (how to restore SP, redeploy, rebuild AAD app)</td><td>IT + Developer</td><td class="eff">1 day</td></tr>
      </tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right;">Total effort:</td><td style="font-family: 'JetBrains Mono', monospace;">~15–18 days</td></tr>
      </tfoot>
    </table>
    <div class="two-col" style="margin-top: 14px; gap: 12px;">
      <div class="info">
        <strong>Recommended path:</strong> Knock out the 4 Critical items first (~5 days). Then ship the 4 Medium items in parallel over the following 2 weeks. Sign formal handover after that.
      </div>
      <div class="warn">
        <strong>Alternative:</strong> Hand over today as <em>"Phase 1 — operational with documented gaps"</em> and treat the table above as a backlog. The receiving team accepts the trade-offs in writing.
      </div>
    </div>
  </div>
  <div class="slide-foot"></div>
</div>

<!-- ════════════ SLIDE 15 — THANK YOU ════════════ -->
<div class="slide closing">
  <div class="slide-body">
    <h1>Thank you.</h1>
    <div class="sub">PMO Portal — built to make project governance painless, transparent, and audit-ready.</div>
    <div class="links">
      <div class="link">github.com/Moh-Salman11109/pmo-portal</div>
      <div class="link">pmo-portal-seven.vercel.app</div>
      <div class="link">Documentation in /scripts &amp; /memory</div>
    </div>
  </div>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'PMO-Portal-Tech-Overview.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath);
console.log('Size:', html.length, 'bytes');
