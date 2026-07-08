// IPI Policy & Procedure — v3 · Formal English document
// Corporate-policy style with explicit Reward and Penalty mechanics.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>IPI Policy & Procedure</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  /* Tree brand font — GT Planar. Loaded from local Tree-Brand-Assets. */
  @font-face { font-family:'GT Planar'; font-weight:300;
    src:url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Light-Trial-BF63bcd77b74df6.otf') format('opentype'); }
  @font-face { font-family:'GT Planar'; font-weight:400;
    src:url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Regular-Trial-BF63bcd9a5c44bb.otf') format('opentype'); }
  @font-face { font-family:'GT Planar'; font-weight:500;
    src:url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Medium-Trial-BF63bcd77600d58.otf') format('opentype'); }
  @font-face { font-family:'GT Planar'; font-weight:700;
    src:url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Bold-Trial-BF63bcd77557486.otf') format('opentype'); }
  @font-face { font-family:'GT Planar'; font-weight:900;
    src:url('file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Fonts/English/English/GT-Planar-Black-Trial-BF63bcd77b41460.otf') format('opentype'); }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  :root {
    --ink:#111; --ink-2:#333; --muted:#666;
    --line:#c9c9c9; --line-soft:#e5e5e5;
    --paper:#fefefe;
    --accent:#003932;     /* used sparingly */
    --rule:#0d1f1c;
  }
  body {
    font-family:'GT Planar', Georgia, serif;
    background:#333; color:var(--ink);
    line-height:1.6;
  }
  .page {
    width:210mm; min-height:297mm;
    background:var(--paper);
    margin:8mm auto;
    padding:22mm 24mm 18mm;
    box-shadow:0 6px 30px rgba(0,0,0,0.5);
    page-break-after:always;
    position:relative;
  }
  .page:last-child { page-break-after:avoid; }
  @media print {
    body { background:var(--paper); }
    .page { margin:0; box-shadow:none; }
    @page { size:A4; margin:0; }
  }

  /* Document masthead */
  .masthead {
    border-top:3px double var(--rule);
    border-bottom:1px solid var(--line);
    padding:8px 0 6px;
    margin-bottom:18px;
    display:flex; justify-content:space-between; align-items:baseline;
    font-size:9pt; color:var(--muted); letter-spacing:0.5px;
  }
  .masthead .l { text-transform:uppercase; font-weight:600; }
  .masthead .r { font-family:'JetBrains Mono', monospace; font-size:8.5pt; }

  /* Cover page */
  .cover {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; padding-top:60mm;
  }
  .cover .org {
    font-size:11pt; letter-spacing:6px; text-transform:uppercase;
    color:var(--accent); font-weight:700; margin-bottom:22mm;
  }
  .cover .title {
    font-family:'GT Planar', Georgia, serif;
    font-size:32pt; font-weight:700; color:var(--ink);
    line-height:1.15; margin-bottom:8mm; letter-spacing:-0.5px;
  }
  .cover .subtitle {
    font-size:14pt; color:var(--muted); font-style:italic;
    font-family:'GT Planar', Georgia, serif;
    margin-bottom:16mm;
  }
  .cover .rule { width:60mm; height:1px; background:var(--rule); margin:0 auto 16mm; }
  .cover .meta {
    display:grid; grid-template-columns:auto auto; gap:6px 18px;
    font-size:10pt; color:var(--ink-2);
  }
  .cover .meta .k { text-transform:uppercase; letter-spacing:1px; font-size:8.5pt; color:var(--muted); font-weight:600; }
  .cover .meta .v { text-align:left; font-weight:600; }

  /* Section headings */
  h1.section {
    font-family:'GT Planar', Georgia, serif;
    font-size:14pt; font-weight:700; color:var(--ink);
    margin:16px 0 6px;
    border-bottom:1px solid var(--rule);
    padding-bottom:4px;
    letter-spacing:-0.2px;
  }
  h1.section .num {
    font-family:'JetBrains Mono', monospace;
    font-size:11pt; color:var(--accent); margin-right:12px; font-weight:600;
  }
  h2.sub {
    font-size:10.5pt; font-weight:700; color:var(--ink); margin:12px 0 4px;
    text-transform:uppercase; letter-spacing:0.8px;
  }
  h2.sub .num { font-family:'JetBrains Mono', monospace; color:var(--muted); margin-right:8px; font-weight:500; }

  p { font-size:10pt; color:var(--ink-2); margin-bottom:6px; line-height:1.7; text-align:justify; }
  p strong { color:var(--ink); font-weight:700; }
  ul, ol { padding-left:22px; margin-bottom:6px; }
  ul li, ol li { font-size:10pt; line-height:1.75; margin-bottom:2px; text-align:justify; }

  code.mono {
    font-family:'JetBrains Mono', monospace;
    background:#f0f0f0; padding:1px 5px; border-radius:2px;
    font-size:9pt; color:var(--ink);
  }

  /* Formal tables */
  table {
    width:100%; border-collapse:collapse; margin:6px 0 10px;
    font-size:9.5pt;
    border-top:1.5px solid var(--rule);
    border-bottom:1.5px solid var(--rule);
  }
  th {
    text-align:left; padding:5px 8px;
    font-weight:700; font-size:9pt;
    text-transform:uppercase; letter-spacing:0.5px;
    border-bottom:1px solid var(--rule);
    background:transparent;
    color:var(--ink);
  }
  td {
    padding:5px 8px; border-bottom:1px solid var(--line-soft);
    vertical-align:top; color:var(--ink-2);
  }
  tr:last-child td { border-bottom:none; }
  td.k { font-family:'JetBrains Mono', monospace; font-size:8.5pt; color:var(--ink); font-weight:500; }
  td.num { font-family:'JetBrains Mono', monospace; text-align:right; }
  td.label { font-weight:600; color:var(--ink); }

  /* Formula block */
  .formula {
    background:#f7f7f5;
    border-left:3px solid var(--rule);
    padding:10px 14px; margin:8px 0;
    font-family:'JetBrains Mono', monospace;
    font-size:9pt; line-height:1.75; color:var(--ink);
    white-space:pre; overflow-x:auto;
  }
  .formula .c { color:#888; }

  /* Signature block */
  .sig-block {
    margin-top:auto; padding-top:18mm;
    display:grid; grid-template-columns:1fr 1fr; gap:14mm;
  }
  .sig {
    border-top:1px solid var(--ink); padding-top:5px;
    font-size:9.5pt;
  }
  .sig .role { text-transform:uppercase; letter-spacing:1px; font-size:8pt; color:var(--muted); font-weight:600; }
  .sig .name { font-weight:700; margin-top:2px; }
  .sig .title { color:var(--muted); font-size:8.5pt; font-style:italic; margin-top:1px; }

  /* Marginalia */
  .margin-note {
    font-size:8.5pt; color:var(--muted);
    border-left:2px solid var(--line);
    padding:2px 10px; margin:6px 0;
    font-style:italic;
  }

  /* Footer */
  footer.doc-footer {
    position:absolute; bottom:12mm; left:24mm; right:24mm;
    display:flex; justify-content:space-between;
    padding-top:6px; border-top:1px solid var(--line);
    font-size:8pt; color:var(--muted);
    font-family:'JetBrains Mono', monospace;
  }
</style>
</head>
<body>

<!-- ─── COVER ─── -->
<div class="page">
  <div class="cover">
    <div class="org">TREE DIGITAL INSURANCE COMPANY</div>
    <div class="title">Index of Project<br>Implementation (IPI)</div>
    <div class="subtitle">Policy &amp; Procedure</div>
    <div class="rule"></div>
    <div class="meta">
      <div class="k">Document ID</div>          <div class="v">PMO-POL-IPI-003</div>
      <div class="k">Version</div>              <div class="v">3.0</div>
      <div class="k">Classification</div>       <div class="v">Internal — PMO</div>
      <div class="k">Review Cycle</div>         <div class="v">Annual, or upon material change</div>
      <div class="k">Owner</div>                <div class="v">PMO Department</div>
    </div>
  </div>
  <footer class="doc-footer"><span>PMO-POL-IPI-003 · v3.0</span><span>Cover</span></footer>
</div>

<!-- ─── PAGE 1 ─── -->
<div class="page">
  <div class="masthead">
    <span class="l">Tree Digital Insurance · PMO Policy</span>
    <span class="r">PMO-POL-IPI-003 · v3.0</span>
  </div>

  <h1 class="section"><span class="num">1</span>Purpose &amp; Scope</h1>
  <p><strong>1.1</strong> The Index of Project Implementation (<code class="mono">IPI</code>) is a composite performance indicator scoring project delivery health on a scale of 0 to 115. It is the authoritative single number for portfolio triage, executive reporting, and steering-committee escalation.</p>
  <p><strong>1.2</strong> This Policy applies to every active, non-archived project in the Tree Digital Insurance project portfolio, from Gate 2 (Initiation approved) through Gate 5 (Closure sign-off).</p>

  <h1 class="section"><span class="num">2</span>Definitions</h1>
  <table>
    <thead><tr><th style="width:28%">Term</th><th>Definition</th></tr></thead>
    <tbody>
      <tr><td class="label">EV — Earned Value</td><td>Proportion of the project's scope actually completed at the measurement date, expressed on a 0–1 scale.</td></tr>
      <tr><td class="label">PV — Planned Value</td><td>Proportion that <em>should</em> have been completed at the measurement date, computed as elapsed days divided by the reference-deadline duration.</td></tr>
      <tr><td class="label">BCWP</td><td>Budgeted Cost of Work Performed. Equals <code class="mono">Budget × (Progress ÷ 100)</code>.</td></tr>
      <tr><td class="label">AC — Actual Cost</td><td>Cumulative expenditure recorded against the project's budget account.</td></tr>
      <tr><td class="label">Reference Deadline</td><td>The date used as the denominator for PV. Equals <code class="mono">RoadmapDeadline</code> when set (PMO-authoritative); otherwise <code class="mono">PlannedEnd</code>.</td></tr>
      <tr><td class="label">SPI · CPI · MCI</td><td>Schedule Performance Index, Cost Performance Index, Artefact Compliance Index. See §3.</td></tr>
      <tr><td class="label">Snapshot</td><td>The IPI value at a specific point in time; recorded on every save into <code class="mono">ipiHistory</code>.</td></tr>
      <tr><td class="label">Time-Weighted IPI</td><td>Duration-weighted average of snapshots within a rolling 90-day window; the value displayed on all dashboards.</td></tr>
    </tbody>
  </table>

  <h1 class="section"><span class="num">3</span>Calculation Framework</h1>

  <h2 class="sub"><span class="num">3.1</span>Component formulas</h2>
  <div class="formula"><span class="c">// The three components of IPI</span>
SPI = EV ÷ PV                          <span class="c">// uncapped ratio; PV measured against Reference Deadline</span>
CPI = BCWP ÷ AC                        <span class="c">// where BCWP = Budget × (Progress / 100)</span>
MCI = Σ credit(doc) ÷ docs_due_at_gate <span class="c">// gate-aware; credit tiers below</span>

<span class="c">// MCI credit tiers</span>
Approved | Final | Received | Current  →  1.0
Submitted | Under Review                →  0.5
Draft | Pending | Missing               →  0.0</div>

  <h2 class="sub"><span class="num">3.2</span>Composite formula</h2>
  <div class="formula">spiFinal = min(1.20, SPI)              <span class="c">// cap applied to each ratio component</span>
cpiFinal = min(1.20, CPI)

IPI = ( spiFinal × 0.50
      + cpiFinal × 0.25
      + MCI      × 0.25 ) × 100

<span class="c">// If any component is null it is excluded and the remaining weights</span>
<span class="c">// re-normalise to sum to 1.00. If all three are null, IPI is null</span>
<span class="c">// and the project is reported as "Pending Plan".</span></div>

  <div class="margin-note"><strong>Note.</strong> The prior version applied a 1%-per-day penalty to SPI whenever a project passed its Roadmap Deadline. That penalty is retired in v3: PV is now measured against the Roadmap Deadline itself, so any strategic slip is captured directly in the SPI ratio (PV &gt; 1 ⇒ SPI &lt; 1). Retaining the explicit penalty would have double-punished the same event.</div>

  <footer class="doc-footer"><span>PMO-POL-IPI-003 · v3.0</span><span>Page 1 of 4</span></footer>
</div>

<!-- ─── PAGE 2 — REWARDS & PENALTIES ─── -->
<div class="page">
  <div class="masthead">
    <span class="l">Reward &amp; Penalty Mechanics</span>
    <span class="r">PMO-POL-IPI-003 · v3.0</span>
  </div>

  <h1 class="section"><span class="num">4</span>Reward Mechanics</h1>
  <p><strong>4.1</strong> The IPI framework rewards over-performance <em>within bounded limits</em>. A project may exceed the nominal 100 threshold when execution is demonstrably ahead of the strategic plan and under budget.</p>

  <h2 class="sub"><span class="num">4.2</span>Reward calibration</h2>
  <table>
    <thead><tr><th>Dimension</th><th>Reward mechanism</th><th>Maximum contribution</th></tr></thead>
    <tbody>
      <tr>
        <td class="label">Schedule (SPI)</td>
        <td>When EV &gt; PV, the SPI ratio exceeds 1.0. Contributes proportionally up to the cap.</td>
        <td class="num">1.20 × 0.50 = 0.60</td>
      </tr>
      <tr>
        <td class="label">Cost (CPI)</td>
        <td>When BCWP &gt; AC (spent less than the value produced), CPI exceeds 1.0. Contributes proportionally up to the cap.</td>
        <td class="num">1.20 × 0.25 = 0.30</td>
      </tr>
      <tr>
        <td class="label">Compliance (MCI)</td>
        <td>Full documentation compliance yields MCI = 1.0 at the current gate. Cannot exceed 1.0 — compliance has no over-achievement.</td>
        <td class="num">1.00 × 0.25 = 0.25</td>
      </tr>
    </tbody>
  </table>

  <p><strong>4.3</strong> Combined maximum: <code class="mono">0.60 + 0.30 + 0.25 = 1.15</code>, corresponding to <strong>IPI = 115</strong>. This is the upper bound of the "Over Achieved" band.</p>

  <div class="margin-note"><strong>Rationale for the 1.20 cap.</strong> A single project reporting a raw ratio above 1.20 typically indicates a padded baseline rather than genuine over-performance. The cap prevents such projects from disproportionately elevating portfolio averages while still preserving a meaningful "excellence" signal in the 100–115 range.</div>

  <h1 class="section"><span class="num">5</span>Penalty Mechanics</h1>
  <p><strong>5.1</strong> Penalties in the IPI framework are <em>arithmetic consequences of the underlying performance data</em>, not discretionary deductions. A project is penalised only through what its inputs measurably demonstrate.</p>

  <h2 class="sub"><span class="num">5.2</span>Schedule slippage (SPI)</h2>
  <p>When the measurement date passes the Reference Deadline, PV exceeds 1.0. Because EV cannot exceed 1.0 (progress is capped at 100%), the SPI ratio drops below 1.0 in direct proportion to the delay.</p>
  <div class="formula">Example. Project window: 01 May – 30 June (Roadmap Deadline).
Measurement date: 15 July (15 days past). Progress: 100%.
   PV = 75 days ÷ 60 days = 1.250
   EV = 1.000
   SPI = 1.000 ÷ 1.250 = 0.800
Contribution: 0.800 × 0.50 = 0.400   (vs 0.500 on-time)</div>

  <h2 class="sub"><span class="num">5.3</span>Cost overrun (CPI)</h2>
  <p>When Actual Cost exceeds BCWP, CPI drops below 1.0. Each additional currency unit spent without corresponding scope completion reduces the CPI contribution proportionally.</p>
  <div class="formula">Example. Budget SAR 100,000; progress 50% (BCWP 50,000); AC 80,000.
   CPI = 50,000 ÷ 80,000 = 0.625
Contribution: 0.625 × 0.25 = 0.156   (vs 0.250 at parity)</div>

  <h2 class="sub"><span class="num">5.4</span>Compliance deficit (MCI)</h2>
  <p>Each required document not at "Approved" status (or equivalent) reduces MCI proportionally. Documents under review count for half credit; documents in draft or missing count for none.</p>
  <div class="formula">Example. 4 required documents at current gate:
   2 Approved (2.0) + 1 Submitted (0.5) + 1 Draft (0.0) = 2.5
   MCI = 2.5 ÷ 4 = 0.625
Contribution: 0.625 × 0.25 = 0.156   (vs 0.250 at full compliance)</div>

  <footer class="doc-footer"><span>PMO-POL-IPI-003 · v3.0</span><span>Page 2 of 4</span></footer>
</div>

<!-- ─── PAGE 3 — CONTINUED PENALTIES + BANDS + ROLES ─── -->
<div class="page">
  <div class="masthead">
    <span class="l">Data Quality, Bands &amp; Roles</span>
    <span class="r">PMO-POL-IPI-003 · v3.0</span>
  </div>

  <h2 class="sub"><span class="num">5.5</span>Data-quality violations (IPI refusal)</h2>
  <p>In four specific cases the engine <strong>refuses to publish an IPI</strong> rather than emit a potentially misleading number. The project is flagged with a machine-readable reliability code and displayed with a distinct status in place of a numeric score.</p>
  <table>
    <thead><tr><th>Condition</th><th>Flag</th><th>Displayed status</th></tr></thead>
    <tbody>
      <tr><td>Reference Deadline on or before Start Date</td><td class="k">invalid_dates</td><td>Data Invalid</td></tr>
      <tr><td>Less than 7 days elapsed since Start Date</td><td class="k">baseline_forming</td><td>Baseline Forming</td></tr>
      <tr><td>All three components (SPI, CPI, MCI) unmeasurable</td><td class="k">pending_plan</td><td>Pending Plan</td></tr>
      <tr><td>Documents exist but none marked <em>required</em></td><td>—</td><td>MCI excluded; IPI computed on remaining components</td></tr>
    </tbody>
  </table>

  <h1 class="section"><span class="num">6</span>Performance Bands</h1>
  <table>
    <thead><tr><th style="width:15%">Range</th><th style="width:25%">Band</th><th>Interpretation &amp; required action</th></tr></thead>
    <tbody>
      <tr><td class="num">≥ 101</td><td class="label">Over Achieved</td><td>Project is materially ahead of plan or under budget. Document lessons learned for future baselines.</td></tr>
      <tr><td class="num">100</td><td class="label">On Track</td><td>Project is executing to plan. Routine monitoring cadence applies.</td></tr>
      <tr><td class="num">90 – 99</td><td class="label">Watch</td><td>Weakness detected in at least one component. Project Manager reviews root cause with PMO staff within seven (7) calendar days.</td></tr>
      <tr><td class="num">70 – 89</td><td class="label">At Risk</td><td>Material underperformance. Project Manager submits a written recovery plan to the PMO Head within seven (7) calendar days.</td></tr>
      <tr><td class="num">&lt; 70</td><td class="label">Critical</td><td>Delivery is failing. Steering Committee is convened within three (3) working days. Continuation authority is subject to Committee resolution.</td></tr>
    </tbody>
  </table>

  <h1 class="section"><span class="num">7</span>Roles &amp; Responsibilities</h1>
  <table>
    <thead><tr><th>Role</th><th>Inputs</th><th>Review</th><th>Authoritative for</th></tr></thead>
    <tbody>
      <tr><td class="label">Project Manager</td><td>Progress, Actual Cost, Milestones, Documents</td><td>Own project's IPI</td><td>—</td></tr>
      <tr><td class="label">Department Head</td><td>—</td><td>Department IPI; Watch and At-Risk projects within the department</td><td>Approval of recovery plans</td></tr>
      <tr><td class="label">PMO Staff</td><td>PMO Notes, Document Approvals, Update Validation</td><td>All submitted updates</td><td>Data Reliability flags</td></tr>
      <tr><td class="label">Head of PMO</td><td>Roadmap Deadline, Priority</td><td>Portfolio IPI</td><td>This Policy; weights; the 1.20 cap</td></tr>
      <tr><td class="label">Executive Committee</td><td>—</td><td>Portfolio IPI (monthly)</td><td>Strategic decisions arising from Critical band</td></tr>
    </tbody>
  </table>

  <p><strong>7.1</strong> The following fields are <em>protected</em>: Project Managers and Department Heads cannot modify <code class="mono">RoadmapDeadline</code>, <code class="mono">PMONotes</code>, <code class="mono">PMOValidatedBy</code>, or <code class="mono">PMOValidatedDate</code>. These are the exclusive authority of PMO personnel.</p>

  <footer class="doc-footer"><span>PMO-POL-IPI-003 · v3.0</span><span>Page 3 of 4</span></footer>
</div>

<!-- ─── PAGE 4 — GOVERNANCE + APPROVALS ─── -->
<div class="page">
  <div class="masthead">
    <span class="l">Governance &amp; Change Control</span>
    <span class="r">PMO-POL-IPI-003 · v3.0</span>
  </div>

  <h1 class="section"><span class="num">8</span>Calculation Cadence</h1>
  <p><strong>8.1</strong> A new IPI snapshot is created and persisted on every save operation performed by a Project Manager or Department Head. Snapshots are append-only and immutable; there is no facility to edit or delete a prior snapshot.</p>
  <p><strong>8.2</strong> The value displayed on all dashboards is the <em>Time-Weighted IPI</em>: a duration-weighted average of the snapshots falling within a rolling 90-day window ending at the measurement date. Snapshots outside the window are excluded from the average.</p>
  <p><strong>8.3</strong> For a project marked "Completed" with an <code class="mono">actualFinishDate</code>, the measurement date is frozen at that finish date. Projects reviewed after closure retain their as-finished score indefinitely.</p>

  <h1 class="section"><span class="num">9</span>Escalation Protocol</h1>
  <table>
    <thead><tr><th>Trigger</th><th>Timeframe</th><th>Escalation target</th></tr></thead>
    <tbody>
      <tr><td>IPI enters Watch band (90–99)</td><td>3 calendar days</td><td>Department Head &amp; PMO Staff</td></tr>
      <tr><td>IPI enters At-Risk band (70–89)</td><td>1 calendar day</td><td>Head of PMO</td></tr>
      <tr><td>IPI enters Critical band (&lt; 70)</td><td>Immediate</td><td>Steering Committee</td></tr>
      <tr><td>Data Reliability flag raised</td><td>1 working day</td><td>PMO Staff for remediation</td></tr>
      <tr><td>Project exceeds Roadmap Deadline by 30 days</td><td>Immediate</td><td>Head of PMO; formal Roadmap review</td></tr>
    </tbody>
  </table>

  <h1 class="section"><span class="num">10</span>Change Control</h1>
  <p><strong>10.1</strong> The following elements of this Policy require the written approval of the Head of PMO before any change takes effect:</p>
  <ul>
    <li>Component formulas (SPI, CPI, MCI definitions)</li>
    <li>Composite weights (currently 0.50 / 0.25 / 0.25)</li>
    <li>The 1.20 component cap</li>
    <li>The 90-day Time-Weighted window</li>
    <li>Data-quality refusal conditions</li>
    <li>Performance-band thresholds</li>
  </ul>
  <p><strong>10.2</strong> Any change to composite weights additionally requires the countersignature of the Chief Financial Officer.</p>
  <p><strong>10.3</strong> A proposed change must be accompanied by (a) a written rationale, (b) a simulation of the effect on all currently-live projects, and (c) an amendment to the regression test suite. Changes take effect no less than fourteen (14) calendar days after approval, and are communicated to all Project Managers by written notice.</p>

  <h1 class="section"><span class="num">11</span>Verification Tools</h1>
  <ul>
    <li><strong>Audit Modal.</strong> Clicking any IPI value in the portal renders a full, reproducible breakdown of every input and every intermediate calculation. Exportable to PDF as evidence.</li>
    <li><strong>IPI Calculator.</strong> A what-if tool for evaluating hypothetical projects without registering them.</li>
    <li><strong>IPI Trend Chart.</strong> On each project detail page; one dot per recorded snapshot, with hover metadata including timestamp, author, and component values.</li>
  </ul>

  <div class="sig-block">
    <div class="sig">
      <div class="role">Approved by</div>
      <div class="name">Mohammed Alabdulmuhsin</div>
      <div class="title">PMO Coordinator · Author</div>
    </div>
    <div class="sig">
      <div class="role">Endorsed by</div>
      <div class="name">Head of PMO</div>
      <div class="title">Signature required prior to promulgation</div>
    </div>
  </div>

  <footer class="doc-footer"><span>PMO-POL-IPI-003 · v3.0 · End</span><span>Page 4 of 4</span></footer>
</div>

</body>
</html>`;

const outDir = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outHtml = path.join(outDir, "IPI-Policy-Procedure.html");
const outPdf  = path.join(outDir, "IPI-Policy-Procedure.pdf");
fs.writeFileSync(outHtml, html, "utf8");
console.log("HTML:", outHtml);

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("file:///" + outHtml.replace(/\\/g, "/"), { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.pdf({
    path: outPdf, format: "A4",
    printBackground: true, preferCSSPageSize: true,
    margin: { top:0, right:0, bottom:0, left:0 },
  });
  await browser.close();
  const stats = fs.statSync(outPdf);
  console.log("PDF:", outPdf);
  console.log("Size:", stats.size.toLocaleString(), "bytes");
})();
