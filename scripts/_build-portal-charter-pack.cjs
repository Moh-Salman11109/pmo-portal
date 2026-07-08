// PMO Portal governance pack — three official PDFs:
//   1. Project Charter   (mirrors the official "Tree – Project Charter Template" sections 1–7)
//   2. Business Case     (light, one-pager+, the attachment section 3 refers to)
//   3. Project Plan      (Dec 2025 → Aug 2026, phase Gantt + milestone table)
// Pattern: Inter + Tree brand palette + Puppeteer (canonical _build-grc-guide-v2.cjs).
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/charter-pack";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Shared chrome ───────────────────────────────────────────────────────────
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 10.5px; color: #0d1f1c; background: #fff; line-height: 1.55; }
  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm 20mm; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .band { background: linear-gradient(135deg, #001f1a 0%, #003932 60%, #0a5448 100%); color: #fff;
    margin: -18mm -20mm 10mm; padding: 12mm 20mm 9mm; border-bottom: 3px solid #00FFB3; position: relative; overflow: hidden; }
  .band::after { content: ''; position: absolute; bottom: -70px; right: -70px; width: 210px; height: 210px; background: rgba(0,255,179,0.10); border-radius: 50%; }
  .band .word { display: inline-flex; align-items: center; justify-content: center; background: #00FFB3; color: #003932;
    font-weight: 800; font-size: 13px; border-radius: 9px; padding: 5px 12px; letter-spacing: -0.3px; margin-bottom: 12px; }
  .band .doc-type { font-size: 10px; color: #00FFB3; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; opacity: 0.9; }
  .band h1 { font-size: 23px; font-weight: 900; letter-spacing: -0.4px; margin-bottom: 4px; }
  .band .sub { font-size: 10.5px; opacity: 0.72; }
  .band .meta-row { display: flex; gap: 26px; margin-top: 12px; position: relative; z-index: 1; flex-wrap: wrap; }
  .band .meta-row .m .k { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: #A1B9AB; font-weight: 700; margin-bottom: 1px; }
  .band .meta-row .m .v { font-size: 11px; font-weight: 700; }

  h2.sec { font-size: 12.5px; font-weight: 900; color: #003932; letter-spacing: 0.05em; text-transform: uppercase;
    border-bottom: 2px solid #003932; padding-bottom: 5px; margin: 16px 0 9px; display: flex; align-items: baseline; gap: 8px; }
  h2.sec .no { color: #00b894; font-size: 11px; }
  h3.sub { font-size: 11px; font-weight: 800; color: #0a5448; margin: 10px 0 5px; }
  p.hint { font-size: 9px; color: #7a9485; font-style: italic; margin-bottom: 7px; }
  p { margin-bottom: 7px; }
  ul { margin: 0 0 8px 16px; }
  li { margin-bottom: 3.5px; }

  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; }
  th { background: #f1f6f2; color: #3a5547; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
    text-align: left; padding: 6px 9px; border: 1px solid #dbe5dd; }
  td { padding: 6px 9px; border: 1px solid #e4ece6; vertical-align: top; }
  tr:nth-child(even) td { background: #fbfdfb; }

  .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .kv .cell { border: 1px solid #dbe5dd; border-radius: 8px; padding: 8px 11px; background: #fbfdfb; }
  .kv .cell .k { font-size: 8px; font-weight: 800; color: #7a9485; text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 2px; }
  .kv .cell .v { font-size: 11.5px; font-weight: 700; color: #003932; }

  .chip { display: inline-block; background: #ccfff0; color: #003932; font-size: 8.5px; font-weight: 800; padding: 2px 9px; border-radius: 10px; }
  .callout { background: #f2faf6; border-left: 3px solid #00b894; border-radius: 0 8px 8px 0; padding: 9px 13px; margin-bottom: 10px; font-size: 10px; }
  .callout.warn { background: #fdf6f1; border-left-color: #FF5000; }

  .cb { display: inline-flex; width: 11px; height: 11px; border: 1.4px solid #3a5547; border-radius: 2.5px; margin-right: 5px;
    vertical-align: -1.5px; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: #003932; }
  .cb.on { background: #ccfff0; border-color: #00b894; }
  .yn { white-space: nowrap; }
  .yn .lbl { margin-right: 14px; font-weight: 600; }

  .footer-line { position: absolute; bottom: 9mm; left: 20mm; right: 20mm; border-top: 1px solid #dbe5dd;
    padding-top: 4px; display: flex; justify-content: space-between; font-size: 8px; color: #7a9485; }

  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
  .sig { border: 1px solid #dbe5dd; border-radius: 10px; padding: 12px 14px; background: #fbfdfb; }
  .sig .role { font-size: 8.5px; font-weight: 800; color: #7a9485; text-transform: uppercase; letter-spacing: 0.09em; }
  .sig .name { font-size: 12px; font-weight: 800; color: #003932; margin: 3px 0 16px; }
  .sig .line { border-bottom: 1.4px solid #3a5547; margin-bottom: 4px; }
  .sig .cap { font-size: 8px; color: #7a9485; }
`;

const band = (docType, title, sub, metas) => `
  <div class="band">
    <div class="word">tree</div>
    <div class="doc-type">${docType}</div>
    <h1>${title}</h1>
    <div class="sub">${sub}</div>
    <div class="meta-row">${metas.map(([k, v]) => `<div class="m"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>
  </div>`;

const footer = (label) => `<div class="footer-line"><span>Tree Digital Insurance Company · Strategy &amp; PMO</span><span>${label} · Internal</span></div>`;

const yes = `<span class="yn"><span class="lbl"><span class="cb on">✓</span>Yes</span><span class="lbl"><span class="cb"></span>No</span></span>`;
const no  = `<span class="yn"><span class="lbl"><span class="cb"></span>Yes</span><span class="lbl"><span class="cb on">✓</span>No</span></span>`;

// ════════════════════════════════════════════════════════════════════════════
//  1. PROJECT CHARTER
// ════════════════════════════════════════════════════════════════════════════
const CHARTER = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style></head><body>

<div class="page">
  ${band("Project Charter", "Enterprise PMO Portal", "Governed portfolio management platform for Tree Digital Insurance",
    [["Project Type", "Internal Project"], ["Date of Charter", "14 December 2025"], ["Sponsor", "Abdulrahman Alhumaid"], ["Project Manager", "Mohammed Alabdulmuhsin"]])}

  <h2 class="sec"><span class="no">01</span> Project Purpose &amp; Objectives</h2>
  <p>Project tracking at Tree today is fragmented across spreadsheets, e-mail threads, and slide decks. Status is
  compiled by hand for every reporting cycle, figures differ between owners, and leadership has no live view of
  where the portfolio actually stands. As the project portfolio grows, this manual model does not scale and
  weakens governance over gates, budgets, and delivery commitments.</p>
  <p>This project delivers an <strong>Enterprise PMO Portal</strong> — a single, governed platform on the company's existing
  Microsoft 365 estate — with the following objectives:</p>
  <ul>
    <li><strong>Single source of truth</strong> — one live record per project (schedule, budget, risks, documents, approvals), replacing scattered files.</li>
    <li><strong>Objective performance measurement</strong> — an Index of Project Implementation (IPI) computed from schedule, cost, and artefact-compliance signals, with an immutable audit history per update.</li>
    <li><strong>Gate governance</strong> — the five-gate lifecycle (Request → Initiation → Planning → Execution → Closure) enforced in the system, with submissions, approvals, and sign-off trails.</li>
    <li><strong>Role-based visibility</strong> — nine access levels from executive read-only to PMO administration, so each stakeholder sees exactly their scope.</li>
    <li><strong>Executive self-service</strong> — portfolio and department dashboards that answer leadership questions without waiting for a compiled deck.</li>
  </ul>

  <h2 class="sec"><span class="no">02</span> Scope &amp; Deliverables</h2>
  <h3 class="sub">In scope</h3>
  <ul>
    <li>Web portal (single-page application) authenticated through the corporate directory (Microsoft Entra ID), with SharePoint Online as the system of record.</li>
    <li>Portfolio, department, and project-level dashboards; ten-tab project workspace (summary, health, schedule, budget, risks &amp; issues, approvals, benefits, documents, updates).</li>
    <li>IPI engine (SPI / CPI / artefact-compliance components) with time-weighted history and audit trail.</li>
    <li>Gate pipeline, PM update → PMO validation workflow, and new-project intake tracking.</li>
    <li>GRC dashboard: key-risk-indicator register with RAG status, thresholds, trends, and print reporting.</li>
    <li>Board-grade outputs: project status print report, executive Gantt, and What-If planning tools (IPI / Cost / ROI).</li>
  </ul>
  <h3 class="sub">Out of scope</h3>
  <ul>
    <li>Integration with core insurance / policy administration systems and the financial ERP.</li>
    <li>Native mobile applications (the portal is responsive in the browser).</li>
    <li>Resource-level time tracking and HR capacity planning.</li>
  </ul>
  <h3 class="sub">Key deliverables</h3>
  <table>
    <tr><th style="width:34%">Deliverable</th><th>Description</th></tr>
    <tr><td><strong>PMO Portal (production)</strong></td><td>Deployed portal on the corporate tenant, connected to SharePoint lists with role-based access for all nine roles.</td></tr>
    <tr><td><strong>IPI methodology &amp; engine</strong></td><td>Documented scoring methodology and its automated implementation, validated by an automated test suite.</td></tr>
    <tr><td><strong>GRC KRI dashboard</strong></td><td>Risk-indicator register with in-portal maintenance and executive print report.</td></tr>
    <tr><td><strong>Governance documentation</strong></td><td>Administrator guide, technical overview, and IPI methodology pack for handover and audit.</td></tr>
  </table>
  ${footer("Project Charter · Page 1 of 3")}
</div>

<div class="page">
  <h2 class="sec"><span class="no">03</span> Business Case</h2>
  <p>The portal is built entirely in-house on licences the company already owns (Microsoft 365 / SharePoint Online),
  at <strong>zero incremental build cost</strong>. Value is driven by removing recurring manual reporting effort, avoiding the
  licensing cost of a commercial PPM product, and materially improving decision quality and audit-readiness through
  live, tamper-evident performance data. The full overview — covering financial, operational, compliance, and
  customer-experience impact — is provided in the attached <strong>Business Case</strong> document.</p>

  <h2 class="sec"><span class="no">04</span> Budget &amp; Resource Plan</h2>
  <div class="kv">
    <div class="cell"><div class="k">Estimated cost (SAR)</div><div class="v">0 — internal build, no external spend</div></div>
    <div class="cell"><div class="k">Resources</div><div class="v">Internal (Strategy &amp; PMO) — no vendor involved</div></div>
  </div>
  <table>
    <tr><th style="width:72%">Capitalization assessment (IAS 38)</th><th>Answer</th></tr>
    <tr><td><strong>Capitalization required?</strong></td><td>${no}</td></tr>
    <tr><td>Is there an identifiable asset that will generate expected future economic benefits?</td><td>${yes}</td></tr>
    <tr><td>Can the cost of generating the intangible asset internally be distinguished from the cost of running day-to-day operations?</td><td>${no}</td></tr>
    <tr><td>Is the cost incurred during the development phase of the project?</td><td>${yes}</td></tr>
    <tr><td>Is there technical feasibility of completing the intangible asset so that it will be available for use or sale?</td><td>${yes}</td></tr>
    <tr><td>Is there an intention to complete the intangible asset and use or sell it?</td><td>${yes}</td></tr>
    <tr><td>Is there an ability to use or sell the intangible asset?</td><td>${yes}</td></tr>
    <tr><td>Is there availability of adequate technical, financial and other resources to complete the development and to use or sell the intangible asset?</td><td>${yes}</td></tr>
  </table>
  <div class="callout">Development effort is delivered by existing PMO staff within normal duties and cannot be
  reliably distinguished from day-to-day operations; no external or incremental cost is incurred. Accordingly the
  IAS 38 recognition criteria are not fully met and <strong>no capitalization is required</strong> — all effort is expensed as incurred.</div>

  <h2 class="sec"><span class="no">05</span> Milestones &amp; Timeline</h2>
  <table>
    <tr><th style="width:44%">Milestone</th><th style="width:26%">Target Date</th><th>Owner</th></tr>
    <tr><td>Charter Approval</td><td>15/12/25</td><td>Abdulrahman Alhumaid</td></tr>
    <tr><td>Project Kick-off</td><td>05/01/26</td><td>Mohammed Alabdulmuhsin</td></tr>
    <tr><td>Major Deliverable #1 — Core portal live on company data</td><td>31/03/26</td><td>Mohammed Alabdulmuhsin</td></tr>
    <tr><td>UAT / Testing</td><td>15/07/26</td><td>Mohammed Alabdulmuhsin</td></tr>
    <tr><td>Go-Live</td><td>09/08/26</td><td>Mohammed Alabdulmuhsin</td></tr>
    <tr><td>Closure &amp; Sign-off</td><td>31/08/26</td><td>Abdulrahman Alhumaid</td></tr>
  </table>
  <p class="hint">The detailed phase plan (December 2025 → August 2026) is provided in the attached Project Plan.</p>
  ${footer("Project Charter · Page 2 of 3")}
</div>

<div class="page">
  <h2 class="sec"><span class="no">06</span> Risks, Dependencies &amp; Assumptions</h2>
  <h3 class="sub">Initial risks</h3>
  <table>
    <tr><th style="width:5%">#</th><th style="width:45%">Risk</th><th>Mitigation</th></tr>
    <tr><td>1</td><td>Key-person dependency — design and build are concentrated in a single internal resource.</td><td>Governance documentation pack, administrator guide, and automated test suite delivered as part of scope; handover session before closure.</td></tr>
    <tr><td>2</td><td>SharePoint permission model — portal authorization ultimately depends on correct list-level permissions; misconfiguration could expose or block data.</td><td>Joint permission review with IT before go-live; role-by-role access verification is an acceptance criterion.</td></tr>
    <tr><td>3</td><td>Adoption — PMs continue reporting by e-mail/Excel in parallel, eroding the single source of truth.</td><td>PMO mandates the portal as the sole update channel after go-live; PM update workflow kept lighter than the manual alternative.</td></tr>
    <tr><td>4</td><td>Scope creep — dashboard and feature requests during build extend the timeline.</td><td>Change requests assessed against the gate plan; post-go-live backlog for enhancements.</td></tr>
  </table>
  <h3 class="sub">Dependencies</h3>
  <ul>
    <li>IT: Entra ID application registration, consent, and SharePoint site/list permissions.</li>
    <li>PMO: department and project master data quality; adoption of the update cadence.</li>
    <li>Existing Microsoft 365 tenant availability (SharePoint Online, Power Automate).</li>
  </ul>
  <h3 class="sub">Assumptions</h3>
  <ul>
    <li>All users are internal Tree employees authenticated through the corporate directory.</li>
    <li>SharePoint Online remains the approved data platform for PMO records.</li>
    <li>No personal or policyholder data is stored in the portal — project governance data only.</li>
  </ul>

  <h2 class="sec"><span class="no">07</span> Acceptance Criteria</h2>
  <ul>
    <li>All nine roles verified in production — each sees exactly its intended scope (executive, PMO head/staff/admin, department head, PM, GRC, GRC admin, locked).</li>
    <li>End-to-end governance cycle demonstrated on live data: PM submits update → PMO validates/returns → dashboards and IPI history reflect it immediately.</li>
    <li>IPI engine validated by the automated test suite with zero failures at handover.</li>
    <li>SharePoint list permissions reviewed and signed off with IT.</li>
    <li>Executive print report accepted by the sponsor as the standard project status artefact.</li>
    <li>Governance documentation pack handed over to the PMO.</li>
  </ul>

  <div class="sig-grid">
    <div class="sig"><div class="role">Project Sponsor</div><div class="name">Abdulrahman Alhumaid</div><div class="line"></div><div class="cap">Signature &amp; date</div></div>
    <div class="sig"><div class="role">Project Manager</div><div class="name">Mohammed Alabdulmuhsin</div><div class="line"></div><div class="cap">Signature &amp; date</div></div>
  </div>
  ${footer("Project Charter · Page 3 of 3")}
</div>
</body></html>`;

// ════════════════════════════════════════════════════════════════════════════
//  2. BUSINESS CASE (light attachment)
// ════════════════════════════════════════════════════════════════════════════
const BUSINESS_CASE = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>${BASE_CSS}
  .val-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .val { border: 1px solid #dbe5dd; border-radius: 10px; padding: 11px 14px; background: #fbfdfb; }
  .val .t { font-size: 10.5px; font-weight: 900; color: #003932; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px;
    padding-bottom: 4px; border-bottom: 2px solid #00FFB3; display: inline-block; }
  .val ul { margin-left: 14px; margin-bottom: 0; }
  .val li { font-size: 9.5px; margin-bottom: 3px; }
</style></head><body>

<div class="page">
  ${band("Business Case · Charter Attachment", "Enterprise PMO Portal", "Why building the portal in-house is the right call",
    [["Sponsor", "Abdulrahman Alhumaid"], ["Prepared by", "Mohammed Alabdulmuhsin"], ["Date", "14 December 2025"], ["Build Cost", "SAR 0 (internal)"]])}

  <h2 class="sec"><span class="no">A</span> The Problem</h2>
  <p>Every reporting cycle, project status is reassembled by hand from spreadsheets and e-mail. The same project can
  show different numbers in different decks; gate approvals live in inboxes; and no one can answer "how is the
  portfolio doing <em>today</em>?" without a day of compilation. Governance effort is spent producing reports instead of
  acting on them.</p>

  <h2 class="sec"><span class="no">B</span> Options Considered</h2>
  <table>
    <tr><th style="width:22%">Option</th><th style="width:44%">Assessment</th><th>Outcome</th></tr>
    <tr><td><strong>Keep the current model</strong></td><td>No cost, but manual effort grows with every added project and the governance gaps remain.</td><td>Rejected — does not scale</td></tr>
    <tr><td><strong>Buy a commercial PPM tool</strong></td><td>Feature-rich, but carries recurring per-user licensing, procurement lead time, vendor dependency, and still needs configuration to Tree's gate model.</td><td>Rejected — cost &amp; fit</td></tr>
    <tr><td><strong>Build in-house on M365</strong></td><td>Zero incremental cost, exact fit to Tree's five-gate governance and IPI methodology, data stays on the corporate tenant, full ownership.</td><td><span class="chip">SELECTED</span></td></tr>
  </table>

  <h2 class="sec"><span class="no">C</span> Value Drivers</h2>
  <div class="val-grid">
    <div class="val"><div class="t">Financial</div><ul>
      <li>Zero build cost — internal effort on existing M365 licences.</li>
      <li>Avoids recurring commercial PPM licensing for every portal user.</li>
      <li>Cuts hands-on compilation time each reporting cycle across PMO and PMs.</li>
    </ul></div>
    <div class="val"><div class="t">Operational</div><ul>
      <li>One live record per project — plans, budgets, risks, documents, approvals.</li>
      <li>IPI score computed automatically; status derived from data, not opinion.</li>
      <li>Gate pipeline shows bottlenecks; approvals queue in one place.</li>
    </ul></div>
    <div class="val"><div class="t">Compliance &amp; Audit</div><ul>
      <li>Immutable per-update IPI history — who reported what, and when.</li>
      <li>Document compliance tracked per gate (artefact compliance index).</li>
      <li>GRC key-risk-indicator register with thresholds and RAG trending.</li>
    </ul></div>
    <div class="val"><div class="t">Experience</div><ul>
      <li>Executives self-serve a live portfolio view — no waiting for decks.</li>
      <li>PMs update once, in minutes; the portal does the reporting.</li>
      <li>Board-grade print reports generated on demand from live data.</li>
    </ul></div>
  </div>

  <h2 class="sec"><span class="no">D</span> Costs &amp; Commitments</h2>
  <table>
    <tr><th style="width:30%">Item</th><th style="width:22%">Amount</th><th>Notes</th></tr>
    <tr><td>Build (Dec 2025 – Aug 2026)</td><td><strong>SAR 0</strong></td><td>Internal PMO effort within existing duties; expensed, no capitalization (see charter §4).</td></tr>
    <tr><td>Licences &amp; infrastructure</td><td><strong>SAR 0 incremental</strong></td><td>Runs on the existing Microsoft 365 / SharePoint Online tenant.</td></tr>
    <tr><td>Run &amp; maintain</td><td>Internal</td><td>PMO administers content; documentation pack enables support handover.</td></tr>
  </table>
  <div class="callout"><strong>Recommendation:</strong> proceed with the in-house build. The company gets a governance platform
  tailored to its own gate model at no incremental cost, with full ownership of both the data and the roadmap.</div>
  ${footer("Business Case · Page 1 of 1")}
</div>
</body></html>`;

// ════════════════════════════════════════════════════════════════════════════
//  3. PROJECT PLAN (Dec 2025 → Aug 2026)
// ════════════════════════════════════════════════════════════════════════════
// Phase bars: timeline spans Dec-25 .. Aug-26 = 9 months. Percent helpers.
const MONTHS = ["Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26"];
const P = (mFrom, mTo) => { // month indices inclusive, 0..8
  const left = (mFrom / 9) * 100;
  const width = ((mTo - mFrom + 1) / 9) * 100;
  return { left: left.toFixed(2), width: width.toFixed(2) };
};
const PHASES = [
  { name: "Phase 0 — Initiation & Charter",        from: 0, to: 0, color: "#003932", note: "Charter, stakeholder alignment, gate model agreed" },
  { name: "Phase 1 — Foundation",                  from: 1, to: 2, color: "#0a5448", note: "Entra ID auth, SharePoint lists & data layer, portal skeleton" },
  { name: "Phase 2 — Core Portal",                 from: 2, to: 4, color: "#00b894", note: "Dashboards, project workspace, role-based access (9 roles)" },
  { name: "Phase 3 — Governance Engine",           from: 4, to: 6, color: "#3a5547", note: "IPI engine + audit history, gate pipeline, PM→PMO validation" },
  { name: "Phase 4 — GRC & Reporting",             from: 6, to: 7, color: "#490300", note: "KRI dashboard, print reports, What-If planning tools" },
  { name: "Phase 5 — Hardening & UAT",             from: 7, to: 7, color: "#FF5000", note: "Role sweep, automated tests, permission review with IT, UAT" },
  { name: "Phase 6 — Go-Live & Closure",           from: 8, to: 8, color: "#b23800", note: "Production cut-over, adoption support, sign-off & handover" },
];
const ganttRows = PHASES.map(ph => {
  const { left, width } = P(ph.from, ph.to);
  return `<div class="g-row">
    <div class="g-name">${ph.name}</div>
    <div class="g-track">
      ${MONTHS.map((_, i) => `<div class="g-grid" style="left:${(i / 9 * 100).toFixed(2)}%"></div>`).join("")}
      <div class="g-bar" style="left:${left}%; width:${width}%; background:${ph.color}"></div>
    </div>
  </div>`;
}).join("");

const PLAN = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<style>${BASE_CSS}
  .g-wrap { border: 1px solid #dbe5dd; border-radius: 10px; padding: 12px 14px 10px; margin-bottom: 12px; background: #fff; }
  .g-axis { display: flex; margin-left: 34%; position: relative; height: 13px; margin-bottom: 5px; }
  .g-axis .t { position: absolute; transform: translateX(-50%); font-size: 7.5px; font-weight: 700; color: #7a9485; white-space: nowrap; }
  .g-row { display: flex; align-items: center; min-height: 22px; border-top: 1px solid #f0f5f1; }
  .g-name { width: 34%; flex-shrink: 0; font-size: 9px; font-weight: 700; color: #003932; padding: 4px 8px 4px 2px; line-height: 1.25; }
  .g-track { flex: 1; position: relative; height: 22px; }
  .g-grid { position: absolute; top: 0; bottom: 0; width: 1px; background: #eef3ef; }
  .g-bar { position: absolute; top: 5px; height: 12px; border-radius: 6px; opacity: 0.92; }
  .ms-dot { width: 8px; height: 8px; background: #00b894; border-radius: 2px; transform: rotate(45deg); display: inline-block; margin-right: 7px; }
</style></head><body>

<div class="page">
  ${band("Project Plan", "Enterprise PMO Portal", "Delivery plan · December 2025 → August 2026",
    [["Sponsor", "Abdulrahman Alhumaid"], ["Project Manager", "Mohammed Alabdulmuhsin"], ["Duration", "9 months"], ["Approach", "Phased, gate-governed"]])}

  <h2 class="sec"><span class="no">01</span> Delivery Approach</h2>
  <p>The portal is delivered in seven phases over nine months. Each phase produces working, reviewable output;
  governance features are built on top of a stable core rather than all at once. UAT and a permission review with IT
  gate the go-live. The plan follows Tree's five-gate lifecycle — Gates 1–3 are cleared during Initiation and
  Foundation, Gate 4 (Execution) spans the build phases, and Gate 5 closes the project after go-live.</p>

  <h2 class="sec"><span class="no">02</span> Phase Timeline</h2>
  <div class="g-wrap">
    <div class="g-axis">${MONTHS.map((m, i) => `<span class="t" style="left:${((i + 0.5) / 9 * 100).toFixed(2)}%">${m}</span>`).join("")}</div>
    ${ganttRows}
  </div>

  <h2 class="sec"><span class="no">03</span> Phase Detail</h2>
  <table>
    <tr><th style="width:26%">Phase</th><th style="width:17%">Window</th><th>Key outputs</th></tr>
    ${PHASES.map(ph => `<tr><td><strong>${ph.name.replace(/Phase \d — /, "")}</strong></td><td>${MONTHS[ph.from]}${ph.to !== ph.from ? " – " + MONTHS[ph.to] : ""}</td><td>${ph.note}</td></tr>`).join("")}
  </table>
  ${footer("Project Plan · Page 1 of 2")}
</div>

<div class="page">
  <h2 class="sec"><span class="no">04</span> Milestones</h2>
  <table>
    <tr><th style="width:5%"></th><th style="width:40%">Milestone</th><th style="width:20%">Target</th><th>Exit criteria</th></tr>
    <tr><td><span class="ms-dot"></span></td><td>Charter approved</td><td>15 Dec 2025</td><td>Sponsor sign-off on scope, plan, and acceptance criteria</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>Kick-off &amp; environment ready</td><td>05 Jan 2026</td><td>Entra ID app registered; SharePoint site &amp; lists provisioned</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>Core portal on live data</td><td>31 Mar 2026</td><td>Dashboards and project workspace reading/writing company data with role-based access</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>Governance engine complete</td><td>15 Jun 2026</td><td>IPI scoring with audit history; gate pipeline; PM update → PMO validation cycle working end-to-end</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>GRC &amp; reporting complete</td><td>10 Jul 2026</td><td>KRI dashboard operational; executive print report accepted</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>UAT complete</td><td>15 Jul 2026</td><td>Role-by-role verification passed; automated test suite green; IT permission review signed off</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>Go-Live</td><td>09 Aug 2026</td><td>Portal is the sole update channel; PMs onboarded</td></tr>
    <tr><td><span class="ms-dot"></span></td><td>Closure &amp; sign-off</td><td>31 Aug 2026</td><td>Documentation handover; sponsor closure approval (Gate 5)</td></tr>
  </table>

  <h2 class="sec"><span class="no">05</span> Workstreams &amp; Ownership</h2>
  <table>
    <tr><th style="width:26%">Workstream</th><th style="width:24%">Owner</th><th>Scope</th></tr>
    <tr><td>Design &amp; build</td><td>Mohammed Alabdulmuhsin</td><td>Portal, IPI engine, dashboards, reports, tests</td></tr>
    <tr><td>Identity &amp; permissions</td><td>IT (with PM)</td><td>Entra ID app consent, SharePoint site &amp; list permissions</td></tr>
    <tr><td>Data &amp; adoption</td><td>Strategy &amp; PMO</td><td>Master data quality, PM onboarding, update cadence</td></tr>
    <tr><td>Governance &amp; sign-off</td><td>Abdulrahman Alhumaid</td><td>Gate approvals, UAT acceptance, closure</td></tr>
  </table>

  <h2 class="sec"><span class="no">06</span> Plan Assumptions &amp; Controls</h2>
  <ul>
    <li>Progress is reviewed against this plan in the portal itself once the core is live — the project governs itself with its own tooling.</li>
    <li>Scope changes are assessed against the phase plan; enhancements discovered during build go to a post-go-live backlog.</li>
    <li>Go-live requires UAT completion <em>and</em> the IT permission review — whichever finishes later gates the date.</li>
    <li>A four-week adoption window after go-live is included before closure to stabilise usage and retire legacy reporting.</li>
  </ul>
  ${footer("Project Plan · Page 2 of 2")}
</div>
</body></html>`;

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const docs = [
    ["PMO-Portal-Project-Charter", CHARTER],
    ["PMO-Portal-Business-Case", BUSINESS_CASE],
    ["PMO-Portal-Project-Plan", PLAN],
  ];
  for (const [name, html] of docs) {
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise(r => setTimeout(r, 500));
    await page.pdf({ path: path.join(OUT, `${name}.pdf`), format: "A4", printBackground: true });
    // page-by-page PNG previews for eye verification
    await page.setViewport({ width: 794, height: 1123 });
    const pages = await page.$$(".page");
    for (let i = 0; i < pages.length; i++) {
      await pages[i].screenshot({ path: path.join(OUT, `_preview-${name}-p${i + 1}.png`) });
    }
    console.log(`${name}.pdf — ${pages.length} page(s)`);
  }
  await browser.close();
  console.log("Output:", OUT);
})();
