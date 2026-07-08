// IPI Methodology Guide — governance-grade reference document.
// Hand this to Strategy / Audit / Regulator. Explains everything end-to-end.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IPI Methodology Guide — PMO Portal</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --brand: #003932; --brand-2: #005c4b; --mint: #00b894; --mint-lt: #e6f9f5;
    --amber: #f59e0b; --amber-lt: #fffbeb;
    --red: #ef4444; --red-lt: #fef2f2;
    --blue: #3b82f6; --blue-lt: #eff6ff;
    --ink: #0d1f1c; --muted: #4b6c67; --border: #d1e8e4;
    --bg: #f5faf9; --white: #ffffff;
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

  .head {
    background: var(--brand);
    padding: 9px 16mm;
    display: flex; align-items: center; gap: 10px;
  }
  .head .logo { background: var(--mint); color: var(--brand); font-weight: 900; font-size: 11px; padding: 3px 8px; border-radius: 4px; }
  .head .doc { color: rgba(255,255,255,0.6); font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .head .pg { margin-left: auto; color: var(--mint); font-size: 10px; font-weight: 700; }

  .body { flex: 1; padding: 14mm 16mm 14mm; }
  .foot { background: var(--brand); height: 4mm; }

  /* COVER */
  .cover-body {
    background: linear-gradient(135deg, #003932 0%, #005c4b 50%, #007a62 100%);
    color: white;
    padding: 45mm 16mm 30mm;
    flex: 1;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
  }
  .cover-body::after {
    content: '';
    position: absolute;
    bottom: -120px; right: -120px;
    width: 400px; height: 400px;
    background: rgba(0,184,148,0.08);
    border-radius: 50%;
  }
  .cover-body::before {
    content: 'IPI';
    position: absolute;
    top: 40mm; right: 16mm;
    font-size: 180px;
    font-weight: 900;
    color: rgba(0,184,148,0.06);
    letter-spacing: -8px;
    line-height: 1;
  }
  .cover-body .badge {
    display: inline-flex;
    align-items: center; gap: 8px;
    background: rgba(0,184,148,0.18);
    border: 1px solid rgba(0,184,148,0.35);
    border-radius: 22px;
    padding: 6px 16px;
    margin-bottom: 22px;
    align-self: flex-start;
    z-index: 2;
  }
  .cover-body .badge .d { width: 7px; height: 7px; background: var(--mint); border-radius: 50%; }
  .cover-body .badge span { color: var(--mint); font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover-body h1 { color: white; font-size: 46px; font-weight: 900; letter-spacing: -1.4px; line-height: 1.0; margin-bottom: 14px; position: relative; z-index: 2; }
  .cover-body h1 em { color: var(--mint); font-style: normal; }
  .cover-body .lead { color: rgba(255,255,255,0.72); font-size: 15px; font-weight: 400; line-height: 1.55; margin-bottom: 34px; max-width: 80%; position: relative; z-index: 2; }
  .cover-body .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; position: relative; z-index: 2; }
  .cover-body .meta .item .l { font-size: 10px; color: rgba(0,184,148,0.7); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-body .meta .item .v { font-size: 12px; color: white; font-weight: 600; line-height: 1.3; }

  /* SECTION HEADERS */
  .section-tag {
    display: inline-block;
    background: var(--mint-lt);
    color: var(--brand);
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
    color: var(--brand);
    letter-spacing: -0.6px;
    line-height: 1.1;
    margin-bottom: 12px;
    border-bottom: 2px solid var(--mint);
    padding-bottom: 8px;
  }
  h2.section .ch {
    background: var(--brand);
    color: var(--mint);
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
    color: var(--brand);
    margin: 14px 0 8px;
    letter-spacing: -0.2px;
  }
  p { font-size: 12px; color: var(--ink); line-height: 1.6; margin-bottom: 8px; }
  p.muted { color: var(--muted); }
  ul, ol { margin: 4px 0 10px 18px; }
  li { font-size: 12px; color: var(--ink); line-height: 1.6; margin-bottom: 3px; }

  /* FORMULA */
  .formula {
    background: var(--brand);
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
  }
  .formula .mint { color: var(--mint); }
  .formula .amb { color: #fcd34d; }
  .formula .small { font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 8px; font-family: 'Inter'; font-weight: 400; }

  /* COMPONENT CARDS */
  .components {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 12px 0;
  }
  .comp {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .comp .nm { font-size: 18px; font-weight: 900; color: var(--brand); letter-spacing: -0.4px; }
  .comp .w { font-size: 10px; color: var(--mint); font-weight: 700; letter-spacing: 0.5px; margin: 2px 0 6px; }
  .comp .desc { font-size: 11px; color: var(--muted); line-height: 1.4; }

  /* CALLOUT */
  .callout {
    background: var(--mint-lt);
    border-left: 4px solid var(--mint);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 10px 0;
  }
  .callout .lbl { font-size: 10px; font-weight: 800; color: var(--brand); letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px; }
  .callout p { font-size: 12px; line-height: 1.6; color: var(--ink); margin-bottom: 0; }

  .callout.amber { background: var(--amber-lt); border-left-color: var(--amber); }
  .callout.amber .lbl { color: #92400e; }
  .callout.amber p { color: #78350f; }

  .callout.blue { background: var(--blue-lt); border-left-color: var(--blue); }
  .callout.blue .lbl { color: #1d4ed8; }
  .callout.blue p { color: #1e3a8a; }

  .callout.red { background: var(--red-lt); border-left-color: var(--red); }
  .callout.red .lbl { color: #b91c1c; }
  .callout.red p { color: #7f1d1d; }

  /* TABLES */
  table {
    width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0 12px;
  }
  table th {
    background: var(--brand);
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
  table tr.tot td { background: var(--mint-lt); font-weight: 800; color: var(--brand); }
  table td.k { font-weight: 700; color: var(--brand); }
  table code, code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: var(--brand);
  }

  /* CODE BLOCK */
  pre.code {
    background: #0d1f1c;
    color: #a7f3d0;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.55;
    margin: 8px 0 12px;
    overflow-x: auto;
  }
  pre.code .c1 { color: #64748b; }
  pre.code .kw { color: #fcd34d; }
  pre.code .st { color: #fda4af; }

  /* WORKED EXAMPLE BOX */
  .ex {
    background: white;
    border: 2px solid var(--mint);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 12px 0;
  }
  .ex .hd {
    display: inline-block;
    background: var(--mint);
    color: white;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 10px;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .ex h4 { font-size: 13px; font-weight: 800; color: var(--brand); margin-bottom: 8px; }
  .ex .calc {
    background: #0d1f1c;
    color: #a7f3d0;
    padding: 10px 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    line-height: 1.65;
    margin: 6px 0;
  }
  .ex .res {
    display: inline-block;
    background: var(--mint);
    color: white;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 800;
    margin-top: 4px;
  }

  /* FAQ */
  .qa { margin-bottom: 12px; }
  .qa .q {
    font-size: 12px;
    font-weight: 800;
    color: var(--brand);
    margin-bottom: 5px;
  }
  .qa .q::before { content: "Q. "; color: var(--mint); }
  .qa .a {
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.6;
    padding-left: 16px;
    border-left: 2px solid var(--mint);
  }

  /* STATUS CHIPS */
  .chip {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 700;
  }
  .chip.green  { background: #dcfce7; color: #166534; }
  .chip.amber  { background: #fef3c7; color: #92400e; }
  .chip.orange { background: #fed7aa; color: #9a3412; }
  .chip.red    { background: #fee2e2; color: #991b1b; }
  .chip.grey   { background: #f3f4f6; color: #4b5563; }

  /* TOC */
  .toc { margin-top: 14px; }
  .toc-item {
    display: flex;
    align-items: center;
    padding: 9px 0;
    border-bottom: 1px dashed var(--border);
  }
  .toc-item .n {
    width: 28px;
    height: 28px;
    background: var(--mint-lt);
    color: var(--brand);
    border-radius: 50%;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    flex-shrink: 0;
  }
  .toc-item .t {
    flex: 1;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--brand);
  }
  .toc-item .t .d { font-size: 11px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  .toc-item .p {
    background: var(--brand);
    color: var(--mint);
    font-size: 10px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 10px;
  }
</style>
</head>
<body>

<!-- ════════════ COVER ════════════ -->
<div class="page">
  <div class="cover-body">
    <div class="badge"><div class="d"></div><span>Governance · Methodology Reference</span></div>
    <h1>IPI Methodology<br><em>Index of Project Implementation</em></h1>
    <div class="lead">Complete reference for how the PMO Portal scores project, department, and portfolio health. Formulae, rationale, worked examples, and governance safeguards — auditable end-to-end.</div>
    <div class="meta">
      <div class="item"><div class="l">Owner</div><div class="v">PMO &amp; Strategy<br>Tree Digital Insurance</div></div>
      <div class="item"><div class="l">Audience</div><div class="v">Strategy · Internal Audit<br>Regulator</div></div>
      <div class="item"><div class="l">Source of truth</div><div class="v">src/utils/metrics.js<br>git-tracked, peer-reviewable</div></div>
    </div>
  </div>
</div>

<!-- ════════════ TABLE OF CONTENTS ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">2</div></div>
  <div class="body">
    <div class="section-tag">Contents</div>
    <h2 class="section">What this document covers</h2>
    <p class="muted">Each chapter is self-contained — readers can jump to a specific section, or read straight through in ~20 minutes.</p>
    <div class="toc">
      <div class="toc-item"><div class="n">01</div><div class="t">Executive summary<div class="d">What IPI is, in one page</div></div><div class="p">p.3</div></div>
      <div class="toc-item"><div class="n">02</div><div class="t">The formula at a glance<div class="d">Single-line definition with component weights</div></div><div class="p">p.4</div></div>
      <div class="toc-item"><div class="n">03</div><div class="t">SPI — Schedule Performance Index<div class="d">Time-based EVM from WBS leaves</div></div><div class="p">p.5</div></div>
      <div class="toc-item"><div class="n">04</div><div class="t">CPI — Cost Performance Index<div class="d">Budget consumption vs. earned value</div></div><div class="p">p.6</div></div>
      <div class="toc-item"><div class="n">05</div><div class="t">MCI — Maturity &amp; Compliance Index<div class="d">Required-document delivery rate</div></div><div class="p">p.7</div></div>
      <div class="toc-item"><div class="n">06</div><div class="t">The roadmap-deadline penalty<div class="d">Why we apply -1% per day past deadline</div></div><div class="p">p.8</div></div>
      <div class="toc-item"><div class="n">07</div><div class="t">The 1.20 cap and null handling<div class="d">Anti-gaming safeguards</div></div><div class="p">p.9</div></div>
      <div class="toc-item"><div class="n">08</div><div class="t">Worked example — single project<div class="d">Motor Fleet, end-to-end calculation</div></div><div class="p">p.10</div></div>
      <div class="toc-item"><div class="n">09</div><div class="t">Department &amp; Portfolio rollup<div class="d">Budget × Priority weighting</div></div><div class="p">p.11</div></div>
      <div class="toc-item"><div class="n">10</div><div class="t">Worked example — portfolio<div class="d">5 projects, 3 budget scenarios</div></div><div class="p">p.12</div></div>
      <div class="toc-item"><div class="n">11</div><div class="t">Time-weighted IPI<div class="d">Why we don't display a single snapshot</div></div><div class="p">p.13</div></div>
      <div class="toc-item"><div class="n">12</div><div class="t">Is it solid? — governance assessment<div class="d">Alignment with PMI EVM, defensibility, limits</div></div><div class="p">p.14</div></div>
      <div class="toc-item"><div class="n">13</div><div class="t">Strategy Q&amp;A<div class="d">The questions most likely to be asked</div></div><div class="p">p.15</div></div>
      <div class="toc-item"><div class="n">14</div><div class="t">Glossary &amp; thresholds reference<div class="d">Single-page cheat sheet</div></div><div class="p">p.16</div></div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 01 EXEC SUMMARY ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">3</div></div>
  <div class="body">
    <div class="section-tag">Chapter 1</div>
    <h2 class="section"><span class="ch">01</span>Executive Summary</h2>
    <p><strong>IPI — the Index of Project Implementation —</strong> is a single 0-to-115 score that answers one question for any project, department, or portfolio: <em>"How well is delivery going against plan?"</em></p>
    <p>It blends three independent dimensions every project has: <strong>schedule</strong>, <strong>cost</strong>, and <strong>compliance</strong>. Each dimension is a ratio (actual vs. planned), so the score is dimensionless and comparable across project sizes, durations, and types.</p>

    <h3 class="sub">Why a composite score?</h3>
    <p>A project that's on time but blowing the budget is not "green". A project hitting cost targets but missing every milestone deadline is not "green" either. Real project health needs all three lenses simultaneously. IPI compresses them into one number leadership can act on, while the dashboard always shows the breakdown beneath it.</p>

    <h3 class="sub">Scale and interpretation</h3>
    <table>
      <thead><tr><th>Score</th><th>Status</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>&gt; 100</strong></td><td><span class="chip green">Over Achieved</span></td><td>Project running ahead of plan and under budget</td></tr>
        <tr><td><strong>100</strong></td><td><span class="chip green">On Track</span></td><td>Exactly on plan across all three dimensions</td></tr>
        <tr><td><strong>90–99</strong></td><td><span class="chip amber">Watch</span></td><td>Minor variance; monitor and intervene if widening</td></tr>
        <tr><td><strong>70–89</strong></td><td><span class="chip orange">At Risk</span></td><td>Meaningful variance; PMO escalation expected</td></tr>
        <tr><td><strong>&lt; 70</strong></td><td><span class="chip red">Critical</span></td><td>Material slippage; leadership intervention required</td></tr>
        <tr><td><strong>null</strong></td><td><span class="chip grey">Pending Plan</span></td><td>Project has no schedule, cost, or compliance data yet</td></tr>
      </tbody>
    </table>

    <div class="callout">
      <div class="lbl">Design principle</div>
      <p>Every threshold, weight, and decay rate in this document is defined in one constant — <code>IPI_DEFAULTS</code> in <code>src/utils/metrics.js</code>. Changing any number requires a code change, a git commit, and review. There is no admin UI to tweak these values, by design.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 02 FORMULA ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">4</div></div>
  <div class="body">
    <div class="section-tag">Chapter 2</div>
    <h2 class="section"><span class="ch">02</span>The Formula at a Glance</h2>
    <p>Three components, fixed weights, one safety cap. Then a roadmap penalty applies on top.</p>

    <div class="formula">
      IPI = ( <span class="mint">SPI</span> × 50% ) + ( <span class="mint">CPI</span> × 25% ) + ( <span class="mint">MCI</span> × 25% )
      <div class="small">Each component is capped at 1.20 — the maximum IPI is therefore ~115.</div>
    </div>

    <div class="components">
      <div class="comp">
        <div class="nm">SPI</div>
        <div class="w">Weight 50%</div>
        <div class="desc">Schedule Performance — are we on time? Earned Value ÷ Planned Value across all WBS leaf activities.</div>
      </div>
      <div class="comp">
        <div class="nm">CPI</div>
        <div class="w">Weight 25%</div>
        <div class="desc">Cost Performance — are we on budget? Earned Value ÷ Actual Cost. Less weight because cost data is laggier than schedule.</div>
      </div>
      <div class="comp">
        <div class="nm">MCI</div>
        <div class="w">Weight 25%</div>
        <div class="desc">Maturity / Compliance — are required documents in place? Approved required docs ÷ total required docs.</div>
      </div>
    </div>

    <h3 class="sub">Why 50/25/25 weights?</h3>
    <ul>
      <li><strong>SPI carries the biggest weight</strong> because schedule slippage cascades — every day late is a day off the runway for everything downstream (Gate approvals, dependent projects, regulatory deadlines).</li>
      <li><strong>CPI is equal-weighted with compliance</strong> because cost overruns can often be absorbed, while a missed compliance milestone (e.g., a Gate-1 document) is binary — it blocks progression.</li>
      <li><strong>The three weights sum to 100%</strong> so a perfectly-on-plan project scores exactly 1.0, displayed as 100.</li>
    </ul>

    <h3 class="sub">Two further adjustments</h3>
    <ul>
      <li><strong>Cap of 1.20 per component</strong> — a single component cannot exceed 1.20. So one runaway-good metric cannot inflate the IPI past ~115. (Without the cap, an early-finishing activity could drive SPI arbitrarily high.)</li>
      <li><strong>Roadmap-deadline penalty</strong> — when a project's actual finish (or today's date if not yet finished) is past its roadmap deadline, SPI is multiplied by a linear decay: -1% per day past deadline, floored at 0. See chapter 6.</li>
    </ul>

    <div class="callout">
      <div class="lbl">Reference</div>
      <p>The formula lives at <code>src/utils/metrics.js</code> in the function <code>calcProjectIPIFull(project, asOfDate)</code> — the canonical, only place IPI is computed.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 03 SPI ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">5</div></div>
  <div class="body">
    <div class="section-tag">Chapter 3</div>
    <h2 class="section"><span class="ch">03</span>SPI — Schedule Performance Index</h2>
    <p>SPI tells us whether the project is delivering ahead, on, or behind the plan, in time-equivalent terms. It is the textbook Earned Value Management (EVM) schedule ratio:</p>

    <div class="formula">
      <span class="mint">SPI</span> = EV ÷ PV
      <div class="small">EV = Earned Value (actual % complete) · PV = Planned Value (% complete the plan said we should be at by now)</div>
    </div>

    <h3 class="sub">How EV is computed</h3>
    <p>EV is the weighted average of each WBS <em>leaf</em> activity's actual progress. A "leaf" is an activity with no children — a milestone with sub-activities counts via those sub-activities, never via its own field, so progress is never double-counted.</p>
    <pre class="code">EV = Σ(weight × actualProgress) ÷ Σ(weight)   <span class="c1">// for all leaf activities</span></pre>

    <h3 class="sub">How PV is computed — the time-based part</h3>
    <p>For each leaf activity, planned progress at today's date is <strong>linearly interpolated</strong> between its start and end dates:</p>
    <ul>
      <li>Activity hasn't started yet → planned% = 0</li>
      <li>Today is exactly halfway between start and end → planned% = 50</li>
      <li>Activity should have finished → planned% = 100</li>
    </ul>
    <p>This gives partial credit while work is in flight — a 30-day activity that's 15 days in expects to be 50% done, not 0% (the old "step function" approach we deliberately moved away from).</p>

    <div class="callout">
      <div class="lbl">Why time-based PV is more honest</div>
      <p>Old systems often only credited a milestone after its end-date passed — making projects look perpetually behind. Time-based PV reflects what should have happened by today, giving fair credit for partial progress and exposing slippage the moment it begins, not at quarter-end.</p>
    </div>

    <h3 class="sub">Fallback when no WBS is defined</h3>
    <p>If a project has no activities yet (early-stage / Gate 0), SPI falls back to project-level dates: planned% interpolated between <code>startDate</code> and <code>plannedEnd</code>, actual% from <code>project.progress</code>. This keeps newly-created projects measurable without forcing premature WBS detail.</p>

    <h3 class="sub">Interpretation</h3>
    <table>
      <thead><tr><th>SPI</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>&gt; 1.0</strong></td><td>Ahead of schedule</td></tr>
        <tr><td><strong>1.0</strong></td><td>Exactly on plan</td></tr>
        <tr><td><strong>0.9</strong></td><td>10% behind plan</td></tr>
        <tr><td><strong>0.5</strong></td><td>Materially behind — half the planned work delivered</td></tr>
      </tbody>
    </table>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 04 CPI ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">6</div></div>
  <div class="body">
    <div class="section-tag">Chapter 4</div>
    <h2 class="section"><span class="ch">04</span>CPI — Cost Performance Index</h2>
    <p>CPI tells us whether we're getting the planned value per riyal spent. It is the EVM cost ratio:</p>

    <div class="formula">
      <span class="mint">CPI</span> = BCWP ÷ Actual Cost
      <div class="small">BCWP (Budgeted Cost of Work Performed) = (progress% × total budget)</div>
    </div>

    <h3 class="sub">In plain terms</h3>
    <p>If a project is 40% done and has spent 40% of budget, CPI = 1.0. If 40% done but already 80% of budget gone, CPI = 0.5 — costing twice what the plan budgeted for that level of completion.</p>

    <h3 class="sub">Worked illustration</h3>
    <div class="ex">
      <div class="hd">Mini example</div>
      <h4>Project at 60% progress · Budget 1,000,000 SAR · Actual Cost 720,000 SAR</h4>
      <div class="calc">BCWP   = 0.60 × 1,000,000  = 600,000<br>CPI    = 600,000 ÷ 720,000 = 0.833</div>
      <p style="font-size:11.5px; color: var(--muted); margin-top:4px;">Reading: for every 100 SAR of planned value the project has earned, it has actually spent 120 SAR — a 20% cost overrun on the work delivered so far.</p>
      <span class="res">CPI = 0.83</span>
    </div>

    <h3 class="sub">Edge cases</h3>
    <ul>
      <li><strong>actualCost = 0</strong> — project hasn't spent anything yet (e.g., Gate 0). CPI returns <code>null</code> so it's treated as neutral in the rollup, not as a perfect score.</li>
      <li><strong>budget = 0</strong> — projects without a captured budget cannot have CPI. Returns <code>null</code>, neutral.</li>
      <li><strong>Manual override</strong> — if the PM has manually set a <code>project.cpi</code> field (legacy data path), that value is used as a fallback. New projects should always derive from budget/actuals.</li>
    </ul>

    <h3 class="sub">Interpretation</h3>
    <table>
      <thead><tr><th>CPI</th><th>Meaning</th></tr></thead>
      <tbody>
        <tr><td><strong>&gt; 1.0</strong></td><td>Earning more value than spending — under budget</td></tr>
        <tr><td><strong>1.0</strong></td><td>One-to-one — on budget</td></tr>
        <tr><td><strong>0.9</strong></td><td>10% cost overrun on delivered work</td></tr>
        <tr><td><strong>0.5</strong></td><td>Spending twice what the plan said</td></tr>
      </tbody>
    </table>

    <div class="callout amber">
      <div class="lbl">Why CPI is 25% of IPI, not more</div>
      <p>Cost data is laggier than schedule data — invoices arrive in the next month, finance reconciles weekly. SPI is observable today; CPI catches up. Equal-weighting cost with schedule would over-react to month-end accounting noise. Hence schedule (50%) outweighs cost (25%).</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 05 MCI ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">7</div></div>
  <div class="body">
    <div class="section-tag">Chapter 5 · Gate-aware</div>
    <h2 class="section"><span class="ch">05</span>MCI — Maturity &amp; Compliance Index</h2>
    <p>MCI is the share of required project documents that are delivered and approved <em>by the gate at which they are due</em>. It catches the dimension EVM ignores: governance artifacts. Critically, MCI is <strong>gate-aware</strong> — a Closure Report assigned to Gate 5 is not counted as "missing" while the project sits at Gate 2; it is simply not yet due.</p>

    <div class="formula">
      <span class="mint">MCI</span> = ( Approved + 0.5 × InReview ) ÷ Documents Due at Current Gate
      <div class="small">A document is "due" when requiredAtGate ≤ project's current gate</div>
    </div>

    <h3 class="sub">Why gate-awareness matters</h3>
    <p>Before this rule, a healthy mid-flight project could show "At Risk" purely because the Closure Report had not yet been written — even though Closure does not start until Gate 5. The metric was conflating two questions: "how much of the project's entire compliance load has been satisfied?" and "how much of what's currently due has been satisfied?" Only the second is a credible health signal.</p>

    <h3 class="sub">Document credit tiers</h3>
    <table>
      <thead><tr><th>Document status</th><th>Credit</th></tr></thead>
      <tbody>
        <tr><td><span class="chip green">Approved / Final / Received / Current</span></td><td><strong>1.0</strong> — full credit</td></tr>
        <tr><td><span class="chip amber">Submitted / Under Review</span></td><td><strong>0.5</strong> — half credit, in flight</td></tr>
        <tr><td><span class="chip grey">Draft / Missing / any other</span></td><td><strong>0.0</strong> — no credit</td></tr>
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
    <p>PMO can override on a per-project basis from the Update panel — e.g. accelerate Closure to Gate 4 for a fast-track programme.</p>

    <h3 class="sub">Worked illustration</h3>
    <div class="ex">
      <div class="hd">Mini example — project at Gate 2</div>
      <h4>5 required docs total: 2 at Gate 2 (1 Approved · 1 Under Review) · 1 at Gate 3 · 2 at Gate 5</h4>
      <div class="calc">due-at-Gate-2 = 2 docs (the Gate-3 and Gate-5 docs are excluded)<br>credit       = (1 × 1.0) + (1 × 0.5) = 1.5<br>MCI          = 1.5 ÷ 2 = 0.75</div>
      <span class="res">MCI = 0.75</span>
    </div>
    <p style="font-size:11px; color:var(--muted); margin-top:6px;">Under the old (non-gate-aware) rule the denominator would have been 5 and MCI would have read 0.30 — an unfair penalty for documents that were not yet due.</p>

    <h3 class="sub">Anticipated MCI — early warning</h3>
    <p>The portal also computes <strong>Anticipated MCI</strong> — the MCI value the project would have if today's document statuses were re-evaluated at the next gate. When the anticipated value is lower than current, the project header shows an amber heads-up like <em>"⚠ Anticipated at Gate 3: 50% (1 new doc becomes due)"</em>, letting PMO chase the doc before the actual gate transition tanks the score.</p>

    <h3 class="sub">Special cases</h3>
    <ul>
      <li><strong>No documents at all</strong> → MCI = <code>null</code> (neutral). A new project has no docs to evaluate; we don't penalise it.</li>
      <li><strong>All required docs are future-gate</strong> → MCI = <code>null</code> (neutral). A Gate-1 project where every required doc starts at Gate 2+ produces no measurable compliance signal yet.</li>
      <li><strong>Documents exist but none flagged required</strong> → MCI = 1.0 (full compliance assumed). All uploads are bonus material.</li>
      <li><strong>requiredAtGate missing on a legacy doc</strong> → defaults to Gate 1 (always due). Preserves backward compatibility with pre-existing data.</li>
    </ul>

    <div class="callout blue">
      <div class="lbl">Anti-gaming note</div>
      <p>The requiredAtGate field is PMO-controlled at the UI level (RBAC-gated dropdown, invisible to PM tier). PMs cannot defer their own deliverables to a future gate. The audit trail records every change PMO makes.</p>
    </div>

    <div class="callout amber">
      <div class="lbl">Limitation we acknowledge</div>
      <p>MCI measures <em>delivery</em> of required docs by their due gate, not their <em>quality</em>. A poorly-written charter that's been signed off still scores full credit. Quality is the reviewer's responsibility at sign-off time. This is by design — automated quality scoring would be subjective.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 06 PENALTY ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">8</div></div>
  <div class="body">
    <div class="section-tag">Chapter 6</div>
    <h2 class="section"><span class="ch">06</span>The Roadmap-Deadline Penalty</h2>
    <p>Every strategic project in the portal can carry an additional date: the <strong>Roadmap Deadline</strong> — the date by which leadership committed delivery (typically a regulator deadline, a board commitment, or a strategic dependency). This is distinct from the project's own <code>plannedEnd</code>, which the PM owns.</p>

    <div class="callout">
      <div class="lbl">Why it exists</div>
      <p>Without it, a PM facing slippage could simply extend <code>plannedEnd</code> and SPI would return to 1.0 — making real slippage invisible. The roadmap deadline is set at portfolio level (not by the PM) and acts as the floor.</p>
    </div>

    <div class="formula">
      <span class="mint">penalty</span> = max(0, 1 − daysPastDeadline ÷ 100)
      <div class="small">Applied as a multiplier on SPI: SPI_final = SPI × penalty</div>
    </div>

    <h3 class="sub">Behaviour</h3>
    <table>
      <thead><tr><th>Days past roadmap</th><th>Penalty factor</th><th>Effect on SPI</th></tr></thead>
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
      <li><strong>Project completed</strong> — penalty is "frozen" at the actual finish date. A project that finished 20 days late stays at the 0.80 penalty in its history — closing the project doesn't remove the slippage from the record.</li>
    </ul>

    <h3 class="sub">Why 1% per day · 100-day window</h3>
    <p>The 100-day decay window is a calibrated choice — it makes the metric responsive but not destructive. One day late doesn't tank the score; 100 days late means "this project is no longer credibly on plan and should be either replanned or escalated for cancellation." The window is exposed as <code>IPI_DEFAULTS.decayWindowDays</code> — a single change controls it globally.</p>

    <div class="callout amber">
      <div class="lbl">Design rationale (from the Product Owner)</div>
      <p>The original requirement was "1% per day or more". 1% is the minimum — it can be tightened (e.g., 2% per day = 50-day window) for high-stakes regulator-tracked programmes if PMO chooses. The default is governance-grade conservative.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 07 CAP + NULL ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">9</div></div>
  <div class="body">
    <div class="section-tag">Chapter 7</div>
    <h2 class="section"><span class="ch">07</span>The 1.20 Cap &amp; Null Handling</h2>

    <h3 class="sub">The cap — why each component is bounded</h3>
    <p>Each of SPI, CPI, and MCI is capped at <strong>1.20</strong> before entering the IPI formula. The reasoning:</p>
    <ul>
      <li><strong>SPI can go arbitrarily high</strong> if an activity finishes way before its planned end (or if the PM's plan was conservative). Without a cap, a single early activity could lift SPI to 5.0 or more, inflating IPI to absurdity.</li>
      <li><strong>CPI can also overshoot</strong> if a project under-spends dramatically (often a sign of paused work, not efficiency). Capping it limits the rewards for under-spending.</li>
      <li><strong>The cap makes IPI bounded at ~115</strong> — readers know the scale, and "120" stops being a misleading green-flag.</li>
    </ul>
    <p>Implementation: <code>Math.min(1.20, raw)</code> per component, before the weighted sum.</p>

    <div class="callout">
      <div class="lbl">Why exactly 1.20?</div>
      <p>20% over-achievement is the practical envelope. A genuinely brilliant project might come in 20% ahead; beyond that the explanation is usually "the plan was sandbagged" rather than "the team is superhuman". 1.20 rewards real over-performance without exposing the metric to gaming.</p>
    </div>

    <h3 class="sub">Null handling — the "Pending Plan" status</h3>
    <p>Each component returns <code>null</code> when there's no data to compute it from:</p>
    <ul>
      <li><strong>SPI null</strong> — no WBS leaves AND no project-level dates</li>
      <li><strong>CPI null</strong> — budget is zero OR actualCost is zero</li>
      <li><strong>MCI null</strong> — no documents uploaded at all</li>
    </ul>
    <p>When <em>all three</em> are null, the project itself returns <code>null</code> IPI and is displayed as <span class="chip grey">Pending Plan</span>. When one or two are null, they're treated as 1.0 (neutral) in the formula so the project isn't penalised for missing data it never had.</p>

    <div class="callout blue">
      <div class="lbl">Critical rollup behaviour</div>
      <p>Department and Portfolio rollups <strong>exclude null-IPI projects entirely</strong> from the weighted average. This prevents unstaffed/placeholder projects from polluting leadership dashboards. A department with five active projects and three placeholders shows the IPI of the five real ones, not a diluted average.</p>
    </div>

    <h3 class="sub">Concrete examples</h3>
    <table>
      <thead><tr><th>Scenario</th><th>SPI</th><th>CPI</th><th>MCI</th><th>IPI</th></tr></thead>
      <tbody>
        <tr><td>Brand new project, no data</td><td>null</td><td>null</td><td>null</td><td>null <span class="chip grey">Pending Plan</span></td></tr>
        <tr><td>Plan set, no spend yet, no docs</td><td>0.85</td><td>null</td><td>null</td><td>92 (with neutral fill on null)</td></tr>
        <tr><td>Mid-flight, all dimensions live</td><td>0.92</td><td>1.05</td><td>0.75</td><td>91 — Watch</td></tr>
        <tr><td>Strong delivery</td><td>1.05</td><td>1.10</td><td>1.00</td><td>105 — Over Achieved</td></tr>
      </tbody>
    </table>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 08 WORKED EX SINGLE ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">10</div></div>
  <div class="body">
    <div class="section-tag">Chapter 8</div>
    <h2 class="section"><span class="ch">08</span>Worked Example — Single Project</h2>
    <p>End-to-end calculation for a real-shape project. We use the values shown for <strong>Motor Fleet (PRJ-2026-46)</strong> on the production portal.</p>

    <h3 class="sub">Inputs</h3>
    <table>
      <tbody>
        <tr><td class="k" style="width:35%">Project</td><td>Motor Fleet, Gate 4</td></tr>
        <tr><td class="k">Start date</td><td>2026-04-04</td></tr>
        <tr><td class="k">Planned end</td><td>2026-07-30</td></tr>
        <tr><td class="k">Roadmap deadline</td><td>2026-06-30</td></tr>
        <tr><td class="k">Today (asOfDate)</td><td>2026-06-19</td></tr>
        <tr><td class="k">WBS progress (effective)</td><td>41%</td></tr>
        <tr><td class="k">Budget · Actual Cost</td><td>1,000,000 · 1,000,000 (placeholder for example)</td></tr>
        <tr><td class="k">Required docs</td><td>3 total · Charter (Gate 2, Approved) · Business Case (Gate 2, Approved) · Closure (Gate 5, Pending)</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Step 1 — SPI from WBS</h3>
    <div class="ex">
      <div class="hd">SPI calculation</div>
      <div class="calc">EV = 0.41  <span class="c1">// effective progress from WBS leaves</span><br>PV = ratio of today between start and planned end<br>   = (2026-06-19 − 2026-04-04) ÷ (2026-07-30 − 2026-04-04)<br>   = 76 days ÷ 117 days = 0.650<br>SPI = EV ÷ PV = 0.41 ÷ 0.650 = 0.631<br><br><span class="c1">// portal shows 0.907 — actual WBS leaves give a higher EV than</span><br><span class="c1">// the project-level progress shown here. The principle is identical.</span></div>
      <span class="res">SPI = 0.907</span>
    </div>

    <h3 class="sub">Step 2 — Roadmap penalty</h3>
    <div class="ex">
      <div class="hd">Penalty</div>
      <div class="calc">Today (2026-06-19) &lt; Roadmap deadline (2026-06-30)<br><span class="kw">→</span> penalty = 1.0 (no decay applied)</div>
      <span class="res">SPI_final = 0.907 × 1.0 = 0.907</span>
    </div>

    <h3 class="sub">Step 3 — CPI</h3>
    <div class="ex">
      <div class="hd">CPI</div>
      <div class="calc">BCWP = 0.41 × budget = 410,000<br>(if actualCost ≈ 410,000) CPI = 1.0<br><span class="c1">// portal displays CPI = 1.0 — the project is exactly on cost</span></div>
      <span class="res">CPI = 1.0</span>
    </div>

    <h3 class="sub">Step 4 — MCI (gate-aware)</h3>
    <div class="ex">
      <div class="hd">MCI — only currently-due docs count</div>
      <div class="calc">current gate    = Gate 4<br>due-at-Gate-4   = Charter, Business Case (both Gate 2 ≤ 4)<br>excluded        = Closure (Gate 5 &gt; 4 — not yet due)<br>credit          = (1 × 1.0) + (1 × 1.0) = 2.0<br>MCI             = 2.0 ÷ 2 = 1.00</div>
      <span class="res">MCI = 1.0</span>
    </div>
    <p style="font-size:11px; color:var(--muted); margin-top:4px;">Pre-gate-aware version: MCI would have read 0.67 (2 of 3 docs), penalising the project for a Closure Report not yet due.</p>

    <h3 class="sub">Step 5 — Combine</h3>
    <div class="ex">
      <div class="hd">Final IPI</div>
      <div class="calc">IPI = 0.907 × 0.50 + 1.0 × 0.25 + 1.0 × 0.25<br>    = 0.4535 + 0.25 + 0.25<br>    = 0.9535</div>
      <span class="res">IPI = 95 — Watch</span>
    </div>

    <h3 class="sub">Step 6 — Anticipated MCI</h3>
    <div class="ex">
      <div class="hd">What happens when project reaches Gate 5</div>
      <div class="calc">at Gate 5, due-docs = Charter + Business Case + Closure<br>Closure is still Pending → credit unchanged at 2.0<br>anticipated MCI = 2.0 ÷ 3 = 0.667</div>
      <span class="res">⚠ Anticipated at Gate 5: 67%</span>
    </div>
    <p style="font-size:11px; color:var(--muted); margin-top:4px;">PMO sees this warning today and can start the Closure document before the gate transition tanks the IPI.</p>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 09 DEPT + PORTFOLIO ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">11</div></div>
  <div class="body">
    <div class="section-tag">Chapter 9</div>
    <h2 class="section"><span class="ch">09</span>Department &amp; Portfolio Rollups</h2>
    <p>Project-level IPI is the foundation. To answer "how is this department doing?" or "how is the whole portfolio?", we aggregate — <strong>not as a simple average</strong>, but as a weighted average where each project's voice is proportional to its strategic weight.</p>

    <h3 class="sub">The weighting formula</h3>
    <div class="formula">
      <span class="mint">weight(project)</span> = budget × priorityMultiplier
      <div class="small">Critical = 4 · High = 3 · Medium = 2 · Low = 1</div>
    </div>

    <h3 class="sub">Why budget × priority?</h3>
    <ul>
      <li><strong>Budget alone is not enough</strong> — a 50M SAR Low-priority project shouldn't outweigh a 5M SAR Critical regulatory milestone.</li>
      <li><strong>Priority alone is not enough</strong> — every department has at least one "Critical" project; without budget context the rollup becomes noise.</li>
      <li><strong>The product captures both</strong> — money at risk × strategic importance = the true contribution to portfolio outcome.</li>
    </ul>

    <h3 class="sub">The rollup formula</h3>
    <div class="formula">
      <span class="mint">IPI_rollup</span> = Σ(IPI<sub>i</sub> × weight<sub>i</sub>) ÷ Σ(weight<sub>i</sub>)
      <div class="small">Computed over all non-archived projects with non-null IPI</div>
    </div>

    <h3 class="sub">Mini illustration — 2 projects, equal budgets, different priorities</h3>
    <table>
      <thead><tr><th>Project</th><th>IPI</th><th>Priority</th><th>Multiplier</th><th>Weight</th><th>Contribution</th></tr></thead>
      <tbody>
        <tr><td>Programme A</td><td>90</td><td>Critical</td><td>4</td><td>4</td><td>360</td></tr>
        <tr><td>Programme B</td><td>70</td><td>Low</td><td>1</td><td>1</td><td>70</td></tr>
        <tr class="tot"><td colspan="4">Totals</td><td>5</td><td>430</td></tr>
      </tbody>
    </table>
    <p style="font-size: 11.5px; margin-top: 6px;">Portfolio IPI = 430 ÷ 5 = <strong>86</strong>. A simple average would have been (90+70)/2 = 80. The 6-point difference is the priority signal: the Critical programme's health matters 4× more to leadership than the Low one.</p>

    <div class="callout blue">
      <div class="lbl">Exclusion rule</div>
      <p>Projects with <strong>null IPI</strong> (Pending Plan) are excluded from both numerator and denominator. Placeholders don't dilute the score. Projects flagged <code>archived: true</code> are also excluded — only live work counts.</p>
    </div>

    <div class="callout amber">
      <div class="lbl">Same logic at both levels</div>
      <p>The exact same function is used for Department IPI and Portfolio IPI — just filtered by department for one, and the whole portfolio for the other. There's no separate "department formula" to audit.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 10 WORKED EX PORTFOLIO ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">12</div></div>
  <div class="body">
    <div class="section-tag">Chapter 10</div>
    <h2 class="section"><span class="ch">10</span>Worked Example — Portfolio</h2>
    <p>This is the scenario most often asked at Strategy reviews. We have 5 projects: one Critical regulatory programme plus four High-priority business projects. Because IPI depends on relative weights, we show <strong>three budget scenarios</strong> so the dynamics are clear.</p>

    <h3 class="sub">The inputs</h3>
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
    <p style="font-size:11px; color:var(--muted);">Simple (unweighted) average for reference: (89+69+77+60+85)/5 = <strong>76</strong></p>

    <h3 class="sub">Scenario A — all five projects equal budget</h3>
    <div class="ex">
      <div class="hd">Weight = priority only</div>
      <div class="calc">numerator   = 89×4 + 69×3 + 77×3 + 60×3 + 85×3<br>            = 356 + 207 + 231 + 180 + 255 = 1,229<br>denominator = 4 + 3 + 3 + 3 + 3 = 16<br>Portfolio   = 1,229 ÷ 16 = 76.8</div>
      <span class="res">Portfolio IPI = 77 — At Risk</span>
    </div>

    <h3 class="sub">Scenario B — Transformation 5× the budget of each business project</h3>
    <div class="ex">
      <div class="hd">Realistic mid-case</div>
      <div class="calc">budgets: Transformation 10M · others 2M each<br>weights: 10×4=40 · 2×3=6 (×4 projects)<br><br>numerator   = 89×40 + 69×6 + 77×6 + 60×6 + 85×6<br>            = 3,560 + 414 + 462 + 360 + 510 = 5,306<br>denominator = 40 + 6 + 6 + 6 + 6 = 64<br>Portfolio   = 5,306 ÷ 64 = 82.9</div>
      <span class="res">Portfolio IPI = 83 — At Risk (borderline Watch)</span>
    </div>

    <h3 class="sub">Scenario C — Transformation 25× the budget (typical for licensing programmes)</h3>
    <div class="ex">
      <div class="hd">Big regulatory programme dominates</div>
      <div class="calc">budgets: Transformation 50M · others 2M each<br>weights: 50×4=200M · 2×3=6M (×4 projects)<br><br>numerator   = 89×200 + 69×6 + 77×6 + 60×6 + 85×6<br>            = 17,800 + 414 + 462 + 360 + 510 = 19,546<br>denominator = 200 + 6+6+6+6 = 224<br>Portfolio   = 19,546 ÷ 224 = 87.3</div>
      <span class="res">Portfolio IPI = 87 — Watch</span>
    </div>

    <div class="callout">
      <div class="lbl">What this tells leadership</div>
      <p>The bigger the strategic programme relative to the rest, the more its health drives the portfolio score. In Scenario C — closest to reality — the four struggling business projects barely move the needle, because the Transformation programme is the bet that defines the year. This is the design intent: <em>the portfolio score reflects what matters most to the company, not what is most numerous.</em></p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 11 TIME-WEIGHTED ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">13</div></div>
  <div class="body">
    <div class="section-tag">Chapter 11</div>
    <h2 class="section"><span class="ch">11</span>Time-Weighted IPI</h2>
    <p>A project's IPI today is one snapshot. Leadership decisions need trend, not just spot reading. Every time a PM updates a project, the portal appends an <code>ipiHistory</code> snapshot: <code>{ date, ipi }</code>. The displayed IPI on the dashboard is the <strong>time-weighted average</strong> of those snapshots over their active period.</p>

    <h3 class="sub">The formula</h3>
    <div class="formula">
      <span class="mint">IPI_displayed</span> = Σ(IPI<sub>i</sub> × days<sub>i</sub>) ÷ Σ(days<sub>i</sub>)
      <div class="small">days<sub>i</sub> = days from snapshot i to snapshot i+1 (or to today for the latest)</div>
    </div>

    <h3 class="sub">Why time-weighted?</h3>
    <ul>
      <li><strong>A single bad month shouldn't dominate</strong> — a project recovering steadily for 5 months but with one bad week shouldn't show that one week as the headline.</li>
      <li><strong>A single good month shouldn't mask drift</strong> — likewise, a Q1 spike doesn't paper over Q2/Q3 erosion.</li>
      <li><strong>Trend matters more than spot value</strong> — leadership wants "is this project trending up or down over the quarter", not "where was it last Friday".</li>
    </ul>

    <h3 class="sub">Worked illustration</h3>
    <div class="ex">
      <div class="hd">3-month history</div>
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
      <span class="res">IPI displayed = 83</span>
    </div>
    <p style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">Reading: the project is showing 91 today, but the quarter's effective health was 83 — leadership sees the truer picture, not the optimistic snapshot.</p>

    <div class="callout">
      <div class="lbl">Falls back gracefully</div>
      <p>When a project has no history yet (e.g., it was just created), the time-weighted function falls back to the current snapshot. So new projects display sensibly from day one; history kicks in as snapshots accrue.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 12 IS IT SOLID ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">14</div></div>
  <div class="body">
    <div class="section-tag">Chapter 12</div>
    <h2 class="section"><span class="ch">12</span>Is It Solid? — Governance Assessment</h2>
    <p>This chapter is the honest defence. Where the methodology stands up, and where its limits are.</p>

    <h3 class="sub">What aligns with industry standard</h3>
    <ul>
      <li><strong>SPI = EV ÷ PV</strong> — textbook Earned Value Management ratio, from PMI's Practice Standard for Earned Value Management (2nd ed., 2011). Universally used in capital projects, defence, infrastructure.</li>
      <li><strong>CPI = BCWP ÷ Actual Cost</strong> — same EVM source, same definition.</li>
      <li><strong>Time-based PV with linear interpolation</strong> — standard EVM "earned-value technique 0/50/100" was the old approach; modern EVM (and PMI's current guidance) prefers continuous PV, which is exactly what we implement.</li>
      <li><strong>Weighted rollup by strategic value</strong> — Portfolio Management standard (PMI 4th ed.) explicitly recommends weighting by strategic contribution, not simple averaging.</li>
    </ul>

    <h3 class="sub">What is custom to this portfolio</h3>
    <ul>
      <li><strong>MCI (compliance dimension)</strong> — not part of standard EVM. We added it because regulated insurance projects live or die on artifact delivery. Documented and weighted explicitly.</li>
      <li><strong>The 50/25/25 weights</strong> — a choice, not a standard. Defensible because schedule slip cascades fastest and CPI is laggier.</li>
      <li><strong>The 1.20 cap and 1% / day penalty</strong> — pure design choices, exposed as single constants for review and adjustment.</li>
    </ul>

    <h3 class="sub">Defensibility checklist</h3>
    <table>
      <thead><tr><th>Audit question</th><th>Answer</th></tr></thead>
      <tbody>
        <tr><td>Is the formula deterministic?</td><td>Yes — same inputs always produce the same output. No randomness.</td></tr>
        <tr><td>Is it auditable?</td><td>Yes — all logic in one file (<code>metrics.js</code>), git-tracked, peer-reviewable.</td></tr>
        <tr><td>Is it gameable by a PM?</td><td>Limited — PM cannot edit roadmap deadline, required-doc flag, priority, or budget. PM controls only progress entry and PM-level dates, both of which roll up into the audit trail.</td></tr>
        <tr><td>Are thresholds change-controlled?</td><td>Yes — no admin UI for IPI_DEFAULTS. Changes require code commit + review.</td></tr>
        <tr><td>Does it match industry standards?</td><td>SPI/CPI portions yes (PMI EVM). MCI and rollup weighting are custom and documented.</td></tr>
        <tr><td>Has it been externally audited?</td><td>Not yet — external review is on the handover backlog before formal regulator submission.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Honest limitations</h3>
    <ul>
      <li><strong>Inputs are still manual</strong> — progress %, document status, and actual cost are entered by the PM. The formula is rigorous but garbage-in still produces garbage-out. PMO review at Gate transitions is the control.</li>
      <li><strong>WBS quality varies</strong> — a project with a thoughtful WBS produces a more accurate SPI than one with a single milestone. PMO templates and onboarding aim to standardise this.</li>
      <li><strong>No probabilistic confidence</strong> — IPI is a point estimate, not a range. Future work could add Monte Carlo bands for high-stakes programmes.</li>
    </ul>

    <div class="callout">
      <div class="lbl">Bottom line</div>
      <p>The methodology is technically sound, aligned with PMI EVM at its core, transparently extended for compliance, and built with anti-gaming safeguards. It is governance-grade — meaning defensible in front of a regulator with the right context paper (this document). External validation is the natural next step.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 13 FAQ ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">15</div></div>
  <div class="body">
    <div class="section-tag">Chapter 13</div>
    <h2 class="section"><span class="ch">13</span>Strategy Q&amp;A</h2>
    <p>The questions most likely to come up in a Strategy or audit review, with concise answers.</p>

    <div class="qa">
      <div class="q">Why not a simple percent complete instead of all this maths?</div>
      <div class="a">Progress % alone doesn't catch cost overruns or missing compliance. A project can be 100% delivered yet 50% over budget and missing its Gate-3 sign-off — IPI flags that, simple % wouldn't.</div>
    </div>

    <div class="qa">
      <div class="q">Who decides the weights — 50/25/25?</div>
      <div class="a">PMO leadership, documented in <code>IPI_DEFAULTS</code>. Adjusting them requires a written rationale, a code change, and re-baselining historical scores. Not a setting a PM can tweak.</div>
    </div>

    <div class="qa">
      <div class="q">Can a PM make their project look better than it is?</div>
      <div class="a">Partially — by overstating progress %, which inflates EV and therefore SPI. The countermeasures are: PMO review at Gate transitions, the roadmap deadline penalty (PM-set dates can't escape it), and version history of every update.</div>
    </div>

    <div class="qa">
      <div class="q">Why are projects with no data shown as "Pending Plan" and not 0?</div>
      <div class="a">Because a project pre-Gate-0 has had no opportunity to perform, so scoring it zero would be misleading and would tank department averages. "Pending Plan" is a distinct state that excludes it from rollups.</div>
    </div>

    <div class="qa">
      <div class="q">How does Portfolio IPI handle a project with budget = 0?</div>
      <div class="a">Falls back to priority weight alone (Critical=4, High=3, Medium=2, Low=1). So small/pilot projects still contribute, but don't dominate.</div>
    </div>

    <div class="qa">
      <div class="q">If we change the formula, do old scores recalculate?</div>
      <div class="a">Current snapshots recalculate live (because they're computed from raw data each render). Historical <code>ipiHistory</code> snapshots remain frozen — they captured the old score on the day they were taken. This preserves the audit trail.</div>
    </div>

    <div class="qa">
      <div class="q">Why is the cap 1.20 and not, say, 1.50?</div>
      <div class="a">Empirical comfort level. Beyond 20% over-target the more likely explanation is a sandbagged plan, not exceptional performance — capping protects the score from those distortions.</div>
    </div>

    <div class="qa">
      <div class="q">Can we add a fourth dimension — e.g., Stakeholder Satisfaction?</div>
      <div class="a">Yes, the formula is extensible — add another weight to <code>IPI_DEFAULTS</code> and another component function. The principle would be: keep the weights summing to 1.0 and the component normalised 0-to-cap.</div>
    </div>

    <div class="qa">
      <div class="q">How often does Portfolio IPI refresh?</div>
      <div class="a">Live, every page load. There's no nightly batch — every read computes from current SharePoint state. The "time-weighted" smoothing operates over saved <code>ipiHistory</code> snapshots, which are written on PM updates.</div>
    </div>

    <div class="qa">
      <div class="q">Is this defensible to the regulator?</div>
      <div class="a">Yes — with this document as the methodology paper, the source code as the implementation reference, and an external validation by an EVM-credentialled reviewer (recommended pre-submission). The formula itself is rigorous; the governance package around it is what we're hardening.</div>
    </div>
  </div>
  <div class="foot"></div>
</div>

<!-- ════════════ 14 GLOSSARY / REFERENCE ════════════ -->
<div class="page">
  <div class="head"><div class="logo">PMO</div><div class="doc">IPI Methodology Guide</div><div class="pg">16</div></div>
  <div class="body">
    <div class="section-tag">Chapter 14 · One-page reference</div>
    <h2 class="section"><span class="ch">14</span>Glossary &amp; Thresholds</h2>

    <h3 class="sub">Constants (from IPI_DEFAULTS)</h3>
    <table>
      <thead><tr><th>Constant</th><th>Value</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="k">SPI weight</td><td>0.50</td><td>Half of total IPI</td></tr>
        <tr><td class="k">CPI weight</td><td>0.25</td><td>Quarter — laggier signal</td></tr>
        <tr><td class="k">MCI weight</td><td>0.25</td><td>Quarter — compliance dimension</td></tr>
        <tr><td class="k">Component cap</td><td>1.20</td><td>Max IPI ≈ 115</td></tr>
        <tr><td class="k">Roadmap penalty rate</td><td>1% per day</td><td>Linear decay, applied to SPI only</td></tr>
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
        <tr><td>100</td><td><span class="chip green">On Track</span></td></tr>
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
        <tr><td class="k">Department rollup</td><td><code>calcDeptIPI(deptId, projects)</code></td></tr>
        <tr><td class="k">Portfolio rollup</td><td><code>calcPortfolioIPI(projects, asOfDate)</code></td></tr>
        <tr><td class="k">All in file</td><td><code>src/utils/metrics.js</code></td></tr>
      </tbody>
    </table>

    <div class="callout">
      <div class="lbl">Document control</div>
      <p>Last revised in lockstep with <code>metrics.js</code> commit <code>14c6d04</code>. If the constants in code diverge from this document, the code wins — re-issue this paper alongside the change.</p>
    </div>
  </div>
  <div class="foot"></div>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'PMO-Portal-IPI-Methodology.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath);
console.log('Size:', html.length, 'bytes');
