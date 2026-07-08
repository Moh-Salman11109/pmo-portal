// Official IPI Methodology reference — for distribution outside the PMO when
// stakeholders ask "how do you calculate the IPI?". Covers the calculation at
// project, department, and company (portfolio) levels.
// Output: Desktop/PMO-Portal-Deliverables/IPI-Methodology-Tawuniya.{html,pdf}
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Integrated Performance Index — Methodology</title>
<style>
  @font-face { font-family: 'GT Planar'; font-weight: 300;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Light-Trial-BF63bcd77b74df6.otf') format('opentype'); }
  @font-face { font-family: 'GT Planar'; font-weight: 400;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Regular-Trial-BF63bcd9a5c44bb.otf') format('opentype'); }
  @font-face { font-family: 'GT Planar'; font-weight: 500;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Medium-Trial-BF63bcd77600d58.otf') format('opentype'); }
  @font-face { font-family: 'GT Planar'; font-weight: 700;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Bold-Trial-BF63bcd77557486.otf') format('opentype'); }
  @font-face { font-family: 'GT Planar'; font-weight: 900;
    src: url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Black-Trial-BF63bcd77b41460.otf') format('opentype'); }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  :root {
    --canopy:  #003932;
    --canopy-2:#005c4b;
    --sea:     #00FFB3;
    --sea-2:   #00b894;
    --orange:  #FF5000;
    --maroon:  #490300;
    --moss:    #5a7a6e;
    --lichen:  #C9D5C9;
    --lichen-lt: #ecf2ed;
    --ink:     #0d1f1c;
    --muted:   #4b6c67;
    --border:  #d1e8e4;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'GT Planar', 'Inter', sans-serif;
    color: var(--ink);
    background: #1a1a1a;
    line-height: 1.55;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 210mm; min-height: 297mm;
    background: white;
    padding: 18mm 20mm 16mm;
    margin: 8mm auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.35);
    display: flex; flex-direction: column;
  }
  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
    @page { size: A4; margin: 0; }
  }

  /* ── HEADER ── */
  header.doc-header {
    border-top: 4px solid var(--sea);
    background: var(--canopy);
    color: white;
    padding: 14px 18px 13px;
    margin: -18mm -20mm 14px;
    display: flex; align-items: center; justify-content: space-between;
  }
  header.doc-header .brand-block { display: flex; align-items: center; gap: 14px; }
  header.doc-header .logo { height: 36px; width: auto; }
  header.doc-header .org { line-height: 1.2; }
  header.doc-header .org .l { color: var(--sea); font-size: 8.5pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
  header.doc-header .org .n { color: white; font-size: 11pt; font-weight: 700; margin-top: 2px; }
  header.doc-header .meta { text-align: right; line-height: 1.3; }
  header.doc-header .meta .l { color: rgba(255,255,255,0.55); font-size: 7.5pt; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
  header.doc-header .meta .v { color: white; font-size: 9pt; font-weight: 600; }

  /* ── TITLE BLOCK ── */
  .title-block {
    border-bottom: 1px solid var(--border);
    padding-bottom: 16px;
    margin-bottom: 18px;
  }
  .title-block .label {
    color: var(--sea-2);
    font-size: 9pt; font-weight: 700;
    letter-spacing: 1.5px; text-transform: uppercase;
    margin-bottom: 6px;
  }
  .title-block h1 {
    font-size: 22pt; font-weight: 900;
    color: var(--canopy);
    letter-spacing: -0.5px;
    line-height: 1.1;
  }
  .title-block .subtitle {
    font-size: 11pt; color: var(--muted);
    margin-top: 6px; font-weight: 500;
    max-width: 90%;
  }
  .title-block .control {
    margin-top: 14px;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .title-block .control .item .l {
    color: var(--moss); font-size: 7.5pt; font-weight: 700;
    letter-spacing: 0.8px; text-transform: uppercase;
    margin-bottom: 3px;
  }
  .title-block .control .item .v {
    color: var(--canopy); font-size: 9.5pt; font-weight: 600;
    line-height: 1.4;
  }

  /* ── SECTIONS ── */
  section.s {
    margin-bottom: 18px;
  }
  section.s > .s-h {
    display: flex; align-items: baseline; gap: 14px;
    border-bottom: 1px solid var(--lichen);
    padding-bottom: 5px;
    margin-bottom: 11px;
  }
  section.s > .s-h .num {
    color: var(--sea-2);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11pt; font-weight: 700;
  }
  section.s > .s-h h2 {
    font-size: 13pt; font-weight: 700;
    color: var(--canopy);
    letter-spacing: -0.2px;
  }
  section.s p {
    font-size: 10pt; color: var(--ink);
    line-height: 1.6;
    margin-bottom: 7px;
  }
  section.s p strong { color: var(--canopy); font-weight: 700; }

  /* ── FORMULA ── */
  .formula {
    background: var(--lichen-lt);
    border-right: 3px solid var(--canopy);
    border-radius: 0 8px 8px 0;
    padding: 13px 18px;
    margin: 8px 0 10px;
  }
  .formula .main {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5pt; font-weight: 700;
    color: var(--canopy);
    text-align: center;
    padding: 4px 0;
    letter-spacing: 0.3px;
  }
  .formula .main span.coef { color: var(--sea-2); }
  .formula .main span.pen  { color: var(--orange); }
  .formula .legend {
    display: grid; grid-template-columns: 90px 1fr;
    gap: 4px 14px;
    font-size: 9pt;
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px dashed var(--border);
  }
  .formula .legend .k {
    color: var(--canopy); font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }
  .formula .legend .v { color: var(--ink); line-height: 1.55; }

  /* ── COMPONENT GRID ── */
  .components {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin-top: 8px;
  }
  .component {
    background: white;
    border: 1px solid var(--border);
    border-top: 3px solid var(--sea-2);
    border-radius: 4px;
    padding: 10px 12px;
  }
  .component .name {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12pt; font-weight: 700;
    color: var(--canopy);
  }
  .component .weight {
    color: var(--sea-2);
    font-size: 9pt; font-weight: 700;
    margin: 2px 0 6px;
  }
  .component .desc {
    font-size: 8.5pt; color: var(--muted);
    line-height: 1.5;
  }
  .component .desc strong { color: var(--canopy); font-weight: 600; }

  /* ── BANDS ── */
  .bands {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 8px; margin: 8px 0 0;
  }
  .band {
    border: 1px solid var(--border);
    border-top-width: 3px;
    border-radius: 4px;
    padding: 7px 10px; text-align: center;
  }
  .band .l { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; color: var(--muted); font-weight: 600; }
  .band .n { font-size: 9.5pt; font-weight: 700; color: var(--canopy); margin-top: 3px; }
  .band.over { border-top-color: var(--sea-2); }
  .band.on   { border-top-color: var(--sea-2); }
  .band.watch{ border-top-color: #d97706; }
  .band.risk { border-top-color: var(--orange); }

  /* ── TABLE ── */
  table.t {
    width: 100%; border-collapse: collapse;
    margin: 8px 0; font-size: 9.5pt;
  }
  table.t thead th {
    background: var(--canopy); color: white;
    text-align: left;
    padding: 7px 11px;
    font-size: 8.5pt; font-weight: 700;
    letter-spacing: 0.3px;
  }
  table.t thead th.num { text-align: right; }
  table.t thead th:first-child { border-radius: 6px 0 0 0; }
  table.t thead th:last-child  { border-radius: 0 6px 0 0; }
  table.t tbody td {
    padding: 8px 11px;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    line-height: 1.4;
  }
  table.t tbody td.num {
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
  }
  table.t tbody td.label { font-weight: 700; color: var(--canopy); }
  table.t tbody tr:last-child td { border-bottom: 0; }
  table.t tbody tr.total td {
    background: var(--lichen-lt);
    border-top: 2px solid var(--canopy);
    font-weight: 800;
    color: var(--canopy);
  }

  /* ── NOTE / CALLOUT ── */
  .note {
    font-size: 9.5pt; color: var(--muted);
    background: white;
    border-left: 2px solid var(--moss);
    padding: 8px 12px;
    line-height: 1.55; font-style: italic;
    margin: 6px 0;
  }
  .note strong { color: var(--canopy); font-style: normal; }

  /* ── HIERARCHY (3 levels visual) ── */
  .hierarchy {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin: 8px 0 0;
  }
  .level {
    display: grid;
    grid-template-columns: 110px 1fr;
    background: white;
    border: 1px solid var(--border);
    border-right: 4px solid var(--canopy);
    border-radius: 0 6px 6px 0;
    padding: 10px 14px;
  }
  .level .tag {
    font-family: 'JetBrains Mono', monospace;
    color: var(--sea-2);
    font-size: 9pt; font-weight: 700;
    padding-top: 2px;
  }
  .level .body { color: var(--ink); }
  .level .body .h {
    font-size: 10.5pt; font-weight: 700;
    color: var(--canopy);
    margin-bottom: 3px;
  }
  .level .body .d {
    font-size: 9pt; color: var(--muted);
    line-height: 1.5;
  }
  .level .body .d strong { color: var(--canopy); font-weight: 600; }

  /* ── EXAMPLE BOX ── */
  .example {
    background: white;
    border: 1px solid var(--border);
    border-right: 3px solid var(--sea-2);
    border-radius: 0 6px 6px 0;
    padding: 11px 14px;
    margin-top: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9pt;
    line-height: 1.7;
    color: var(--ink);
  }
  .example .h {
    font-family: 'GT Planar', sans-serif;
    font-size: 9.5pt; font-weight: 700;
    color: var(--canopy);
    margin-bottom: 6px;
  }
  .example .row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; }
  .example .row .k { color: var(--canopy-2); font-weight: 700; }
  .example .row .v { color: var(--ink); }
  .example .total {
    margin-top: 6px; padding-top: 6px;
    border-top: 1px dashed var(--border);
    font-weight: 700; color: var(--canopy);
  }
  .example .total .ipi { color: var(--sea-2); font-size: 10.5pt; }

  /* ── FOOTER ── */
  footer.doc-footer {
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    display: flex; justify-content: space-between;
    font-size: 7.5pt; color: var(--muted);
    font-weight: 500;
  }
  footer.doc-footer .b { color: var(--canopy); font-weight: 700; }
</style>
</head>
<body>

<!-- ════════════════════ PAGE 1 ════════════════════ -->
<div class="page">

  <header class="doc-header">
    <div class="brand-block">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org">
        <div class="l">Project Management Office</div>
        <div class="n">Tree Digital Insurance Company</div>
      </div>
    </div>
    <div class="meta">
      <div class="l">Document Reference</div>
      <div class="v">IPI-MTH / 2026-06</div>
    </div>
  </header>

  <div class="title-block">
    <div class="label">Methodology Reference</div>
    <h1>Integrated Performance Index<br>Calculation Methodology</h1>
    <div class="subtitle">The Integrated Performance Index (IPI) is the single composite score used by the PMO to express project, department and company performance. This document defines the calculation at each of the three levels.</div>
    <div class="control">
      <div class="item">
        <div class="l">Audience</div>
        <div class="v">Executive Committee<br>Balanced Scorecard Function</div>
      </div>
      <div class="item">
        <div class="l">Issued by</div>
        <div class="v">Project Management Office<br>Tree Digital Insurance Company</div>
      </div>
      <div class="item">
        <div class="l">Effective</div>
        <div class="v">29 June 2026<br>Classification: Internal</div>
      </div>
    </div>
  </div>

  <!-- 1. OVERVIEW -->
  <section class="s">
    <div class="s-h">
      <span class="num">01</span>
      <h2>The Index in Brief</h2>
    </div>
    <p>The IPI condenses three independent performance dimensions &mdash; <strong>schedule</strong>, <strong>cost</strong> and <strong>artefact compliance</strong> &mdash; into a single 0&ndash;115 score. The schedule dimension carries the heaviest weight because it is the strongest leading indicator of project failure. Cost and artefact compliance are weighted equally at half that.</p>
    <div class="components">
      <div class="component">
        <div class="name">SPI</div>
        <div class="weight">50% weight</div>
        <div class="desc"><strong>Schedule Performance Index.</strong> Earned value against planned value. Detects schedule slippage early.</div>
      </div>
      <div class="component">
        <div class="name">CPI</div>
        <div class="weight">25% weight</div>
        <div class="desc"><strong>Cost Performance Index.</strong> Value delivered per riyal spent. Detects budget over&#8209;runs.</div>
      </div>
      <div class="component">
        <div class="name">MCI</div>
        <div class="weight">25% weight</div>
        <div class="desc"><strong>Artefact Compliance Index.</strong> Approved governance artefacts against required artefacts at the current gate.</div>
      </div>
    </div>
    <div class="note" style="margin-top: 10px;">
      The three levels at which the IPI is computed &mdash; <strong>project</strong>, <strong>department</strong>, and <strong>company</strong> &mdash; share the same core formula but differ in how they aggregate. The project level computes the raw index from raw data; department and company levels are weighted averages of the underlying project scores.
    </div>
  </section>

  <!-- 2. PROJECT-LEVEL CALCULATION -->
  <section class="s">
    <div class="s-h">
      <span class="num">02</span>
      <h2>Project&#8209;level Calculation</h2>
    </div>
    <p>The IPI of a single project is computed directly from its schedule, financial and document data. The formula is:</p>

    <div class="formula">
      <div class="main">
        IPI<sub>project</sub> &nbsp;=&nbsp; <span class="coef">0.50</span> &times; (SPI &times; <span class="pen">Penalty</span>) &nbsp;+&nbsp; <span class="coef">0.25</span> &times; CPI &nbsp;+&nbsp; <span class="coef">0.25</span> &times; MCI
      </div>
      <div class="legend">
        <div class="k">SPI</div>
        <div class="v">= Earned Value &divide; Planned Value, capped at 1.20. Earned Value is the WBS&#8209;weighted actual progress; Planned Value is the same calculation against linearly&#8209;interpolated planned progress at the measurement date.</div>
        <div class="k">Penalty</div>
        <div class="v">= max(0, 1 &minus; days_past_roadmap &divide; 100). A 1% linear decay per day past the roadmap deadline, bounded at zero. Applied to SPI only.</div>
        <div class="k">CPI</div>
        <div class="v">= (Progress &times; Budget) &divide; Actual Cost, capped at 1.20. A CPI of 1.00 means the project is delivering one riyal of planned value for every riyal spent.</div>
        <div class="k">MCI</div>
        <div class="v">= approved required documents &divide; total required documents, evaluated at the project's current gate. Documents whose required gate is in the future are excluded.</div>
      </div>
    </div>

    <p style="margin-top: 4px;"><strong>Caps.</strong> SPI and CPI are each individually capped at 1.20 so that a single sandbagged plan or a single early completion cannot inflate the rollup. A project that exceeds plan on every dimension can therefore reach a maximum IPI of 115.</p>

    <p><strong>Null handling.</strong> When a component cannot be computed (no schedule, no budget, no documents), it is treated as a neutral 1.00 in the weighted sum. When <em>all three</em> components are absent, the project IPI is reported as <strong>null</strong>, classified as &laquo;Pending Plan&raquo;, and excluded from rollups. This prevents under&#8209;invested projects from artificially deflating departmental and company averages.</p>

    <div class="bands">
      <div class="band over"><div class="l">&gt; 100</div><div class="n">Over Achieved</div></div>
      <div class="band on"><div class="l">= 100</div><div class="n">On Track</div></div>
      <div class="band watch"><div class="l">90 &ndash; 99</div><div class="n">Watch</div></div>
      <div class="band risk"><div class="l">&lt; 90</div><div class="n">At Risk</div></div>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">Tree Digital Insurance Company</span> &mdash; Project Management Office</span>
    <span>IPI Methodology &mdash; page 1 of 3</span>
  </footer>
</div>

<!-- ════════════════════ PAGE 2 — ROADMAP PENALTY DETAIL ════════════════════ -->
<div class="page">

  <header class="doc-header">
    <div class="brand-block">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org">
        <div class="l">Project Management Office</div>
        <div class="n">Tree Digital Insurance Company</div>
      </div>
    </div>
    <div class="meta">
      <div class="l">Document Reference</div>
      <div class="v">IPI-MTH / 2026-06</div>
    </div>
  </header>

  <!-- 2b. THE ROADMAP PENALTY -->
  <section class="s">
    <div class="s-h">
      <span class="num">02b</span>
      <h2>The Roadmap Penalty in Detail</h2>
    </div>
    <p>The roadmap penalty is a multiplicative factor applied only to SPI when a project breaches its <strong>roadmap deadline</strong> &mdash; a stricter, externally committed end date that sits independently from the project's planned end date. The two dates are intentionally distinct: the planned end is the team's internal commitment; the roadmap deadline is the commitment made to leadership or to the regulator.</p>

    <div class="formula">
      <div class="main">
        Penalty &nbsp;=&nbsp; max(0, &nbsp; 1 &nbsp;&minus;&nbsp; days_overdue &divide; 100)
      </div>
      <div class="legend">
        <div class="k">days_overdue</div>
        <div class="v">= the integer number of whole days between the roadmap deadline and the <strong>measurement date</strong> (see table below). When the measurement date is on or before the roadmap deadline, days_overdue is treated as zero and the penalty is 1.00.</div>
        <div class="k">100</div>
        <div class="v">= the decay window. The penalty reaches 0.00 after 100 days overdue, at which point the SPI contribution is wiped out completely. The penalty is bounded at zero &mdash; it cannot become negative.</div>
      </div>
    </div>

    <p style="margin-top: 4px;"><strong>The measurement date</strong> depends on whether the project is still in progress or has been completed:</p>

    <table class="t">
      <thead>
        <tr>
          <th>Project state</th>
          <th>Measurement date used</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="label">In progress</td>
          <td>Today (the as&#8209;of date)</td>
          <td>The penalty grows day by day as long as the project remains incomplete past its roadmap.</td>
        </tr>
        <tr>
          <td class="label">Completed</td>
          <td>The actual finish date (or, if not recorded, the date of the last project update)</td>
          <td>The penalty freezes at the moment of completion. Late delivery is permanently reflected; subsequent days do not increase the penalty further.</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top: 6px;"><strong>When the penalty does <em>not</em> apply:</strong></p>
    <ul style="font-size: 10pt; line-height: 1.6; color: var(--ink); margin: 4px 0 8px 18px;">
      <li>The project has no roadmap deadline set &mdash; penalty defaults to 1.00 (neutral).</li>
      <li>The measurement date is on or before the roadmap deadline &mdash; penalty = 1.00.</li>
      <li>The penalty <em>only</em> multiplies SPI; CPI and MCI are unaffected.</li>
    </ul>

    <p><strong>Worked examples.</strong> The table below shows how the penalty erodes SPI for a project with raw SPI of 1.000. Note that the penalty is capped at zero &mdash; further days beyond 100 do not reduce SPI further.</p>

    <table class="t">
      <thead>
        <tr>
          <th>Days past roadmap</th>
          <th class="num">Penalty</th>
          <th class="num">SPI &times; Penalty</th>
          <th class="num">IPI (CPI, MCI neutral)</th>
          <th>Status band</th>
        </tr>
      </thead>
      <tbody>
        <tr><td class="label">0 days</td>     <td class="num">1.00</td><td class="num">1.000</td><td class="num">100</td><td>On Track</td></tr>
        <tr><td class="label">10 days</td>    <td class="num">0.90</td><td class="num">0.900</td><td class="num">95</td> <td>Watch</td></tr>
        <tr><td class="label">25 days</td>    <td class="num">0.75</td><td class="num">0.750</td><td class="num">88</td> <td>At Risk</td></tr>
        <tr><td class="label">36 days</td>    <td class="num">0.64</td><td class="num">0.640</td><td class="num">82</td> <td>At Risk</td></tr>
        <tr><td class="label">50 days</td>    <td class="num">0.50</td><td class="num">0.500</td><td class="num">75</td> <td>At Risk</td></tr>
        <tr><td class="label">75 days</td>    <td class="num">0.25</td><td class="num">0.250</td><td class="num">63</td> <td>At Risk</td></tr>
        <tr><td class="label">100+ days</td>  <td class="num">0.00</td><td class="num">0.000</td><td class="num">50</td> <td>At Risk (floor)</td></tr>
      </tbody>
    </table>

    <div class="note" style="margin-top: 6px;">
      <strong>The 50 floor.</strong> When the penalty zeroes SPI entirely, the project's IPI floor is 50 &mdash; the contribution from CPI and MCI at their neutral 1.00 values (0.25 + 0.25 = 0.50, rounded to 50). A more&#8209;than&#8209;100&#8209;days&#8209;late project with weak cost and document performance can score below 50.
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">Tree Digital Insurance Company</span> &mdash; Project Management Office</span>
    <span>IPI Methodology &mdash; page 2 of 3</span>
  </footer>
</div>

<!-- ════════════════════ PAGE 2 ════════════════════ -->
<div class="page">

  <header class="doc-header">
    <div class="brand-block">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org">
        <div class="l">Project Management Office</div>
        <div class="n">Tree Digital Insurance Company</div>
      </div>
    </div>
    <div class="meta">
      <div class="l">Document Reference</div>
      <div class="v">IPI-MTH / 2026-06</div>
    </div>
  </header>

  <!-- 3. DEPARTMENT-LEVEL ROLLUP -->
  <section class="s">
    <div class="s-h">
      <span class="num">03</span>
      <h2>Department&#8209;level Rollup</h2>
    </div>
    <p>The Department IPI is the <strong>budget&nbsp;&times;&nbsp;priority weighted average</strong> of the IPIs of the projects in that department. Projects with a null IPI are excluded from both the numerator and the denominator.</p>

    <div class="formula">
      <div class="main">
        IPI<sub>dept</sub> &nbsp;=&nbsp; &Sigma; (IPI<sub>p</sub> &times; W<sub>p</sub>) &nbsp;&divide;&nbsp; &Sigma; W<sub>p</sub>
      </div>
      <div class="legend">
        <div class="k">IPI<sub>p</sub></div>
        <div class="v">= the project&#8209;level IPI from Section 02 for each non&#8209;archived project p in the department.</div>
        <div class="k">W<sub>p</sub></div>
        <div class="v">= project weight &nbsp;=&nbsp; Budget<sub>p</sub> &times; PriorityMultiplier<sub>p</sub>. When Budget is zero, the priority multiplier is used alone.</div>
      </div>
    </div>

    <p style="margin-top: 4px;"><strong>Priority multipliers.</strong> The priority of a project compounds with its budget so that a Critical&#8209;priority programme drives the department score more strongly than a Low&#8209;priority pilot of the same size.</p>

    <table class="t">
      <thead>
        <tr>
          <th>Priority</th>
          <th class="num">Multiplier</th>
          <th>Typical use</th>
        </tr>
      </thead>
      <tbody>
        <tr><td class="label">Critical</td><td class="num">4</td><td>Regulatory mandates, board commitments, business&#8209;critical transformation</td></tr>
        <tr><td class="label">High</td>    <td class="num">3</td><td>Material strategic initiatives, customer&#8209;facing launches</td></tr>
        <tr><td class="label">Medium</td>  <td class="num">2</td><td>Operational improvements, internal&#8209;facing projects (default)</td></tr>
        <tr><td class="label">Low</td>     <td class="num">1</td><td>Discretionary work, pilots, exploratory studies</td></tr>
      </tbody>
    </table>

    <p><strong>Worked example.</strong> A department with three measurable projects:</p>

    <table class="t">
      <thead>
        <tr>
          <th>Project</th>
          <th>Priority</th>
          <th class="num">Budget (SAR)</th>
          <th class="num">W = B &times; M</th>
          <th class="num">IPI</th>
          <th class="num">IPI &times; W</th>
        </tr>
      </thead>
      <tbody>
        <tr><td class="label">Alpha</td>  <td>Critical</td><td class="num">50,000,000</td><td class="num">200,000,000</td><td class="num">95</td>  <td class="num">19,000,000,000</td></tr>
        <tr><td class="label">Beta</td>   <td>High</td>    <td class="num">20,000,000</td><td class="num">60,000,000</td> <td class="num">82</td>  <td class="num">4,920,000,000</td></tr>
        <tr><td class="label">Gamma</td>  <td>Medium</td>  <td class="num">5,000,000</td> <td class="num">10,000,000</td> <td class="num">70</td>  <td class="num">700,000,000</td></tr>
        <tr class="total">
          <td colspan="3">Totals</td>
          <td class="num">270,000,000</td>
          <td>&nbsp;</td>
          <td class="num">24,620,000,000</td>
        </tr>
      </tbody>
    </table>

    <div class="example">
      <div class="h">Department IPI:</div>
      <div class="row"><span class="k">&Sigma;(IPI&times;W)</span><span class="v">&divide; &Sigma;W &nbsp;= &nbsp; 24,620,000,000 &divide; 270,000,000</span></div>
      <div class="total">&rarr; Department IPI &nbsp;=&nbsp; <span class="ipi">91</span> &nbsp;(Watch)</div>
    </div>

    <div class="note" style="margin-top: 8px;">
      Note how Alpha &mdash; Critical&#8209;priority and largest budget &mdash; carries a project weight of 200&thinsp;million and dominates the rollup. A 5&#8209;point swing on Alpha would move the department score more than a 20&#8209;point swing on Gamma.
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">Tree Digital Insurance Company</span> &mdash; Project Management Office</span>
    <span>IPI Methodology &mdash; page 3 of 3</span>
  </footer>
</div>

<!-- ════════════════════ PAGE 4 ════════════════════ -->
<div class="page">

  <header class="doc-header">
    <div class="brand-block">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org">
        <div class="l">Project Management Office</div>
        <div class="n">Tree Digital Insurance Company</div>
      </div>
    </div>
    <div class="meta">
      <div class="l">Document Reference</div>
      <div class="v">IPI-MTH / 2026-06</div>
    </div>
  </header>

  <!-- 4. COMPANY-LEVEL ROLLUP -->
  <section class="s">
    <div class="s-h">
      <span class="num">04</span>
      <h2>Company&#8209;level (Portfolio) Rollup</h2>
    </div>
    <p>The Company IPI is computed using the same weighted&#8209;average formula as the department rollup, but the set of projects is the <strong>entire active portfolio</strong> rather than a single department.</p>

    <div class="formula">
      <div class="main">
        IPI<sub>company</sub> &nbsp;=&nbsp; &Sigma; (IPI<sub>p</sub> &times; W<sub>p</sub>) &nbsp;&divide;&nbsp; &Sigma; W<sub>p</sub> &nbsp;&nbsp;&nbsp; <span style="font-family: 'GT Planar'; font-size: 9pt; color: var(--muted); font-weight: 500;">for all active p</span>
      </div>
      <div class="legend">
        <div class="k">Scope</div>
        <div class="v">all non&#8209;archived projects across every department. Projects with null IPI are excluded.</div>
        <div class="k">W<sub>p</sub></div>
        <div class="v">= Budget<sub>p</sub> &times; PriorityMultiplier<sub>p</sub> &mdash; identical to the department rollup.</div>
      </div>
    </div>

    <p><strong>Equivalence.</strong> Because the company IPI is computed directly from project weights (and not from a second average of department averages), it is mathematically identical to a single department&#8209;level calculation taken across the full portfolio. Small departments do not gain disproportionate weight in the company score.</p>

    <p><strong>Today versus historical.</strong> The company IPI displayed on the Home dashboard is computed from each project's <em>current</em> snapshot IPI. When the system needs to compare against a past date &mdash; for instance, the &laquo;vs last month&raquo; trend indicator &mdash; each project's IPI on that past date is reconstructed using its time&#8209;weighted IPI history, then the same weighted average is applied.</p>
  </section>

  <footer class="doc-footer">
    <span><span class="b">Tree Digital Insurance Company</span> &mdash; Project Management Office</span>
    <span>IPI Methodology &mdash; page 3 of 3</span>
  </footer>
</div>

</body>
</html>`;

const outHtml = path.join('C:', 'Users', 'nioh1', 'Desktop', 'PMO-Portal-Deliverables', 'IPI-Methodology-Tawuniya.html');
fs.writeFileSync(outHtml, html, 'utf8');
console.log('Wrote HTML:', outHtml, '·', html.length, 'bytes');
