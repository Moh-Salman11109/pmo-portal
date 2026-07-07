import { useState } from "react";
import { useT } from "../theme.js";
import { Ico } from "./Icon.jsx";

// ============================================================================
//  DOC GENERATOR — self-service governance documents
// ============================================================================
//  Sidebar entry → picker → form → print-ready document in a new window
//  (browser Print → Save as PDF). Nothing is persisted anywhere — this is a
//  stateless stationery machine so PMs stop asking the PMO for Word templates.
//  Documents follow the official Tree charter template sections and the
//  brand design used across the portal's print artefacts.
// ============================================================================

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const lines = (s) => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
const bullets = (s) => {
  const ls = lines(s);
  return ls.length ? `<ul>${ls.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : `<p class="hint">—</p>`;
};

// ── Shared print chrome (same design language as the charter pack) ─────────
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; font-size: 10.5px; color: #0d1f1c; background: #fff; line-height: 1.55; }
  @page { size: A4; margin: 14mm 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  .sheet { width: 210mm; margin: 0 auto; padding: 0 20mm 10mm; }
  .band { background: linear-gradient(135deg, #001f1a 0%, #003932 60%, #0a5448 100%); color: #fff;
    margin: 0 -20mm 10mm; padding: 12mm 20mm 9mm; border-bottom: 3px solid #00FFB3; position: relative; overflow: hidden; }
  .band::after { content: ''; position: absolute; bottom: -70px; right: -70px; width: 210px; height: 210px; background: rgba(0,255,179,0.10); border-radius: 50%; }
  .band .word { display: inline-flex; background: #00FFB3; color: #003932; font-weight: 800; font-size: 13px; border-radius: 9px; padding: 5px 12px; letter-spacing: -0.3px; margin-bottom: 12px; }
  .band .doc-type { font-size: 10px; color: #00FFB3; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; opacity: 0.9; }
  .band h1 { font-size: 23px; font-weight: 900; letter-spacing: -0.4px; margin-bottom: 4px; }
  .band .sub { font-size: 10.5px; opacity: 0.72; }
  .band .meta-row { display: flex; gap: 26px; margin-top: 12px; position: relative; z-index: 1; flex-wrap: wrap; }
  .band .m .k { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: #A1B9AB; font-weight: 700; margin-bottom: 1px; }
  .band .m .v { font-size: 11px; font-weight: 700; }
  h2.sec { font-size: 12.5px; font-weight: 900; color: #003932; letter-spacing: 0.05em; text-transform: uppercase;
    border-bottom: 2px solid #003932; padding-bottom: 5px; margin: 16px 0 9px; display: flex; align-items: baseline; gap: 8px; page-break-after: avoid; }
  h2.sec .no { color: #00b894; font-size: 11px; }
  h3.sub { font-size: 11px; font-weight: 800; color: #0a5448; margin: 10px 0 5px; page-break-after: avoid; }
  p.hint { font-size: 9px; color: #7a9485; font-style: italic; margin-bottom: 7px; }
  p { margin-bottom: 7px; }
  ul { margin: 0 0 8px 16px; }
  li { margin-bottom: 3.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px; }
  th { background: #f1f6f2; color: #3a5547; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
    text-align: left; padding: 6px 9px; border: 1px solid #dbe5dd; }
  td { padding: 6px 9px; border: 1px solid #e4ece6; vertical-align: top; }
  tr:nth-child(even) td { background: #fbfdfb; }
  tr { page-break-inside: avoid; }
  .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
  .kv .cell { border: 1px solid #dbe5dd; border-radius: 8px; padding: 8px 11px; background: #fbfdfb; }
  .kv .cell .k { font-size: 8px; font-weight: 800; color: #7a9485; text-transform: uppercase; letter-spacing: 0.09em; margin-bottom: 2px; }
  .kv .cell .v { font-size: 11.5px; font-weight: 700; color: #003932; }
  .callout { background: #f2faf6; border-left: 3px solid #00b894; border-radius: 0 8px 8px 0; padding: 9px 13px; margin-bottom: 10px; font-size: 10px; page-break-inside: avoid; }
  .cb { display: inline-flex; width: 11px; height: 11px; border: 1.4px solid #3a5547; border-radius: 2.5px; margin-right: 5px;
    vertical-align: -1.5px; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; color: #003932; }
  .cb.on { background: #ccfff0; border-color: #00b894; }
  .yn .lbl { margin-right: 14px; font-weight: 600; white-space: nowrap; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; page-break-inside: avoid; }
  .sig { border: 1px solid #dbe5dd; border-radius: 10px; padding: 12px 14px; background: #fbfdfb; }
  .sig .role { font-size: 8.5px; font-weight: 800; color: #7a9485; text-transform: uppercase; letter-spacing: 0.09em; }
  .sig .name { font-size: 12px; font-weight: 800; color: #003932; margin: 3px 0 16px; }
  .sig .line { border-bottom: 1.4px solid #3a5547; margin-bottom: 4px; }
  .sig .cap { font-size: 8px; color: #7a9485; }
  .doc-footer { border-top: 1px solid #dbe5dd; margin-top: 14px; padding-top: 5px; display: flex; justify-content: space-between; font-size: 8px; color: #7a9485; }
  .print-btn { position: fixed; top: 14px; right: 14px; background: #003932; color: #00FFB3; border: none; border-radius: 10px;
    padding: 11px 20px; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.25); z-index: 50; }
`;

const band = (docType, title, sub, metas) => `
  <div class="band">
    <div class="word">tree</div>
    <div class="doc-type">${esc(docType)}</div>
    <h1>${esc(title) || "Untitled Project"}</h1>
    <div class="sub">${esc(sub)}</div>
    <div class="meta-row">${metas.map(([k, v]) => `<div class="m"><div class="k">${esc(k)}</div><div class="v">${esc(v) || "—"}</div></div>`).join("")}</div>
  </div>`;

const docFooter = (label) => `<div class="doc-footer"><span>Tree Digital Insurance Company · Strategy &amp; PMO</span><span>${esc(label)} · Internal</span></div>`;

const openDoc = (title, bodyHtml) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>${BASE_CSS}</style></head><body>
    <button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
    <div class="sheet">${bodyHtml}</div></body></html>`;
  const win = window.open("", "_blank", "width=1100,height=900");
  if (!win) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
  win.document.write(html);
  win.document.close();
};

// ── IAS 38 questions (mirrors the official template order) ─────────────────
const IAS_QUESTIONS = [
  "Capitalization required?",
  "Is there an identifiable asset that will generate expected future economic benefits?",
  "Can the cost of generating the intangible asset internally be distinguished from the cost of running day-to-day operations?",
  "Is the cost incurred during the development phase of the project?",
  "Is there technical feasibility of completing the intangible asset so that it will be available for use or sale?",
  "Is there an intention to complete the intangible asset and use or sell it?",
  "Is there an ability to use or sell the intangible asset?",
  "Is there availability of adequate technical, financial and other resources to complete the development and to use or sell the intangible asset?",
];
const ynHtml = (v) => v === "yes"
  ? `<span class="yn"><span class="lbl"><span class="cb on">✓</span>Yes</span><span class="lbl"><span class="cb"></span>No</span></span>`
  : v === "no"
    ? `<span class="yn"><span class="lbl"><span class="cb"></span>Yes</span><span class="lbl"><span class="cb on">✓</span>No</span></span>`
    : `<span class="yn"><span class="lbl"><span class="cb"></span>Yes</span><span class="lbl"><span class="cb"></span>No</span></span>`;

// ── Charter document ────────────────────────────────────────────────────────
const buildCharter = (f) => {
  const msRows = f.milestones.filter(m => m.name.trim()).map(m =>
    `<tr><td>${esc(m.name)}</td><td>${fmtD(m.date) || "—"}</td><td>${esc(m.owner) || "—"}</td></tr>`).join("");
  const riskRows = f.risks.filter(r => r.risk.trim()).map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.risk)}</td><td>${esc(r.mitigation) || "—"}</td></tr>`).join("");
  const delRows = f.deliverables.filter(d => d.name.trim()).map(d =>
    `<tr><td><strong>${esc(d.name)}</strong></td><td>${esc(d.desc) || "—"}</td></tr>`).join("");
  const body = `
    ${band("Project Charter", f.name, f.tagline || "Project Charter", [
      ["Project Type", f.type], ["Date of Charter", fmtD(f.date)], ["Sponsor", f.sponsor], ["Project Manager", f.pm]])}
    <h2 class="sec"><span class="no">01</span> Project Purpose &amp; Objectives</h2>
    ${f.purpose.trim() ? `<p>${esc(f.purpose)}</p>` : ""}
    ${bullets(f.objectives)}
    <h2 class="sec"><span class="no">02</span> Scope &amp; Deliverables</h2>
    <h3 class="sub">In scope</h3>${bullets(f.scopeIn)}
    <h3 class="sub">Out of scope</h3>${bullets(f.scopeOut)}
    ${delRows ? `<h3 class="sub">Key deliverables</h3><table><tr><th style="width:34%">Deliverable</th><th>Description</th></tr>${delRows}</table>` : ""}
    <h2 class="sec"><span class="no">03</span> Business Case</h2>
    ${f.businessCase.trim() ? `<p>${esc(f.businessCase)}</p>` : `<p class="hint">Overview provided as an attachment.</p>`}
    <h2 class="sec"><span class="no">04</span> Budget &amp; Resource Plan</h2>
    <div class="kv">
      <div class="cell"><div class="k">Estimated cost (SAR)</div><div class="v">${esc(f.cost) || "—"}</div></div>
      <div class="cell"><div class="k">Resources</div><div class="v">${esc(f.resources) || "—"}</div></div>
    </div>
    <table><tr><th style="width:72%">Capitalization assessment (IAS 38)</th><th>Answer</th></tr>
      ${IAS_QUESTIONS.map((q, i) => `<tr><td>${i === 0 ? `<strong>${q}</strong>` : q}</td><td>${ynHtml(f.ias[i])}</td></tr>`).join("")}
    </table>
    ${f.capNote.trim() ? `<div class="callout">${esc(f.capNote)}</div>` : ""}
    ${f.vendor.trim() ? `<h3 class="sub">Vendor details</h3><p>${esc(f.vendor)}</p>` : ""}
    <h2 class="sec"><span class="no">05</span> Milestones &amp; Timeline</h2>
    <table><tr><th style="width:44%">Milestone</th><th style="width:26%">Target Date</th><th>Owner</th></tr>${msRows || `<tr><td colspan="3">—</td></tr>`}</table>
    <h2 class="sec"><span class="no">06</span> Risks, Dependencies &amp; Assumptions</h2>
    <h3 class="sub">Initial risks</h3>
    <table><tr><th style="width:5%">#</th><th style="width:45%">Risk</th><th>Mitigation</th></tr>${riskRows || `<tr><td colspan="3">—</td></tr>`}</table>
    <h3 class="sub">Dependencies</h3>${bullets(f.dependencies)}
    <h3 class="sub">Assumptions</h3>${bullets(f.assumptions)}
    <h2 class="sec"><span class="no">07</span> Acceptance Criteria</h2>
    ${bullets(f.acceptance)}
    <div class="sig-grid">
      <div class="sig"><div class="role">Project Sponsor</div><div class="name">${esc(f.sponsor) || "—"}</div><div class="line"></div><div class="cap">Signature &amp; date</div></div>
      <div class="sig"><div class="role">Project Manager</div><div class="name">${esc(f.pm) || "—"}</div><div class="line"></div><div class="cap">Signature &amp; date</div></div>
    </div>
    ${docFooter("Project Charter")}`;
  openDoc(`${f.name || "Project"} — Charter`, body);
};

