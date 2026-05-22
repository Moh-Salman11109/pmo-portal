
import React, { useState, useMemo, useCallback, createContext, useContext, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from "recharts";
import { GATE_DEFS, OPTIONAL_DOCS, PROJECT_TYPES, ICON_OPTIONS } from "./data/constants.js";
import { SPService, isUsingMock, FORM_URLS, mapSPItemToClosureSubmission } from "./services/sharepoint.js";
import { acquireSpToken } from "./services/auth.js";
// Role constants
const ROLE_ADMIN     = "pmo_admin";
const ROLE_PM        = "pm";
const ROLE_EXEC      = "executive";
const ROLE_DEPT_HEAD = "dept_head";
const ROLE_GRC       = "grc";        // view GRC dashboard only
const ROLE_GRC_ADMIN = "grc_admin";  // view + full edit GRC dashboard
const ROLE_PMO_HEAD  = "pmo_head";   // all pmo_admin permissions except GRC dashboard
import { useCurrentUser } from "./hooks/useCurrentUser.js";

// ─── THEME TOKENS ────────────────────────────────────────────────
const THEMES = {
  light: {
    primary:    "#003932",
    accent:     "#00ffb3",
    secondary:  "#a1b9ab",
    light:      "#c9d5c9",
    danger:     "#ff5000",
    critical:   "#490300",
    bg:         "#f4f6f4",
    surface:    "#ffffff",
    border:     "#dce8dc",
    text:       "#0d1f1c",
    muted:      "#5a7a6e",
    sidebarBg:  "#003932",
    cardHover:  "#f0f7f4",
    inputBg:    "#ffffff",
    tableBg:    "#f4f6f4",
    // semantic
    headerBg:   "#003932",   // project header, banners
    headerText: "#ffffff",   // text ON dark header backgrounds
    btnPrimBg:  "#003932",   // primary button bg
    btnPrimText:"#00ffb3",   // primary button text
    accentText: "#0d1f1c",   // text ON accent-coloured backgrounds
    badgeBg:    "#e8f5f0",   // light tint badge
    inputText:  "#0d1f1c",
    selectBg:   "#ffffff",
  },
  dark: {
    primary:    "#00ffb3",   // accent is the "brand" highlight in dark
    accent:     "#00ffb3",
    secondary:  "#a1b9ab",
    light:      "#c9d5c9",
    danger:     "#ff5000",
    critical:   "#ff6b6b",
    bg:         "#0a1512",
    surface:    "#0f1e1a",
    border:     "#1a3330",
    text:       "#e8f5f0",
    muted:      "#7aaa96",
    sidebarBg:  "#060e0c",
    cardHover:  "#132820",
    inputBg:    "#132820",
    tableBg:    "#0a1512",
    // semantic
    headerBg:   "#061210",   // very dark for project header / banners
    headerText: "#e8f5f0",   // text ON dark header backgrounds
    btnPrimBg:  "#00ffb3",   // primary button bg in dark = accent
    btnPrimText:"#061210",   // dark text ON green button
    accentText: "#061210",   // text ON accent backgrounds
    badgeBg:    "#0f2a22",
    inputText:  "#e8f5f0",
    selectBg:   "#132820",
  },
};

// ─── THEME STORE (module-level, no context needed) ────────────────
// Simple pub/sub store - guaranteed to work
const themeStore = {
  dark: false,
  listeners: new Set(),
  get T() { return this.dark ? THEMES.dark : THEMES.light; },
  toggle() {
    this.dark = !this.dark;
    this.listeners.forEach(fn => fn());
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
};

// Hook that re-renders on theme change
const useT = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const unsub = themeStore.subscribe(() => rerender(n => n + 1));
    return unsub;
  }, []);
  return themeStore.T;
};

const useDark = () => themeStore.dark;

// ─── BREAKPOINT STORE ─────────────────────────────────────────────
// Mirrors the themeStore pattern — any component can call useBp()
// and will re-render on window resize. No prop drilling needed.
const getBp = () => {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 640)  return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};
const bpStore = { listeners: new Set() };
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => bpStore.listeners.forEach(fn => fn()), { passive: true });
}
const useBp = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender(n => n + 1);
    bpStore.listeners.add(fn);
    return () => bpStore.listeners.delete(fn);
  }, []);
  return getBp();
};

// ─── DEPARTMENTS CONTEXT (live CRUD) ──────────────────────────────
const DeptContext = createContext(null);
const useDepts = () => useContext(DeptContext);

// ─── CHART TOOLTIP STYLE ──────────────────────────────────────────
// Called inline in JSX — reads current theme at render time.
// Spreads onto <Tooltip> so all charts share one high-contrast style.
const ttStyle = () => {
  const dark = themeStore.dark;
  return {
    contentStyle: {
      fontSize: 12,
      borderRadius: 10,
      border: `1px solid ${dark ? "rgba(0,255,179,0.3)" : "#dce8dc"}`,
      background: dark ? "#0c1f1b" : "#ffffff",
      color: dark ? "#e8f5f0" : "#0d1f1c",
      boxShadow: dark ? "0 4px 20px rgba(0,0,0,0.45)" : "0 4px 16px rgba(0,57,50,0.10)",
      padding: "8px 14px",
    },
    labelStyle: {
      color: dark ? "#a1b9ab" : "#5a7a6e",
      fontWeight: 600,
      marginBottom: 2,
    },
    itemStyle: {
      color: dark ? "#e8f5f0" : "#0d1f1c",
    },
    cursor: {
      fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,57,50,0.04)",
    },
  };
};


// ─── COMPUTED METRICS ─────────────────────────────────────────────
function getDeptStats(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  const total = dp.length;
  const onTrack = dp.filter(p => p.status === "On Track").length;
  const active = dp.filter(p => p.status === "On Track" || p.status === "At Risk").length;
  const delayed = dp.filter(p => p.status === "Delayed").length;
  const completed = dp.filter(p => p.status === "Completed").length;
  const highRisk = dp.filter(p => p.riskLevel === "High" || p.riskLevel === "Critical").length;
  const health = total ? Math.round(dp.reduce((s, p) => s + p.progress, 0) / total) : 0;
  const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
  const actualCost = dp.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtil = totalBudget ? Math.round((actualCost / totalBudget) * 100) : 0;
  return { total, onTrack, active, delayed, completed, highRisk, health, totalBudget, actualCost, budgetUtil };
}

// ─── IPI CALCULATIONS ─────────────────────────────────────────────
// IPI per project = SPI×50% + CPI×25% + DocsCompliance×25%
// Capped at 1.2 to avoid inflated scores; normalised to 0–100
function calcProjectIPI(project) {
  // Only count REQUIRED documents in compliance score
  const allDocs = project.documents ?? [];
  const reqDocs = allDocs.filter(d => d.required === true);
  const docsTotal = reqDocs.length;
  const docsReady = reqDocs.filter(d =>
    ["Approved","Final","Received","Current","Submitted"].includes(d.status)
  ).length;
  const docsScore = docsTotal > 0 ? docsReady / docsTotal : 0;

  const spi = Math.min(project.spi ?? 1, 1.2);
  const cpi = Math.min(project.cpi ?? 1, 1.2);

  const raw = (spi * 0.5) + (cpi * 0.25) + (docsScore * 0.25);
  return Math.min(Math.round((raw / 1.15) * 100), 100);
}

// IPI per department = average of its projects' IPIs
function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  if (!dp.length) return 0;
  return Math.round(dp.reduce((s, p) => s + calcProjectIPI(p), 0) / dp.length);
}

// IPI colour band
function ipiColor(score) {
  if (score >= 90) return { color: "#15803d", bg: "#dcfce7", label: "Excellent" };
  if (score >= 70) return { color: "#005c4b", bg: "#e8f5f0", label: "Good" };
  if (score >= 55) return { color: "#854d0e", bg: "#fef9c3", label: "Fair" };
  return { color: "#991b1b", bg: "#fee2e2", label: "Poor" };
}

// SPService and isUsingMock imported from ./services/sharepoint.js

// ─── HELPERS ──────────────────────────────────────────────────────
const fmt = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n;
const fmtSAR = (n) => `SAR ${fmt(n)}`;

