// Builds a polished, multi-page GRC Admin Quick Start Guide
// matching the visual quality of PMO-PM-QuickGuide-V2.
const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GRC Risk Intelligence Dashboard - Admin Guide</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --brand:   #003932;
    --mint:    #00b894;
    --mint-lt: #e6f9f5;
    --amber:   #f59e0b;
    --red:     #ef4444;
    --blue:    #3b82f6;
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

  .page {
    width: 210mm;
    min-height: 297mm;
    background: var(--white);
    margin: 12mm auto;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 40px rgba(0,57,50,0.14);
  }

  @media print {
    body { background: white; }
    .page { margin: 0; box-shadow: none; page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }

  /* HEADER */
  .page-header {
    background: var(--brand);
    padding: 22px 28px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .page-header .logo-block {
    background: var(--mint);
    color: var(--brand);
    font-weight: 900;
    font-size: 15px;
    padding: 6px 12px;
    border-radius: 6px;
    letter-spacing: -0.3px;
    flex-shrink: 0;
  }
  .page-header .title-block { flex: 1; }
  .page-header .doc-title {
    color: var(--white);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.4px;
    line-height: 1.1;
  }
  .page-header .doc-sub {
    color: var(--mint);
    font-size: 11px;
    font-weight: 500;
    margin-top: 3px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .page-header .doc-meta {
    text-align: right;
    color: rgba(255,255,255,0.5);
    font-size: 10px;
    font-weight: 500;
    line-height: 1.6;
  }

  /* FOOTER */
  .page-footer {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    background: var(--brand);
    padding: 9px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .page-footer span {
    color: rgba(255,255,255,0.45);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.3px;
  }
  .page-footer .pnum {
    color: var(--mint);
    font-weight: 700;
    font-size: 10px;
  }

  .content { padding: 22px 28px 52px; }

  .section-label {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--mint);
    margin-bottom: 8px;
  }
  .section-title {
    font-size: 17px;
    font-weight: 800;
    color: var(--brand);
    letter-spacing: -0.4px;
    margin-bottom: 16px;
  }

  .divider { border: none; border-top: 1.5px solid var(--border); margin: 18px 0; }

  /* INTRO BANNER */
  .intro-banner {
    background: var(--mint-lt);
    border-left: 4px solid var(--mint);
    border-radius: 0 8px 8px 0;
    padding: 14px 16px;
    margin-bottom: 20px;
  }
  .intro-banner p {
    font-size: 12.5px;
    color: var(--brand);
    line-height: 1.55;
    font-weight: 500;
  }
  .intro-banner strong { font-weight: 800; }

  /* COVER */
  .cover-body { padding: 0; }
  .cover-hero {
    background: linear-gradient(160deg, #003932 0%, #005c4b 60%, #007a62 100%);
    padding: 44px 36px 36px;
    min-height: 180px;
    position: relative;
    overflow: hidden;
  }
  .cover-hero::after {
    content: '';
    position: absolute;
    bottom: -40px; right: -40px;
    width: 200px; height: 200px;
    background: rgba(0,184,148,0.08);
    border-radius: 50%;
  }
  .cover-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,184,148,0.15);
    border: 1px solid rgba(0,184,148,0.3);
    border-radius: 20px;
    padding: 5px 14px;
    margin-bottom: 20px;
  }
  .cover-badge .cb-dot { width: 7px; height: 7px; background: var(--mint); border-radius: 50%; }
  .cover-badge span { color: var(--mint); font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
  .cover-title {
    color: var(--white);
    font-size: 30px;
    font-weight: 900;
    letter-spacing: -0.8px;
    line-height: 1.05;
    margin-bottom: 8px;
  }
  .cover-title em { color: var(--mint); font-style: normal; }
  .cover-subtitle {
    color: rgba(255,255,255,0.65);
    font-size: 14px;
    font-weight: 400;
    margin-bottom: 28px;
  }
  .cover-roles { display: flex; gap: 10px; flex-wrap: wrap; }
  .crole {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
  }
  .cover-body .content { padding: 24px 28px 54px; }

  /* AT-A-GLANCE */
  .at-glance {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }
  .agcard {
    background: var(--brand);
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
  }
  .agcard .agn {
    font-size: 26px;
    font-weight: 900;
    color: var(--mint);
    letter-spacing: -1px;
    line-height: 1;
    margin-bottom: 4px;
  }
  .agcard .agl {
    font-size: 9.5px;
    color: rgba(255,255,255,0.7);
    font-weight: 500;
    line-height: 1.3;
  }

  /* HOW TO USE */
  .howto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .htcard {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .htcard .htl {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--mint);
    margin-bottom: 6px;
  }
  .htcard .htt {
    font-size: 12px;
    font-weight: 700;
    color: var(--brand);
    margin-bottom: 6px;
  }
  .htcard ul { list-style: none; }
  .htcard ul li {
    font-size: 11px;
    color: var(--muted);
    padding: 3px 0;
    line-height: 1.4;
  }
  .htcard ul li::before { content: "\\2022 "; color: var(--mint); font-weight: 800; }

  /* TIP BOX */
  .tip-box {
    background: #fffbeb;
    border: 1.5px solid #fde68a;
    border-radius: 8px;
    padding: 10px 14px;
    margin: 12px 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .tip-box .ti { font-size: 16px; flex-shrink: 0; }
  .tip-box p { font-size: 11px; color: #78350f; line-height: 1.5; font-weight: 500; }
  .tip-box strong { font-weight: 800; }

  /* WARN BOX */
  .warn-box {
    background: #fef2f2;
    border: 1.5px solid #fecaca;
    border-radius: 8px;
    padding: 10px 14px;
    margin: 12px 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .warn-box .wi { font-size: 16px; flex-shrink: 0; }
  .warn-box p { font-size: 11px; color: #991b1b; line-height: 1.5; font-weight: 500; }
  .warn-box strong { font-weight: 800; }

  /* SCOPE BOX */
  .scope-box {
    background: #eff6ff;
    border: 1.5px solid #bfdbfe;
    border-left: 4px solid #1d4ed8;
    border-radius: 0 8px 8px 0;
    padding: 12px 16px;
    margin: 12px 0;
  }
  .scope-box .stt {
    font-size: 11px;
    font-weight: 800;
    color: #1d4ed8;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .scope-box p {
    font-size: 11px;
    color: #1e3a8a;
    line-height: 1.55;
    font-weight: 500;
  }
  .scope-box .sgrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .scope-box .sgrid div {
    background: #fff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 10px;
    color: #1e3a8a;
    line-height: 1.45;
  }
  .scope-box .sgrid strong { color: #1d4ed8; font-weight: 800; }

  /* STEP FLOW */
  .step-row {
    display: flex;
    gap: 6px;
    align-items: stretch;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .step-box {
    flex: 1;
    min-width: 80px;
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 10px 10px 8px;
    text-align: center;
    position: relative;
  }
  .step-box .sn {
    width: 22px; height: 22px;
    background: var(--brand);
    color: var(--white);
    border-radius: 50%;
    font-size: 10px;
    font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 6px;
  }
  .step-box .si {
    font-size: 18px;
    margin-bottom: 4px;
    display: block;
  }
  .step-box .st {
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .step-box .sd {
    font-size: 9.5px;
    color: var(--muted);
    line-height: 1.4;
  }
  .step-arrow {
    display: flex;
    align-items: center;
    color: var(--mint);
    font-size: 16px;
    font-weight: 900;
    padding-top: 14px;
  }

  /* JOURNEY GRID */
  .journey-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .jcard {
    border-radius: 10px;
    padding: 14px 12px;
    border: 1.5px solid transparent;
  }
  .jcard.add    { background: var(--mint-lt); border-color: #6ee7b7; }
  .jcard.edit   { background: #eff6ff; border-color: #bfdbfe; }
  .jcard.delete { background: #fef2f2; border-color: #fecaca; }
  .jcard .ji { font-size: 22px; margin-bottom: 6px; }
  .jcard .jrole {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 8px;
  }
  .jcard.add .jrole    { color: var(--brand); }
  .jcard.edit .jrole   { color: #1d4ed8; }
  .jcard.delete .jrole { color: #991b1b; }
  .jcard .jsteps { list-style: none; }
  .jcard .jsteps li {
    font-size: 10px;
    color: var(--ink);
    padding: 4px 0;
    border-bottom: 1px dashed rgba(0,0,0,0.08);
    line-height: 1.4;
  }
  .jcard .jsteps li:last-child { border-bottom: none; }
  .jcard .jsteps li::before { content: "\\2192 "; font-weight: 700; opacity: 0.5; }

  /* TABLES */
  .ref-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 16px;
  }
  .ref-table th {
    background: var(--brand);
    color: var(--white);
    padding: 8px 10px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .ref-table th:first-child { border-radius: 8px 0 0 0; }
  .ref-table th:last-child  { border-radius: 0 8px 0 0; }
  .ref-table td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    line-height: 1.45;
    vertical-align: top;
  }
  .ref-table tr:nth-child(even) td { background: var(--bg); }
  .ref-table td.col-name { font-weight: 700; color: var(--brand); white-space: nowrap; }
  .ref-table code {
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 10px;
    color: var(--brand);
  }

  /* MISTAKE CARDS */
  .mistake-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }
  .mcard {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 11px 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .mcard .mn {
    width: 24px; height: 24px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .mcard .mt { font-size: 11px; font-weight: 700; color: var(--ink); margin-bottom: 3px; }
  .mcard .md { font-size: 10.5px; color: var(--muted); line-height: 1.4; }
  .mcard .fix {
    margin-top: 5px;
    background: var(--mint-lt);
    border-radius: 5px;
    padding: 4px 8px;
    font-size: 10px;
    font-weight: 600;
    color: var(--brand);
  }
  .mcard.wide { grid-column: span 2; }

  /* QUICK REF */
  .qref-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .qcard {
    background: var(--brand);
    border-radius: 10px;
    padding: 12px 12px;
    color: var(--white);
  }
  .qcard .ql {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--mint);
    margin-bottom: 8px;
  }
  .qcard ul { list-style: none; }
  .qcard ul li {
    font-size: 10.5px;
    color: rgba(255,255,255,0.85);
    padding: 3.5px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    line-height: 1.35;
  }
  .qcard ul li:last-child { border-bottom: none; }
  .qcard ul li strong { color: var(--white); font-weight: 700; }

  /* RAG PILLS */
  .rag-pill { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.3px; }
  .rag-green { background: #dcfce7; color: #15803d; }
  .rag-amber { background: #fef3c7; color: #854d0e; }
  .rag-red   { background: #fee2e2; color: #991b1b; }

  /* RAG GUIDE */
  .rag-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin: 14px 0;
  }
  .rag-item {
    background: var(--bg);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .rag-item.green { border-top: 4px solid #16a34a; }
  .rag-item.amber { border-top: 4px solid #f59e0b; }
  .rag-item.red   { border-top: 4px solid #ef4444; }
  .rag-item .rh { font-size: 11px; font-weight: 800; margin-bottom: 6px; }
  .rag-item.green .rh { color: #15803d; }
  .rag-item.amber .rh { color: #92400e; }
  .rag-item.red .rh   { color: #991b1b; }
  .rag-item .rd { font-size: 10.5px; color: var(--muted); line-height: 1.5; }

  /* FREQUENCY GRID */
  .freq-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 14px 0;
  }
  .fcard {
    background: var(--brand);
    border-radius: 10px;
    padding: 12px;
    color: var(--white);
    text-align: center;
  }
  .fcard .ficon { font-size: 22px; margin-bottom: 6px; }
  .fcard .fname { font-size: 11px; font-weight: 800; color: var(--mint); margin-bottom: 3px; letter-spacing: 0.4px; }
  .fcard .ffmt {
    font-size: 10px;
    color: rgba(255,255,255,0.65);
    font-family: 'Consolas', monospace;
    margin-bottom: 4px;
  }
  .fcard .fex { font-size: 10px; color: var(--white); font-weight: 600; }

  /* TAGS */
  .tag-new    { background: #dbeafe; color: #1d4ed8; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .tag-smart  { background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .tag-auto   { background: var(--mint-lt); color: var(--brand); font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase; }

  /* FILTER CHIPS DEMO */
  .filter-demo {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin: 10px 0;
    align-items: center;
  }
  .filter-demo .fd-search {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 5px 12px;
    font-size: 10px;
    color: var(--muted);
    flex: 1;
    min-width: 130px;
  }
  .filter-demo .fd-chip {
    background: var(--brand);
    color: var(--white);
    border-radius: 7px;
    padding: 5px 11px;
    font-size: 10px;
    font-weight: 700;
  }
  .filter-demo .fd-chip.active { background: var(--mint); color: var(--brand); }

  /* SUPPORT STRIP */
  .contact-strip {
    background: var(--mint-lt);
    border: 1.5px solid #a7f3d0;
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
  }
  .contact-strip .ci { font-size: 26px; }
  .contact-strip .ct { font-size: 12px; font-weight: 700; color: var(--brand); margin-bottom: 2px; }
  .contact-strip .cd { font-size: 11px; color: var(--muted); line-height: 1.4; }

  /* NUMBERED LIST */
  .numbered-steps { list-style: none; counter-reset: stepcounter; }
  .numbered-steps li {
    counter-increment: stepcounter;
    padding: 8px 12px 8px 42px;
    position: relative;
    font-size: 11.5px;
    color: var(--ink);
    line-height: 1.5;
    border-bottom: 1px solid var(--border);
  }
  .numbered-steps li:last-child { border-bottom: none; }
  .numbered-steps li::before {
    content: counter(stepcounter);
    position: absolute;
    left: 10px; top: 8px;
    width: 22px; height: 22px;
    background: var(--brand);
    color: var(--white);
    border-radius: 50%;
    font-size: 10px;
    font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .numbered-steps li strong { color: var(--brand); font-weight: 700; }
</style>
</head>
<body>

<!-- ════════════ PAGE 1 — COVER ════════════ -->
<div class="page cover-body">
  <div class="cover-hero">
    <div class="cover-badge"><div class="cb-dot"></div><span>GRC-001 &middot; Quick Start Guide</span></div>
    <div class="cover-title">Master the<br><em>GRC Dashboard</em></div>
    <div class="cover-subtitle">A complete admin guide in 6 pages</div>
    <div class="cover-roles">
      <div class="crole">GRC Administrator</div>
      <div class="crole">Risk Owner</div>
      <div class="crole">Audit &amp; Compliance</div>
    </div>
  </div>

  <div class="content">
    <div class="section-label">What the dashboard covers today</div>
    <div class="at-glance">
      <div class="agcard"><div class="agn">91</div><div class="agl">Key Risk Indicators tracked</div></div>
      <div class="agcard"><div class="agn">12</div><div class="agl">Departments monitored</div></div>
      <div class="agcard"><div class="agn">4</div><div class="agl">Reporting frequencies supported</div></div>
      <div class="agcard"><div class="agn">6</div><div class="agl">Live SharePoint lists wired in</div></div>
    </div>

    <div class="section-label" style="margin-bottom:8px">How to use this guide</div>
    <div class="howto-grid">
      <div class="htcard">
        <div class="htl">Daily Operations</div>
        <div class="htt">Adding KRI readings</div>
        <ul>
          <li>See Page 4 &mdash; Reading workflow</li>
          <li>Auto-RAG handles most of the work</li>
          <li>Backfill historical data via the same form</li>
        </ul>
      </div>
      <div class="htcard">
        <div class="htl">Setup &amp; Configuration</div>
        <div class="htt">Creating or editing KRIs</div>
        <ul>
          <li>See Page 3 &mdash; KRI management</li>
          <li>Set thresholds, direction, frequency</li>
          <li>Use Global Edit mode for changes</li>
        </ul>
      </div>
      <div class="htcard">
        <div class="htl">Reporting</div>
        <div class="htt">Risks, Appetite, Audits</div>
        <ul>
          <li>See Page 5 &mdash; Other modules</li>
          <li>Edit risk scores live</li>
          <li>Track corrective action progress</li>
        </ul>
      </div>
      <div class="htcard">
        <div class="htl">Troubleshooting</div>
        <div class="htt">Common pitfalls</div>
        <ul>
          <li>See Page 6 &mdash; Common mistakes</li>
          <li>Quick reference for every screen</li>
          <li>How to recover from deletions</li>
        </ul>
      </div>
    </div>

    <div class="tip-box">
      <div class="ti">&#128161;</div>
      <p><strong>The dashboard is a read-write tool.</strong> Everything you change here saves directly to SharePoint. There is no draft, no undo &mdash; review before clicking Save.</p>
    </div>

    <div class="scope-box">
      <div class="stt">What's new in this release</div>
      <p>The Dashboard recently gained features that make the daily workflow much faster &mdash; especially around KRI management and reading entry.</p>
      <div class="sgrid">
        <div><strong>Multi-filter table:</strong> Filter by Dept, Category, Sub-Cat, RAG &mdash; all at once.</div>
        <div><strong>Auto-RAG:</strong> RAG status fills in automatically when thresholds are numeric.</div>
        <div><strong>Reporting Frequency:</strong> Each KRI now has its own cadence (monthly to annual).</div>
        <div><strong>In-portal editing:</strong> Add, edit, delete KRIs and readings without touching SharePoint.</div>
      </div>
    </div>
  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; CONFIDENTIAL INTERNAL USE</span>
    <span class="pnum">1 / 6</span>
  </div>
</div>


<!-- ════════════ PAGE 2 — LOGIN + DASHBOARD TOUR ════════════ -->
<div class="page">
  <div class="page-header">
    <div class="logo-block">GRC</div>
    <div class="title-block">
      <div class="doc-title">Sign In &amp; Tour the Dashboard</div>
      <div class="doc-sub">Login &middot; KPI strip &middot; Filters &middot; KRI table</div>
    </div>
    <div class="doc-meta">GRC-001<br>Page 2 of 6</div>
  </div>

  <div class="content">

    <div class="section-label">Step 1 &mdash; Sign in (30 seconds)</div>
    <div class="step-row">
      <div class="step-box">
        <div class="sn">1</div><span class="si">&#127760;</span>
        <div class="st">Open the PMO Portal</div>
        <div class="sd">Use the link shared by your PMO team</div>
      </div>
      <div class="step-arrow">&rsaquo;</div>
      <div class="step-box">
        <div class="sn">2</div><span class="si">&#128309;</span>
        <div class="st">Sign in with Microsoft</div>
        <div class="sd">Use your existing work account</div>
      </div>
      <div class="step-arrow">&rsaquo;</div>
      <div class="step-box">
        <div class="sn">3</div><span class="si">&#128737;&#65039;</span>
        <div class="st">Click GRC</div>
        <div class="sd">In the sidebar &mdash; visible to GRC and GRC Admin roles</div>
      </div>
      <div class="step-arrow">&rsaquo;</div>
      <div class="step-box">
        <div class="sn">4</div><span class="si">&#9989;</span>
        <div class="st">You're in</div>
        <div class="sd">Live data loads directly from SharePoint</div>
      </div>
    </div>

    <hr class="divider">

    <div class="section-label">Understand the KPI strip <span class="tag-smart">FILTER-AWARE</span></div>
    <table class="ref-table">
      <thead><tr><th style="width:30%">KPI Card</th><th>What it tells you</th></tr></thead>
      <tbody>
        <tr><td class="col-name">Total KRIs</td><td>Active indicators. Becomes "Filtered KRIs (of 91)" when any filter is active &mdash; numbers reflect the visible subset only.</td></tr>
        <tr><td class="col-name">Breaching &mdash; Red</td><td>How many KRIs are in <span class="rag-pill rag-red">Red</span> based on their latest reading.</td></tr>
        <tr><td class="col-name">At Risk &mdash; Amber</td><td>How many KRIs are in <span class="rag-pill rag-amber">Amber</span> &mdash; need attention before they slip.</td></tr>
        <tr><td class="col-name">Within Limits</td><td>How many KRIs are healthy <span class="rag-pill rag-green">Green</span>.</td></tr>
        <tr><td class="col-name">Escalations Required</td><td>Readings flagged with "Escalation required" by the person who logged them.</td></tr>
      </tbody>
    </table>

    <div class="section-label" style="margin-top:18px">The KRI Status Board &mdash; column guide</div>
    <table class="ref-table">
      <thead><tr><th style="width:20%">Column</th><th>What you see</th></tr></thead>
      <tbody>
        <tr><td class="col-name">KRI Name</td><td>Indicator title + KRI ID. A small <code>&#128197; Quarterly</code> badge appears if the KRI's cadence is not monthly.</td></tr>
        <tr><td class="col-name">Department</td><td>Owning business unit (Cyber, Finance, HR, ...).</td></tr>
        <tr><td class="col-name">Category</td><td>Top-level risk category.</td></tr>
        <tr><td class="col-name">Sub-Category</td><td>Level-2 risk grouping (Fraud, Regulatory, Process, ...).</td></tr>
        <tr><td class="col-name">Current Value</td><td>The most recent reading + unit (% / days / count).</td></tr>
        <tr><td class="col-name">RAG / Trend</td><td>Status pill plus direction arrow (&uarr; Improving &middot; &darr; Worsening &middot; &mdash; Stable).</td></tr>
        <tr><td class="col-name">Period</td><td>The period of the latest reading (e.g. <code>2026-06</code> or <code>2026-Q2</code>).</td></tr>
        <tr><td class="col-name">Escalate</td><td><code>&#9888; Yes</code> when the last reading was flagged for escalation.</td></tr>
      </tbody>
    </table>

    <div class="section-label" style="margin-top:14px">Filter the table &mdash; multi-select friendly</div>
    <div class="filter-demo">
      <div class="fd-search">&#128269; Search name, ID, metric, source...</div>
      <div class="fd-chip active">Department &middot; 2</div>
      <div class="fd-chip">Category</div>
      <div class="fd-chip">Sub-Cat</div>
      <div class="fd-chip active">RAG &middot; 1</div>
      <div class="fd-chip" style="background:#fee2e2;color:#991b1b">&times; Clear all</div>
    </div>
    <div class="tip-box" style="margin-top:6px">
      <div class="ti">&#128269;</div>
      <p><strong>Tip:</strong> Selecting multiple values in a filter is an OR (any match). Combining filters across columns is an AND (must match all). The counter under the table header always shows <em>Showing X of 91</em> so you know how much is hidden.</p>
    </div>

  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; CONFIDENTIAL INTERNAL USE</span>
    <span class="pnum">2 / 6</span>
  </div>
</div>


<!-- ════════════ PAGE 3 — KRI MANAGEMENT ════════════ -->
<div class="page">
  <div class="page-header">
    <div class="logo-block">GRC</div>
    <div class="title-block">
      <div class="doc-title">Manage Your KRIs</div>
      <div class="doc-sub">Add &middot; Edit &middot; Delete &middot; Reporting frequency</div>
    </div>
    <div class="doc-meta">GRC-001<br>Page 3 of 6</div>
  </div>

  <div class="content">

    <div class="intro-banner">
      <p><strong>Quick recap:</strong> Each KRI has a name, a department, thresholds (Green/Amber/Red), a direction (lower or higher is better), a unit, and a reporting frequency. Once configured, the system handles the rest.</p>
    </div>

    <div class="section-label">Lifecycle &mdash; what you can do</div>
    <div class="journey-grid">
      <div class="jcard add">
        <div class="ji">&#10133;</div>
        <div class="jrole">Add a new KRI</div>
        <ul class="jsteps">
          <li>Click + Add KRI (top right)</li>
          <li>Title + Category required</li>
          <li>KRI ID auto-generated</li>
          <li>Set thresholds + direction</li>
          <li>Pick reporting frequency</li>
          <li>Click Create KRI</li>
        </ul>
      </div>
      <div class="jcard edit">
        <div class="ji">&#9999;&#65039;</div>
        <div class="jrole">Edit an existing KRI</div>
        <ul class="jsteps">
          <li>Toggle Global Edit ON</li>
          <li>Click Edit on the KRI row</li>
          <li>Update any field</li>
          <li>Adjust thresholds for new policy</li>
          <li>Change frequency if needed</li>
          <li>Click Save Changes</li>
        </ul>
      </div>
      <div class="jcard delete">
        <div class="ji">&#128465;&#65039;</div>
        <div class="jrole">Delete a KRI</div>
        <ul class="jsteps">
          <li>Toggle Global Edit ON</li>
          <li>Click the red bin icon</li>
          <li>Confirm the prompt</li>
          <li>Historical readings remain in SP</li>
          <li>Recoverable from SharePoint Recycle Bin (93 days)</li>
        </ul>
      </div>
    </div>

    <div class="section-label" style="margin-top:6px">Reporting Frequency &mdash; pick the right cadence <span class="tag-new">PER KRI</span></div>
    <div class="freq-grid">
      <div class="fcard">
        <div class="ficon">&#128197;</div>
        <div class="fname">Monthly</div>
        <div class="ffmt">YYYY-MM</div>
        <div class="fex">2026-06</div>
      </div>
      <div class="fcard">
        <div class="ficon">&#128467;&#65039;</div>
        <div class="fname">Quarterly</div>
        <div class="ffmt">YYYY-QN</div>
        <div class="fex">2026-Q2</div>
      </div>
      <div class="fcard">
        <div class="ficon">&#128198;</div>
        <div class="fname">Semi-Annual</div>
        <div class="ffmt">YYYY-HN</div>
        <div class="fex">2026-H1</div>
      </div>
      <div class="fcard">
        <div class="ficon">&#128197;</div>
        <div class="fname">Annual</div>
        <div class="ffmt">YYYY</div>
        <div class="fex">2026</div>
      </div>
    </div>

    <div class="tip-box">
      <div class="ti">&#128526;</div>
      <p><strong>Why this matters:</strong> When you set a KRI to Quarterly, the Add Reading form switches its Period picker to Q1-Q4. No more typos like <code>2026-Q2</code> entered as <code>2026-06</code>. The KRI table also shows a small <code>&#128197; Quarterly</code> badge so everyone knows the cadence at a glance.</p>
    </div>

    <div class="section-label" style="margin-top:14px">Field reference &mdash; the KRI master form</div>
    <table class="ref-table">
      <thead><tr><th style="width:25%">Field</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td class="col-name">KRI Name</td><td>The full descriptive title (required).</td></tr>
        <tr><td class="col-name">KRI ID</td><td>Auto-generated for new KRIs (e.g. <code>KRI-092</code>); read-only when editing.</td></tr>
        <tr><td class="col-name">Category</td><td>Top-level: Financial, Operational, Compliance, Conduct of Business, IT, Strategic, Reputational.</td></tr>
        <tr><td class="col-name">Business Unit</td><td>The owning department.</td></tr>
        <tr><td class="col-name">Risk Category L1 / Sub-Cat</td><td>Free-text taxonomy from your original risk register.</td></tr>
        <tr><td class="col-name">Metric / Base Data</td><td>The formula and the raw inputs needed to compute the KRI.</td></tr>
        <tr><td class="col-name">Data Source</td><td>The system or department that supplies the figures.</td></tr>
        <tr><td class="col-name">Unit</td><td>%, days, count &mdash; displays next to readings.</td></tr>
        <tr><td class="col-name">Thresholds</td><td>Green / Amber / Red &mdash; accept numbers or text (<code>&gt;=1</code>, <code>In Between</code>...).</td></tr>
        <tr><td class="col-name">Direction</td><td>Tells the system which side of the threshold is the bad side.</td></tr>
        <tr><td class="col-name">Reporting Frequency</td><td>Monthly / Quarterly / Semi-Annual / Annual.</td></tr>
        <tr><td class="col-name">Active KRI</td><td>Inactive KRIs are hidden from the table but data is preserved.</td></tr>
      </tbody>
    </table>

  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; CONFIDENTIAL INTERNAL USE</span>
    <span class="pnum">3 / 6</span>
  </div>
</div>


<!-- ════════════ PAGE 4 — READING WORKFLOW + AUTO-RAG ════════════ -->
<div class="page">
  <div class="page-header">
    <div class="logo-block">GRC</div>
    <div class="title-block">
      <div class="doc-title">The Reading Workflow</div>
      <div class="doc-sub">Add &middot; Edit &middot; Delete readings &middot; Auto-RAG explained</div>
    </div>
    <div class="doc-meta">GRC-001<br>Page 4 of 6</div>
  </div>

  <div class="content">

    <div class="section-label">Add a reading &mdash; 5 fields, 30 seconds</div>
    <ol class="numbered-steps">
      <li>In the KRI table, click <strong>+ Reading</strong> next to the KRI you want to update.</li>
      <li>Enter the <strong>Actual Value</strong> &mdash; this is the only required field beyond Period.</li>
      <li>Optionally enter <strong>Previous Value</strong> if you have it &mdash; helps confirm the trend direction.</li>
      <li>Pick the <strong>Period</strong>. The picker matches the KRI's frequency automatically (month, quarter, half, year).</li>
      <li>Set the <strong>RAG Status</strong> if Auto-RAG hasn't filled it in &mdash; otherwise just review the suggestion.</li>
      <li>Choose <strong>Trend</strong> (Improving / Stable / Worsening) and tick <strong>Escalation required</strong> if leadership needs to be alerted.</li>
      <li>Click <strong>Save Reading</strong>. The table and KPIs refresh immediately.</li>
    </ol>

    <hr class="divider" style="margin: 14px 0;">

    <div class="section-label">Auto-RAG &mdash; when the system helps <span class="tag-auto">SMART ASSIST</span></div>
    <div class="rag-row">
      <div class="rag-item green">
        <div class="rh">&#128161; Auto fills</div>
        <div class="rd">Both Green and Red thresholds are pure numbers AND the Direction is set. As soon as you type Actual Value, RAG snaps to the right colour.</div>
      </div>
      <div class="rag-item amber">
        <div class="rh">&#9888; Manual fallback</div>
        <div class="rd">Thresholds are text like <code>&gt;=1</code>, <code>In Between</code>, or <code>&lt;5%</code>. The system won't guess &mdash; you pick RAG yourself.</div>
      </div>
      <div class="rag-item red">
        <div class="rh">&#128274; Always editable</div>
        <div class="rd">Even when Auto-RAG fills in a value, you can override it with the dropdown. The user's choice always wins.</div>
      </div>
    </div>

    <div class="tip-box">
      <div class="ti">&#129504;</div>
      <p><strong>Worked example:</strong> KRI has Green=5, Amber=3, Red=1, Direction = "Lower is better".<br>
      &middot; Enter Actual Value = 4 &rarr; Auto-RAG suggests <span class="rag-pill rag-amber">Amber</span><br>
      &middot; Enter Actual Value = 6 &rarr; suggests <span class="rag-pill rag-green">Green</span><br>
      &middot; Enter Actual Value = 1 &rarr; suggests <span class="rag-pill rag-red">Red</span></p>
    </div>

    <hr class="divider" style="margin: 14px 0;">

    <div class="section-label">Edit or delete past readings</div>
    <ol class="numbered-steps">
      <li>Click any KRI row in the main table &mdash; the <strong>Trend Chart</strong> opens below.</li>
      <li>Scroll down to <strong>All Readings</strong> &mdash; the full history is listed by period.</li>
      <li>Click <strong>Edit</strong> on any reading to update value, RAG, trend, or comment.</li>
      <li>Click <strong>&#128465;</strong> (red bin) to delete a reading &mdash; confirm the prompt.</li>
    </ol>

    <div class="warn-box">
      <div class="wi">&#9888;&#65039;</div>
      <p><strong>Backfilling historical data?</strong> Just keep changing the Period to past months (or quarters) before saving. Order doesn't matter &mdash; the system always sorts chronologically when rendering the chart and computing the latest reading.</p>
    </div>

  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; CONFIDENTIAL INTERNAL USE</span>
    <span class="pnum">4 / 6</span>
  </div>
</div>


<!-- ════════════ PAGE 5 — OTHER MODULES ════════════ -->
<div class="page">
  <div class="page-header">
    <div class="logo-block">GRC</div>
    <div class="title-block">
      <div class="doc-title">Risks, Appetite, Audits</div>
      <div class="doc-sub">The other dashboard modules</div>
    </div>
    <div class="doc-meta">GRC-001<br>Page 5 of 6</div>
  </div>

  <div class="content">

    <div class="section-label">Risk Register &mdash; track active risks</div>
    <p style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      The Risk Register lists every open risk in the organisation, scored by Likelihood &times; Impact. The dashboard surfaces the Top Risks by Score and a Heatmap that groups risks into Critical, High, Medium and Low bands.
    </p>
    <table class="ref-table">
      <thead><tr><th>Action</th><th>How</th></tr></thead>
      <tbody>
        <tr><td class="col-name">Edit a risk</td><td>Click <strong>Edit</strong> next to the risk in the Top Risks list. Adjust Likelihood (1&ndash;5), Impact (1&ndash;5), Status, and Mitigation Summary. The score updates live.</td></tr>
        <tr><td class="col-name">Mark appetite breach</td><td>Tick "Risk Appetite Breached" when the risk exceeds the organisation's tolerance for its category.</td></tr>
        <tr><td class="col-name">Read the heatmap</td><td>Each cell groups risks by Likelihood x Impact. Click a populated cell to see the risk names inside.</td></tr>
      </tbody>
    </table>

    <hr class="divider" style="margin: 16px 0;">

    <div class="section-label">Risk Appetite &mdash; monitor tolerance</div>
    <p style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Defines the maximum tolerable exposure per risk category, and tracks the current exposure against that limit. Categories with breaches get a <span class="rag-pill rag-red">Breached</span> chip so you spot them instantly.
    </p>
    <table class="ref-table">
      <thead><tr><th style="width:30%">Field</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td class="col-name">Appetite Statement</td><td>The plain-language description of what the organisation is willing to accept for this category.</td></tr>
        <tr><td class="col-name">Max Tolerable Score</td><td>The numeric ceiling. Anything above is a breach.</td></tr>
        <tr><td class="col-name">Current Exposure</td><td>Today's measured exposure. Updated as new risk scores come in.</td></tr>
        <tr><td class="col-name">Status</td><td>One of <span class="rag-pill rag-green">Within Appetite</span> &middot; <span class="rag-pill rag-amber">Near Limit</span> &middot; <span class="rag-pill rag-red">Breached</span>.</td></tr>
      </tbody>
    </table>

    <hr class="divider" style="margin: 16px 0;">

    <div class="section-label">Audit Findings &amp; Corrective Actions</div>
    <p style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-bottom:10px">
      Audit Findings shows open observations from internal audit. Corrective Actions tracks the remediation work tied to those findings, with a live completion percentage and a clear overdue flag.
    </p>
    <table class="ref-table">
      <thead><tr><th style="width:25%">View</th><th>What it tells you</th></tr></thead>
      <tbody>
        <tr><td class="col-name">Open / Critical-High</td><td>The active findings that need attention, with severity counts.</td></tr>
        <tr><td class="col-name">Overdue</td><td>Findings or actions whose due date has passed without closure &mdash; the most important number on the page.</td></tr>
        <tr><td class="col-name">Closed</td><td>Historical record for audit trail and trending.</td></tr>
        <tr><td class="col-name">Overall Completion %</td><td>Aggregate progress across all open corrective actions. Trends downward = a sign that remediation is stalling.</td></tr>
      </tbody>
    </table>

    <div class="tip-box" style="margin-top: 12px;">
      <div class="ti">&#128221;</div>
      <p><strong>Workflow tip:</strong> When you log a new audit finding, immediately create the linked Corrective Action in the same view. This keeps the two lists in sync and lets the completion percentage reflect real progress.</p>
    </div>

  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; CONFIDENTIAL INTERNAL USE</span>
    <span class="pnum">5 / 6</span>
  </div>
</div>


<!-- ════════════ PAGE 6 — MISTAKES + QUICK REF + SUPPORT ════════════ -->
<div class="page">
  <div class="page-header">
    <div class="logo-block">GRC</div>
    <div class="title-block">
      <div class="doc-title">Common Mistakes &amp; Quick Reference</div>
      <div class="doc-sub">What to avoid &middot; Where to find things &middot; Where to get help</div>
    </div>
    <div class="doc-meta">GRC-001<br>Page 6 of 6</div>
  </div>

  <div class="content">

    <div class="section-label">5 common mistakes &mdash; and how to avoid them</div>
    <div class="mistake-grid">
      <div class="mcard">
        <div class="mn">1</div>
        <div>
          <div class="mt">Editing readings outside the dashboard</div>
          <div class="md">Going to SharePoint lists directly bypasses validation and may break the trend chart for everyone else.</div>
          <div class="fix">&#10003; Always use the dashboard's All Readings list &mdash; Edit and Delete are there.</div>
        </div>
      </div>
      <div class="mcard">
        <div class="mn">2</div>
        <div>
          <div class="mt">Mixing reading frequencies on the same KRI</div>
          <div class="md">Logging some readings as monthly and others as quarterly on the same KRI makes the trend chart unreadable.</div>
          <div class="fix">&#10003; Set the right frequency once, then always use the Period picker that appears.</div>
        </div>
      </div>
      <div class="mcard">
        <div class="mn">3</div>
        <div>
          <div class="mt">Trusting Auto-RAG without checking thresholds</div>
          <div class="md">If thresholds are stale or wrong, Auto-RAG will confidently suggest the wrong colour. The chart looks fine; the data is misleading.</div>
          <div class="fix">&#10003; Review thresholds and direction whenever business policy changes.</div>
        </div>
      </div>
      <div class="mcard">
        <div class="mn">4</div>
        <div>
          <div class="mt">Deleting a KRI to "clean up"</div>
          <div class="md">Deletion is permanent in the UI and historical readings become orphaned. Hard to recover without a SharePoint admin.</div>
          <div class="fix">&#10003; Untick "Active KRI" instead &mdash; it hides from the table but preserves history.</div>
        </div>
      </div>
      <div class="mcard wide">
        <div class="mn">5</div>
        <div>
          <div class="mt">Forgetting that the dashboard reads live SharePoint data</div>
          <div class="md">There is no caching layer. Every Save writes directly to SharePoint. Every Refresh re-fetches from SharePoint. If two admins edit at the same time, the last save wins &mdash; review whose change came in last before reverting.</div>
          <div class="fix">&#10003; Coordinate with your team during bulk updates. When in doubt, click Refresh and re-check before editing.</div>
        </div>
      </div>
    </div>

    <hr class="divider" style="margin: 14px 0;">

    <div class="section-label">Quick reference &mdash; where to find what <span class="tag-new">DASHBOARD MAP</span></div>
    <div class="qref-grid">
      <div class="qcard">
        <div class="ql">KRI Status Board</div>
        <ul>
          <li><strong>Filters &amp; search</strong></li>
          <li>+ Add KRI button</li>
          <li>+ Reading per KRI</li>
          <li>Trend chart on click</li>
          <li>All Readings list (Edit / Delete)</li>
        </ul>
      </div>
      <div class="qcard">
        <div class="ql">Header bar</div>
        <ul>
          <li><strong>Refresh</strong> &mdash; reload from SP</li>
          <li>Print Report &mdash; PDF/HTML export</li>
          <li>Global Edit toggle</li>
          <li>Last refreshed timestamp</li>
        </ul>
      </div>
      <div class="qcard">
        <div class="ql">Other modules</div>
        <ul>
          <li><strong>Risk Register</strong> + Heatmap</li>
          <li>Risk Appetite per category</li>
          <li>Audit Findings summary</li>
          <li>Corrective Actions tracker</li>
        </ul>
      </div>
    </div>

    <div class="contact-strip">
      <div class="ci">&#129309;</div>
      <div>
        <div class="ct">Need help? Contact your PMO team</div>
        <div class="cd">For access issues, login problems, or questions about the dashboard &mdash; reach out to your PMO coordinator. For SharePoint or IT-related access, contact the IT helpdesk with "GRC Dashboard" in the subject line.</div>
      </div>
    </div>

  </div>

  <div class="page-footer">
    <span>GRC-001 &middot; Admin Quick Start Guide &middot; For internal distribution only &middot; &copy; 2026 PMO</span>
    <span class="pnum">6 / 6</span>
  </div>
</div>

</body>
</html>`;

const outPath = path.join(__dirname, '..', '..', 'GRC-Admin-Guide-EN.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote HTML:', outPath);
console.log('Size:', html.length, 'bytes');