// ── Project Plan document (with Resource Plan section) ─────────────────────
const monthList = (from, to) => {
  if (!from || !to) return [];
  const out = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const d = new Date(fy, fm - 1, 1);
  const end = new Date(ty, tm - 1, 1);
  while (d <= end && out.length < 36) {
    out.push(d.toLocaleString("en-GB", { month: "short", year: "2-digit" }));
    d.setMonth(d.getMonth() + 1);
  }
  return out;
};
const PHASE_COLORS = ["#003932", "#0a5448", "#00b894", "#3a5547", "#490300", "#FF5000", "#b23800", "#7a9485"];

const buildPlan = (f) => {
  const months = monthList(f.start, f.end);
  const n = Math.max(1, months.length);
  const phases = f.phases.filter(p => p.name.trim());
  const ganttRows = phases.map((p, i) => {
    const from = Math.min(Math.max(0, +p.from), n - 1);
    const to = Math.min(Math.max(from, +p.to), n - 1);
    const left = (from / n) * 100, width = ((to - from + 1) / n) * 100;
    return `<div style="display:flex;align-items:center;min-height:22px;border-top:1px solid #f0f5f1;">
      <div style="width:34%;flex-shrink:0;font-size:9px;font-weight:700;color:#003932;padding:4px 8px 4px 2px;line-height:1.25;">${esc(p.name)}</div>
      <div style="flex:1;position:relative;height:22px;">
        ${months.map((_, mi) => `<div style="position:absolute;top:0;bottom:0;width:1px;background:#eef3ef;left:${(mi / n * 100).toFixed(2)}%"></div>`).join("")}
        <div style="position:absolute;top:5px;height:12px;border-radius:6px;opacity:0.92;left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${PHASE_COLORS[i % PHASE_COLORS.length]}"></div>
      </div></div>`;
  }).join("");
  const phaseRows = phases.map(p => {
    const from = Math.min(Math.max(0, +p.from), n - 1);
    const to = Math.min(Math.max(from, +p.to), n - 1);
    return `<tr><td><strong>${esc(p.name)}</strong></td><td>${months[from] || ""}${to !== from ? " – " + (months[to] || "") : ""}</td><td>${esc(p.outputs) || "—"}</td></tr>`;
  }).join("");
  const msRows = f.milestones.filter(m => m.name.trim()).map(m =>
    `<tr><td><span style="width:8px;height:8px;background:#00b894;border-radius:2px;transform:rotate(45deg);display:inline-block;"></span></td><td>${esc(m.name)}</td><td>${fmtD(m.date) || "—"}</td><td>${esc(m.criteria) || "—"}</td></tr>`).join("");
  const resRows = f.resourcePlan.filter(r => r.role.trim() || r.name.trim()).map(r =>
    `<tr><td><strong>${esc(r.role) || "—"}</strong></td><td>${esc(r.name) || "TBD"}</td><td>${esc(r.source)}</td><td>${esc(r.allocation) || "—"}</td><td>${esc(r.period) || "—"}</td><td>${esc(r.notes) || "—"}</td></tr>`).join("");
  const wsRows = f.workstreams.filter(w => w.name.trim()).map(w =>
    `<tr><td>${esc(w.name)}</td><td>${esc(w.owner) || "—"}</td><td>${esc(w.scope) || "—"}</td></tr>`).join("");
  const body = `
    ${band("Project Plan", f.name, `Delivery plan · ${months[0] || "—"} → ${months[n - 1] || "—"}`, [
      ["Sponsor", f.sponsor], ["Project Manager", f.pm], ["Duration", `${n} month${n === 1 ? "" : "s"}`], ["Approach", f.approach || "Phased, gate-governed"]])}
    <h2 class="sec"><span class="no">01</span> Delivery Approach</h2>
    ${f.approachText.trim() ? `<p>${esc(f.approachText)}</p>` : `<p class="hint">—</p>`}
    <h2 class="sec"><span class="no">02</span> Phase Timeline</h2>
    <div style="border:1px solid #dbe5dd;border-radius:10px;padding:12px 14px 10px;margin-bottom:12px;page-break-inside:avoid;">
      <div style="margin-left:34%;position:relative;height:13px;margin-bottom:5px;">
        ${months.map((m, i) => `<span style="position:absolute;transform:translateX(-50%);font-size:7.5px;font-weight:700;color:#7a9485;white-space:nowrap;left:${((i + 0.5) / n * 100).toFixed(2)}%">${m}</span>`).join("")}
      </div>${ganttRows || `<p class="hint">Add phases to draw the timeline.</p>`}
    </div>
    <h2 class="sec"><span class="no">03</span> Phase Detail</h2>
    <table><tr><th style="width:26%">Phase</th><th style="width:17%">Window</th><th>Key outputs</th></tr>${phaseRows || `<tr><td colspan="3">—</td></tr>`}</table>
    <h2 class="sec"><span class="no">04</span> Milestones</h2>
    <table><tr><th style="width:5%"></th><th style="width:38%">Milestone</th><th style="width:18%">Target</th><th>Exit criteria</th></tr>${msRows || `<tr><td colspan="4">—</td></tr>`}</table>
    <h2 class="sec"><span class="no">05</span> Resource Plan</h2>
    <table><tr><th style="width:20%">Role</th><th style="width:18%">Resource</th><th style="width:13%">Source</th><th style="width:13%">Allocation</th><th style="width:16%">Period</th><th>Notes</th></tr>
      ${resRows || `<tr><td colspan="6">—</td></tr>`}</table>
    <h2 class="sec"><span class="no">06</span> Workstreams &amp; Ownership</h2>
    <table><tr><th style="width:26%">Workstream</th><th style="width:24%">Owner</th><th>Scope</th></tr>${wsRows || `<tr><td colspan="3">—</td></tr>`}</table>
    <h2 class="sec"><span class="no">07</span> Plan Assumptions &amp; Controls</h2>
    ${bullets(f.assumptions)}
    ${docFooter("Project Plan")}`;
  openDoc(`${f.name || "Project"} — Plan`, body);
};