const statusColor = {
  "On Track": { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" },
  "At Risk": { bg: "#fef9c3", text: "#854d0e", dot: "#eab308" },
  "Delayed": { bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  "Completed": { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "Not Started": { bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
};

const healthColor = {
  "Green": { bg: "#dcfce7", text: "#15803d", label: "Green" },
  "Amber": { bg: "#fef9c3", text: "#854d0e", label: "Amber" },
  "Red": { bg: "#fee2e2", text: "#991b1b", label: "Red" },
};

const riskColor = {
  "Critical": { bg: "#fee2e2", text: "#991b1b" },
  "High": { bg: "#fef3c7", text: "#92400e" },
  "Medium": { bg: "#fef9c3", text: "#854d0e" },
  "Low": { bg: "#dcfce7", text: "#15803d" },
};

const TODAY = new Date().toISOString().split("T")[0];

// Mandatory docs every project gets at creation — single source of truth
const MANDATORY_DOCS = [
  { id: "D1", name: "Project Charter",  type: "Charter",       required: true, status: "Pending", version: "", lastUpdated: "" },
  { id: "D2", name: "Business Case",    type: "Business Case", required: true, status: "Pending", version: "", lastUpdated: "" },
  { id: "D3", name: "Closure Document", type: "Closure",       required: true, status: "Pending", version: "", lastUpdated: "" },
];

// Days since a date string — staleness + Gate SLA calculations
const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((new Date() - d) / 86400000);
};

// How many days has this project been sitting at its current active gate
const getGateSLA = (project) => {
  if (!project?.gates) return null;
  const ordered = GATE_DEFS.map(def => ({
    def,
    g: project.gates.find(g => g.id === def.id) || { status: "Pending" }
  }));
  const lastApprovedIdx = ordered.reduce((idx, x, i) => x.g.status === "Approved" ? i : idx, -1);
  const currentIdx = (() => {
    const ipIdx = ordered.findIndex(x => x.g.status === "In Progress");
    if (ipIdx !== -1) return ipIdx;
    return lastApprovedIdx >= 0 && lastApprovedIdx + 1 < ordered.length ? lastApprovedIdx + 1 : 0;
  })();
  const current = ordered[currentIdx];
  if (!current || current.g.status === "Approved") return null;
  const fromDate = lastApprovedIdx >= 0 ? ordered[lastApprovedIdx]?.g?.date : project.startDate;
  const days = daysSince(fromDate);
  if (days == null) return null;
  return { label: current.def.label, days };
};

const exportExcel = (rows, filename, deptMap = {}) => {
  const SC = {
    "On Track":    { bg: "#dcfce7", fg: "#15803d" },
    "At Risk":     { bg: "#fef9c3", fg: "#854d0e" },
    "Delayed":     { bg: "#fee2e2", fg: "#991b1b" },
    "Completed":   { bg: "#dbeafe", fg: "#1e40af" },
    "Not Started": { bg: "#f3f4f6", fg: "#4b5563" },
  };
  const RC = {
    "Critical": { bg: "#fee2e2", fg: "#991b1b" },
    "High":     { bg: "#fef3c7", fg: "#92400e" },
    "Medium":   { bg: "#fef9c3", fg: "#854d0e" },
    "Low":      { bg: "#dcfce7", fg: "#15803d" },
  };

  const td = (val, style = "") =>
    `<td style="border:1px solid #dce8dc;padding:7px 12px;font-size:12px;font-family:'Segoe UI',sans-serif;vertical-align:middle;${style}">${val ?? "—"}</td>`;
  const th = (val) =>
    `<td style="background:#003932;color:#ffffff;font-weight:700;padding:10px 14px;font-size:12px;font-family:'Segoe UI',sans-serif;border:1px solid #00524a;white-space:nowrap;">${val}</td>`;

  const HEADERS = ["Code","Project Name","Department","PM","Sponsor","Phase","Status","Progress","Risk","Budget (SAR)","Actual Cost (SAR)","Budget Status","Gate","Start Date","Planned End"];
  const COL_COUNT = HEADERS.length;

  const titleRow = `<tr><td colspan="${COL_COUNT}" style="background:#003932;color:#00ffb3;font-size:16px;font-weight:900;padding:14px 18px;font-family:'Segoe UI',sans-serif;border:none;letter-spacing:0.02em;">PMO Portal — Project Export</td></tr>`;
  const dateRow  = `<tr><td colspan="${COL_COUNT}" style="background:#003932;color:#a1c9b8;font-size:11px;padding:4px 18px 12px;font-family:'Segoe UI',sans-serif;border:none;">Generated ${new Date().toLocaleDateString("en-US",{dateStyle:"full"})} · ${rows.length} project${rows.length!==1?"s":""}</td></tr>`;
  const spaceRow = `<tr><td colspan="${COL_COUNT}" style="height:8px;border:none;background:#f4f6f4;"></td></tr>`;
  const headerRow = `<tr>${HEADERS.map(h => th(h)).join("")}</tr>`;

  const dataRows = rows.map((p, i) => {
    const sc = SC[p.status] || {};
    const rc = RC[p.riskLevel] || {};
    const rowBg = i % 2 === 0 ? "#ffffff" : "#f9fbf9";
    const b = `background:${rowBg};`;
    const budgetOk = p.budgetStatus !== "Over Budget";
    return `<tr>
      ${td(p.code,        b + "font-weight:700;color:#003932;")}
      ${td(p.name,        b + "font-weight:600;")}
      ${td(deptMap[p.deptId] || p.deptId, b)}
      ${td(p.pm,          b)}
      ${td(p.sponsor,     b)}
      ${td(p.phase,       b)}
      ${td(p.status,      `background:${sc.bg||rowBg};color:${sc.fg||"#000"};font-weight:700;text-align:center;`)}
      ${td((p.progress||0)+"%", b + "text-align:center;font-weight:700;")}
      ${td(p.riskLevel,   `background:${rc.bg||rowBg};color:${rc.fg||"#000"};font-weight:700;text-align:center;`)}
      ${td((p.budget||0).toLocaleString(),     b + "text-align:right;")}
      ${td((p.actualCost||0).toLocaleString(), b + "text-align:right;")}
      ${td(p.budgetStatus, b + `color:${budgetOk?"#15803d":"#991b1b"};font-weight:700;`)}
      ${td(p.gate,        b)}
      ${td(p.startDate||"—", b)}
      ${td(p.plannedEnd||"—", b)}
    </tr>`;
  }).join("");

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="UTF-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
  <x:ExcelWorksheet><x:Name>Projects</x:Name></x:ExcelWorksheet>
  </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  </head>
  <body>
  <table style="border-collapse:collapse;">
    ${titleRow}${dateRow}${spaceRow}${headerRow}${dataRows}
  </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
};

// ─── UI COMPONENTS ───────────────────────────────────────────────
// ─── RISK MATRIX COMPONENT ───────────────────────────────────────
const RiskMatrix = ({ risks }) => {
  const T = useT();
  const PROBS = ["High", "Medium", "Low"];
  const IMPACTS = ["Low", "Medium", "High"];

  const normLevel = v => {
    const s = String(v || "").toLowerCase();
    if (s.includes("critical") || s.includes("very") || s.includes("high")) return "High";
    if (s.includes("medium") || s.includes("mod")) return "Medium";
    return "Low";
  };

  const cellMeta = (prob, impact) => {
    const score = (PROBS.length - 1 - PROBS.indexOf(prob)) + IMPACTS.indexOf(impact);
    if (score >= 3) return { bg: "#fee2e2", border: "#dc2626" };
    if (score === 2) return { bg: "#fef3c7", border: "#f59e0b" };
    if (score === 1) return { bg: "#fef9c3", border: "#eab308" };
    return { bg: "#dcfce7", border: "#16a34a" };
  };

  const inCell = (prob, impact) =>
    risks.filter(r => normLevel(r.probability) === prob && normLevel(r.impact) === impact);

  const items = [];
  items.push(<div key="c0" />);
  IMPACTS.forEach(impact => items.push(
    <div key={`hi-${impact}`} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.muted, padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{impact}</div>
  ));
  PROBS.forEach(prob => {
    items.push(
      <div key={`lbl-${prob}`} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{prob}</div>
    );
    IMPACTS.forEach(impact => {
      const meta = cellMeta(prob, impact);
      const cellRisks = inCell(prob, impact);
      items.push(
        <div key={`${prob}-${impact}`} style={{ background: meta.bg, border: `2px solid ${meta.border}`, borderRadius: 8, minHeight: 60, padding: 6, display: "flex", flexDirection: "column", gap: 3 }}>
          {cellRisks.map(r => (
            <span key={r.id} title={r.title} style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 6, background: "rgba(255,255,255,0.75)", color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {r.title.length > 22 ? r.title.slice(0, 20) + "…" : r.title}
            </span>
          ))}
        </div>
      );
    });
  });

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Risk Matrix</h3>
        <span style={{ fontSize: 11, color: T.muted }}>Probability × Impact</span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>PROBABILITY</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 1fr", gap: 6 }}>{items}</div>
          <div style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>IMPACT</div>
        </div>
      </div>
    </div>
  );
};

// ─── GATE TRACKER COMPONENT ──────────────────────────────────────
const GateTracker = ({ gates, currentGate, startDate }) => {
  const T = useT();
  const [expanded, setExpanded] = useState(null);

  // Map "Gate 3" → "G3" for fallback when GatesJSON is empty
  const _currentGateId = currentGate?.replace("Gate ", "G").replace(" ", "") || null;

  const _ordered = GATE_DEFS.map(def => {
    const fromJson = gates?.find(x => x.id === def.id);
    const defIdx   = GATE_DEFS.findIndex(d => d.id === def.id);
    const curIdx   = GATE_DEFS.findIndex(d => d.id === _currentGateId);

    // Derive status from CurrentGate (source of truth)
    let derivedStatus = "Pending";
    if (curIdx >= 0) {
      if (defIdx < curIdx)   derivedStatus = "Approved";
      if (defIdx === curIdx) derivedStatus = "In Progress";
    }

    // Only override with GatesJSON status for special cases (Returned / Rejected)
    const jsonStatus   = fromJson?.status;
    const useJsonStatus = jsonStatus === "Returned" || jsonStatus === "Rejected";

    return { def, g: { ...(fromJson || {}), status: useJsonStatus ? jsonStatus : derivedStatus } };
  });

  const _lastApprovedIdx = _ordered.reduce((idx, x, i) => x.g.status === "Approved" ? i : idx, -1);
  const _currentIdx = (() => {
    const ip = _ordered.findIndex(x => x.g.status === "In Progress");
    if (ip !== -1) return ip;
    return _lastApprovedIdx >= 0 && _lastApprovedIdx + 1 < _ordered.length ? _lastApprovedIdx + 1 : 0;
  })();
  const _currentGateDef = _ordered[_currentIdx]?.def;
  const _slaFromDate = _lastApprovedIdx >= 0 ? _ordered[_lastApprovedIdx]?.g?.date : startDate;
  const _slaDays = daysSince(_slaFromDate);

  const gateStyle = {
    "Approved":    { bg: "#dcfce7", text: "#15803d", border: "#16a34a", icon: "✓" },
    "In Progress": { bg: "#fef9c3", text: "#854d0e", border: "#eab308", icon: "◎" },
    "Pending":     { bg: T.bg,      text: T.muted,   border: T.border,  icon: "○" },
    "Returned":    { bg: "#fee2e2", text: "#991b1b", border: "#dc2626", icon: "↩" },
    "Rejected":    { bg: "#fee2e2", text: "#991b1b", border: "#dc2626", icon: "✕" },
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Gate Progress</div>
      {/* Track */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 12 }}>
        {_ordered.map(({ def, g }, i) => {
          const s = gateStyle[g.status] || gateStyle["Pending"];
          const isLast = i === GATE_DEFS.length - 1;
          return (
            <div key={def.id} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
              {/* Gate circle */}
              <div onClick={() => setExpanded(expanded === def.id ? null : def.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 64 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: s.bg, border: `2px solid ${s.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: s.text, fontWeight: 900,
                  transition: "transform 0.15s",
                  transform: expanded === def.id ? "scale(1.15)" : "scale(1)",
                }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.text, marginTop: 4, whiteSpace: "nowrap" }}>{def.label}</div>
                <div style={{ fontSize: 9, color: T.muted, whiteSpace: "nowrap" }}>{def.name}</div>
                {def.id === _currentGateDef?.id && _slaDays != null && g.status !== "Approved" && (
                  <div style={{ fontSize: 9, fontWeight: 800, color: _slaDays > 30 ? "#dc2626" : _slaDays > 14 ? "#92400e" : "#16a34a", marginTop: 2, whiteSpace: "nowrap" }}>Day {_slaDays}</div>
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{ flex: 1, height: 2, background: g.status === "Approved" ? "#16a34a" : T.border, marginBottom: 22, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded && (() => {
        const def = GATE_DEFS.find(d => d.id === expanded);
        const g = _ordered.find(o => o.def.id === expanded)?.g || { status: "Pending" };
        const s = gateStyle[g.status] || gateStyle["Pending"];
        return (
          <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "14px 18px", marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 13, color: s.text }}>{def.label} — {def.name}</span>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: s.text, opacity: 0.8 }}>{def.desc}</p>
              </div>
              <span style={{ background: s.border, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, alignSelf: "flex-start" }}>{g.status}</span>
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 12, color: s.text }}>
              {g.date     && <div>📅 Date: <strong>{g.date}</strong></div>}
              {g.approver && <div>👤 Approver: <strong>{g.approver}</strong></div>}
              {g.notes    && <div>💬 Notes: <strong>{g.notes}</strong></div>}
            </div>
            {(() => {
              const formUrl = def.id === "G1" ? FORM_URLS.intake
                            : def.id === "G2" ? FORM_URLS.gate1
                            : def.id === "G3" ? FORM_URLS.gate3
                            : def.id === "G5" ? FORM_URLS.closure
                            : null;
              const formLabel = def.id === "G1" ? "→ New Project Request"
                              : def.id === "G2" ? "→ G1 Initiation Form"
                              : def.id === "G3" ? "→ Submit Plan"
                              : "→ Closure Form";
              return formUrl ? (
                <div style={{ marginTop: 12 }}>
                  <a href={formUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.border, color: "#fff", fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, textDecoration: "none" }}>
                    {formLabel}
                  </a>
                </div>
              ) : null;
            })()}
            {def.id === _currentGateDef?.id && _slaDays != null && g.status !== "Approved" && (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 8, background: _slaDays > 30 ? "#fee2e2" : _slaDays > 14 ? "#fef9c3" : "#dcfce7", color: _slaDays > 30 ? "#991b1b" : _slaDays > 14 ? "#854d0e" : "#15803d" }}>
                  {_slaDays > 30 ? "⚠ " : ""}Day {_slaDays} at this gate{_slaDays > 30 ? " — Review recommended" : ""}
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

// ─── PROJECT TYPE BADGE ───────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const styles = {
    "Business Project":   { bg: "#dbeafe", text: "#1e40af", icon: "🔵" },
    "Enterprise Project": { bg: "#ede9fe", text: "#6d28d9", icon: "🟣" },
    "Internal Project":   { bg: "#dcfce7", text: "#15803d", icon: "🟢" },
  };
  const s = styles[type] || styles["Internal Project"];
  return (
    <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {s.icon} {type}
    </span>
  );
};

// ─── DOCUMENT COMPLIANCE CARD ─────────────────────────────────────
const DocComplianceBar = ({ project }) => {
  const T = useT();
  const allDocs = project.documents ?? [];
  const reqDocs = allDocs.filter(d => d.required);
  const ready   = reqDocs.filter(d => ["Approved","Final","Received","Current","Submitted"].includes(d.status));
  const pct     = reqDocs.length ? Math.round((ready.length / reqDocs.length) * 100) : 0;
  const color   = pct === 100 ? "#16a34a" : pct >= 60 ? "#eab308" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: T.border, borderRadius: 6, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
      <span style={{ fontSize: 11, color: T.muted }}>{ready.length}/{reqDocs.length} required</span>
    </div>
  );
};

const Badge = ({ status, size = "sm" }) => {
  const T = useT();
  const c = statusColor[status] || { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: size === "sm" ? 11 : 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
};

const HealthBadge = ({ status }) => {
  const c = healthColor[status] || healthColor["Amber"];
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{c.label}</span>
  );
};

const RiskBadge = ({ level }) => {
  const c = riskColor[level] || riskColor["Medium"];
  return <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{level}</span>;
};

const Progress = ({ value, color, height = 6 }) => {
  const T = useT();
  return (
    <div style={{ background: T.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: "100%", background: color || T.accent, borderRadius: height, transition: "width 0.3s" }} />
    </div>
  );
};

const KPICard = ({ label, value, sub, color, icon, onClick }) => {
  const T = useT();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hovered ? (color || T.accent) : T.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, border-color 0.15s",
        boxShadow: hovered ? `0 4px 18px rgba(0,0,0,0.12)` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
};

const SectionHeader = ({ title, subtitle, action, onAction }) => {
  const T = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>{title}</h2>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 13, color: T.muted }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{action}</button>
      )}
    </div>
  );
};

const Tab = ({ tabs, active, onSelect }) => {
  const T = useT();
  return (
    <div className="pmo-tabs" style={{ display: "flex", gap: 4, borderBottom: `2px solid ${T.border}`, marginBottom: 24 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{ background: "none", border: "none", borderBottom: active === t ? `2px solid ${T.primary}` : "2px solid transparent", marginBottom: -2, padding: "10px 16px", fontSize: 13, fontWeight: active === t ? 700 : 500, color: active === t ? T.primary : T.muted, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0 }}>{t}</button>
      ))}
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────
const Sidebar = ({ route, setRoute, projects, requests, gateSubmissions, closureSubmissions, currentUserEmail, currentUserName, userRole, open, onClose }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const isDesktop = bp === "desktop";

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!isDesktop && open) {
      document.body.classList.add("pmo-sidebar-open");
    } else {
      document.body.classList.remove("pmo-sidebar-open");
    }
    return () => document.body.classList.remove("pmo-sidebar-open");
  }, [open, isDesktop]);

  const navigate = (routeObj) => {
    setRoute(routeObj);
    if (!isDesktop) onClose();
  };

  const attnCount = useMemo(
    () => projects.filter(p => !p.archived && (p.status === "Delayed" || p.riskLevel === "Critical")).length,
    [projects]
  );

  // Pending actions = submissions where pendingWithEmail matches current user
  const actionsCount = useMemo(() => {
    const reqPending  = (requests       || []).filter(r => r.pendingWithEmail && r.pendingWithEmail === currentUserEmail).length;
    const gatePending = (gateSubmissions|| []).filter(g => g.pendingWithEmail && g.pendingWithEmail === currentUserEmail).length;
    return reqPending + gatePending;
  }, [requests, gateSubmissions, currentUserEmail]);

  // All active submissions across all three lists
  const myRequestsCount = useMemo(() => {
    const reqs    = (requests           || []).filter(r => !r.status?.startsWith("Approved") && !r.status?.startsWith("Rejected")).length;
    const gates   = (gateSubmissions    || []).filter(g => !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected")).length;
    const closures= (closureSubmissions || []).filter(c => c.status !== "Closed").length;
    return reqs + gates + closures;
  }, [requests, gateSubmissions, closureSubmissions]);

  const navItems = [
    { icon: "🏠", label: "Portfolio Overview", route: "home" },
    { icon: "📁", label: "Departments",         route: "departments" },
    { icon: "📋", label: "All Projects",         route: "projects", badge: attnCount },
    { icon: "📨", label: "New Request",          route: "requests"},
    { icon: "✅", label: "My Actions",            route: "actions",  badge: actionsCount, badgeColor: actionsCount > 0 ? "#d97706" : null },
    ...((userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) ? [{ icon: "⚙️", label: "Admin Panel", route: "admin" }] : []),
  ];

  const sidebarStyle = isDesktop
    ? { width: 220, minWidth: 220, background: T.sidebarBg, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, flexShrink: 0 }
    : { width: 260, background: T.sidebarBg, display: "flex", flexDirection: "column", height: "100vh", position: "fixed", top: 0, left: 0, zIndex: 100, transform: open ? "translateX(0)" : "translateX(-100%)" };

  return (
    <>
      {/* Backdrop overlay — mobile/tablet only */}
      {!isDesktop && open && <div className="pmo-overlay" onClick={onClose} />}

      <div className="pmo-sidebar" style={sidebarStyle}>
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid rgba(255,255,255,0.1)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: T.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>PMO Portal</div>
              <div style={{ color: T.secondary, fontSize: 10, lineHeight: 1.2 }}>Enterprise Governance</div>
            </div>
          </div>
          {!isDesktop && (
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.secondary, fontSize: 20, cursor: "pointer", padding: "4px 8px", lineHeight: 1 }}>✕</button>
          )}
        </div>

        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {navItems.map(item => (
            <button key={item.route} onClick={() => navigate({ view: item.route })} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none",
              background: route.view === item.route ? "rgba(0,255,179,0.12)" : "transparent",
              color: route.view === item.route ? T.accent : T.secondary, cursor: "pointer", fontSize: 13, fontWeight: route.view === item.route ? 600 : 400,
              marginBottom: 2, transition: "all 0.15s", textAlign: "left"
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background: item.badgeColor || "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 10, lineHeight: "18px" }}>{item.badge}</span>
              )}
            </button>
          ))}
          <div style={{ margin: "16px 0 8px", padding: "0 12px", fontSize: 10, color: "rgba(161,185,171,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Departments</div>
          {departments.map(d => {
            const stats = getDeptStats(d.id, projects.filter(p => !p.archived));
            const del = projects.filter(p => !p.archived && p.deptId === d.id && p.status === "Delayed").length;
            return (
              <button key={d.id} onClick={() => navigate({ view: "department", deptId: d.id })} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8,
                border: del > 0 ? "1px solid rgba(220,38,38,0.4)" : "1px solid transparent",
                background: route.deptId === d.id ? "rgba(0,255,179,0.12)" : "transparent",
                boxShadow: del > 0 ? "0 0 10px rgba(220,38,38,0.22), inset 0 0 8px rgba(220,38,38,0.06)" : "none",
                color: route.deptId === d.id ? T.accent : T.secondary, cursor: "pointer", fontSize: 12, fontWeight: 400,
                marginBottom: 1, transition: "all 0.15s", textAlign: "left"
              }}>
                <span style={{ fontSize: 14 }}>{d.icon}</span>
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  <span style={{ background: "rgba(255,255,255,0.1)", color: T.light, fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>
                    {stats.total}
                  </span>
                  {del > 0 && (
                    <span className="pmo-pulse-dot" style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: `1px solid rgba(255,255,255,0.08)`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: T.accent, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#061210", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            {(currentUserName || currentUserEmail || "?")[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUserName || "PMO User"}</div>
            <div style={{ fontSize: 10, color: T.secondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUserEmail || ""}</div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── HEADER ──────────────────────────────────────────────────────
const Header = ({ title, subtitle, route, setRoute, dark, toggleDark, onMenuClick, projects, currentUserName }) => {
  const T = useT();
  const bp = useBp();
  const { departments } = useDepts();
  const isMobile = bp === "mobile";
  const isDesktop = bp === "desktop";

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return (projects || [])
      .filter(p => !p.archived)
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.pm || "").toLowerCase().includes(q) ||
        (departments.find(d => d.id === p.deptId)?.name || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, projects, departments]);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const handleBack = () => {
    if (route.view === "project") {
      if (route.from === "department") return setRoute({ view: "department", deptId: route.deptId });
      if (route.from === "projects")   return setRoute({ view: "projects" });
      if (route.from === "admin")      return setRoute({ view: "admin" });
      if (route.from === "search")     return setRoute({ view: "projects" });
    }
    setRoute({ view: "home" });
  };

  const backLabel = () => {
    if (route.view === "project") {
      if (route.from === "department") {
        const dept = departments.find(d => d.id === route.deptId);
        return `← Back to ${dept?.name || "Department"}`;
      }
      if (route.from === "projects") return "← Back to All Projects";
      if (route.from === "admin")    return "← Back to Admin";
      if (route.from === "search")   return "← Back to All Projects";
    }
    return "← Back";
  };

  return (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: isMobile ? "12px 16px" : "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, flex: 1, minWidth: 0 }}>
        {/* Hamburger — tablet and mobile only */}
        {!isDesktop && (
          <button onClick={onMenuClick} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 18, cursor: "pointer", color: T.text, lineHeight: 1, flexShrink: 0 }}>☰</button>
        )}
        {route.view !== "home" && (
          <button onClick={handleBack} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: T.muted, flexShrink: 0, whiteSpace: "nowrap" }}>{backLabel()}</button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 15 : 18, fontWeight: 800, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>
          {subtitle && !isMobile && <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{subtitle}</p>}
        </div>
      </div>

      {/* ── Global Search Modal ── */}
      {searchOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}
          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
          <div style={{ width: "min(600px, 90vw)", background: T.surface, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.35)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${T.border}`, gap: 10 }}>
              <span style={{ fontSize: 18, color: T.muted }}>🔍</span>
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search projects by name, code, PM, or department…"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", color: T.text }} />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} style={{ background: "none", border: "none", color: T.muted, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {searchResults.length > 0 ? searchResults.map(p => {
                const dept = departments.find(d => d.id === p.deptId);
                return (
                  <div key={p.id} onClick={() => { setRoute({ view: "project", projectId: p.id, from: "search" }); setSearchOpen(false); setSearchQuery(""); }}
                    style={{ padding: "12px 20px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.cardHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                        <span style={{ color: T.primary, fontWeight: 700 }}>{p.code}</span>
                        {dept && <> · {dept.icon} {dept.name}</>}
                        {p.pm && <> · {p.pm}</>}
                      </div>
                    </div>
                    <Badge status={p.status} />
                  </div>
                );
              }) : (
                <div style={{ padding: "32px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                  {searchQuery.length >= 2 ? "No projects found" : "Type at least 2 characters to search"}
                </div>
              )}
            </div>
            {searchResults.length > 0 && (
              <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.muted }}>
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} · Press Esc to close
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: isMobile ? 6 : 10, alignItems: "center", flexShrink: 0 }}>
        {/* Date — hidden on mobile */}
        {isDesktop && (
          <span style={{ fontSize: 12, color: T.muted }}>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        )}

        {/* Search Button */}
        <button onClick={() => setSearchOpen(true)} title="Search projects (Ctrl+K)"
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: isMobile ? "6px 10px" : "6px 12px", fontSize: 16, cursor: "pointer", color: T.muted, lineHeight: 1, display: "flex", alignItems: "center", gap: 4 }}>
          🔍{!isMobile && <span style={{ fontSize: 12, color: T.muted }}>Search</span>}
        </button>

        {/* Data Source Badge — visible only in dev or when mock is active; auto-hidden in production + live SP */}
        {(import.meta.env.DEV || isUsingMock()) && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
            background: isUsingMock() ? "#fef9c3" : "#dcfce7",
            color:      isUsingMock() ? "#854d0e" : "#15803d",
            border:     `1px solid ${isUsingMock() ? "#fde68a" : "#86efac"}`,
            whiteSpace: "nowrap",
          }}>
            {isUsingMock() ? "MOCK" : "LIVE"}
          </span>
        )}

        {/* Dark Mode Toggle */}
        <button onClick={toggleDark} title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            display: "flex", alignItems: "center", gap: isMobile ? 0 : 7,
            background: dark ? "#0f2a22" : T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 20, padding: isMobile ? "6px 10px" : "6px 14px",
            cursor: "pointer", transition: "all 0.2s",
            fontSize: 12, fontWeight: 600, color: T.text,
          }}>
          <span style={{ fontSize: 15 }}>{dark ? "☀️" : "🌙"}</span>
          {!isMobile && <span style={{ color: T.text }}>{dark ? "Light" : "Dark"}</span>}
          {!isMobile && (
            <div style={{ width: 32, height: 18, borderRadius: 10, background: dark ? T.accent : "#cbd5e1", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: dark ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: dark ? "#061210" : "#fff", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
          )}
        </button>

        <div style={{ width: 34, height: 34, background: dark ? T.accent : "#003932", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: dark ? "#061210" : T.accent, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{(currentUserName || "?")[0].toUpperCase()}</div>
      </div>
    </div>
  );
};

// ─── HOME / PORTFOLIO OVERVIEW ────────────────────────────────────
const HomeView = ({ projects, requests, gateSubmissions, setRoute, loadedAt }) => {
  const bp = useBp();
  const { departments } = useDepts();
  const T = useT();
  const allProjects = projects.filter(p => !p.archived);
  const byStatus = { "On Track": 0, "At Risk": 0, "Delayed": 0, "Completed": 0, "Not Started": 0 };
  allProjects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
  const statusPie = Object.entries(byStatus).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["#16a34a", "#eab308", "#dc2626", "#3b82f6", "#9ca3af"];

  const budgetTotal = allProjects.reduce((s, p) => s + p.budget, 0);
  const costTotal = allProjects.reduce((s, p) => s + p.actualCost, 0);

  const deptPerf = departments.map(d => {
    const s = getDeptStats(d.id, allProjects);
    const ipi = calcDeptIPI(d.id, allProjects);
    // shorten name to fit chart
    const short = d.name
      .replace("Strategy & PMO", "Strategy")
      .replace("Operations", "Ops")
      .replace("Performance", "Perf")
      .replace("Finance", "Finance");
    return { name: short, health: s.health, ipi, projects: s.total, icon: d.icon };
  });

  const riskDist = [
    { name: "Low",      value: allProjects.filter(p => p.riskLevel === "Low").length,      fill: "#16a34a" },
    { name: "Medium",   value: allProjects.filter(p => p.riskLevel === "Medium").length,    fill: "#eab308" },
    { name: "High",     value: allProjects.filter(p => p.riskLevel === "High").length,      fill: "#dc2626" },
    { name: "Critical", value: allProjects.filter(p => p.riskLevel === "Critical").length,  fill: "#490300" },
  ].filter(x => x.value);

  // budget per dept for bar chart
  const budgetPerDept = departments.map(d => {
    const s = getDeptStats(d.id, allProjects);
    const short = d.name.replace("Strategy & PMO","Strategy").replace("Operations","Ops").replace("Performance","Perf");
    return { name: short, budget: +(s.totalBudget/1000000).toFixed(1), spent: +(s.actualCost/1000000).toFixed(1) };
  });

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const kpiCols = bp === "mobile" ? "repeat(2, 1fr)" : bp === "tablet" ? "repeat(3, 1fr)" : "repeat(6, 1fr)";
  const chartCols = bp === "mobile" || bp === "tablet" ? "1fr" : "2fr 1fr";

  return (
    <div style={{ padding: pad, maxWidth: 1500 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 20 : 26, fontWeight: 900, color: T.text }}>Enterprise Portfolio Dashboard</h1>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>
          Real-time portfolio overview across all departments · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          {loadedAt && <span style={{ color: T.accent, fontWeight: 600 }}> · Synced {loadedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 14, marginBottom: 24 }}>
        <KPICard label="Total Projects"    value={allProjects.length}          icon="📋" onClick={() => setRoute({ view: "projects", filterStatus: "All" })} />
        <KPICard label="On Track"          value={byStatus["On Track"] || 0}   color="#16a34a" icon="✅" onClick={() => setRoute({ view: "projects", filterStatus: "On Track" })} />
        <KPICard label="At Risk"           value={byStatus["At Risk"] || 0}    color="#eab308" icon="⚠️" onClick={() => setRoute({ view: "projects", filterStatus: "At Risk" })} />
        <KPICard label="Delayed"           value={byStatus["Delayed"] || 0}    color="#dc2626" icon="🔴" onClick={() => setRoute({ view: "projects", filterStatus: "Delayed" })} />
        <KPICard label="Completed"         value={byStatus["Completed"] || 0}  color="#3b82f6" icon="🏁" onClick={() => setRoute({ view: "projects", filterStatus: "Completed" })} />
        <KPICard label="Portfolio Budget"  value={fmtSAR(budgetTotal)} sub={`${fmtSAR(costTotal)} spent`} icon="💰" />
      </div>

      {/* ── ROW 1: Department Health (wide) + Budget Summary ── */}
      <div style={{ display: "grid", gridTemplateColumns: chartCols, gap: 20, marginBottom: 20 }}>

        {/* Department Health Score — bigger */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Department Health Score</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>Portfolio progress % across all {departments.length} departments</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptPerf} barSize={32} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={38} />
              <Tooltip formatter={v => [`${v}%`, "Health"]} {...ttStyle()} />
              <Bar dataKey="health" radius={[6, 6, 0, 0]} minPointSize={4}>
                {deptPerf.map((entry, i) => (
                  <Cell key={i} fill={entry.health === 0 ? T.border : entry.health >= 70 ? T.accent : entry.health >= 50 ? "#eab308" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Summary */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Budget Summary</h3>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Portfolio level</p>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[
              { label: "Total Approved", value: fmtSAR(budgetTotal),              color: T.text },
              { label: "Total Spent",    value: fmtSAR(costTotal),                color: T.text },
              { label: "Remaining",      value: fmtSAR(budgetTotal - costTotal),  color: (budgetTotal - costTotal) >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Utilisation",    value: `${budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0}%`, color: T.primary },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.muted }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.muted }}>Overall Utilisation</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0}%</span>
              </div>
              <Progress value={budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0} height={10}
                color={budgetTotal && costTotal / budgetTotal > 0.9 ? "#dc2626" : T.accent} />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: IPI (wide) + Risk Profile ── */}
      <div style={{ display: "grid", gridTemplateColumns: chartCols, gap: 20, marginBottom: 24 }}>

        {/* Department IPI Scores — bigger, all departments visible */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Department IPI Scores</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>SPI×50% + CPI×25% + Docs×25% — all {departments.length} departments</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptPerf} barSize={32} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} width={38} />
              <Tooltip formatter={v => [v, "IPI Score"]} {...ttStyle()} />
              <Bar dataKey="ipi" radius={[6, 6, 0, 0]}>
                {deptPerf.map((entry, i) => {
                  const c = ipiColor(entry.ipi);
                  return <Cell key={i} fill={c.color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { label: "Excellent 90+", color: "#15803d" },
              { label: "Good 70+",      color: "#003932" },
              { label: "Fair 55+",      color: "#854d0e" },
              { label: "Poor <55",      color: "#991b1b" },
            ].map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span style={{ fontSize: 11, color: T.muted }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Profile */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Risk Profile</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted }}>By risk level</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={42}>
                {riskDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip {...ttStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {riskDist.map(r => (
              <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.fill }} />
                  <span style={{ fontSize: 12, color: T.text }}>{r.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Cards */}
      <SectionHeader title="Department Portfolio Overview" subtitle="Click a department to view its projects" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {departments.map(d => {
          const stats = getDeptStats(d.id, allProjects);
          return (
            <div key={d.id} onClick={() => setRoute({ view: "department", deptId: d.id })} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,57,50,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: T.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{stats.total} projects</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.primary }}>{stats.health}%</div>
                  <div style={{ fontSize: 10, color: T.muted }}>health</div>
                </div>
              </div>
              <Progress value={stats.health} color={stats.health > 70 ? T.accent : stats.health > 50 ? "#eab308" : "#dc2626"} height={6} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 16 }}>
                {[
                  { label: "Active", value: stats.active, color: "#16a34a" },
                  { label: "At Risk", value: stats.total - stats.active - stats.delayed - stats.completed, color: "#eab308" },
                  { label: "Delayed", value: stats.delayed, color: "#dc2626" },
                  { label: "Done", value: stats.completed, color: "#3b82f6" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid rgba(255,255,255,0.15)` }}>
                <div style={{ fontSize: 12, color: T.muted }}>Budget: <span style={{ fontWeight: 600, color: T.text }}>{fmtSAR(stats.totalBudget)}</span></div>
                <div style={{ fontSize: 12, color: T.muted }}>High Risk: <span style={{ fontWeight: 600, color: stats.highRisk > 0 ? "#dc2626" : T.text }}>{stats.highRisk}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── GRC KRI DASHBOARD ───────────────────────────────────────────
const GRC_SP_SITE = "https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard";

const RAG_COLOR = {
  Green: { bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
  Amber: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  Red:   { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" },
};
const trendIcon  = t => t === "Improving" ? "↑" : t === "Worsening" ? "↓" : "→";
const trendColor = t => t === "Improving" ? "#15803d" : t === "Worsening" ? "#dc2626" : "#d97706";

// ── GRC shared modal wrapper ──────────────────────────────────────
const GRCModal = ({ title, onClose, children }) => {
  const T = useT();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
};

// ── Add KRI Reading form ──────────────────────────────────────────
const GRCReadingForm = ({ kri, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    KRIID:              kri.KRIID,
    KRIName:            kri.Title,
    ActualValue:        "",
    PreviousValue:      "",
    Period:             new Date().toISOString().substring(0, 7),
    RAGStatus:          "Green",
    Trend:              "Stable",
    Comments:           "",
    EscalationRequired: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Actual Value *</label>
          <input type="number" value={form.ActualValue} onChange={e => set("ActualValue", e.target.value)} placeholder="e.g. 42" style={inp} />
        </div>
        <div>
          <label style={lbl}>Previous Value</label>
          <input type="number" value={form.PreviousValue} onChange={e => set("PreviousValue", e.target.value)} placeholder="optional" style={inp} />
        </div>
      </div>
      <div>
        <label style={lbl}>Period (YYYY-MM) *</label>
        <input type="month" value={form.Period} onChange={e => set("Period", e.target.value)} style={inp} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>RAG Status</label>
          <select value={form.RAGStatus} onChange={e => set("RAGStatus", e.target.value)} style={inp}>
            {["Green","Amber","Red"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Trend</label>
          <select value={form.Trend} onChange={e => set("Trend", e.target.value)} style={inp}>
            {["Improving","Stable","Worsening"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>Comments</label>
        <textarea value={form.Comments} onChange={e => set("Comments", e.target.value)} rows={3} placeholder="Optional commentary…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="grc-escal" checked={form.EscalationRequired} onChange={e => set("EscalationRequired", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="grc-escal" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Escalation required</label>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.ActualValue} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.ActualValue ? "not-allowed" : "pointer", opacity: saving || !form.ActualValue ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Reading"}
        </button>
      </div>
    </div>
  );
};

// ── Edit Risk Register form ───────────────────────────────────────
const GRCRiskForm = ({ risk, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID:                   risk.ID,
    LikelihoodScore:      risk.LikelihoodScore ?? 3,
    ImpactScore:          risk.ImpactScore ?? 3,
    RiskStatus:           risk.RiskStatus || "Open",
    RiskAppetiteBreached: risk.RiskAppetiteBreached ?? false,
    MitigationSummary:    risk.MitigationSummary || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  const score = (form.LikelihoodScore || 0) * (form.ImpactScore || 0);
  const sc = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.muted }}>{risk.Title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Likelihood (1–5)</label>
          <select value={form.LikelihoodScore} onChange={e => set("LikelihoodScore", Number(e.target.value))} style={inp}>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Impact (1–5)</label>
          <select value={form.ImpactScore} onChange={e => set("ImpactScore", Number(e.target.value))} style={inp}>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>Risk Score:</span>
        <span style={{ background: sc, color: "#fff", borderRadius: 7, padding: "3px 10px", fontSize: 13, fontWeight: 900 }}>{score}</span>
      </div>
      <div>
        <label style={lbl}>Risk Status</label>
        <select value={form.RiskStatus} onChange={e => set("RiskStatus", e.target.value)} style={inp}>
          {["Open","In Progress","Mitigated","Closed"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="grc-breach" checked={!!form.RiskAppetiteBreached} onChange={e => set("RiskAppetiteBreached", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="grc-breach" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Risk appetite breached</label>
      </div>
      <div>
        <label style={lbl}>Mitigation Summary</label>
        <textarea value={form.MitigationSummary} onChange={e => set("MitigationSummary", e.target.value)} rows={3} placeholder="Describe mitigation actions…" style={{ ...inp, resize: "vertical" }} />
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Risk"}
        </button>
      </div>
    </div>
  );
};

// ── Edit Risk Appetite form ───────────────────────────────────────
const GRCAppetiteForm = ({ item, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID:                   item.ID,
    CurrentExposureScore: item.CurrentExposureScore ?? 0,
    AppetiteStatus:       item.AppetiteStatus || "Within Appetite",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px" }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Category</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{item.RiskCategory}</div>
        {item.AppetiteStatement && <div style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>"{item.AppetiteStatement}"</div>}
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Max tolerable score: {item.MaxTolerableScore}</div>
      </div>
      <div>
        <label style={lbl}>Current Exposure Score</label>
        <input type="number" min="0" value={form.CurrentExposureScore} onChange={e => set("CurrentExposureScore", Number(e.target.value))} style={inp} />
      </div>
      <div>
        <label style={lbl}>Appetite Status</label>
        <select value={form.AppetiteStatus} onChange={e => set("AppetiteStatus", e.target.value)} style={inp}>
          {["Within Appetite","Near Limit","Breached"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Appetite"}
        </button>
      </div>
    </div>
  );
};

// ── Edit KRI Master form ──────────────────────────────────────────
const GRCMasterForm = ({ kri, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: kri.ID,
    Title: kri.Title || "",
    KRICategory: kri.KRICategory || "Operational",
    MeasurementUnit: kri.MeasurementUnit || "",
    GreenThreshold: kri.GreenThreshold ?? "",
    AmberThreshold: kri.AmberThreshold ?? "",
    RedThreshold: kri.RedThreshold ?? "",
    ThresholdDirection: kri.ThresholdDirection || "Lower is better",
    IsActive: kri.IsActive !== false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={lbl}>KRI Name *</label>
        <input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Category</label>
          <select value={form.KRICategory} onChange={e => set("KRICategory", e.target.value)} style={inp}>
            {["Financial","Operational","Compliance","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Unit (%, Count, Days…)</label>
          <input value={form.MeasurementUnit} onChange={e => set("MeasurementUnit", e.target.value)} placeholder="e.g. %" style={inp} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Green Threshold</label><input type="number" value={form.GreenThreshold} onChange={e => set("GreenThreshold", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Amber Threshold</label><input type="number" value={form.AmberThreshold} onChange={e => set("AmberThreshold", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Red Threshold</label><input type="number" value={form.RedThreshold} onChange={e => set("RedThreshold", e.target.value)} style={inp} /></div>
      </div>
      <div>
        <label style={lbl}>Threshold Direction</label>
        <select value={form.ThresholdDirection} onChange={e => set("ThresholdDirection", e.target.value)} style={inp}>
          <option>Lower is better</option>
          <option>Higher is better</option>
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="kri-active" checked={form.IsActive} onChange={e => set("IsActive", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="kri-active" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Active KRI</label>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>{saving ? "Saving…" : "Save KRI"}</button>
      </div>
    </div>
  );
};

// ── Add new Risk form ─────────────────────────────────────────────
const GRCNewRiskForm = ({ onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({ Title: "", RiskCategory: "Operational", BusinessUnit: "", LikelihoodScore: 3, ImpactScore: 3, RiskStatus: "Open", RiskAppetiteBreached: false, MitigationSummary: "", NextReviewDate: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  const score = (form.LikelihoodScore || 0) * (form.ImpactScore || 0);
  const sc = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Risk Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} placeholder="Describe the risk…" style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Category</label>
          <select value={form.RiskCategory} onChange={e => set("RiskCategory", e.target.value)} style={inp}>
            {["Financial","Operational","Compliance","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Business Unit</label><input value={form.BusinessUnit} onChange={e => set("BusinessUnit", e.target.value)} placeholder="Optional" style={inp} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Likelihood (1–5)</label><select value={form.LikelihoodScore} onChange={e => set("LikelihoodScore", Number(e.target.value))} style={inp}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><label style={lbl}>Impact (1–5)</label><select value={form.ImpactScore} onChange={e => set("ImpactScore", Number(e.target.value))} style={inp}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>Risk Score:</span>
        <span style={{ background: sc, color: "#fff", borderRadius: 7, padding: "3px 10px", fontSize: 13, fontWeight: 900 }}>{score}</span>
      </div>
      <div><label style={lbl}>Risk Status</label><select value={form.RiskStatus} onChange={e => set("RiskStatus", e.target.value)} style={inp}>{["Open","In Progress","Mitigated","Closed"].map(s => <option key={s}>{s}</option>)}</select></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="nr-breach" checked={form.RiskAppetiteBreached} onChange={e => set("RiskAppetiteBreached", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="nr-breach" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Risk appetite breached</label>
      </div>
      <div><label style={lbl}>Mitigation Summary</label><textarea value={form.MitigationSummary} onChange={e => set("MitigationSummary", e.target.value)} rows={3} placeholder="Describe mitigation actions…" style={{ ...inp, resize: "vertical" }} /></div>
      <div><label style={lbl}>Next Review Date</label><input type="date" value={form.NextReviewDate} onChange={e => set("NextReviewDate", e.target.value)} style={inp} /></div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>{saving ? "Saving…" : "Add Risk"}</button>
      </div>
    </div>
  );
};

// ── Add new Risk Appetite category form ───────────────────────────
const GRCNewAppetiteForm = ({ onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({ RiskCategory: "", AppetiteStatement: "", MaxTolerableScore: 10, CurrentExposureScore: 0, AppetiteStatus: "Within Appetite" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={lbl}>Risk Category *</label>
        <select value={form.RiskCategory} onChange={e => set("RiskCategory", e.target.value)} style={inp}>
          <option value="">— Select —</option>
          {["Financial","Operational","Compliance","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div><label style={lbl}>Appetite Statement</label><textarea value={form.AppetiteStatement} onChange={e => set("AppetiteStatement", e.target.value)} rows={2} placeholder="We accept…" style={{ ...inp, resize: "vertical" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Max Tolerable Score</label><input type="number" min="1" value={form.MaxTolerableScore} onChange={e => set("MaxTolerableScore", Number(e.target.value))} style={inp} /></div>
        <div><label style={lbl}>Current Exposure Score</label><input type="number" min="0" value={form.CurrentExposureScore} onChange={e => set("CurrentExposureScore", Number(e.target.value))} style={inp} /></div>
      </div>
      <div><label style={lbl}>Appetite Status</label><select value={form.AppetiteStatus} onChange={e => set("AppetiteStatus", e.target.value)} style={inp}>{["Within Appetite","Near Limit","Breached"].map(s => <option key={s}>{s}</option>)}</select></div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.RiskCategory} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.RiskCategory ? "not-allowed" : "pointer", opacity: saving || !form.RiskCategory ? 0.6 : 1 }}>{saving ? "Saving…" : "Add Category"}</button>
      </div>
    </div>
  );
};

const GRCAuditFindingForm = ({ item = null, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: item?.ID || null,
    Title: item?.Title || "",
    FindingSeverity: item?.FindingSeverity || "Medium",
    BusinessUnit: item?.BusinessUnit || "",
    Status: item?.Status || "Open",
    DueDate: item?.DueDate ? item.DueDate.substring(0, 10) : "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Finding Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Severity</label>
          <select value={form.FindingSeverity} onChange={e => set("FindingSeverity", e.target.value)} style={inp}>
            {["Critical","High","Medium","Low"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Status</label>
          <select value={form.Status} onChange={e => set("Status", e.target.value)} style={inp}>
            {["Open","In Progress","Closed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Business Unit</label><input value={form.BusinessUnit} onChange={e => set("BusinessUnit", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Due Date</label><input type="date" value={form.DueDate} onChange={e => set("DueDate", e.target.value)} style={inp} /></div>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>
          {saving ? "Saving…" : item ? "Update Finding" : "Add Finding"}
        </button>
      </div>
    </div>
  );
};

const GRCCorrectiveActionForm = ({ item = null, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: item?.ID || null,
    Title: item?.Title || "",
    Status: item?.Status || "Not Started",
    CompletionPercentage: item?.CompletionPercentage ?? 0,
    TargetDate: item?.TargetDate ? item.TargetDate.substring(0, 10) : "",
    LinkedFindingID: item?.LinkedFindingID || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box", fontFamily: "inherit" };
  const pct = Math.min(100, Math.max(0, Number(form.CompletionPercentage) || 0));
  const pc  = pct >= 70 ? "#00c48c" : pct >= 30 ? "#f5a623" : "#dc2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Action Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Status</label>
          <select value={form.Status} onChange={e => set("Status", e.target.value)} style={inp}>
            {["Not Started","In Progress","Completed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Target Date</label><input type="date" value={form.TargetDate} onChange={e => set("TargetDate", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Linked Finding ID</label><input value={form.LinkedFindingID} onChange={e => set("LinkedFindingID", e.target.value)} style={inp} placeholder="Optional" /></div>
      </div>
      <div>
        <label style={lbl}>Completion % — <span style={{ color: pc, fontWeight: 900 }}>{pct}%</span></label>
        <input type="range" min="0" max="100" step="5" value={pct} onChange={e => set("CompletionPercentage", Number(e.target.value))} style={{ width: "100%", accentColor: pc, cursor: "pointer" }} />
        <div style={{ background: T.border, borderRadius: 4, height: 6, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pc, borderRadius: 4, transition: "width 0.15s" }} />
        </div>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>
          {saving ? "Saving…" : item ? "Update Action" : "Add Action"}
        </button>
      </div>
    </div>
  );
};

const GRCDashboard = ({ canEdit = false }) => {
  const T   = useT();
  const bp  = useBp();
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState("");
  const [kriMaster,        setKriMaster]        = useState([]);
  const [kriReadings,      setKriReadings]      = useState([]);
  const [riskReg,          setRiskReg]          = useState([]);
  const [appetite,         setAppetite]         = useState([]);
  const [auditFindings,    setAuditFindings]    = useState([]);
  const [correctiveActions,setCorrectiveActions]= useState([]);
  const [selectedKRI, setSelectedKRI] = useState(null);
  // Edit modals
  const [readingModal,    setReadingModal]    = useState(null);
  const [riskModal,       setRiskModal]       = useState(null);
  const [appetiteModal,   setAppetiteModal]   = useState(null);
  const [masterModal,     setMasterModal]     = useState(null);
  const [newRiskModal,    setNewRiskModal]     = useState(false);
  const [newAppetiteModal,setNewAppetiteModal] = useState(false);
  const [afEditModal,     setAfEditModal]      = useState(null);
  const [afNewModal,      setAfNewModal]       = useState(false);
  const [caEditModal,     setCaEditModal]      = useState(null);
  const [caNewModal,      setCaNewModal]       = useState(false);
  const [globalEdit, setGlobalEdit] = useState(false);
  const [heatmapCell, setHeatmapCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const token   = await acquireSpToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata" };
      const base    = `${GRC_SP_SITE}/_api/web/lists/getbytitle`;
      const [mR, rR, rrR, aR, afR, caR] = await Promise.all([
        fetch(`${base}('GRC_KRI_Master')/items?$select=ID,Title,KRIID,KRICategory,KRIOwner/Title,BusinessUnit,MeasurementUnit,GreenThreshold,AmberThreshold,RedThreshold,ThresholdDirection,IsActive&$expand=KRIOwner&$top=500`, { headers }),
        fetch(`${base}('GRC_KRI_Readings')/items?$select=ID,Title,KRIID,KRIName,ReadingDate,ActualValue,PreviousValue,Period,RAGStatus,Trend,Comments,EscalationRequired&$orderby=ReadingDate desc&$top=500`, { headers }),
        fetch(`${base}('GRC_RiskRegister')/items?$select=ID,Title,RiskID,RiskCategory,RiskOwner/Title,BusinessUnit,LikelihoodScore,ImpactScore,RiskStatus,RiskAppetiteBreached,NextReviewDate,MitigationSummary&$expand=RiskOwner&$top=500`, { headers }),
        fetch(`${base}('GRC_RiskAppetite')/items?$select=ID,Title,RiskCategory,AppetiteStatement,MaxTolerableScore,CurrentExposureScore,AppetiteStatus&$top=500`, { headers }),
        fetch(`${base}('GRC_AuditFindings')/items?$select=ID,Title,FindingSeverity,BusinessUnit,Status,DueDate&$top=500`, { headers }),
        fetch(`${base}('GRC_CorrectiveActions')/items?$select=ID,Title,Status,CompletionPercentage,TargetDate,LinkedFindingID&$top=500`, { headers }),
      ]);
      const [m, r, rr, a, af, ca] = await Promise.all([mR.json(), rR.json(), rrR.json(), aR.json(), afR.json(), caR.json()]);
      setKriMaster(m.value          || []);
      setKriReadings(r.value        || []);
      setRiskReg(rr.value           || []);
      setAppetite(a.value           || []);
      setAuditFindings(af.value     || []);
      setCorrectiveActions(ca.value || []);
    } catch(e) { setError(e.message); }
    finally    { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── SP Write helpers ──────────────────────────────────────────
  const spPost = async (listName, data) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
  const spPatch = async (listName, id, data) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items(${id})`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata", "IF-MATCH": "*", "X-HTTP-Method": "MERGE" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
  };
  const spDelete = async (listName, id) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items(${id})`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata", "IF-MATCH": "*", "X-HTTP-Method": "DELETE" },
    });
    if (!res.ok) throw new Error(await res.text());
  };

  // ── Save handlers ─────────────────────────────────────────────
  const saveReading = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPost("GRC_KRI_Readings", {
        Title:               `${form.KRIID}-${form.Period}`,
        KRIID:               form.KRIID,
        KRIName:             form.KRIName,
        ReadingDate:         new Date().toISOString(),
        ActualValue:         Number(form.ActualValue),
        PreviousValue:       form.PreviousValue ? Number(form.PreviousValue) : null,
        Period:              form.Period,
        RAGStatus:           form.RAGStatus,
        Trend:               form.Trend,
        Comments:            form.Comments || "",
        EscalationRequired:  form.EscalationRequired,
      });
      setReadingModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveRisk = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPatch("GRC_RiskRegister", form.ID, {
        LikelihoodScore:    Number(form.LikelihoodScore),
        ImpactScore:        Number(form.ImpactScore),
        RiskStatus:         form.RiskStatus,
        RiskAppetiteBreached: form.RiskAppetiteBreached,
        MitigationSummary:  form.MitigationSummary || "",
      });
      setRiskModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveAppetite = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPatch("GRC_RiskAppetite", form.ID, {
        CurrentExposureScore: Number(form.CurrentExposureScore),
        AppetiteStatus:       form.AppetiteStatus,
      });
      setAppetiteModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveMasterEdit = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPatch("GRC_KRI_Master", form.ID, {
        Title:              form.Title,
        KRICategory:        form.KRICategory,
        MeasurementUnit:    form.MeasurementUnit || "",
        GreenThreshold:     form.GreenThreshold !== "" ? Number(form.GreenThreshold) : null,
        AmberThreshold:     form.AmberThreshold !== "" ? Number(form.AmberThreshold) : null,
        RedThreshold:       form.RedThreshold   !== "" ? Number(form.RedThreshold)   : null,
        ThresholdDirection: form.ThresholdDirection,
        IsActive:           form.IsActive,
      });
      setMasterModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteRisk = async (id) => {
    if (!window.confirm("Delete this risk? This cannot be undone.")) return;
    setSaving(true); setSaveErr("");
    try { await spDelete("GRC_RiskRegister", id); await load(); }
    catch(e) { setSaveErr(e.message); }
    finally  { setSaving(false); }
  };

  const deleteAppetite = async (id) => {
    if (!window.confirm("Delete this appetite category? This cannot be undone.")) return;
    setSaving(true); setSaveErr("");
    try { await spDelete("GRC_RiskAppetite", id); await load(); }
    catch(e) { setSaveErr(e.message); }
    finally  { setSaving(false); }
  };

  const saveNewRisk = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPost("GRC_RiskRegister", {
        Title:                form.Title,
        RiskCategory:         form.RiskCategory,
        BusinessUnit:         form.BusinessUnit || "",
        LikelihoodScore:      Number(form.LikelihoodScore),
        ImpactScore:          Number(form.ImpactScore),
        RiskStatus:           form.RiskStatus,
        RiskAppetiteBreached: form.RiskAppetiteBreached,
        MitigationSummary:    form.MitigationSummary || "",
        NextReviewDate:       form.NextReviewDate || null,
      });
      setNewRiskModal(false);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveNewAppetite = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPost("GRC_RiskAppetite", {
        Title:                form.RiskCategory,
        RiskCategory:         form.RiskCategory,
        AppetiteStatement:    form.AppetiteStatement || "",
        MaxTolerableScore:    Number(form.MaxTolerableScore),
        CurrentExposureScore: Number(form.CurrentExposureScore),
        AppetiteStatus:       form.AppetiteStatus,
      });
      setNewAppetiteModal(false);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveAuditFinding = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const data = { Title: form.Title, FindingSeverity: form.FindingSeverity, BusinessUnit: form.BusinessUnit || "", Status: form.Status, DueDate: form.DueDate || null };
      if (form.ID) { await spPatch("GRC_AuditFindings", form.ID, data); setAfEditModal(null); }
      else         { await spPost("GRC_AuditFindings", data);           setAfNewModal(false); }
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteAuditFinding = async (id) => {
    if (!window.confirm("Delete this audit finding?")) return;
    setSaving(true);
    try { await spDelete("GRC_AuditFindings", id); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const saveCorrectiveAction = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const data = { Title: form.Title, Status: form.Status, CompletionPercentage: Number(form.CompletionPercentage), TargetDate: form.TargetDate || null, LinkedFindingID: form.LinkedFindingID || "" };
      if (form.ID) { await spPatch("GRC_CorrectiveActions", form.ID, data); setCaEditModal(null); }
      else         { await spPost("GRC_CorrectiveActions", data);           setCaNewModal(false); }
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteCorrectiveAction = async (id) => {
    if (!window.confirm("Delete this corrective action?")) return;
    setSaving(true);
    try { await spDelete("GRC_CorrectiveActions", id); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const activeKRIs = useMemo(() => kriMaster.filter(k => k.IsActive !== false), [kriMaster]);

  const latestByKRI = useMemo(() => {
    const map = {};
    kriReadings.forEach(r => {
      if (!map[r.KRIID] || r.ReadingDate > map[r.KRIID].ReadingDate) map[r.KRIID] = r;
    });
    return map;
  }, [kriReadings]);

  const kriWithLatest = useMemo(() =>
    activeKRIs.map(k => ({ ...k, latest: latestByKRI[k.KRIID] || null })),
    [activeKRIs, latestByKRI]
  );

  const redCount    = kriWithLatest.filter(k => k.latest?.RAGStatus === "Red").length;
  const amberCount  = kriWithLatest.filter(k => k.latest?.RAGStatus === "Amber").length;
  const greenCount  = kriWithLatest.filter(k => k.latest?.RAGStatus === "Green").length;
  const escalCount  = kriWithLatest.filter(k => k.latest?.EscalationRequired).length;
  const appBreaches = riskReg.filter(r => r.RiskAppetiteBreached && r.RiskStatus !== "Closed").length;

  const parsePeriodToDate = (period) => {
    if (!period) return null;
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1);
    }
    const d = new Date(period);
    return isNaN(d.getTime()) ? null : d;
  };

  const fmtPeriod = (period) => {
    if (!period) return "";
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    }
    return period;
  };

  const kriHistory = useMemo(() => {
    if (!selectedKRI) return [];
    // Deduplicate by Period — for the same period keep only the latest reading (by ReadingDate)
    const byPeriod = {};
    kriReadings
      .filter(r => r.KRIID === selectedKRI && r.ActualValue != null)
      .forEach(r => {
        const key = r.Period || (r.ReadingDate || "").substring(0, 7);
        if (!byPeriod[key] || (r.ReadingDate || "") > (byPeriod[key].ReadingDate || "")) {
          byPeriod[key] = r;
        }
      });
    return Object.values(byPeriod)
      .sort((a, b) => {
        const da = parsePeriodToDate(a.Period) || new Date(a.ReadingDate || 0);
        const db = parsePeriodToDate(b.Period) || new Date(b.ReadingDate || 0);
        return da - db;
      })
      .slice(-12);
  }, [kriReadings, selectedKRI]);

  const heatmapData = useMemo(() => {
    const cells = {};
    riskReg
      .filter(r => r.RiskStatus !== "Closed")
      .forEach(r => {
        const l = Number(r.LikelihoodScore);
        const i = Number(r.ImpactScore);
        if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
          const key = `${l}-${i}`;
          if (!cells[key]) cells[key] = [];
          cells[key].push(r.Title);
        }
      });
    return cells;
  }, [riskReg]);

  const pad = bp === "mobile" ? "16px" : "32px";

  if (loading) return (
    <div style={{ padding: 64, textAlign: "center", color: T.muted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Loading GRC Dashboard…</div>
    </div>
  );
  if (error) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>Failed to load: {error}</div>
      <button onClick={load} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>Retry</button>
    </div>
  );

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: "22px 28px", marginBottom: 24, color: T.headerText }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22 }}>🛡️</span>
              <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 17 : 21, fontWeight: 900 }}>GRC Risk Intelligence Dashboard</h1>
            </div>
            <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>Key Risk Indicators · Risk Register · Appetite Monitoring</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2 }}>Last refreshed</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={load} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>↻ Refresh</button>
              {canEdit && (
                <button onClick={() => setGlobalEdit(g => !g)} style={{ background: globalEdit ? "#00ffb3" : "rgba(255,255,255,0.1)", border: globalEdit ? "none" : "1px solid rgba(255,255,255,0.25)", color: globalEdit ? "#061210" : "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: globalEdit ? 800 : 400, cursor: "pointer" }}>
                  {globalEdit ? "✓ Edit Mode ON" : "✎ Global Edit"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total KRIs",           value: kriWithLatest.length, color: T.text,     accent: T.primary },
          { label: "Breaching — Red",      value: redCount,             color: "#dc2626",  accent: "#dc2626" },
          { label: "At Risk — Amber",      value: amberCount,           color: "#d97706",  accent: "#d97706" },
          { label: "Within Limits",        value: greenCount,           color: "#16a34a",  accent: "#16a34a" },
          { label: "Escalations Required", value: escalCount,           color: T.text,     accent: T.primary },
        ].map(({ label, value, color, accent }) => (
          <div key={label} style={{ background: T.surface, border: `2px solid ${accent}22`, borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 5, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── KRI Status Board ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: T.text }}>KRI Status Board</h2>
        {kriWithLatest.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 13 }}>No active KRIs found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {["KRI Name / Owner","Category","Current Value","RAG","Trend","Period","Escalate",...(canEdit?[""]:[]),...(globalEdit?[""]:[])].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kriWithLatest.map(kri => {
                  const r  = kri.latest;
                  const rc = RAG_COLOR[r?.RAGStatus];
                  const isSelected = selectedKRI === kri.KRIID;
                  return (
                    <tr key={kri.KRIID}
                      onClick={() => setSelectedKRI(isSelected ? null : kri.KRIID)}
                      style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", background: isSelected ? "#f0f7ff" : "transparent", transition: "background 0.12s" }}>
                      <td style={{ padding: "11px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{kri.Title}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{kri.KRIOwner?.Title || "—"}</div>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.muted }}>{kri.KRICategory || "—"}</td>
                      <td style={{ padding: "11px 12px" }}>
                        {r ? (
                          <span style={{ fontSize: 15, fontWeight: 900, color: rc?.text || T.text }}>
                            {r.ActualValue} <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>{kri.MeasurementUnit}</span>
                          </span>
                        ) : <span style={{ fontSize: 12, color: T.muted }}>No reading</span>}
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        {rc ? (
                          <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{r.RAGStatus}</span>
                        ) : <span style={{ color: T.muted }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 18, fontWeight: 900, color: trendColor(r?.Trend) }}>{r?.Trend ? trendIcon(r.Trend) : "—"}</td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.muted }}>{r?.Period || "—"}</td>
                      <td style={{ padding: "11px 12px" }}>
                        {r?.EscalationRequired
                          ? <span style={{ background: T.bg, color: T.primary, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10 }}>⚠ Yes</span>
                          : <span style={{ color: T.muted, fontSize: 12 }}>—</span>}
                      </td>
                      {canEdit && (
                        <td style={{ padding: "11px 12px" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setReadingModal(kri)}
                            style={{ background: T.primary, color: T.accent, border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                            + Reading
                          </button>
                        </td>
                      )}
                      {globalEdit && (
                        <td style={{ padding: "11px 12px" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setMasterModal(kri)}
                            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, whiteSpace: "nowrap" }}>
                            Edit KRI
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {kriWithLatest.length > 0 && <p style={{ margin: "10px 0 0", fontSize: 11, color: T.muted }}>Click any row to view trend chart</p>}
      </div>

      {/* ── KRI Trend Chart ── */}
      {selectedKRI && kriHistory.length > 0 && (() => {
        const kri = kriMaster.find(k => k.KRIID === selectedKRI);
        const chartData = kriHistory.map(r => ({
          period: fmtPeriod(r.Period || (r.ReadingDate || "").substring(0, 7)),
          value: r.ActualValue,
        }));
        return (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text }}>📈 Trend — {kri?.Title}</h3>
              <button onClick={() => setSelectedKRI(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", color: T.muted }}>✕ Close</button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {kri?.GreenThreshold != null && <ReferenceLine y={kri.GreenThreshold} stroke="#16a34a" strokeDasharray="4 2" label={{ value: "Green", position: "right", fontSize: 10, fill: "#16a34a" }} />}
                {kri?.AmberThreshold != null && <ReferenceLine y={kri.AmberThreshold} stroke="#eab308" strokeDasharray="4 2" label={{ value: "Amber", position: "right", fontSize: 10, fill: "#d97706" }} />}
                {kri?.RedThreshold   != null && <ReferenceLine y={kri.RedThreshold}   stroke="#dc2626" strokeDasharray="4 2" label={{ value: "Red",   position: "right", fontSize: 10, fill: "#dc2626" }} />}
                <Line type="monotone" dataKey="value" stroke={T.primary} strokeWidth={2.5} dot={{ r: 4, fill: T.primary }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* ── Risk Heatmap ── */}
      {riskReg.filter(r => r.RiskStatus !== "Closed").length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.text }}>🔥 Risk Heatmap</h3>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Active risks by Likelihood × Impact. Click a populated cell to see risk names.</p>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Grid */}
            <div style={{ flex: "1 1 300px" }}>
              {[5,4,3,2,1].map(l => (
                <div key={l} style={{ display: "flex", alignItems: "stretch", gap: 5, marginBottom: 5 }}>
                  <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: T.muted, display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>{l}</span>
                  {[1,2,3,4,5].map(i => {
                    const score = l * i;
                    const key   = `${l}-${i}`;
                    const risks = heatmapData[key] || [];
                    const count = risks.length;
                    const cellC = score >= 15 ? { bg: "#490300", text: "#ffb3b3", border: "#6b0400" }
                                : score >= 10 ? { bg: "#dc2626", text: "#fff",    border: "#b91c1c" }
                                : score >= 5  ? { bg: "#d97706", text: "#fff",    border: "#b45309" }
                                :               { bg: "#16a34a", text: "#fff",    border: "#15803d" };
                    const isSelected = heatmapCell?.l === l && heatmapCell?.i === i;
                    return (
                      <div key={i}
                        onClick={() => setHeatmapCell(count > 0 ? (isSelected ? null : { l, i, risks }) : null)}
                        style={{
                          flex: 1, minWidth: 44, minHeight: 52,
                          background: count > 0 ? cellC.bg : cellC.bg + "28",
                          border: `1px solid ${isSelected ? cellC.border : cellC.border + "55"}`,
                          borderRadius: 6,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: count > 0 ? "pointer" : "default",
                          position: "relative",
                          transition: "transform 0.12s, box-shadow 0.12s",
                          transform: isSelected ? "scale(1.06)" : "scale(1)",
                          boxShadow: isSelected ? `0 0 0 2px ${cellC.border}` : "none",
                        }}>
                        {count > 0 && (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 900, color: cellC.text, lineHeight: 1 }}>{count}</span>
                            <span style={{ fontSize: 9, color: cellC.text, opacity: 0.75 }}>risk{count > 1 ? "s" : ""}</span>
                          </>
                        )}
                        <span style={{ position: "absolute", bottom: 3, right: 5, fontSize: 9, fontWeight: 600, color: count > 0 ? cellC.text : T.muted, opacity: 0.45 }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: T.muted }}>{i}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Impact →</div>
              </div>
              <div style={{ marginTop: 2, paddingLeft: 23, fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>↑ Likelihood</div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, flexShrink: 0 }}>
              {[
                { label: "Critical  15 – 25", bg: "#490300", text: "#ffb3b3" },
                { label: "High      10 – 14",  bg: "#dc2626", text: "#fff"    },
                { label: "Medium    5 – 9",    bg: "#d97706", text: "#fff"    },
                { label: "Low       1 – 4",    bg: "#16a34a", text: "#fff"    },
              ].map(({ label, bg }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 16, height: 16, background: bg, borderRadius: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Cell detail panel */}
          {heatmapCell && (
            <div style={{ marginTop: 16, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                  Likelihood {heatmapCell.l} × Impact {heatmapCell.i} — Score {heatmapCell.l * heatmapCell.i}
                  &nbsp;
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>({heatmapCell.risks.length} risk{heatmapCell.risks.length > 1 ? "s" : ""})</span>
                </span>
                <button onClick={() => setHeatmapCell(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: T.muted, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {heatmapCell.risks.map((name, idx) => (
                  <div key={idx} style={{ fontSize: 13, color: T.text, padding: "7px 12px", background: T.surface, borderRadius: 7, border: `1px solid ${T.border}` }}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: Appetite + Top Risks ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 20 }}>

        {/* Risk Appetite */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: T.text }}>🎯 Risk Appetite by Category</h3>
          {appetite.length === 0
            ? <p style={{ color: T.muted, fontSize: 13 }}>No appetite data.</p>
            : appetite.map(a => {
                const pct = a.MaxTolerableScore > 0 ? Math.min(100, Math.round((a.CurrentExposureScore / a.MaxTolerableScore) * 100)) : 0;
                const sc  = a.AppetiteStatus === "Breached" ? "#dc2626" : a.AppetiteStatus === "Near Limit" ? "#d97706" : "#16a34a";
                return (
                  <div key={a.Title} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.RiskCategory}</span>
                        {a.AppetiteStatement && (
                          <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 2 }}>"{a.AppetiteStatement}"</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + "22", padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{a.AppetiteStatus}</span>
                        {canEdit && (
                          <button onClick={() => setAppetiteModal(a)}
                            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>
                            Edit
                          </button>
                        )}
                        {globalEdit && (
                          <button onClick={() => deleteAppetite(a.ID)}
                            style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626" }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: T.border, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: sc, borderRadius: 6, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>Exposure: {a.CurrentExposureScore} / Limit: {a.MaxTolerableScore} ({pct}%)</div>
                  </div>
                );
              })
          }
          {globalEdit && (
            <button onClick={() => setNewAppetiteModal(true)}
              style={{ marginTop: 8, background: T.bg, border: `2px dashed ${T.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.muted, width: "100%" }}>
              + Add Appetite Category
            </button>
          )}
        </div>

        {/* Top Risks */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>⚠️ {globalEdit ? "All Risks" : "Top Risks by Score"}</h3>
            {globalEdit && (
              <button onClick={() => setNewRiskModal(true)}
                style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Add Risk
              </button>
            )}
          </div>
          {riskReg.length === 0
            ? <p style={{ color: T.muted, fontSize: 13 }}>No risk data.</p>
            : [...riskReg]
                .filter(r => globalEdit || r.RiskStatus !== "Closed")
                .sort((a, b) => (b.LikelihoodScore * b.ImpactScore) - (a.LikelihoodScore * a.ImpactScore))
                .slice(0, globalEdit ? 500 : 6)
                .map(r => {
                  const score = (r.LikelihoodScore || 0) * (r.ImpactScore || 0);
                  const sc    = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
                  return (
                    <div key={r.RiskID || r.Title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", marginBottom: 8, background: T.bg, borderRadius: 8, border: r.RiskAppetiteBreached ? "1px solid rgba(220,38,38,0.35)" : `1px solid ${T.border}` }}>
                      <div style={{ background: sc, color: "#fff", borderRadius: 7, padding: "4px 9px", fontSize: 14, fontWeight: 900, minWidth: 34, textAlign: "center", flexShrink: 0 }}>{score}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.Title}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{r.RiskCategory} · {r.RiskOwner?.Title || "—"}{globalEdit ? ` · ${r.RiskStatus}` : ""}</div>
                      </div>
                      {r.RiskAppetiteBreached && (
                        <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, flexShrink: 0 }}>Breached</span>
                      )}
                      {canEdit && (
                        <button onClick={() => setRiskModal(r)}
                          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, flexShrink: 0 }}>
                          Edit
                        </button>
                      )}
                      {globalEdit && (
                        <button onClick={() => deleteRisk(r.ID)}
                          style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })
          }
          {appBreaches > 0 && !globalEdit && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#fee2e2", borderRadius: 8, fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
              ⚠ {appBreaches} risk{appBreaches > 1 ? "s" : ""} breaching risk appetite
            </div>
          )}
        </div>
      </div>

      {/* ── Audit Findings + Corrective Actions ── */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const isOverdue = (dateStr, status) =>
          status !== "Closed" && status !== "Completed" && dateStr && new Date(dateStr) < today;

        // ── Audit Findings stats ──
        const afOpen     = auditFindings.filter(f => f.Status !== "Closed").length;
        const afCritHigh = auditFindings.filter(f => f.Status !== "Closed" && (f.FindingSeverity === "Critical" || f.FindingSeverity === "High")).length;
        const afOverdue  = auditFindings.filter(f => isOverdue(f.DueDate, f.Status)).length;
        const afClosed   = auditFindings.filter(f => f.Status === "Closed").length;

        const sevColor = (sev) => sev === "Critical" ? "#490300" : sev === "High" ? "#ff5000" : sev === "Medium" ? "#f5a623" : "#5a7a6e";
        const statusBadge = (status, dueDate) => {
          const over = isOverdue(dueDate, status);
          if (over || status === "Overdue") return { bg: "#49030022", text: "#490300", label: "Overdue" };
          if (status === "Open")            return { bg: "#dc262622", text: "#dc2626", label: "Open" };
          if (status === "In Progress")     return { bg: "#d9770622", text: "#d97706", label: "In Progress" };
          if (status === "Closed")          return { bg: "#16a34a22", text: "#16a34a", label: "Closed" };
          return { bg: T.border, text: T.muted, label: status || "—" };
        };

        // ── Corrective Actions stats ──
        const caTotal     = correctiveActions.length;
        const caCompleted = correctiveActions.filter(a => a.Status === "Completed" || Number(a.CompletionPercentage) === 100).length;
        const caOverdue   = correctiveActions.filter(a => isOverdue(a.TargetDate, a.Status)).length;
        const caAvgPct    = caTotal > 0
          ? Math.round(correctiveActions.reduce((s, a) => s + (Number(a.CompletionPercentage) || 0), 0) / caTotal)
          : 0;

        const pctColor = (p) => p >= 70 ? "#00c48c" : p >= 30 ? "#f5a623" : "#dc2626";

        const caStatusBadge = (status, targetDate) => {
          const over = isOverdue(targetDate, status);
          if (over)                        return { bg: "#49030022", text: "#490300", label: "Overdue" };
          if (status === "Completed")      return { bg: "#16a34a22", text: "#16a34a", label: "Completed" };
          if (status === "In Progress")    return { bg: "#d9770622", text: "#d97706", label: "In Progress" };
          if (status === "Not Started")    return { bg: "#6b728022", text: "#374151", label: "Not Started" };
          return { bg: T.border, text: T.muted, label: status || "—" };
        };

        const miniStat = (value, label, color = T.text, accent = T.primary) => (
          <div key={label} style={{ background: T.bg, border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        );

        return (
          <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>

            {/* ── Audit Findings ── */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>🔍 Audit Findings Summary</h3>
                {globalEdit && (
                  <button onClick={() => { setSaveErr(""); setAfNewModal(true); }}
                    style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    + Add Finding
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {miniStat(afOpen,     "Open",           "#dc2626", "#dc2626")}
                {miniStat(afCritHigh, "Critical / High","#490300", "#490300")}
                {miniStat(afOverdue,  "Overdue",        "#ff5000", "#ff5000")}
                {miniStat(afClosed,   "Closed",         "#16a34a", "#16a34a")}
              </div>
              {auditFindings.length === 0
                ? <p style={{ color: T.muted, fontSize: 13 }}>No audit findings.</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[...auditFindings]
                      .sort((a, b) => {
                        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                        return (order[a.FindingSeverity] ?? 4) - (order[b.FindingSeverity] ?? 4);
                      })
                      .map((f, idx) => {
                        const badge = statusBadge(f.Status, f.DueDate);
                        const sc    = sevColor(f.FindingSeverity);
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.bg, borderRadius: 8, borderLeft: `4px solid ${sc}`, border: `1px solid ${T.border}`, borderLeftColor: sc }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.Title}</div>
                              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{f.BusinessUnit || "—"}{f.DueDate ? ` · Due ${new Date(f.DueDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}` : ""}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: badge.bg, color: badge.text, whiteSpace: "nowrap", flexShrink: 0 }}>{badge.label}</span>
                            {globalEdit && (
                              <>
                                <button onClick={() => { setSaveErr(""); setAfEditModal(f); }}
                                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, flexShrink: 0 }}>Edit</button>
                                <button onClick={() => deleteAuditFinding(f.ID)}
                                  style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>Delete</button>
                              </>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
              }
            </div>

            {/* ── Corrective Actions ── */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>✅ Corrective Actions Progress</h3>
                {globalEdit && (
                  <button onClick={() => { setSaveErr(""); setCaNewModal(true); }}
                    style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    + Add Action
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {miniStat(caTotal,     "Total",     T.text,    T.primary)}
                {miniStat(caCompleted, "Completed", "#16a34a", "#16a34a")}
                {miniStat(caOverdue,   "Overdue",   "#ff5000", "#ff5000")}
                <div style={{ background: T.bg, border: `1px solid ${pctColor(caAvgPct)}33`, borderLeft: `3px solid ${pctColor(caAvgPct)}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pctColor(caAvgPct), lineHeight: 1 }}>{caAvgPct}%</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontWeight: 600 }}>Overall Completion</div>
                </div>
              </div>
              {correctiveActions.length === 0
                ? <p style={{ color: T.muted, fontSize: 13 }}>No corrective actions.</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...correctiveActions]
                      .sort((a, b) => (Number(b.CompletionPercentage) || 0) - (Number(a.CompletionPercentage) || 0))
                      .map((a, idx) => {
                        const pct   = Math.min(100, Math.max(0, Number(a.CompletionPercentage) || 0));
                        const pc    = pctColor(pct);
                        const badge = caStatusBadge(a.Status, a.TargetDate);
                        return (
                          <div key={idx} style={{ padding: "10px 12px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.Title}</div>
                                {a.TargetDate && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Target: {new Date(a.TargetDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: badge.bg, color: badge.text, whiteSpace: "nowrap" }}>{badge.label}</span>
                                {globalEdit && (
                                  <>
                                    <button onClick={() => { setSaveErr(""); setCaEditModal(a); }}
                                      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>Edit</button>
                                    <button onClick={() => deleteCorrectiveAction(a.ID)}
                                      style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626" }}>Delete</button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, background: T.border, borderRadius: 4, height: 7, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: pc, borderRadius: 4, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: pc, minWidth: 34, textAlign: "right" }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
              }
            </div>

          </div>
        );
      })()}

      {/* ── MODALS ── */}
      {readingModal && (
        <GRCModal title={`Add KRI Reading — ${readingModal.Title}`} onClose={() => { setReadingModal(null); setSaveErr(""); }}>
          <GRCReadingForm kri={readingModal} onSave={saveReading} saving={saving} error={saveErr} onCancel={() => { setReadingModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {riskModal && (
        <GRCModal title={`Edit Risk — ${riskModal.Title}`} onClose={() => { setRiskModal(null); setSaveErr(""); }}>
          <GRCRiskForm risk={riskModal} onSave={saveRisk} saving={saving} error={saveErr} onCancel={() => { setRiskModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {appetiteModal && (
        <GRCModal title={`Edit Appetite — ${appetiteModal.RiskCategory}`} onClose={() => { setAppetiteModal(null); setSaveErr(""); }}>
          <GRCAppetiteForm item={appetiteModal} onSave={saveAppetite} saving={saving} error={saveErr} onCancel={() => { setAppetiteModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {masterModal && (
        <GRCModal title={`Edit KRI — ${masterModal.Title}`} onClose={() => { setMasterModal(null); setSaveErr(""); }}>
          <GRCMasterForm kri={masterModal} onSave={saveMasterEdit} saving={saving} error={saveErr} onCancel={() => { setMasterModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {newRiskModal && (
        <GRCModal title="Add New Risk" onClose={() => { setNewRiskModal(false); setSaveErr(""); }}>
          <GRCNewRiskForm onSave={saveNewRisk} saving={saving} error={saveErr} onCancel={() => { setNewRiskModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {newAppetiteModal && (
        <GRCModal title="Add Risk Appetite Category" onClose={() => { setNewAppetiteModal(false); setSaveErr(""); }}>
          <GRCNewAppetiteForm onSave={saveNewAppetite} saving={saving} error={saveErr} onCancel={() => { setNewAppetiteModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {afEditModal && (
        <GRCModal title={`Edit Finding — ${afEditModal.Title}`} onClose={() => { setAfEditModal(null); setSaveErr(""); }}>
          <GRCAuditFindingForm item={afEditModal} onSave={saveAuditFinding} saving={saving} error={saveErr} onCancel={() => { setAfEditModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {afNewModal && (
        <GRCModal title="Add Audit Finding" onClose={() => { setAfNewModal(false); setSaveErr(""); }}>
          <GRCAuditFindingForm onSave={saveAuditFinding} saving={saving} error={saveErr} onCancel={() => { setAfNewModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {caEditModal && (
        <GRCModal title={`Edit Action — ${caEditModal.Title}`} onClose={() => { setCaEditModal(null); setSaveErr(""); }}>
          <GRCCorrectiveActionForm item={caEditModal} onSave={saveCorrectiveAction} saving={saving} error={saveErr} onCancel={() => { setCaEditModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {caNewModal && (
        <GRCModal title="Add Corrective Action" onClose={() => { setCaNewModal(false); setSaveErr(""); }}>
          <GRCCorrectiveActionForm onSave={saveCorrectiveAction} saving={saving} error={saveErr} onCancel={() => { setCaNewModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
    </div>
  );
};

// ─── DEPARTMENT VIEW ──────────────────────────────────────────────
const DepartmentView = ({ projects, deptId, setRoute, userRole = ROLE_ADMIN, userDeptId = null }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const dept = departments.find(d => d.id === deptId);
  const deptProjects = projects.filter(p => p.deptId === deptId && !p.archived);
  const stats = getDeptStats(deptId, projects.filter(p => !p.archived));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [view, setView] = useState("table");

  const filtered = useMemo(() => deptProjects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || p.status === filterStatus;
    const matchRisk   = filterRisk   === "All" || p.riskLevel === filterRisk;
    const matchType   = filterType   === "All" || p.projectType === filterType;
    return matchSearch && matchStatus && matchRisk && matchType;
  }), [deptProjects, search, filterStatus, filterRisk, filterType]);

  if (!dept) return <div style={{ padding: 32 }}>Department not found</div>;

  if (deptId === "grc") {
    const isGRCDeptHead = userRole === ROLE_DEPT_HEAD && (userDeptId || "").split(",").map(s => s.trim().toLowerCase()).includes("grc");
    const canViewGRC = userRole === ROLE_ADMIN || userRole === ROLE_GRC || userRole === ROLE_GRC_ADMIN || userRole === ROLE_EXEC || isGRCDeptHead;
    if (!canViewGRC) return (
      <div style={{ padding: 64, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Access Restricted</div>
        <div style={{ fontSize: 13, color: T.muted }}>GRC Dashboard is only available to authorized GRC personnel.</div>
      </div>
    );
    return <GRCDashboard canEdit={userRole === ROLE_ADMIN || userRole === ROLE_GRC_ADMIN} />;
  }

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const kpiCols = bp === "mobile" ? "repeat(2, 1fr)" : bp === "tablet" ? "repeat(3, 1fr)" : "repeat(6, 1fr)";

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: bp === "mobile" ? 40 : 52, height: bp === "mobile" ? 40 : 52, background: T.primary, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: bp === "mobile" ? 20 : 26, flexShrink: 0 }}>{dept.icon}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 18 : 24, fontWeight: 900, color: T.text }}>{dept.name}</h1>
          <p style={{ margin: 0, color: T.muted, fontSize: 13 }}>Department Project Portfolio · {deptProjects.length} projects</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 14, marginBottom: 24 }}>
        <KPICard label="Total Projects" value={stats.total} icon="📋" />
        <KPICard label="On Track" value={stats.onTrack} color="#16a34a" icon="✅" />
        <KPICard label="Delayed" value={stats.delayed} color="#dc2626" icon="🔴" />
        <KPICard label="Completed" value={stats.completed} color="#3b82f6" icon="🏁" />
        <KPICard label="Portfolio Health" value={`${stats.health}%`} color={T.primary} icon="💪" />
        {(() => { const di = calcDeptIPI(deptId, projects); const c = ipiColor(di); return <KPICard label="Dept IPI" value={di} color={c.color} icon="📊" sub={c.label} />; })()}
      </div>

      {/* Filters */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..." style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1, minWidth: 180, background: T.inputBg, color: T.inputText }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          {["All", "On Track", "At Risk", "Delayed", "Completed", "Not Started"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          {["All", "Low", "Medium", "High", "Critical"].map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          <option value="All">All Types</option>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={() => { const dm = Object.fromEntries([...(departments || [])].map(d => [d.id, d.name])); exportExcel(filtered, `${dept?.name?.replace(/\s+/g,"-") || "dept"}-${TODAY}.xls`, dm); }}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>
          ↓ Export XLS
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          {["table", "card"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? T.btnPrimBg : "transparent",
              color: view === v ? T.btnPrimText : T.muted,
              border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer"
            }}>
              {v === "table" ? "≡ Table" : "⊞ Cards"}
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <div className="pmo-table-wrap" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["Code", "Project Name", "PM", "Type", "Phase", "Progress", "Status", "IPI", "Risk", "Budget Status", "Gate", "Last Update"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id, from: "department", deptId })}
                  className={p.status === "Delayed" ? "pmo-row-delayed" : ""}
                  style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.1s",
                    background: p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? "transparent" : T.bg) }}
                  onMouseEnter={e => e.currentTarget.style.background = themeStore.dark ? '#132820' : '#f0f7f4'}
                  onMouseLeave={e => e.currentTarget.style.background = p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? 'transparent' : T.bg)}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.primary, whiteSpace: "nowrap" }}>{p.code}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: themeStore.T.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.sponsor}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, whiteSpace: "nowrap" }}>{p.phase}</td>
                  <td style={{ padding: "12px 14px", minWidth: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={5} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.text, minWidth: 30 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    {(() => { const ipiVal = calcProjectIPI(p); const sc = ipiColor(ipiVal); return <span style={{ background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{ipiVal}</span>; })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{p.budgetStatus}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.lastUpdate || "—"}</div>
                    {(() => { const d = daysSince(p.lastUpdate); if (!d || d < 14) return null; return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: d >= 30 ? "#fee2e2" : "#fef9c3", color: d >= 30 ? "#991b1b" : "#854d0e" }}>{d}d ago</span>; })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: T.muted }}>No projects match the filters</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id, from: "department", deptId })}
              style={{ background: T.surface, borderRadius: 14, padding: 20, cursor: "pointer", transition: "all 0.2s",
                border: p.status === "Delayed" ? "1px solid rgba(220,38,38,0.55)" : `1px solid ${T.border}`,
                boxShadow: p.status === "Delayed" ? "0 0 14px rgba(220,38,38,0.22)" : "none" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = p.status === "Delayed" ? "#dc2626" : T.accent; e.currentTarget.style.boxShadow = p.status === "Delayed" ? "0 0 22px rgba(220,38,38,0.38)" : "0 4px 20px rgba(0,57,50,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = p.status === "Delayed" ? "rgba(220,38,38,0.55)" : T.border; e.currentTarget.style.boxShadow = p.status === "Delayed" ? "0 0 14px rgba(220,38,38,0.22)" : "none"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, background: "#e8f5f0", padding: "3px 8px", borderRadius: 6 }}>{p.code}</span>
                <Badge status={p.status} />
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>{p.name}</h3>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: T.muted }}>PM: {p.pm} · {p.phase}</p>
              <Progress value={p.progress} height={6} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <RiskBadge level={p.riskLevel} />
                <span style={{ fontSize: 11, color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600, padding: "2px 8px", background: p.budgetStatus === "Over Budget" ? "#fee2e2" : "#dcfce7", borderRadius: 10 }}>{p.budgetStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── UPDATE PANEL ────────────────────────────────────────────────
const UpdatePanel = ({ project, onClose, onSubmit }) => {
  const T = useT();
  const [tab, setTab]                 = useState("Status");
  const [status, setStatus]           = useState(project.status);
  const [phase, setPhase]             = useState(project.phase || "Execution");
  const [gate, setGate]               = useState(project.gate || "");
  const [priority, setPriority]       = useState(project.priority || "Medium");
  const [progress, setProgress]       = useState(project.progress ?? 0);
  const [plannedProgress, setPlanned] = useState(project.plannedProgress ?? 0);
  const [startDate, setStartDate]     = useState(project.startDate || "");
  const [plannedEnd, setPlannedEnd]   = useState(project.plannedEnd || "");
  const [health, setHealthState]      = useState({ ...(project.health || {}) });
  const [budget, setBudget]           = useState(project.budget ?? 0);
  const [forecast, setForecast]       = useState(project.forecast ?? 0);
  const [actualCost, setActualCost]   = useState(project.actualCost ?? 0);
  const [spi, setSpi]                 = useState(project.spi ?? 1.0);
  const [cpi, setCpi]                 = useState(project.cpi ?? 1.0);
  const [daysRemaining, setDaysRemaining] = useState(project.daysRemaining ?? 0);
  const [daysDelayed, setDaysDelayed] = useState(project.daysDelayed ?? 0);
  const [milestones, setMilestones]   = useState(project.milestones?.map(m => ({ ...m })) || []);
  const [risks, setRisks]             = useState(project.risks?.map(r => ({ ...r })) || []);
  const [benefits, setBenefits]       = useState(project.benefits?.map(b => ({ ...b })) || []);
  const [note, setNote]               = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState("");

  const setH = (k, v) => setHealthState(prev => ({ ...prev, [k]: v }));
  const ragClr     = { Green: { bg: "#dcfce7", text: "#15803d", b: "#16a34a" }, Amber: { bg: "#fef9c3", text: "#854d0e", b: "#eab308" }, Red: { bg: "#fee2e2", text: "#991b1b", b: "#dc2626" } };
  const healthDims = [["scope","Scope"],["schedule","Schedule"],["budget","Budget"],["risk","Risk"],["quality","Quality"],["resource","Resources"],["benefits","Benefits"],["governance","Governance"]];
  const statusOpts = ["On Track","At Risk","Delayed","Completed","Not Started"];
  const TABS = [
    { key: "Status",     icon: "📊" },
    { key: "Health",     icon: "🩺" },
    { key: "Financials", icon: "💰" },
    { key: "Milestones", icon: "🎯" },
    { key: "Risks",      icon: "⚠️" },
    { key: "Benefits",   icon: "📈" },
    { key: "Note",       icon: "📝" },
  ];

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await onSubmit(project.id, {
        status, phase, gate, priority, progress, plannedProgress, startDate, plannedEnd,
        health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
        milestones, risks, benefits, note,
      });
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (err) {
      setSaveError(err.message || "Save failed");
      setSaving(false);
    }
  };

  const s = { width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", boxSizing: "border-box" };
  const ss = { ...s, background: T.selectBg };
  const SL = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.07em", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>{children}</div>;
  const FL = ({ children }) => <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5 }}>{children}</div>;
  const numInput = (val, setter, step = 1) => <input type="number" value={val} step={step} onChange={e => setter(Number(e.target.value))} style={s} />;

  const renderTab = () => {
    if (tab === "Status") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <SL>PROJECT STATUS</SL>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {statusOpts.map(o => {
              const sc = statusColor[o];
              return (
                <button key={o} onClick={() => setStatus(o)}
                  style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: status === o ? sc.bg : T.bg, color: status === o ? sc.text : T.muted,
                    border: status === o ? `2px solid ${sc.dot}` : `1px solid ${T.border}` }}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <SL>CLASSIFICATION</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><FL>Phase</FL><select value={phase} onChange={e => setPhase(e.target.value)} style={ss}>{["Initiation","Planning","Execution","Monitoring","Closure"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div><FL>Current Gate</FL><select value={gate} onChange={e => setGate(e.target.value)} style={ss}>{["Gate 1","Gate 2","Gate 3","Gate 4","Gate 5"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div><FL>Priority</FL><select value={priority} onChange={e => setPriority(e.target.value)} style={ss}>{["Low","Medium","High","Critical"].map(o => <option key={o}>{o}</option>)}</select></div>
          </div>
        </div>
        <div>
          <SL>PROGRESS</SL>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 6 }}>
              <span>Actual Progress</span><span style={{ color: T.primary, fontWeight: 900 }}>{progress}%</span>
            </div>
            <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))} style={{ width: "100%", accentColor: T.primary, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 3 }}><span>0%</span><span>50%</span><span>100%</span></div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 6 }}>
              <span>Planned Progress</span><span style={{ color: T.muted, fontWeight: 700 }}>{plannedProgress}%</span>
            </div>
            <input type="range" min={0} max={100} value={plannedProgress} onChange={e => setPlanned(Number(e.target.value))} style={{ width: "100%", accentColor: T.muted, cursor: "pointer" }} />
          </div>
        </div>
        <div>
          <SL>DATES</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>Start Date</FL><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={s} /></div>
            <div><FL>Planned End Date</FL><input type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} style={s} /></div>
          </div>
        </div>
      </div>
    );

    if (tab === "Health") return (
      <div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Set Green / Amber / Red for each dimension. Affects the IPI score.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {healthDims.map(([k, l]) => {
            const v = health[k];
            return (
              <div key={k}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 5, fontWeight: 600 }}>{l}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Green","Amber","Red"].map(o => (
                    <button key={o} onClick={() => setH(k, o)}
                      style={{ flex: 1, padding: "7px 3px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: v === o ? ragClr[o].bg : T.bg,
                        border: v === o ? `2px solid ${ragClr[o].b}` : `1px solid ${T.border}`,
                        color: v === o ? ragClr[o].text : T.muted }}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    if (tab === "Financials") return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <SL>BUDGET (SAR)</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>Budget</FL>{numInput(budget, setBudget)}</div>
            <div><FL>Forecast</FL>{numInput(forecast, setForecast)}</div>
            <div><FL>Actual Cost</FL>{numInput(actualCost, setActualCost)}</div>
          </div>
        </div>
        <div>
          <SL>PERFORMANCE INDICES</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>SPI</FL>{numInput(spi, setSpi, 0.01)}</div>
            <div><FL>CPI</FL>{numInput(cpi, setCpi, 0.01)}</div>
          </div>
        </div>
        <div>
          <SL>SCHEDULE VARIANCE</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>Days Remaining</FL>{numInput(daysRemaining, setDaysRemaining)}</div>
            <div><FL>Days Delayed</FL>{numInput(daysDelayed, setDaysDelayed)}</div>
          </div>
        </div>
      </div>
    );

    if (tab === "Milestones") return <MilestoneListEditor items={milestones} onChange={setMilestones} />;
    if (tab === "Risks")      return <RiskListEditor      items={risks}      onChange={setRisks} />;
    if (tab === "Benefits")   return <BenefitListEditor   items={benefits}   onChange={setBenefits} />;

    if (tab === "Note") return (
      <div>
        <SL>UPDATE NOTE</SL>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={6}
          placeholder="What's the current status? Key decisions, blockers, next steps..."
          style={{ ...s, resize: "vertical" }} />
        {project.updates?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10 }}>Recent Updates</div>
            {[...project.updates].reverse().slice(0, 5).map(u => (
              <div key={u.id} style={{ background: T.bg, borderRadius: 8, padding: 12, marginBottom: 8, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{u.date} — {u.owner}</div>
                <div style={{ fontSize: 13, color: T.text }}>{u.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, animation: "pmo-fade-in 0.2s ease" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(640px, 100vw)", background: T.surface, zIndex: 201, boxShadow: "-8px 0 40px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", animation: "slideInRight 0.25s ease" }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Update Project</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{project.name} · {project.code}</div>
          </div>
          <button onClick={onClose} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: T.muted, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${T.border}`, flexShrink: 0, padding: "0 8px" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: "transparent", border: "none",
                borderBottom: tab === t.key ? `2px solid ${T.primary}` : "2px solid transparent",
                color: tab === t.key ? T.primary : T.muted }}>
              {t.icon} {t.key}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {renderTab()}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {saveError && (
            <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
              ⚠ {saveError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", color: T.text, fontWeight: 600 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving || saved}
              style={{ flex: 2, background: saved ? "#16a34a" : T.btnPrimBg, color: saved ? "#fff" : T.btnPrimText, border: "none", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800, cursor: saving || saved ? "default" : "pointer", transition: "background 0.3s" }}>
              {saved ? "✓ Saved!" : saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── PROJECT DASHBOARD ────────────────────────────────────────────
const PROJECT_TABS_ADMIN = ["Exec Summary", "Overview", "Health", "Milestones", "Budget", "Risks & Issues", "Approvals", "Benefits", "Documents", "Updates"];
const PROJECT_TABS_PM    = ["Overview", "Health", "Milestones", "Risks & Issues", "Benefits", "Documents"];
const PROJECT_TABS_EXEC  = ["Exec Summary"];

const ProjectView = ({ projects, projectId, setRoute, submitUpdate, userRole = ROLE_ADMIN }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const project = projects.find(p => p.id === projectId);

  const TABS = userRole === ROLE_PM ? PROJECT_TABS_PM
             : (userRole === ROLE_EXEC || userRole === ROLE_DEPT_HEAD) ? PROJECT_TABS_EXEC
             : PROJECT_TABS_ADMIN;
  const [tab, setTab] = useState(() => userRole === ROLE_PM ? "Overview" : "Exec Summary");

  const activeTab = TABS.includes(tab) ? tab : TABS[0];
  const [showUpdate, setShowUpdate] = useState(false);

  if (!project) return <div style={{ padding: 32 }}>Project not found</div>;

  const budgetUtil = project.budget > 0 ? Math.round((project.actualCost / project.budget) * 100) : 0;
  const remaining = project.budget - project.actualCost;

  // ── IPI ──────────────────────────────────────────────────────────
  const ipi = calcProjectIPI(project);
  const ipiC = ipiColor(ipi);
  const reqDocs = project.documents?.filter(d => d.required === true) ?? [];
  const docsReady = reqDocs.filter(d =>
    ["Approved","Final","Received","Current","Submitted"].includes(d.status)
  ).length;
  const docsCompliance = reqDocs.length > 0 ? Math.round((docsReady / reqDocs.length) * 100) : 0;

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const infoCols = bp === "mobile" ? "repeat(2, 1fr)" : bp === "tablet" ? "repeat(3, 1fr)" : "repeat(6, 1fr)";
  const overviewCols = bp === "mobile" || bp === "tablet" ? "1fr" : "2fr 1fr";

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      {/* Project Header */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: bp === "mobile" ? "16px 18px" : "24px 28px", marginBottom: 24, color: T.headerText }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ background: T.accent, color: T.accentText, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{project.code}</span>
              {(() => { const sla = getGateSLA(project); return <span style={{ background: sla && sla.days > 30 ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>{project.gate}{sla && <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.9 }}>· Day {sla.days}</span>}</span>; })()}
              <span style={{ background: "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{project.priority}</span>
              <TypeBadge type={project.projectType || "Project"} />
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900 }}>{project.name}</h1>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{project.objective}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
              <Badge status={project.status} />
              {userRole !== ROLE_EXEC && userRole !== ROLE_DEPT_HEAD && (
                <button onClick={() => setShowUpdate(true)}
                  style={{ background: T.accent, color: T.accentText, border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  ✏️ Update
                </button>
              )}
              {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && (
                <button onClick={() => setRoute({ view: "form", mode: "edit", projectId: project.id, from: "project" })}
                  style={{ background: T.bg, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Edit Fields
                </button>
              )}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: T.accent }}>{project.progress}%</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Overall Progress</div>
            {(() => { const d = daysSince(project.lastUpdate); if (!d || d < 14) return null; return <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: d >= 30 ? "rgba(220,38,38,0.25)" : "rgba(234,179,8,0.25)", color: d >= 30 ? "#fca5a5" : "#fde68a", display: "inline-block" }}>Updated {d}d ago</div>; })()}
          </div>
        </div>
        {/* IPI banner row */}
        <div style={{ display: "flex", gap: 10, marginTop: 16, padding: "14px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ background: ipiC.bg, borderRadius: 10, padding: "8px 18px", textAlign: "center", minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: ipiC.color, lineHeight: 1 }}>{ipi}</div>
              <div style={{ fontSize: 10, color: ipiC.color, fontWeight: 700 }}>IPI Score</div>
            </div>
            <div style={{ fontSize: 11, color: T.headerText, lineHeight: 1.8, opacity: 0.85 }}>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>SPI</span> {project.spi?.toFixed(2)} × 50% = <strong style={{ color: T.accent }}>{((Math.min(project.spi ?? 1, 1.2)) * 0.5 * 100).toFixed(0)}pts</strong></div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>CPI</span> {project.cpi?.toFixed(2)} × 25% = <strong style={{ color: T.accent }}>{((Math.min(project.cpi ?? 1, 1.2)) * 0.25 * 100).toFixed(0)}pts</strong></div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>Docs</span> {docsCompliance}% × 25% = <strong style={{ color: T.accent }}>{(docsCompliance * 0.25).toFixed(0)}pts</strong></div>
            </div>
          </div>
          <div style={{ background: ipiC.bg, color: ipiC.color, padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{ipiC.label}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: infoCols, gap: 16, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "PM", value: project.pm },
            { label: "Sponsor", value: project.sponsor },
            { label: "Department", value: departments.find(d => d.id === project.deptId)?.name },
            { label: "Phase", value: project.phase },
            { label: "Start Date", value: project.startDate },
            { label: "Planned End", value: project.plannedEnd },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <Tab tabs={TABS} active={activeTab} onSelect={setTab} />

      {/* ── GATE TRACKER — always visible ── */}
      <GateTracker gates={project.gates} currentGate={project.gate} startDate={project.startDate} />

      {/* ── Submit Update Panel ─────────────────────────────────── */}
      {showUpdate && <UpdatePanel project={project} onClose={() => setShowUpdate(false)} onSubmit={submitUpdate} />}

      {/* EXEC SUMMARY TAB */}
      {activeTab === "Exec Summary" && (() => {
        const nextMilestone = [...(project.milestones || [])].filter(m => m.status !== "Completed").sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
        const msOverdue = nextMilestone && nextMilestone.date && nextMilestone.date < TODAY;
        const riskOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        const topRisk = [...(project.risks || [])].filter(r => r.status === "Open").sort((a, b) => (riskOrder[b.level] || 0) - (riskOrder[a.level] || 0))[0];
        const rc = topRisk ? (riskColor[topRisk.level] || riskColor["Medium"]) : null;
        const latestUpdate = [...(project.updates || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
        const gridCols = bp === "mobile" ? "1fr" : "1fr 1fr 1fr";
        const twoCol = bp === "mobile" ? "1fr" : "1fr 1fr";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Status strip */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Status", node: <Badge status={project.status} /> },
                  { label: "Progress", node: <span style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{project.progress}%</span> },
                  { label: "IPI", node: <span style={{ fontSize: 20, fontWeight: 900, color: ipiC.color }}>{ipi} <span style={{ fontSize: 11, fontWeight: 600 }}>{ipiC.label}</span></span> },
                  { label: "Planned End", node: <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{project.plannedEnd || "—"}</span> },
                  { label: "Current Gate", node: <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{project.gate}</span> },
                  { label: "PM", node: <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{project.pm}</span> },
                ].map((item, i) => (
                  <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: i > 0 ? 20 : 0, borderLeft: i > 0 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                    {item.node}
                  </div>
                ))}
              </div>
            </div>

            {/* Budget | Next Milestone | Top Risk */}
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 16 }}>
              {/* Budget Health */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Budget Health</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: remaining >= 0 ? "#15803d" : "#dc2626" }}>{fmtSAR(project.actualCost)}</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>of {fmtSAR(project.budget)} approved</div>
                <Progress value={budgetUtil} color={budgetUtil > 90 ? "#dc2626" : budgetUtil > 75 ? "#eab308" : T.accent} height={8} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{budgetUtil}% utilized</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: remaining >= 0 ? "#15803d" : "#dc2626" }}>{project.budgetStatus}</span>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>CPI: <span style={{ fontWeight: 700, color: project.cpi >= 1 ? "#15803d" : "#dc2626" }}>{project.cpi.toFixed(2)}</span> &nbsp;·&nbsp; SPI: <span style={{ fontWeight: 700, color: project.spi >= 0.9 ? "#15803d" : "#dc2626" }}>{project.spi.toFixed(2)}</span></div>
              </div>

              {/* Next Milestone */}
              <div style={{ background: T.surface, border: `1px solid ${msOverdue ? "rgba(220,38,38,0.4)" : T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Next Milestone</div>
                {nextMilestone ? (
                  <>
                    {msOverdue && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, display: "inline-block", marginBottom: 8 }}>OVERDUE</span>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{nextMilestone.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Due: {nextMilestone.date}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>Owner: {nextMilestone.owner}</div>
                    <div style={{ marginTop: 10 }}><span style={{ background: "#fef9c3", color: "#854d0e", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8 }}>{nextMilestone.status}</span></div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>All milestones complete ✓</div>
                )}
              </div>

              {/* Top Risk */}
              <div style={{ background: T.surface, border: `1px solid ${topRisk && (topRisk.level === "Critical" || topRisk.level === "High") ? "rgba(220,38,38,0.3)" : T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Top Risk</div>
                {topRisk ? (
                  <>
                    <span style={{ background: rc.bg, color: rc.text, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, display: "inline-block", marginBottom: 8 }}>{topRisk.level}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>{topRisk.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Owner: {topRisk.owner}</div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>Mitigation: {topRisk.mitigation}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>No open risks ✓</div>
                )}
              </div>
            </div>

          </div>
        );
      })()}

      {/* OVERVIEW TAB */}
      {activeTab === "Overview" && (
        <div style={{ display: "grid", gridTemplateColumns: overviewCols, gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Project Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["Strategic Objective", project.strategic],
                  ["Classification", project.classification],
                  ["Current Phase", project.phase],
                  ["Gate Status", project.gate],
                  ["Risk Level", project.riskLevel],
                  ["Budget Status", project.budgetStatus],
                  ["Schedule Variance", project.scheduleVariance],
                  ["Days Remaining", project.daysRemaining === 0 ? "Completed" : project.daysRemaining],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: "10px 14px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Business Case</h3>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{project.businessCase}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Progress Tracker</h3>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Overall Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{project.progress}%</span>
                </div>
                <Progress value={project.progress} color={T.accent} height={10} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Planned Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{project.plannedProgress}%</span>
                </div>
                <Progress value={project.plannedProgress} color="#94a3b8" height={10} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                <div style={{ textAlign: "center", padding: 12, background: T.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.primary }}>{project.spi.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>SPI</div>
                </div>
                <div style={{ textAlign: "center", padding: 12, background: T.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.primary }}>{project.cpi.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>CPI</div>
                </div>
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Budget Snapshot</h3>
              {[
                { label: "Approved Budget", value: fmtSAR(project.budget), color: T.text },
                { label: "Actual Cost", value: fmtSAR(project.actualCost), color: T.text },
                { label: "Remaining", value: fmtSAR(remaining), color: remaining >= 0 ? "#16a34a" : "#dc2626" },
                { label: "Utilisation", value: `${budgetUtil}%`, color: budgetUtil > 90 ? "#dc2626" : T.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEALTH TAB */}
      {activeTab === "Health" && (() => {
        const healthItems = Object.entries(project.health || {});
        return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {healthItems.map(([area, status]) => (
              <div key={area} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, textTransform: "capitalize" }}>{area}</div>
                <HealthBadge status={status} />
                <div style={{ marginTop: 12, width: 50, height: 50, borderRadius: "50%", background: healthColor[status]?.bg || T.bg, border: `3px solid ${healthColor[status]?.text || T.muted}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "12px auto 0", fontSize: 20 }}>
                  {status === "Green" ? "✅" : status === "Amber" ? "⚠️" : "🔴"}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Performance Indicators</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { label: "Schedule Performance Index (SPI)", value: project.spi, threshold: 0.9, format: (v) => v.toFixed(2) },
                { label: "Cost Performance Index (CPI)", value: project.cpi, threshold: 0.9, format: (v) => v.toFixed(2) },
                { label: "Budget Utilisation", value: budgetUtil, threshold: 90, format: (v) => `${v}%` },
              ].map(({ label, value, threshold, format }) => (
                <div key={label} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: value >= threshold ? T.primary : "#dc2626" }}>{format(value)}</div>
                  <div style={{ fontSize: 11, color: value >= threshold ? "#16a34a" : "#dc2626", marginTop: 4 }}>
                    {value >= threshold ? "✓ Healthy" : "⚠ Below threshold"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      })()}

      {/* MILESTONES TAB */}
      {activeTab === "Milestones" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Milestone Timeline</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {project.milestones.map((m, i) => {
              const statusStyles = {
                "Completed": { bg: "#dcfce7", text: "#15803d", icon: "✓", lineColor: "#16a34a" },
                "In Progress": { bg: "#fef9c3", text: "#854d0e", icon: "◎", lineColor: "#eab308" },
                "Upcoming": { bg: "#f3f4f6", text: "#6b7280", icon: "○", lineColor: "#d1d5db" },
                "Delayed": { bg: "#fee2e2", text: "#991b1b", icon: "!", lineColor: "#dc2626" },
              };
              const isOverdue = m.status !== "Completed" && m.date && m.date < TODAY;
              const s = isOverdue
                ? { bg: "#fee2e2", text: "#991b1b", icon: "!", lineColor: "#dc2626" }
                : (statusStyles[m.status] || statusStyles["Upcoming"]);
              return (
                <div key={m.id} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.bg, border: `2px solid ${s.lineColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: s.text, fontWeight: 700, zIndex: 1 }}>{s.icon}</div>
                    {i < project.milestones.length - 1 && <div style={{ width: 2, flex: 1, background: s.lineColor, opacity: 0.3, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 20 }}>
                    <div style={{ background: T.bg, borderRadius: 12, padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.name}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {isOverdue && <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em" }}>OVERDUE</span>}
                          <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{m.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>Target: {m.date} · Owner: {m.owner}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BUDGET TAB */}
      {activeTab === "Budget" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Financial Summary</h3>
            {[
              { label: "Approved Budget", value: fmtSAR(project.budget), sub: "Total approved allocation" },
              { label: "Forecast Budget", value: fmtSAR(project.forecast), sub: "Estimated total at completion", color: project.forecast > project.budget ? "#dc2626" : "#16a34a" },
              { label: "Actual Cost to Date", value: fmtSAR(project.actualCost), sub: `${budgetUtil}% of budget consumed` },
              { label: "Remaining Budget", value: fmtSAR(remaining), sub: "Available to spend", color: remaining < 0 ? "#dc2626" : "#16a34a" },
              { label: "Cost Variance", value: fmtSAR(project.budget - project.actualCost), sub: "Positive = under budget", color: project.budget >= project.actualCost ? "#16a34a" : "#dc2626" },
              { label: "Cost Performance Index", value: project.cpi.toFixed(2), sub: "> 1.0 = under budget", color: project.cpi >= 1 ? "#16a34a" : "#dc2626" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: color || T.text }}>{value}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Budget Utilisation</h3>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>Actual Spend</span>
                  <span style={{ fontWeight: 700 }}>{budgetUtil}%</span>
                </div>
                <Progress value={budgetUtil} color={budgetUtil > 90 ? "#dc2626" : budgetUtil > 75 ? "#eab308" : T.accent} height={14} />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[{ name: "Budget", Approved: project.budget / 1000000, Forecast: project.forecast / 1000000, Actual: project.actualCost / 1000000 }]} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="M" />
                  <Tooltip formatter={(v) => `SAR ${v.toFixed(2)}M`} {...ttStyle()} />
                  <Bar dataKey="Approved" fill={T.secondary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Forecast" fill={T.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill={T.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* RISKS & ISSUES TAB */}
      {activeTab === "Risks & Issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {project.risks.length > 0 && <RiskMatrix risks={project.risks} />}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Risk Register</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "Critical").length} Critical</span>
                <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "High").length} High</span>
              </div>
            </div>
            {project.risks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: T.muted }}>No risks recorded</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Risk", "Probability", "Impact", "Level", "Owner", "Status", "Due Date"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{project.risks.map(r => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: T.text }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Mitigation: {r.mitigation}</div>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.probability}</td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.impact}</td>
                    <td style={{ padding: "12px" }}><RiskBadge level={r.level} /></td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.owner}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.status === "Open" ? "#dc2626" : r.status === "Mitigated" ? "#16a34a" : "#eab308" }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: T.muted }}>{r.dueDate}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Issue Log</h3>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.issues.filter(i => i.escalated).length} Escalated</span>
            </div>
            {project.issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#16a34a", fontSize: 13 }}>✓ No open issues</div>
            ) : (
              project.issues.map(issue => (
                <div key={issue.id} style={{ padding: "14px 16px", background: T.bg, borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${issue.escalated ? "#dc2626" : issue.severity === "High" ? "#eab308" : T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {issue.escalated && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ESCALATED</span>}
                      <RiskBadge level={issue.severity} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>Owner: {issue.owner} · Raised: {issue.raised} · Status: <span style={{ fontWeight: 600 }}>{issue.status}</span></div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* APPROVALS TAB */}
      {activeTab === "Approvals" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Approved", count: project.approvals.filter(a => a.status === "Approved").length, color: "#16a34a" },
              { label: "Pending", count: project.approvals.filter(a => a.status === "Pending").length, color: "#eab308" },
              { label: "Returned", count: project.approvals.filter(a => a.status === "Returned").length, color: "#dc2626" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ padding: "12px 20px", background: T.bg, borderRadius: 10, textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {project.approvals.map(a => {
              const c = { "Approved": { color: "#16a34a", bg: "#dcfce7" }, "Pending": { color: "#eab308", bg: "#fef9c3" }, "Returned": { color: "#dc2626", bg: "#fee2e2" }, "Rejected": { color: "#991b1b", bg: "#fee2e2" } };
              const style = c[a.status] || c["Pending"];
              return (
                <div key={a.id} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderLeft: `4px solid ${style.color}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{a.gate} · Approval Owner: {a.owner}</div>
                    {a.comments && <div style={{ fontSize: 12, color: T.muted, marginTop: 4, fontStyle: "italic" }}>"{a.comments}"</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: style.bg, color: style.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>{a.status}</span>
                    {a.date && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{a.date}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BENEFITS TAB */}
      {activeTab === "Benefits" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Benefits Realization Tracker</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {project.benefits.map(b => (
              <div key={b.id} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginRight: 8 }}>{b.category}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.kpi}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.muted }}>Owner: {b.owner}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  {[["Baseline", b.baseline], ["Target", b.target], ["Current", b.current]].map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center", padding: "10px", background: T.surface, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}><Progress value={b.realization} color={T.accent} height={8} /></div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.primary, minWidth: 40 }}>{b.realization}%</span>
                  <span style={{ fontSize: 11, color: T.muted }}>realized</span>
                  <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{b.contribution} impact</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === "Documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Compliance Summary */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Document Compliance</h3>
              <span style={{ fontSize: 12, color: T.muted }}>Required docs affect IPI score</span>
            </div>
            <DocComplianceBar project={project} />
          </div>

          {/* Required Documents */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>⭐</span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Required Documents</h3>
              <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Affects IPI</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>
                {["Document", "Type", "Version", "Status", "Last Updated"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{project.documents.filter(d => d.required).map(d => {
                const docStatus = {
                  "Approved":    { bg: "#dcfce7", text: "#15803d" },
                  "Final":       { bg: "#dcfce7", text: "#15803d" },
                  "Received":    { bg: "#dcfce7", text: "#15803d" },
                  "Current":     { bg: "#dbeafe", text: "#1e40af" },
                  "Submitted":   { bg: "#dbeafe", text: "#1e40af" },
                  "Draft":       { bg: "#fef9c3", text: "#854d0e" },
                  "Under Review":{ bg: "#fef9c3", text: "#854d0e" },
                  "Pending":     { bg: "#fee2e2", text: "#991b1b" },
                };
                const ds = docStatus[d.status] || { bg: T.bg, text: T.muted };
                const isReady = ["Approved","Final","Received","Current","Submitted"].includes(d.status);
                return (
                  <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{isReady ? "✅" : "⚠️"}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.type}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.text }}>{d.version || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: ds.bg, color: ds.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{d.status || "Not Submitted"}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.lastUpdated || "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>

          {/* Optional / Additional Documents */}
          {project.documents.filter(d => !d.required).length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>📎</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Additional Documents</h3>
                <span style={{ fontSize: 11, background: T.bg, color: T.muted, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>Does not affect IPI</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Document", "Type", "Version", "Status", "Last Updated"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{project.documents.filter(d => !d.required).map(d => {
                  const ds = { "Approved": { bg: "#dcfce7", text: "#15803d" }, "Current": { bg: "#dbeafe", text: "#1e40af" }, "Draft": { bg: "#fef9c3", text: "#854d0e" } }[d.status] || { bg: T.bg, text: T.muted };
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📄</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.type}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.text }}>{d.version || "—"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: ds.bg, color: ds.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{d.status}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.lastUpdated || "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* UPDATES TAB */}
      {activeTab === "Updates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Project Updates</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>Structured updates include: Progress · Next Plan · Blockers · Decisions</p>
            </div>
          </div>
          {project.updates.map(u => {
            const isStructured = u.weekProgress || u.nextWeekPlan || u.blockers || u.decisionsRequired;
            return (
              <div key={u.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Update header */}
                <div style={{ padding: "12px 20px", background: T.bg, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: T.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {(u.owner || "?").charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{u.owner}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>{isStructured ? "Structured Status Report" : "General Update"}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: T.muted }}>{u.date}</span>
                </div>
                {isStructured ? (
                  <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr" }}>
                    {[
                      { key: "weekProgress",      label: "This Week Progress",  color: "#15803d", borderColor: "#86efac" },
                      { key: "nextWeekPlan",       label: "Next Week Plan",      color: "#1e40af", borderColor: "#93c5fd" },
                      { key: "blockers",           label: "Blockers",            color: "#991b1b", borderColor: "#fca5a5" },
                      { key: "decisionsRequired",  label: "Decisions Required",  color: "#854d0e", borderColor: "#fde68a" },
                    ].map((s, idx) => (
                      <div key={s.key} style={{ padding: "14px 20px", borderRight: (idx % 2 === 0 && bp !== "mobile") ? `1px solid ${T.border}` : "none", borderBottom: idx < 2 ? `1px solid ${T.border}` : "none" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
                        {u[s.key] ? (
                          <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6 }}>{u[s.key]}</p>
                        ) : (
                          <p style={{ margin: 0, fontSize: 12, color: T.muted, fontStyle: "italic" }}>Not reported</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "14px 20px", borderLeft: `4px solid ${T.accent}` }}>
                    {u.note && <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6 }}>{u.note}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {project.updates.length === 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: T.muted, fontSize: 13 }}>No updates recorded for this project</div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── DEPARTMENT CRUD COMPONENT ────────────────────────────────────
const DeptCRUD = ({ projects }) => {
  const { departments, addDept, updateDept, deleteDept } = useDepts();
  const T = useT();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", icon: "⚡", color: "#003932" });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", id: "", icon: "⚡", color: "#003932" });
    setShowForm(true);
  };

  const openEdit = (d) => {
    setEditing(d.id);
    setForm({ name: d.name, id: d.id, icon: d.icon, color: d.color });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast("Department name is required", "error"); return; }
    if (!editing && !form.id.trim()) { showToast("Department ID is required", "error"); return; }
    if (!editing && departments.find(d => d.id === form.id.trim().toLowerCase())) {
      showToast("Department ID already exists", "error"); return;
    }
    if (editing) {
      updateDept(editing, { name: form.name, icon: form.icon, color: form.color });
      showToast("Department updated ✓");
    } else {
      addDept({ id: form.id.trim().toLowerCase().replace(/\s+/g, "-"), name: form.name, icon: form.icon, color: form.color });
      showToast("Department added ✓");
    }
    setShowForm(false);
  };

  const handleDelete = (id) => {
    const hasProjects = projects.filter(p => p.deptId === id).length > 0;
    if (hasProjects) { showToast("Cannot delete — department has projects. Archive projects first.", "error"); return; }
    deleteDept(id);
    setConfirmDelete(null);
    showToast("Department deleted ✓");
  };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "error" ? "#dc2626" : T.primary, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 400, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Delete Department?</h3>
            <p style={{ margin: "0 0 24px", color: T.muted, fontSize: 13 }}>
              This will permanently remove <strong>{departments.find(d => d.id === confirmDelete)?.name}</strong>. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing ? "Edit Department" : "Add New Department"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.muted }}>×</button>
            </div>

            {/* Preview */}
            <div style={{ background: T.headerBg, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{form.icon}</span>
              <div>
                <div style={{ color: T.headerText, fontWeight: 700, fontSize: 15 }}>{form.name || "Department Name"}</div>
                <div style={{ color: T.headerText, fontSize: 11, opacity: 0.7 }}>ID: {form.id || "dept-id"}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Department Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Strategy & PMO"
                  style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>

              {!editing && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Department ID * <span style={{ fontWeight: 400 }}>(unique, no spaces)</span></label>
                  <input value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="e.g. strategy"
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 8 }}>Icon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ICON_OPTIONS.map(ic => (
                    <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      style={{ width: 38, height: 38, fontSize: 20, border: `2px solid ${form.icon === ic ? T.primary : T.border}`, borderRadius: 8, background: form.icon === ic ? T.badgeBg : T.surface, cursor: "pointer" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    style={{ width: 44, height: 36, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 12, color: T.muted }}>{form.color}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {editing ? "Save Changes" : "Add Department"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.muted }}>{departments.length} departments in system</div>
        <button onClick={openAdd} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Department</button>
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: T.bg }}>
            {["Icon", "Department Name", "ID", "Total Projects", "On Track", "Delayed", "Completed", "Health", "IPI", "Actions"].map(h => (
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{departments.map((d, i) => {
            const s = getDeptStats(d.id, projects);
            const dIPI = calcDeptIPI(d.id, projects);
            const ipiC = ipiColor(dIPI);
            const hasProjects = s.total > 0;
            return (
              <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.bg }}>
                <td style={{ padding: "12px 14px", fontSize: 22 }}>{d.icon}</td>
                <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700 }}>{d.name}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{d.id}</span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 15, fontWeight: 800 }}>{s.total}</td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#16a34a", fontWeight: 700 }}>{s.active}</span></td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#dc2626", fontWeight: 700 }}>{s.delayed}</span></td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#3b82f6", fontWeight: 700 }}>{s.completed}</span></td>
                <td style={{ padding: "12px 14px", minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1 }}><Progress value={s.health} height={5} color={s.health > 70 ? T.accent : s.health > 50 ? "#eab308" : "#dc2626"} /></div>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{s.health}%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: ipiC.bg, color: ipiC.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{dIPI}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(d)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: T.text }}>Edit</button>
                    <button onClick={() => setConfirmDelete(d.id)} disabled={hasProjects}
                      title={hasProjects ? "Archive all projects first" : "Delete department"}
                      style={{ background: hasProjects ? "#f3f4f6" : "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: hasProjects ? "not-allowed" : "pointer", color: hasProjects ? "#9ca3af" : "#dc2626", fontWeight: 600 }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
};

// ─── HELPERS FOR REQUESTS ────────────────────────────────────────
const REQUEST_STATUS_META = {
  // ── New Project Request (intake) statuses ────────────────────────
  Opened:                         { label: "Opened",                   color: "#059669", bg: "#ecfdf5" },
  "Under Review":                 { label: "Under Review",             color: "#7c3aed", bg: "#f5f3ff" },
  Approved:                       { label: "Approved",                 color: "#16a34a", bg: "#f0fdf4" },
  Rejected:                       { label: "Rejected",                 color: "#dc2626", bg: "#fef2f2" },
  Returned:                       { label: "Returned",                 color: "#d97706", bg: "#fef3c7" },
  // ── G1 - Project Initiation statuses (Power Automate) ────────────
  "Project Sponsor Review":       { label: "Sponsor Review",          color: "#d97706", bg: "#fffbeb" },
  "Rejected By Project Sponsor":  { label: "Rejected by Sponsor",     color: "#dc2626", bg: "#fef2f2" },
  "Stakeholder Review":           { label: "Stakeholder Review",      color: "#0891b2", bg: "#ecfeff" },
  "Rejected By Stakeholder":      { label: "Rejected by Stakeholder", color: "#dc2626", bg: "#fef2f2" },
  "PMO Review":                   { label: "PMO Review",              color: "#7c3aed", bg: "#f5f3ff" },
  "Rejected By PMO":              { label: "Rejected by PMO",         color: "#dc2626", bg: "#fef2f2" },
  "Finance Review (Stage 1)":     { label: "Finance Review",          color: "#2563eb", bg: "#eff6ff" },
  "Finance Review (Final Stage)": { label: "Finance (Final)",         color: "#1d4ed8", bg: "#dbeafe" },
  "Approved - Capitalized Proj":  { label: "Approved (Capital)",      color: "#15803d", bg: "#dcfce7" },
  "Approved - Non-Capitalized":   { label: "Approved (Non-Capital)",  color: "#16a34a", bg: "#f0fdf4" },
  // ── Legacy / mock compatibility ───────────────────────────────────
  Draft:           { label: "Draft",           color: "#6b7280", bg: "#f3f4f6" },
  Submitted:       { label: "Submitted",       color: "#2563eb", bg: "#eff6ff" },
  PendingOwner:    { label: "Pending Sponsor", color: "#d97706", bg: "#fffbeb" },
  PendingPMO:      { label: "Pending PMO",     color: "#7c3aed", bg: "#f5f3ff" },
  PendingStrategy: { label: "Pending Strategy",color: "#0891b2", bg: "#ecfeff" },
};

const RequestStatusBadge = ({ status }) => {
  const T = useT();
  const meta = REQUEST_STATUS_META[status] || { label: status, color: T.muted, bg: T.surface };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  );
};

const ApprovalTimeline = ({ history }) => {
  const T = useT();
  if (!history || history.length === 0) return <p style={{ color: T.muted, fontSize: 12, margin: 0 }}>No approval actions yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {history.map((h, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: h.action === "Approved" ? "#16a34a" : h.action === "Returned" ? "#d97706" : "#dc2626" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{h.stage} — <span style={{ color: h.action === "Approved" ? "#16a34a" : h.action === "Returned" ? "#d97706" : "#dc2626" }}>{h.action}</span></div>
            <div style={{ fontSize: 11, color: T.muted }}>{h.by} · {h.date}</div>
            {h.notes && <div style={{ fontSize: 11, color: T.text, marginTop: 2, fontStyle: "italic" }}>{h.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── MY REQUESTS VIEW ────────────────────────────────────────────
const Lbl = ({ label, err, children, T }) => (
  <div>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: err ? "#dc2626" : T.muted, marginBottom: 5 }}>
      {label}{err && <span style={{ marginLeft: 6, fontWeight: 400 }}>{err}</span>}
    </label>
    {children}
  </div>
);

const MyRequestsView = ({ requests, gateSubmissions, closureSubmissions, setRoute, currentUserName, currentUserEmail, userRole }) => {
  const T = useT();
  const bp = useBp();
  const [expandedId, setExpandedId] = useState(null);
  const pad = bp === "mobile" ? "16px" : "32px";

  // For non-admin roles: only show submissions where the user is involved
  const filterByUser = (list, nameFields, emailFields = []) => {
    if (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) return list || [];
    const name  = (currentUserName  || "").trim().toLowerCase();
    const email = (currentUserEmail || "").trim().toLowerCase();
    return (list || []).filter(item =>
      nameFields.some(f  => (item[f]  || "").trim().toLowerCase() === name) ||
      emailFields.some(f => (item[f]  || "").trim().toLowerCase() === email)
    );
  };

  const myRequests  = filterByUser(requests,         ["projectManager","projectOwner","requestedBy"], ["submittedByEmail"]);
  const myGates     = filterByUser(gateSubmissions,  ["projectManager"],                             ["submittedByEmail"]);
  const myClosures  = filterByUser(closureSubmissions,["projectManager"],                            ["submittedByEmail"]);

  const isClosedReq    = (r) => r.status?.startsWith("Approved") || r.status?.startsWith("Rejected");
  const pending        = myRequests.filter(r => !isClosedReq(r));
  const completed      = myRequests.filter(r =>  isClosedReq(r));
  const pendingGates   = myGates.filter(g => !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected"));
  const pendingClosures = myClosures.filter(c => c.status !== "Closed");

  // ── Request Card ─────────────────────────────────────────────────
  const RequestCard = ({ req }) => {
    const isExpanded = expandedId === req.id;
    return (
      <div style={{ background: T.surface, border: req.status === "Returned" ? "1.5px solid #fcd34d" : `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
          onClick={() => setExpandedId(isExpanded ? null : req.id)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{req.title}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {req.requestedBy} · {req.requestDate}
              {req.deptId && <span> · {req.deptId}</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RequestStatusBadge status={req.status} />
            <span style={{ color: T.muted, fontSize: 13 }}>{isExpanded ? "▲" : "▼"}</span>
          </div>
        </div>
        {isExpanded && (
          <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${T.border}` }}>
            {req.status === "Returned" && req.returnReason && (
              <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", margin: "14px 0 12px", fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>↩ Returned — Action Required</div>
                <div style={{ color: "#78350f" }}>{req.returnReason}</div>
              </div>
            )}
            {req.currentStage && !["Approved","Rejected","Returned to Requester"].includes(req.currentStage) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 12px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706" }} />
                <span style={{ fontSize: 13, color: T.text }}>
                  Pending with <strong>{req.pendingWith || req.currentStage}</strong>
                  {req.daysInCurrentStage > 0 && <span style={{ color: T.muted }}> · {req.daysInCurrentStage} day{req.daysInCurrentStage !== 1 ? "s" : ""}</span>}
                </span>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Approval History</div>
              <ApprovalTimeline history={req.approvalHistory} />
            </div>
            {req.description && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{req.description}</div>
              </div>
            )}
            {req.linkedProjectId && (
              <div style={{ marginTop: 14 }}>
                <button onClick={() => setRoute({ view: "project", projectId: req.linkedProjectId })}
                  style={{ padding: "7px 14px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  View Project →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const GateCard = ({ gs }) => {
    const isRejected = gs.status?.startsWith("Rejected");
    const isApproved = gs.status?.startsWith("Approved");
    const borderColor = isRejected ? "#fecaca" : isApproved ? "#bbf7d0" : T.border;
    return (
      <div style={{ background: T.surface, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{gs.projectTitle}</span>
              <span style={{ fontSize: 11, color: T.muted, background: T.bgAlt || "#f3f4f6", padding: "1px 7px", borderRadius: 6 }}>{gs.gateLabel}</span>
              {gs.projectCode && <span style={{ fontSize: 11, color: T.muted }}>{gs.projectCode}</span>}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              Submitted {gs.submissionDate}
              {gs.projectManager && <span> · PM: {gs.projectManager}</span>}
              {gs.projectSponsor && <span> · Sponsor: {gs.projectSponsor}</span>}
            </div>
            {gs.pendingWith && !isRejected && !isApproved && (
              <div style={{ fontSize: 12, color: "#d97706", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
                Pending with {gs.pendingWith}
                {gs.daysAtGate > 0 && <span style={{ color: T.muted }}> · {gs.daysAtGate} day{gs.daysAtGate !== 1 ? "s" : ""}</span>}
              </div>
            )}
          </div>
          <RequestStatusBadge status={gs.status} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>

      {/* ── Action cards row ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>

        {/* New Project Request */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 20 }}>📋</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 1 — New Request</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit a new project idea for PMO review and approval</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.intake, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Start New Request
          </button>
        </div>

        {/* Gate 1 — Project Initiation */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 20 }}>🚀</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 2 — Project Initiation</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit initiation gate for an approved project to kick off execution</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.gate1, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Submit Gate 2
          </button>
        </div>

        {/* Gate 3 — Project Plan */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 20 }}>📎</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 3 — Project Plan</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit project plan for PMO review and approval</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.gate3, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Submit Plan
          </button>
        </div>

        {/* Project Closure */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 20 }}>✅</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 5 — Project Closure</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit the closure document for a completed project</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.closure, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Submit Closure
          </button>
        </div>

      </div>

      {/* ── Gate Reviews In Progress ── */}
      {pendingGates.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Project Initiation In Progress</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingGates.map(gs => <GateCard key={gs.id} gs={gs} />)}
          </div>
        </div>
      )}

      {/* ── Closure Reviews In Progress ── */}
      {pendingClosures.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Closure Reviews In Progress</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingClosures.map(cl => (
              <div key={cl.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{cl.projectTitle}</span>
                      <span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>Project Closure</span>
                      {cl.projectCode && <span style={{ fontSize: 11, color: T.muted, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px" }}>{cl.projectCode}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      Submitted {cl.submissionDate} · PM: {cl.projectManager}
                      {cl.department && <span> · {cl.department}</span>}
                    </div>
                    {cl.daysInClosure > 0 && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#d97706" }} />
                        <span style={{ fontSize: 12, color: T.muted }}>In review · <strong>{cl.daysInClosure} day{cl.daysInClosure !== 1 ? "s" : ""}</strong></span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap" }}>
                    {cl.status || "In Review"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Requests ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Active Requests
          {pending.length > 0 && <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "1px 8px", borderRadius: 10, marginLeft: 8, fontSize: 11 }}>{pending.length}</span>}
        </div>
        {pending.length === 0
          ? (
            <div style={{ textAlign: "center", padding: "28px 20px", color: T.muted, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>No active requests</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Click "Start New Request" above to begin</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pending.map(req => <RequestCard key={req.id} req={req} />)}
            </div>
          )}
      </div>

      {/* ── Completed ── */}
      {completed.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Completed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completed.map(req => <RequestCard key={req.id} req={req} />)}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MY ACTIONS VIEW ─────────────────────────────────────────────
const MyActionsView = ({ requests, gateSubmissions, projects, setRoute, currentUserEmail, currentUserName }) => {
  const T = useT();
  const bp = useBp();
  const pad = bp === "mobile" ? "16px" : "32px";

  // In mock mode, show all pending items as demo. In live mode, filter by current user email.
  const isMock = isUsingMock();

  const pendingRequests = (requests || []).filter(r =>
    ["PendingOwner", "PendingPMO", "PendingStrategy", "Submitted"].includes(r.status) &&
    (isMock || r.pendingWithEmail === currentUserEmail)
  );

  const pendingGates = (gateSubmissions || []).filter(g =>
    !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected") &&
    (isMock || g.pendingWithEmail === currentUserEmail)
  );

  // Overdue milestones in projects where PM matches current user
  const TODAY = new Date().toISOString().split("T")[0];
  const overdueMilestones = (projects || []).flatMap(p =>
    (p.milestones || [])
      .filter(m => m.status !== "Completed" && m.date && m.date < TODAY)
      .map(m => ({ ...m, projectId: p.id, projectName: p.name, pm: p.pm }))
  ).filter(m => isMock || m.pm === currentUserName);

  const hasAnything = pendingRequests.length > 0 || pendingGates.length > 0 || overdueMilestones.length > 0;

  const ActionCard = ({ icon, title, subtitle, rightContent, onClick, urgency }) => {
    const borderColor = urgency === "high" ? "#dc2626" : urgency === "medium" ? "#d97706" : T.border;
    return (
      <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: onClick ? "pointer" : "default", transition: "all 0.15s" }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{title}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{subtitle}</div>
        </div>
        {rightContent && <div style={{ flexShrink: 0 }}>{rightContent}</div>}
        {onClick && <span style={{ color: T.muted, fontSize: 13 }}>→</span>}
      </div>
    );
  };

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>My Actions</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>
          Items waiting for your review or approval
          {isMock && <span style={{ color: "#d97706", marginLeft: 6, fontWeight: 600 }}>[Mock mode — showing all pending items]</span>}
        </p>
      </div>

      {!hasAnything && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: T.muted, background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>All clear</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>No pending actions at this time</div>
        </div>
      )}

      {/* Pending project requests */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Project Request Approvals
            <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 8px", borderRadius: 10, marginLeft: 6, fontSize: 11 }}>{pendingRequests.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingRequests.map(req => (
              <ActionCard key={req.id}
                icon="📥"
                title={req.title}
                subtitle={`Requested by ${req.requestedBy} · ${req.daysInCurrentStage} day${req.daysInCurrentStage !== 1 ? "s" : ""} pending`}
                rightContent={<RequestStatusBadge status={req.status} />}
                urgency={req.daysInCurrentStage > 5 ? "medium" : null}
                onClick={() => setRoute({ view: "requests" })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending gate reviews */}
      {pendingGates.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Gate Reviews Awaiting You
            <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "1px 8px", borderRadius: 10, marginLeft: 6, fontSize: 11 }}>{pendingGates.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingGates.map(gs => (
              <ActionCard key={gs.id}
                icon="🔖"
                title={`${gs.gateLabel} — ${gs.projectTitle}`}
                subtitle={`Submitted by ${gs.submittedBy} · ${gs.daysAtGate} day${gs.daysAtGate !== 1 ? "s" : ""} at gate`}
                rightContent={<RequestStatusBadge status={gs.status} />}
                urgency={gs.daysAtGate > 5 ? "medium" : null}
                onClick={() => setRoute({ view: "project", projectId: gs.projectId, from: "actions" })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Overdue milestones */}
      {overdueMilestones.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Overdue Milestones
            <span style={{ background: "#fee2e2", color: "#991b1b", padding: "1px 8px", borderRadius: 10, marginLeft: 6, fontSize: 11 }}>{overdueMilestones.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdueMilestones.slice(0, 10).map(m => (
              <ActionCard key={`${m.projectId}-${m.id}`}
                icon="⏰"
                title={m.name}
                subtitle={`${m.projectName} · Due ${m.date} · Owner: ${m.owner}`}
                urgency="high"
                onClick={() => setRoute({ view: "project", projectId: m.projectId, from: "actions" })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ADMIN PANEL ──────────────────────────────────────────────────
const Field = ({ label, field, type = "text", options, formData, setFormData, T, dark }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{label}</label>
    {options ? (
      <select value={formData[field] || ""} onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
        style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: dark ? "dark" : "light" }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={formData[field] || ""} onChange={e => setFormData(prev => ({ ...prev, [field]: type === "number" ? Number(e.target.value) : e.target.value }))}
        style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
    )}
  </div>
);

const AdminView = ({ projects, setRoute, onSaveForm, archiveProject, restoreProject, deleteForever }) => {
  const { departments } = useDepts();
  const T = useT();
  const activeProjects  = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p =>  p.archived);
  const [adminTab, setAdminTab] = useState("Projects");
  const [editingProject, setEditingProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [toast, setToast] = useState(null);
  const [confirmDeleteForever, setConfirmDeleteForever] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingProject(null);
    setFormData({ name: "", code: "", deptId: "strategy", pm: "", sponsor: "", phase: "Initiation", gate: "Gate 1", status: "Not Started", priority: "Medium", progress: 0, riskLevel: "Low", budgetStatus: "On Budget", budget: 0, startDate: "", plannedEnd: "", objective: "", strategic: "" });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingProject(p.id);
    setFormData({ ...p });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) { showToast("Project name and code are required", "error"); return; }
    try {
      if (editingProject) {
        await onSaveForm(formData, "edit", formData.spId, formData.id);
        showToast("Project updated successfully");
      } else {
        const today = new Date().toISOString().split("T")[0];
        const defaultGates = GATE_DEFS.map(g => ({ id: g.id, status: "Pending", date: null, approver: "", notes: "" }));
        const fullCreate = {
          ...formData,
          projectType: formData.projectType || "Internal Project",
          gates: defaultGates,
          milestones: [], risks: [], issues: [], benefits: [],
          approvals: [], updates: [],
          documents: [...MANDATORY_DOCS],
          health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
          spi: 1.0, cpi: 1.0, daysRemaining: 0, daysDelayed: 0,
          scheduleVariance: "0", actualCost: 0,
          forecast: Number(formData.budget),
          lastUpdate: today,
        };
        await onSaveForm(fullCreate, "create", null, null);
        showToast("Project added successfully");
      }
      setShowForm(false);
    } catch (err) {
      showToast(`Save failed: ${err.message}`, "error");
    }
  };

  const handleDelete = async (id) => {
    try {
      await archiveProject(id);
      showToast("Project archived");
    } catch (err) {
      showToast(`Archive failed: ${err.message}`, "error");
    }
  };

  const fp = { formData, setFormData, T, dark: themeStore.dark };

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "error" ? "#dc2626" : T.primary, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {confirmDeleteForever && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 420, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: T.text }}>Delete Permanently?</h3>
            <p style={{ margin: "0 0 24px", color: T.muted, fontSize: 13 }}>
              This will permanently delete <strong>{projects.find(p => p.id === confirmDeleteForever)?.name}</strong>. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDeleteForever(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 600, color: T.text }}>Cancel</button>
              <button onClick={async () => { try { await deleteForever(confirmDeleteForever); showToast(`Project deleted permanently`, "error"); } catch (err) { showToast(`Delete failed: ${err.message}`, "error"); } setConfirmDeleteForever(null); }}
                style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.text }}>Admin Panel</h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>Data Management & System Administration</p>
        </div>
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>🔒 Admin Access</div>
      </div>

      <Tab tabs={["Projects", "Archived", "Departments"]} active={adminTab} onSelect={setAdminTab} />

      {adminTab === "Projects" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: T.muted }}>{activeProjects.length} active projects · <span style={{ color: T.danger }}>{archivedProjects.length} archived</span></div>
            <button onClick={openAdd} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Project</button>
          </div>

          {showForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 640, maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editingProject ? "Edit Project" : "Add New Project"}</h2>
                  <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T.muted }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Project Name *" field="name" {...fp} />
                  <Field label="Project Code *" field="code" {...fp} />
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Department</label>
                    <select value={formData.deptId || ""} onChange={e => setFormData(prev => ({ ...prev, deptId: e.target.value }))}
                      style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <Field label="Project Manager" field="pm" {...fp} />
                  <Field label="Sponsor" field="sponsor" {...fp} />
                  <Field label="Phase" field="phase" options={["Initiation", "Planning", "Execution", "Monitoring", "Closure"]} {...fp} />
                  <Field label="Gate" field="gate" options={["Gate 1", "Gate 2", "Gate 3", "Gate 4", "Gate 5"]} {...fp} />
                  <Field label="Status" field="status" options={["Not Started", "On Track", "At Risk", "Delayed", "Completed"]} {...fp} />
                  <Field label="Priority" field="priority" options={["Low", "Medium", "High", "Critical"]} {...fp} />
                  <Field label="Risk Level" field="riskLevel" options={["Low", "Medium", "High", "Critical"]} {...fp} />
                  <Field label="Budget (SAR)" field="budget" type="number" {...fp} />
                  <Field label="Progress %" field="progress" type="number" {...fp} />
                  <Field label="Start Date" field="startDate" type="date" {...fp} />
                  <Field label="Planned End Date" field="plannedEnd" type="date" {...fp} />
                  <Field label="Budget Status" field="budgetStatus" options={["On Budget", "Over Budget", "Under Budget"]} {...fp} />
                  <Field label="Strategic Objective" field="strategic" {...fp} />
                  <Field label="Project Type" field="projectType" options={PROJECT_TYPES} {...fp} />
                </div>
                {/* Optional Documents Selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 6 }}>
                    Additional Required Documents <span style={{ fontWeight: 400 }}>(Project Charter, Business Case & Closure always required)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {OPTIONAL_DOCS.map(doc => {
                      const selected = (formData.requiredDocs || []).includes(doc);
                      return (
                        <button key={doc} type="button"
                          onClick={() => {
                            const current = formData.requiredDocs || [];
                            setFormData(p => ({
                              ...p,
                              requiredDocs: selected ? current.filter(d => d !== doc) : [...current, doc]
                            }));
                          }}
                          style={{
                            padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            background: selected ? T.btnPrimBg : T.surface,
                            color: selected ? T.btnPrimText : T.text,
                            border: `1px solid ${selected ? T.accent : T.border}`,
                            transition: "all 0.15s",
                          }}>
                          {selected ? "✓ " : ""}{doc}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Project Objective</label>
                  <textarea value={formData.objective || ""} onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", minHeight: 70, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleSave} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save Project</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>
                {["ID", "Code", "Project Name", "Department", "PM", "Status", "Progress", "Gate", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{activeProjects.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: T.muted }}>{p.id}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.primary }}>{p.code}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{departments.find(d => d.id === p.deptId)?.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px", minWidth: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={4} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: T.text }}>Edit</button>
                      <button onClick={() => setRoute({ view: "project", projectId: p.id, from: "admin" })} style={{ background: "#e8f5f0", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: T.primary, fontWeight: 600 }}>View</button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === "Archived" && (
        <div>
          {/* Banner */}
          <div style={{ background: "#1a0800", border: `1px solid #7c2d12`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>🗄️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#fed7aa", fontSize: 14 }}>Archived Projects — {archivedProjects.length} projects</div>
              <div style={{ fontSize: 12, color: "#9a5c38" }}>Archived projects are hidden from all dashboards and reports. You can restore them anytime or delete permanently.</div>
            </div>
          </div>

          {archivedProjects.length === 0 ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>No Archived Projects</div>
              <div style={{ fontSize: 13, color: T.muted }}>When you archive a project it will appear here</div>
            </div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Code", "Project Name", "Department", "PM", "Status", "Archived Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{archivedProjects.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.bg, opacity: 0.85 }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.muted }}>{p.code}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, opacity: 0.7 }}>{p.id}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{departments.find(d => d.id === p.deptId)?.name}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                    <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.archivedDate || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Restore */}
                        <button onClick={async () => { try { await restoreProject(p.id); showToast(`"${p.name}" restored successfully`); } catch (err) { showToast(`Restore failed: ${err.message}`, "error"); } }}
                          style={{ background: "#dcfce7", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "#15803d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          ↩ Restore
                        </button>
                        {/* Delete Forever */}
                        <button onClick={() => setConfirmDeleteForever(p.id)}
                          style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          🗑 Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adminTab === "Departments" && (
        <DeptCRUD projects={activeProjects} />
      )}

    </div>
  );
};

// ─── DEPARTMENTS OVERVIEW PAGE ───────────────────────────────────
const DepartmentsOverview = ({ projects, setRoute }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const [sort, setSort] = useState("ipi-desc");
  const activeProjects = projects.filter(p => !p.archived);

  const deptData = useMemo(() => departments.map(d => {
    const dp = activeProjects.filter(p => p.deptId === d.id);
    const stats = getDeptStats(d.id, activeProjects);
    const deptIPI = calcDeptIPI(d.id, activeProjects);
    const ipiC = ipiColor(deptIPI);

    // avg SPI / CPI across dept projects
    const avgSPI = dp.length ? (dp.reduce((s, p) => s + (p.spi ?? 1), 0) / dp.length) : 1;
    const avgCPI = dp.length ? (dp.reduce((s, p) => s + (p.cpi ?? 1), 0) / dp.length) : 1;

    // docs compliance across all dept docs
    const allDocs = dp.flatMap(p => p.documents ?? []);
    const readyDocs = allDocs.filter(doc => ["Approved","Final","Received","Current","Submitted"].includes(doc.status));
    const docsCompliance = allDocs.length ? Math.round((readyDocs.length / allDocs.length) * 100) : 0;

    const openRisks = dp.flatMap(p => p.risks ?? []).filter(r => r.status === "Open").length;
    const openIssues = dp.flatMap(p => p.issues ?? []).filter(i => i.status !== "Closed").length;
    const escalated = dp.flatMap(p => p.issues ?? []).filter(i => i.escalated).length;

    return { ...d, dp, stats, deptIPI, ipiC, avgSPI, avgCPI, docsCompliance, openRisks, openIssues, escalated };
  }), [activeProjects, departments]);

  const sorted = useMemo(() => {
    const arr = [...deptData];
    if (sort === "ipi-desc") arr.sort((a, b) => b.deptIPI - a.deptIPI);
    if (sort === "ipi-asc")  arr.sort((a, b) => a.deptIPI - b.deptIPI);
    if (sort === "projects")  arr.sort((a, b) => b.stats.total - a.stats.total);
    if (sort === "name")      arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [deptData, sort]);

  // portfolio-level IPI = avg of dept IPIs
  const portfolioIPI = deptData.length
    ? Math.round(deptData.reduce((s, d) => s + d.deptIPI, 0) / deptData.length)
    : 0;
  const portfolioIpiC = ipiColor(portfolioIPI);

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 20 : 26, fontWeight: 900, color: T.text }}>Departments Overview</h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>IPI-driven comparison across all {departments.length} departments · {projects.length} total projects</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.muted }}>Sort by:</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
            <option value="ipi-desc">IPI ↓ High first</option>
            <option value="ipi-asc">IPI ↑ Low first</option>
            <option value="projects">Most projects</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Portfolio IPI banner */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: "20px 28px", marginBottom: 28, display: "flex", alignItems: "center", gap: 24, color: T.headerText }}>
        <div style={{ background: portfolioIpiC.bg, borderRadius: 14, padding: "14px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: portfolioIpiC.color, lineHeight: 1 }}>{portfolioIPI}</div>
          <div style={{ fontSize: 11, color: portfolioIpiC.color, fontWeight: 700, marginTop: 2 }}>Portfolio IPI</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.headerText, marginBottom: 4 }}>Enterprise Portfolio Performance Index</div>
          <div style={{ fontSize: 12, color: T.headerText, opacity: 0.7, marginBottom: 12 }}>
            Weighted average of all department IPIs — Formula: SPI×50% + CPI×25% + Docs Compliance×25%
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Excellent (85–100)", color: "#15803d" },
              { label: "Good (70–84)",       color: "#0891b2" },
              { label: "Fair (55–69)",       color: "#854d0e" },
              { label: "Poor (<55)",         color: "#991b1b" },
            ].map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span style={{ fontSize: 11, color: T.muted }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* mini bar chart of dept IPIs — all labels always visible */}
        <div style={{ flex: "0 0 auto", width: "clamp(280px, 35%, 380px)" }}>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart
              data={deptData.map(d => ({
                name: d.name
                  .replace("Strategy & PMO", "Strategy")
                  .replace("Human Resources", "HR")
                  .replace("Information Technology", "IT")
                  .replace("Operations", "Ops")
                  .replace("Performance", "Perf")
                  .split(" ")[0],
                ipi: d.deptIPI,
              }))}
              barSize={15}
              margin={{ top: 4, right: 4, left: 0, bottom: 28 }}
            >
              <XAxis
                dataKey="name"
                interval={0}
                tick={{ fontSize: 9, fill: T.secondary }}
                axisLine={false}
                tickLine={false}
                angle={-35}
                textAnchor="end"
                height={44}
              />
              <YAxis domain={[0, 100]} hide />
              <Tooltip formatter={v => [`IPI: ${v}`, ""]} {...ttStyle()} />
              <Bar dataKey="ipi" radius={[3, 3, 0, 0]}>
                {deptData.map((d, i) => (
                  <Cell key={i} fill={ipiColor(d.deptIPI).color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 18 }}>
        {sorted.map((d, rank) => (
          <div key={d.id}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", transition: "all 0.2s", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,57,50,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>

            {/* Card header */}
            <div style={{ background: T.headerBg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{d.icon}</span>
                <div>
                  <div style={{ color: T.headerText, fontWeight: 800, fontSize: 14 }}>{d.name}</div>
                  <div style={{ color: T.headerText, fontSize: 11, opacity: 0.7 }}>{d.stats.total} projects</div>
                </div>
              </div>
              {/* IPI score */}
              <div style={{ background: d.ipiC.bg, borderRadius: 12, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: d.ipiC.color, lineHeight: 1 }}>{d.deptIPI}</div>
                <div style={{ fontSize: 9, color: d.ipiC.color, fontWeight: 700 }}>IPI</div>
              </div>
            </div>

            {/* IPI breakdown */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "SPI ×50%", value: d.avgSPI.toFixed(2), pts: Math.min(d.avgSPI, 1.2) * 50, color: d.avgSPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "CPI ×25%", value: d.avgCPI.toFixed(2), pts: Math.min(d.avgCPI, 1.2) * 25, color: d.avgCPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "Docs ×25%", value: `${d.docsCompliance}%`, pts: d.docsCompliance * 0.25, color: d.docsCompliance >= 80 ? "#16a34a" : "#dc2626" },
              ].map(({ label, value, pts, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{pts.toFixed(0)}pts</div>
                </div>
              ))}
            </div>

            {/* Project status breakdown */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Project Status</span>
                <span style={{ fontSize: 11, color: T.muted }}>{d.stats.total} total</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {d.stats.total > 0 && [
                  { count: d.stats.active, color: "#16a34a", label: "On Track" },
                  { count: d.stats.total - d.stats.active - d.stats.delayed - d.stats.completed, color: "#eab308", label: "At Risk" },
                  { count: d.stats.delayed, color: "#dc2626", label: "Delayed" },
                  { count: d.stats.completed, color: "#3b82f6", label: "Done" },
                ].map(({ count, color, label }) => count > 0 && (
                  <div key={label} title={`${label}: ${count}`} style={{ height: 6, flex: count, background: color, borderRadius: 4 }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {[
                  { label: "On Track", val: d.stats.active, color: "#16a34a" },
                  { label: "At Risk", val: d.stats.total - d.stats.active - d.stats.delayed - d.stats.completed, color: "#eab308" },
                  { label: "Delayed", val: d.stats.delayed, color: "#dc2626" },
                  { label: "Done", val: d.stats.completed, color: "#3b82f6" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk & Issues row */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Open Risks", val: d.openRisks, color: d.openRisks > 2 ? "#dc2626" : d.openRisks > 0 ? "#854d0e" : "#15803d" },
                { label: "Open Issues", val: d.openIssues, color: d.openIssues > 2 ? "#dc2626" : d.openIssues > 0 ? "#854d0e" : "#15803d" },
                { label: "Escalated", val: d.escalated, color: d.escalated > 0 ? "#dc2626" : "#15803d" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "6px", background: T.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{val}</div>
                  <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Budget row */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Budget Utilisation</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{d.stats.budgetUtil}%</span>
              </div>
              <Progress value={d.stats.budgetUtil} color={d.stats.budgetUtil > 90 ? "#dc2626" : d.stats.budgetUtil > 75 ? "#eab308" : T.accent} height={6} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Budget: <strong style={{ color: T.text }}>{fmtSAR(d.stats.totalBudget)}</strong></span>
                <span style={{ fontSize: 11, color: T.muted }}>Spent: <strong style={{ color: T.text }}>{fmtSAR(d.stats.actualCost)}</strong></span>
              </div>
            </div>

            {/* Footer actions */}
            <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
              <button onClick={() => setRoute({ view: "department", deptId: d.id })} style={{ flex: 1, background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                View Projects →
              </button>
              <div style={{ background: d.ipiC.bg, color: d.ipiC.color, borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center" }}>
                #{rank + 1} Rank
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ALL PROJECTS VIEW ────────────────────────────────────────────
const AllProjectsView = ({ projects, setRoute, route }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(route?.filterStatus || "All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [showCompleted, setShowCompleted] = useState(route?.filterStatus === "Completed");

  const active = projects.filter(p => !p.archived);
  const completedCount = active.filter(p => p.status === "Completed").length;

  const filtered = useMemo(() => active.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.pm.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All"
      ? (showCompleted || p.status !== "Completed")
      : p.status === filterStatus;
    const matchDept = filterDept === "All" || p.deptId === filterDept;
    const matchType = filterType === "All" || p.projectType === filterType;
    return matchSearch && matchStatus && matchDept && matchType;
  }), [active, search, filterStatus, filterDept, filterType, showCompleted]);

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 20 : 24, fontWeight: 900, color: T.text }}>All Projects</h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>Complete portfolio · {active.length} active projects across all departments</p>
        </div>
        {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && (
          <button onClick={() => setRoute({ view: "form", mode: "create" })}
            style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            + New Project
          </button>
        )}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, codes, or PMs..." style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1, minWidth: 160, background: T.inputBg, color: T.inputText }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          {["All", "On Track", "At Risk", "Delayed", "Completed", "Not Started"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText, colorScheme: themeStore.dark ? "dark" : "light" }}>
          <option value="All">All Types</option>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={() => setShowCompleted(v => !v)} style={{ background: showCompleted ? T.btnPrimBg : T.surface, color: showCompleted ? T.btnPrimText : T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
          {showCompleted ? "Hide Completed" : `+ ${completedCount} Completed`}
        </button>
        <button onClick={() => { const dm = Object.fromEntries(departments.map(d => [d.id, d.name])); exportExcel(filtered, `all-projects-${TODAY}.xls`, dm); }}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", color: T.text, whiteSpace: "nowrap", fontWeight: 600 }}>
          ↓ Export XLS
        </button>
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{filtered.length} results</div>
      </div>
      <div className="pmo-table-wrap" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: T.bg }}>
            {["Code", "Project Name", "Type", "Department", "PM", "Sponsor", "Phase", "Progress", "Status", "Risk", "Budget", "Gate", "Last Update"].map(h => (
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p, i) => {
              const dept = departments.find(d => d.id === p.deptId);
              return (
                <tr key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id, from: "projects" })}
                  className={p.status === "Delayed" ? "pmo-row-delayed" : ""}
                  style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.1s",
                    background: p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? "transparent" : T.bg) }}
                  onMouseEnter={e => e.currentTarget.style.background = themeStore.dark ? '#132820' : '#f0f7f4'}
                  onMouseLeave={e => e.currentTarget.style.background = p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? 'transparent' : T.bg)}>
                  <td style={{ padding: "12px 14px", fontSize: 11, fontWeight: 700, color: T.primary }}>{p.code}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: themeStore.T.text }}>{p.name}</td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{dept?.icon}</span><span style={{ color: T.muted }}>{dept?.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.sponsor}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.phase}</td>
                  <td style={{ padding: "12px 14px", minWidth: 90 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={4} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{p.budgetStatus}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.lastUpdate || "—"}</div>
                    {(() => { const d = daysSince(p.lastUpdate); if (!d || d < 14) return null; return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: d >= 30 ? "#fee2e2" : "#fef9c3", color: d >= 30 ? "#991b1b" : "#854d0e" }}>{d}d ago</span>; })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── PROJECT FORM HELPERS ─────────────────────────────────────────
const FField = ({ label, required, error, children }) => {
  const T = useT();
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>
      {children}
      {error && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 3 }}>{error}</div>}
    </div>
  );
};

const fInputStyle = (T, err) => ({
  width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
  border: `1px solid ${err ? "#dc2626" : T.border}`,
  background: T.inputBg, color: T.text, outline: "none", boxSizing: "border-box",
});

const MilestoneListEditor = ({ items, onChange }) => {
  const T = useT();
  const [draft, setDraft] = useState({ name: "", date: "", status: "Upcoming", owner: "" });
  const [adding, setAdding] = useState(false);
  const s = fInputStyle(T, false);
  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...items, { ...draft, id: `M${Date.now()}` }]);
    setDraft({ name: "", date: "", status: "Upcoming", owner: "" });
    setAdding(false);
  };
  const remove = id => onChange(items.filter(m => m.id !== id));
  const upd = (id, k, v) => onChange(items.map(m => m.id === id ? { ...m, [k]: v } : m));
  const cols = "2fr 130px 130px 130px 32px";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Milestones</div>
        {!adding && <button onClick={() => setAdding(true)} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add</button>}
      </div>
      {items.length === 0 && !adding && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px 0" }}>No milestones yet</div>}
      {items.map(m => (
        <div key={m.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={m.name} onChange={e => upd(m.id, "name", e.target.value)} style={s} />
          <input type="date" value={m.date || ""} onChange={e => upd(m.id, "date", e.target.value)} style={s} />
          <select value={m.status} onChange={e => upd(m.id, "status", e.target.value)} style={{ ...s, background: T.selectBg }}>
            {["Upcoming","In Progress","Completed","Delayed"].map(x => <option key={x}>{x}</option>)}
          </select>
          <input value={m.owner} onChange={e => upd(m.id, "owner", e.target.value)} placeholder="Owner" style={s} />
          <button onClick={() => remove(m.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer", color: "#dc2626", fontWeight: 900, fontSize: 15, padding: "4px" }}>×</button>
        </div>
      ))}
      {adding && (
        <div style={{ background: T.cardHover, borderRadius: 10, padding: 12, border: `1px solid ${T.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 10, alignItems: "center" }}>
            <input autoFocus value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value }))} placeholder="Milestone name *" style={s} />
            <input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} style={s} />
            <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))} style={{ ...s, background: T.selectBg }}>
              {["Upcoming","In Progress","Completed","Delayed"].map(x => <option key={x}>{x}</option>)}
            </select>
            <input value={draft.owner} onChange={e => setDraft(p => ({ ...p, owner: e.target.value }))} placeholder="Owner" style={s} />
            <div />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
            <button onClick={() => setAdding(false)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: T.text }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const RiskListEditor = ({ items, onChange }) => {
  const T = useT();
  const [adding, setAdding] = useState(false);
  const blank = { title: "", probability: "Medium", impact: "Medium", level: "Medium", owner: "", status: "Open", mitigation: "", dueDate: "" };
  const [draft, setDraft] = useState(blank);
  const s = fInputStyle(T, false);
  const ss = { ...s, background: T.selectBg };
  const add = () => {
    if (!draft.title.trim()) return;
    onChange([...items, { ...draft, id: `R${Date.now()}` }]);
    setDraft(blank);
    setAdding(false);
  };
  const remove = id => onChange(items.filter(r => r.id !== id));
  const levelC = { Critical: "#dc2626", High: "#f97316", Medium: "#eab308", Low: "#16a34a" };
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Risks</div>
        {!adding && <button onClick={() => setAdding(true)} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Risk</button>}
      </div>
      {items.length === 0 && !adding && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "16px 0" }}>No risks yet</div>}
      {items.map(r => (
        <div key={r.id} style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 8, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: T.text }}>{r.title}</div>
            <button onClick={() => remove(r.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 4, cursor: "pointer", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>Remove</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
            {[["Prob", r.probability], ["Impact", r.impact]].map(([k,v]) => <span key={k} style={{ background: T.border, borderRadius: 10, padding: "2px 8px" }}>{k}: {v}</span>)}
            <span style={{ background: levelC[r.level] || T.border, color: "#fff", borderRadius: 10, padding: "2px 8px" }}>{r.level}</span>
            {r.owner && <span style={{ background: T.border, borderRadius: 10, padding: "2px 8px" }}>Owner: {r.owner}</span>}
          </div>
          {r.mitigation && <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>Mitigation: {r.mitigation}</div>}
        </div>
      ))}
      {adding && (
        <div style={{ background: T.cardHover, borderRadius: 10, padding: 16, border: `1px solid ${T.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Risk Title *</div>
              <input autoFocus value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={s} />
            </div>
            {[["Probability", "probability", ["Low","Medium","High"]], ["Impact", "impact", ["Low","Medium","High"]], ["Level", "level", ["Low","Medium","High","Critical"]], ["Status", "status", ["Open","In Progress","Mitigated","Closed"]]].map(([l,k,opts]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{l}</div>
                <select value={draft[k]} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))} style={ss}>{opts.map(o => <option key={o}>{o}</option>)}</select>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Owner</div>
              <input value={draft.owner} onChange={e => setDraft(p => ({ ...p, owner: e.target.value }))} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Due Date</div>
              <input type="date" value={draft.dueDate} onChange={e => setDraft(p => ({ ...p, dueDate: e.target.value }))} style={s} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Mitigation Plan</div>
              <input value={draft.mitigation} onChange={e => setDraft(p => ({ ...p, mitigation: e.target.value }))} style={s} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add Risk</button>
            <button onClick={() => setAdding(false)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: T.text }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

const IssueListEditor = ({ items, onChange }) => {
  const T = useT();
  const today = new Date().toISOString().split("T")[0];
  const [adding, setAdding] = useState(false);
  const blank = { title: "", severity: "Medium", status: "Open", owner: "", raised: today, escalated: false };
  const [draft, setDraft] = useState(blank);
  const s = fInputStyle(T, false);
  const ss = { ...s, background: T.selectBg };
  const add = () => {
    if (!draft.title.trim()) return;
    onChange([...items, { ...draft, id: `I${Date.now()}` }]);
    setDraft(blank);
    setAdding(false);
  };
  const remove = id => onChange(items.filter(i => i.id !== id));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Issues</div>
        {!adding && <button onClick={() => setAdding(true)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Issue</button>}
      </div>
      {items.length === 0 && !adding && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "16px 0" }}>No issues yet</div>}
      {items.map(i => (
        <div key={i.id} style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 14px", marginBottom: 8, border: "1px solid #fecaca" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{i.title}</div>
            <button onClick={() => remove(i.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 4, cursor: "pointer", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>Remove</button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ background: "#fecaca", borderRadius: 10, padding: "2px 8px" }}>{i.severity}</span>
            <span style={{ background: "#fecaca", borderRadius: 10, padding: "2px 8px" }}>{i.status}</span>
            {i.escalated && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 10, padding: "2px 8px" }}>Escalated</span>}
          </div>
        </div>
      ))}
      {adding && (
        <div style={{ background: T.cardHover, borderRadius: 10, padding: 16, border: `1px solid ${T.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Issue Title *</div>
              <input autoFocus value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} style={s} />
            </div>
            {[["Severity", "severity", ["Low","Medium","High","Critical"]], ["Status", "status", ["Open","In Progress","Escalated","Resolved"]]].map(([l,k,opts]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{l}</div>
                <select value={draft[k]} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))} style={ss}>{opts.map(o => <option key={o}>{o}</option>)}</select>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Owner</div>
              <input value={draft.owner} onChange={e => setDraft(p => ({ ...p, owner: e.target.value }))} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Escalated?</div>
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                {[false, true].map(v => (
                  <button key={String(v)} onClick={() => setDraft(p => ({ ...p, escalated: v }))}
                    style={{ flex: 1, padding: "7px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: draft.escalated === v ? (v ? "#fee2e2" : "#dcfce7") : T.bg,
                      border: draft.escalated === v ? `1px solid ${v ? "#dc2626" : "#16a34a"}` : `1px solid ${T.border}`,
                      color: draft.escalated === v ? (v ? "#dc2626" : "#15803d") : T.muted }}>
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add Issue</button>
            <button onClick={() => setAdding(false)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: T.text }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── BENEFIT LIST EDITOR ──────────────────────────────────────────
const BenefitListEditor = ({ items, onChange }) => {
  const T = useT();
  const s = fInputStyle(T, false);
  const ss = { ...s, background: T.selectBg };
  const blank = { kpi: "", category: "Financial", owner: "", baseline: "0", target: "0", current: "0", realization: 0, contribution: "Medium" };
  const [draft, setDraft] = useState(blank);
  const [adding, setAdding] = useState(false);
  const add = () => {
    if (!draft.kpi.trim()) return;
    onChange([...items, { ...draft, id: `B${Date.now()}` }]);
    setDraft(blank);
    setAdding(false);
  };
  const remove = id => onChange(items.filter(b => b.id !== id));
  const upd = (id, k, v) => onChange(items.map(b => b.id === id ? { ...b, [k]: v } : b));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Benefits</div>
        {!adding && <button onClick={() => setAdding(true)} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add</button>}
      </div>
      {items.length === 0 && !adding && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px 0" }}>No benefits yet</div>}
      {items.map(b => (
        <div key={b.id} style={{ background: T.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 10, background: "#e8f5f0", color: "#166534", fontWeight: 700, padding: "1px 7px", borderRadius: 10, marginRight: 6 }}>{b.category}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{b.kpi}</span>
            </div>
            <button onClick={() => remove(b.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 4, cursor: "pointer", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>Remove</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Current</div>
              <input value={b.current} onChange={e => upd(b.id, "current", e.target.value)} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Realization %</div>
              <input type="number" min={0} max={100} value={b.realization} onChange={e => upd(b.id, "realization", Number(e.target.value))} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Owner</div>
              <input value={b.owner || ""} onChange={e => upd(b.id, "owner", e.target.value)} style={s} />
            </div>
          </div>
        </div>
      ))}
      {adding && (
        <div style={{ background: T.cardHover, borderRadius: 10, padding: 14, border: `1px solid ${T.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ gridColumn: "span 2" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>KPI / Benefit Name *</div>
              <input autoFocus value={draft.kpi} onChange={e => setDraft(p => ({ ...p, kpi: e.target.value }))} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Category</div>
              <select value={draft.category} onChange={e => setDraft(p => ({ ...p, category: e.target.value }))} style={ss}>
                {["Financial","Operational","Strategic","Risk Reduction"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Owner</div>
              <input value={draft.owner} onChange={e => setDraft(p => ({ ...p, owner: e.target.value }))} style={s} />
            </div>
            {[["Baseline", "baseline"], ["Target", "target"], ["Current", "current"]].map(([l, k]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{l}</div>
                <input value={draft[k]} onChange={e => setDraft(p => ({ ...p, [k]: e.target.value }))} style={s} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Realization %</div>
              <input type="number" min={0} max={100} value={draft.realization} onChange={e => setDraft(p => ({ ...p, realization: Number(e.target.value) }))} style={s} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Contribution</div>
              <select value={draft.contribution} onChange={e => setDraft(p => ({ ...p, contribution: e.target.value }))} style={ss}>
                {["Low","Medium","High"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={add} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
            <button onClick={() => setAdding(false)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: T.text }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PROJECT FORM ─────────────────────────────────────────────────
const ProjectForm = ({ projectId, mode, projects, setRoute, onSaveForm }) => {
  const T = useT();
  const { departments } = useDepts();
  const bp = useBp();
  const existing = mode === "edit" ? projects.find(p => p.id === projectId) : null;
  const today = new Date().toISOString().split("T")[0];

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState(() => existing ? { ...existing, _newUpdate: "" } : {
    name: "", code: "", deptId: "", pm: "", sponsor: "",
    projectType: "Enterprise Project", phase: "Planning", gate: "Gate 1",
    status: "Not Started", priority: "Medium", riskLevel: "Low",
    budgetStatus: "On Budget", classification: "Strategic", strategic: "",
    objective: "", businessCase: "",
    startDate: today, plannedEnd: "",
    progress: 0, plannedProgress: 0,
    budget: 0, forecast: 0, actualCost: 0,
    spi: 1.0, cpi: 1.0, daysRemaining: 0, daysDelayed: 0, scheduleVariance: "0",
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    milestones: [], risks: [], issues: [], updates: [], benefits: [], approvals: [],
    documents: [...MANDATORY_DOCS], requiredDocs: [],
    gates: GATE_DEFS.map(g => ({ id: g.id, status: "Pending", date: null, approver: "", notes: "" })),
    updateCadence: "Biweekly", archived: false, pmoStatus: "Draft", dataReliabilityFlag: "Pending",
    _newUpdate: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setH = (k, v) => setForm(f => ({ ...f, health: { ...f.health, [k]: v } }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Required";
    if (!form.code.trim()) e.code = "Required";
    if (!form.deptId) e.deptId = "Required";
    if (!form.pm.trim()) e.pm = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { setStep(0); return; }
    setSaving(true); setSaveError(null);
    try {
      await onSaveForm(form, mode, existing?.spId, existing?.id);
      setRoute(mode === "edit" ? { view: "project", projectId: existing?.id } : { view: "projects" });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { label: "Basic Info", icon: "📋" },
    { label: "Timeline & Budget", icon: "📅" },
    { label: "Health", icon: "🩺" },
    { label: "Milestones", icon: "🎯" },
    { label: "Risks & Issues", icon: "⚠️" },
    { label: "Documents", icon: "📄" },
    { label: "Updates", icon: "📝" },
  ];

  const s = fInputStyle(T, false);
  const sErr = k => fInputStyle(T, !!errors[k]);
  const ss = { ...s, background: T.selectBg };

  const RAGBtn = ({ hKey, label }) => {
    const opts = ["Green", "Amber", "Red"];
    const clr = { Green: { bg: "#dcfce7", text: "#15803d", b: "#16a34a" }, Amber: { bg: "#fef9c3", text: "#854d0e", b: "#eab308" }, Red: { bg: "#fee2e2", text: "#991b1b", b: "#dc2626" } };
    const v = form.health[hKey];
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {opts.map(o => (
            <button key={o} onClick={() => setH(hKey, o)} style={{ flex: 1, padding: "7px 4px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: v === o ? clr[o].bg : T.bg,
              border: v === o ? `2px solid ${clr[o].b}` : `1px solid ${T.border}`,
              color: v === o ? clr[o].text : T.muted }}>
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    if (step === 0) return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 16 }}>
          <FField label="Project Name" required error={errors.name}><input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Digital Insurer Transformation" style={sErr("name")} /></FField>
          <FField label="Project Code" required error={errors.code}><input value={form.code} onChange={e => set("code", e.target.value)} placeholder="e.g. PRJ-2026-45" style={sErr("code")} /></FField>
          <FField label="Department" required error={errors.deptId}>
            <select value={form.deptId} onChange={e => set("deptId", e.target.value)} style={{ ...ss, borderColor: errors.deptId ? "#dc2626" : T.border }}>
              <option value="">— Select Department —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FField>
          <FField label="Project Type"><select value={form.projectType} onChange={e => set("projectType", e.target.value)} style={ss}>{PROJECT_TYPES.map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Project Manager" required error={errors.pm}><input value={form.pm} onChange={e => set("pm", e.target.value)} placeholder="Full name" style={sErr("pm")} /></FField>
          <FField label="Sponsor"><input value={form.sponsor} onChange={e => set("sponsor", e.target.value)} placeholder="Full name" style={s} /></FField>
          <FField label="Phase"><select value={form.phase} onChange={e => set("phase", e.target.value)} style={ss}>{["Initiation","Planning","Execution","Monitoring","Closure"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Current Gate"><select value={form.gate} onChange={e => set("gate", e.target.value)} style={ss}>{["Gate 1","Gate 2","Gate 3","Gate 4","Gate 5"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Status"><select value={form.status} onChange={e => set("status", e.target.value)} style={ss}>{["Not Started","On Track","At Risk","Delayed","Completed"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Priority"><select value={form.priority} onChange={e => set("priority", e.target.value)} style={ss}>{["Critical","High","Medium","Low"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Risk Level"><select value={form.riskLevel} onChange={e => set("riskLevel", e.target.value)} style={ss}>{["Critical","High","Medium","Low"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Budget Status"><select value={form.budgetStatus} onChange={e => set("budgetStatus", e.target.value)} style={ss}>{["On Budget","Over Budget","Under Budget"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Classification"><input value={form.classification} onChange={e => set("classification", e.target.value)} placeholder="e.g. Strategic Initiative" style={s} /></FField>
          <FField label="Strategic Objective"><input value={form.strategic} onChange={e => set("strategic", e.target.value)} placeholder="e.g. Digital Transformation" style={s} /></FField>
        </div>
        <FField label="Objective"><textarea value={form.objective} onChange={e => set("objective", e.target.value)} rows={3} style={{ ...s, resize: "vertical" }} /></FField>
        <FField label="Business Case"><textarea value={form.businessCase} onChange={e => set("businessCase", e.target.value)} rows={3} style={{ ...s, resize: "vertical" }} /></FField>
      </div>
    );
    if (step === 1) return (
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 16 }}>
        <FField label="Start Date"><input type="date" value={form.startDate || ""} onChange={e => set("startDate", e.target.value)} style={s} /></FField>
        <FField label="Planned End Date"><input type="date" value={form.plannedEnd || ""} onChange={e => set("plannedEnd", e.target.value)} style={s} /></FField>
        <FField label="Progress (%)"><input type="number" min={0} max={100} value={form.progress} onChange={e => set("progress", Number(e.target.value))} style={s} /></FField>
        <FField label="Planned Progress (%)"><input type="number" min={0} max={100} value={form.plannedProgress} onChange={e => set("plannedProgress", Number(e.target.value))} style={s} /></FField>
        <FField label="Budget (SAR)"><input type="number" min={0} step={10000} value={form.budget} onChange={e => set("budget", Number(e.target.value))} style={s} /></FField>
        <FField label="Forecast (SAR)"><input type="number" min={0} step={10000} value={form.forecast} onChange={e => set("forecast", Number(e.target.value))} style={s} /></FField>
        <FField label="Actual Cost (SAR)"><input type="number" min={0} step={10000} value={form.actualCost} onChange={e => set("actualCost", Number(e.target.value))} style={s} /></FField>
        <FField label="SPI (Schedule Performance Index)"><input type="number" min={0} max={3} step={0.01} value={form.spi} onChange={e => set("spi", Number(e.target.value))} style={s} /></FField>
        <FField label="CPI (Cost Performance Index)"><input type="number" min={0} max={3} step={0.01} value={form.cpi} onChange={e => set("cpi", Number(e.target.value))} style={s} /></FField>
        <FField label="Days Remaining"><input type="number" min={0} value={form.daysRemaining} onChange={e => set("daysRemaining", Number(e.target.value))} style={s} /></FField>
      </div>
    );
    if (step === 2) return (
      <div>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: T.muted }}>Set Green / Amber / Red for each dimension. Affects the Health tab and IPI score.</p>
        <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 20 }}>
          {[["scope","Scope"],["schedule","Schedule"],["budget","Budget"],["risk","Risk"],["quality","Quality"],["resource","Resources"],["benefits","Benefits"],["governance","Governance"]].map(([k,l]) => <RAGBtn key={k} hKey={k} label={l} />)}
        </div>
      </div>
    );
    if (step === 3) return <MilestoneListEditor items={form.milestones} onChange={v => set("milestones", v)} />;
    if (step === 4) return (
      <div>
        <RiskListEditor items={form.risks} onChange={v => set("risks", v)} />
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, marginTop: 4 }}>
          <IssueListEditor items={form.issues} onChange={v => set("issues", v)} />
        </div>
      </div>
    );
    if (step === 5) return (
      <div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>
          Update document status. Required documents affect the IPI score.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(form.documents || []).map((doc, i) => (
            <div key={doc.id || i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", background: T.bg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${T.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{doc.type}{doc.required ? " · ⭐ Required (affects IPI)" : " · Optional"}</div>
              </div>
              <select
                value={doc.status || "Pending"}
                onChange={e => {
                  const updated = form.documents.map((d, j) => j === i ? { ...d, status: e.target.value, lastUpdated: new Date().toISOString().split("T")[0] } : d);
                  set("documents", updated);
                }}
                style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, background: T.inputBg, color: T.inputText, cursor: "pointer" }}
              >
                {["Pending","Draft","Submitted","Under Review","Approved","Final","Received","Current"].map(s => <option key={s}>{s}</option>)}
              </select>
              <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{doc.lastUpdated || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    );
    if (step === 6) return (
      <div>
        <FField label="Add Update Note (optional)">
          <textarea value={form._newUpdate || ""} onChange={e => set("_newUpdate", e.target.value)} rows={4} placeholder="What's the latest status? Key decisions, blockers, progress..." style={{ ...s, resize: "vertical" }} />
        </FField>
        {form.updates?.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 10 }}>Previous Updates</div>
            {[...form.updates].reverse().map(u => (
              <div key={u.id} style={{ background: T.bg, borderRadius: 8, padding: 12, marginBottom: 8, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 3 }}>{u.date} — {u.owner}</div>
                <div style={{ fontSize: 13, color: T.text }}>{u.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
    return null;
  };

  return (
    <div style={{ padding: bp === "mobile" ? 16 : 32, maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.text }}>{mode === "create" ? "New Project" : `Edit — ${existing?.name}`}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.muted }}>{mode === "create" ? "Fill in the project details. Required fields are marked *" : "Update project information and save to SharePoint"}</p>
        </div>
        <button onClick={() => setRoute(mode === "edit" ? { view: "project", projectId: existing?.id } : { view: "projects" })}
          style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: T.text, flexShrink: 0 }}>
          ✕ Cancel
        </button>
      </div>

      {/* Step tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {STEPS.map((st, i) => (
          <button key={i} onClick={() => setStep(i)}
            style={{ padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              background: step === i ? T.primary : T.bg,
              color: step === i ? (T.btnPrimText || "#fff") : T.muted,
              border: step === i ? "none" : `1px solid ${T.border}` }}>
            {st.icon} {st.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: bp === "mobile" ? 16 : 24 }}>
        {renderStep()}
      </div>

      {saveError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginTop: 12, color: "#991b1b", fontSize: 13 }}>
          ⚠️ {saveError}
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>← Back</button>}
          {step < STEPS.length - 1 && <button onClick={() => setStep(s => s + 1)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Next →</button>}
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "10px 32px", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : mode === "create" ? "Create Project" : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [route, setRoute] = useState({ view: "home" });
  const [, rerenderDark] = useState(0);
  const dark = themeStore.dark;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleDark = () => { themeStore.toggle(); rerenderDark(n => n + 1); };
  const activeT = themeStore.T;
  const { email: currentUserEmail, name: currentUserName } = useCurrentUser();
  const [userRole, setUserRole] = useState(ROLE_ADMIN);   // fail-open default during setup
  const [userDeptId, setUserDeptId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [gateSubmissions, setGateSubmissions] = useState([]);
  const [closureSubmissions, setClosureSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  // ── Bootstrap: load all data from SP (or mock) ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projs, depts, reqs, gates, closures] = await Promise.all([
          SPService.getProjects(),
          SPService.getDepartments(),
          SPService.getRequests(),
          SPService.getGateSubmissions(),
          SPService.getClosureSubmissions(),
        ]);
        if (cancelled) return;
        setProjects(projs);
        setDepartments(depts);
        setRequests(reqs);
        setGateSubmissions(gates);
        setClosureSubmissions(closures);
        setLoadedAt(new Date());
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  // ── Role lookup: fires once email is available ────────────────
  useEffect(() => {
    if (!currentUserEmail) return;
    SPService.getUserRole(currentUserEmail)
      .then(({ role, deptId }) => {
        setUserRole(role);
        setUserDeptId(deptId);
        if (role === ROLE_GRC || role === ROLE_GRC_ADMIN) {
          setRoute({ view: "department", deptId: "grc" });
        }
      })
      .catch(() => {}); // fail-open: keep pmo_admin default
  }, [currentUserEmail]);

  const addDept    = useCallback((d) => setDepartments(prev => [...prev, d]), []);
  const updateDept = useCallback((id, data) => setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...data } : d)), []);
  const deleteDept = useCallback((id) => setDepartments(prev => prev.filter(d => d.id !== id)), []);
  const deptCtx = { departments, addDept, updateDept, deleteDept };

  // theme handled by themeStore pub/sub

  // Role-based project filtering:
  // PM        → only projects where they are the assigned PM
  // Dept Head → only projects in their department
  // Others    → full list
  const visibleProjects = useMemo(() => {
    if (userRole === ROLE_PM && currentUserName) {
      const name = currentUserName.trim().toLowerCase();
      return projects.filter(p => (p.pm || "").trim().toLowerCase() === name);
    }
    if (userRole === ROLE_DEPT_HEAD) {
      if (!userDeptId) return projects;
      const ids = userDeptId.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!ids.length || ids.includes("all")) return projects;
      return projects.filter(p => ids.includes((p.deptId || "").toLowerCase()));
    }
    return projects;
  }, [projects, userRole, currentUserName, userDeptId]);

  const updateProject = useCallback((id, data) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, lastUpdate: new Date().toISOString().split("T")[0] } : p));
  }, []);

  const archiveProject = useCallback(async (id) => {
    const today = new Date().toISOString().split("T")[0];
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const updated = { ...project, archived: true, archivedDate: today };
    if (!isUsingMock() && project.spId) await SPService.updateProject(project.spId, updated);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
  }, [projects]);

  const restoreProject = useCallback(async (id) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const updated = { ...project, archived: false, archivedDate: null };
    if (!isUsingMock() && project.spId) await SPService.updateProject(project.spId, updated);
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
  }, [projects]);

  const deleteForever = useCallback(async (id) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    if (!isUsingMock() && project.spId) await SPService.deleteProject(project.spId);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, [projects]);

  // ── Update panel: all project fields → SP ───────────────────────
  const submitUpdate = useCallback(async (projectId, {
    status, phase, gate, priority, progress, plannedProgress, startDate, plannedEnd,
    health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
    milestones, risks, benefits, note,
  }) => {
    const today = new Date().toISOString().split("T")[0];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newUpdates = note?.trim()
      ? [...(project.updates || []), { id: `U${Date.now()}`, date: today, owner: project.pm, note: note.trim() }]
      : project.updates || [];
    const updated = {
      ...project,
      status, phase, gate, priority, progress, plannedProgress, startDate, plannedEnd,
      health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
      milestones, risks, benefits,
      updates: newUpdates, lastUpdate: today,
    };
    if (!isUsingMock() && project.spId) {
      await SPService.updateProject(project.spId, updated);
    }
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
  }, [projects]);

  // ── Form save: persists to SP then updates local state ──────────
  const onSaveForm = useCallback(async (form, mode, spId, localId) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const newUpdate = form._newUpdate?.trim();
    const updates = newUpdate
      ? [...(form.updates || []), { id: `U${Date.now()}`, date: todayStr, owner: form.pm, note: newUpdate }]
      : (form.updates || []);
    const full = { ...form, updates, _newUpdate: undefined, lastUpdate: todayStr };

    if (!isUsingMock()) {
      if (mode === "create") {
        const created = await SPService.createProject(full);
        setProjects(prev => [...prev, { ...full, id: created.id || full.code, spId: created.spId }]);
      } else {
        await SPService.updateProject(spId, full);
        setProjects(prev => prev.map(p => p.id === localId ? { ...p, ...full } : p));
      }
    } else {
      if (mode === "create") {
        setProjects(prev => {
          const next = prev.reduce((max, p) => Math.max(max, parseInt(p.id.replace(/\D/g,""),10)||0), 0) + 1;
          return [...prev, { ...full, id: full.code || `P${String(next).padStart(3,"0")}` }];
        });
      } else {
        setProjects(prev => prev.map(p => p.id === localId ? { ...p, ...full } : p));
      }
    }
  }, []);

  const getTitle = () => {
    if (route.view === "home")        return ["Enterprise Portfolio Dashboard", "Executive overview across all departments"];
    if (route.view === "departments") return ["Departments Overview", `IPI comparison across ${departments.length} departments`];
    if (route.view === "projects")    return ["All Projects", "Complete project portfolio"];
    if (route.view === "admin")       return ["Admin Panel", "System data management"];
    if (route.view === "requests")    return ["New Request", "Submit a new project request or track existing ones"];
    if (route.view === "actions")     return ["My Actions", "Items pending your review or approval"];
    if (route.view === "department") {
      const d = departments.find(x => x.id === route.deptId);
      return [d?.name || "Department", "Project portfolio"];
    }
    if (route.view === "project") {
      const p = projects.find(x => x.id === route.projectId);
      return [p?.name || "Project", p?.code || ""];
    }
    if (route.view === "form") return [route.mode === "create" ? "New Project" : "Edit Project", "Fill in details and save"];
    return ["PMO Portal", ""];
  };

  const [title, subtitle] = getTitle();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: activeT.bg, flexDirection: "column", gap: 16 }}>
        <div style={{ width: 48, height: 48, border: `4px solid ${activeT.border}`, borderTop: `4px solid ${activeT.primary}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: activeT.muted, fontSize: 14, margin: 0 }}>{isUsingMock() ? "Loading mock data…" : "Connecting to SharePoint…"}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: activeT.bg, flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ color: activeT.text, margin: 0 }}>Failed to load data</h2>
        <p style={{ color: activeT.muted, fontSize: 13, margin: 0 }}>{loadError}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: "8px 20px", background: activeT.primary, color: activeT.btnPrimText || "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Retry</button>
      </div>
    );
  }

  // GRC-only users see nothing but the GRC dashboard
  if (userRole === ROLE_GRC || userRole === ROLE_GRC_ADMIN) {
    return (
      <DeptContext.Provider value={deptCtx}>
      <div style={{ height: "100vh", overflowY: "auto", fontFamily: "'Segoe UI', system-ui, sans-serif", background: activeT.bg, color: activeT.text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", background: activeT.headerBg, borderBottom: `1px solid ${activeT.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <span style={{ fontWeight: 900, fontSize: 15, color: activeT.headerText }}>GRC Portal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: activeT.headerText, opacity: 0.7 }}>{currentUserName || currentUserEmail}</span>
            <button onClick={toggleDark} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: activeT.headerText }}>{dark ? "☀️" : "🌙"}</button>
          </div>
        </div>
        <GRCDashboard canEdit={userRole === ROLE_GRC_ADMIN} />
      </div>
      </DeptContext.Provider>
    );
  }

  return (
    <DeptContext.Provider value={deptCtx}>
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: activeT.bg, color: activeT.text,
      overflow: "hidden",
    }}>
      <Sidebar route={route} setRoute={setRoute} projects={visibleProjects} requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} currentUserEmail={currentUserEmail} currentUserName={currentUserName} userRole={userRole} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header title={title} subtitle={subtitle} route={route} setRoute={setRoute} dark={dark} toggleDark={toggleDark} onMenuClick={() => setSidebarOpen(true)} projects={projects} currentUserName={currentUserName} />
        <main style={{ flex: 1, overflowY: "auto", background: activeT.bg }}>
          {route.view === "home"        && <HomeView          projects={visibleProjects} requests={requests} gateSubmissions={gateSubmissions} setRoute={setRoute} loadedAt={loadedAt} />}
          {route.view === "departments" && <DepartmentsOverview projects={visibleProjects} setRoute={setRoute} />}
          {route.view === "projects"    && <AllProjectsView    projects={visibleProjects} setRoute={setRoute} route={route} />}
          {route.view === "department"  && <DepartmentView     projects={visibleProjects} deptId={route.deptId} setRoute={setRoute} userRole={userRole} userDeptId={userDeptId} />}
          {route.view === "project"     && <ProjectView        projects={projects} projectId={route.projectId} setRoute={setRoute} submitUpdate={submitUpdate} userRole={userRole} />}
          {route.view === "requests"    && <MyRequestsView     requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} setRoute={setRoute} currentUserName={currentUserName} currentUserEmail={currentUserEmail} userRole={userRole} />}
          {route.view === "actions"     && <MyActionsView      requests={requests} gateSubmissions={gateSubmissions} projects={visibleProjects} setRoute={setRoute} currentUserEmail={currentUserEmail} currentUserName={currentUserName} />}
          {route.view === "admin"       && (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && <AdminView projects={projects} setRoute={setRoute} onSaveForm={onSaveForm} archiveProject={archiveProject} restoreProject={restoreProject} deleteForever={deleteForever} />}
          {route.view === "form"        && (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && <ProjectForm projectId={route.projectId} mode={route.mode || "create"} projects={projects} setRoute={setRoute} onSaveForm={onSaveForm} />}
        </main>
      </div>
    </div>
    </DeptContext.Provider>
  );
}
