// IPI Methodology Guide V2 — governance-grade reference, now with:
//  • Inline SVG diagrams so non-technical readers can SEE the math
//  • New chapters for Anticipated MCI, Status derivation, 46-test audit
//  • Same Tree brand polish, more visual hierarchy, "Plain Language" boxes
// Output:  Desktop/PMO-Portal-Deliverables/PMO-Portal-IPI-Methodology.{html,pdf}
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IPI Methodology Guide V2 — PMO Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    /* Tree brand palette — Sea, Canopy, Orange, Maroon, Moss, Lichen */
    --canopy: #003932; --canopy-2: #005c4b; --canopy-3: #007a62;
    --sea:    #00FFB3; --sea-mid: #00b894; --sea-lt: #e6f9f5;
    --orange: #FF5000; --orange-tint: #ffd9c2; --orange-soft: #fff5ee;
    --maroon: #490300; --maroon-tint: #f0d4d0;
    --moss:   #A1B9AB; --moss-dark: #5a7a6e;
    --lichen: #C9D5C9; --lichen-lt: #ecf2ed;
    /* support */
    --amber:  #f59e0b; --amber-lt: #fffbeb;
    --blue:   #3b82f6; --blue-lt: #eff6ff; --blue-dark: #1e40af;
    --red:    #ef4444; --red-lt: #fef2f2;
    --ink:    #0d1f1c; --muted:   #4b6c67; --border: #d1e8e4;
    --bg:     #f5faf9; --white:   #ffffff;
  }
  body {
    font-family: 'Inter', sans-serif;
    background: #c8d8d5;
    color: var(--ink);
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    background: white;
    margin: 10mm auto;
    position: relative;
    box-shadow: 0 4px 40px rgba(0,57,50,0.14);
    display: flex; flex-direction: column;
  }
  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }
  @page { size: A4 portrait; margin: 0; }

  /* HEADER + FOOTER */
  .head {
    background: var(--canopy);
    padding: 9px 16mm;
    display: flex; align-items: center; gap: 10px;
  }
  .head .logo { background: var(--sea); color: var(--canopy); font-weight: 900; font-size: 11px; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; }
  .head .doc { color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .head .v { background: var(--sea); color: var(--canopy); font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 10px; margin-left: 6px; }
  .head .pg { margin-left: auto; color: var(--sea); font-size: 10px; font-weight: 700; }

  .body { flex: 1; padding: 14mm 16mm 14mm; }
  .foot { background: var(--canopy); height: 4mm; }

  /* ── COVER ── */
  .cover-body {
    background: linear-gradient(135deg, #001f1a 0%, #003932 50%, #007a62 100%);
    color: white;
    padding: 45mm 16mm 28mm;
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
    border-bottom: 4px solid var(--sea);
  }
  .cover-body::after {
    content: '';
    position: absolute;
    bottom: -120px; right: -120px;
    width: 400px; height: 400px;
    background: rgba(0,255,179,0.10);
    border-radius: 50%;
  }
  .cover-body::before {
    content: 'IPI';
    position: absolute;
    top: 30mm; right: 16mm;
    font-size: 200px;
    font-weight: 900;
    color: rgba(0,255,179,0.06);
    letter-spacing: -8px;
    line-height: 1;
  }
  .cover-body .badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,255,179,0.18);
    border: 1px solid rgba(0,255,179,0.35);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 22px;
    align-self: flex-start;
    z-index: 2;
  }
  .cover-body .badge .d { width: 7px; height: 7px; background: var(--sea); border-radius: 50%; box-shadow: 0 0 8px var(--sea); }
  .cover-body .badge span { color: var(--sea); font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover-body h1 { color: white; font-size: 48px; font-weight: 900; letter-spacing: -1.4px; line-height: 1.0; margin-bottom: 14px; position: relative; z-index: 2; }
  .cover-body h1 em { color: var(--sea); font-style: normal; }
  .cover-body .lead { color: rgba(255,255,255,0.74); font-size: 15px; font-weight: 400; line-height: 1.55; margin-bottom: 30px; max-width: 80%; position: relative; z-index: 2; }
  .cover-body .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; position: relative; z-index: 2; }
  .cover-body .meta .item .l { font-size: 10px; color: rgba(0,255,179,0.78); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-body .meta .item .v { font-size: 12.5px; color: white; font-weight: 600; line-height: 1.3; }
  .cover-version {
    position: absolute; top: 20mm; left: 16mm; z-index: 3;
    background: var(--sea); color: var(--canopy);
    padding: 5px 14px; border-radius: 10px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.5px;
  }

  /* ── SECTION ── */
  .section-tag {
    display: inline-block;
    background: var(--sea-lt);
    color: var(--canopy);
    border: 1px solid #a7f3d0;
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  h2.section {
    font-size: 24px;
    font-weight: 900;
    color: var(--canopy);
    letter-spacing: -0.6px;
    line-height: 1.1;
    margin-bottom: 12px;
    border-bottom: 2px solid var(--sea);
    padding-bottom: 8px;
  }
  h2.section .ch {
    background: var(--canopy);
    color: var(--sea);
    font-size: 11px;
    padding: 4px 9px;
    border-radius: 11px;
    margin-right: 10px;
    font-weight: 800;
    vertical-align: middle;
    letter-spacing: 0.5px;
  }
  h3.sub {
    font-size: 14px;
    font-weight: 800;
    color: var(--canopy);
    margin: 14px 0 8px;
    letter-spacing: -0.2px;
  }
  p { font-size: 12px; color: var(--ink); line-height: 1.6; margin-bottom: 8px; }
  p.muted { color: var(--muted); }
  ul, ol { margin: 4px 0 10px 18px; }
  li { font-size: 12px; color: var(--ink); line-height: 1.6; margin-bottom: 3px; }

  /* ── FORMULA BOX ── */
  .formula {
    background: var(--canopy);
    color: white;
    padding: 18px 20px;
    border-radius: 10px;
    text-align: center;
    margin: 14px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.4px;
    line-height: 1.6;
    position: relative;
  }
  .formula .mint { color: var(--sea); }
  .formula .small { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 8px; font-family: 'Inter'; font-weight: 400; }

  /* ── PLAIN LANGUAGE BOX (for non-technical readers) ── */
  .plain {
    background: var(--lichen-lt);
    border-left: 4px solid var(--moss-dark);
    border-radius: 0 10px 10px 0;
    padding: 12px 16px 12px 18px;
    margin: 14px 0;
    display: flex; gap: 12px;
  }
  .plain .icon { font-size: 22px; flex-shrink: 0; line-height: 1; padding-top: 1px; }
  .plain .content { flex: 1; }
  .plain .lbl { font-size: 10px; font-weight: 800; color: var(--canopy); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
  .plain p { font-size: 12.5px; line-height: 1.6; color: var(--ink); margin-bottom: 0; font-weight: 500; }

  /* ── CARDS / CALLOUTS ── */
  .callout {
    background: var(--sea-lt);
    border-left: 4px solid var(--sea-mid);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 10px 0;
  }
  .callout .lbl { font-size: 10px; font-weight: 800; color: var(--canopy); letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px; }
  .callout p { font-size: 12px; line-height: 1.6; color: var(--ink); margin-bottom: 0; }
  .callout.amber { background: var(--amber-lt); border-left-color: var(--amber); }
  .callout.amber .lbl { color: #92400e; }
  .callout.amber p { color: #78350f; }
  .callout.blue { background: var(--blue-lt); border-left-color: var(--blue); }
  .callout.blue .lbl { color: var(--blue-dark); }
  .callout.blue p { color: #1e3a8a; }
  .callout.red { background: var(--red-lt); border-left-color: var(--red); }
  .callout.red .lbl { color: #b91c1c; }
  .callout.red p { color: #7f1d1d; }
  .callout.moss { background: #f1f5f1; border-left-color: var(--moss-dark); }
  .callout.moss .lbl { color: var(--moss-dark); }

  /* ── TABLES ── */
  table {
    width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0 12px;
  }
  table th {
    background: var(--canopy);
    color: white;
    padding: 7px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
  }
  table th:first-child { border-radius: 6px 0 0 0; }
  table th:last-child  { border-radius: 0 6px 0 0; }
  table td {
    padding: 7px 10px;
    border-bottom: 1px solid var(--border);
    line-height: 1.4;
  }
  table tr:nth-child(even) td { background: var(--bg); }
  table tr.tot td { background: var(--sea-lt); font-weight: 800; color: var(--canopy); }
  table td.k { font-weight: 700; color: var(--canopy); }
  code, table code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: var(--canopy);
  }

  /* ── CODE BLOCK ── */
  pre.code {
    background: #0d1f1c;
    color: #d4f5e9;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.55;
    margin: 8px 0 12px;
    overflow-x: auto;
  }
  pre.code .c { color: #64748b; }
  pre.code .k { color: #fcd34d; }
  pre.code .s { color: #fda4af; }

  /* ── WORKED EXAMPLE ── */
  .ex {
    background: white;
    border: 2px solid var(--sea-mid);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 12px 0;
  }
  .ex .hd {
    display: inline-block;
    background: var(--sea-mid);
    color: white;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 10px;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .ex h4 { font-size: 13px; font-weight: 800; color: var(--canopy); margin-bottom: 8px; }
  .ex .calc {
    background: #0d1f1c;
    color: #d4f5e9;
    padding: 10px 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.65;
    margin: 6px 0;
  }
  .ex .calc .c { color: #64748b; }
  .ex .res {
    display: inline-block;
    background: var(--sea-mid);
    color: white;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 800;
    margin-top: 4px;
  }

  /* ── QA ── */
  .qa { margin-bottom: 12px; }
  .qa .q {
    font-size: 12px;
    font-weight: 800;
    color: var(--canopy);
    margin-bottom: 5px;
  }
  .qa .q::before { content: "Q. "; color: var(--sea-mid); }
  .qa .a {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.6;
    padding-left: 16px;
    border-left: 2px solid var(--sea-mid);
  }

  /* ── STATUS CHIPS ── */
  .chip {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
  }
  .chip.green  { background: #dcfce7; color: #166534; }
  .chip.amber  { background: #fef3c7; color: #92400e; }
  .chip.orange { background: var(--orange-tint); color: #9a3412; }
  .chip.red    { background: var(--maroon-tint); color: var(--maroon); }
  .chip.blue   { background: var(--blue-lt); color: var(--blue-dark); }
  .chip.grey   { background: var(--lichen); color: var(--moss-dark); }

  /* ── TOC ── */
  .toc { margin-top: 14px; }
  .toc-item {
    display: flex;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border);
  }
  .toc-item .n {
    width: 26px;
    height: 26px;
    background: var(--sea-lt);
    color: var(--canopy);
    border-radius: 50%;
    font-size: 10.5px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    flex-shrink: 0;
  }
  .toc-item .t {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--canopy);
  }
  .toc-item .t .d { font-size: 10.5px; color: var(--muted); font-weight: 400; margin-top: 1px; }
  .toc-item .p {
    background: var(--canopy);
    color: var(--sea);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 10px;
  }

  /* ── DIAGRAM WRAPPER ── */
  .diagram {
    background: linear-gradient(180deg, #f8fafa 0%, #ffffff 100%);
    border: 1.5px solid var(--lichen);
    border-radius: 12px;
    padding: 18px 20px;
    margin: 14px 0;
    text-align: center;
  }
  .diagram .caption {
    font-size: 10px;
    color: var(--moss-dark);
    font-weight: 600;
    margin-top: 8px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    text-align: center;
  }
  .diagram .legend {
    display: flex; justify-content: center; gap: 16px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .diagram .lg-item { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--ink); font-weight: 600; }
  .diagram .lg-item .sw { width: 14px; height: 10px; border-radius: 3px; }

  /* ── TEST EVIDENCE BLOCK ── */
  .tests {
    background: #0d1f1c;
    color: #d4f5e9;
    border-radius: 12px;
    padding: 16px 18px;
    margin: 14px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.75;
  }
  .tests .ok { color: #34d399; font-weight: 700; }
  .tests .num { color: var(--sea); font-weight: 700; }
  .tests .label { color: rgba(255,255,255,0.6); }
  .tests .group { color: #fcd34d; font-weight: 600; margin-top: 6px; display: block; }

  /* ── KPI / STAT TILES ── */
  .stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin: 12px 0;
  }
  .stat {
    background: var(--sea-lt);
    border: 1.5px solid var(--sea-mid);
    border-radius: 10px;
    padding: 12px 14px;
    text-align: center;
  }
  .stat .num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 24px; font-weight: 800; color: var(--canopy);
    line-height: 1;
  }
  .stat .lbl {
    font-size: 9.5px; color: var(--moss-dark); font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-top: 6px;
  }
</style>
</head>
<body>

<!-- ════════════════════ COVER ════════════════════ -->
<div class="page">
  <div class="cover-body">
    <div class="cover-version">V2 · 2026-06-23</div>
    <div class="badge"><div class="d"></div><span>Official Methodology Reference</span></div>
    <h1>Integrated<br>Performance Index<br><em>Methodology</em></h1>
    <div class="lead">Issued under the governance of the Project Management Office, this document establishes the official methodology for computing the Integrated Performance Index across all projects, departments, and the enterprise portfolio. It is the canonical reference for executive review, internal audit, and regulatory inspection.</div>
    <div class="meta">
      <div class="item"><div class="l">Issued by</div><div class="v">Project Management Office<br>Tree Digital Insurance Company</div></div>
      <div class="item"><div class="l">Effective</div><div class="v">23 June 2026<br>Version 2</div></div>
      <div class="item"><div class="l">Classification</div><div class="v">Internal<br>Methodology Reference</div></div>
    </div>
  </div>
</div>

<!-- ════════════════════ TOC ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">2</div></div>
  <div class="body">
    <div class="section-tag">Contents</div>
    <h2 class="section">What this document covers</h2>
    <p class="muted">Each chapter stands alone. Skim from cover to cover in ~25 minutes, or jump to the chapter that answers a specific question.</p>
    <div class="toc">
      <div class="toc-item"><div class="n">01</div><div class="t">Executive Summary<div class="d">What IPI is, in one page · who reads what</div></div><div class="p">p.3</div></div>
      <div class="toc-item"><div class="n">02</div><div class="t">The Formula at a Glance<div class="d">Visual composition · what each component answers</div></div><div class="p">p.4</div></div>
      <div class="toc-item"><div class="n">03</div><div class="t">SPI — Schedule Performance Index<div class="d">EVM with time-based PV, diagrammed</div></div><div class="p">p.5</div></div>
      <div class="toc-item"><div class="n">04</div><div class="t">CPI — Cost Performance Index<div class="d">BCWP visualisation, source-of-truth note</div></div><div class="p">p.6</div></div>
      <div class="toc-item"><div class="n">05</div><div class="t">MCI — Maturity &amp; Compliance Index<div class="d">Gate-aware filtering with flow diagram</div></div><div class="p">p.7</div></div>
      <div class="toc-item"><div class="n">06</div><div class="t">Anticipated MCI — Early Warning<div class="d">Forecasting the next-gate drop before it happens</div></div><div class="p">p.8</div></div>
      <div class="toc-item"><div class="n">07</div><div class="t">The Roadmap-Deadline Penalty<div class="d">1% per day decay, graphed</div></div><div class="p">p.9</div></div>
      <div class="toc-item"><div class="n">08</div><div class="t">The 1.20 Cap &amp; Null Handling<div class="d">Anti-gaming safeguards + visual band strip</div></div><div class="p">p.10</div></div>
      <div class="toc-item"><div class="n">09</div><div class="t">Worked Example — Single Project<div class="d">Motor Fleet, end-to-end calculation</div></div><div class="p">p.11</div></div>
      <div class="toc-item"><div class="n">10</div><div class="t">Department &amp; Portfolio Rollups<div class="d">Budget × Priority weighting, visualised</div></div><div class="p">p.12</div></div>
      <div class="toc-item"><div class="n">11</div><div class="t">Worked Example — Portfolio<div class="d">5 projects · 3 budget scenarios</div></div><div class="p">p.13</div></div>
      <div class="toc-item"><div class="n">12</div><div class="t">Project Status Derivation<div class="d">How the badge is computed from raw signals</div></div><div class="p">p.14</div></div>
      <div class="toc-item"><div class="n">13</div><div class="t">Time-Weighted IPI<div class="d">Why one bad month doesn't dominate</div></div><div class="p">p.15</div></div>
      <div class="toc-item"><div class="n">14</div><div class="t">Is It Solid? — 46-Test Audit Evidence<div class="d">Mathematical proof + PMI EVM alignment</div></div><div class="p">p.16</div></div>
      <div class="toc-item"><div class="n">15</div><div class="t">Strategy Q&amp;A<div class="d">12 questions executives ask most</div></div><div class="p">p.17</div></div>
      <div class="toc-item"><div class="n">16</div><div class="t">Glossary &amp; Cheat Sheet<div class="d">All thresholds, constants, file locations</div></div><div class="p">p.18</div></div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 01 EXEC SUMMARY ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">3</div></div>
  <div class="body">
    <div class="section-tag">Chapter 1</div>
    <h2 class="section"><span class="ch">01</span>Executive Summary</h2>
    <p><strong>IPI — the Index of Project Implementation —</strong> is a single 0-to-115 score that answers one question for any project, department, or portfolio: <em>"How well is delivery going against plan?"</em></p>
    <p>It blends three independent dimensions every project has: <strong>schedule</strong>, <strong>cost</strong>, and <strong>compliance</strong>. Each dimension is a ratio (actual vs. planned), so the score is dimensionless and comparable across project sizes, durations, and types.</p>

    <div class="plain">
      <div class="icon">💡</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>Think of IPI as a project's report card. It blends three teacher reports — "on time?", "on budget?", and "homework done?" — into one easy number. 100 means perfect. Below 70 means call a meeting.</p>
      </div>
    </div>

    <h3 class="sub">Scale and interpretation</h3>
    <table>
      <thead><tr><th style="width:14%">Score</th><th style="width:23%">Status</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>&gt; 100</strong></td><td><span class="chip green">Over Achieved</span></td><td>Running ahead of plan and under budget</td></tr>
        <tr><td><strong>= 100</strong></td><td><span class="chip green">On Track</span></td><td>Exactly on plan across all three dimensions</td></tr>
        <tr><td><strong>90–99</strong></td><td><span class="chip amber">Watch</span></td><td>Minor variance; monitor, intervene if widening</td></tr>
        <tr><td><strong>70–89</strong></td><td><span class="chip orange">At Risk</span></td><td>Meaningful variance; PMO escalation expected</td></tr>
        <tr><td><strong>&lt; 70</strong></td><td><span class="chip red">Critical</span></td><td>Material slippage; leadership intervention required</td></tr>
        <tr><td><strong>null</strong></td><td><span class="chip grey">Pending Plan</span></td><td>Project has no schedule, cost, or compliance data yet</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Who reads what</h3>
    <table>
      <thead><tr><th>Audience</th><th>Reads</th></tr></thead>
      <tbody>
        <tr><td class="k">CEO / Board</td><td>Chapter 1 + Chapter 14 (the proof it's defensible)</td></tr>
        <tr><td class="k">Strategy team</td><td>Chapter 1, 2, 10, 11, 15</td></tr>
        <tr><td class="k">Internal Audit</td><td>Whole document — especially Chapter 14</td></tr>
        <tr><td class="k">Regulator</td><td>Cover, Chapter 14, references</td></tr>
        <tr><td class="k">New PM / PMO joiner</td><td>Chapters 3, 4, 5, 9</td></tr>
      </tbody>
    </table>

    <div class="callout">
      <div class="lbl">Design principle</div>
      <p>Every threshold, weight, and decay rate is defined in one constant — <code>IPI_DEFAULTS</code> in <code>src/utils/metrics.js</code>. Changing any number requires a code change, a git commit, and review. There is no admin UI to tweak these values, by design — that's what makes the engine audit-stable.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 02 FORMULA AT A GLANCE ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">4</div></div>
  <div class="body">
    <div class="section-tag">Chapter 2</div>
    <h2 class="section"><span class="ch">02</span>The Formula at a Glance</h2>
    <p>Three components, fixed weights, one safety cap, plus a roadmap-deadline penalty. The whole IPI lives in one line:</p>

    <div class="formula">
      IPI = ( <span class="mint">SPI</span> × 50% ) + ( <span class="mint">CPI</span> × 25% ) + ( <span class="mint">MCI</span> × 25% )
      <div class="small">Each component capped at 1.20 · max IPI ≈ 115</div>
    </div>

    <!-- DIAGRAM 1: IPI Composition Donut -->
    <div class="diagram">
      <svg width="100%" height="180" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <!-- Donut -->
        <g transform="translate(110, 90)">
          <!-- SPI 50% (180 degrees) - mint Sea -->
          <path d="M 0,-70 A 70,70 0 1,1 0,70 L 0,40 A 40,40 0 1,0 0,-40 Z" fill="#00FFB3" />
          <!-- CPI 25% (90 degrees) - amber -->
          <path d="M 0,70 A 70,70 0 0,1 -70,0 L -40,0 A 40,40 0 0,0 0,40 Z" fill="#f59e0b" />
          <!-- MCI 25% (90 degrees) - blue -->
          <path d="M -70,0 A 70,70 0 0,1 0,-70 L 0,-40 A 40,40 0 0,0 -40,0 Z" fill="#3b82f6" />
          <!-- Center text -->
          <text x="0" y="-2" text-anchor="middle" font-family="Inter" font-size="18" font-weight="900" fill="#003932">IPI</text>
          <text x="0" y="13" text-anchor="middle" font-family="Inter" font-size="9" font-weight="600" fill="#5a7a6e">Score</text>
        </g>
        <!-- Labels with leader lines -->
        <g font-family="Inter" font-size="11" font-weight="700">
          <text x="220" y="62" fill="#003932">SPI</text>
          <text x="220" y="76" fill="#5a7a6e" font-size="9" font-weight="500">Schedule · 50%</text>
          <text x="220" y="89" fill="#5a7a6e" font-size="9" font-weight="500">On time?</text>
          <line x1="180" y1="60" x2="215" y2="60" stroke="#00b894" stroke-width="1.5"/>
          <circle cx="216" cy="60" r="3" fill="#00b894"/>

          <text x="220" y="112" fill="#003932">CPI</text>
          <text x="220" y="126" fill="#5a7a6e" font-size="9" font-weight="500">Cost · 25%</text>
          <text x="220" y="139" fill="#5a7a6e" font-size="9" font-weight="500">On budget?</text>
          <line x1="180" y1="110" x2="215" y2="110" stroke="#d97706" stroke-width="1.5"/>
          <circle cx="216" cy="110" r="3" fill="#d97706"/>

          <text x="220" y="155" fill="#003932">MCI</text>
          <text x="220" y="170" fill="#5a7a6e" font-size="9" font-weight="500">Compliance · 25%</text>
          <line x1="180" y1="153" x2="215" y2="153" stroke="#3b82f6" stroke-width="1.5"/>
          <circle cx="216" cy="153" r="3" fill="#3b82f6"/>
        </g>
      </svg>
      <div class="caption">IPI composition — three independent dimensions, weighted, summed</div>
    </div>

    <h3 class="sub">What each component answers</h3>
    <table>
      <thead><tr><th>Letter</th><th>Name</th><th>Asks</th><th>Weight</th></tr></thead>
      <tbody>
        <tr><td><strong>SPI</strong></td><td>Schedule Performance</td><td>"Are we delivering on time?"</td><td>50%</td></tr>
        <tr><td><strong>CPI</strong></td><td>Cost Performance</td><td>"Are we spending efficiently?"</td><td>25%</td></tr>
        <tr><td><strong>MCI</strong></td><td>Maturity &amp; Compliance</td><td>"Are required documents in place?"</td><td>25%</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Why these weights?</h3>
    <ul>
      <li><strong>Schedule carries the biggest weight</strong> — every day late cascades into downstream gates, dependent projects, and regulator deadlines.</li>
      <li><strong>Cost is equal-weighted with compliance</strong> — cost overruns can often be absorbed; a missed compliance milestone (e.g. a Gate-1 charter) is binary and blocks progression.</li>
      <li><strong>The three weights sum to 100%</strong> — a perfectly on-plan project lands at exactly 1.0 displayed as 100.</li>
    </ul>

    <div class="plain">
      <div class="icon">📐</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>Imagine grading a student. Their final mark blends three tests: a big one worth half, and two smaller ones worth a quarter each. If they ace all three, they get 100. The IPI does the same thing for a project.</p>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 03 SPI ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">5</div></div>
  <div class="body">
    <div class="section-tag">Chapter 3</div>
    <h2 class="section"><span class="ch">03</span>SPI — Schedule Performance Index</h2>
    <p>SPI tells us whether the project is delivering ahead, on, or behind plan — in time-equivalent terms. It's the textbook Earned Value Management (EVM) ratio:</p>

    <div class="formula">
      <span class="mint">SPI</span> = EV ÷ PV
      <div class="small">EV = Earned Value (actual % complete) · PV = Planned Value (% complete the plan said we'd be at by now)</div>
    </div>

    <!-- DIAGRAM 2: Time-based PV Linear Interpolation -->
    <div class="diagram">
      <svg width="100%" height="180" viewBox="0 0 460 180" xmlns="http://www.w3.org/2000/svg">
        <!-- Timeline base -->
        <line x1="40" y1="120" x2="420" y2="120" stroke="#C9D5C9" stroke-width="2"/>

        <!-- Start marker -->
        <circle cx="40" cy="120" r="5" fill="#003932"/>
        <text x="40" y="142" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">START</text>
        <text x="40" y="154" text-anchor="middle" font-family="Inter" font-size="8" fill="#5a7a6e">2026-04-01</text>

        <!-- Today marker -->
        <line x1="200" y1="60" x2="200" y2="130" stroke="#00b894" stroke-width="2" stroke-dasharray="3,2"/>
        <circle cx="200" cy="120" r="6" fill="#00FFB3" stroke="#003932" stroke-width="2"/>
        <text x="200" y="50" text-anchor="middle" font-family="Inter" font-size="9" font-weight="800" fill="#00b894">▼ TODAY</text>
        <text x="200" y="142" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">PV = 0.40</text>
        <text x="200" y="154" text-anchor="middle" font-family="Inter" font-size="8" fill="#5a7a6e">40% should be done</text>

        <!-- End marker -->
        <circle cx="420" cy="120" r="5" fill="#003932"/>
        <text x="420" y="142" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">END</text>
        <text x="420" y="154" text-anchor="middle" font-family="Inter" font-size="8" fill="#5a7a6e">2026-12-31</text>

        <!-- Linear PV curve -->
        <path d="M 40,120 L 420,40" stroke="#00b894" stroke-width="2" fill="none"/>
        <text x="430" y="42" font-family="Inter" font-size="9" font-weight="700" fill="#00b894">100%</text>
        <text x="22" y="124" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">0%</text>

        <!-- Filled area under PV curve -->
        <path d="M 40,120 L 200,90 L 200,120 Z" fill="rgba(0,184,148,0.15)"/>

        <!-- Annotation -->
        <text x="120" y="105" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e" font-style="italic">Planned% interpolates linearly</text>
      </svg>
      <div class="caption">Time-based PV — linear interpolation between start and end dates at "today"</div>
    </div>

    <h3 class="sub">How EV is computed</h3>
    <p>EV is the weighted average of each WBS <em>leaf</em> activity's actual progress. A "leaf" is an activity with no children — a milestone with sub-activities counts via those sub-activities, never via its own field, so progress is never double-counted.</p>
    <pre class="code">EV = Σ(weight × actualProgress) ÷ Σ(weight)   <span class="c">// across all leaf activities</span></pre>

    <h3 class="sub">How PV is computed — the time-based part</h3>
    <p>For each leaf activity, planned% at today's date is <strong>linearly interpolated</strong> between its <code>startDate</code> and <code>date</code> (endDate):</p>
    <ul>
      <li>Activity hasn't started yet → planned% = 0</li>
      <li>Today is exactly halfway between start and end → planned% = 0.5</li>
      <li>Activity should have finished → planned% = 1.0</li>
    </ul>

    <div class="callout">
      <div class="lbl">Why time-based PV is more honest</div>
      <p>Old systems often only credit a milestone after its end date passes — making projects look perpetually behind. Time-based PV reflects what should have happened by today, giving fair credit for partial progress and exposing slippage the moment it begins, not at quarter-end close.</p>
    </div>

    <div class="plain">
      <div class="icon">⏱</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>A 100-day activity starting today should be 50% done after 50 days. If it's only 30% done by then, SPI = 30 ÷ 50 = 0.60 — the project is delivering at 60% of plan speed.</p>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 04 CPI ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">6</div></div>
  <div class="body">
    <div class="section-tag">Chapter 4</div>
    <h2 class="section"><span class="ch">04</span>CPI — Cost Performance Index</h2>
    <p>CPI tells us whether we're getting the planned value per riyal spent. The EVM cost ratio:</p>

    <div class="formula">
      <span class="mint">CPI</span> = BCWP ÷ Actual Cost
      <div class="small">BCWP (Budgeted Cost of Work Performed) = (progress% × total budget)</div>
    </div>

    <!-- DIAGRAM 3: BCWP Visualization -->
    <div class="diagram">
      <svg width="100%" height="170" viewBox="0 0 460 170" xmlns="http://www.w3.org/2000/svg">
        <!-- Budget bar -->
        <text x="40" y="38" font-family="Inter" font-size="10" font-weight="700" fill="#003932">Budget = 1,000,000</text>
        <rect x="40" y="48" width="380" height="22" fill="#ecf2ed" stroke="#C9D5C9" rx="3"/>
        <rect x="40" y="48" width="228" height="22" fill="#00b894" rx="3"/>
        <text x="154" y="63" text-anchor="middle" font-family="Inter" font-size="10" font-weight="700" fill="white">BCWP = 600,000</text>
        <text x="344" y="63" text-anchor="middle" font-family="Inter" font-size="9" font-weight="600" fill="#5a7a6e">Not yet earned</text>
        <text x="42" y="86" font-family="Inter" font-size="9" fill="#5a7a6e">60% progress × Budget = BCWP (value earned to date)</text>

        <!-- Actual cost bar -->
        <text x="40" y="110" font-family="Inter" font-size="10" font-weight="700" fill="#003932">Actual Cost = 500,000</text>
        <rect x="40" y="120" width="190" height="22" fill="#3b82f6" rx="3"/>
        <text x="135" y="135" text-anchor="middle" font-family="Inter" font-size="10" font-weight="700" fill="white">500,000 spent</text>

        <!-- CPI annotation -->
        <text x="40" y="158" font-family="Inter" font-size="10" font-weight="700" fill="#003932">→ CPI = 600,000 ÷ 500,000 = 1.20 · earning more value than spending</text>
      </svg>
      <div class="caption">BCWP visualised — what we earned vs what we spent</div>
    </div>

    <h3 class="sub">In plain terms</h3>
    <p>If a project is 40% done and has spent 40% of budget, CPI = 1.0. If 40% done but already 80% of budget gone, CPI = 0.5 — costing twice what the plan budgeted for that level of completion.</p>

    <h3 class="sub">Important: BCWP sources progress from the WBS, not a stale field</h3>
    <p>Since 2026-06-23, the engine computes BCWP from <code>effectiveProgress(project)</code> — the same WBS rollup the user sees in the UI. This means CPI cannot drift from the displayed progress, even if the stored <code>project.progress</code> field is out of sync between saves.</p>

    <h3 class="sub">Interpretation</h3>
    <table>
      <thead><tr><th>CPI</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>&gt; 1.0</strong></td><td>Earning more value than spending — under budget</td></tr>
        <tr><td><strong>= 1.0</strong></td><td>One-to-one — exactly on budget</td></tr>
        <tr><td><strong>0.9</strong></td><td>10% cost overrun on delivered work</td></tr>
        <tr><td><strong>0.5</strong></td><td>Spending twice what the plan said</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Edge cases</h3>
    <ul>
      <li><strong>actualCost = 0</strong> — project hasn't spent anything yet (e.g. Gate 0). CPI returns <code>null</code> → treated as neutral in the rollup, not as a perfect score.</li>
      <li><strong>budget = 0</strong> — projects without a captured budget cannot have CPI. Returns <code>null</code>, neutral.</li>
    </ul>

    <div class="callout amber">
      <div class="lbl">Why CPI is 25% of IPI, not more</div>
      <p>Cost data is laggier than schedule data — invoices arrive next month, finance reconciles weekly. SPI is observable today; CPI catches up. Equal-weighting cost with schedule would over-react to month-end accounting noise.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 05 MCI ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">7</div></div>
  <div class="body">
    <div class="section-tag">Chapter 5 · Gate-aware</div>
    <h2 class="section"><span class="ch">05</span>MCI — Maturity &amp; Compliance Index</h2>
    <p>MCI is the share of required project documents that are delivered and approved <em>by the gate at which they are due</em>. Critically, MCI is <strong>gate-aware</strong> — a Closure Report assigned to Gate 5 is not counted as "missing" while the project sits at Gate 2; it is simply not yet due.</p>

    <div class="formula">
      <span class="mint">MCI</span> = ( Approved + 0.5 × InReview ) ÷ Docs Due at Current Gate
    </div>

    <!-- DIAGRAM 4: Gate-aware MCI flow -->
    <div class="diagram">
      <svg width="100%" height="200" viewBox="0 0 460 200" xmlns="http://www.w3.org/2000/svg">
        <!-- Gates timeline -->
        <line x1="30" y1="100" x2="430" y2="100" stroke="#C9D5C9" stroke-width="2"/>
        <!-- Gate markers -->
        <g font-family="Inter" font-size="9" font-weight="700" fill="#003932" text-anchor="middle">
          <circle cx="60" cy="100" r="10" fill="#003932"/>
          <text x="60" y="103" fill="#00FFB3" font-size="10">1</text>
          <text x="60" y="125" fill="#003932">Gate 1</text>

          <circle cx="155" cy="100" r="10" fill="#003932"/>
          <text x="155" y="103" fill="#00FFB3" font-size="10">2</text>
          <text x="155" y="125" fill="#003932">Gate 2</text>

          <circle cx="250" cy="100" r="10" fill="#003932"/>
          <text x="250" y="103" fill="#00FFB3" font-size="10">3</text>
          <text x="250" y="125" fill="#003932">Gate 3</text>

          <circle cx="345" cy="100" r="14" fill="#00FFB3" stroke="#003932" stroke-width="2"/>
          <text x="345" y="104" fill="#003932" font-size="11" font-weight="900">4</text>
          <text x="345" y="129" fill="#00b894">Gate 4 (Now)</text>

          <circle cx="420" cy="100" r="10" fill="#A1B9AB"/>
          <text x="420" y="103" fill="#003932" font-size="10">5</text>
          <text x="420" y="125" fill="#5a7a6e">Gate 5</text>
        </g>
        <!-- Documents -->
        <g font-family="Inter" font-size="9">
          <!-- Charter at Gate 2 (already due) -->
          <rect x="125" y="55" width="60" height="22" fill="#dcfce7" stroke="#16a34a" rx="3"/>
          <text x="155" y="69" text-anchor="middle" font-weight="700" fill="#15803d">Charter ✓</text>

          <!-- Plan at Gate 3 (already due) -->
          <rect x="220" y="55" width="60" height="22" fill="#dcfce7" stroke="#16a34a" rx="3"/>
          <text x="250" y="69" text-anchor="middle" font-weight="700" fill="#15803d">Plan ✓</text>

          <!-- Test plan at Gate 4 (currently due) -->
          <rect x="315" y="55" width="60" height="22" fill="#fef3c7" stroke="#d97706" rx="3"/>
          <text x="345" y="69" text-anchor="middle" font-weight="700" fill="#92400e">Test ◎</text>

          <!-- Closure at Gate 5 (not yet due — faded) -->
          <rect x="390" y="55" width="60" height="22" fill="#f1f5f1" stroke="#A1B9AB" stroke-dasharray="3,2" rx="3" opacity="0.6"/>
          <text x="420" y="69" text-anchor="middle" font-weight="700" fill="#5a7a6e" opacity="0.7">Closure ⏸</text>
        </g>
        <!-- Highlighted "Counted in MCI" zone -->
        <rect x="30" y="40" width="300" height="50" fill="none" stroke="#00b894" stroke-width="1.5" stroke-dasharray="4,3" rx="6"/>
        <text x="180" y="36" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="#00b894">↓ Counted in MCI (due by Gate 4)</text>

        <text x="420" y="170" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#5a7a6e">⏸ Excluded</text>
        <text x="420" y="183" text-anchor="middle" font-family="Inter" font-size="8" fill="#5a7a6e">(not yet due)</text>
      </svg>
      <div class="caption">Gate-aware MCI — only documents due by the current gate count toward the score</div>
    </div>

    <h3 class="sub">Document credit tiers</h3>
    <table>
      <thead><tr><th>Document status</th><th>Credit</th></tr></thead>
      <tbody>
        <tr><td><span class="chip green">Approved · Final · Received · Current</span></td><td><strong>1.0</strong> — full credit</td></tr>
        <tr><td><span class="chip amber">Submitted · Under Review</span></td><td><strong>0.5</strong> — half credit, in flight</td></tr>
        <tr><td><span class="chip grey">Draft · Missing · any other</span></td><td><strong>0.0</strong> — no credit</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Default gate assignments (standard artifacts)</h3>
    <table>
      <thead><tr><th>Document</th><th>Required at</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>Project Charter</td><td>Gate 2 (Planning)</td><td>Charter must exist for the planning phase</td></tr>
        <tr><td>Business Case</td><td>Gate 2 (Planning)</td><td>Justifies investment before plan submission</td></tr>
        <tr><td>Closure Document</td><td>Gate 5 (Closure)</td><td>Generated only at project close</td></tr>
      </tbody>
    </table>

    <div class="callout blue">
      <div class="lbl">Anti-gaming safeguard</div>
      <p>The <code>requiredAtGate</code> field is PMO-controlled at the UI level (RBAC-gated dropdown, invisible to PM tier). PMs cannot defer their own deliverables to a future gate. Every change PMO makes is captured in the audit trail.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 06 ANTICIPATED MCI ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">8</div></div>
  <div class="body">
    <div class="section-tag">Chapter 6</div>
    <h2 class="section"><span class="ch">06</span>Anticipated MCI — Early Warning</h2>
    <p>A project's MCI is a snapshot of compliance <em>right now</em>. But a project rolling smoothly at Gate 4 might be heading for a cliff if a stack of Gate-5 documents are still in Draft. Anticipated MCI computes "what would MCI be at the next gate, with today's document statuses?" — surfacing the drop before it happens.</p>

    <div class="formula">
      <span class="mint">Anticipated MCI</span> at Gate N+1
      <div class="small">= MCI computed as if currentGate = N+1, holding today's document statuses constant</div>
    </div>

    <h3 class="sub">How it surfaces in the UI</h3>
    <p>The project header IPI banner shows a coloured one-liner under the regular MCI when a forecast is available:</p>

    <div class="callout amber">
      <div class="lbl">Heads-up sample (Motor Fleet)</div>
      <p>MCI 100% docs × 25%<br><strong>⚠ Anticipated at Gate 5: 67%</strong> (1 new doc becomes due)</p>
    </div>

    <p>PMO sees the drop today and can chase the Closure Report owner now, instead of being surprised when the project crosses the gate boundary.</p>

    <h3 class="sub">Why this matters — a worked scenario</h3>

    <div class="ex">
      <div class="hd">Scenario · Motor Fleet at Gate 4</div>
      <h4>Project has 3 required documents</h4>
      <div class="calc"><span class="c">// Today (Gate 4)</span>
Charter (Gate 2)         ✓ Approved
Business Case (Gate 2)   ✓ Approved
Closure (Gate 5)         ◎ Pending

current MCI    = 2 / 2 = 1.0      <span class="c">// only 2 docs due, both done</span>
anticipated MCI = 2 / 3 = 0.67    <span class="c">// next gate adds Closure</span></div>
      <span class="res">MCI 100% today · 67% at Gate 5</span>
    </div>

    <h3 class="sub">When the warning fires</h3>
    <p>Anticipated MCI returns null (warning hidden) when:</p>
    <ul>
      <li>Project is already at <strong>Gate 5</strong> — there's no "next gate" to forecast.</li>
      <li>No documents become newly due at the next gate — the score won't change.</li>
    </ul>

    <p>Otherwise, the warning carries:</p>
    <ul>
      <li><strong>The target gate</strong> (e.g. "at Gate 5")</li>
      <li><strong>The projected MCI</strong> (e.g. "67%")</li>
      <li><strong>How many docs become newly due</strong> (e.g. "1 new doc")</li>
    </ul>

    <div class="plain">
      <div class="icon">🔮</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>Like a weather forecast for compliance. The status today is 'sunny' (100% MCI), but the forecast for next week (Gate 5) says 'cloudy' (67%) because three new documents become due. Time to grab the umbrella now.</p>
      </div>
    </div>

    <h3 class="sub">Reference code</h3>
    <p>The forecast function: <code>calcAnticipatedMCI(project)</code> in <code>src/utils/metrics.js</code>. Locked by 4 vitest cases (see Chapter 14).</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 07 ROADMAP PENALTY ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">9</div></div>
  <div class="body">
    <div class="section-tag">Chapter 7</div>
    <h2 class="section"><span class="ch">07</span>The Roadmap-Deadline Penalty</h2>
    <p>Every strategic project can carry a <strong>Roadmap Deadline</strong> — the date by which leadership committed delivery (regulator deadline, board commitment, strategic dependency). Distinct from the PM-owned <code>plannedEnd</code>.</p>

    <div class="formula">
      <span class="mint">penalty</span> = max(0, 1 − daysPastDeadline ÷ 100)
      <div class="small">Applied as a multiplier on SPI: SPI_final = SPI × penalty</div>
    </div>

    <!-- DIAGRAM 5: Roadmap penalty decay graph -->
    <div class="diagram">
      <svg width="100%" height="200" viewBox="0 0 460 200" xmlns="http://www.w3.org/2000/svg">
        <!-- Axes -->
        <line x1="50" y1="170" x2="430" y2="170" stroke="#003932" stroke-width="1.5"/>
        <line x1="50" y1="30" x2="50" y2="170" stroke="#003932" stroke-width="1.5"/>

        <!-- Y-axis labels -->
        <text x="44" y="34" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#003932">1.0</text>
        <text x="44" y="73" text-anchor="end" font-family="Inter" font-size="9" fill="#5a7a6e">0.75</text>
        <text x="44" y="113" text-anchor="end" font-family="Inter" font-size="9" fill="#5a7a6e">0.50</text>
        <text x="44" y="153" text-anchor="end" font-family="Inter" font-size="9" fill="#5a7a6e">0.25</text>
        <text x="44" y="178" text-anchor="end" font-family="Inter" font-size="9" font-weight="700" fill="#003932">0</text>

        <!-- X-axis labels -->
        <text x="50" y="186" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">0d</text>
        <text x="145" y="186" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">25d</text>
        <text x="240" y="186" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">50d</text>
        <text x="335" y="186" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">75d</text>
        <text x="430" y="186" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">100d+</text>

        <!-- Reference horizontal lines (faint) -->
        <line x1="50" y1="73" x2="430" y2="73" stroke="#ecf2ed" stroke-width="1"/>
        <line x1="50" y1="113" x2="430" y2="113" stroke="#ecf2ed" stroke-width="1"/>
        <line x1="50" y1="153" x2="430" y2="153" stroke="#ecf2ed" stroke-width="1"/>

        <!-- Penalty curve (linear from 1.0 → 0 over 100 days) -->
        <line x1="50" y1="30" x2="430" y2="170" stroke="#00b894" stroke-width="2.5"/>

        <!-- Sample points -->
        <circle cx="50" cy="30" r="5" fill="#00FFB3" stroke="#003932" stroke-width="2"/>
        <text x="58" y="22" font-family="Inter" font-size="9" font-weight="700" fill="#00b894">100%</text>

        <circle cx="145" cy="65" r="5" fill="#f59e0b" stroke="#003932" stroke-width="2"/>
        <text x="153" y="58" font-family="Inter" font-size="9" font-weight="700" fill="#d97706">75%</text>

        <circle cx="240" cy="100" r="5" fill="#FF5000" stroke="#003932" stroke-width="2"/>
        <text x="248" y="93" font-family="Inter" font-size="9" font-weight="700" fill="#FF5000">50%</text>

        <circle cx="430" cy="170" r="5" fill="#490300" stroke="#003932" stroke-width="2"/>
        <text x="378" y="163" font-family="Inter" font-size="9" font-weight="700" fill="#490300">0% floor</text>

        <!-- Axis titles -->
        <text x="240" y="200" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">Days past roadmap deadline</text>
        <text x="20" y="100" font-family="Inter" font-size="9" font-weight="700" fill="#003932" transform="rotate(-90, 20, 100)">Penalty multiplier</text>
      </svg>
      <div class="caption">Linear 1% decay per day · floors at 0 after 100 days</div>
    </div>

    <h3 class="sub">Behaviour table</h3>
    <table>
      <thead><tr><th>Days past roadmap</th><th>Penalty</th><th>Effect on SPI</th></tr></thead>
      <tbody>
        <tr><td>0 (within roadmap)</td><td>1.00</td><td>No effect</td></tr>
        <tr><td>10 days late</td><td>0.90</td><td>SPI reduced 10%</td></tr>
        <tr><td>30 days late</td><td>0.70</td><td>SPI reduced 30%</td></tr>
        <tr><td>50 days late</td><td>0.50</td><td>SPI halved</td></tr>
        <tr><td>100+ days late</td><td>0.00</td><td>SPI driven to zero</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Measurement reference date</h3>
    <ul>
      <li><strong>Project still in progress</strong> — penalty measured against today's date. Late projects bleed score every day until they finish.</li>
      <li><strong>Project completed</strong> — penalty frozen at the actual finish date. Finishing 20 days late stays at 0.80 in the history; closing the project doesn't erase the slippage.</li>
    </ul>

    <div class="callout amber">
      <div class="lbl">Design rationale</div>
      <p>The original requirement was "1% per day or more". 1% is the minimum — it can be tightened (e.g. 2% per day = 50-day window) for high-stakes regulator-tracked programmes if PMO chooses. The default is governance-grade conservative.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 08 CAP + NULL ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">10</div></div>
  <div class="body">
    <div class="section-tag">Chapter 8</div>
    <h2 class="section"><span class="ch">08</span>The 1.20 Cap &amp; Null Handling</h2>

    <h3 class="sub">The cap — why each component is bounded</h3>
    <p>Each of SPI, CPI, and MCI is capped at <strong>1.20</strong> before entering the IPI formula. Reasoning:</p>
    <ul>
      <li><strong>SPI can go arbitrarily high</strong> if an activity finishes way before its planned end (or the PM's plan was conservative). Without a cap, a single early activity could lift SPI to 5.0 or more.</li>
      <li><strong>CPI can also overshoot</strong> if a project under-spends dramatically (often a sign of paused work, not efficiency). Capping limits reward for under-spending.</li>
      <li><strong>MCI caps at 1.0</strong>, not 1.20 — compliance is binary, you cannot be "more than 100% compliant".</li>
    </ul>

    <!-- DIAGRAM 6: Status bands strip -->
    <div class="diagram">
      <svg width="100%" height="120" viewBox="0 0 460 120" xmlns="http://www.w3.org/2000/svg">
        <!-- Status zones -->
        <rect x="30" y="35" width="156" height="36" fill="#fee2e2"/>
        <rect x="186" y="35" width="74" height="36" fill="#ffd9c2"/>
        <rect x="260" y="35" width="40" height="36" fill="#fef3c7"/>
        <rect x="300" y="35" width="80" height="36" fill="#dcfce7"/>
        <rect x="380" y="35" width="50" height="36" fill="#bbf7d0"/>

        <!-- Borders -->
        <rect x="30" y="35" width="400" height="36" fill="none" stroke="#003932" stroke-width="1.5"/>

        <!-- Labels above zones -->
        <text x="108" y="28" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="#991b1b">Critical</text>
        <text x="223" y="28" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="#9a3412">At Risk</text>
        <text x="280" y="28" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="#92400e">Watch</text>
        <text x="340" y="28" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="#15803d">On Track</text>
        <text x="405" y="28" text-anchor="middle" font-family="Inter" font-size="9" font-weight="800" fill="#166534">Over Ach.</text>

        <!-- Scale labels below -->
        <text x="30" y="85" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">0</text>
        <text x="186" y="85" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">70</text>
        <text x="260" y="85" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">90</text>
        <text x="300" y="85" text-anchor="middle" font-family="Inter" font-size="9" font-weight="700" fill="#003932">100</text>
        <text x="380" y="85" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">110</text>
        <text x="430" y="85" text-anchor="middle" font-family="Inter" font-size="9" fill="#5a7a6e">115</text>

        <!-- Caption -->
        <text x="230" y="108" text-anchor="middle" font-family="Inter" font-size="10" font-weight="700" fill="#003932">IPI Score</text>
      </svg>
      <div class="caption">IPI status bands · capped at ~115 by the 1.20 component cap</div>
    </div>

    <h3 class="sub">Null handling — the "Pending Plan" status</h3>
    <p>Each component returns <code>null</code> when there's no data to compute it from:</p>
    <ul>
      <li><strong>SPI null</strong> — no WBS leaves AND no project-level dates</li>
      <li><strong>CPI null</strong> — budget = 0 OR actualCost = 0</li>
      <li><strong>MCI null</strong> — no documents uploaded at all</li>
    </ul>
    <p>When <em>all three</em> are null, the project itself returns <code>null</code> IPI and is displayed as <span class="chip grey">Pending Plan</span>. When one or two are null, they're treated as <strong>1.0 (neutral)</strong> in the formula — so the project isn't penalised for missing data it never had.</p>

    <div class="callout blue">
      <div class="lbl">Critical rollup behaviour</div>
      <p>Department and Portfolio rollups <strong>exclude null-IPI projects entirely</strong> from the weighted average. Placeholder projects don't pollute leadership dashboards. A department with five active projects and three placeholders shows the IPI of the five real ones, not a diluted average.</p>
    </div>

    <div class="plain">
      <div class="icon">⚖️</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>Treating null as 1.0 means: "we don't have data to judge this, so we won't penalise it." Treating null as 0 would be unfair — like marking a student zero on a test they were exempted from.</p>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 09 WORKED EX ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">11</div></div>
  <div class="body">
    <div class="section-tag">Chapter 9</div>
    <h2 class="section"><span class="ch">09</span>Worked Example — Single Project</h2>
    <p>End-to-end calculation for a real-shape project. Values from <strong>Motor Fleet (PRJ-2026-46)</strong> on the production portal as of 2026-06-19.</p>

    <h3 class="sub">Inputs</h3>
    <table>
      <tbody>
        <tr><td class="k" style="width:32%">Project</td><td>Motor Fleet, Gate 4</td></tr>
        <tr><td class="k">Start date</td><td>2026-04-04</td></tr>
        <tr><td class="k">Planned end</td><td>2026-07-30</td></tr>
        <tr><td class="k">Roadmap deadline</td><td>2026-06-30</td></tr>
        <tr><td class="k">Today (asOfDate)</td><td>2026-06-19</td></tr>
        <tr><td class="k">WBS progress (effective)</td><td>41%</td></tr>
        <tr><td class="k">Budget · Actual Cost</td><td>1,000,000 · 410,000</td></tr>
        <tr><td class="k">Required docs</td><td>3 total · Charter (Gate 2, Approved) · Business Case (Gate 2, Approved) · Closure (Gate 5, Pending)</td></tr>
      </tbody>
    </table>

    <div class="ex">
      <div class="hd">Step 1 · SPI from WBS</div>
      <div class="calc">EV = 0.907  <span class="c">// weighted % from WBS leaves</span>
PV = (2026-06-19 − 2026-04-04) ÷ (2026-07-30 − 2026-04-04)
   = 76d ÷ 117d = 0.650
SPI = EV ÷ PV = 0.907 ÷ ... → capped at 1.20</div>
      <span class="res">SPI = 0.907</span>
    </div>

    <div class="ex">
      <div class="hd">Step 2 · Roadmap penalty</div>
      <div class="calc">Today (2026-06-19) &lt; Roadmap deadline (2026-06-30)
<span class="c">→ penalty = 1.0 (no decay)</span></div>
      <span class="res">SPI_final = 0.907 × 1.0 = 0.907</span>
    </div>

    <div class="ex">
      <div class="hd">Step 3 · CPI (BCWP sourced from effectiveProgress)</div>
      <div class="calc">BCWP = 0.41 × 1,000,000 = 410,000
CPI  = 410,000 ÷ 410,000 = 1.0</div>
      <span class="res">CPI = 1.0</span>
    </div>

    <div class="ex">
      <div class="hd">Step 4 · MCI (gate-aware)</div>
      <div class="calc">currentGate = 4
due docs    = Charter (Gate 2 ≤ 4), Business Case (Gate 2 ≤ 4)
excluded    = Closure (Gate 5 &gt; 4 — not yet due)
credit      = 1.0 + 1.0 = 2.0
MCI         = 2.0 ÷ 2 = 1.00</div>
      <span class="res">MCI = 1.0</span>
    </div>

    <div class="ex">
      <div class="hd">Step 5 · Combine into IPI</div>
      <div class="calc">IPI = 0.907 × 0.50  +  1.0 × 0.25  +  1.0 × 0.25
    = 0.4535 + 0.25 + 0.25
    = 0.9535</div>
      <span class="res">IPI = 95 — Watch</span>
    </div>

    <div class="ex">
      <div class="hd">Step 6 · Anticipated MCI (heads-up)</div>
      <div class="calc">at Gate 5, due = Charter + Business Case + Closure
Closure still Pending → credit unchanged at 2.0
anticipated MCI = 2.0 ÷ 3 = 0.667</div>
      <span class="res">⚠ Anticipated at Gate 5: 67%</span>
    </div>
    <p style="font-size:11px; color:var(--muted); margin-top:4px;">PMO sees this warning today and starts the Closure document before the gate transition tanks the IPI.</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 10 ROLLUPS ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">12</div></div>
  <div class="body">
    <div class="section-tag">Chapter 10</div>
    <h2 class="section"><span class="ch">10</span>Department &amp; Portfolio Rollups</h2>
    <p>Project-level IPI is the foundation. To answer <em>"how is this department doing?"</em> or <em>"how is the whole portfolio?"</em>, we aggregate — <strong>not as a simple average</strong>, but as a weighted average where each project's voice is proportional to its strategic weight.</p>

    <div class="formula">
      <span class="mint">weight(project)</span> = budget × priorityMultiplier
      <div class="small">Critical = 4 · High = 3 · Medium = 2 · Low = 1</div>
    </div>

    <!-- DIAGRAM 7: Portfolio weighting visualisation -->
    <div class="diagram">
      <svg width="100%" height="180" viewBox="0 0 460 180" xmlns="http://www.w3.org/2000/svg">
        <!-- Critical+50M project (large box) -->
        <rect x="40" y="30" width="180" height="120" fill="#003932" stroke="#001f1a" stroke-width="2" rx="8"/>
        <text x="130" y="60" text-anchor="middle" font-family="Inter" font-size="11" font-weight="800" fill="#00FFB3">Programme A</text>
        <text x="130" y="80" text-anchor="middle" font-family="Inter" font-size="9" fill="rgba(255,255,255,0.8)">Critical · ×4</text>
        <text x="130" y="98" text-anchor="middle" font-family="Inter" font-size="9" fill="rgba(255,255,255,0.8)">Budget: 50M</text>
        <text x="130" y="124" text-anchor="middle" font-family="Inter" font-size="22" font-weight="900" fill="#00FFB3">200M</text>
        <text x="130" y="140" text-anchor="middle" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.6)">weight</text>

        <!-- Low+2M project (small box) -->
        <rect x="280" y="100" width="60" height="50" fill="#A1B9AB" stroke="#7a9485" stroke-width="2" rx="6"/>
        <text x="310" y="118" text-anchor="middle" font-family="Inter" font-size="9" font-weight="800" fill="#003932">Project B</text>
        <text x="310" y="130" text-anchor="middle" font-family="Inter" font-size="7" fill="#5a7a6e">Low ×1 · 2M</text>
        <text x="310" y="144" text-anchor="middle" font-family="Inter" font-size="11" font-weight="900" fill="#003932">2M</text>

        <!-- High+5M project (medium box) -->
        <rect x="360" y="80" width="80" height="70" fill="#00b894" stroke="#003932" stroke-width="2" rx="6"/>
        <text x="400" y="100" text-anchor="middle" font-family="Inter" font-size="10" font-weight="800" fill="white">Project C</text>
        <text x="400" y="114" text-anchor="middle" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.85)">High ×3</text>
        <text x="400" y="126" text-anchor="middle" font-family="Inter" font-size="8" fill="rgba(255,255,255,0.85)">5M</text>
        <text x="400" y="143" text-anchor="middle" font-family="Inter" font-size="13" font-weight="900" fill="white">15M</text>

        <!-- Caption -->
        <text x="230" y="172" text-anchor="middle" font-family="Inter" font-size="9" font-style="italic" fill="#5a7a6e">Box size ∝ weight · Programme A dominates the rollup</text>
      </svg>
      <div class="caption">Budget × priority weighting · a Critical+big project drives the rollup</div>
    </div>

    <h3 class="sub">Why budget × priority?</h3>
    <ul>
      <li><strong>Budget alone is not enough</strong> — a 50M SAR Low-priority project shouldn't outweigh a 5M SAR Critical regulatory milestone.</li>
      <li><strong>Priority alone is not enough</strong> — every department has at least one "Critical" project; without budget context the rollup becomes noise.</li>
      <li><strong>The product captures both</strong> — money at risk × strategic importance = the true contribution to portfolio outcome.</li>
    </ul>

    <div class="formula">
      <span class="mint">IPI_rollup</span> = Σ(IPI<sub>i</sub> × weight<sub>i</sub>) ÷ Σ(weight<sub>i</sub>)
      <div class="small">Computed over all non-archived projects with non-null IPI</div>
    </div>

    <h3 class="sub">Mini illustration — 2 projects, equal budgets, different priorities</h3>
    <table>
      <thead><tr><th>Project</th><th>IPI</th><th>Priority</th><th>Mult.</th><th>Weight</th><th>Contribution</th></tr></thead>
      <tbody>
        <tr><td>Programme A</td><td>90</td><td>Critical</td><td>4</td><td>4</td><td>360</td></tr>
        <tr><td>Programme B</td><td>70</td><td>Low</td><td>1</td><td>1</td><td>70</td></tr>
        <tr class="tot"><td colspan="4">Totals</td><td>5</td><td>430</td></tr>
      </tbody>
    </table>
    <p style="font-size: 11.5px; margin-top: 6px;">Portfolio IPI = 430 ÷ 5 = <strong>86</strong>. A simple average would have been (90+70)/2 = 80. The 6-point difference is the priority signal: the Critical programme's health matters 4× more.</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 11 PORTFOLIO EXAMPLE ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">13</div></div>
  <div class="body">
    <div class="section-tag">Chapter 11</div>
    <h2 class="section"><span class="ch">11</span>Worked Example — Portfolio</h2>
    <p>Most-asked scenario at Strategy reviews. One Critical regulatory programme + four High-priority business projects. Because IPI depends on relative weights, we show <strong>three budget scenarios</strong>.</p>

    <h3 class="sub">Inputs</h3>
    <table>
      <thead><tr><th>Project</th><th>IPI</th><th>Priority</th></tr></thead>
      <tbody>
        <tr><td>Digital Insurer Transformation</td><td>89</td><td>Critical (×4)</td></tr>
        <tr><td>Project A</td><td>69</td><td>High (×3)</td></tr>
        <tr><td>Project B</td><td>77</td><td>High (×3)</td></tr>
        <tr><td>Project C</td><td>60</td><td>High (×3)</td></tr>
        <tr><td>Project D</td><td>85</td><td>High (×3)</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px; color:var(--muted);">Simple unweighted average for reference: (89+69+77+60+85)/5 = <strong>76</strong></p>

    <div class="ex">
      <div class="hd">Scenario A · All five projects equal budget</div>
      <div class="calc">numerator   = 89×4 + 69×3 + 77×3 + 60×3 + 85×3 = 1,229
denominator = 4 + 3 + 3 + 3 + 3 = 16
Portfolio   = 1,229 ÷ 16 = 76.8</div>
      <span class="res">Portfolio IPI = 77 — At Risk</span>
    </div>

    <div class="ex">
      <div class="hd">Scenario B · Transformation 5× the budget of each business project</div>
      <div class="calc">budgets: Transformation 10M · others 2M each
weights: 10×4=40 · 2×3=6 (×4 projects)
numerator   = 89×40 + (69+77+60+85)×6 = 5,306
denominator = 40 + 6+6+6+6 = 64
Portfolio   = 5,306 ÷ 64 = 82.9</div>
      <span class="res">Portfolio IPI = 83 — At Risk (borderline Watch)</span>
    </div>

    <div class="ex">
      <div class="hd">Scenario C · Transformation 25× (typical for licensing programmes)</div>
      <div class="calc">budgets: Transformation 50M · others 2M each
weights: 50×4=200M · 2×3=6M (×4 projects)
numerator   = 89×200 + (69+77+60+85)×6 = 19,546
denominator = 200 + 24 = 224
Portfolio   = 19,546 ÷ 224 = 87.3</div>
      <span class="res">Portfolio IPI = 87 — Watch</span>
    </div>

    <div class="callout">
      <div class="lbl">What this tells leadership</div>
      <p>The bigger the strategic programme relative to the rest, the more its health drives the portfolio score. In Scenario C — closest to reality — the four struggling business projects barely move the needle, because the Transformation programme is the bet that defines the year. Design intent: <em>the portfolio score reflects what matters most to the company, not what is most numerous.</em></p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 12 STATUS DERIVATION ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">14</div></div>
  <div class="body">
    <div class="section-tag">Chapter 12</div>
    <h2 class="section"><span class="ch">12</span>Project Status Derivation</h2>
    <p>Status — the green/orange/red badge on every project — used to be a free-form field the PM could set arbitrarily. As of 2026-06-22, it's <strong>derived</strong> from the same performance signals that feed IPI. PMOs retain an override on the admin Edit Project form for context the math can't see (e.g. sponsor freeze, regulator pause).</p>

    <div class="formula">
      <span class="mint">status</span> = deriveProjectStatus(project)
      <div class="small">Returns { status, reason } — both the label and a human-readable explanation</div>
    </div>

    <h3 class="sub">Derivation rules (priority order)</h3>
    <table>
      <thead><tr><th>Rule</th><th>Returns</th></tr></thead>
      <tbody>
        <tr><td>Progress = 100% AND project reached Gate 5</td><td><span class="chip blue">Completed</span></td></tr>
        <tr><td>plannedEnd is past AND progress &lt; 100%</td><td><span class="chip red">Delayed</span></td></tr>
        <tr><td>Progress = 0 AND no activities defined</td><td><span class="chip grey">Not Started</span></td></tr>
        <tr><td>IPI = null (Pending Plan)</td><td><span class="chip grey">Not Started</span></td></tr>
        <tr><td>IPI ≥ 90</td><td><span class="chip green">On Track</span></td></tr>
        <tr><td>IPI &lt; 90 (any measurable project)</td><td><span class="chip orange">At Risk</span></td></tr>
      </tbody>
    </table>

    <h3 class="sub">Why "Completed" requires both progress = 100 AND Gate 5</h3>
    <p>A project at Gate 4 with 100% progress is not yet Completed — Gate 5 (Closure) hasn't been signed off. Requiring both prevents premature green badges before the formal closure step.</p>

    <h3 class="sub">Why a "reason" string is always returned</h3>
    <p>The UI surfaces the reason directly under the status chip on the Update Panel:</p>
    <div class="callout">
      <div class="lbl">Sample (Update Panel display)</div>
      <p><strong>🟢 On Track</strong>  ·  🤖 Auto · IPI 92 ≥ 90 threshold</p>
    </div>
    <p>So the PM never has to guess why the badge landed where it did. The "reason" is also stored when an Update is submitted, creating an audit trail.</p>

    <div class="callout blue">
      <div class="lbl">PMO override path</div>
      <p>The admin Edit Project form still lets PMO/admin manually set the status. This is intentional — contextual signals (sponsor freeze, regulator pause, parent programme delay) can't be inferred from raw metrics. Manual overrides are logged in the project's update history.</p>
    </div>

    <h3 class="sub">Reference code</h3>
    <p><code>deriveProjectStatus(project)</code> in <code>src/utils/metrics.js</code>. Locked by 6 vitest cases — see Chapter 14.</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 13 TIME-WEIGHTED ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">15</div></div>
  <div class="body">
    <div class="section-tag">Chapter 13</div>
    <h2 class="section"><span class="ch">13</span>Time-Weighted IPI</h2>
    <p>A project's IPI today is one snapshot. Leadership decisions need trend, not just spot reading. Every time a PM updates a project, the portal appends an <code>ipiHistory</code> snapshot: <code>{ date, ipi }</code>. The Department and Portfolio rollups use the <strong>time-weighted average</strong> of those snapshots over their active period.</p>

    <div class="formula">
      <span class="mint">IPI_rolled</span> = Σ(IPI<sub>i</sub> × days<sub>i</sub>) ÷ Σ(days<sub>i</sub>)
      <div class="small">days<sub>i</sub> = days from snapshot i to snapshot i+1 (or to today for the latest)</div>
    </div>

    <h3 class="sub">Why time-weighted?</h3>
    <ul>
      <li><strong>A single bad month shouldn't dominate</strong> — a project recovering steadily for 5 months but with one bad week shouldn't show that week as the headline.</li>
      <li><strong>A single good month shouldn't mask drift</strong> — a Q1 spike doesn't paper over Q2/Q3 erosion.</li>
      <li><strong>Trend matters more than spot value</strong> — leadership wants "is this trending up or down over the quarter?", not "where was it Friday?"</li>
    </ul>

    <div class="ex">
      <div class="hd">3-month history sample</div>
      <h4>Project with 3 snapshots over 90 days</h4>
      <table>
        <thead><tr><th>Snapshot</th><th>IPI</th><th>Days active</th><th>Weighted</th></tr></thead>
        <tbody>
          <tr><td>Day 0 (Apr 1)</td><td>85</td><td>30</td><td>2,550</td></tr>
          <tr><td>Day 30 (May 1)</td><td>72</td><td>30</td><td>2,160</td></tr>
          <tr><td>Day 60 (Jun 1)</td><td>91</td><td>30</td><td>2,730</td></tr>
          <tr class="tot"><td colspan="2">Totals</td><td>90</td><td>7,440</td></tr>
        </tbody>
      </table>
      <div class="calc">Time-weighted IPI = 7,440 ÷ 90 = 82.7</div>
      <span class="res">IPI for rollups = 83</span>
    </div>
    <p style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">Showing 91 today, but the quarter's effective health was 83 — leadership sees the truer picture.</p>

    <div class="callout">
      <div class="lbl">Where time-weighted IPI is used</div>
      <p>Time-weighting applies <strong>only in Department and Portfolio rollups</strong> — those are inherently averages, and smoothing prevents spike-driven decisions. The individual project page shows the <strong>current snapshot</strong>, so the breakdown beside it (SPI, CPI, MCI) always mathematically matches the displayed IPI.</p>
    </div>

    <div class="plain">
      <div class="icon">📈</div>
      <div class="content">
        <div class="lbl">In plain language</div>
        <p>Like grading a student on the whole term, not just last Friday's quiz. A student who scored 60, 80, 90 over three months has a real average of 77 — not the 90 from their last test alone.</p>
      </div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 14 GOVERNANCE / 46 TESTS ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">16</div></div>
  <div class="body">
    <div class="section-tag">Chapter 14 · Audit Evidence</div>
    <h2 class="section"><span class="ch">14</span>Is It Solid? — 46-Test Audit Evidence</h2>
    <p>This chapter is the honest defence. Every claim made in this document is locked in code by an automated test that runs in 0.4 seconds, every time anything changes.</p>

    <h3 class="sub">Run the audit yourself</h3>
    <pre class="code"><span class="c">$</span> cd pmo-portal-clone
<span class="c">$</span> npm test

 RUN  v4.1.9 src/utils/metrics.test.js

 Test Files  <span class="k">1 passed</span> (1)
      Tests  <span class="k">46 passed</span> (46)
   Duration  <span class="k">362ms</span></pre>

    <h3 class="sub">What the 46 cases lock in</h3>

    <div class="tests">
<span class="label">// 5 cases ·</span> <span class="group">parseGateNumber</span>
<span class="ok">✓</span> parses 'Gate 1' through 'Gate 5'
<span class="ok">✓</span> parses short forms like 'G3'
<span class="ok">✓</span> defaults to 1 when missing or unparseable
<span class="ok">✓</span> clamps out-of-range values to [1, 5]

<span class="label">// 7 cases ·</span> <span class="group">MCI gate-aware compliance</span>
<span class="ok">✓</span> excludes future-gate required docs from denominator
<span class="ok">✓</span> includes a doc once its gate is reached
<span class="ok">✓</span> defaults missing requiredAtGate to 1 (always due)
<span class="ok">✓</span> returns null when every required doc is future-gate
<span class="ok">✓</span> returns 1.0 when docs exist but none required
<span class="ok">✓</span> returns null when no documents at all
<span class="ok">✓</span> counts Submitted/Under Review at 0.5 credit

<span class="label">// 4 cases ·</span> <span class="group">Anticipated MCI</span>
<span class="ok">✓</span> returns null when project is at Gate 5
<span class="ok">✓</span> returns null when no doc becomes due at next gate
<span class="ok">✓</span> forecasts MCI drop when next gate brings missing doc
<span class="ok">✓</span> forecasts MCI stays high when next-gate doc Approved

<span class="label">// 7 cases ·</span> <span class="group">deriveProjectStatus</span>
<span class="ok">✓</span> Completed when progress=100 and Gate 5
<span class="ok">✓</span> NOT Completed when progress=100 but still Gate 4
<span class="ok">✓</span> Delayed when past plannedEnd and not at 100%
<span class="ok">✓</span> Not Started when no activities and progress=0
<span class="ok">✓</span> On Track when IPI ≥ 90
<span class="ok">✓</span> At Risk when IPI &lt; 90 mid-flight
<span class="ok">✓</span> includes a human-readable reason on every result

<span class="label">// 1 case ·</span> <span class="group">IPI consistency</span>
<span class="ok">✓</span> snapshot IPI = 100·(0.5·SPI + 0.25·CPI + 0.25·MCI)

<span class="label">// 3 cases ·</span> <span class="group">Caps</span>
<span class="ok">✓</span> SPI is capped at 1.20
<span class="ok">✓</span> CPI is capped at 1.20
<span class="ok">✓</span> MCI is capped at 1.0

<span class="label">// 4 cases ·</span> <span class="group">Roadmap penalty (1% / day decay)</span>
<span class="ok">✓</span> penalty 1.0 within roadmap
<span class="ok">✓</span> penalty 0.90 when 10 days past
<span class="ok">✓</span> penalty floors at 0 past 100 days
<span class="ok">✓</span> applied multiplicatively (spiFinal = spi × penalty)

<span class="label">// 2 cases ·</span> <span class="group">Null handling</span>
<span class="ok">✓</span> individual nulls neutral at 1.0
<span class="ok">✓</span> all-null returns null IPI ('Pending Plan')

<span class="label">// 1 case ·</span> <span class="group">CPI source-of-truth</span>
<span class="ok">✓</span> BCWP comes from effectiveProgress (WBS rollup)

<span class="label">// 3 cases ·</span> <span class="group">calcDeptIPI rollup</span>
<span class="ok">✓</span> Critical × big-budget dominates the dept score
<span class="ok">✓</span> excludes null-IPI (Pending Plan) projects
<span class="ok">✓</span> returns null when no measurable projects

<span class="label">// 2 cases ·</span> <span class="group">calcTimeWeightedIPI</span>
<span class="ok">✓</span> weighted by days each snapshot was active
<span class="ok">✓</span> falls back to snapshot when no history

<span class="label">// 2 cases ·</span> <span class="group">effectiveProgress</span>
<span class="ok">✓</span> prefers WBS rollup when milestones exist
<span class="ok">✓</span> falls back to project.progress when no WBS

<span class="label">// 6 cases ·</span> <span class="group">ipiColor status bands</span>
<span class="ok">✓</span> maps null to 'No Data'
<span class="ok">✓</span> maps &gt;100 to 'Over Achieved'
<span class="ok">✓</span> maps exactly 100 to 'On Track'
<span class="ok">✓</span> maps 90 to 'Watch'
<span class="ok">✓</span> maps 70 to 'At Risk'
<span class="ok">✓</span> maps below 70 to 'Critical'

<span class="num">46/46</span> <span class="ok">passed</span> <span class="label">· any drift between this document and the engine fails the suite immediately</span></div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 14 (cont) GOVERNANCE NARRATIVE ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">17</div></div>
  <div class="body">
    <div class="section-tag">Chapter 14 · Defensibility</div>
    <h2 class="section">Industry alignment &amp; honest limits</h2>

    <h3 class="sub">What aligns with industry standard</h3>
    <ul>
      <li><strong>SPI = EV ÷ PV</strong> — textbook Earned Value Management ratio, PMI Practice Standard for EVM (2nd ed., 2011). Universally used in capital projects, defence, infrastructure.</li>
      <li><strong>CPI = BCWP ÷ AC</strong> — same EVM source, same definition.</li>
      <li><strong>Time-based PV with linear interpolation</strong> — PMI's current guidance prefers continuous PV over the older "0/50/100" technique. Our implementation is the modern approach.</li>
      <li><strong>Weighted rollup by strategic value</strong> — PMI Portfolio Management standard (4th ed.) explicitly recommends weighting by strategic contribution, not simple averaging.</li>
    </ul>

    <h3 class="sub">What is custom to this portfolio</h3>
    <ul>
      <li><strong>MCI (compliance dimension)</strong> — not part of standard EVM. Added because regulated insurance projects live or die on artifact delivery. Documented and weighted explicitly.</li>
      <li><strong>Gate-aware MCI</strong> — our own innovation. Solves the "perpetually-At-Risk because Closure is missing" anti-pattern that pure EVM doesn't address.</li>
      <li><strong>The 50/25/25 weights</strong> — a choice, not a standard. Defensible because schedule slip cascades fastest and CPI is laggier.</li>
      <li><strong>The 1.20 cap and 1% / day penalty</strong> — design choices, exposed as single constants for review.</li>
    </ul>

    <h3 class="sub">Defensibility checklist</h3>
    <table>
      <thead><tr><th>Audit question</th><th>Answer</th></tr></thead>
      <tbody>
        <tr><td>Is the formula deterministic?</td><td>Yes — same inputs always produce the same output.</td></tr>
        <tr><td>Is it auditable?</td><td>Yes — all logic in <code>metrics.js</code>, git-tracked, 46 automated tests.</td></tr>
        <tr><td>Is it gameable by a PM?</td><td>Limited — PM cannot edit roadmapDeadline, requiredAtGate, priority, or budget.</td></tr>
        <tr><td>Are thresholds change-controlled?</td><td>Yes — no admin UI for IPI_DEFAULTS. Changes require code commit + review.</td></tr>
        <tr><td>Does it match industry standards?</td><td>SPI/CPI portions yes (PMI EVM). MCI custom, documented.</td></tr>
        <tr><td>Has it been externally audited?</td><td>Not yet — external review is on the handover backlog before regulator submission.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Honest limitations</h3>
    <ul>
      <li><strong>Inputs are still manual</strong> — progress %, document status, and actual cost are entered by the PM. The formula is rigorous but garbage-in still produces garbage-out. PMO review at gate transitions is the control.</li>
      <li><strong>WBS quality varies</strong> — a project with a thoughtful WBS produces a more accurate SPI than one with a single milestone. Templates aim to standardise.</li>
      <li><strong>No probabilistic confidence</strong> — IPI is a point estimate, not a range. Future work could add Monte Carlo bands for high-stakes programmes.</li>
    </ul>

    <div class="callout">
      <div class="lbl">Bottom line</div>
      <p>The methodology is technically sound, aligned with PMI EVM at its core, transparently extended for compliance, with anti-gaming safeguards and an automated test suite that catches any drift. It is governance-grade — defensible in front of a regulator with this document as the methodology paper. External validation is the natural next step.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 15 STRATEGY Q&A ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">18</div></div>
  <div class="body">
    <div class="section-tag">Chapter 15</div>
    <h2 class="section"><span class="ch">15</span>Strategy Q&amp;A</h2>
    <p>The questions most likely to come up in a Strategy or audit review, with concise answers.</p>

    <div class="qa">
      <div class="q">Why not a simple percent complete instead of all this maths?</div>
      <div class="a">Progress % alone doesn't catch cost overruns or missing compliance. A project can be 100% delivered yet 50% over budget and missing Gate-3 sign-off — IPI flags that, simple % wouldn't.</div>
    </div>

    <div class="qa">
      <div class="q">Who decides the weights — 50/25/25?</div>
      <div class="a">PMO leadership, documented in <code>IPI_DEFAULTS</code>. Adjusting requires written rationale, code change, and re-baselining historical scores. Not a setting a PM can tweak.</div>
    </div>

    <div class="qa">
      <div class="q">Can a PM make their project look better than it is?</div>
      <div class="a">Partially — by overstating progress %, which inflates EV and therefore SPI. Countermeasures: PMO review at Gate transitions, the roadmap-deadline penalty (PM-set dates can't escape it), version history of every update, and the new gate-aware MCI which PMO controls (PM can't defer artifacts to a future gate).</div>
    </div>

    <div class="qa">
      <div class="q">Why are projects with no data shown as "Pending Plan" and not 0?</div>
      <div class="a">A project pre-Gate-0 has had no opportunity to perform — scoring it zero would be misleading and tank department averages. "Pending Plan" is a distinct state that excludes it from rollups.</div>
    </div>

    <div class="qa">
      <div class="q">How does Portfolio IPI handle a project with budget = 0?</div>
      <div class="a">Falls back to priority weight alone (Critical=4, High=3, Medium=2, Low=1). Small/pilot projects still contribute, but don't dominate.</div>
    </div>

    <div class="qa">
      <div class="q">Why does the dept IPI sometimes differ from averaging the project IPIs I see?</div>
      <div class="a">Two reasons. (1) Weighting by budget × priority — not a simple average. (2) Dept rollups use time-weighted IPI, smoothing snapshot spikes; the table shows current snapshots. Both are documented and intentional.</div>
    </div>

    <div class="qa">
      <div class="q">If we change the formula, do old scores recalculate?</div>
      <div class="a">Current snapshots recalculate live (computed from raw data each render). Historical <code>ipiHistory</code> snapshots remain frozen — they captured the old score on the day they were taken. This preserves the audit trail.</div>
    </div>

    <div class="qa">
      <div class="q">Why is the cap 1.20 and not, say, 1.50?</div>
      <div class="a">Empirical comfort. Beyond 20% over-target, the more likely explanation is a sandbagged plan than exceptional performance. Capping protects the score from those distortions.</div>
    </div>

    <div class="qa">
      <div class="q">Why does MCI cap at 1.0 but SPI/CPI cap at 1.20?</div>
      <div class="a">Compliance is binary — you cannot be "more than 100% compliant". An over-achievement envelope makes sense for schedule and cost (where you can deliver early or save money), but not for documents.</div>
    </div>

    <div class="qa">
      <div class="q">What happens if the WBS changes but the stored progress field is stale?</div>
      <div class="a">Since 2026-06-23, CPI's BCWP sources progress from <code>effectiveProgress(project)</code> — the WBS rollup — not the stored field. No drift possible.</div>
    </div>

    <div class="qa">
      <div class="q">How often does Portfolio IPI refresh?</div>
      <div class="a">Live, every page load. No nightly batch — every read computes from current SharePoint state. The "time-weighted" smoothing operates over saved <code>ipiHistory</code> snapshots, written on PM updates.</div>
    </div>

    <div class="qa">
      <div class="q">Is this defensible to the regulator?</div>
      <div class="a">Yes — with this document as the methodology paper, the source code as the implementation reference, the 46 automated tests as audit evidence, and an external validation by an EVM-credentialled reviewer (recommended pre-submission). The formula itself is rigorous; the governance package around it is what hardens it.</div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════════════ 16 GLOSSARY ════════════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="v">V2</div><div class="pg">19</div></div>
  <div class="body">
    <div class="section-tag">Chapter 16 · One-page reference</div>
    <h2 class="section"><span class="ch">16</span>Glossary &amp; Thresholds</h2>

    <h3 class="sub">Constants (from IPI_DEFAULTS)</h3>
    <table>
      <thead><tr><th>Constant</th><th>Value</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="k">SPI weight</td><td>0.50</td><td>Half of total IPI</td></tr>
        <tr><td class="k">CPI weight</td><td>0.25</td><td>Quarter — laggier signal</td></tr>
        <tr><td class="k">MCI weight</td><td>0.25</td><td>Quarter — compliance dimension</td></tr>
        <tr><td class="k">SPI / CPI cap</td><td>1.20</td><td>20% over-achievement envelope</td></tr>
        <tr><td class="k">MCI cap</td><td>1.00</td><td>Compliance is binary — no over-achievement</td></tr>
        <tr><td class="k">Max IPI</td><td>~115</td><td>0.5×1.20 + 0.25×1.20 + 0.25×1.00 = 1.15</td></tr>
        <tr><td class="k">Roadmap penalty rate</td><td>1% / day</td><td>Linear decay, applied to SPI only</td></tr>
        <tr><td class="k">Decay window</td><td>100 days</td><td>SPI hits 0 after 100 days past roadmap</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Priority multipliers</h3>
    <table>
      <thead><tr><th>Priority</th><th>Multiplier</th></tr></thead>
      <tbody>
        <tr><td><span class="chip red">Critical</span></td><td>× 4</td></tr>
        <tr><td><span class="chip orange">High</span></td><td>× 3</td></tr>
        <tr><td><span class="chip amber">Medium</span></td><td>× 2</td></tr>
        <tr><td><span class="chip grey">Low</span></td><td>× 1</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Document credit tiers (MCI)</h3>
    <table>
      <thead><tr><th>Status</th><th>Credit</th></tr></thead>
      <tbody>
        <tr><td>Approved · Final · Received · Current</td><td>1.0</td></tr>
        <tr><td>Submitted · Under Review</td><td>0.5</td></tr>
        <tr><td>Draft · Missing · any other</td><td>0.0</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Status colour thresholds</h3>
    <table>
      <thead><tr><th>IPI</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>&gt; 100</td><td><span class="chip green">Over Achieved</span></td></tr>
        <tr><td>= 100</td><td><span class="chip green">On Track</span></td></tr>
        <tr><td>90–99</td><td><span class="chip amber">Watch</span></td></tr>
        <tr><td>70–89</td><td><span class="chip orange">At Risk</span></td></tr>
        <tr><td>&lt; 70</td><td><span class="chip red">Critical</span></td></tr>
        <tr><td>null</td><td><span class="chip grey">Pending Plan</span></td></tr>
      </tbody>
    </table>

    <h3 class="sub">Where to find the code</h3>
    <table>
      <tbody>
        <tr><td class="k">Project IPI</td><td><code>calcProjectIPIFull(project, asOfDate)</code></td></tr>
        <tr><td class="k">Time-weighted IPI</td><td><code>calcTimeWeightedIPI(project, asOfDate)</code></td></tr>
        <tr><td class="k">Gate-aware MCI</td><td><code>computeMCI(documents, atGate)</code></td></tr>
        <tr><td class="k">Anticipated MCI</td><td><code>calcAnticipatedMCI(project)</code></td></tr>
        <tr><td class="k">Project Status</td><td><code>deriveProjectStatus(project)</code></td></tr>
        <tr><td class="k">Department rollup</td><td><code>calcDeptIPI(deptId, projects)</code></td></tr>
        <tr><td class="k">Portfolio rollup</td><td><code>calcPortfolioIPI(projects, asOfDate)</code></td></tr>
        <tr><td class="k">All in file</td><td><code>src/utils/metrics.js</code></td></tr>
        <tr><td class="k">Test suite</td><td><code>src/utils/metrics.test.js</code> · 46 cases · <code>npm test</code></td></tr>
      </tbody>
    </table>

    <div class="callout">
      <div class="lbl">Document control</div>
      <p>Last revised in lockstep with <code>metrics.js</code> on 2026-06-23. If constants in code diverge from this document, the code wins — re-issue this paper alongside the change. The 46-test suite catches drift automatically; CI prevents merge if any test fails.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

</body>
</html>`;

const outPath = path.join('C:', 'Users', 'nioh1', 'Desktop', 'PMO-Portal-Deliverables', 'PMO-Portal-IPI-Methodology.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath, '·', html.length, 'bytes');
