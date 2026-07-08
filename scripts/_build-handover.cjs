// Developer handover PDF — complete migration guide for the engineering team
// taking over the portal. Covers env vars, deployment paths, Azure AD config,
// SharePoint backend, and the migration scenarios (hosting / domain / auth).
//
// Output: Desktop/PMO-Portal-Deliverables/PMO-Portal-Handover.{html,pdf}

const fs = require('fs');
const path = require('path');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PMO Portal — Developer Handover</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  :root {
    --canopy:  #003932; --canopy-2: #005c4b; --canopy-3: #007a62;
    --sea:     #00FFB3; --sea-2:    #00b894;
    --orange:  #FF5000; --maroon:   #490300;
    --moss:    #5a7a6e; --lichen:   #C9D5C9;
    --lichen-lt: #ecf2ed;
    --ink:     #0d1f1c; --muted:    #4b6c67; --border: #d1e8e4;
    --blue:    #1e40af; --blue-lt:  #dbeafe;
    --amber:   #d97706; --amber-lt: #fef3c7;
    --red:     #b91c1c; --red-lt:   #fee2e2;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif;
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
    padding: 12px 18px;
    margin: -18mm -20mm 14px;
    display: flex; align-items: center; justify-content: space-between;
  }
  header.doc-header .brand { display: flex; align-items: center; gap: 12px; }
  header.doc-header .logo { width: 30px; height: 30px; }
  header.doc-header .org-line { line-height: 1.2; }
  header.doc-header .org-line .l { color: var(--sea); font-size: 8pt; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
  header.doc-header .org-line .n { color: white; font-size: 10pt; font-weight: 700; margin-top: 1px; }
  header.doc-header .doc-ref { text-align: right; }
  header.doc-header .doc-ref .l { color: rgba(255,255,255,0.55); font-size: 7pt; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
  header.doc-header .doc-ref .v { color: white; font-size: 8.5pt; font-weight: 600; }

  /* ── COVER ── */
  .cover-body {
    margin: -18mm -20mm -16mm;
    padding: 32mm 24mm 22mm;
    background:
      radial-gradient(circle at 88% 22%, rgba(0,255,179,0.10) 0%, transparent 42%),
      radial-gradient(circle at 12% 88%, rgba(0,255,179,0.06) 0%, transparent 38%),
      linear-gradient(135deg, #001f1a 0%, #003932 50%, #006b56 100%);
    color: white;
    flex: 1;
    display: flex; flex-direction: column; justify-content: space-between;
    border-bottom: 5px solid var(--sea);
    position: relative; overflow: hidden;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: center; }
  .cover-top .logo { height: 44px; }
  .cover-top .ver { background: var(--sea); color: var(--canopy); padding: 5px 14px; border-radius: 10px; font-size: 9pt; font-weight: 800; letter-spacing: 0.5px; }

  .cover-mid .label {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,255,179,0.16);
    border: 1px solid rgba(0,255,179,0.32);
    color: var(--sea);
    border-radius: 22px;
    padding: 5px 14px;
    margin-bottom: 22px;
    font-size: 9pt; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase;
  }
  .cover-mid .label .dot { width: 6px; height: 6px; background: var(--sea); border-radius: 50%; }
  .cover-mid h1 { color: white; font-size: 32pt; font-weight: 900; letter-spacing: -1px; line-height: 1.05; }
  .cover-mid h1 em { color: var(--sea); font-style: normal; }
  .cover-mid .sub { color: rgba(255,255,255,0.70); font-size: 12pt; font-weight: 400; line-height: 1.55; margin-top: 14px; max-width: 78%; }

  .cover-bot { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.15); }
  .cover-bot .item .l { color: rgba(0,255,179,0.78); font-size: 8pt; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 4px; }
  .cover-bot .item .v { color: white; font-size: 10pt; font-weight: 600; line-height: 1.4; }

  /* ── SECTION HEADINGS ── */
  section.s { margin-bottom: 14px; }
  section.s > .s-h {
    display: flex; align-items: baseline; gap: 12px;
    border-bottom: 1px solid var(--lichen);
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
  section.s > .s-h .num {
    color: var(--sea-2);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11pt; font-weight: 700;
  }
  section.s > .s-h h2 {
    font-size: 13pt; font-weight: 800;
    color: var(--canopy);
    letter-spacing: -0.2px;
  }
  section.s p {
    font-size: 9.5pt; color: var(--ink);
    line-height: 1.55;
    margin-bottom: 7px;
  }
  section.s p strong { color: var(--canopy); font-weight: 700; }

  /* ── SUBSECTIONS ── */
  h3.sub { font-size: 11pt; font-weight: 700; color: var(--canopy); margin: 10px 0 6px; }

  /* ── CODE BLOCK ── */
  pre.code {
    background: var(--canopy);
    color: #ccfff0;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt;
    line-height: 1.6;
    overflow-x: auto;
    margin: 8px 0;
    border-left: 3px solid var(--sea);
  }
  pre.code .c { color: rgba(204,255,240,0.55); }
  pre.code .k { color: var(--sea); }
  pre.code .v { color: white; }

  code.inline {
    background: var(--lichen-lt);
    color: var(--canopy);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5pt;
  }

  /* ── TABLE ── */
  table.t {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0;
    font-size: 9pt;
  }
  table.t thead th {
    background: var(--canopy);
    color: white;
    text-align: left;
    padding: 7px 11px;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  table.t thead th:first-child { border-radius: 6px 0 0 0; }
  table.t thead th:last-child { border-radius: 0 6px 0 0; }
  table.t tbody td {
    padding: 7px 11px;
    border-bottom: 1px solid var(--border);
    color: var(--ink);
    line-height: 1.4;
    vertical-align: top;
  }
  table.t tbody td.k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    color: var(--canopy);
    font-weight: 600;
  }
  table.t tbody td.label { font-weight: 700; color: var(--canopy); }
  table.t tbody tr:last-child td { border-bottom: 0; }

  /* ── CALLOUT ── */
  .callout {
    border-radius: 8px;
    padding: 10px 14px;
    margin: 8px 0;
    border-left: 4px solid;
  }
  .callout.warn { background: var(--amber-lt); border-color: var(--amber); }
  .callout.warn .h { color: #92400e; font-size: 9pt; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
  .callout.warn p { color: #78350f; font-size: 9pt; line-height: 1.5; }
  .callout.warn p strong { color: #78350f; }
  .callout.danger { background: var(--red-lt); border-color: var(--red); }
  .callout.danger .h { color: var(--red); font-size: 9pt; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
  .callout.danger p { color: #7f1d1d; font-size: 9pt; line-height: 1.5; }
  .callout.info { background: var(--blue-lt); border-color: var(--blue); }
  .callout.info .h { color: var(--blue); font-size: 9pt; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
  .callout.info p { color: #1e3a8a; font-size: 9pt; line-height: 1.5; }
  .callout.tip { background: var(--lichen-lt); border-color: var(--sea-2); }
  .callout.tip .h { color: var(--canopy); font-size: 9pt; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
  .callout.tip p { color: var(--ink); font-size: 9pt; line-height: 1.5; }

  /* ── TOC ── */
  .toc { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin-top: 8px; }
  .toc-item { display: flex; align-items: center; padding: 9px 0; border-bottom: 1px dashed var(--border); }
  .toc-item .n { width: 22px; height: 22px; background: var(--lichen-lt); color: var(--canopy); border-radius: 50%; font-size: 9pt; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-right: 11px; flex-shrink: 0; }
  .toc-item .t { flex: 1; }
  .toc-item .tn { font-size: 10pt; font-weight: 700; color: var(--canopy); }
  .toc-item .td { font-size: 8.5pt; color: var(--muted); margin-top: 1px; }
  .toc-item .p { background: var(--canopy); color: var(--sea); font-size: 8pt; font-weight: 700; padding: 2px 7px; border-radius: 8px; }

  /* ── DECISION TREE / FLOW ── */
  .flow {
    display: flex; flex-direction: column; gap: 8px;
    margin: 8px 0;
  }
  .flow-step {
    background: white;
    border: 1px solid var(--border);
    border-left: 4px solid var(--canopy);
    border-radius: 0 8px 8px 0;
    padding: 9px 13px;
  }
  .flow-step .num {
    background: var(--canopy); color: var(--sea);
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt; font-weight: 700;
    padding: 2px 7px; border-radius: 4px;
    margin-right: 8px;
    display: inline-block;
  }
  .flow-step .title { font-size: 10pt; font-weight: 700; color: var(--canopy); display: inline; }
  .flow-step .desc { font-size: 9pt; color: var(--ink); margin-top: 4px; line-height: 1.55; }
  .flow-step .desc code { background: var(--lichen-lt); padding: 1px 5px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; }

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

<!-- ════════════════════ COVER ════════════════════ -->
<div class="page">
  <div class="cover-body">
    <div class="cover-top">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="ver">V1 · 30 June 2026</div>
    </div>

    <div class="cover-mid">
      <div class="label"><div class="dot"></div><span>Developer Handover</span></div>
      <h1>PMO Portal —<br><em>Engineering Handover</em></h1>
      <div class="sub">Everything the frontend engineering team needs to take ownership of the portal: stack, repository, environment, deployment paths, and the migration scenarios from the current Vercel-hosted instance to the company infrastructure.</div>
    </div>

    <div class="cover-bot">
      <div class="item">
        <div class="l">Audience</div>
        <div class="v">Frontend Engineering Team<br>Tree Digital Insurance</div>
      </div>
      <div class="item">
        <div class="l">Prepared by</div>
        <div class="v">Mohammed Alabdulmuhsin<br>PMO Coordinator</div>
      </div>
      <div class="item">
        <div class="l">Document Reference</div>
        <div class="v">PMO-HANDOVER / 2026-06<br>Classification: Internal</div>
      </div>
    </div>
  </div>
</div>

<!-- ════════════════════ TOC ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">00</span><h2>Contents</h2></div>
    <div class="toc">
      <div class="toc-item"><div class="n">1</div><div class="t"><div class="tn">Overview &amp; Stack</div><div class="td">What it is, what's where</div></div><div class="p">p.3</div></div>
      <div class="toc-item"><div class="n">2</div><div class="t"><div class="tn">Repository &amp; Branches</div><div class="td">GitHub, branches, push flow</div></div><div class="p">p.3</div></div>
      <div class="toc-item"><div class="n">3</div><div class="t"><div class="tn">Local Development</div><div class="td">5-minute setup, mock mode</div></div><div class="p">p.4</div></div>
      <div class="toc-item"><div class="n">4</div><div class="t"><div class="tn">Environment Variables</div><div class="td">The full table of 21 vars</div></div><div class="p">p.4</div></div>
      <div class="toc-item"><div class="n">5</div><div class="t"><div class="tn">Production Build</div><div class="td">npm run build, output, SPA fallback</div></div><div class="p">p.5</div></div>
      <div class="toc-item"><div class="n">6</div><div class="t"><div class="tn">Migration Scenarios</div><div class="td">Hosting, domain, authentication</div></div><div class="p">p.6</div></div>
      <div class="toc-item"><div class="n">7</div><div class="t"><div class="tn">Azure AD Setup</div><div class="td">App registration &amp; redirect URIs</div></div><div class="p">p.7</div></div>
      <div class="toc-item"><div class="n">8</div><div class="t"><div class="tn">SharePoint Backend</div><div class="td">Lists, fields, provisioning script</div></div><div class="p">p.8</div></div>
      <div class="toc-item"><div class="n">9</div><div class="t"><div class="tn">Security Model</div><div class="td">What's enforced where</div></div><div class="p">p.9</div></div>
      <div class="toc-item"><div class="n">10</div><div class="t"><div class="tn">Testing &amp; Known Limits</div><div class="td">46 unit tests · V2 backlog</div></div><div class="p">p.10</div></div>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 2 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 1 & 2 — Overview + Repo ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">01</span><h2>Overview &amp; Stack</h2></div>
    <p>The PMO Portal is the enterprise project-management dashboard for Tree Digital Insurance. It is a single-page application that reads and writes its data directly to SharePoint Online, with no intermediate backend service. All workflow logic, IPI calculations, and role-based UI live in the client.</p>

    <table class="t">
      <thead><tr><th>Layer</th><th>Technology</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="label">Frontend</td><td>React 18 + Vite 6</td><td>JSX, no TypeScript</td></tr>
        <tr><td class="label">Authentication</td><td>MSAL · Azure AD (Entra ID)</td><td>Public client flow, no client secret</td></tr>
        <tr><td class="label">Backend</td><td>SharePoint Online REST API</td><td>4 lists: PMO_Projects, PMO_Departments, PMO_Users, New Project Request</td></tr>
        <tr><td class="label">Workflows</td><td>Power Automate</td><td>Approval routing on the Initiation list</td></tr>
        <tr><td class="label">Charts</td><td>Recharts</td><td>BarChart and LineChart usage only</td></tr>
        <tr><td class="label">Testing</td><td>Vitest</td><td>46 unit tests on the IPI engine</td></tr>
        <tr><td class="label">Current host</td><td>Vercel (auto-deploys from <code class="inline">main</code>)</td><td>To be replaced</td></tr>
      </tbody>
    </table>
  </section>

  <section class="s">
    <div class="s-h"><span class="num">02</span><h2>Repository &amp; Branches</h2></div>

    <h3 class="sub">Locations</h3>
    <table class="t">
      <thead><tr><th>Repo</th><th>URL</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr>
          <td class="label">Org (canonical)</td>
          <td class="k">github.com/TreeDigitalInsurance/<br>pmo-portal-frontend</td>
          <td>Primary. The engineering team works here.</td>
        </tr>
        <tr>
          <td class="label">Personal (backup)</td>
          <td class="k">github.com/Moh-Salman11109/<br>pmo-portal</td>
          <td>Mirror used by the current Vercel deployment. Will be retired once the migration is complete.</td>
        </tr>
      </tbody>
    </table>

    <h3 class="sub">Branches</h3>
    <table class="t">
      <thead><tr><th>Branch</th><th>Role</th></tr></thead>
      <tbody>
        <tr><td class="label k">main</td><td>Production. Vercel auto-deploys every commit here. Merge only via fast-forward from <code class="inline">dev</code>.</td></tr>
        <tr><td class="label k">dev</td><td>Active development. All feature work lands here first.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Workflow</h3>
    <pre class="code"><span class="c"># Work on dev</span>
git checkout dev
<span class="c"># …edit, commit…</span>
git push origin dev          <span class="c"># pushes to BOTH org and personal (dual-push configured)</span>

<span class="c"># Promote to production</span>
git checkout main
git merge --ff-only dev
git push origin main         <span class="c"># Vercel deploys</span>
git checkout dev</pre>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 3 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 3 & 4 — Local dev + Env vars ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">03</span><h2>Local Development Setup</h2></div>
    <p>Five-minute onboarding. Two modes are supported — <strong>mock</strong> (no Microsoft account required) and <strong>live</strong> (real SharePoint backend).</p>

    <pre class="code"><span class="c"># Clone</span>
git clone https://github.com/TreeDigitalInsurance/pmo-portal-frontend.git
cd pmo-portal-frontend

<span class="c"># Install</span>
npm install

<span class="c"># Create .env (mock mode — easiest)</span>
echo VITE_USE_MOCK=true &gt; .env
echo VITE_MOCK_EMAIL=admin@pmo.test &gt;&gt; .env

<span class="c"># Run</span>
npm run dev                  <span class="c"># http://localhost:5173</span></pre>

    <div class="callout tip">
      <div class="h">Switching mock roles</div>
      <p>In the browser console (development build only — guarded in production), run <code class="inline">localStorage.setItem('pmo_mock_email', 'pm.strategy@pmo.test'); location.reload();</code>. Available roles: <code class="inline">admin@pmo.test</code>, <code class="inline">pm.strategy@pmo.test</code>, <code class="inline">head.digital@pmo.test</code>, <code class="inline">exec@pmo.test</code>, <code class="inline">grc@pmo.test</code>.</p>
    </div>
  </section>

  <section class="s">
    <div class="s-h"><span class="num">04</span><h2>Environment Variables</h2></div>
    <p>All variables are prefixed <code class="inline">VITE_</code> and are <strong>inlined into the JS bundle at build time</strong> — they are configuration, not secrets. Real security comes from SharePoint list permissions, not from hiding these values.</p>

    <h3 class="sub">Required for live mode</h3>
    <table class="t">
      <thead><tr><th>Variable</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td class="k">VITE_USE_MOCK</td><td class="k">false</td></tr>
        <tr><td class="k">VITE_AZURE_CLIENT_ID</td><td class="k">9c40b5ce-b71e-4499-855a-2160bafe708d</td></tr>
        <tr><td class="k">VITE_AZURE_TENANT_ID</td><td class="k">b1d96f71-ea24-4d54-a40e-614cb5bb220c</td></tr>
        <tr><td class="k">VITE_AZURE_REDIRECT_URI</td><td class="k">(current host URL, see §7)</td></tr>
        <tr><td class="k">VITE_SP_SITE_URL</td><td class="k">https://treedigitalinsurance.sharepoint.com<br>/sites/PMO-2026</td></tr>
        <tr><td class="k">VITE_GRC_SP_SITE_URL</td><td class="k">https://treedigitalinsurance.sharepoint.com<br>/sites/GRC-Dashboard</td></tr>
      </tbody>
    </table>

    <h3 class="sub">SharePoint list names (defaults baked in code if blank)</h3>
    <table class="t">
      <thead><tr><th>Variable</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td class="k">VITE_SP_PROJECTS_LIST</td><td class="k">PMO_Projects</td></tr>
        <tr><td class="k">VITE_SP_DEPARTMENTS_LIST</td><td class="k">PMO_Departments</td></tr>
        <tr><td class="k">VITE_SP_USERS_LIST</td><td class="k">PMO_Users</td></tr>
        <tr><td class="k">VITE_SP_REQUESTS_LIST</td><td class="k">New Project Request</td></tr>
        <tr><td class="k">VITE_SP_GATE_SUBMISSIONS_LIST</td><td class="k">G1 - Project Initiation</td></tr>
        <tr><td class="k">VITE_SP_CLOSURE_LIST</td><td class="k">Project Closure - E-Signoff</td></tr>
        <tr><td class="k">VITE_SP_PAGE_SIZE</td><td class="k">500</td></tr>
      </tbody>
    </table>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 4 of 10</span>
  </footer>
</div>

<!-- ════════════════════ Env vars continued + Build ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">04</span><h2>Environment Variables (continued)</h2></div>

    <h3 class="sub">SharePoint form URLs (submission flows)</h3>
    <table class="t">
      <thead><tr><th>Variable</th><th>SharePoint list opened</th></tr></thead>
      <tbody>
        <tr><td class="k">VITE_SP_INTAKE_FORM_URL</td><td>New Project Request — full URL in attached .env file</td></tr>
        <tr><td class="k">VITE_SP_GATE1_FORM_URL</td><td>G1 - Project Initiation</td></tr>
        <tr><td class="k">VITE_SP_GATE3_FORM_URL</td><td>Project Plan (Gate 3)</td></tr>
        <tr><td class="k">VITE_SP_CLOSURE_FORM_URL</td><td>Project Closure - E-Signoff</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Approval routing emails (display only — My Actions queue)</h3>
    <table class="t">
      <thead><tr><th>Variable</th><th>Email</th></tr></thead>
      <tbody>
        <tr><td class="k">VITE_PMO_COORDINATOR_EMAIL</td><td class="k">malabdulmuhsin@tree.com.sa</td></tr>
        <tr><td class="k">VITE_FINANCE_STAGE1_EMAIL</td><td class="k">oalonezan@tree.com.sa</td></tr>
        <tr><td class="k">VITE_FINANCE_FINAL_EMAIL</td><td class="k">AbdulrahmanAlassaf@tree.com.sa</td></tr>
        <tr><td class="k">VITE_STRATEGY_EMAIL</td><td class="k">aalsolyem@tree.com.sa</td></tr>
      </tbody>
    </table>

    <div class="callout info">
      <div class="h">A complete .env file is attached</div>
      <p>The full file with all form URL values inlined is delivered alongside this document as <code class="inline">pmo-portal-handover.txt</code>. Drop it into the project root as <code class="inline">.env</code>.</p>
    </div>
  </section>

  <section class="s">
    <div class="s-h"><span class="num">05</span><h2>Production Build &amp; Hosting</h2></div>

    <pre class="code">npm run build       <span class="c"># outputs to dist/</span>
npm run preview     <span class="c"># preview the built bundle locally on port 4173</span></pre>

    <p>The <code class="inline">dist/</code> output is a folder of pure HTML, CSS, and JS files — no server runtime required. Any static-file host can serve it:</p>

    <table class="t">
      <thead><tr><th>Host</th><th>SPA fallback config</th></tr></thead>
      <tbody>
        <tr><td class="label">Azure App Service / Static Web Apps</td><td>Automatic when set up as SPA — recommended (same Microsoft 365 ecosystem)</td></tr>
        <tr><td class="label">IIS (Windows Server)</td><td><code class="inline">web.config</code> with URL Rewrite rule routing all unmatched paths to <code class="inline">/index.html</code></td></tr>
        <tr><td class="label">Nginx (Linux)</td><td><code class="inline">try_files $uri $uri/ /index.html;</code> in the location block</td></tr>
        <tr><td class="label">Apache</td><td><code class="inline">.htaccess</code> with <code class="inline">FallbackResource /index.html</code></td></tr>
      </tbody>
    </table>

    <div class="callout warn">
      <div class="h">SPA fallback is required</div>
      <p>The portal uses client-side routing. Without the fallback rule, refreshing a page like <code class="inline">/project/PRJ-2026-12</code> returns a 404. The fallback ensures the server always returns <code class="inline">index.html</code>, then React handles the route.</p>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 5 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 6 — Migration scenarios ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">06</span><h2>Migration Scenarios</h2></div>
    <p>Three migration paths are foreseen. They are mostly independent — you can do (A) without doing (B) or (C).</p>

    <h3 class="sub">A. Hosting only — Vercel → Tree infrastructure</h3>
    <div class="flow">
      <div class="flow-step"><span class="num">1</span><span class="title">Build the production bundle</span><div class="desc">Run <code>npm install &amp;&amp; npm run build</code> on a CI runner or developer machine. Output: <code>dist/</code> (~1.2 MB).</div></div>
      <div class="flow-step"><span class="num">2</span><span class="title">Provision a static host inside Tree infrastructure</span><div class="desc">Recommended: Azure App Service or Azure Static Web Apps (same M365 ecosystem as SharePoint). On-prem IIS is also fine.</div></div>
      <div class="flow-step"><span class="num">3</span><span class="title">Upload the <code>dist/</code> folder to the host</span><div class="desc">Manual upload, FTP, or CI/CD pipeline — whatever the team uses. Configure the SPA fallback (see §5).</div></div>
      <div class="flow-step"><span class="num">4</span><span class="title">Update Azure App Registration redirect URIs</span><div class="desc">See §7. Add the new host URL as an allowed redirect URI before going live.</div></div>
      <div class="flow-step"><span class="num">5</span><span class="title">Update <code>VITE_AZURE_REDIRECT_URI</code> and re-build</span><div class="desc">Point it at the new host URL. Re-build and re-upload.</div></div>
    </div>

    <div class="callout tip">
      <div class="h">SharePoint backend is untouched</div>
      <p>In this scenario the portal still reads and writes to the same PMO-2026 site. No SharePoint changes, no Power Automate changes, no data migration. The <code class="inline">PMO_*</code> lists, columns and permissions all stay as they are.</p>
    </div>

    <h3 class="sub">B. Domain change — switching to <code class="inline">pmo.tree.com.sa</code></h3>
    <div class="flow">
      <div class="flow-step"><span class="num">1</span><span class="title">Add a DNS record</span><div class="desc"><code>CNAME pmo.tree.com.sa → &lt;new host&gt;</code></div></div>
      <div class="flow-step"><span class="num">2</span><span class="title">Add the new URL to Azure App Registration</span><div class="desc">Without this, login fails with <code>AADSTS50011</code>. See §7.</div></div>
      <div class="flow-step"><span class="num">3</span><span class="title">Update <code>VITE_AZURE_REDIRECT_URI</code></span><div class="desc">Point it at the new domain, re-build, re-deploy.</div></div>
      <div class="flow-step"><span class="num">4</span><span class="title">Configure TLS</span><div class="desc">Most hosts handle this automatically once the CNAME resolves. For on-prem IIS, install the certificate manually.</div></div>
    </div>

    <h3 class="sub">C. Authentication change — Microsoft → corporate IAM</h3>
    <p>This is the most invasive migration. SharePoint Online <strong>only accepts Microsoft-issued tokens</strong>, so any non-Microsoft IAM (Okta, Keycloak, in-house OIDC, …) cannot directly authenticate against the backend.</p>

    <table class="t">
      <thead><tr><th>Option</th><th>Effort</th><th>Touches</th></tr></thead>
      <tbody>
        <tr><td class="label">Federate IAM with Entra ID</td><td>Low</td><td>Identity provider setup only — the portal continues to use MSAL, but the underlying identity now comes from the corporate IAM via federation.</td></tr>
        <tr><td class="label">Backend proxy (new service)</td><td>High</td><td>Build a Node/Java service that authenticates with corporate IAM, then talks to SharePoint with a service account. Portal calls the proxy, not SharePoint. Requires new infrastructure.</td></tr>
        <tr><td class="label">Replace SharePoint with a DB</td><td>Very high</td><td>Migrate all data to Cosmos DB / SQL Server / Postgres. Rewrite the data layer. Multi-month effort.</td></tr>
      </tbody>
    </table>

    <div class="callout warn">
      <div class="h">Recommendation</div>
      <p>Keep MSAL for tomorrow's deployment. If the corporate IAM is a hard requirement, plan it as a V2 initiative with federation as the first option — it preserves SharePoint as the backend and doesn't require rewriting the portal.</p>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 6 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 7 — Azure AD ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">07</span><h2>Azure AD / Entra ID Setup</h2></div>

    <p>The portal authenticates via MSAL public-client flow. There is no client secret — the redirect URI registered in Azure is what proves the calling app is legitimate.</p>

    <h3 class="sub">App registration</h3>
    <table class="t">
      <thead><tr><th>Property</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td class="label">Application (client) ID</td><td class="k">9c40b5ce-b71e-4499-855a-2160bafe708d</td></tr>
        <tr><td class="label">Directory (tenant) ID</td><td class="k">b1d96f71-ea24-4d54-a40e-614cb5bb220c</td></tr>
        <tr><td class="label">Account types</td><td>Single tenant (Tree Digital Insurance only)</td></tr>
        <tr><td class="label">Platform</td><td>Single-page application (SPA)</td></tr>
        <tr><td class="label">API permissions</td><td>Microsoft Graph: User.Read (delegated)<br>SharePoint: AllSites.Read (delegated)</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Updating redirect URIs (required for any new host)</h3>
    <div class="flow">
      <div class="flow-step"><span class="num">1</span><span class="title">Azure Portal → Microsoft Entra ID → App Registrations</span><div class="desc">Search for the application ID above.</div></div>
      <div class="flow-step"><span class="num">2</span><span class="title">Authentication → Single-page application → Redirect URIs</span><div class="desc">Click <strong>Add URI</strong>. Enter the new host URL exactly (with trailing slash).</div></div>
      <div class="flow-step"><span class="num">3</span><span class="title">Save</span><div class="desc">Changes propagate within ~60 seconds.</div></div>
    </div>

    <div class="callout danger">
      <div class="h">Symptom of a missing redirect URI</div>
      <p>Users see: <code class="inline">AADSTS50011: The redirect URI specified in the request does not match the redirect URIs configured for the application.</code> The fix is always: add the URL in step 2 above.</p>
    </div>

    <h3 class="sub">Token storage</h3>
    <p>MSAL stores access tokens in <code class="inline">sessionStorage</code> by default. This is the standard pattern but creates XSS exposure — any script injected into the portal could read the token. The risk is mitigated by the portal containing no user-generated HTML (no <code class="inline">dangerouslySetInnerHTML</code>, no third-party widgets). Hardening to HttpOnly cookies would require a backend proxy.</p>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 7 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 8 — SharePoint backend ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">08</span><h2>SharePoint Backend</h2></div>

    <p>All persistent data lives in a single SharePoint site, <code class="inline">/sites/PMO-2026</code>. The portal reads and writes via the SharePoint REST API directly from the browser, authenticated with the MSAL token.</p>

    <h3 class="sub">Lists</h3>
    <table class="t">
      <thead><tr><th>List</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td class="label k">PMO_Projects</td><td>Master project record. Complex data (milestones, risks, documents, etc.) stored as JSON strings in Multi-line Text fields.</td></tr>
        <tr><td class="label k">PMO_Departments</td><td>Department directory: id, name, icon, colour.</td></tr>
        <tr><td class="label k">PMO_Users</td><td>User roles and dept assignments. Drives RBAC.</td></tr>
        <tr><td class="label k">New Project Request</td><td>Project intake workflow.</td></tr>
        <tr><td class="label k">G1 - Project Initiation</td><td>Gate 1 stakeholder reviews. Approval routing runs in Power Automate on this list.</td></tr>
        <tr><td class="label k">Project Closure - E-Signoff</td><td>Closure submissions, awaiting PMO + stakeholder sign-off.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">JSON-in-text-field pattern</h3>
    <p>To avoid building separate child lists for milestones, risks, documents etc., these collections are serialised as JSON strings into Multi-line Text columns on the parent project (<code class="inline">MilestonesJSON</code>, <code class="inline">RisksJSON</code>, <code class="inline">DocumentsJSON</code>, etc.). The mapper layer in <code class="inline">src/services/sharepoint.js</code> handles serialisation and parsing.</p>

    <div class="callout warn">
      <div class="h">Scaling ceiling</div>
      <p>SharePoint Lists hold up to 5,000 items per list with reasonable performance. The current scale (~30 projects, 12 departments) is far below this ceiling. When the portfolio approaches ~1,000 active projects, a migration to a real relational database becomes worth planning.</p>
    </div>

    <h3 class="sub">Provisioning script</h3>
    <p>A helper script <code class="inline">scripts/provision-sharepoint.js</code> ships in the repository. It creates the lists and adds the columns the portal expects, intended to be pasted into the browser console while on the SharePoint site. <strong>This script is for fresh-site provisioning only.</strong> Do not run it against the current production site — the current lists already exist with slightly different names than the script's defaults (the script defaults are from an earlier draft).</p>

    <div class="callout info">
      <div class="h">When you'd actually use the provisioning script</div>
      <p>Only when migrating the data to a brand-new SharePoint site (e.g. a different tenant, or a clean rebuild). For a routine hosting move, the script is irrelevant — the existing site stays in place.</p>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 8 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 9 — Security ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">09</span><h2>Security Model</h2></div>

    <h3 class="sub">What's enforced where</h3>
    <table class="t">
      <thead><tr><th>Layer</th><th>Enforced by</th><th>What it does</th></tr></thead>
      <tbody>
        <tr><td class="label">Authentication</td><td>Azure AD (Entra ID)</td><td>Verifies the user's identity. Required to load any non-mock view.</td></tr>
        <tr><td class="label">Authorization (real)</td><td>SharePoint list permissions</td><td>The user's M365 identity must have read/write on each list. Without it, the REST call fails.</td></tr>
        <tr><td class="label">Authorization (UI)</td><td>React component checks on <code class="inline">userRole</code></td><td>Hides admin panels, edit buttons, and the GRC dashboard from users who shouldn't see them. <strong>This is convenience, not security.</strong> A technically-skilled user with their own AAD token could call SharePoint REST directly.</td></tr>
        <tr><td class="label">Mock-mode role override</td><td>Build mode guard</td><td>The browser-console role switcher only works in <code class="inline">vite dev</code>. Production builds (<code class="inline">vite build</code> / <code class="inline">vite preview</code>) ignore <code class="inline">localStorage</code> overrides — verified at <code class="inline">src/hooks/useCurrentUser.js</code>.</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Sensitive PMO field protection</h3>
    <p>The PMO uses a set of fields to record their own observations (PMO notes, validation flags, roadmap deadline). These fields are listed in <code class="inline">PMO_PROTECTED</code> in the application and are stripped from the request payload whenever a non-PMO user pushes an update — so a PM cannot accidentally (or deliberately) overwrite PMO commentary.</p>

    <h3 class="sub">VITE_ vars are not secrets</h3>
    <p>Anything prefixed <code class="inline">VITE_</code> ends up inlined in the production JS bundle. They are configuration values — Client ID, tenant ID, URLs, list names — not secrets. Do not store passwords or API keys there.</p>

    <div class="callout warn">
      <div class="h">npm audit</div>
      <p>Run <code class="inline">npm audit</code> regularly. As of the last security pass, the report is at <strong>0 vulnerabilities</strong> after upgrading Vite 5 → 6 to close a high-severity path-traversal advisory in the optimised-deps handler.</p>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 9 of 10</span>
  </footer>
</div>

<!-- ════════════════════ 10 — Testing + known limits ════════════════════ -->
<div class="page">
  <header class="doc-header">
    <div class="brand">
      <img class="logo" src="file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/Tree-Brand-Assets/Logos/logo%20sea%20green.png" alt="Tree">
      <div class="org-line">
        <div class="l">Developer Handover</div>
        <div class="n">PMO Portal · Tree Digital Insurance</div>
      </div>
    </div>
    <div class="doc-ref">
      <div class="l">Reference</div>
      <div class="v">PMO-HANDOVER / 2026-06</div>
    </div>
  </header>

  <section class="s">
    <div class="s-h"><span class="num">10</span><h2>Testing &amp; Known Limitations</h2></div>

    <h3 class="sub">Existing test suite</h3>
    <p>46 unit tests under Vitest, all in <code class="inline">src/utils/metrics.test.js</code>. Covers the IPI calculation engine: SPI, CPI, MCI, gate-aware doc logic, roadmap penalty, department rollup, portfolio rollup, time-weighted IPI, status banding.</p>

    <pre class="code">npm test            <span class="c"># 46 passing</span>
npm run lint        <span class="c"># ESLint (pre-existing react-hooks warnings, no new errors)</span>
npm run build       <span class="c"># builds in ~9s, ~1.2 MB bundle</span></pre>

    <h3 class="sub">Known limitations (V2 backlog)</h3>
    <table class="t">
      <thead><tr><th>Limitation</th><th>Why it's acceptable today</th><th>V2 fix</th></tr></thead>
      <tbody>
        <tr><td class="label">No E2E tests</td><td>IPI math is tested; UI flows are stable and changes are guarded by manual review</td><td>Playwright suite over key flows</td></tr>
        <tr><td class="label">Single 1.2 MB JS bundle</td><td>Internal app on Tree network, first-load cost is acceptable</td><td>Code-split with React.lazy per route</td></tr>
        <tr><td class="label">Token in sessionStorage</td><td>No XSS sinks in the portal; risk surface is bounded</td><td>HttpOnly cookies via a backend proxy</td></tr>
        <tr><td class="label">No audit log layer</td><td>Microsoft 365 audit log captures SharePoint changes</td><td>Application Insights with custom events</td></tr>
        <tr><td class="label">No error monitoring</td><td>Errors logged to browser console; users report issues directly</td><td>Sentry or Application Insights front-end SDK</td></tr>
        <tr><td class="label">Role checks UI-only</td><td>SharePoint list permissions are the actual authorisation boundary</td><td>Middleware layer (would require a backend proxy)</td></tr>
        <tr><td class="label">SharePoint 5,000-item ceiling</td><td>~30 active projects today, ~1.5% of the limit</td><td>Migrate to a database when scale demands</td></tr>
      </tbody>
    </table>

    <h3 class="sub">Reference companion documents</h3>
    <table class="t">
      <thead><tr><th>Document</th><th>Audience</th></tr></thead>
      <tbody>
        <tr><td class="label">PMO-Portal-IPI-Methodology</td><td>Tawuniya Balanced Scorecard team — math reference</td></tr>
        <tr><td class="label">PMO-Portal-IPI-Verification</td><td>Tawuniya Balanced Scorecard team — three-scenario audit</td></tr>
        <tr><td class="label">PMO-Portal-Tech-Overview</td><td>Executive committee — architecture summary</td></tr>
        <tr><td class="label">.env file</td><td>Engineering team — delivered alongside this PDF</td></tr>
      </tbody>
    </table>

    <div class="callout tip">
      <div class="h">Questions during the handover</div>
      <p>Contact Mohammed Alabdulmuhsin (<code class="inline">malabdulmuhsin@tree.com.sa</code>) for project-context questions. Architectural decisions documented in this PDF; deeper code questions can be answered by walking through <code class="inline">src/App.jsx</code> (section dividers in the file map every major component).</p>
    </div>
  </section>

  <footer class="doc-footer">
    <span><span class="b">PMO Portal Developer Handover</span> · Tree Digital Insurance</span>
    <span>Page 10 of 10 · End of document</span>
  </footer>
</div>

</body>
</html>`;

const outHtml = path.join('C:', 'Users', 'nioh1', 'Desktop', 'PMO-Portal-Deliverables', 'PMO-Portal-Handover.html');
fs.writeFileSync(outHtml, html, 'utf8');
console.log('Wrote HTML:', outHtml, '·', html.length, 'bytes');