// ============================================================================
//  UI
// ============================================================================
// Defined at module level, NOT inside DocGenerator: an inline component
// definition gets a new identity every render, so React remounts the whole
// subtree on each keystroke — inputs lose focus and programmatic events land
// on detached nodes.
const Field = ({ label, span, children }) => {
  const T = useT();
  return (
    <div style={span ? { gridColumn: "1 / -1" } : undefined}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
};

const DocGenerator = ({ onClose, currentUserName }) => {
  const T = useT();
  const [view, setView] = useState("picker");

  const today = new Date().toLocaleDateString("en-CA");
  const [charter, setCharter] = useState({
    name: "", tagline: "", type: "Internal Project", date: today, sponsor: "", pm: currentUserName || "",
    purpose: "", objectives: "", scopeIn: "", scopeOut: "",
    deliverables: [{ name: "", desc: "" }],
    businessCase: "", cost: "", resources: "Internal", vendor: "", capNote: "",
    ias: Array(IAS_QUESTIONS.length).fill(null),
    milestones: [
      { name: "Charter Approval", date: "", owner: "" },
      { name: "Project Kick-off", date: "", owner: "" },
      { name: "Major Deliverable #1", date: "", owner: "" },
      { name: "UAT / Testing", date: "", owner: "" },
      { name: "Go-Live", date: "", owner: "" },
      { name: "Closure & Sign-off", date: "", owner: "" },
    ],
    risks: [{ risk: "", mitigation: "" }, { risk: "", mitigation: "" }],
    dependencies: "", assumptions: "", acceptance: "",
  });

  const [plan, setPlan] = useState({
    name: "", sponsor: "", pm: currentUserName || "", approach: "Phased, gate-governed",
    start: "", end: "", approachText: "",
    phases: [{ name: "Phase 1 — Initiation", from: 0, to: 0, outputs: "" }],
    milestones: [{ name: "", date: "", criteria: "" }],
    resourcePlan: [{ role: "", name: "", source: "Internal", allocation: "", period: "", notes: "" }],
    workstreams: [{ name: "", owner: "", scope: "" }],
    assumptions: "",
  });

  const setC = (k, v) => setCharter(p => ({ ...p, [k]: v }));
  const setP = (k, v) => setPlan(p => ({ ...p, [k]: v }));
  const setRow = (setter, listKey, i, k, v) => setter(p => ({ ...p, [listKey]: p[listKey].map((r, ri) => ri === i ? { ...r, [k]: v } : r) }));
  const addRow = (setter, listKey, empty) => setter(p => ({ ...p, [listKey]: [...p[listKey], empty] }));
  const delRow = (setter, listKey, i) => setter(p => ({ ...p, [listKey]: p[listKey].filter((_, ri) => ri !== i) }));

  const inp = { width: "100%", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", boxSizing: "border-box" };
  const ta = { ...inp, minHeight: 64, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
  const lbl = { fontSize: 11, fontWeight: 700, color: T.muted, display: "block", marginBottom: 4 };
  const secH = { fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.07em", textTransform: "uppercase", margin: "18px 0 10px", paddingBottom: 5, borderBottom: `2px solid ${T.primary}` };
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };
  const addBtn = { background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, color: T.muted, cursor: "pointer", marginBottom: 6 };
  const xBtn = { background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 15, padding: "0 4px", flexShrink: 0, lineHeight: 1 };
  const F = Field;
  const hintLine = { fontSize: 10, color: T.muted, marginTop: 3, fontStyle: "italic" };

  // ── Shell ──
  const shell = (title, subtitle, content, onGenerate) => (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,31,26,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "34px 20px", overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 18, width: "100%", maxWidth: 880, boxShadow: "0 24px 70px rgba(0,0,0,0.35)", overflow: "hidden" }}>
        <div style={{ background: T.headerBg, padding: "18px 26px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setView("picker")} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T.headerText, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.headerText, fontWeight: 800, fontSize: 15 }}>{title}</div>
            <div style={{ color: T.headerText, opacity: 0.65, fontSize: 11 }}>{subtitle}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T.headerText, fontSize: 14 }}>✕</button>
        </div>
        <div style={{ padding: "18px 26px 24px", maxHeight: "calc(100vh - 210px)", overflowY: "auto" }}>{content}</div>
        <div style={{ padding: "14px 26px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 10.5, color: T.muted }}>Nothing is saved — the document opens in a new window: Print → Save as PDF.</span>
          <button onClick={onGenerate} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "11px 26px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Ico name="printer" size={14} /> Generate Document
          </button>
        </div>
      </div>
    </div>
  );

  // ── Picker ──
  if (view === "picker") {
    const card = (key, icon, title, sub) => (
      <div onClick={() => setView(key)} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 22px", cursor: "pointer", background: T.surface, display: "flex", flexDirection: "column", gap: 12, transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,57,50,0.10)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
        <span style={{ color: T.primary }}><Ico name={icon} size={26} strokeWidth={1.3} /></span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>{sub}</div>
        </div>
      </div>
    );
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,31,26,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 18, width: "100%", maxWidth: 700, boxShadow: "0 24px 70px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          <div style={{ background: T.headerBg, padding: "22px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: T.accent, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Document Generator</div>
                <div style={{ color: T.headerText, fontWeight: 900, fontSize: 19 }}>Generate a governance document</div>
                <div style={{ color: T.headerText, opacity: 0.65, fontSize: 12, marginTop: 3 }}>Fill a form, print, save as PDF.</div>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: T.headerText, fontSize: 14 }}>✕</button>
            </div>
          </div>
          <div style={{ padding: "22px 28px 26px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {card("charter", "clipboard", "Project Charter", "Fill the form, print the charter")}
            {card("plan", "calendar", "Project Plan", "Fill the form, print the plan")}
          </div>
        </div>
      </div>
    );
  }

  // ── Charter form ──
  if (view === "charter") {
    return shell("Project Charter", "Mirrors the official Tree charter template — sections 1 to 7", (
      <>
        <div style={secH}>Project Information</div>
        <div style={grid2}>
          <F label="Project Name *"><input style={inp} value={charter.name} onChange={e => setC("name", e.target.value)} placeholder="e.g. Motor Fleet Product" /></F>
          <F label="One-line description"><input style={inp} value={charter.tagline} onChange={e => setC("tagline", e.target.value)} placeholder="Shown under the title" /></F>
          <F label="Project Type">
            <select style={inp} value={charter.type} onChange={e => setC("type", e.target.value)}>
              {["Business Project", "Enterprise Project", "Internal Project"].map(t => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Date of Charter"><input type="date" style={inp} value={charter.date} onChange={e => setC("date", e.target.value)} /></F>
          <F label="Project Sponsor"><input style={inp} value={charter.sponsor} onChange={e => setC("sponsor", e.target.value)} placeholder="Full name" /></F>
          <F label="Project Manager"><input style={inp} value={charter.pm} onChange={e => setC("pm", e.target.value)} placeholder="Full name" /></F>
        </div>

        <div style={secH}>1 · Purpose &amp; Objectives</div>
        <F label="Why is this project being initiated? (business driver, regulatory requirement, market need)" span>
          <textarea style={ta} value={charter.purpose} onChange={e => setC("purpose", e.target.value)} /></F>
        <F label="Objectives — one per line (each becomes a bullet)" span>
          <textarea style={ta} value={charter.objectives} onChange={e => setC("objectives", e.target.value)} placeholder={"Increase X by Y\nDeliver Z by Q3"} /></F>

        <div style={secH}>2 · Scope &amp; Deliverables</div>
        <div style={grid2}>
          <F label="In scope — one per line"><textarea style={ta} value={charter.scopeIn} onChange={e => setC("scopeIn", e.target.value)} /></F>
          <F label="Out of scope — one per line"><textarea style={ta} value={charter.scopeOut} onChange={e => setC("scopeOut", e.target.value)} /></F>
        </div>
        <label style={lbl}>Key deliverables</label>
        {charter.deliverables.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input style={{ ...inp, width: "34%" }} value={d.name} onChange={e => setRow(setCharter, "deliverables", i, "name", e.target.value)} placeholder="Deliverable" />
            <input style={inp} value={d.desc} onChange={e => setRow(setCharter, "deliverables", i, "desc", e.target.value)} placeholder="Description" />
            <button style={xBtn} onClick={() => delRow(setCharter, "deliverables", i)}>×</button>
          </div>
        ))}
        <button style={addBtn} onClick={() => addRow(setCharter, "deliverables", { name: "", desc: "" })}>+ Add deliverable</button>

        <div style={secH}>3 · Business Case</div>
        <F label="Overview of anticipated benefits and value drivers (financial, operational, compliance, customer)" span>
          <textarea style={ta} value={charter.businessCase} onChange={e => setC("businessCase", e.target.value)} placeholder="Leave empty to reference the attachment" /></F>

        <div style={secH}>4 · Budget &amp; Resource Plan</div>
        <div style={grid2}>
          <F label="Estimated cost (SAR)"><input style={inp} value={charter.cost} onChange={e => setC("cost", e.target.value)} placeholder="e.g. 350,000 — or 0 for internal" /></F>
          <F label="Resources (Internal / Vendor)"><input style={inp} value={charter.resources} onChange={e => setC("resources", e.target.value)} /></F>
        </div>
        <F label="Vendor details (if any)" span><input style={inp} value={charter.vendor} onChange={e => setC("vendor", e.target.value)} placeholder="Vendor name and contact — leave empty if none" /></F>
        <label style={{ ...lbl, marginTop: 10 }}>Capitalization assessment (IAS 38)</label>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
          {IAS_QUESTIONS.map((q, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i > 0 ? `1px solid ${T.border}` : "none", background: i % 2 ? T.bg : "transparent" }}>
              <span style={{ flex: 1, fontSize: 11.5, fontWeight: i === 0 ? 800 : 500, color: T.text }}>{q}</span>
              {["yes", "no"].map(v => (
                <button key={v} onClick={() => setCharter(p => ({ ...p, ias: p.ias.map((x, xi) => xi === i ? v : x) }))}
                  style={{ background: charter.ias[i] === v ? T.primary : T.bg, color: charter.ias[i] === v ? "#fff" : T.muted, border: `1px solid ${charter.ias[i] === v ? T.primary : T.border}`, borderRadius: 7, padding: "4px 13px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          ))}
        </div>
        <F label="Capitalization note (optional — shown as a highlighted note under the table)" span>
          <textarea style={{ ...ta, minHeight: 48 }} value={charter.capNote} onChange={e => setC("capNote", e.target.value)} /></F>

        <div style={secH}>5 · Milestones &amp; Timeline</div>
        {charter.milestones.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input style={inp} value={m.name} onChange={e => setRow(setCharter, "milestones", i, "name", e.target.value)} placeholder="Milestone" />
            <input type="date" style={{ ...inp, width: 160 }} value={m.date} onChange={e => setRow(setCharter, "milestones", i, "date", e.target.value)} />
            <input style={{ ...inp, width: "26%" }} value={m.owner} onChange={e => setRow(setCharter, "milestones", i, "owner", e.target.value)} placeholder="Owner" />
            <button style={xBtn} onClick={() => delRow(setCharter, "milestones", i)}>×</button>
          </div>
        ))}
        <button style={addBtn} onClick={() => addRow(setCharter, "milestones", { name: "", date: "", owner: "" })}>+ Add milestone</button>

        <div style={secH}>6 · Risks, Dependencies &amp; Assumptions</div>
        {charter.risks.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input style={inp} value={r.risk} onChange={e => setRow(setCharter, "risks", i, "risk", e.target.value)} placeholder={`Risk ${i + 1}`} />
            <input style={inp} value={r.mitigation} onChange={e => setRow(setCharter, "risks", i, "mitigation", e.target.value)} placeholder="Mitigation" />
            <button style={xBtn} onClick={() => delRow(setCharter, "risks", i)}>×</button>
          </div>
        ))}
        <button style={addBtn} onClick={() => addRow(setCharter, "risks", { risk: "", mitigation: "" })}>+ Add risk</button>
        <div style={grid2}>
          <F label="Dependencies — one per line"><textarea style={ta} value={charter.dependencies} onChange={e => setC("dependencies", e.target.value)} /></F>
          <F label="Assumptions — one per line"><textarea style={ta} value={charter.assumptions} onChange={e => setC("assumptions", e.target.value)} /></F>
        </div>

        <div style={secH}>7 · Acceptance Criteria</div>
        <F label="Conditions for the project to be considered successfully delivered — one per line" span>
          <textarea style={ta} value={charter.acceptance} onChange={e => setC("acceptance", e.target.value)} /></F>
      </>
    ), () => {
      if (!charter.name.trim()) { alert("Project Name is required."); return; }
      buildCharter(charter);
    });
  }

  // ── Plan form ──
  const months = monthList(plan.start, plan.end);
  return shell("Project Plan", "Phase Gantt, milestones, resource plan, workstreams", (
    <>
      <div style={secH}>Project Information</div>
      <div style={grid2}>
        <F label="Project Name *"><input style={inp} value={plan.name} onChange={e => setP("name", e.target.value)} /></F>
        <F label="Approach label"><input style={inp} value={plan.approach} onChange={e => setP("approach", e.target.value)} /></F>
        <F label="Sponsor"><input style={inp} value={plan.sponsor} onChange={e => setP("sponsor", e.target.value)} /></F>
        <F label="Project Manager"><input style={inp} value={plan.pm} onChange={e => setP("pm", e.target.value)} /></F>
        <F label="Plan start (month) *"><input type="month" style={inp} value={plan.start} onChange={e => setP("start", e.target.value)} /></F>
        <F label="Plan end (month) *"><input type="month" style={inp} value={plan.end} onChange={e => setP("end", e.target.value)} /></F>
      </div>
      {months.length > 0 && <div style={hintLine}>Timeline: {months[0]} → {months[months.length - 1]} · {months.length} months</div>}

      <div style={secH}>1 · Delivery Approach</div>
      <F label="How will this be delivered? (phasing logic, what gates the go-live)" span>
        <textarea style={ta} value={plan.approachText} onChange={e => setP("approachText", e.target.value)} /></F>

      <div style={secH}>2 · Phases</div>
      {months.length === 0 && <div style={{ ...hintLine, color: "#d97706", marginBottom: 8 }}>Set the plan start and end months first — phase windows pick from them.</div>}
      {plan.phases.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 180px" }} value={p.name} onChange={e => setRow(setPlan, "phases", i, "name", e.target.value)} placeholder={`Phase ${i + 1} — name`} />
          <select style={{ ...inp, width: 110 }} value={p.from} onChange={e => setRow(setPlan, "phases", i, "from", +e.target.value)}>
            {months.map((m, mi) => <option key={mi} value={mi}>{m}</option>)}
          </select>
          <span style={{ color: T.muted, fontSize: 11 }}>→</span>
          <select style={{ ...inp, width: 110 }} value={p.to} onChange={e => setRow(setPlan, "phases", i, "to", +e.target.value)}>
            {months.map((m, mi) => <option key={mi} value={mi}>{m}</option>)}
          </select>
          <input style={{ ...inp, flex: "2 1 220px" }} value={p.outputs} onChange={e => setRow(setPlan, "phases", i, "outputs", e.target.value)} placeholder="Key outputs" />
          <button style={xBtn} onClick={() => delRow(setPlan, "phases", i)}>×</button>
        </div>
      ))}
      <button style={addBtn} onClick={() => addRow(setPlan, "phases", { name: "", from: 0, to: Math.max(0, months.length - 1), outputs: "" })}>+ Add phase</button>

      <div style={secH}>3 · Milestones</div>
      {plan.milestones.map((m, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <input style={{ ...inp, width: "30%" }} value={m.name} onChange={e => setRow(setPlan, "milestones", i, "name", e.target.value)} placeholder="Milestone" />
          <input type="date" style={{ ...inp, width: 155 }} value={m.date} onChange={e => setRow(setPlan, "milestones", i, "date", e.target.value)} />
          <input style={inp} value={m.criteria} onChange={e => setRow(setPlan, "milestones", i, "criteria", e.target.value)} placeholder="Exit criteria — what makes it done?" />
          <button style={xBtn} onClick={() => delRow(setPlan, "milestones", i)}>×</button>
        </div>
      ))}
      <button style={addBtn} onClick={() => addRow(setPlan, "milestones", { name: "", date: "", criteria: "" })}>+ Add milestone</button>

      <div style={secH}>4 · Resource Plan</div>
      {plan.resourcePlan.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 140px" }} value={r.role} onChange={e => setRow(setPlan, "resourcePlan", i, "role", e.target.value)} placeholder="Role — e.g. Developer" />
          <input style={{ ...inp, flex: "1 1 130px" }} value={r.name} onChange={e => setRow(setPlan, "resourcePlan", i, "name", e.target.value)} placeholder="Name / TBD" />
          <select style={{ ...inp, width: 105 }} value={r.source} onChange={e => setRow(setPlan, "resourcePlan", i, "source", e.target.value)}>
            {["Internal", "Vendor"].map(s => <option key={s}>{s}</option>)}
          </select>
          <input style={{ ...inp, width: 90 }} value={r.allocation} onChange={e => setRow(setPlan, "resourcePlan", i, "allocation", e.target.value)} placeholder="50%" />
          <input style={{ ...inp, width: 130 }} value={r.period} onChange={e => setRow(setPlan, "resourcePlan", i, "period", e.target.value)} placeholder="Jan–Jun 26" />
          <input style={{ ...inp, flex: "1 1 120px" }} value={r.notes} onChange={e => setRow(setPlan, "resourcePlan", i, "notes", e.target.value)} placeholder="Notes" />
          <button style={xBtn} onClick={() => delRow(setPlan, "resourcePlan", i)}>×</button>
        </div>
      ))}
      <button style={addBtn} onClick={() => addRow(setPlan, "resourcePlan", { role: "", name: "", source: "Internal", allocation: "", period: "", notes: "" })}>+ Add resource</button>

      <div style={secH}>5 · Workstreams &amp; Ownership</div>
      {plan.workstreams.map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <input style={{ ...inp, width: "28%" }} value={w.name} onChange={e => setRow(setPlan, "workstreams", i, "name", e.target.value)} placeholder="Workstream" />
          <input style={{ ...inp, width: "24%" }} value={w.owner} onChange={e => setRow(setPlan, "workstreams", i, "owner", e.target.value)} placeholder="Owner" />
          <input style={inp} value={w.scope} onChange={e => setRow(setPlan, "workstreams", i, "scope", e.target.value)} placeholder="Scope" />
          <button style={xBtn} onClick={() => delRow(setPlan, "workstreams", i)}>×</button>
        </div>
      ))}
      <button style={addBtn} onClick={() => addRow(setPlan, "workstreams", { name: "", owner: "", scope: "" })}>+ Add workstream</button>

      <div style={secH}>6 · Assumptions &amp; Controls</div>
      <F label="One per line" span><textarea style={ta} value={plan.assumptions} onChange={e => setP("assumptions", e.target.value)} /></F>
    </>
  ), () => {
    if (!plan.name.trim()) { alert("Project Name is required."); return; }
    if (!months.length) { alert("Set the plan start and end months."); return; }
    buildPlan(plan);
  });
};

export default DocGenerator;
