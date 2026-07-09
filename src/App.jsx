// ============================================================================
//  PMO Portal — Main Application File
// ============================================================================
//
//  This file holds the entire application: every view, every route, and the
//  top-level orchestration that ties them together. Navigation is state-driven
//  via a `route` object (no router library) — see the App component near the
//  bottom for how views are switched.
//
//  Map of what's where (line numbers approximate, jump-by search works):
//
//    UI helpers       RiskMatrix, AnimStyles, GateTracker, DocComplianceBar,
//                     Tab, RequestStatusBadge, ApprovalTimeline, ApprovalLogPanel
//
//    Chrome           Sidebar, Header — the left nav and top bar shared by
//                     every screen
//
//    Views            HomeView (loaded from ./views/HomeView.jsx),
//                     DepartmentView, ProjectView, MyRequestsView,
//                     MyActionsView, AdminView, DepartmentsOverview,
//                     AllProjectsView, GRCDashboard (loaded from ./views/),
//                     ProjectForm
//
//    Editors          UpdatePanel — the side drawer a PM uses to push status
//                     MilestoneGantt — the Activities-tab chart
//                     MilestoneListEditor / RiskListEditor / IssueListEditor /
//                     BenefitListEditor — list editors used by the forms
//
//    Roots            App — entry point, fetches data and routes to views
//
//  Data flow: SharePoint REST → src/services/sharepoint.js mappers →
//  React state in App → props down to the views.
//
//  See src/utils/metrics.js for the IPI engine and src/theme.js for the
//  Tree brand palette.
// ============================================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine, ReferenceArea, CartesianGrid, LabelList } from "recharts";
import { GATE_DEFS, OPTIONAL_DOCS, PROJECT_TYPES } from "./data/constants.js";
import { SPService, isUsingMock, FORM_URLS } from "./services/sharepoint.js";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { ROLE_ADMIN, ROLE_PM, ROLE_EXEC, ROLE_DEPT_HEAD, ROLE_GRC, ROLE_GRC_ADMIN, ROLE_PMO_HEAD, ROLE_PMO_STAFF, ROLE_LOCKED } from "./roles.js";
import { themeStore, useT, ttStyle } from "./theme.js";
import { useBp } from "./hooks/useBp.js";
import { statusColor, riskColor, deptColor } from "./utils/colors.js";
import { fmtSAR } from "./utils/format.js";
import { TODAY, daysSince } from "./utils/dates.js";
import { getDeptStats, calcProjectIPI, calcProjectIPIFull, calcProjectIPIDisplay, calcDeptIPI, calcPortfolioIPI, ipiColor, ipiColorDark, getGateSLA, deriveRiskLevel, deriveBudgetStatus, calcProjectProgressFromWBS, effectiveProgress, parseGateNumber, calcAnticipatedMCI, deriveProjectStatus, plannedProgressAt, trackMilestoneDateChanges } from "./utils/metrics.js";
import { exportExcel } from "./utils/export.js";
import { TypeBadge, Badge, RiskBadge } from "./components/Badge.jsx";
import { Ico, DeptTile } from "./components/Icon.jsx";
import { ScoreChips } from "./components/ScoreChips.jsx";
import { Progress } from "./components/Progress.jsx";
import IPICalculator from "./components/IPICalculator.jsx";
import CostCalculator from "./components/CostCalculator.jsx";
import ROICalculator from "./components/ROICalculator.jsx";
import WhatIfPicker from "./components/WhatIfPicker.jsx";
import DocGenerator from "./components/DocGenerator.jsx";
import { IPIBreakdownModal, ProgressBreakdownModal } from "./components/MetricBreakdown.jsx";
import GRCDashboard from "./views/GRCDashboard.jsx";
import HomeView from "./views/HomeView.jsx";
import { DeptContext, useDepts } from "./deptContext.js";

// ─── THEME TOKENS ────────────────────────────────────────────────
// ─── DEPARTMENTS CONTEXT (live CRUD) ──────────────────────────────

// ─── HELPERS ──────────────────────────────────────────────────────

// Mandatory docs every project gets at creation — single source of truth.
// requiredAtGate ties each artifact to the gate by which it MUST be delivered.
// Until the project reaches that gate, the doc is "not yet due" and is
// excluded from MCI — preventing perpetually-At-Risk projects waiting for
// future-gate artifacts like Closure.
const MANDATORY_DOCS = [
  { id: "D1", name: "Project Charter",  type: "Charter",       required: true, requiredAtGate: 2, status: "Pending", version: "", lastUpdated: "" },
  { id: "D2", name: "Business Case",    type: "Business Case", required: true, requiredAtGate: 2, status: "Pending", version: "", lastUpdated: "" },
  { id: "D3", name: "Closure Document", type: "Closure",       required: true, requiredAtGate: 5, status: "Pending", version: "", lastUpdated: "" },
];


// ─── UI COMPONENTS ───────────────────────────────────────────────
// ─── RISK MATRIX COMPONENT ───────────────────────────────────────
const RiskMatrix = ({ risks }) => {
  const T = useT();
  const [activeCell, setActiveCell] = useState(null);

  const normLevel = v => {
    const s = String(v || "").toLowerCase();
    if (s.includes("critical") || s.includes("very high") || s.includes("high")) return "High";
    if (s.includes("medium") || s.includes("mod")) return "Medium";
    return "Low";
  };

  // Zone definitions per cell — v2 brand recolor.
  const _CRIT = { bg: "#fff3ee", fill: "#ffe3d6", accent: "#FF5000", text: "#7c2d12", zone: "Critical" };
  const _HIGH = { bg: "#fdece2", fill: "#fbdcc9", accent: "#b23800", text: "#7c2d12", zone: "High"     };
  const _MED  = { bg: "#fdf6e8", fill: "#fbedcf", accent: "#d97706", text: "#78350f", zone: "Medium"   };
  const _LOW  = { bg: "#eefaf4", fill: "#d8f3e6", accent: "#007a62", text: "#00432f", zone: "Low"      };
  const ZONE_MAP = {
    "High-Low":      _MED,
    "High-Medium":   _HIGH,
    "High-High":     _CRIT,
    "Medium-Low":    _LOW,
    "Medium-Medium": _MED,
    "Medium-High":   _HIGH,
    "Low-Low":       _LOW,
    "Low-Medium":    _LOW,
    "Low-High":      _MED,
  };
  const ZONE_META = {
    Critical: { color: "#FF5000", bg: "#fff3ee", label: "Critical" },
    High:     { color: "#b23800", bg: "#fdece2", label: "High"     },
    Medium:   { color: "#d97706", bg: "#fdf6e8", label: "Medium"   },
    Low:      { color: "#007a62", bg: "#eefaf4", label: "Low"      },
  };

  const openRisks = risks.filter(r => r.status !== "Closed");
  const cellRisks = (prob, impact) => openRisks.filter(r => normLevel(r.probability) === prob && normLevel(r.impact) === impact);

  const zoneCounts = Object.entries(ZONE_META).map(([z, meta]) => ({
    ...meta, zone: z,
    count: openRisks.filter(r => ZONE_MAP[`${normLevel(r.probability)}-${normLevel(r.impact)}`]?.zone === z).length,
  }));

  const PROBS   = ["High", "Medium", "Low"];
  const IMPACTS = ["Low", "Medium", "High"];

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20, boxShadow: `0 1px 4px ${T.border}80` }}>

      {/* ── Header strip ── */}
      <div style={{ padding: "18px 24px 14px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>Risk Matrix</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>Probability × Impact · open risks</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {zoneCounts.filter(z => z.count > 0).map(z => (
              <div key={z.zone} style={{ background: z.bg, color: z.color, border: `1px solid ${z.color}55`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: z.color, display: "inline-block" }} />
                {z.count} {z.label}
              </div>
            ))}
            {openRisks.length === 0 && <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>No open risks</span>}
          </div>
        </div>
      </div>

      {/* ── Matrix grid ── */}
      <div style={{ padding: "20px 24px 16px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 10, minWidth: 380 }}>

          {/* Y-axis label */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, flexShrink: 0 }}>
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 9, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Probability</span>
          </div>

          <div style={{ flex: 1 }}>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div />
              {IMPACTS.map(imp => (
                <div key={imp} style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "0.12em", display: "inline-block", background: T.bg, borderRadius: 6, padding: "3px 8px" }}>{imp}</span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {PROBS.map((prob, pi) => (
              <div key={prob} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr 1fr", gap: 6, marginBottom: pi < PROBS.length - 1 ? 6 : 0 }}>
                {/* Row label */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", display: "inline-block", background: T.bg, borderRadius: 6, padding: "3px 8px" }}>{prob}</span>
                </div>

                {/* Cells */}
                {IMPACTS.map(impact => {
                  const key  = `${prob}-${impact}`;
                  const z    = ZONE_MAP[key];
                  const cr   = cellRisks(prob, impact);
                  const n    = cr.length;
                  const isActive = activeCell === key;
                  return (
                    <div key={key}
                      onClick={() => setActiveCell(isActive ? null : (n > 0 ? key : null))}
                      style={{
                        background: isActive ? z.fill : z.bg,
                        border: `1.5px solid ${isActive ? z.accent : `${z.accent}${n > 0 ? "80" : "40"}`}`,
                        borderRadius: 10,
                        minHeight: 76,
                        padding: "8px 10px 26px",
                        position: "relative",
                        cursor: n > 0 ? "pointer" : "default",
                        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                        boxShadow: isActive ? `0 0 0 3px ${z.accent}28, 0 4px 14px ${z.accent}22` : "none",
                      }}>

                      {/* Zone watermark */}
                      <div style={{ position: "absolute", top: 7, right: 9, fontSize: 8, fontWeight: 900, color: `${z.accent}90`, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {z.zone}
                      </div>

                      {/* Risk chips */}
                      {cr.slice(0, 2).map(r => (
                        <div key={r.id} title={r.title} style={{
                          fontSize: 9, fontWeight: 700, color: z.text,
                          background: "rgba(255,255,255,0.82)",
                          borderLeft: `3px solid ${z.accent}`,
                          borderRadius: "0 5px 5px 0",
                          padding: "3px 7px",
                          marginBottom: 3,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {r.title.length > 20 ? r.title.slice(0, 18) + "…" : r.title}
                        </div>
                      ))}
                      {n > 2 && (
                        <div style={{ fontSize: 9, fontWeight: 800, color: z.accent, paddingLeft: 4, marginTop: 1 }}>+{n - 2} more</div>
                      )}

                      {/* Count badge */}
                      {n > 0 && (
                        <div style={{
                          position: "absolute", bottom: 7, right: 9,
                          minWidth: 20, height: 20, borderRadius: 10,
                          background: z.accent, color: "#fff",
                          fontSize: 9, fontWeight: 900,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: "0 5px",
                        }}>
                          {n}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* X-axis label */}
            <div style={{ textAlign: "center", fontSize: 9, fontWeight: 800, color: T.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 10 }}>Impact</div>

            {/* Expanded risk detail */}
            {activeCell && (() => {
              const z    = ZONE_MAP[activeCell];
              const [p, imp] = activeCell.split("-");
              const cr   = cellRisks(p, imp);
              return (
                <div style={{ marginTop: 14, background: z.fill, border: `1.5px solid ${z.accent}`, borderRadius: 12, padding: "14px 16px", animation: "fadeIn 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: z.text }}>{p} Prob · {imp} Impact</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: z.accent, background: "rgba(255,255,255,0.7)", padding: "2px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>{z.zone} Zone</span>
                    </div>
                    <button onClick={() => setActiveCell(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: z.accent, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {cr.map(r => (
                      <div key={r.id} style={{ background: "rgba(255,255,255,0.88)", borderRadius: 8, padding: "9px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1f2937" }}>{r.title}</div>
                          {r.description && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{r.description}</div>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: z.accent, background: z.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", border: `1px solid ${z.accent}40`, flexShrink: 0 }}>
                          {r.status || "Open"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Zone legend */}
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              {[
                { zone: "Low",      color: "#16a34a", fill: "#dcfce7" },
                { zone: "Medium",   color: "#d97706", fill: "#fef3c7" },
                { zone: "High",     color: "#ea580c", fill: "#ffedd5" },
                { zone: "Critical", color: "#dc2626", fill: "#fee2e2" },
              ].map(z => (
                <div key={z.zone} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.muted }}>
                  <div style={{ width: 14, height: 10, background: z.fill, border: `2px solid ${z.color}`, borderRadius: 3 }} />
                  {z.zone}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── GLOBAL ANIMATION KEYFRAMES ──────────────────────────────────
const AnimStyles = () => (
  <style>{`
    @keyframes pmo-pulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(234,179,8,0.45); }
      55%      { box-shadow: 0 0 0 10px rgba(234,179,8,0); }
    }
    @keyframes pmo-fadein {
      from { opacity:0; transform:translateY(7px); }
      to   { opacity:1; transform:translateY(0);   }
    }
    .pmo-tab-content { animation: pmo-fadein 0.22s cubic-bezier(0.4,0,0.2,1); }
    /* Sidebar scrollbar — thin and translucent so the default chunky white
       Windows bar doesn't slice through the dark green panel. */
    .pmo-sidebar nav { scrollbar-width: thin; scrollbar-color: rgba(0,255,179,0.18) transparent; }
    .pmo-sidebar nav::-webkit-scrollbar { width: 5px; }
    .pmo-sidebar nav::-webkit-scrollbar-track { background: transparent; }
    .pmo-sidebar nav::-webkit-scrollbar-thumb { background: rgba(0,255,179,0.18); border-radius: 3px; }
    .pmo-sidebar nav::-webkit-scrollbar-thumb:hover { background: rgba(0,255,179,0.32); }
  `}</style>
);

// ─── COUNT-UP HOOK ────────────────────────────────────────────────
function useCountUp(target, duration = 750) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

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
                  animation: g.status === "In Progress" ? "pmo-pulse 2s ease-in-out infinite" : "none",
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
              {g.date     && <div>Date: <strong>{g.date}</strong></div>}
              {g.approver && <div>Approver: <strong>{g.approver}</strong></div>}
              {g.notes    && <div>Notes: <strong>{g.notes}</strong></div>}
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
// ─── DOCUMENT COMPLIANCE CARD ─────────────────────────────────────
const DocComplianceBar = ({ project }) => {
  const T = useT();
  const currentGate = parseGateNumber(project.gate);
  const allDocs = project.documents ?? [];
  const reqDocs = allDocs.filter(d => d.required);
  // Gate-aware: only count docs that are already due for the active gate.
  // Future-gate docs (e.g. Closure before Gate 5) don't drag the bar down.
  const dueDocs  = reqDocs.filter(d => (d.requiredAtGate || 1) <= currentGate);
  const pending  = reqDocs.length - dueDocs.length;
  const ready    = dueDocs.filter(d => ["Approved","Final","Received","Current","Submitted"].includes(d.status));
  const pct      = dueDocs.length ? Math.round((ready.length / dueDocs.length) * 100) : null;
  const color    = pct == null ? T.muted : pct === 100 ? "#16a34a" : pct >= 60 ? "#eab308" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: T.border, borderRadius: 6, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct ?? 0}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct == null ? "—" : `${pct}%`}</span>
      <span style={{ fontSize: 11, color: T.muted }}>
        {ready.length}/{dueDocs.length} due
        {pending > 0 && <span style={{ opacity: 0.7 }}> · {pending} upcoming</span>}
      </span>
    </div>
  );
};


const Tab = ({ tabs, active, onSelect }) => {
  const T = useT();
  // Segmented control: the active tab is a filled brand pill, inactive tabs
  // read as solid dark text (not faint grey) so the whole bar is legible at
  // a glance. Sits in a subtle tray to look like one deliberate control.
  return (
    <div className="pmo-tabs" style={{
      display: "inline-flex", gap: 2, marginBottom: 24, padding: 4,
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12,
      maxWidth: "100%",
    }}>
      {tabs.map(t => {
        const on = active === t;
        return (
          <button key={t} onClick={() => onSelect(t)} style={{
            background: on ? T.primary : "transparent",
            border: "none", borderRadius: 8,
            padding: "8px 15px", fontSize: 13,
            fontWeight: on ? 700 : 600,
            color: on ? "#fff" : T.text,
            cursor: "pointer", transition: "all 0.15s",
            whiteSpace: "nowrap", flexShrink: 0,
            boxShadow: on ? "0 1px 3px rgba(0,57,50,0.25)" : "none",
          }}
            onMouseEnter={e => { if (!on) e.currentTarget.style.background = T.border; }}
            onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
          >{t}</button>
        );
      })}
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
//  SIDEBAR
// ────────────────────────────────────────────────────────────────────────────
//  The left navigation. Brand mark up top, then the nav items the current
//  user is allowed to see (role-based). Two of the items carry live counters:
//  My Actions (pending approvals on the user) and My Requests (the user's
//  own open submissions). Collapses to an overlay on mobile/tablet.
//
// Monochrome line icons for the sidebar — stroke follows currentColor so
// each icon inherits its row's state colour (mint when active, moss idle).
// Replaced the coloured emojis, which each dragged their own palette into
// the dark panel and read as prototype rather than product.
const NavIcon = ({ name, size = 16 }) => {
  const paths = {
    home:     <><path d="M3 7.5 8 3l5 4.5"/><path d="M4.5 6.8V13h7V6.8"/></>,
    grid:     <><rect x="3" y="3" width="4.2" height="4.2" rx="1"/><rect x="8.8" y="3" width="4.2" height="4.2" rx="1"/><rect x="3" y="8.8" width="4.2" height="4.2" rx="1"/><rect x="8.8" y="8.8" width="4.2" height="4.2" rx="1"/></>,
    list:     <><path d="M5.5 4.5H13"/><path d="M5.5 8H13"/><path d="M5.5 11.5H13"/><circle cx="3.2" cy="4.5" r="0.5"/><circle cx="3.2" cy="8" r="0.5"/><circle cx="3.2" cy="11.5" r="0.5"/></>,
    send:     <><path d="M13.5 2.5 2.5 7l4.2 1.8L8.5 13z"/><path d="M13.5 2.5 6.7 8.8"/></>,
    check:    <><circle cx="8" cy="8" r="5.5"/><path d="m5.7 8.2 1.6 1.6 3-3.4"/></>,
    gear:     <><circle cx="8" cy="8" r="2"/><path d="M8 2.8v1.4M8 11.8v1.4M2.8 8h1.4M11.8 8h1.4M4.3 4.3l1 1M10.7 10.7l1 1M11.7 4.3l-1 1M5.3 10.7l-1 1"/></>,
    sliders:  <><path d="M3 5h10M3 11h10"/><circle cx="6" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1.6" fill="currentColor" stroke="none"/></>,
    doc:      <><path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3"/><path d="M6 8.3h4M6 10.8h2.5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[name] || paths.list}
    </svg>
  );
};

// Two-letter tile for departments — one visual family instead of a random
// emoji per row. Initials from the first two words ("Strategy & PMO" → SP).
const DeptGlyph = ({ name }) => {
  const letters = (name || "?")
    .split(/[\s&/-]+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  return (
    <span style={{
      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.06)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color: "inherit", opacity: 0.9,
    }}>{letters}</span>
  );
};

const Sidebar = ({ route, setRoute, projects, requests, gateSubmissions, closureSubmissions, currentUserEmail, currentUserName, userRole, userDeptId, open, onClose, onOpenWhatIf, onOpenDocGen }) => {
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
    () => projects.filter(p => !p.archived && (p.status === "Delayed" || deriveRiskLevel(p) === "Critical")).length,
    [projects]
  );

  // Pending actions = submissions where pendingWithEmail matches current user
  const actionsCount = useMemo(() => {
    // Sidebar badge counts — match user against single email OR the
    // pendingStakeholderEmails list (multi-reviewer stages).
    const ownsItem = (it) =>
      (it.pendingWithEmail && it.pendingWithEmail === currentUserEmail) ||
      (Array.isArray(it.pendingStakeholderEmails) && it.pendingStakeholderEmails.includes(currentUserEmail));
    const reqPending        = (requests           || []).filter(r => ownsItem(r)).length;
    const gatePending       = (gateSubmissions    || []).filter(g => ownsItem(g)).length;
    const closurePending    = (closureSubmissions || []).filter(c => ownsItem(c)).length;
    const validationPending = (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF)
      ? (projects || []).filter(p => p.pmoStatus === "Submitted").length
      : 0;
    return reqPending + gatePending + closurePending + validationPending;
  }, [requests, gateSubmissions, closureSubmissions, projects, currentUserEmail, userRole]);

  // All active submissions across all three lists
  const myRequestsCount = useMemo(() => {
    const reqs    = (requests           || []).filter(r => !r.status?.startsWith("Approved") && !r.status?.startsWith("Rejected")).length;
    const gates   = (gateSubmissions    || []).filter(g => !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected")).length;
    const closures= (closureSubmissions || []).filter(c => c.status !== "Closed").length;
    return reqs + gates + closures;
  }, [requests, gateSubmissions, closureSubmissions]);

  const isPM   = userRole === ROLE_PM;
  const isAdmin = userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD;
  // What-If tools are planning aids, not admin surface — PMO Staff do the
  // day-to-day estimation work, so they get them too (role-audit finding).
  const canWhatIf = isAdmin || userRole === ROLE_PMO_STAFF;
  // Doc Generator is FOR the PMs (self-service charters/plans instead of
  // template e-mails), so PMs get it alongside the PMO roles.
  const canDocGen = isAdmin || userRole === ROLE_PMO_STAFF || isPM;

  // The projects route is visible to EVERY role. For a PM the projects prop
  // is already server-filtered to their own projects (getProjects role=pm),
  // so the same view naturally becomes "My Projects" — hiding the link (the
  // old behaviour) left PMs with no way to reach their own project at all.
  const navItems = [
    ...(!isPM ? [{ icon: "home", label: "Portfolio Overview", route: "home" }] : []),
    ...(!isPM ? [{ icon: "grid", label: "Departments IPI",     route: "departments" }] : []),
    { icon: "list", label: isPM ? "My Projects" : "All Projects", route: "projects", badge: attnCount },
    { icon: "send", label: "New Request",          route: "requests"},
    { icon: "check", label: "My Actions",            route: "actions",  badge: actionsCount, badgeColor: actionsCount > 0 ? "#d97706" : null },
    ...(isAdmin ? [{ icon: "gear", label: "Admin Panel", route: "admin" }] : []),
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
            <img src="/tree-logo.png" alt="Tree" style={{ width: 36, height: 36, borderRadius: 10, display: "block", objectFit: "cover" }} />
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
              <NavIcon name={item.icon} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background: item.badgeColor || "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 10, lineHeight: "18px" }}>{item.badge}</span>
              )}
            </button>
          ))}
          {/* What-If Hub — single sidebar entry that opens a picker with
              IPI / Cost / ROI calculators. Replaces the two separate sidebar
              buttons; keeps the sidebar clean as we add more planning tools. */}
          {((canWhatIf && onOpenWhatIf) || (canDocGen && onOpenDocGen)) && (
            /* Designed INTO the sidebar's own language instead of imported
               from elsewhere: a micro section header (same idiom as
               "DEPARTMENTS" below) and quietly recessed tool trays — one
               step darker than the sidebar with a mint hairline, so they
               read as built-in instruments rather than marketing buttons. */
            <>
              <div style={{ margin: "14px 0 6px", padding: "0 12px", fontSize: 10, color: "rgba(161,185,171,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Planning
              </div>
              {[
                ...(canWhatIf && onOpenWhatIf ? [{ icon: "sliders", label: "What-If Tools", onClick: onOpenWhatIf }] : []),
                ...(canDocGen && onOpenDocGen ? [{ icon: "doc", label: "Doc Generator", onClick: onOpenDocGen }] : []),
              ].map(tool => (
                <button key={tool.label} onClick={() => { tool.onClick(); if (!isDesktop) onClose(); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                  border: "1px solid rgba(0,255,179,0.16)",
                  background: "rgba(0,0,0,0.22)",
                  color: T.accent, cursor: "pointer", fontSize: 13, fontWeight: 600,
                  marginBottom: 4, transition: "all 0.18s", textAlign: "left",
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(0,255,179,0.10)";
                    e.currentTarget.style.borderColor = "rgba(0,255,179,0.40)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(0,0,0,0.22)";
                    e.currentTarget.style.borderColor = "rgba(0,255,179,0.16)";
                  }}>
                  <NavIcon name={tool.icon} />
                  <span style={{ flex: 1 }}>{tool.label}</span>
                </button>
              ))}
            </>
          )}
          {/* Dept Heads see only their own department(s) — their project data
              is scoped server-side, so foreign-department links would open
              empty (0-project) views: the same dead-end shape as the old PM
              bug. Everyone else sees the full list. */}
          {(() => {
            if (isPM) return null;
            let visibleDepts = departments;
            if (userRole === ROLE_DEPT_HEAD && userDeptId) {
              const ids = userDeptId.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
              if (ids.length && !ids.includes("all")) {
                const scoped = departments.filter(d => ids.includes((d.id || "").toLowerCase()));
                if (scoped.length) visibleDepts = scoped;
              }
            }
            return (<>
          <div style={{ margin: "16px 0 8px", padding: "0 12px", fontSize: 10, color: "rgba(161,185,171,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {userRole === ROLE_DEPT_HEAD && visibleDepts.length < departments.length ? "My Department" : "Departments"}
          </div>
          {visibleDepts.map(d => {
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
                <DeptGlyph name={d.name} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                  {/* A "0" badge says "nothing here" — that doesn't earn a
                      pixel. Render the count only when there is one. */}
                  {stats.total > 0 && (
                    <span style={{ background: "rgba(255,255,255,0.1)", color: T.light, fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>
                      {stats.total}
                    </span>
                  )}
                  {del > 0 && (
                    <span className="pmo-pulse-dot" style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }} />
                  )}
                </span>
              </button>
            );
          })}
            </>);
          })()}
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
// ────────────────────────────────────────────────────────────────────────────
//  HEADER
// ────────────────────────────────────────────────────────────────────────────
//  The top bar that appears above every view. Carries the breadcrumb title,
//  global search, dark-mode toggle, and the current user's chip. On smaller
//  screens it also exposes the hamburger that opens the Sidebar overlay.
//
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
              <span style={{ color: T.muted, display: "inline-flex" }}><Ico name="search" size={16} /></span>
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
                        {dept && <> · {dept.name}</>}
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
          <Ico name="search" size={14} />{!isMobile && <span style={{ fontSize: 12, color: T.muted }}>Search</span>}
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
          <span style={{ display: "inline-flex", color: "inherit" }}><Ico name={dark ? "sun" : "moon"} size={14} /></span>
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

// ─── GRC KRI DASHBOARD ───────────────────────────────────────────

// ─── DEPARTMENT VIEW ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
//  DEPARTMENT VIEW — single department's portfolio
// ════════════════════════════════════════════════════════════════════════════
//  Opens when the user clicks into a department from Home or the sidebar.
//  Shows a branded Hero (Dept IPI, status quad, top concern, budget bar),
//  then filters and a project table/card view of every project in that
//  department. Special case: deptId === "grc" routes to the GRC Dashboard.
//
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
  const [filterRoadmap, setFilterRoadmap] = useState(false);
  const [view, setView] = useState("table");

  const filtered = useMemo(() => deptProjects.filter(p => {
    const matchSearch  = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus  = filterStatus  === "All" || p.status     === filterStatus;
    const matchRisk    = filterRisk    === "All" || deriveRiskLevel(p) === filterRisk;
    const matchType    = filterType    === "All" || p.projectType === filterType;
    const matchRoadmap = !filterRoadmap || p.isRoadmap === true;
    return matchSearch && matchStatus && matchRisk && matchType && matchRoadmap;
  }), [deptProjects, search, filterStatus, filterRisk, filterType, filterRoadmap]);

  if (!dept) return <div style={{ padding: 32 }}>Department not found</div>;

  if (deptId === "grc") {
    const isGRCDeptHead = userRole === ROLE_DEPT_HEAD && (userDeptId || "").split(",").map(s => s.trim().toLowerCase()).includes("grc");
    // PMO Head/Staff included: they oversee governance — blocking them while
    // executives could see it was an inconsistency caught in the role audit.
    const canViewGRC = userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF || userRole === ROLE_GRC || userRole === ROLE_GRC_ADMIN || userRole === ROLE_EXEC || isGRCDeptHead;
    if (!canViewGRC) return (
      <div style={{ padding: 64, textAlign: "center" }}>
        <div style={{ marginBottom: 16 }}><Ico name="lock" size={44} color="#dc2626" strokeWidth={1.2} /></div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>Access Restricted</div>
        <div style={{ fontSize: 13, color: T.muted }}>GRC Dashboard is only available to authorized GRC personnel.</div>
      </div>
    );
    return <GRCDashboard canEdit={userRole === ROLE_ADMIN || userRole === ROLE_GRC_ADMIN} />;
  }

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const isNarrow = bp === "mobile" || bp === "tablet";

  // ── Hero data ────────────────────────────────────────────────
  const deptIPI     = calcDeptIPI(deptId, projects);
  const ipiBand     = deptIPI != null ? ipiColor(deptIPI)     : null;
  const ipiBandDark = deptIPI != null ? ipiColorDark(deptIPI) : null;
  const total      = stats.total || 0;
  const onTrackN   = stats.onTrack   || 0;
  const atRiskN    = stats.atRisk    || 0;
  const delayedN   = stats.delayed   || 0;
  const doneN      = stats.completed || 0;
  const notStartedN = Math.max(0, total - onTrackN - atRiskN - delayedN - doneN);
  const highRiskN  = deptProjects.filter(p => { const rl = deriveRiskLevel(p); return rl === "Critical" || rl === "High"; }).length;
  const totalBudget = deptProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalCost   = deptProjects.reduce((s, p) => s + (p.actualCost || 0), 0);
  const utilPct     = totalBudget ? Math.round((totalCost / totalBudget) * 100) : 0;
  const topConcern  = deptProjects
    .map(p => {
      const rl = deriveRiskLevel(p);
      let score = 0;
      if (p.status === "Delayed") score += 100;
      if (rl === "Critical") score += 50;
      else if (rl === "High") score += 25;
      return { p, rl, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
  // One-sentence summary line under the hero header.
  let heroNarrative;
  if (total === 0) heroNarrative = "No projects in this department yet.";
  else {
    const bits = [`${total} ${total === 1 ? "project" : "projects"}`];
    if (delayedN > 0) bits.push(`${delayedN} delayed`);
    if (atRiskN > 0)  bits.push(`${atRiskN} at risk`);
    if (highRiskN > 0) bits.push(`${highRiskN} carrying high/critical risks`);
    if (delayedN === 0 && atRiskN === 0 && highRiskN === 0) bits.push("all healthy");
    heroNarrative = bits.join(" · ") + ".";
  }

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>

      {/* ══════ HERO ══════ */}
      <div style={{
        background:
          "radial-gradient(circle at 88% 18%, rgba(0,255,179,0.10) 0%, transparent 42%), " +
          "radial-gradient(circle at 12% 88%, rgba(0,255,179,0.06) 0%, transparent 38%), " +
          "linear-gradient(135deg, #001f1a 0%, #003932 50%, #006b56 100%)",
        color: "white",
        borderRadius: 20,
        padding: bp === "mobile" ? "20px 22px" : "28px 36px 30px",
        position: "relative", overflow: "hidden",
        borderBottom: "4px solid #00FFB3",
        marginBottom: 24,
      }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, position: "relative", zIndex: 2, gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, background: "rgba(0,255,179,0.18)", border: "1px solid rgba(0,255,179,0.35)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, fontWeight: 800, color: "#00FFB3", letterSpacing: "0.02em", flexShrink: 0 }}>
              {(dept.name || "?").split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w[0] || "")).slice(0, 2).map(w => w[0].toUpperCase()).join("")}
            </div>
            <div>
              <div style={{ color: "#00FFB3", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 3 }}>Department</div>
              <h1 style={{ fontSize: bp === "mobile" ? 22 : 28, fontWeight: 800, color: "white", lineHeight: 1.05, letterSpacing: "-0.5px", margin: 0 }}>{dept.name}</h1>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 3 }}>Project Portfolio · {total} {total === 1 ? "project" : "projects"}</div>
            </div>
          </div>
          <img src="/tree-logo.png" alt="Tree" style={{ height: 34, opacity: 0.95 }} />
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "320px 1fr", gap: 36, alignItems: "center", position: "relative", zIndex: 2 }}>

          {/* IPI block */}
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>Department IPI</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: bp === "mobile" ? 72 : 100, fontWeight: 900, color: "white", lineHeight: 0.85, letterSpacing: "-4px" }}>{deptIPI ?? "—"}</div>
              {ipiBand && ipiBandDark && <div style={{ background: ipiBandDark.bg, border: `1px solid ${ipiBandDark.border}`, color: ipiBandDark.text, padding: "3px 11px", borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>● {ipiBand.label}</div>}
            </div>
            {deptIPI != null && (
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 9, background: "rgba(255,255,255,0.08)", borderRadius: 4.5, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, deptIPI)}%`, background: `linear-gradient(90deg, ${ipiBandDark.gaugeFrom}, ${ipiBandDark.gaugeTo})`, borderRadius: 4.5 }} />
                  <div style={{ position: "absolute", left: "70%", top: -3, width: 1, height: 15, background: "rgba(255,255,255,0.25)" }} />
                  <div style={{ position: "absolute", left: "90%", top: -3, width: 1, height: 15, background: "rgba(255,255,255,0.25)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                  <span>0</span><span>At Risk · 70</span><span>Watch · 90</span><span>100</span>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{heroNarrative}</div>

            {/* Status quad */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { l: "On Track",  v: onTrackN, c: onTrackN > 0 ? "#86efac" : "white" },
                { l: "At Risk",   v: atRiskN,  c: atRiskN > 0 ? "#fcd34d" : "white" },
                { l: "Delayed",   v: delayedN, c: delayedN > 0 ? "#fca5a5" : "white" },
                { l: "Completed", v: doneN,    c: doneN > 0 ? "#93c5fd" : "white" },
              ].map(s => (
                <div key={s.l} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
                  <div style={{ color: s.c, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Top concern callout — names the project, not the severity count */}
            {topConcern && (
              <div onClick={() => setRoute({ view: "project", projectId: topConcern.p.id, from: "department", deptId })} style={{
                background: "rgba(255,80,0,0.10)", border: "1px solid rgba(255,80,0,0.30)", borderLeft: "3px solid #FF5000",
                borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", display: "inline-block", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#ffa07a", fontSize: 9, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 2 }}>Top concern in this dept</div>
                  <div style={{ color: "white", fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topConcern.p.code} · {topConcern.p.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10.5, marginTop: 1 }}>
                    {[
                      topConcern.p.status === "Delayed" ? `Delayed${topConcern.p.daysDelayed > 0 ? ` ${topConcern.p.daysDelayed}d` : ""}` : null,
                      topConcern.rl === "Critical" ? "Critical risk" : topConcern.rl === "High" ? "High risk" : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span style={{ color: "#00FFB3", fontSize: 15 }}>→</span>
              </div>
            )}

            {/* Status mix + budget — single inline strip */}
            <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Status mix</div>
                <div style={{ display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                  {onTrackN > 0   && <div style={{ background: "#22c55e", flex: onTrackN }} />}
                  {atRiskN > 0    && <div style={{ background: "#eab308", flex: atRiskN }} />}
                  {delayedN > 0   && <div style={{ background: "#FF5000", flex: delayedN }} />}
                  {doneN > 0      && <div style={{ background: "#3b82f6", flex: doneN }} />}
                  {notStartedN > 0 && <div style={{ background: "#A1B9AB", flex: notStartedN }} />}
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                  Avg progress <strong style={{ color: "white", fontWeight: 800 }}>{stats.health || 0}%</strong>
                  {highRiskN > 0 && <span> · <strong style={{ color: "#fca5a5", fontWeight: 800 }}>{highRiskN}</strong> high-risk</span>}
                </div>
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>Budget · {utilPct}% used</div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, utilPct)}%`, background: utilPct > 90 ? "#dc2626" : utilPct > 75 ? "#f59e0b" : "#00FFB3", borderRadius: 4 }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                  <strong style={{ color: "white", fontWeight: 800 }}>{fmtSAR(totalCost)}</strong> of <strong style={{ color: "white", fontWeight: 800 }}>{fmtSAR(totalBudget)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
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
        <button onClick={() => setFilterRoadmap(v => !v)} style={{ background: filterRoadmap ? T.primary : T.surface, color: filterRoadmap ? "#fff" : T.muted, border: `1px solid ${filterRoadmap ? T.primary : T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: filterRoadmap ? 700 : 400 }}>
          <Ico name="map" size={13} /> Roadmap{filterRoadmap ? " ✓" : ""}
        </button>
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
                {["Code", "Project Name", "PM", "Type", "Progress", "Status", "IPI", "Risk", "Budget Status", "Gate", "Last Update"].map(h => (
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</span>
                      {p.isRoadmap && <span style={{ fontSize: 9, fontWeight: 800, background: T.primary, color: "#fff", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>ROADMAP</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.sponsor}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", minWidth: 100 }}>
                    {(() => { const ep = effectiveProgress(p); return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><Progress value={ep} height={5} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.text, minWidth: 30 }}>{ep}%</span>
                      </div>
                    ); })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    {(() => { const ipiVal = calcProjectIPI(p); const sc = ipiColor(ipiVal); return <span style={{ background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{ipiVal ?? "—"}</span>; })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={deriveRiskLevel(p)} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ color: deriveBudgetStatus(p) === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{deriveBudgetStatus(p)}</span>
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
              <p style={{ margin: "0 0 14px", fontSize: 12, color: T.muted }}>PM: {p.pm} · {p.gate}</p>
              {(() => { const ep = effectiveProgress(p); return <>
                <Progress value={ep} height={6} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>Progress</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{ep}%</span>
                </div>
              </>; })()}
              <div style={{ display: "flex", gap: 8 }}>
                <RiskBadge level={deriveRiskLevel(p)} />
                <span style={{ fontSize: 11, color: deriveBudgetStatus(p) === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600, padding: "2px 8px", background: deriveBudgetStatus(p) === "Over Budget" ? "#fee2e2" : "#dcfce7", borderRadius: 10 }}>{deriveBudgetStatus(p)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── UPDATE PANEL ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
//  UPDATE PANEL — side drawer the PM uses to push a project update
// ════════════════════════════════════════════════════════════════════════════
//  Tabbed editor: Status, Financials, Activities, Risks, Benefits, Documents,
//  Note. Progress is auto-derived from the Activities tab (WBS rollup) and is
//  read-only here. Status is derived too — from IPI + dates + activities — so
//  the field surfaces the computed value rather than letting the PM override.
//
const UpdatePanel = ({ project, onClose, onSubmit, userRole = ROLE_PM }) => {
  const T = useT();
  const [tab, setTab]                 = useState("Status");
  const [phase, setPhase]             = useState(project.phase || "Execution");
  const [gate, setGate]               = useState(project.gate || "");
  const [priority, setPriority]       = useState(project.priority || "Medium");
  const [plannedProgress, setPlanned] = useState(project.plannedProgress ?? 0);
  const [startDate, setStartDate]       = useState(project.startDate || "");
  const [plannedEnd, setPlannedEnd]     = useState(project.plannedEnd || "");
  const [roadmapDeadline, setRoadmap]   = useState(project.roadmapDeadline || "");
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
  const [documents, setDocuments] = useState(project.documents?.map(d => ({ ...d })) || []);

  // Actual Progress is derived — WBS rollup if any milestones exist, otherwise
  // the project's stored legacy progress value. Never user-edited from this panel.
  const autoProgress = useMemo(() => {
    const wbs = calcProjectProgressFromWBS({ milestones });
    return wbs != null ? wbs : (project.progress ?? 0);
  }, [milestones, project.progress]);

  // Status is also derived — from IPI + dates + activities. PMO retains a manual
  // override on the admin Edit Project form for context the math can't see
  // (e.g. sponsor freeze, regulator pause). From the Update panel, it's read-only.
  const derivedStatus = useMemo(() => {
    const synthetic = { ...project, milestones, plannedEnd, gate, documents, budget, actualCost, progress: autoProgress };
    return deriveProjectStatus(synthetic);
  }, [project, milestones, plannedEnd, gate, documents, budget, actualCost, autoProgress]);
  const TABS = [
    { key: "Status",     icon: "gauge" },
    { key: "Financials", icon: "coins" },
    { key: "Activities", icon: "target" },
    { key: "Risks",      icon: "alert" },
    { key: "Benefits",   icon: "trend" },
    { key: "Documents",  icon: "doc" },
    { key: "Note",       icon: "note" },
  ];

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      // Both progress AND status are derived in this panel — Activities tab and
      // the performance signals (IPI, dates) are the single sources of truth.
      await onSubmit(project.id, {
        status: derivedStatus.status, phase, gate, priority, progress: autoProgress, plannedProgress, startDate, plannedEnd,
        roadmapDeadline,
        health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
        milestones, risks, benefits, documents, note,
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
          {(() => {
            const sc = statusColor[derivedStatus.status] || { bg: T.bg, text: T.muted, dot: T.border };
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: sc.bg, color: sc.text, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800, border: `2px solid ${sc.dot}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                  {derivedStatus.status}
                </div>
                <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic", letterSpacing: "0.04em" }}>
                  Auto · {derivedStatus.reason}
                </span>
              </div>
            );
          })()}
          <div style={{ fontSize: 10, color: T.muted, marginTop: 8, opacity: 0.7 }}>
            Override available to PMO in the Edit Project form when there's external context (e.g. sponsor freeze) the math can't see.
          </div>
        </div>
        <div>
          <SL>CLASSIFICATION</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>Current Gate</FL><select value={gate} onChange={e => setGate(e.target.value)} style={ss}>{["Gate 1","Gate 2","Gate 3","Gate 4","Gate 5"].map(o => <option key={o}>{o}</option>)}</select></div>
            <div><FL>Priority</FL><select value={priority} onChange={e => setPriority(e.target.value)} style={ss}>{["Low","Medium","High","Critical"].map(o => <option key={o}>{o}</option>)}</select></div>
          </div>
        </div>
        <div>
          <SL>PROGRESS</SL>
          {/* Actual — READ ONLY, auto from Activities. The Activities tab is the
              single source of truth; this bar mirrors it so PM/PMO see the
              current rolled-up % without an editable control that would lie. */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginBottom: 6 }}>
              <span>
                Actual Progress
                <span style={{ marginLeft: 6, fontSize: 10, fontStyle: "italic", opacity: 0.7 }}>
                  · auto from Activities
                </span>
              </span>
              <span style={{ color: T.primary, fontWeight: 900 }}>{autoProgress}%</span>
            </div>
            <div style={{ height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${autoProgress}%`, height: "100%", background: T.primary, transition: "width 0.3s" }} />
            </div>
            {milestones.length === 0 && (
              <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 5, opacity: 0.8 }}>
                Add activities in the Activities tab to drive this automatically.
              </div>
            )}
          </div>
          {/* Planned — MANUAL. Slider for quick adjustment, number input for precision. */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: T.muted }}>
                Planned Progress
                <span style={{ marginLeft: 6, fontSize: 10, fontStyle: "italic", opacity: 0.7 }}>
                  · manual
                </span>
              </span>
              <input
                type="number" min={0} max={100} value={plannedProgress}
                onChange={e => setPlanned(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                style={{ width: 64, padding: "3px 8px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 700, color: T.muted, background: T.inputBg, textAlign: "right", outline: "none" }}
              />
            </div>
            <input type="range" min={0} max={100} value={plannedProgress} onChange={e => setPlanned(Number(e.target.value))} style={{ width: "100%", accentColor: T.muted, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginTop: 3 }}><span>0%</span><span>50%</span><span>100%</span></div>
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
          <SL>PERFORMANCE INDICES (AUTO-CALCULATED)</SL>
          {(() => {
            const r = calcProjectIPIFull({ ...project, budget, actualCost, progress: autoProgress, milestones });
            const spiV = r.components.spiFinal ?? r.components.spi;
            const cpiV = r.components.cpi;
            const spiC = spiV == null ? T.muted : spiV >= 1 ? "#16a34a" : "#dc2626";
            const cpiC = cpiV == null ? T.muted : cpiV >= 1 ? "#16a34a" : "#dc2626";
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: T.bg, borderRadius: 8, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: spiC }}>{spiV != null ? spiV.toFixed(2) : "—"}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>SPI {r.components.penalty < 1 ? `(×${r.components.penalty.toFixed(2)} penalty)` : ""}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>From milestone progress</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 8, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: cpiC }}>{cpiV != null ? cpiV.toFixed(2) : "—"}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>CPI</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>BCWP / Actual Cost</div>
                </div>
              </div>
            );
          })()}
        </div>
        <div>
          <SL>SCHEDULE VARIANCE</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><FL>Days Remaining</FL>{numInput(daysRemaining, setDaysRemaining)}</div>
            <div><FL>Days Delayed</FL>{numInput(daysDelayed, setDaysDelayed)}</div>
          </div>
        </div>
        {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF) && (
          <div>
            <SL>ROADMAP (PMO ONLY)</SL>
            <div><FL>Roadmap Deadline</FL>
              <input type="date" value={roadmapDeadline} onChange={e => setRoadmap(e.target.value)} style={s} />
            </div>
          </div>
        )}
      </div>
    );

    if (tab === "Activities") return <MilestoneListEditor items={milestones} onChange={setMilestones} />;
    if (tab === "Risks")      return <RiskListEditor      items={risks}      onChange={setRisks} />;
    if (tab === "Benefits")   return <BenefitListEditor   items={benefits}   onChange={setBenefits} />;

    if (tab === "Documents") {
      // Update Panel is for status changes only. Adding documents, editing
      // links, changing gates, and toggling IPI inclusion all live on the
      // full Edit Project page (Admin / PMO only). Here all roles can move
      // documents through the status workflow; non-admin tiers see a
      // restricted set of statuses.
      const isPMTier = userRole === ROLE_PM || userRole === ROLE_DEPT_HEAD;
      const docOpts  = isPMTier
        ? ["Pending", "Draft", "Submitted"]
        : ["Pending", "Draft", "Under Review", "Submitted", "Received", "Current", "Approved", "Final"];

      return (
      <div>
        <SL>DOCUMENT STATUS</SL>
        {documents.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>No documents on this project yet.</div>}
        {documents.map((doc, i) => {
          const docLocked = isPMTier && !docOpts.includes(doc.status);
          return (
          <div key={doc.id || i} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {doc.type}
                  {doc.required && <> · Required · <span style={{ color: T.accent, fontWeight: 700 }}>Due at Gate {doc.requiredAtGate || 1}</span></>}
                </div>
              </div>
              {doc.url && (
                <a href={doc.url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: T.accent, fontWeight: 700, whiteSpace: "nowrap" }}>
                  Open ↗
                </a>
              )}
              <select value={doc.status || "Pending"}
                disabled={docLocked}
                onChange={e => setDocuments(prev => prev.map((d, j) => j === i ? { ...d, status: e.target.value, lastUpdated: new Date().toISOString().split("T")[0] } : d))}
                style={{ ...ss, width: 140, fontSize: 12, opacity: docLocked ? 0.6 : 1, cursor: docLocked ? "not-allowed" : "pointer" }}>
                {(docLocked ? [doc.status] : docOpts).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
          );
        })}
        <div style={{ marginTop: 14, padding: "10px 12px", background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 8, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
          To add a new document, change its SharePoint link, or change which gate it&apos;s due at — open <strong>Edit Project</strong> (Admin / PMO only).
        </div>
      </div>
      );
    }

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
                color: tab === t.key ? T.primary : T.muted,
                display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Ico name={t.icon} size={13} /> {t.key}
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

// ─── MILESTONE GANTT ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
//  MILESTONE GANTT — the Activities-tab chart
// ════════════════════════════════════════════════════════════════════════════
//  Renders the project schedule as a horizontal Gantt. Milestones are diamonds,
//  activities are bars (with their parent milestone shown via a dashed connector).
//  Past time is faded with a soft Lichen mist; a sea-green Today marker cuts
//  across the chart. Overdue bars turn maroon and carry an OVERDUE chip.
//
const MilestoneGantt = ({ milestones: rawMilestones, project }) => {
  const T = useT();

  // ── Group into WBS order: each milestone followed by its activities (children).
  // Top-level items (parentId null/missing) are milestones; rest are activities.
  const tops = rawMilestones.filter(m => !m.parentId);
  const childrenOf = (id) => rawMilestones.filter(m => m.parentId === id);
  const ordered = [];
  tops.forEach(m => {
    ordered.push({ ...m, _isMilestone: true });
    childrenOf(m.id).forEach(c => ordered.push({ ...c, _isMilestone: false }));
  });
  // Append any orphan activities (parentId set but parent missing) at the end
  rawMilestones.forEach(m => {
    if (m.parentId && !tops.some(t => t.id === m.parentId) && !ordered.some(o => o.id === m.id)) {
      ordered.push({ ...m, _isMilestone: false });
    }
  });

  // ── Infer startDate for ACTIVITIES only, so they render as bars not diamonds.
  // Top-level milestones with a single date stay as diamonds — that's the user's
  // explicit intent when leaving the optional Start field blank.
  const milestones = ordered.map((m, i) => {
    if (m._isMilestone || m.startDate || !m.date) return m;
    const prevEnd  = i > 0 ? (ordered[i - 1].date || ordered[i - 1].startDate) : null;
    const projStart = project?.startDate;
    let inferred = null;
    if (prevEnd && prevEnd < m.date)  inferred = prevEnd;
    else if (projStart && projStart < m.date) inferred = projStart;
    else {
      const fb = new Date(m.date);
      fb.setDate(fb.getDate() - 14);
      inferred = fb.toISOString().split("T")[0];
    }
    return { ...m, startDate: inferred };
  });

  const withDates = milestones.filter(m => m.startDate || m.date);
  if (withDates.length === 0) return null;

  const allDates = milestones.flatMap(m => [m.startDate, m.date].filter(Boolean)).sort();
  let spanStart = allDates[0];
  let spanEnd   = allDates[allDates.length - 1];
  if (project?.startDate  && project.startDate  < spanStart) spanStart = project.startDate;
  if (project?.plannedEnd && project.plannedEnd  > spanEnd)  spanEnd   = project.plannedEnd;

  const t0   = new Date(spanStart).getTime() - 7 * 86_400_000;
  const t1   = new Date(spanEnd).getTime()   + 7 * 86_400_000;
  const span = t1 - t0;
  const toPct = d => d ? Math.max(0, Math.min(100, ((new Date(d).getTime() - t0) / span) * 100)) : null;
  const todayPct = toPct(TODAY);
  const hasReplan = milestones.some(m => m.prevDate && m.date);

  const ticks = [];
  const cur = new Date(t0);
  cur.setDate(1);
  while (cur.getTime() <= t1) {
    ticks.push({ p: toPct(cur.toISOString().slice(0, 10)), label: cur.toLocaleString("en-GB", { month: "short", year: "2-digit" }) });
    cur.setMonth(cur.getMonth() + 1);
  }

  // v2 brand recolor: green families for done/in-flight, Tree orange for late.
  const SC = {
    Completed:     { track: "#e0f8ee", fill: "#007a62", border: "#00614d", lbl: "#00432f" },
    "In Progress": { track: "#dff7ef", fill: "#00b894", border: "#009677", lbl: "#00432f" },
    Delayed:       { track: "#ffe8de", fill: "#FF5000", border: "#cc4000", lbl: "#7c2d12" },
    Upcoming:      { track: "#f0f4f0", fill: "#a1b9ab", border: "#8aa093", lbl: "#3a5547" },
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px 14px", marginBottom: 20, overflowX: "auto" }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: T.text, marginBottom: 12 }}>Gantt Chart</div>
      <div style={{ minWidth: 640 }}>

        {/* Month labels — full-width axis, no name column */}
        <div style={{ position: "relative", height: 20, marginBottom: 4 }}>
          {ticks.map((t, i) => (
            <div key={i} style={{ position: "absolute", left: `${t.p}%`, transform: "translateX(-50%)", fontSize: 9, color: T.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</div>
          ))}
        </div>

        {/* Executive rows: the activity name lives INSIDE its bar (or beside
            the marker when the bar is too narrow) so the chart presents
            without a legend column. Date labels carry replan memory —
            struck old date + current date when the finish was moved. */}
        {milestones.map((m, i) => {
          const sc  = SC[m.status] || SC.Upcoming;
          const isOverdue = m.status !== "Completed" && m.date && m.date < TODAY;
          const c   = isOverdue ? SC.Delayed : sc;
          const sp  = toPct(m.startDate || m.date);
          const ep  = toPct(m.date      || m.startDate);
          const hasDuration = !!(m.startDate && m.date && m.startDate !== m.date);
          const left  = sp != null ? Math.min(sp, ep ?? sp) : (ep ?? 0);
          const right = ep != null ? Math.max(ep, sp ?? ep) : (sp ?? 0);
          const width = Math.max(right - left, 1.2);
          // Milestone rows: derive progress from children (matches the editor)
          const kids = m._isMilestone ? rawMilestones.filter(c => c.parentId === m.id) : [];
          const pct = m._isMilestone && kids.length > 0
            ? (() => { const w = kids.reduce((s, c) => s + (c.weight || 1), 0); return w ? Math.round(kids.reduce((s, c) => s + (c.weight || 1) * (c.progress || 0), 0) / w) : 0; })()
            : (m.progress ?? (m.status === "Completed" ? 100 : 0));
          const isMs = m._isMilestone;
          const isDiamond = isMs && !hasDuration;
          const name = m.name || (isMs ? "(unnamed milestone)" : "(activity)");
          const fitsInside = !isDiamond && width > name.length * 0.65 + 6;
          const fmtD = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          const dateLbl = m.date ? (
            <span style={{ fontSize: 9, fontWeight: 700, color: T.muted, whiteSpace: "nowrap" }}>
              {m.prevDate && <s style={{ color: "#dc2626", marginRight: 4, opacity: 0.85 }}>{fmtD(m.prevDate)}</s>}
              {fmtD(m.date)}
            </span>
          ) : null;
          const nearRightEdge = right > 80;
          const outerStyle = {
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: isMs ? 11 : 10, fontWeight: isMs ? 800 : 600,
            color: sp == null && ep == null ? T.muted : T.text,
            whiteSpace: "nowrap", zIndex: 4,
            ...(nearRightEdge
              ? { right: `calc(${100 - left}% + ${isDiamond ? 16 : 8}px)` }
              : { left: `calc(${right}% + ${isDiamond ? 16 : 8}px)` }),
          };

          return (
            <div key={m.id || i} style={{
              position: "relative",
              height: isMs ? 36 : 30,
              borderTop: `1px solid ${T.border}`,
              background: isMs ? `${T.primary}06` : "transparent",
            }} title={m.name}>
              {ticks.map((t, ti) => (
                <div key={ti} style={{ position: "absolute", left: `${t.p}%`, top: 0, bottom: 0, width: 1, background: T.border, opacity: 0.4 }} />
              ))}
              {todayPct != null && (
                <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: "#00b894", boxShadow: "0 0 6px rgba(0,184,148,0.6)", zIndex: 3 }} />
              )}
              {sp == null && ep == null ? (
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 8, fontSize: 10.5, fontWeight: isMs ? 800 : 600, color: T.muted }}>
                  {name} <span style={{ fontStyle: "italic", fontWeight: 500 }}>— no dates</span>
                </div>
              ) : isDiamond ? (
                <>
                  <div style={{ position: "absolute", left: `calc(${left}% - 9px)`, top: 9, width: 18, height: 18, background: c.fill, border: `2px solid ${c.border}`, borderRadius: 3, transform: "rotate(45deg)", zIndex: 2 }} />
                  <span style={outerStyle}>{name}{dateLbl}</span>
                </>
              ) : (
                <>
                  <div style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: isMs ? 6 : 5, height: isMs ? 24 : 20, background: c.track, border: `1.5px solid ${c.border}`, borderRadius: isMs ? 5 : 4, overflow: "hidden", zIndex: 1 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: c.fill, opacity: 0.9 }} />
                    {fitsInside && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 8px" }}>
                        <span style={{ fontSize: isMs ? 10.5 : 10, fontWeight: 800, color: c.lbl, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: c.lbl, flexShrink: 0 }}>{pct}%</span>
                      </div>
                    )}
                  </div>
                  <span style={outerStyle}>
                    {!fitsInside && <span>{name} · {pct}%</span>}
                    {dateLbl}
                  </span>
                </>
              )}
            </div>
          );
        })}

        {/* Today label */}
        {todayPct != null && (
          <div style={{ position: "relative", height: 16 }}>
            <div style={{ position: "absolute", left: `${todayPct}%`, transform: "translateX(-50%)", fontSize: 9, color: T.accent, fontWeight: 800, whiteSpace: "nowrap" }}>▲ Today</div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          {[["#007a62","Completed"],["#00b894","In Progress"],["#FF5000","Delayed / Overdue"],["#a1b9ab","Upcoming"]].map(([col, lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
              <div style={{ width: 14, height: 8, background: col, borderRadius: 2 }} />
              {lbl}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
            <div style={{ width: 2, height: 14, background: T.accent, borderRadius: 1 }} />
            Today
          </div>
          {hasReplan && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
              <s style={{ color: "#dc2626", fontWeight: 700 }}>old</s> new = date replanned
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── PROJECT DASHBOARD ────────────────────────────────────────────
const PROJECT_TABS_ADMIN = ["Exec Summary", "Overview", "Activities", "Budget", "Risks & Issues", "Benefits", "Documents", "Updates"];
const PROJECT_TABS_PM    = ["Overview", "Activities", "Risks & Issues", "Benefits", "Documents"];
const PROJECT_TABS_EXEC  = ["Exec Summary"];

// ════════════════════════════════════════════════════════════════════════════
//  PROJECT VIEW — single-project detail page
// ════════════════════════════════════════════════════════════════════════════
//  The deepest screen in the portal. Header carries the project name,
//  status chip, IPI banner (Progress + IPI Score side by side with the
//  SPI/CPI/MCI breakdown), and the action buttons (Update, Edit Fields,
//  Print Report). Below the header is a tab strip — Exec Summary, Overview,
//  Activities (Gantt), Budget, Risks & Issues, Benefits, Documents, Updates.
//  Roles other than admin/PMO see a read-only version.
//
const ProjectView = ({ projects, projectId, setRoute, submitUpdate, savePMONote, userRole = ROLE_ADMIN }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const dark = themeStore.dark;
  const project = projects.find(p => p.id === projectId);

  const TABS = userRole === ROLE_PM ? PROJECT_TABS_PM
             : (userRole === ROLE_EXEC || userRole === ROLE_DEPT_HEAD) ? PROJECT_TABS_EXEC
             : PROJECT_TABS_ADMIN;
  const [tab, setTab] = useState(() => userRole === ROLE_PM ? "Overview" : "Exec Summary");

  const activeTab = TABS.includes(tab) ? tab : TABS[0];
  const [showUpdate, setShowUpdate] = useState(false);
  const canSeeNotes = userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF;
  const [noteEdit,   setNoteEdit]   = useState(false);
  const [noteDraft,  setNoteDraft]  = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  // Click-to-audit modals for the headline IPI and Progress numbers
  const [showIPIBreakdown,      setShowIPIBreakdown]      = useState(false);
  const [showProgressBreakdown, setShowProgressBreakdown] = useState(false);

  // ── IPI — must run before early return so hook call count is stable.
  // Headline number is the TIME-WEIGHTED IPI (matches dept/portfolio rollups so
  // the same project shows the same score wherever it appears). The SPI/CPI/MCI
  // breakdown beside it is from the current snapshot — clicking the headline
  // opens the audit modal which reconciles the two explicitly.
  const ipiResult     = project ? calcProjectIPIFull(project) : { ipi: 0 };
  const ipiSnapshot   = ipiResult.ipi;
  const ipiDisplay    = project ? calcProjectIPIDisplay(project) : { primary: 0, snapshot: 0, delta: 0, hasHistory: false };
  const ipi           = ipiDisplay.primary;
  const ipiC          = ipiColor(ipi);
  const countedIPI    = useCountUp(ipi);

  if (!project) return <div style={{ padding: 32 }}>Project not found</div>;

  const budgetUtil = project.budget > 0 ? Math.round((project.actualCost / project.budget) * 100) : 0;
  const remaining = project.budget - project.actualCost;
  // Project progress: derived from WBS (milestones × activities × weights) when
  // any milestones exist; falls back to the saved project.progress field.
  const wbsProgress = calcProjectProgressFromWBS(project);
  const effectiveProgress = wbsProgress != null ? wbsProgress : (project.progress ?? 0);

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const infoCols = bp === "mobile" ? "repeat(2, 1fr)" : bp === "tablet" ? "repeat(3, 1fr)" : "repeat(6, 1fr)";
  const overviewCols = bp === "mobile" || bp === "tablet" ? "1fr" : "2fr 1fr";

  // ── Print Report ─────────────────────────────────────────────
  // Opens a new window with an executive-grade project status report,
  // styled after the steering-committee printouts the company already uses.
  const printProjectReport = () => {
    const dept = departments.find(d => d.id === project.deptId);
    const deptName = dept?.name || "—";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

    // ── Timeline data
    const milestones = (project.milestones || []).filter(m => m.date || m.startDate);
    const allTs = milestones.flatMap(m => [m.startDate, m.date].filter(Boolean).map(d => new Date(d).getTime()));
    const spanStart = allTs.length ? Math.min(...allTs, new Date(project.startDate || allTs[0]).getTime()) : Date.now();
    const spanEnd   = allTs.length ? Math.max(...allTs, new Date(project.plannedEnd || allTs[0]).getTime()) : Date.now();
    const span = Math.max(1, spanEnd - spanStart);
    const todayMs = Date.now();
    const todayPct = Math.max(0, Math.min(100, ((todayMs - spanStart) / span) * 100));
    const toPct = (d) => d ? Math.max(0, Math.min(100, ((new Date(d).getTime() - spanStart) / span) * 100)) : 0;

    // ── Month tick marks for the timeline header
    const ticks = [];
    const cur = new Date(spanStart); cur.setDate(1);
    while (cur.getTime() <= spanEnd) {
      ticks.push({ p: toPct(cur.toISOString().slice(0,10)), label: cur.toLocaleString("en-GB", { month: "short", year: "2-digit" }) });
      cur.setMonth(cur.getMonth() + 1);
    }

    // ── Group items: top-level milestones first, activities indented underneath
    const tops = (project.milestones || []).filter(m => !m.parentId);
    const kidsOf = (id) => (project.milestones || []).filter(m => m.parentId === id);
    const ordered = [];
    tops.forEach(t => {
      ordered.push({ ...t, _isMs: true });
      kidsOf(t.id).forEach(k => ordered.push({ ...k, _isMs: false }));
    });

    // Gantt bar palette — universal PM convention with Tree brand accents:
    // blue for done, green for in-flight, grey for waiting, brand maroon for late.
    const sc = {
      "Completed":   { fill: "#3b82f6", border: "#1e40af", txt: "#fff" },     // Blue (universal "done")
      "In Progress": { fill: "#00FFB3", border: "#00b894", txt: "#003932" },  // Sea — Tree mint
      "Delayed":     { fill: "#490300", border: "#2c0200", txt: "#fff" },     // Maroon — Tree gravity
      "Upcoming":    { fill: "#A1B9AB", border: "#7a9485", txt: "#003932" },  // Moss — Tree neutral
    };
    // Executive layout: NO left label column — the activity name lives INSIDE
    // its bar (readable from the back of a boardroom), falling outside-right
    // only when the bar is too narrow. Date labels carry replan memory:
    // "18 Jun (struck) 19 Jun" when the finish date was moved.
    const hasReplan = ordered.some(m => m.prevDate && m.date);
    const rowsHtml = ordered.length === 0
      ? `<div class="empty">No activities recorded yet.</div>`
      : ordered.map(m => {
        const isOverdue = m.status !== "Completed" && m.date && m.date < TODAY;
        const c = isOverdue ? sc.Delayed : (sc[m.status] || sc.Upcoming);
        const left  = toPct(m.startDate || m.date);
        const right = toPct(m.date || m.startDate);
        const width = Math.max(1.5, right - left);
        const hasDuration = !!(m.startDate && m.date && m.startDate !== m.date);
        const pct = m._isMs && kidsOf(m.id).length > 0
          ? (() => { const k = kidsOf(m.id); const w = k.reduce((s,x)=>s+(x.weight||1),0); return w ? Math.round(k.reduce((s,x)=>s+(x.weight||1)*(x.progress||0),0)/w) : 0; })()
          : (m.progress ?? (m.status === "Completed" ? 100 : 0));
        const name = esc(m.name) || "(unnamed)";
        const nameLen = (m.name || "(unnamed)").length;
        const isDiamond = m._isMs && !hasDuration;
        const dateLbl = m.date
          ? `<span class="dt">${m.prevDate ? `<s>${fmtDate(m.prevDate)}</s>` : ""}${fmtDate(m.date)}</span>`
          : "";
        // ~10.4px per 1% of track width; 8px Inter ≈ 4.4px/char + pct chip room
        const fitsInside = !isDiamond && width > nameLen * 0.45 + 4;
        const nearRightEdge = right > 82;
        const outerPos = nearRightEdge
          ? `right:calc(${(100 - left).toFixed(2)}% + 10px)`
          : `left:calc(${right.toFixed(2)}% + ${isDiamond ? 12 : 6}px)`;
        let visual, outer;
        if (isDiamond) {
          visual = `<div class="diamond" style="left:calc(${left}% - 7px); background:${c.fill}; border-color:${c.border}"></div>`;
          outer  = `<span class="out-lbl ms" style="${outerPos}">${name} ${dateLbl}</span>`;
        } else if (fitsInside) {
          visual = `<div class="bar" style="left:${left}%; width:${width}%; background:${c.fill}; border-color:${c.border}"><span class="bar-name" style="color:${c.txt}">${name}</span><span class="bar-pct" style="color:${c.txt}">${pct}%</span></div>`;
          outer  = `<span class="out-lbl" style="${outerPos}">${dateLbl}</span>`;
        } else {
          visual = `<div class="bar" style="left:${left}%; width:${width}%; background:${c.fill}; border-color:${c.border}"></div>`;
          outer  = `<span class="out-lbl${m._isMs ? " ms" : ""}" style="${outerPos}">${name} · ${pct}% ${dateLbl}</span>`;
        }
        // Past-fade overlay: a soft Lichen mist over the days that have already
        // passed. Sits BELOW the bars so completed work stays crisp — gives the
        // timeline a real sense of time flowing forward.
        const pastFade = todayPct > 0.5
          ? `<div class="past-fade" style="width:${todayPct}%"></div>` : "";
        return `<div class="row ${m._isMs ? "ms" : "act"}">
          <div class="track">${pastFade}${ticks.map(t => `<div class="grid" style="left:${t.p}%"></div>`).join("")}${visual}${outer}<div class="today" style="left:${todayPct}%"></div></div>
        </div>`;
      }).join("");

    // ── Risks
    const openRisks = (project.risks || [])
      .filter(r => r.status !== "Closed" && r.status !== "Mitigated")
      .sort((a, b) => {
        const ord = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return (ord[b.level] || 0) - (ord[a.level] || 0);
      })
      .slice(0, 5);  // Top 5 only — keeps the page on one sheet
    // Severity chips — Tree palette mapping (Maroon = critical, Orange = high,
    // Moss = medium, Sea-tint = low). Light tinted backgrounds for readability.
    const riskColor = (lvl) => ({
      Critical: { bg: "#f0d4d0", txt: "#490300" },   // Maroon tint
      High:     { bg: "#ffd9c2", txt: "#FF5000" },   // Orange tint
      Medium:   { bg: "#dde7df", txt: "#3a5547" },   // Moss tint
      Low:      { bg: "#ccfff0", txt: "#003932" },   // Sea tint
    }[lvl] || { bg: "#C9D5C9", txt: "#475569" });
    const riskRows = openRisks.length === 0
      ? `<tr><td colspan="3" class="empty-cell">No open risks.</td></tr>`
      : openRisks.map(r => {
        const rc = riskColor(r.level);
        return `<tr>
          <td><span class="sev" style="background:${rc.bg}; color:${rc.txt}">${esc(r.level) || "—"}</span></td>
          <td class="risk-title">${esc(r.title) || "—"}</td>
          <td class="risk-mit">${esc(r.mitigation || r.action || "—")}</td>
        </tr>`;
      }).join("");

    // ── Recently completed activities (within last 30 days)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const completed = ordered
      .filter(m => m.status === "Completed" && m.date && new Date(m.date) >= thirtyDaysAgo)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 4);  // Cap at 4 — fits on one page
    const completedHtml = completed.length === 0
      ? `<div class="empty-sub">No activities completed in the last 30 days.</div>`
      : completed.map(m => `<div class="bullet">● <span>${esc(m.name)}</span> <em>${fmtDate(m.date)}</em></div>`).join("");

    // ── Upcoming (next 14 days)
    const inTwoWeeks = new Date(); inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
    const upcoming = ordered
      .filter(m => m.status !== "Completed" && m.date && new Date(m.date) >= now && new Date(m.date) <= inTwoWeeks)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .slice(0, 4);  // Cap at 4 — fits on one page
    const upcomingHtml = upcoming.length === 0
      ? `<div class="empty-sub">Nothing scheduled in the next 14 days.</div>`
      : upcoming.map(m => `<div class="bullet up">○ <span>${esc(m.name)}</span> <em>${fmtDate(m.date)}</em></div>`).join("");

    // Status chip — universal convention (blue/green/grey/red family)
    const statusStyle = {
      "On Track":   { bg: "#ccfff0", txt: "#003932", dot: "#00FFB3" },   // Sea green
      "At Risk":    { bg: "#ffd9c2", txt: "#FF5000", dot: "#FF5000" },   // Orange (warning)
      "Delayed":    { bg: "#f0d4d0", txt: "#490300", dot: "#490300" },   // Maroon (gravity)
      "Completed":  { bg: "#dbeafe", txt: "#1e40af", dot: "#3b82f6" },   // Blue (done)
      "Not Started":{ bg: "#C9D5C9", txt: "#3a5547", dot: "#A1B9AB" },   // Moss/Lichen
    }[project.status] || { bg: "#C9D5C9", txt: "#3a5547", dot: "#A1B9AB" };

    // ── Budget formatting
    const fmtSAR = (n) => "SAR " + (Number(n) || 0).toLocaleString("en-US");

    const html = `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>${esc(project.name)} — Status Report — ${dateStr}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #0d1f1c; background: #fff; line-height: 1.45; }
        @page { size: A4 landscape; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

        /* COMPACT layout — sized to fit one A4 landscape page (297×210mm). */
        /* Cover uses pure Canopy gradient with a Sea-tint halo */
        .cover { background: linear-gradient(135deg, #001f1a 0%, #003932 55%, #0a5448 100%); color: #fff; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; border-bottom: 3px solid #00FFB3; }
        .cover::after { content: ''; position: absolute; bottom: -60px; right: -60px; width: 220px; height: 220px; background: rgba(0,255,179,0.12); border-radius: 50%; }
        .cover .left .dept { font-size: 10px; color: #00FFB3; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 3px; opacity: 0.85; }
        .cover .left h1 { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 3px; }
        .cover .left .sub { opacity: 0.7; font-size: 10px; }
        .cover .right { position: relative; z-index: 2; }
        .status-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px; border-radius: 22px; font-size: 12px; font-weight: 800; background: ${statusStyle.bg}; color: ${statusStyle.txt}; }
        .status-chip .dot { width: 7px; height: 7px; border-radius: 50%; background: ${statusStyle.dot}; }

        /* KPI strip — compact tiles */
        .kpi-strip { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1px; background: #C9D5C9; border-bottom: 1px solid #C9D5C9; }
        .kpi-tile { background: #fff; padding: 9px 12px; }
        .kpi-tile .lbl { font-size: 8.5px; color: #3a5547; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 3px; }
        .kpi-tile .val { font-size: 13px; font-weight: 800; color: #003932; line-height: 1.15; }
        .kpi-tile .val.mono { font-family: 'JetBrains Mono', monospace; }
        .kpi-tile .sub { font-size: 9px; color: #7a9485; margin-top: 1px; }
        .progress-mini { height: 4px; background: #C9D5C9; border-radius: 3px; margin-top: 4px; overflow: hidden; }
        .progress-mini .fill { height: 100%; background: #00FFB3; border-radius: 3px; }

        section { padding: 12px 32px 0; }
        section .section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; border-bottom: 1.5px solid #003932; padding-bottom: 4px; }
        section h2 { font-size: 12px; font-weight: 900; color: #003932; letter-spacing: 0.06em; text-transform: uppercase; }
        section h2 .icon { color: #00FFB3; }
        section .head-meta { margin-left: auto; font-size: 9.5px; color: #7a9485; }

        /* ─── TIMELINE — executive full-width Gantt: names live INSIDE the bars ─── */
        .timeline { background: #fff; border: 1px solid #C9D5C9; border-radius: 8px; padding: 8px 12px; overflow: hidden; }
        .timeline .axis { margin-bottom: 4px; position: relative; height: 12px; }
        .timeline .axis .tick { position: absolute; transform: translateX(-50%); font-size: 8.5px; color: #7a9485; font-weight: 600; }
        .timeline .row { position: relative; height: 22px; border-top: 1px solid #ecf2ed; }
        .timeline .row.ms { background: rgba(0,57,50,0.04); height: 24px; }
        .timeline .row .track { position: absolute; inset: 0; }
        /* Past-fade: Lichen mist over days that have already passed. Sits at
           z-index 0 so bars (z:1) and diamonds (z:2) stay on top, crisp. The
           gradient fades to transparent right at the Today line. */
        .timeline .past-fade {
          position: absolute; top: 0; bottom: 0; left: 0;
          background: linear-gradient(90deg,
            rgba(161, 185, 171, 0.32) 0%,
            rgba(161, 185, 171, 0.20) 40%,
            rgba(161, 185, 171, 0.08) 80%,
            rgba(161, 185, 171, 0.00) 100%);
          pointer-events: none;
          z-index: 0;
        }
        .timeline .grid { position: absolute; top: 0; bottom: 0; width: 1px; background: #ecf2ed; z-index: 0; }
        .timeline .today {
          position: absolute; top: -2px; bottom: -2px; width: 2px;
          background: #00FFB3; box-shadow: 0 0 6px rgba(0,255,179,0.7); z-index: 4;
        }
        .timeline .bar { position: absolute; top: 3px; height: 15px; border: 1.5px solid; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 0 5px; z-index: 1; min-width: 3px; box-sizing: border-box; }
        .timeline .row.ms .bar { top: 3px; height: 17px; }
        .timeline .bar-name { font-size: 8px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.01em; }
        .timeline .row.ms .bar-name { font-size: 8.5px; }
        .timeline .bar-pct { font-size: 7.5px; font-weight: 800; flex-shrink: 0; opacity: 0.9; }
        .timeline .diamond { position: absolute; top: 5px; width: 11px; height: 11px; border: 1.5px solid; border-radius: 2px; transform: rotate(45deg); z-index: 2; }
        /* Outside labels — used for diamonds and bars too narrow to hold a name */
        .timeline .out-lbl { position: absolute; top: 50%; transform: translateY(-50%); font-size: 8px; font-weight: 600; color: #3a5547; white-space: nowrap; z-index: 3; }
        .timeline .out-lbl.ms { font-weight: 800; color: #003932; font-size: 8.5px; }
        /* Replan-aware date chip: struck old date in maroon-red, current date solid */
        .timeline .dt { font-family: 'JetBrains Mono', monospace; font-size: 7.5px; color: #003932; font-weight: 700; margin-left: 4px; }
        .timeline .dt s { color: #b91c1c; text-decoration-thickness: 1.5px; margin-right: 4px; font-weight: 600; opacity: 0.9; }
        .empty { padding: 22px; text-align: center; color: #7a9485; font-style: italic; font-size: 10.5px; }

        /* ─── BOTTOM GRID ─── compact */
        .bottom-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; padding: 12px 32px 0; }

        .risk-card { background: #fff; border: 1px solid #C9D5C9; border-radius: 8px; padding: 10px 12px; }
        .risk-card table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .risk-card th { background: #f4f7f4; padding: 5px 8px; text-align: left; font-size: 8.5px; font-weight: 700; color: #3a5547; text-transform: uppercase; letter-spacing: 0.04em; }
        .risk-card td { padding: 5px 8px; border-bottom: 1px solid #ecf2ed; vertical-align: top; line-height: 1.35; }
        .risk-card tr:last-child td { border-bottom: none; }
        .sev { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 9px; font-weight: 800; }
        .risk-title { font-weight: 600; color: #003932; font-size: 10px; }
        .risk-mit { color: #3a5547; font-size: 9.5px; }
        .empty-cell { text-align: center; color: #7a9485; font-style: italic; padding: 12px 0; }

        .right-stack { display: flex; flex-direction: column; gap: 10px; }
        .mini-card { background: #fff; border: 1px solid #C9D5C9; border-radius: 8px; padding: 10px 12px; }
        .mini-card .mini-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1.5px solid; }
        .mini-card.completed .mini-head { border-bottom-color: #3b82f6; }
        .mini-card.upcoming .mini-head  { border-bottom-color: #00FFB3; }
        .mini-card .mini-head h3 { font-size: 10px; font-weight: 800; color: #003932; letter-spacing: 0.06em; text-transform: uppercase; }
        .mini-card .mini-head .ic { font-size: 11px; }
        .mini-card.completed .mini-head .ic { color: #3b82f6; }
        .mini-card.upcoming .mini-head .ic  { color: #00b894; }
        .bullet { display: flex; align-items: baseline; gap: 6px; font-size: 10px; padding: 2px 0; color: #3b82f6; }
        .bullet.up { color: #00b894; }
        .bullet span { color: #003932; flex: 1; font-weight: 500; }
        .bullet em { color: #7a9485; font-style: normal; font-size: 9px; font-family: 'JetBrains Mono', monospace; }
        .empty-sub { color: #7a9485; font-style: italic; font-size: 9.5px; padding: 4px 0; }

        .footer { padding: 8px 32px 10px; border-top: 1px solid #C9D5C9; display: flex; justify-content: space-between; color: #7a9485; font-size: 9px; margin-top: 10px; }
      </style>
    </head><body>

      <!-- COVER -->
      <div class="cover">
        <div class="left">
          <div class="dept">${esc(deptName)} · Project Status Report</div>
          <h1>${esc(project.name)}</h1>
          <div class="sub">${esc(project.code)} · As of ${dateStr}</div>
        </div>
        <div class="right">
          <span class="status-chip"><span class="dot"></span>${esc(project.status)}</span>
        </div>
      </div>

      <!-- KPI STRIP -->
      <div class="kpi-strip">
        <div class="kpi-tile">
          <div class="lbl">PM</div>
          <div class="val">${esc(project.pm) || "—"}</div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">Progress</div>
          <div class="val mono">${effectiveProgress}%</div>
          <div class="progress-mini"><div class="fill" style="width:${effectiveProgress}%"></div></div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">Stage</div>
          <div class="val">${esc(project.gate || "—")}</div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">IPI Score</div>
          <div class="val mono" style="color:${ipiC.color}">${ipi ?? "—"}</div>
          <div class="sub">${esc(ipiC.label)}</div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">Budget</div>
          <div class="val mono">${project.budget ? fmtSAR(project.budget) : "—"}</div>
          ${project.actualCost ? `<div class="sub">${Math.round((project.actualCost/project.budget)*100)}% spent</div>` : ""}
        </div>
        <div class="kpi-tile">
          <div class="lbl">Start</div>
          <div class="val">${fmtDate(project.startDate)}</div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">Delivery</div>
          <div class="val">${fmtDate(project.plannedEnd)}</div>
        </div>
        <div class="kpi-tile">
          <div class="lbl">Sponsor</div>
          <div class="val">${esc(project.sponsor) || "—"}</div>
        </div>
      </div>

      <!-- TIMELINE -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span> Delivery Timeline</h2>
          <span class="head-meta">${ordered.length} item${ordered.length === 1 ? "" : "s"} · ▾ Today${hasReplan ? ` · <s style="color:#b91c1c">old</s> new = date replanned` : ""}</span>
        </div>
        <div class="timeline">
          ${ordered.length > 0 ? `<div class="axis">${ticks.map(t => `<div class="tick" style="left:${t.p}%">${t.label}</div>`).join("")}</div>` : ""}
          ${rowsHtml}
        </div>
      </section>

      <!-- BOTTOM GRID: Risks + Completed + Upcoming -->
      <div class="bottom-grid">
        <div class="risk-card">
          <div class="section-head" style="padding-bottom:0; border:none; margin-bottom:8px;">
            <h2><span class="icon">▸</span> Risks &amp; Issues</h2>
            <span class="head-meta">${openRisks.length} open · top by severity</span>
          </div>
          <table>
            <thead><tr><th style="width:80px">Severity</th><th>Risk / Issue</th><th>Mitigation</th></tr></thead>
            <tbody>${riskRows}</tbody>
          </table>
        </div>
        <div class="right-stack">
          <div class="mini-card completed">
            <div class="mini-head"><span class="ic">●</span><h3>Recently Completed</h3></div>
            ${completedHtml}
          </div>
          <div class="mini-card upcoming">
            <div class="mini-head"><span class="ic">○</span><h3>Next 14 Days</h3></div>
            ${upcomingHtml}
          </div>
        </div>
      </div>

      <div class="footer">
        <span>${esc(deptName)} · PMO Enterprise Portal · Tree Digital Insurance Company</span>
        <span>${dateStr}</span>
      </div>

    </body></html>`;

    const win = window.open("", "_blank", "width=1280,height=900");
    if (!win) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
    win.document.write(html);
    win.document.close();
  };

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      {showIPIBreakdown      && <IPIBreakdownModal      project={project} onClose={() => setShowIPIBreakdown(false)} />}
      {showProgressBreakdown && <ProgressBreakdownModal project={project} onClose={() => setShowProgressBreakdown(false)} />}
      {/* Project Header */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: bp === "mobile" ? "16px 18px" : "24px 28px", marginBottom: 24, color: T.headerText }}>
        {/* Top toolbar row — badges left, status + action buttons right.
            Sits on its own line so the long description below doesn't
            squeeze the buttons into a vertical waterfall. */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: T.accent, color: T.accentText, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{project.code}</span>
            {(() => { const sla = getGateSLA(project); return <span style={{ background: sla && sla.days > 30 ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>{project.gate}{sla && <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.9 }}>· Day {sla.days}</span>}</span>; })()}
            <span style={{ background: "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{project.priority}</span>
            <TypeBadge type={project.projectType || "Project"} />
            {project.isRoadmap && <span style={{ background: "rgba(255,255,255,0.2)", color: T.headerText, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5 }}><Ico name="map" size={12} /> Roadmap</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge status={project.status} />
            {(() => {
              const H = 36;
              const baseBtn = {
                height: H, padding: "0 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                boxSizing: "border-box", whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              };
              return (
                <>
                  {userRole !== ROLE_EXEC && userRole !== ROLE_DEPT_HEAD && userRole !== ROLE_PMO_STAFF && (
                    <button onClick={() => setShowUpdate(true)}
                      style={{ ...baseBtn, background: T.accent, color: T.accentText, border: "1px solid transparent", fontWeight: 800 }}>
                      <Ico name="pencil" size={13} /> Update
                    </button>
                  )}
                  {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF) && project.pmoStatus === "Submitted" && (
                    <button onClick={() => setRoute({ view: "actions" })}
                      style={{ ...baseBtn, background: "#f59e0b", color: "#fff", border: "1px solid transparent", fontWeight: 800 }}>
                      <Ico name="check" size={13} /> Validate
                    </button>
                  )}
                  {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && (
                    <button onClick={() => setRoute({ view: "form", mode: "edit", projectId: project.id, from: "project" })}
                      style={{ ...baseBtn, background: T.bg, color: T.muted, border: `1px solid ${T.border}`, fontWeight: 600 }}>
                      Edit Fields
                    </button>
                  )}
                  <button onClick={printProjectReport}
                    style={{ ...baseBtn, background: T.bg, color: T.muted, border: `1px solid ${T.border}`, fontWeight: 600 }}>
                    <Ico name="printer" size={13} /> Print Report
                  </button>
                </>
              );
            })()}
          </div>
        </div>
        {/* Title + description — full width on their own line.
            Description renders only when set, otherwise the title sits flush
            against the performance banner with no empty void. */}
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900 }}>{project.name}</h1>
        {project.objective && project.objective.trim() && (
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{project.objective}</p>
        )}
        {/* Performance row — three equal tiles: Progress · IPI · Snapshot */}
        {(() => {
          const plannedNow = plannedProgressAt(project);
          const progVar    = plannedNow != null ? effectiveProgress - plannedNow : null;
          const bandDark   = ipiColorDark(ipi);
          const trend      = ipiDisplay?.hasHistory ? ipiDisplay.delta : null;
          const spiF = ipiResult.components.spiFinal ?? ipiResult.components.spi;
          const cpiV = ipiResult.components.cpi;
          const mciV = ipiResult.components.mci;
          const numCol = (ok) => ok ? "#7dffd9" : "#ff9d7a";
          const ant  = calcAnticipatedMCI(project);
          const tileBase = { background: "rgba(0,0,0,0.28)", borderRadius: 12, padding: "16px 18px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" };
          return (
          <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr 1.4fr", gap: 14, marginTop: 20 }}>

            {/* Progress tile */}
            <button type="button" onClick={() => setShowProgressBreakdown(true)} title="Click to see the full progress calculation"
              style={{ ...tileBase, border: "1px solid rgba(0,184,148,0.3)", color: T.headerText }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,255,179,0.6)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,184,148,0.3)"}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#00ffb3" }}>Progress</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(0,255,179,0.7)" }}>AUDIT ↗</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{effectiveProgress}%</span>
                {progVar != null && progVar !== 0 && (
                  <span style={{ background: progVar < 0 ? "#ffe8de" : "#e0f8ee", color: progVar < 0 ? "#b23800" : "#007a62", fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 10, whiteSpace: "nowrap" }}>
                    {progVar < 0 ? "▼" : "▲"} {Math.abs(progVar)} pts vs plan
                  </span>
                )}
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 10, overflow: "visible", position: "relative" }}>
                <div style={{ height: "100%", width: `${effectiveProgress}%`, background: "#00ffb3", borderRadius: 3 }} />
                {plannedNow != null && <div style={{ position: "absolute", top: -2, bottom: -2, left: `${Math.min(100, plannedNow)}%`, width: 2, background: "rgba(255,255,255,0.55)" }} />}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                {wbsProgress != null ? "Auto-rolled from Activities" : "Manual entry"}{plannedNow != null ? ` · plan marker at ${plannedNow}%` : ""}
              </div>
            </button>

            {/* IPI tile */}
            <button type="button" onClick={() => setShowIPIBreakdown(true)} title="Click to see the full IPI calculation"
              style={{ ...tileBase, border: `1px solid ${bandDark.border}`, color: T.headerText }}
              onMouseEnter={e => e.currentTarget.style.borderColor = bandDark.text}
              onMouseLeave={e => e.currentTarget.style.borderColor = bandDark.border}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: bandDark.text }}>IPI Score</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: bandDark.text, opacity: 0.8 }}>AUDIT ↗</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: bandDark.text, lineHeight: 1 }}>{ipi == null ? "—" : countedIPI}</span>
                {ipiC && <span style={{ background: ipiC.bg, color: ipiC.color, fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 10, whiteSpace: "nowrap" }}>● {ipiC.label}</span>}
              </div>
              {ipi != null && (
                <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 10, overflow: "visible", position: "relative" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, ipi)}%`, background: `linear-gradient(90deg, ${bandDark.gaugeFrom}, ${bandDark.gaugeTo})`, borderRadius: 3 }} />
                  <div style={{ position: "absolute", top: -2, bottom: -2, left: "70%", width: 2, background: "rgba(255,255,255,0.4)" }} />
                  <div style={{ position: "absolute", top: -2, bottom: -2, left: "90%", width: 2, background: "rgba(255,255,255,0.4)" }} />
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                {trend != null && trend !== 0 ? `${trend < 0 ? "▼" : "▲"} ${Math.abs(trend)} vs last month · ` : ""}90-day weighted
              </div>
              <div style={{ marginTop: 8 }}><ScoreChips result={ipiResult} size="md" onDark /></div>
            </button>

            {/* Snapshot tile */}
            <div style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                Current snapshot{ipiSnapshot != null ? ` · IPI ${ipiSnapshot}` : ""}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { v: spiF, label: "SPI × 50%", ok: spiF != null && spiF >= 0.9, txt: spiF != null ? spiF : "—" },
                  { v: cpiV, label: "CPI × 25%", ok: cpiV != null && cpiV >= 1, txt: cpiV != null ? cpiV : "—" },
                  { v: mciV, label: "MCI × 25%", ok: mciV != null && mciV >= 0.8, txt: mciV == null ? "—" : `${Math.round(mciV * 100)}%` },
                ].map(c => (
                  <div key={c.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "9px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: numCol(c.ok) }}>{c.txt}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{c.label}</div>
                  </div>
                ))}
              </div>
              {ant && (() => {
                const willDrop = mciV != null && ant.mci != null && ant.mci < mciV;
                return (
                  <div style={{ color: willDrop ? "#fbd0a5" : "#7dffd9", fontSize: 11, marginTop: 10 }} title="Forecast MCI when this project enters its next gate.">
                    {willDrop ? "⚠" : "✓"} Anticipated at Gate {ant.atGate}: {ant.mci == null ? "—" : `${Math.round(ant.mci * 100)}%`} — {ant.deltaDocs} new doc{ant.deltaDocs > 1 ? "s" : ""} due
                  </div>
                );
              })()}
              {project.roadmapDeadline && (() => {
                const rd = new Date(project.roadmapDeadline).getTime();
                const measure = project.status === "Completed"
                  ? new Date(project.actualFinishDate || project.lastUpdate || TODAY).getTime()
                  : new Date(TODAY).getTime();
                const daysPast = measure > rd ? Math.floor((measure - rd) / 86_400_000) : 0;
                return <div style={{ color: daysPast > 0 ? "#ff9d7a" : "#7dffd9", fontSize: 11, marginTop: 4 }}>{daysPast > 0 ? `⚠ ${daysPast}d past roadmap` : "✓ Within roadmap"}</div>;
              })()}
              {ipiResult.dataReliability === "invalid_dates" && <div style={{ color: "#ff9d7a", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ Invalid dates: planned end ≤ start</div>}
              {ipiResult.dataReliability === "baseline_forming" && <div style={{ color: "#fbd0a5", fontSize: 11, marginTop: 4 }}>Baseline forming — IPI after 7 days</div>}
            </div>
          </div>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: infoCols, gap: 16, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "PM", value: project.pm },
            { label: "Sponsor", value: project.sponsor },
            { label: "Department", value: departments.find(d => d.id === project.deptId)?.name },
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

      {/* ── WHY THIS PROJECT IS RED — one consolidated banner ─────────
           Replaces the scattered stale/returned/derived-status chips. Only
           renders for projects that are actually off-track. */}
      {(() => {
        const derived = deriveProjectStatus(project);
        const isReturned = project.pmoStatus === "Returned";
        const plannedNow = plannedProgressAt(project);
        const behindPts  = plannedNow != null ? plannedNow - effectiveProgress : null;
        const forecastVal = project.forecast || 0;
        const overBudget  = forecastVal - (project.budget || 0);
        const worstOverdue = [...(project.milestones || [])]
          .filter(m => m.status !== "Completed" && m.date && m.date < TODAY)
          .sort((a, b) => (daysSince(b.date) || 0) - (daysSince(a.date) || 0))[0];
        const overdueDays = worstOverdue ? daysSince(worstOverdue.date) : null;
        const offTrack = ["Delayed", "At Risk"].includes(project.status)
          || ["Delayed", "At Risk"].includes(derived?.status)
          || isReturned || overBudget > 0 || (behindPts != null && behindPts >= 15);
        if (!offTrack) return null;

        const problems = [];
        if (project.daysDelayed) problems.push(`${project.daysDelayed} days behind plan`);
        else if (behindPts != null && behindPts > 0) problems.push(`${behindPts} pts behind plan`);
        if (overBudget > 0) problems.push(`forecast ${fmtSAR(forecastVal)} vs ${fmtSAR(project.budget)} budget (+${fmtSAR(overBudget)})`);
        if (worstOverdue) problems.push(`"${worstOverdue.name}" milestone ${overdueDays}d overdue`);

        const delayed = project.status === "Delayed" || derived?.status === "Delayed";
        const headline = `${delayed ? "Behind schedule" : "At risk"}${overBudget > 0 ? " and over forecast" : ""}${isReturned ? " — PMO returned the last update" : ""}`;
        const note = isReturned ? project.pmoValidationNote : null;
        const canUpdate = userRole !== ROLE_EXEC && userRole !== ROLE_DEPT_HEAD && userRole !== ROLE_PMO_STAFF;
        return (
          <div style={{ background: dark ? "rgba(255,80,0,0.06)" : "#fff8f4", border: `1px solid ${dark ? "rgba(255,80,0,0.28)" : "#ffd9c7"}`, borderLeft: "4px solid #FF5000", borderRadius: 14, padding: "16px 22px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span style={{ marginTop: 2, flexShrink: 0 }}><Ico name="alert" size={16} color="#FF5000" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{headline}</div>
              <div style={{ fontSize: 12.5, color: dark ? "#ffb59a" : "#7c2d12", marginTop: 4, lineHeight: 1.5 }}>
                {problems.join(" · ")}{note ? <>{problems.length ? ". " : ""}<strong>PMO note:</strong> {note}</> : ""}
              </div>
            </div>
            {canUpdate && (
              <button onClick={() => setShowUpdate(true)}
                style={{ padding: "9px 16px", background: "#003932", color: "#00ffb3", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = "#00543f"}
                onMouseLeave={e => e.currentTarget.style.background = "#003932"}>Submit Recovery Update →</button>
            )}
          </div>
        );
      })()}

      <Tab tabs={TABS} active={activeTab} onSelect={setTab} />

      {/* ── GATE TRACKER — always visible ── */}
      <GateTracker gates={project.gates} currentGate={project.gate} startDate={project.startDate} />

      {/* ── PMO Internal Notes (hidden from PM) ─────────────────── */}
      {canSeeNotes && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: noteEdit ? 10 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-flex", color: "#92400e" }}><Ico name="note" size={14} /></span>
              <span style={{ fontWeight: 700, fontSize: 12, color: "#92400e" }}>PMO Internal Notes</span>
              <span style={{ fontSize: 10, color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "1px 7px" }}>not visible to PM</span>
            </div>
            {!noteEdit && (
              <button onClick={() => { setNoteDraft(project.pmoNotes || ""); setNoteEdit(true); }}
                style={{ background: "none", border: "1px solid #fcd34d", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "#92400e", cursor: "pointer", fontWeight: 600 }}>
                {project.pmoNotes ? "Edit" : "+ Add note"}
              </button>
            )}
          </div>
          {noteEdit ? (
            <div>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                placeholder="Internal PMO observations, follow-up actions, concerns..."
                rows={3}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #fcd34d", padding: "8px 10px", fontSize: 12, resize: "vertical", background: "#fffde7", color: "#1e293b", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setNoteEdit(false)}
                  style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 14px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>
                  Cancel
                </button>
                <button disabled={noteSaving} onClick={async () => {
                  setNoteSaving(true);
                  try { await savePMONote(project.id, noteDraft); setNoteEdit(false); }
                  finally { setNoteSaving(false); }
                }}
                  style={{ background: "#f59e0b", border: "none", borderRadius: 6, padding: "4px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff", opacity: noteSaving ? 0.6 : 1 }}>
                  {noteSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : (
            project.pmoNotes
              ? <div style={{ fontSize: 12, color: "#78350f", marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{project.pmoNotes}</div>
              : <div style={{ fontSize: 12, color: "#b45309", marginTop: 4, opacity: 0.6, fontStyle: "italic" }}>No internal notes yet.</div>
          )}
        </div>
      )}

      {/* ── IPI TREND — one immutable dot per save ─────────────────────────
          Every save appends to ipiHistory (never overwrites), so this chart
          is the visual audit trail. Each point carries the full datetime,
          the author, and the component breakdown at the time of save. The
          90-day window (which drives the displayed weighted IPI) is shaded
          so reviewers can see exactly which snapshots feed today's score. */}
      {(() => {
        const history = (project.ipiHistory || [])
          .filter(h => h.date && h.ipi != null)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        // TODAY is a module-level constant (frozen at page load) so the
        // window boundary is deterministic per render — satisfies
        // react-hooks/static-components purity rule.
        const todayMs   = new Date(TODAY).getTime();
        const windowMs  = todayMs - 90 * 86_400_000;
        const data = history.map((h, i) => ({
          // X axis key — sequential to avoid same-day collapse when many
          // snapshots share a date. Display label comes from `label`.
          idx:    i,
          ts:     new Date(h.date).getTime(),
          label:  (h.day || String(h.date).slice(0, 10)),
          fullTs: h.date,
          ipi:    h.ipi,
          spi:    h.spiFinal != null ? h.spiFinal : h.spi,
          cpi:    h.cpi,
          mci:    h.mci,
          by:     h.by || "—",
          status: h.status || "—",
          inWin:  new Date(h.date).getTime() >= windowMs,
        }));
        const inWindowCount = data.filter(d => d.inWin).length;
        const dotColor = (v) => v >= 90 ? "#007a62" : v >= 70 ? "#d97706" : "#FF5000";
        const firstWin = data.find(d => d.inWin);

        // Recharts <Tooltip content={fn}> accepts a plain function that
        // returns JSX — this avoids declaring a component TYPE during
        // render (which would violate react-hooks/static-components).
        const renderTooltip = ({ active, payload }) => {
          if (!active || !payload || !payload.length) return null;
          const p = payload[0].payload;
          const dt = new Date(p.fullTs);
          const fmtDt = isNaN(dt) ? p.label : dt.toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
          const f3 = (v) => v == null ? "—" : Number(v).toFixed(3);
          return (
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", fontSize: 11, color: "#0d1f1c", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 200 }}>
              <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4, color: "#003932" }}>IPI {p.ipi} <span style={{ fontWeight: 600, color: dotColor(p.ipi), marginLeft: 6 }}>● {p.status}</span></div>
              <div style={{ color: "#56716c", fontSize: 10, marginBottom: 6 }}>{fmtDt}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px", fontFamily: "monospace", fontSize: 10.5 }}>
                <span style={{ color: "#56716c" }}>SPI</span><span>{f3(p.spi)}</span>
                <span style={{ color: "#56716c" }}>CPI</span><span>{f3(p.cpi)}</span>
                <span style={{ color: "#56716c" }}>MCI</span><span>{f3(p.mci)}</span>
              </div>
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #d1e8e4", fontSize: 10, color: "#56716c" }}>
                by <strong style={{ color: "#0d1f1c" }}>{p.by}</strong>
                {p.inWin && <span style={{ background: "#00FFB3", color: "#003932", marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontWeight: 700, fontSize: 9 }}>IN 90-DAY WINDOW</span>}
              </div>
            </div>
          );
        };

        // ── Progress · Planned vs Actual — sibling chart to the IPI trend.
        // Planned curve: plannedProgressAt() sampled ~weekly across the plan
        // window (milestone-weighted when activities exist, linear fallback).
        // Actual curve: the ev recorded in each ipiHistory snapshot, plus a
        // synthetic 0% at start and today's effectiveProgress as the live tip.
        const startMs = project.startDate  ? new Date(project.startDate).getTime()  : null;
        const planEndMs = project.plannedEnd ? new Date(project.plannedEnd).getTime() : null;
        const chartEndMs = Math.max(planEndMs || 0, todayMs);
        const hasPlan = plannedProgressAt(project, TODAY) != null;

        const progressData = (() => {
          if (!hasPlan || !startMs) return [];
          const pts = new Map(); // ts → { ts, planned?, actual? }
          const put = (ts, patch) => pts.set(ts, { ts, ...(pts.get(ts) || {}), ...patch });
          // Planned samples — enough resolution for a smooth curve.
          const STEPS = 40;
          const span = Math.max(1, chartEndMs - startMs);
          for (let i = 0; i <= STEPS; i++) {
            const ts = startMs + (span * i) / STEPS;
            const v = plannedProgressAt(project, new Date(ts));
            if (v != null) put(ts, { planned: v });
          }
          // Actual — snapshots that recorded ev (post-v3 history) + anchors.
          // NOTE: `effectiveProgress` is shadowed in this component by a local
          // NUMBER of the same name (the hero's progress value) — use it
          // directly rather than calling the imported function.
          put(startMs, { actual: 0 });
          history.filter(h => h.ev != null).forEach(h => {
            const ts = new Date(h.date).getTime();
            if (ts >= startMs) put(ts, { actual: Math.min(100, Math.round(h.ev * 100)) });
          });
          put(todayMs, { actual: effectiveProgress });
          return [...pts.values()].sort((a, b) => a.ts - b.ts);
        })();

        const plannedToday = plannedProgressAt(project, TODAY);
        const actualToday  = effectiveProgress;
        const variance     = plannedToday != null ? actualToday - plannedToday : null;
        const monthFmt = (ts) => new Date(ts).toLocaleDateString("en-GB", { month: "short" });

        const renderProgressTooltip = ({ active, payload, label }) => {
          if (!active || !payload || !payload.length) return null;
          const row = payload[0].payload;
          return (
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#0d1f1c", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
              <div style={{ color: "#56716c", fontSize: 10, marginBottom: 4 }}>{new Date(label).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
              {row.planned != null && <div><span style={{ color: "#00b894", fontWeight: 700 }}>Planned</span> {row.planned}%</div>}
              {row.actual  != null && <div><span style={{ color: "#003932", fontWeight: 700 }}>Actual</span> {row.actual}%</div>}
            </div>
          );
        };

        const cardStyle = {
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "16px 20px",
          display: "flex", flexDirection: "column",
        };

        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 16 }}>

            {/* ── Card 1 · IPI Trend ── */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: "-0.2px" }}>
                    IPI Trend
                    <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {data.length} snapshot{data.length === 1 ? "" : "s"} · {inWindowCount} in window
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                    Immutable record per save · hover a dot for audit metadata
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.muted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#007a62", borderRadius: 4, marginRight: 4 }} />On Track 90+</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#d97706", borderRadius: 4, marginRight: 4 }} />Watch 70–89</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#FF5000", borderRadius: 4, marginRight: 4 }} />Critical &lt;70</span>
                </div>
              </div>
              {data.length === 0 ? (
                <div style={{
                  padding: "32px 12px", textAlign: "center", flex: 1,
                  background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 8,
                  fontSize: 12, color: T.muted,
                }}>
                  No IPI snapshots recorded yet. Each project update creates an immutable audit record — the line will populate as the PM submits updates.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <LineChart data={data} margin={{ top: 20, right: 12, left: -10, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: T.muted }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 120]} ticks={[0, 70, 90, 100, 120]}
                      tick={({ x, y, payload }) => {
                        const c = payload.value === 90 ? "#007a62" : payload.value === 70 ? "#FF5000" : T.muted;
                        return <text x={x} y={y} dy={3} textAnchor="end" fontSize={10} fill={c} fontWeight={payload.value === 90 || payload.value === 70 ? 700 : 400}>{payload.value}</text>;
                      }} />
                    <Tooltip content={renderTooltip} />
                    {firstWin && (
                      <ReferenceArea x1={firstWin.label} x2={data[data.length - 1].label} y1={0} y2={120} fill="#00FFB3" fillOpacity={0.07} radius={[6, 6, 0, 0]} />
                    )}
                    <ReferenceLine y={90} stroke="#007a62" strokeDasharray="4 3" strokeOpacity={0.5} />
                    <ReferenceLine y={70} stroke="#FF5000" strokeDasharray="4 3" strokeOpacity={0.5} />
                    <Line
                      type="monotone"
                      dataKey="ipi"
                      stroke="#003932"
                      strokeWidth={2.5}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        return <circle key={`d-${payload.idx}`} cx={cx} cy={cy} r={5.5} fill={dotColor(payload.ipi)} stroke="#fff" strokeWidth={2} />;
                      }}
                      activeDot={{ r: 7 }}
                    >
                      <LabelList dataKey="ipi" position="top" content={(props) => {
                        const { x, y, value } = props;
                        if (value == null) return null;
                        return <text x={x} y={y - 9} textAnchor="middle" fontSize={11.5} fontWeight={800} fill={dotColor(value)}>{value}</text>;
                      }} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Card 2 · Progress — Planned vs Actual ── */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: "-0.2px" }}>
                    Progress · Planned vs Actual
                    {variance != null && (
                      <span style={{
                        marginLeft: 10, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                        background: variance >= 0 ? "#e0f8ee" : "#fdf1dd",
                        color: variance >= 0 ? "#007a62" : "#b45309",
                      }}>
                        {variance >= 0 ? "▲" : "▼"} {Math.abs(variance)} pts vs plan
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                    Baseline S-curve from {project.milestones?.length ? "activity dates" : "project window"} · actuals from saved updates
                  </div>
                </div>
                <div style={{ fontSize: 10, color: T.muted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span><span style={{ display: "inline-block", width: 14, height: 2, background: "#003932", marginRight: 5, verticalAlign: "middle" }} />Actual</span>
                  <span><span style={{ display: "inline-block", width: 14, height: 2, background: "repeating-linear-gradient(90deg, #00b894 0 3px, transparent 3px 6px)", marginRight: 5, verticalAlign: "middle" }} />Planned</span>
                </div>
              </div>
              {progressData.length === 0 ? (
                <div style={{
                  padding: "32px 12px", textAlign: "center", flex: 1,
                  background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 8,
                  fontSize: 12, color: T.muted,
                }}>
                  No plan dates yet. Set a start date and planned end (or add dated activities) and the planned curve will appear here.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={182}>
                    <LineChart data={progressData} margin={{ top: 10, right: 12, left: -10, bottom: 2 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                      <XAxis dataKey="ts" type="number" domain={[startMs, chartEndMs]} scale="time"
                        tickFormatter={monthFmt} tick={{ fontSize: 10, fill: T.muted }} tickCount={7} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 10, fill: T.muted }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={renderProgressTooltip} />
                      <ReferenceLine x={todayMs} stroke={T.text} strokeDasharray="4 3" strokeOpacity={0.4}
                        label={{ value: "Today", position: "top", fontSize: 9, fill: T.muted }} />
                      <Line type="monotone" dataKey="planned" stroke="#00b894" strokeWidth={2}
                        strokeDasharray="5 4" dot={false} connectNulls />
                      <Line type="monotone" dataKey="actual" stroke="#003932" strokeWidth={2.5}
                        connectNulls
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (payload.actual == null) return null;
                          const isTip = payload.ts === todayMs;
                          return (
                            <g key={`p-${payload.ts}`}>
                              {isTip && <circle cx={cx} cy={cy} r={9} fill="#00b894" opacity={0.18} />}
                              <circle cx={cx} cy={cy} r={isTip ? 5.5 : 3.5} fill="#003932" stroke="#fff" strokeWidth={1.5} />
                            </g>
                          );
                        }}
                        activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    paddingTop: 10, marginTop: 2, borderTop: `1px solid ${T.border}`,
                    fontSize: 11, color: T.muted, flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span>Planned <strong style={{ color: T.text }}>{plannedToday}%</strong></span>
                      <span>Actual <strong style={{ color: T.text }}>{actualToday}%</strong></span>
                      <span>Variance <strong style={{ color: variance >= 0 ? "#007a62" : "#b23800" }}>{variance >= 0 ? "+" : ""}{variance} pts</strong></span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 7,
                      background: variance >= 0 ? "#e0f8ee" : "#fdf1dd",
                      color: variance >= 0 ? "#007a62" : "#b45309",
                    }}>
                      {variance >= 0 ? "On / ahead of plan" : `Behind plan · ${Math.abs(variance)} pts`}
                    </span>
                  </div>
                </>
              )}
            </div>

          </div>
        );
      })()}

      {/* ── Submit Update Panel ─────────────────────────────────── */}
      {showUpdate && <UpdatePanel project={project} onClose={() => setShowUpdate(false)} onSubmit={submitUpdate} userRole={userRole} />}

      <div key={activeTab} className="pmo-tab-content">
      {/* EXEC SUMMARY TAB */}
      {activeTab === "Exec Summary" && (() => {
        const upcomingSorted = [...(project.milestones || [])].filter(m => m.status !== "Completed").sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const nextMilestone = upcomingSorted[0];
        const thenMilestone = upcomingSorted[1];
        const msOverdue = nextMilestone && nextMilestone.date && nextMilestone.date < TODAY;
        const msOverdueDays = msOverdue ? daysSince(nextMilestone.date) : null;
        const riskOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        const topRisk = [...(project.risks || [])].filter(r => r.status === "Open").sort((a, b) => (riskOrder[b.level] || 0) - (riskOrder[a.level] || 0))[0];
        const rc = topRisk ? (riskColor[topRisk.level] || riskColor["Medium"]) : null;
        const topRiskHot = topRisk && (topRisk.level === "Critical" || topRisk.level === "High");
        const forecast = project.forecast || 0;
        const forecastPct = project.budget ? Math.min(100, Math.round((forecast / project.budget) * 100)) : 0;
        const forecastOver = forecast - (project.budget || 0);
        const latestUpdate = [...(project.updates || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
        const gridCols = bp === "mobile" ? "1fr" : "1fr 1fr 1fr";
        const twoCol = bp === "mobile" ? "1fr" : "1fr 1fr";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Budget | Next Milestone | Top Risk (status/progress/IPI now live in the hero) */}
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 16 }}>
              {/* Budget Health */}
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Budget Health</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: remaining >= 0 ? "#007a62" : "#b23800" }}>{fmtSAR(project.actualCost)}</div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>of {fmtSAR(project.budget)} approved</div>
                {/* Utilisation bar with a forecast marker tick */}
                <div style={{ position: "relative", height: 8, background: "#eef3ee", borderRadius: 5, overflow: "visible" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, budgetUtil)}%`, borderRadius: 5, background: budgetUtil > 90 ? "#FF5000" : budgetUtil > 75 ? "#d97706" : "#00b894" }} />
                  {forecast > 0 && <div title={`Forecast ${forecastPct}%`} style={{ position: "absolute", left: `${forecastPct}%`, top: -3, width: 2, height: 14, background: forecastOver > 0 ? "#b23800" : "#5a7a6e" }} />}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: T.muted }}>{budgetUtil}% utilized</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: remaining >= 0 ? "#007a62" : "#b23800" }}>{deriveBudgetStatus(project)}</span>
                </div>
                {forecastOver > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#b23800", marginBottom: 8 }}>Forecast {fmtSAR(forecastOver)} over</div>}
                <div style={{ fontSize: 12, color: T.muted }}>CPI: <span style={{ fontWeight: 700, color: project.cpi >= 1 ? "#007a62" : "#b23800" }}>{project.cpi.toFixed(2)}</span> &nbsp;·&nbsp; SPI: <span style={{ fontWeight: 700, color: project.spi >= 0.9 ? "#007a62" : "#b23800" }}>{project.spi.toFixed(2)}</span></div>
              </div>

              {/* Next Milestone */}
              <div style={{ background: T.surface, border: `1px solid ${msOverdue ? "#ffd0ba" : T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Next Milestone</div>
                  {msOverdue && <span style={{ background: "#ffe8de", color: "#b23800", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, marginLeft: "auto" }}>{msOverdueDays != null ? `${msOverdueDays}d ` : ""}OVERDUE</span>}
                </div>
                {nextMilestone ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>{nextMilestone.name}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Due: {nextMilestone.date}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>Owner: {nextMilestone.owner}</div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ background: "#fdf1dd", color: "#b45309", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8 }}>{nextMilestone.status}</span>
                    </div>
                    {thenMilestone && <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>Then: <span style={{ fontWeight: 600, color: T.text }}>{thenMilestone.name}</span></div>}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#007a62", fontWeight: 600 }}>All milestones complete ✓</div>
                )}
              </div>

              {/* Top Risk */}
              <div style={{ background: T.surface, border: `1px solid ${topRiskHot ? "#ffd0ba" : T.border}`, borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Top Risk</div>
                {topRisk ? (
                  <>
                    <span style={{ background: rc.bg, color: rc.text, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, display: "inline-block", marginBottom: 8 }}>{topRisk.level}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>{topRisk.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>Owner: {topRisk.owner}</div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>↳ {topRisk.mitigation}</div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#007a62", fontWeight: 600 }}>No open risks ✓</div>
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
                {(() => {
                  const daysLeft = project.plannedEnd
                    ? Math.max(0, Math.ceil((new Date(project.plannedEnd) - new Date(TODAY)) / 86_400_000))
                    : null;
                  return [
                    ["Strategic Objective", project.strategic],
                    ["Classification", project.classification],
                    ["Gate Status", project.gate],
                    ["Risk Level", deriveRiskLevel(project)],
                    ["Budget Status", deriveBudgetStatus(project)],
                    ["Days Remaining", daysLeft == null ? "—" : daysLeft === 0 ? "Completed" : `${daysLeft} days`],
                  ];
                })().map(([k, v]) => (
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
                  <span style={{ fontSize: 12, color: T.muted }}>
                    Overall Progress{wbsProgress != null && <span style={{ color: T.accent, fontWeight: 700 }}> · auto from WBS</span>}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{effectiveProgress}%</span>
                </div>
                <Progress value={effectiveProgress} color={T.accent} height={10} />
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
                  {(() => { const v = ipiResult.components.spiFinal ?? ipiResult.components.spi; const c = v == null ? T.muted : v >= 1 ? "#16a34a" : "#dc2626"; return <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v != null ? v.toFixed(2) : "—"}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>SPI {v != null && ipiResult.components.penalty < 1 ? "(×penalty)" : ""}</div>
                  </>; })()}
                </div>
                <div style={{ textAlign: "center", padding: 12, background: T.bg, borderRadius: 10 }}>
                  {(() => { const v = ipiResult.components.cpi; const c = v == null ? T.muted : v >= 1 ? "#16a34a" : "#dc2626"; return <>
                    <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v != null ? v.toFixed(2) : "—"}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>CPI (auto)</div>
                  </>; })()}
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

      {/* ACTIVITIES TAB (formerly Milestones) */}
      {activeTab === "Activities" && (
        <div>
        <MilestoneGantt milestones={project.milestones} project={project} />
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Milestone Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(() => {
              // GROUP each milestone with its activity children before rendering.
              // The raw project.milestones array preserves creation order, which
              // for nested WBS often interleaves activities of different parents
              // (M1, A-of-M2, M2, A-of-M1...). Rendering in that order made
              // activities appear under the wrong milestones — the bug the user
              // just flagged. Same tops/kidsOf pattern the Gantt uses.
              const all = project.milestones || [];
              const tops = all.filter(x => !x.parentId);
              const kidsOf = (id) => all.filter(x => x.parentId === id);
              const ordered = [];
              tops.forEach(t => {
                ordered.push(t);
                kidsOf(t.id).forEach(k => ordered.push(k));
              });
              // Orphan activities (parentId set but parent missing) — append at end
              all.forEach(x => {
                if (x.parentId && !tops.some(t => t.id === x.parentId) && !ordered.some(o => o.id === x.id)) {
                  ordered.push(x);
                }
              });
              return ordered;
            })().map((m, i, ordered) => {
              // Colours: In Progress = green, Completed = blue, Upcoming = grey,
              // Delayed/Overdue = red. Yellow removed — it visually clashed with At Risk.
              // softColor = a paler tint of lineColor used for activity rows.
              // Keeps the activity recognisable by status (green / blue / red /
              // grey family) while letting parent milestones stand out as the
              // stronger, more saturated anchor.
              const statusStyles = {
                "Completed":   { bg: "#e0f8ee", text: "#007a62", icon: "✓", lineColor: "#007a62", softColor: "#8fd9c2" },
                "In Progress": { bg: "#dff7ef", text: "#00614d", icon: "◎", lineColor: "#00b894", softColor: "#7fddc4" },
                "Upcoming":    { bg: "#f0f4f0", text: "#5a7a6e", icon: "○", lineColor: "#a1b9ab", softColor: "#cdddd2" },
                "Delayed":     { bg: "#ffe8de", text: "#b23800", icon: "!", lineColor: "#FF5000", softColor: "#ffb59a" },
              };
              const isOverdue = m.status !== "Completed" && m.date && m.date < TODAY;
              const s = isOverdue
                ? { bg: "#ffe8de", text: "#b23800", icon: "!", lineColor: "#FF5000", softColor: "#ffb59a" }
                : (statusStyles[m.status] || statusStyles["Upcoming"]);
              // Top-level item = milestone (diamond) · child = activity (smaller circle).
              const isMilestone = !m.parentId;
              // Activities use the softer paler tint; milestones use the full
              // saturated lineColor. Tree connectors take the softer shade so
              // they read as background structure, never compete with the
              // milestone diamonds for attention.
              const ringColor = isMilestone ? s.lineColor : s.softColor;
              const nextItem = ordered[i + 1];
              const nextIsActivity = nextItem && nextItem.parentId;
              const connectorColor = nextIsActivity ? s.softColor : s.lineColor;
              const connectorStyle = nextIsActivity
                ? `2px dashed ${connectorColor}`
                : `2px solid ${connectorColor}`;
              return (
                <div key={m.id} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                    {isMilestone ? (
                      <div style={{ width: 30, height: 30, background: s.bg, border: `2px solid ${ringColor}`, transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, borderRadius: 4, marginTop: 2 }}>
                        <span style={{ transform: "rotate(-45deg)", fontSize: 13, color: s.text, fontWeight: 800, lineHeight: 1 }}>{s.icon}</span>
                      </div>
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: s.bg, border: `2px solid ${ringColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: s.text, fontWeight: 700, zIndex: 1, marginTop: 6 }}>{s.icon}</div>
                    )}
                    {i < ordered.length - 1 && (
                      <div style={{ width: 0, flex: 1, borderLeft: connectorStyle, opacity: 0.45, minHeight: 20 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 20, paddingLeft: isMilestone ? 0 : 24, position: "relative" }}>
                    {/* Tree-tee: a soft horizontal dashed connector reaching from
                        the vertical line into the activity card's left edge.
                        Only on activities — milestones stand on their own. */}
                    {!isMilestone && (
                      <div style={{ position: "absolute", left: -16, top: 22, width: 16, height: 0, borderTop: `2px dashed ${s.softColor}`, opacity: 0.55 }} />
                    )}
                    <div style={{
                      background: T.bg, borderRadius: 12, padding: "14px 18px",
                      borderLeft: isMilestone
                        ? `3px solid ${s.lineColor}`
                        : `2px dashed ${s.softColor}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontSize: isMilestone ? 14 : 13, fontWeight: isMilestone ? 700 : 600, color: T.text }}>
                          {isMilestone ? "" : "↳ "}{m.name}
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {m.weight > 1 && <span style={{ background: T.surface, color: T.muted, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: `1px solid ${T.border}` }}>W:{m.weight}</span>}
                          {/* One calm pill carries the whole story — the coloured
                              marker on the timeline is the only other signal. */}
                          <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{isOverdue ? `Overdue · ${m.status}` : m.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
                        {m.startDate ? `${m.startDate} → ${m.date || "—"}` : (m.date ? `Target: ${m.date}` : "No date set")} · Owner: {m.owner || "—"}
                      </div>
                      {(() => {
                        // BUG FIX: milestone was showing its own (zero) progress
                        // while its activity children showed 56%/44%. A parent
                        // milestone's progress must roll up from its children —
                        // weighted by child weights — same rule the Gantt uses.
                        const kids = isMilestone ? project.milestones.filter(c => c.parentId === m.id) : [];
                        const computedProgress = kids.length > 0
                          ? (() => {
                              const w = kids.reduce((sum, c) => sum + (c.weight || 1), 0);
                              return w ? Math.round(kids.reduce((sum, c) => sum + (c.weight || 1) * (c.progress || 0), 0) / w) : 0;
                            })()
                          : (m.progress ?? (m.status === "Completed" ? 100 : 0));
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${computedProgress}%`, background: s.lineColor, borderRadius: 3, transition: "width 0.3s" }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: s.text, minWidth: 32 }}>{computedProgress}%</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
              { label: "Cost Performance Index", value: ipiResult.components.cpi != null ? ipiResult.components.cpi.toFixed(2) : "—", sub: "> 1.0 = under budget (auto-calculated)", color: (ipiResult.components.cpi ?? 1) >= 1 ? "#16a34a" : "#dc2626" },
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
                <span style={{ background: "#fff3ee", color: "#FF5000", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "Critical").length} Critical</span>
                <span style={{ background: "#fdece2", color: "#b23800", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "High").length} High</span>
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
                <tbody>{[...project.risks].sort((a, b) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[b.level] || 0) - ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[a.level] || 0)).map(r => {
                  const statusCol = r.status === "Open" ? "#b23800" : r.status === "Mitigated" ? "#007a62" : "#b45309";
                  return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: T.text }}>{r.title}</div>
                      {r.mitigation && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>↳ {r.mitigation}</div>}
                    </td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.probability}</td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.impact}</td>
                    <td style={{ padding: "12px" }}><RiskBadge level={r.level} /></td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.owner}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusCol }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: T.muted }}>{r.dueDate}</td>
                  </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Issue Log</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {project.issues.filter(i => { const d = daysSince(i.raised); return d != null && d > 30 && i.status === "Open"; }).length > 0 && (
                  <span style={{ background: "#fff3ee", color: "#FF5000", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                    {project.issues.filter(i => { const d = daysSince(i.raised); return d != null && d > 30 && i.status === "Open"; }).length} Stale 30d+
                  </span>
                )}
                {project.issues.filter(i => i.escalated).length > 0 && (
                  <span style={{ background: "#fdece2", color: "#b23800", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.issues.filter(i => i.escalated).length} Escalated</span>
                )}
              </div>
            </div>
            {project.issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#007a62", fontSize: 13 }}>✓ No open issues</div>
            ) : (
              project.issues.map(issue => {
                const issueDays = daysSince(issue.raised);
                const isStale   = issueDays != null && issueDays > 30 && issue.status === "Open";
                const sevCol    = riskColor[issue.severity]?.text || "#a1b9ab";
                const borderCol = issue.escalated ? "#FF5000" : isStale ? "#b23800" : sevCol;
                const nextAction = issue.nextAction || issue.action;
                return (
                  <div key={issue.id} style={{ padding: "14px 16px", background: T.bg, borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${borderCol}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isStale && <span style={{ background: "#fde8d8", color: "#b23800", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{issueDays}d open</span>}
                        {issue.escalated && <span style={{ background: "#ffe8de", color: "#FF5000", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ESCALATED</span>}
                        <RiskBadge level={issue.severity} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      Owner: {issue.owner} · Raised: {issue.raised}
                      {issue.targetDate && <span> · Target: <span style={{ color: issue.targetDate < TODAY && issue.status === "Open" ? "#b23800" : T.muted }}>{issue.targetDate}</span></span>}
                      {" · "}Status: <span style={{ fontWeight: 600, color: issue.status === "Open" ? "#b23800" : issue.status === "Resolved" ? "#007a62" : T.muted }}>{issue.status}</span>
                    </div>
                    {nextAction && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}`, fontSize: 12, color: T.text }}>
                        <span style={{ fontWeight: 700, color: "#b45309" }}>Next action:</span> {nextAction}
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
                {b.expectedDate && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <span style={{ color: T.muted }}>Expected: {b.expectedDate}</span>
                    {b.realization >= 100
                      ? <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>✓ Realized</span>
                      : b.expectedDate < TODAY
                        ? <span style={{ background: "#fee2e2", color: "#dc2626", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Overdue — not yet realized</span>
                        : <span style={{ background: "#fef9c3", color: "#854d0e", padding: "2px 8px", borderRadius: 10 }}>Pending</span>
                    }
                  </div>
                )}
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
              <span style={{ display: "inline-flex", color: T.primary }}><Ico name="star" size={15} /></span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Required Documents</h3>
              <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Affects IPI</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>
                {["Document", "Type", "Due At", "Status", "Last Updated"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{(() => {
                const currentGate = parseGateNumber(project.gate);
                const sorted = [...project.documents.filter(d => d.required)]
                  .sort((a, b) => (a.requiredAtGate || 1) - (b.requiredAtGate || 1));
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
                return sorted.map(d => {
                  const ds = docStatus[d.status] || { bg: T.bg, text: T.muted };
                  const isReady = ["Approved","Final","Received","Current","Submitted"].includes(d.status);
                  const dueGate = d.requiredAtGate || 1;
                  const isFutureDue = dueGate > currentGate;
                  // Lifecycle marker: hollow dot = not due yet · check = delivered · alert = due and missing
                  const lifecycleIcon = isFutureDue
                    ? <span style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${T.muted}`, display: "inline-block", flexShrink: 0 }} />
                    : isReady
                      ? <Ico name="check" size={14} color="#16a34a" strokeWidth={2} />
                      : <Ico name="alert" size={14} color="#dc2626" />;
                  // Due-At chip: muted grey for future-gate; brand mint for currently due
                  const dueChip = isFutureDue
                    ? { bg: T.bg, text: T.muted, label: `Gate ${dueGate} · Not due yet` }
                    : { bg: "#dcfce7", text: "#15803d", label: `Gate ${dueGate}` };
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, opacity: isFutureDue ? 0.62 : 1 }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "inline-flex", alignItems: "center" }}>{lifecycleIcon}</span>
                          {d.url
                            ? <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: T.accent, textDecoration: "none" }}>{d.name} ↗</a>
                            : <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.name}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.type}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: dueChip.bg, color: dueChip.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12, whiteSpace: "nowrap" }}>{dueChip.label}</span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: ds.bg, color: ds.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{d.status || "Not Submitted"}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.lastUpdated || "—"}</td>
                    </tr>
                  );
                });
              })()}</tbody>
            </table>
          </div>

          {/* Optional / Additional Documents */}
          {project.documents.filter(d => !d.required).length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ display: "inline-flex", color: T.muted }}><Ico name="paperclip" size={15} /></span>
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
                          <span style={{ display: "inline-flex", color: T.muted }}><Ico name="doc" size={15} /></span>
                          {d.url
                            ? <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: T.accent, textDecoration: "none" }}>{d.name} ↗</a>
                            : <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.name}</span>}
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
                    <div style={{ width: 32, height: 32, background: T.btnPrimBg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: T.btnPrimText, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
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
      </div>{/* /pmo-tab-content */}
    </div>
  );
};

// ─── DEPARTMENT CRUD COMPONENT ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
//  DEPARTMENT CRUD — admin-only management of department records
// ════════════════════════════════════════════════════════════════════════════
//  Add, rename, change icon or colour, and (safely) delete department records.
//  Writes go straight to the PMO_Departments SP list via the SPService client.
//  Deletion is blocked when any project is still linked to the department.
//
const DeptCRUD = ({ projects }) => {
  const { departments, addDept, updateDept, deleteDept } = useDepts();
  const T = useT();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", color: "#003932" });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", id: "", color: "#003932" });
    setShowForm(true);
  };

  const openEdit = (d) => {
    setEditing(d.id);
    setForm({ name: d.name, id: d.id, color: deptColor(d.id) });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast("Department name is required", "error"); return; }
    if (!editing && !form.id.trim()) { showToast("Department ID is required", "error"); return; }
    if (!editing && departments.find(d => d.id === form.id.trim().toLowerCase())) {
      showToast("Department ID already exists", "error"); return;
    }
    if (editing) {
      updateDept(editing, { name: form.name, color: form.color });
      showToast("Department updated ✓");
    } else {
      addDept({ id: form.id.trim().toLowerCase().replace(/\s+/g, "-"), name: form.name, color: form.color });
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
            <div style={{ marginBottom: 12 }}><Ico name="alert" size={36} color="#dc2626" /></div>
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
              <DeptTile name={form.name || "?"} color={form.color} size={40} solid />
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
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 8 }}>Colour <span style={{ fontWeight: 400 }}>(Tree brand palette)</span></label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["#003932", "#0a5448", "#00b894", "#3a5547", "#7a9485", "#490300", "#7a2620", "#FF5000", "#b23800"].map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width: 32, height: 32, background: c, border: form.color === c ? `3px solid ${T.accent}` : "3px solid transparent", borderRadius: 9, cursor: "pointer", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
                  ))}
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
            {["", "Department Name", "ID", "Total Projects", "On Track", "Delayed", "Completed", "Health", "IPI", "Actions"].map(h => (
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
                <td style={{ padding: "12px 14px" }}><DeptTile name={d.name} color={deptColor(d.id)} size={32} radius={8} /></td>
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
                  <span style={{ background: ipiC.bg, color: ipiC.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{dIPI ?? "—"}</span>
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
  // ── Project Closure statuses ──────────────────────────────────────
  "In Review":     { label: "In Review",       color: "#0891b2", bg: "#ecfeff" },
  Closed:          { label: "Closed",          color: "#15803d", bg: "#dcfce7" },
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

// Parse a multi-line ApprovalLog from Power Automate.
// Each line: "{emoji} {Name} (Stakeholder) — {Approve|Reject} — {dd/MM/yyyy HH:mm} — {comment}"
// Returns array of { emoji, name, role, decision, when, comment } objects.
const parseApprovalLog = (raw) => {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Split on em-dash or hyphen-with-spaces (Power Automate may use either)
      const parts = line.split(/\s+[—–-]\s+/);
      if (parts.length < 3) return { raw: line };
      // First token: emoji + "Name (Role)" — pull the role out if present
      const head = parts[0];
      const emojiMatch = head.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|[✅❌⚠️])\s*/u);
      const emoji = emojiMatch ? emojiMatch[0].trim() : "";
      const rest  = emojiMatch ? head.slice(emojiMatch[0].length).trim() : head.trim();
      const roleMatch = rest.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      const name = roleMatch ? roleMatch[1].trim() : rest;
      const role = roleMatch ? roleMatch[2].trim() : "";
      return {
        emoji,
        name,
        role,
        decision: parts[1].trim(),
        when:     parts[2].trim(),
        comment:  parts.slice(3).join(" — ").trim(),
      };
    });
};

const ApprovalLogPanel = ({ log }) => {
  const T = useT();
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => parseApprovalLog(log), [log]);
  if (entries.length === 0) return null;
  const lastDecision = entries[entries.length - 1].decision || "";
  const lastIsReject = /reject/i.test(lastDecision);
  return (
    <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", padding: "9px 14px", fontSize: 12, cursor: "pointer", color: T.text }}>
        <span style={{ fontWeight: 700 }}>
          <span style={{ display: "inline-flex", verticalAlign: "-2px", marginRight: 6, color: T.muted }}><Ico name="clipboard" size={13} /></span>Approval Log
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: T.muted }}>{entries.length} response{entries.length === 1 ? "" : "s"}</span>
        </span>
        <span style={{ fontSize: 11, color: T.muted }}>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e, i) => {
            if (e.raw) return <div key={i} style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>{e.raw}</div>;
            const reject = /reject/i.test(e.decision);
            const chip = reject
              ? { bg: "#fee2e2", text: "#991b1b", icon: <Ico name="alert" size={14} color="#dc2626" /> }
              : { bg: "#dcfce7", text: "#15803d", icon: <Ico name="check" size={14} color="#16a34a" strokeWidth={2} /> };
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderTop: i > 0 ? `1px dashed ${T.border}` : "none" }}>
                <span style={{ lineHeight: "20px", flexShrink: 0, display: "inline-flex", alignItems: "center", height: 20 }}>{chip.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{e.name}</span>
                    {e.role && <span style={{ fontSize: 10, color: T.muted, background: T.surface, padding: "1px 7px", borderRadius: 4 }}>{e.role}</span>}
                    <span style={{ background: chip.bg, color: chip.text, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>{e.decision}</span>
                    <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>{e.when}</span>
                  </div>
                  {e.comment && e.comment.toLowerCase() !== "no comment" && (
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3, fontStyle: "italic" }}>"{e.comment}"</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
//  MY REQUESTS — the user's own open submissions
// ════════════════════════════════════════════════════════════════════════════
//  Anything this user has submitted that's still in the workflow: new project
//  requests, gate transition submissions, and closure submissions. Each row
//  shows where the item is currently pending, how many days it's been there,
//  and the full approval history. Action cards at the top link out to the
//  native SharePoint forms for new submissions.
//
const MyRequestsView = ({ requests, gateSubmissions, closureSubmissions, setRoute, currentUserName, currentUserEmail, userRole }) => {
  const T = useT();
  const bp = useBp();
  const [expandedId, setExpandedId] = useState(null);
  const pad = bp === "mobile" ? "16px" : "32px";

  // For non-admin roles: only show submissions where the user is involved
  const filterByUser = (list, nameFields, emailFields = []) => {
    if (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF) return list || [];
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
  // Fully signed-off closures — the "opened" list's natural counterpart.
  // Sorted newest-first so the most recent closure sits on top.
  const closedProjects = myClosures
    .filter(c => c.status === "Closed")
    .sort((a, b) => (b.submissionDate || "").localeCompare(a.submissionDate || ""));

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

  // Pending dot/colour escalates with age: red after 14d, amber after 7d,
  // brand mint by default. Same rule we adopted on the My Actions queue
  // so the two screens read consistently.
  const urgencyForDays = (days) => {
    if (days > 14) return { dot: "#dc2626", text: "#dc2626" };
    if (days > 7)  return { dot: "#d97706", text: "#d97706" };
    return { dot: "#0891b2", text: T.muted };
  };
  const GateCard = ({ gs }) => {
    const isRejected = gs.status?.startsWith("Rejected");
    const isApproved = gs.status?.startsWith("Approved");
    const borderColor = isRejected ? "#fecaca" : isApproved ? "#bbf7d0" : T.border;
    const u = urgencyForDays(gs.daysAtGate || 0);
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
              <div style={{ fontSize: 12, color: u.text, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.dot, display: "inline-block" }} />
                Pending with {gs.pendingWith}
                {gs.daysAtGate > 0 && <span style={{ color: T.muted }}> · {gs.daysAtGate} day{gs.daysAtGate !== 1 ? "s" : ""}</span>}
              </div>
            )}
          </div>
          <RequestStatusBadge status={gs.status} />
        </div>
        <ApprovalLogPanel log={gs.approvalLog} />
      </div>
    );
  };

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>

      {/* ── Action cards row ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>

        {/* Gate 1 — Project Request */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: T.primary }}><Ico name="clipboard" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 1 — Project Request</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit a new project idea for PMO review and Strategy alignment</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.intake, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Submit Request
          </button>
        </div>

        {/* Gate 2 — Initiation */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: T.primary }}><Ico name="flag" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 2 — Initiation</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit the Project Charter for PMO review and stakeholder alignment</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.gate1, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Submit Initiation
          </button>
        </div>

        {/* Gate 3 — Planning */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: T.primary }}><Ico name="calendar" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 3 — Planning</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit the Project Plan and Resource Plan for PMO review</div>
          </div>
          <button onClick={() => window.open(FORM_URLS.gate3, "_blank")}
            style={{ marginTop: "auto", padding: "9px 16px", background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Submit Plan
          </button>
        </div>

        {/* Gate 5 — Closure */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: T.primary }}><Ico name="check" size={20} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Gate 5 — Closure</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>Submit the closure document once the project is completed</div>
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
            {pendingClosures.map(cl => {
              const u = urgencyForDays(cl.daysInClosure || 0);
              return (
                <div key={cl.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{cl.projectTitle}</span>
                        <span style={{ fontSize: 11, color: T.muted, background: T.bgAlt || "#f3f4f6", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>Project Closure</span>
                        {cl.projectCode && <span style={{ fontSize: 11, color: T.muted, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px" }}>{cl.projectCode}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>
                        Submitted {cl.submissionDate} · PM: {cl.projectManager}
                        {cl.department && <span> · {cl.department}</span>}
                      </div>
                      {cl.daysInClosure > 0 && (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: u.dot }} />
                          <span style={{ fontSize: 12, color: u.text }}>
                            {cl.pendingWith ? `Pending with ${cl.pendingWith}` : "In review"} · <strong>{cl.daysInClosure} day{cl.daysInClosure !== 1 ? "s" : ""}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                    <RequestStatusBadge status={cl.status || "In Review"} />
                  </div>
                  <ApprovalLogPanel log={cl.approvalLog} />
                </div>
              );
            })}
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
              <div style={{ marginBottom: 8, opacity: 0.45 }}><Ico name="inbox" size={26} /></div>
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
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Completed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {completed.map(req => <RequestCard key={req.id} req={req} />)}
          </div>
        </div>
      )}

      {/* ── Closed Projects — fully signed-off closures. The counterpart of
             Active Requests: that list shows what's opening; this shows what
             has formally closed, with the e-signoff trail expandable. ── */}
      {closedProjects.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Closed Projects
            <span style={{ background: "#f0fdf4", color: "#15803d", padding: "1px 8px", borderRadius: 10, marginLeft: 8, fontSize: 11 }}>{closedProjects.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {closedProjects.map(cl => (
              <div key={cl.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{cl.projectTitle}</span>
                      {cl.projectCode && <span style={{ fontSize: 11, color: T.muted, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 8px" }}>{cl.projectCode}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      {cl.submissionDate && <span>Closed {cl.submissionDate} · </span>}
                      PM: {cl.projectManager}
                      {cl.department && <span> · {cl.department}</span>}
                    </div>
                  </div>
                  <span style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, whiteSpace: "nowrap" }}>✓ Closed</span>
                </div>
                <ApprovalLogPanel log={cl.approvalLog} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MY ACTIONS VIEW ─────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
//  MY ACTIONS — pending approvals routed to the current user
// ════════════════════════════════════════════════════════════════════════════
//  The queue this user is expected to clear: requests pending their review,
//  gate submissions pending their sign-off, closures pending their approval.
//  Each row carries a context panel that opens the underlying SharePoint
//  item so the user can act in one click. Validates updates against project
//  state before letting a PM submit (e.g. a PM can't push a Status change
//  unless the project is in an allowed gate).
//
const MyActionsView = ({ requests, gateSubmissions, closureSubmissions, projects, setRoute, currentUserEmail, currentUserName, userRole, validateUpdate }) => {
  const T = useT();
  const bp = useBp();
  const pad = bp === "mobile" ? "16px" : "32px";
  const [returnModal, setReturnModal] = useState(null);  // project object awaiting return note
  const [returnNote,  setReturnNote]  = useState("");
  const [saving,      setSaving]      = useState(false);

  // In mock mode, show all pending items as demo. In live mode, filter by current user email.
  const isMock = isUsingMock();

  const pendingRequests = (requests || []).filter(r =>
    ["PendingOwner", "PendingPMO", "PendingStrategy", "Submitted"].includes(r.status) &&
    (isMock || r.pendingWithEmail === currentUserEmail)
  );

  // Match the current user against either (a) the single pendingWithEmail
  // (PMO / Sponsor / Finance routing) OR (b) the pendingStakeholderEmails
  // array (multi-stakeholder review stage — only those who still owe a
  // decision per the ApprovalLog are in this list).
  const ownsThis = (item) =>
    item.pendingWithEmail === currentUserEmail ||
    (Array.isArray(item.pendingStakeholderEmails) && item.pendingStakeholderEmails.includes(currentUserEmail));

  const pendingGates = (gateSubmissions || []).filter(g =>
    !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected") &&
    (isMock || ownsThis(g))
  );

  const pendingClosures = (closureSubmissions || []).filter(c =>
    c.status !== "Closed" && c.status !== "Rejected" &&
    (isMock || ownsThis(c))
  );

  // PMO-only: projects where PM submitted an update awaiting validation
  const pendingValidations = (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF)
    ? (projects || []).filter(p => p.pmoStatus === "Submitted")
    : [];

  // Overdue milestones in projects where PM matches current user
  const TODAY = new Date().toISOString().split("T")[0];
  const overdueMilestones = (projects || []).flatMap(p =>
    (p.milestones || [])
      .filter(m => m.status !== "Completed" && m.date && m.date < TODAY)
      .map(m => ({ ...m, projectId: p.id, projectName: p.name, pm: p.pm }))
  ).filter(m => isMock || m.pm === currentUserName);

  const hasAnything = pendingRequests.length > 0 || pendingGates.length > 0 || pendingClosures.length > 0 || overdueMilestones.length > 0 || pendingValidations.length > 0;

  const handleValidate = async (project) => {
    setSaving(true);
    try { await validateUpdate(project.id, { approved: true, note: "" }); }
    finally { setSaving(false); }
  };

  const handleReturn = async () => {
    if (!returnNote.trim() || !returnModal) return;
    setSaving(true);
    try {
      await validateUpdate(returnModal.id, { approved: false, note: returnNote.trim() });
      setReturnModal(null);
      setReturnNote("");
    } finally { setSaving(false); }
  };

  const ActionCard = ({ icon, title, subtitle, rightContent, onClick, urgency }) => {
    const borderColor = urgency === "high" ? "#dc2626" : urgency === "medium" ? "#d97706" : T.border;
    return (
      <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: onClick ? "pointer" : "default", transition: "all 0.15s" }}>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", color: T.muted }}>{icon}</div>
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
          <div style={{ marginBottom: 12 }}><Ico name="check" size={34} color="#16a34a" /></div>
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
                icon={<Ico name="inbox" size={20} />}
                title={req.title}
                subtitle={`Requested by ${req.requestedBy} · ${req.daysInCurrentStage} day${req.daysInCurrentStage !== 1 ? "s" : ""} pending`}
                rightContent={<RequestStatusBadge status={req.status} />}
                urgency={req.daysInCurrentStage > 14 ? "high" : req.daysInCurrentStage > 7 ? "medium" : null}
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
              <div key={gs.id}>
                <ActionCard
                  icon={<Ico name="flag" size={20} />}
                  title={`${gs.gateLabel} — ${gs.projectTitle}`}
                  subtitle={`Submitted by ${gs.submittedBy} · ${gs.daysAtGate} day${gs.daysAtGate !== 1 ? "s" : ""} at gate`}
                  rightContent={<RequestStatusBadge status={gs.status} />}
                  urgency={gs.daysAtGate > 14 ? "high" : gs.daysAtGate > 7 ? "medium" : null}
                  onClick={() => setRoute({ view: "project", projectId: gs.projectId, from: "actions" })}
                />
                <ApprovalLogPanel log={gs.approvalLog} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending closure approvals */}
      {pendingClosures.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Project Closure Approvals
            <span style={{ background: "#f0fdf4", color: "#15803d", padding: "1px 8px", borderRadius: 10, marginLeft: 6, fontSize: 11 }}>{pendingClosures.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingClosures.map(cl => (
              <div key={cl.id}>
                <ActionCard
                  icon={<Ico name="lock" size={20} />}
                  title={`${cl.projectTitle}${cl.projectCode ? ` (${cl.projectCode})` : ""}`}
                  subtitle={`PM: ${cl.projectManager} · ${cl.daysInClosure} day${cl.daysInClosure !== 1 ? "s" : ""} in closure · Pending with ${cl.pendingWith || "—"}`}
                  rightContent={<RequestStatusBadge status={cl.status || "In Review"} />}
                  urgency={cl.daysInClosure > 14 ? "high" : cl.daysInClosure > 7 ? "medium" : null}
                />
                <ApprovalLogPanel log={cl.approvalLog} />
              </div>
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
                icon={<Ico name="calendar" size={20} color="#dc2626" />}
                title={m.name}
                subtitle={`${m.projectName} · Due ${m.date} · Owner: ${m.owner}`}
                urgency="high"
                onClick={() => setRoute({ view: "project", projectId: m.projectId, from: "actions" })}
              />
            ))}
          </div>
        </div>
      )}

      {/* PMO: updates awaiting validation */}
      {pendingValidations.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Updates Pending Validation
            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 8px", borderRadius: 10, marginLeft: 6, fontSize: 11 }}>{pendingValidations.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingValidations.map(p => (
              <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", color: T.muted }}><Ico name="clipboard" size={20} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    PM: {p.pm}
                    {p.lastSubmittedBy && ` · Submitted by ${p.lastSubmittedBy}`}
                    {p.lastSubmittedDate && ` · ${p.lastSubmittedDate}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    disabled={saving}
                    onClick={() => handleValidate(p)}
                    style={{ background: "#dcfce7", border: "1px solid #16a34a", color: "#15803d", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✓ Validate
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => { setReturnModal(p); setReturnNote(""); }}
                    style={{ background: "#fef3c7", border: "1px solid #d97706", color: "#92400e", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ↩ Return
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return note modal */}
      {returnModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>Return Update for Revision</div>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>{returnModal.name} · PM: {returnModal.pm}</div>
            <textarea
              value={returnNote}
              onChange={e => setReturnNote(e.target.value)}
              placeholder="Explain what needs to be corrected before resubmission…"
              rows={4}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", background: T.bg, color: T.text }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setReturnModal(null)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
              <button
                disabled={saving || !returnNote.trim()}
                onClick={handleReturn}
                style={{ background: "#fef3c7", border: "1px solid #d97706", color: "#92400e", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: returnNote.trim() ? "pointer" : "not-allowed", opacity: returnNote.trim() ? 1 : 0.5 }}>
                {saving ? "Sending…" : "↩ Return to PM"}
              </button>
            </div>
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

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN PANEL — system administration
// ════════════════════════════════════════════════════════════════════════════
//  Only visible to Admin and PMO Head roles. Provides project CRUD (create,
//  edit, archive, restore, hard-delete), department management (via DeptCRUD),
//  and a quick view of archived projects for restore. Hard-delete is gated
//  behind a confirmation step because it removes the SP item permanently.
//
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
    // No initial values for phase / riskLevel / budgetStatus — those are derived
    // from gate, open risks, and budget vs actualCost respectively (Phase 2
    // simplification). Setting them here would create dead state.
    setFormData({ name: "", code: "", deptId: "strategy", pm: "", sponsor: "", gate: "Gate 1", status: "Not Started", priority: "Medium", progress: 0, budget: 0, startDate: "", plannedEnd: "", objective: "", strategic: "" });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingProject(p.id);
    // Initialise the toggle state from the project's current optional documents,
    // so the chips reflect what's already on the project (otherwise the user has
    // to re-pick them every time, and saving would silently lose them).
    const currentOptional = (p.documents || [])
      .filter(d => OPTIONAL_DOCS.includes(d.name))
      .map(d => d.name);
    setFormData({ ...p, requiredDocs: currentOptional });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) { showToast("Project name and code are required", "error"); return; }
    try {
      if (editingProject) {
        // Reconcile requiredDocs toggle ↔ documents array. Keep any docs the
        // user added via the Update Panel (custom names, not in OPTIONAL_DOCS),
        // keep all mandatory docs, and add/remove optional docs to match what
        // the user has toggled on the form right now.
        const selected = formData.requiredDocs || [];
        const existing = formData.documents || [];
        const kept = existing.filter(d => {
          // Mandatory always stays
          if (d.required && (d.type === "Charter" || d.type === "Business Case" || d.type === "Closure")) return true;
          // Optional preset: keep only if still toggled on
          if (OPTIONAL_DOCS.includes(d.name)) return selected.includes(d.name);
          // Custom doc (added via Update Panel): always keep
          return true;
        });
        const existingNames = new Set(kept.map(d => d.name));
        const additions = selected
          .filter(name => !existingNames.has(name))
          .map((name, i) => ({
            id: `OD${Date.now()}${i}`,
            name, type: name,
            required: false, status: "Pending",
            version: "", lastUpdated: "",
          }));
        const merged = { ...formData, documents: [...kept, ...additions] };
        await onSaveForm(merged, "edit", formData.spId, formData.id);
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
          documents: [
            ...MANDATORY_DOCS,
            ...(formData.requiredDocs || []).map((name, i) => ({
              id: `OD${i + 1}`, name, type: name,
              required: false, status: "Pending", version: "", lastUpdated: "",
            })),
          ],
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
            <div style={{ marginBottom: 12 }}><Ico name="trash" size={34} color="#dc2626" /></div>
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
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="lock" size={13} /> Admin Access</div>
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
                  <Field label="Gate" field="gate" options={["Gate 1", "Gate 2", "Gate 3", "Gate 4", "Gate 5"]} {...fp} />
                  <Field label="Status" field="status" options={["Not Started", "On Track", "At Risk", "Delayed", "Completed"]} {...fp} />
                  <Field label="Priority" field="priority" options={["Low", "Medium", "High", "Critical"]} {...fp} />
                  <Field label="Budget (SAR)" field="budget" type="number" {...fp} />
                  <Field label="Progress %" field="progress" type="number" {...fp} />
                  <Field label="Start Date" field="startDate" type="date" {...fp} />
                  <Field label="Planned End Date" field="plannedEnd" type="date" {...fp} />
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
                {["Code", "Project Name", "Department", "PM", "Progress", "IPI", "Status", "Gate", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{activeProjects.map(p => {
                const ipi = calcProjectIPI(p);
                const ipiC = ipiColor(ipi);
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: T.primary }}>{p.code}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{departments.find(d => d.id === p.deptId)?.name}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.pm}</td>
                    <td style={{ padding: "12px 14px", minWidth: 100 }}>
                      {(() => { const ep = effectiveProgress(p); return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1 }}><Progress value={ep} height={4} /></div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{ep}%</span>
                        </div>
                      ); })()}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {ipi == null
                        ? <span style={{ fontSize: 11, color: T.muted }}>—</span>
                        : <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                            <span title={ipiC.label} style={{ background: ipiC.bg, color: ipiC.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{ipi}</span>
                            <ScoreChips project={p} size="sm" />
                          </div>}
                    </td>
                    <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.gate}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(p)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: T.text }}>Edit</button>
                        <button onClick={() => setRoute({ view: "project", projectId: p.id, from: "admin" })} style={{ background: "#e8f5f0", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: T.primary, fontWeight: 600 }}>View</button>
                        <button onClick={() => handleDelete(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Archive</button>
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === "Archived" && (
        <div>
          {/* Banner — theme-aware, soft orange tint that works on light & dark */}
          <div style={{
            background: themeStore.dark ? "rgba(124, 45, 18, 0.20)" : "#fff7ed",
            border: `1px solid ${themeStore.dark ? "rgba(234, 88, 12, 0.35)" : "#fed7aa"}`,
            borderRadius: 12, padding: "14px 20px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ display: "inline-flex", color: T.muted }}><Ico name="archive" size={20} /></span>
            <div>
              <div style={{ fontWeight: 700, color: themeStore.dark ? "#fed7aa" : "#9a3412", fontSize: 14 }}>Archived Projects — {archivedProjects.length} projects</div>
              <div style={{ fontSize: 12, color: themeStore.dark ? "rgba(254, 215, 170, 0.7)" : "#9a3412", opacity: themeStore.dark ? 1 : 0.75 }}>Archived projects are hidden from all dashboards and reports. You can restore them anytime or delete permanently.</div>
            </div>
          </div>

          {archivedProjects.length === 0 ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
              <div style={{ marginBottom: 12 }}><Ico name="check" size={34} color="#16a34a" /></div>
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
                          Delete Forever
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
// ════════════════════════════════════════════════════════════════════════════
//  DEPARTMENTS OVERVIEW — cross-department comparison
// ════════════════════════════════════════════════════════════════════════════
//  All departments side by side. Each card shows the department's IPI, the
//  status mix of its projects, average progress, total budget and high-risk
//  count. Sort options let you surface leaders or laggards instantly. Clicking
//  a card drills into the single Department view.
//
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

    // avg SPI / CPI / MCI from computed IPI components — null-aware
    const ipiResults = dp.map(p => calcProjectIPIFull(p));
    const measuredFor = (key) => ipiResults.map(r => r.components[key]).filter(v => v != null);
    const avgOf = (vals) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const avgSPI = avgOf(ipiResults.map(r => r.components.spiFinal ?? r.components.spi).filter(v => v != null));
    const avgCPI = avgOf(measuredFor("cpi"));
    const avgMCI = avgOf(measuredFor("mci"));

    // docs compliance across all dept docs
    const allDocs = dp.flatMap(p => p.documents ?? []);
    const readyDocs = allDocs.filter(doc => ["Approved","Final","Received","Current","Submitted"].includes(doc.status));
    const docsCompliance = allDocs.length ? Math.round((readyDocs.length / allDocs.length) * 100) : 0;

    const openRisks = dp.flatMap(p => p.risks ?? []).filter(r => r.status === "Open").length;
    const openIssues = dp.flatMap(p => p.issues ?? []).filter(i => i.status !== "Closed").length;
    const escalated = dp.flatMap(p => p.issues ?? []).filter(i => i.escalated).length;

    return { ...d, dp, stats, deptIPI, ipiC, avgSPI, avgCPI, avgMCI, docsCompliance, openRisks, openIssues, escalated };
  }), [activeProjects, departments]);

  const sorted = useMemo(() => {
    const arr = [...deptData];
    if (sort === "ipi-desc") arr.sort((a, b) => (b.deptIPI ?? -1) - (a.deptIPI ?? -1));
    if (sort === "ipi-asc")  arr.sort((a, b) => (a.deptIPI ?? 101) - (b.deptIPI ?? 101));
    if (sort === "projects")  arr.sort((a, b) => b.stats.total - a.stats.total);
    if (sort === "name")      arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [deptData, sort]);

  // portfolio IPI = budget×priority weighted across all active projects (not avg of dept IPIs)
  const portfolioIPI = calcPortfolioIPI(activeProjects);
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
          <div style={{ fontSize: 36, fontWeight: 900, color: portfolioIpiC.color, lineHeight: 1 }}>{portfolioIPI ?? "—"}</div>
          <div style={{ fontSize: 11, color: portfolioIpiC.color, fontWeight: 700, marginTop: 2 }}>Portfolio IPI</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.headerText, marginBottom: 4 }}>Enterprise Portfolio Performance Index</div>
          <div style={{ fontSize: 12, color: T.headerText, opacity: 0.7, marginBottom: 12 }}>
            Budget × Priority weighted across all active projects — SPI (auto from activities) ×50% + CPI (auto from budget) ×25% + MCI (compliance) ×25%
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "On Track 100+",  color: "#15803d" },
              { label: "Watch 90–99",    color: "#854d0e" },
              { label: "At Risk 70–89",  color: "#c05621" },
              { label: "Critical <70",   color: "#991b1b" },
              { label: "No Data",        color: "#6b7280" },
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
              <Tooltip formatter={v => [v == null ? "No measurable IPI" : `IPI: ${v}`, ""]} {...ttStyle()} />
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
                <DeptTile name={d.name} color={deptColor(d.id)} size={34} radius={9} solid />
                <div>
                  <div style={{ color: T.headerText, fontWeight: 800, fontSize: 14 }}>{d.name}</div>
                  <div style={{ color: T.headerText, fontSize: 11, opacity: 0.7 }}>{d.stats.total} projects</div>
                </div>
              </div>
              {/* IPI score */}
              <div style={{ background: d.ipiC.bg, borderRadius: 12, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: d.ipiC.color, lineHeight: 1 }}>{d.deptIPI ?? "—"}</div>
                <div style={{ fontSize: 9, color: d.ipiC.color, fontWeight: 700 }}>IPI</div>
              </div>
            </div>

            {/* Component averages across the dept's projects.
                These are AVERAGES of each project's snapshot components — NOT
                contributions to the dept IPI on the right. The dept IPI is a
                budget×priority weighted rollup of project-level IPIs (each of
                which already re-normalises across present components), so a
                naive sum of these averages won't reproduce it. The previous
                "44pts + 25pts + 25pts" labels implied a sum that wasn't real
                and confused reviewers — removed. */}
            <div style={{ padding: "10px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: T.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Snapshot averages across {d.stats.total} project{d.stats.total === 1 ? "" : "s"}
              </span>
              <span style={{ fontSize: 9, color: T.muted, opacity: 0.7 }}>
                informational · dept IPI uses budget × priority weighting
              </span>
            </div>
            <div style={{ padding: "4px 20px 14px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Avg SPI", value: d.avgSPI != null ? d.avgSPI.toFixed(2) : "—", color: d.avgSPI == null ? "#6b7280" : d.avgSPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "Avg CPI", value: d.avgCPI != null ? d.avgCPI.toFixed(2) : "—", color: d.avgCPI == null ? "#6b7280" : d.avgCPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "Avg MCI", value: d.avgMCI != null ? `${Math.round(d.avgMCI * 100)}%` : "—", color: d.avgMCI == null ? "#6b7280" : d.avgMCI >= 0.8 ? "#16a34a" : "#dc2626" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 9.5, color: T.muted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Project status breakdown */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Project Status</span>
                <span style={{ fontSize: 11, color: T.muted }}>{d.stats.total} total</span>
              </div>
              {(() => {
                // stats.active = onTrack + atRisk. We display each separately
                // so the breakdown is honest. Not Started = anything left over.
                const notStarted = Math.max(0, d.stats.total - d.stats.onTrack - d.stats.atRisk - d.stats.delayed - d.stats.completed);
                const buckets = [
                  { label: "On Track",    val: d.stats.onTrack,   color: "#16a34a" },
                  { label: "At Risk",     val: d.stats.atRisk,    color: "#ea580c" },
                  { label: "Delayed",     val: d.stats.delayed,   color: "#dc2626" },
                  { label: "Done",        val: d.stats.completed, color: "#3b82f6" },
                  { label: "Not Started", val: notStarted,        color: "#94a3b8" },
                ];
                return (
                  <>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {d.stats.total > 0 && buckets.map(({ val, color, label }) => val > 0 && (
                        <div key={label} title={`${label}: ${val}`} style={{ height: 6, flex: val, background: color, borderRadius: 4 }} />
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${notStarted > 0 ? 5 : 4}, 1fr)`, gap: 4 }}>
                      {buckets.filter(b => !(b.label === "Not Started" && b.val === 0)).map(({ label, val, color }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                          <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
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
// ════════════════════════════════════════════════════════════════════════════
//  ALL PROJECTS — master portfolio table
// ════════════════════════════════════════════════════════════════════════════
//  Every project across every department in one searchable, filterable table.
//  Filters: status, risk, type, department, gate, roadmap flag. Export to
//  Excel for offline analysis. Inbound deep-links from the Home Hero cards
//  pre-apply filters (e.g. clicking "Forecast Overrun" lands here with the
//  overrun filter on).
//
const AllProjectsView = ({ projects, setRoute, route, userRole = ROLE_ADMIN }) => {
  const { departments } = useDepts();
  const T = useT();
  const bp = useBp();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(route?.filterStatus || "All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterRoadmap, setFilterRoadmap] = useState(false);
  const [showCompleted, setShowCompleted] = useState(route?.filterStatus === "Completed");
  const [filterOverrun, setFilterOverrun] = useState(!!route?.filterOverrun);
  // Column sort: { key: 'ipi' | 'progress' | 'name' | 'lastUpdate' | etc, dir: 'asc' | 'desc' } or null
  const [sort, setSort] = useState(null);

  const active = projects.filter(p => !p.archived);
  const completedCount = active.filter(p => p.status === "Completed").length;

  const filtered = useMemo(() => active.filter(p => {
    const matchSearch  = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || (p.pm || "").toLowerCase().includes(search.toLowerCase()) || (p.sponsor || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus  = filterStatus === "All"
      ? (showCompleted || p.status !== "Completed")
      : p.status === filterStatus;
    const matchDept    = filterDept    === "All" || p.deptId      === filterDept;
    const matchType    = filterType    === "All" || p.projectType === filterType;
    const matchRoadmap  = !filterRoadmap  || p.isRoadmap === true;
    const matchOverrun  = !filterOverrun  || (p.budget > 0 && (p.forecast || 0) > p.budget);
    return matchSearch && matchStatus && matchDept && matchType && matchRoadmap && matchOverrun;
  }), [active, search, filterStatus, filterDept, filterType, filterRoadmap, showCompleted, filterOverrun]);

  // Apply sort on top of filter. null IPIs (Pending Plan) sink to the bottom
  // regardless of direction so unmeasurable projects never sit on top.
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const k = sort.key, d = sort.dir === "asc" ? 1 : -1;
    const getter = {
      ipi:        (p) => calcProjectIPI(p),
      progress:   (p) => effectiveProgress(p),
      name:       (p) => (p.name || "").toLowerCase(),
      code:       (p) => p.code || "",
      status:     (p) => p.status || "",
      gate:       (p) => p.gate || "",
      lastUpdate: (p) => p.lastUpdate || "",
      pm:         (p) => (p.pm || "").toLowerCase(),
      dept:       (p) => (departments.find(x => x.id === p.deptId)?.name || "").toLowerCase(),
    }[k] || ((p) => p[k]);
    return [...filtered].sort((a, b) => {
      const va = getter(a), vb = getter(b);
      // Null/undefined IPI (Pending Plan) always sinks to the bottom
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * d;
      if (va > vb) return  1 * d;
      return 0;
    });
  }, [filtered, sort, departments]);

  // Click a header → cycle: unsorted → asc → desc → unsorted
  const toggleSort = (key) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };
  const sortArrow = (key) => {
    if (!sort || sort.key !== key) return null;
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 20 : 24, fontWeight: 900, color: T.text }}>
            {userRole === ROLE_PM ? "My Projects" : "All Projects"}
          </h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>
            {userRole === ROLE_PM
              ? `Projects where you are the assigned PM · ${active.length} active`
              : `Complete portfolio · ${active.length} active projects across all departments`}
          </p>
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
        <button onClick={() => setFilterRoadmap(v => !v)} style={{ background: filterRoadmap ? T.primary : T.surface, color: filterRoadmap ? "#fff" : T.muted, border: `1px solid ${filterRoadmap ? T.primary : T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: filterRoadmap ? 700 : 400 }}>
          <Ico name="map" size={13} /> Roadmap{filterRoadmap ? " ✓" : ""}
        </button>
        <button onClick={() => setShowCompleted(v => !v)} style={{ background: showCompleted ? T.btnPrimBg : T.surface, color: showCompleted ? T.btnPrimText : T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
          {showCompleted ? "Hide Completed" : `+ ${completedCount} Completed`}
        </button>
        <button onClick={() => { const dm = Object.fromEntries(departments.map(d => [d.id, d.name])); exportExcel(filtered, `all-projects-${TODAY}.xls`, dm); }}
          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", color: T.text, whiteSpace: "nowrap", fontWeight: 600 }}>
          ↓ Export XLS
        </button>
        {filterOverrun && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#991b1b", fontWeight: 600, whiteSpace: "nowrap" }}>
            Forecast Overrun
            <button onClick={() => setFilterOverrun(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontSize: 14, padding: 0, lineHeight: 1, fontWeight: 700, marginLeft: 2 }}>×</button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{filtered.length} results</div>
      </div>
      <div className="pmo-table-wrap" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: T.bg }}>
            {[
              { lbl: "Code",         key: "code" },
              { lbl: "Project Name", key: "name" },
              { lbl: "Type",         key: null },
              { lbl: "Department",   key: "dept" },
              { lbl: "PM",           key: "pm" },
              { lbl: "Progress",     key: "progress" },
              { lbl: "IPI",          key: "ipi" },
              { lbl: "Status",       key: "status" },
              { lbl: "Risk",         key: null },
              { lbl: "Budget",       key: null },
              { lbl: "Gate",         key: "gate" },
              { lbl: "Last Update",  key: "lastUpdate" },
            ].map(h => {
              const sortable = !!h.key;
              const isActive = sort && sort.key === h.key;
              return (
                <th key={h.lbl}
                  onClick={sortable ? () => toggleSort(h.key) : undefined}
                  style={{
                    padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700,
                    color: isActive ? T.primary : T.muted,
                    textTransform: "uppercase", whiteSpace: "nowrap",
                    cursor: sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}>
                  {h.lbl}{sortable && sortArrow(h.key)}
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={99} style={{ padding: "48px 20px", textAlign: "center" }}>
                <div style={{ opacity: 0.4, marginBottom: 10 }}><Ico name="inbox" size={26} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  {userRole === ROLE_PM && active.length === 0 ? "No projects assigned to you yet" : "No projects match the current filters"}
                </div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
                  {userRole === ROLE_PM && active.length === 0
                    ? "A project appears here when you are its PM or backup PM — the PM Email (or Backup PM Email) on the project must match the email you sign in with. If you expect to see a project, ask the PMO to verify it."
                    : "Try clearing the search box or resetting the filters above."}
                </div>
              </td></tr>
            )}
            {sorted.map((p, i) => {
              const dept = departments.find(d => d.id === p.deptId);
              const ipi = calcProjectIPI(p);
              const ipiC = ipiColor(ipi);
              const staleDays = daysSince(p.lastUpdate);
              return (
                <tr key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id, from: "projects" })}
                  className={p.status === "Delayed" ? "pmo-row-delayed" : ""}
                  style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.1s",
                    background: p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? "transparent" : T.bg) }}
                  onMouseEnter={e => e.currentTarget.style.background = themeStore.dark ? '#132820' : '#f0f7f4'}
                  onMouseLeave={e => e.currentTarget.style.background = p.status === "Delayed" ? (themeStore.dark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.04)") : (i % 2 === 0 ? 'transparent' : T.bg)}>
                  <td style={{ padding: "12px 14px", fontSize: 11, fontWeight: 700, color: T.primary }}>{p.code}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</span>
                      {p.isRoadmap && <span style={{ fontSize: 9, fontWeight: 800, background: T.primary, color: "#fff", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>ROADMAP</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: deptColor(p.deptId), flexShrink: 0 }} /><span style={{ color: T.muted }}>{dept?.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px", minWidth: 90 }}>
                    {(() => { const ep = effectiveProgress(p); return (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1 }}><Progress value={ep} height={4} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{ep}%</span>
                      </div>
                    ); })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {ipi == null
                      ? <span style={{ fontSize: 11, color: T.muted }}>—</span>
                      : <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <span title={ipiC.label} style={{ background: ipiC.bg, color: ipiC.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{ipi}</span>
                          <ScoreChips project={p} size="sm" />
                        </div>}
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={deriveRiskLevel(p)} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: deriveBudgetStatus(p) === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{deriveBudgetStatus(p)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.lastUpdate || "—"}</div>
                    {staleDays != null && staleDays >= 14 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8, background: staleDays >= 30 ? "#fee2e2" : "#ffedd5", color: staleDays >= 30 ? "#991b1b" : "#9a3412" }}>{staleDays}d ago</span>
                    )}
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

// Compute a milestone's effective progress from its children (weighted average).
// Falls back to the milestone's own progress field when it has no children.
const milestoneProgress = (milestone, allItems) => {
  const children = allItems.filter(i => i.parentId === milestone.id);
  if (children.length === 0) return milestone.progress ?? 0;
  const totalW = children.reduce((s, c) => s + (c.weight || 1), 0);
  if (totalW === 0) return 0;
  const sumW = children.reduce((s, c) => s + (c.weight || 1) * (c.progress || 0), 0);
  return Math.round(sumW / totalW);
};

// MilestoneRow is defined at module scope (NOT inside the editor). Defining it
// inside the parent would give every render a new function reference, which
// makes React unmount/remount the inputs on every keystroke — kills focus.
const STATUS_CHIP = {
  Completed:     { bg: "#dcfce7", text: "#15803d" },
  "In Progress": { bg: "#fef9c3", text: "#854d0e" },
  Upcoming:      { bg: "#f3f4f6", text: "#6b7280" },
  Delayed:       { bg: "#fee2e2", text: "#991b1b" },
};

const MilestoneRow = ({ item, isActivity, items, upd, remove, move }) => {
  const T = useT();
  const s = fInputStyle(T, false);
  const ss = { ...s, background: T.selectBg };
  const c = STATUS_CHIP[item.status] || STATUS_CHIP.Upcoming;
  const kids = items.filter(i => i.parentId === item.id);
  const autoProgress = !isActivity && kids.length > 0 ? milestoneProgress(item, items) : null;
  const progress = autoProgress != null ? autoProgress : (item.progress ?? 0);
  // Sibling position so we can disable the move buttons at the edges
  const siblings = items.filter(x => (x.parentId || null) === (item.parentId || null));
  const sibIdx = siblings.findIndex(x => x.id === item.id);
  const canUp = sibIdx > 0;
  const canDown = sibIdx < siblings.length - 1;
  const arrowBtn = (enabled) => ({
    background: enabled ? T.bg : "transparent",
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
    color: enabled ? T.text : T.muted,
    fontWeight: 800,
    fontSize: 10,
    padding: "4px 8px",
    opacity: enabled ? 1 : 0.35,
    lineHeight: 1,
  });
  return (
    <div style={{
      background: isActivity ? T.surface : T.bg,
      borderRadius: 10,
      padding: 12,
      border: `1px solid ${T.border}`,
      marginBottom: 8,
      borderLeft: isActivity ? `3px solid ${T.accent}` : `4px solid ${T.primary}`,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: "0.06em" }}>
          {isActivity ? "ACTIVITY" : "MILESTONE"}
        </span>
        <input value={item.name} onChange={e => upd(item.id, "name", e.target.value)}
          placeholder={isActivity ? "Activity name *" : "Milestone name *"}
          style={{ ...s, fontWeight: 600 }} />
        <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{item.status}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => canUp && move(item.id, "up")} title="Move up" disabled={!canUp} style={arrowBtn(canUp)}>▲</button>
          <button onClick={() => canDown && move(item.id, "down")} title="Move down" disabled={!canDown} style={arrowBtn(canDown)}>▼</button>
          <button onClick={() => remove(item.id)} title="Remove" style={{ background: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer", color: "#dc2626", fontWeight: 900, fontSize: 14, padding: "4px 10px", marginLeft: 2 }}>×</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>{isActivity ? "Start Date" : "Start (optional)"}</div>
          <input type="date" value={item.startDate || ""} onChange={e => upd(item.id, "startDate", e.target.value)} style={s} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>{isActivity ? "End Date" : "Target Date"}</div>
          <input type="date" value={item.date || ""} onChange={e => upd(item.id, "date", e.target.value)} style={s} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Status</div>
          <select value={item.status} onChange={e => upd(item.id, "status", e.target.value)} style={ss}>
            {["Upcoming","In Progress","Completed","Delayed"].map(x => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Owner</div>
          <input value={item.owner} onChange={e => upd(item.id, "owner", e.target.value)} placeholder="Owner" style={s} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.muted }}>
              Progress {autoProgress != null && <span style={{ color: T.accent, fontWeight: 700 }}>· auto from {kids.length} {kids.length === 1 ? "activity" : "activities"}</span>}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{progress}%</span>
          </div>
          {autoProgress != null
            ? <div style={{ width: "100%", height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: T.accent }} /></div>
            : <input type="range" min={0} max={100} step={1} value={item.progress ?? 0}
                onChange={e => upd(item.id, "progress", Number(e.target.value))}
                style={{ width: "100%", accentColor: T.accent, cursor: "pointer" }} />
          }
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Weight</div>
          <input type="number" min={1} max={10} value={item.weight ?? 1}
            onChange={e => upd(item.id, "weight", Math.max(1, Number(e.target.value)))} style={s} />
        </div>
      </div>
    </div>
  );
};

const MilestoneListEditor = ({ items, onChange }) => {
  const T = useT();

  const milestones = items.filter(m => !m.parentId);
  const childrenOf  = (id) => items.filter(m => m.parentId === id);

  const addMilestone = () => {
    const id = `M${Date.now()}`;
    onChange([...items, { id, name: "", startDate: "", date: "", status: "Upcoming", owner: "", progress: 0, weight: 1, parentId: null }]);
  };
  const addActivity = (parentId) => {
    const id = `A${Date.now()}`;
    onChange([...items, { id, name: "", startDate: "", date: "", status: "Upcoming", owner: "", progress: 0, weight: 1, parentId }]);
  };
  const remove = (id) => {
    // Also drop any children when removing a milestone
    onChange(items.filter(m => m.id !== id && m.parentId !== id));
  };
  const upd = (id, k, v) => onChange(items.map(m => m.id === id ? { ...m, [k]: v } : m));
  // Reorder among siblings: a top-level milestone swaps with another top-level
  // milestone; an activity swaps with another activity under the same parent.
  // All downstream views (Activities tab, Gantt, Print Report) re-group by
  // parent at render time, so the swap propagates cleanly everywhere.
  const move = (id, dir) => {
    const item = items.find(x => x.id === id);
    if (!item) return;
    const parentKey = item.parentId || null;
    const siblings = items.filter(x => (x.parentId || null) === parentKey);
    const sibIdx = siblings.findIndex(x => x.id === id);
    const targetSibIdx = dir === "up" ? sibIdx - 1 : sibIdx + 1;
    if (targetSibIdx < 0 || targetSibIdx >= siblings.length) return;
    const targetId = siblings[targetSibIdx].id;
    const aIdx = items.findIndex(x => x.id === id);
    const bIdx = items.findIndex(x => x.id === targetId);
    const next = [...items];
    [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
    onChange(next);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Activities</span>
          {milestones.length > 0 && <span style={{ fontSize: 11, color: T.muted, fontWeight: 400, marginLeft: 8 }}>{milestones.length} milestones · {items.length - milestones.length} activities</span>}
        </div>
        <button onClick={addMilestone} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Milestone</button>
      </div>
      {milestones.length === 0 && <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: "20px 0" }}>No milestones yet — start by adding a milestone, then add activities under it</div>}
      {milestones.map(m => (
        <div key={m.id} style={{ marginBottom: 12 }}>
          <MilestoneRow item={m} items={items} upd={upd} remove={remove} move={move} />
          <div style={{ marginLeft: 24, paddingLeft: 12, borderLeft: `2px dashed ${T.border}` }}>
            {childrenOf(m.id).map(a => <MilestoneRow key={a.id} item={a} isActivity items={items} upd={upd} remove={remove} move={move} />)}
            <button onClick={() => addActivity(m.id)}
              style={{ background: "transparent", border: `1px dashed ${T.accent}`, color: T.accent, borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
              + Add Activity under "{m.name || "this milestone"}"
            </button>
          </div>
        </div>
      ))}
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
  const blank = { title: "", severity: "Medium", status: "Open", owner: "", raised: today, escalated: false, targetDate: "" };
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
            {i.targetDate && <span style={{ background: i.targetDate < today && i.status !== "Resolved" ? "#fee2e2" : "#f3f4f6", color: i.targetDate < today && i.status !== "Resolved" ? "#dc2626" : "#6b7280", borderRadius: 10, padding: "2px 8px" }}>Due: {i.targetDate}</span>}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Target Close Date</div>
              <input type="date" value={draft.targetDate} onChange={e => setDraft(p => ({ ...p, targetDate: e.target.value }))} style={s} />
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
  const blank = { kpi: "", category: "Financial", owner: "", baseline: "0", target: "0", current: "0", realization: 0, contribution: "Medium", expectedDate: "" };
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
            <div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 3 }}>Expected Date</div>
              <input type="date" value={b.expectedDate || ""} onChange={e => upd(b.id, "expectedDate", e.target.value)} style={s} />
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
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Expected Realization Date</div>
              <input type="date" value={draft.expectedDate || ""} onChange={e => setDraft(p => ({ ...p, expectedDate: e.target.value }))} style={s} />
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
// ════════════════════════════════════════════════════════════════════════════
//  PROJECT FORM — create / edit project (Admin)
// ════════════════════════════════════════════════════════════════════════════
//  The single largest form in the portal. Used by Admin and PMO roles to
//  create a new project or edit any of the system-owned fields on an
//  existing one (PM/Sponsor/Department/Dates/Priority/Type/Budget/etc.).
//  Validates required fields, supports milestone/risk/issue/benefit lists
//  via the dedicated editors defined right above this component.
//
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
    projectType: "Enterprise Project", gate: "Gate 1",
    status: "Not Started", priority: "Medium",
    classification: "Strategic", strategic: "",
    objective: "", businessCase: "",
    startDate: today, plannedEnd: "", roadmapDeadline: "",
    baselineEnd: "", baselineExceptionNote: "",
    // Progress is auto-derived from the WBS on save (see handleSave) — these
    // 0 defaults seed new projects until activities are added.
    progress: 0, plannedProgress: 0,
    budget: 0, forecast: 0, actualCost: 0,
    // No phase / riskLevel / budgetStatus / health / spi / cpi / daysRemaining /
    // daysDelayed / scheduleVariance: all derived from raw data at render time
    // (Phase 2 simplification). Seeding them here would create dead state.
    milestones: [], risks: [], issues: [], updates: [], benefits: [], approvals: [],
    documents: [...MANDATORY_DOCS], requiredDocs: [],
    gates: GATE_DEFS.map(g => ({ id: g.id, status: "Pending", date: null, approver: "", notes: "" })),
    updateCadence: "Biweekly", archived: false, pmoStatus: "Draft", dataReliabilityFlag: "Pending",
    isRoadmap: false,
    _newUpdate: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Inline "Add Document" form state — PMO/Admin use this in step 4 (Documents)
  // to register any custom document (BRD, Project Plan, etc.).
  const [newDocName,   setNewDocName]   = useState("");
  const [newDocGate,   setNewDocGate]   = useState(1);
  const [newDocStatus, setNewDocStatus] = useState("Pending");
  const [newDocUrl,    setNewDocUrl]    = useState("");

  // A doc is "mandatory" (system-locked) when it's one of the three default
  // governance artefacts: Charter, Business Case, Closure. Their `required`
  // flag and IPI contribution are non-negotiable.
  const isMandatoryDoc = (doc) =>
    doc.required && doc.id && typeof doc.id === "string" && /^D\d+$/.test(doc.id);

  const addCustomDoc = () => {
    const name = newDocName.trim();
    if (!name) return;
    const doc = {
      id: `CD${Date.now()}`,
      name, type: "Custom",
      required: true,                  // default: counts in IPI; user can toggle off
      requiredAtGate: newDocGate,
      status: newDocStatus,
      url: newDocUrl.trim(),
      version: "",
      lastUpdated: new Date().toISOString().split("T")[0],
    };
    set("documents", [...(form.documents || []), doc]);
    setNewDocName(""); setNewDocUrl("");
    setNewDocStatus("Pending");
  };

  const updateDoc = (i, patch) => {
    const next = (form.documents || []).map((d, j) => j === i ? { ...d, ...patch } : d);
    set("documents", next);
  };
  const removeDoc = (i) => {
    const next = (form.documents || []).filter((_, j) => j !== i);
    set("documents", next);
  };

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
      // Auto-sync project.progress with WBS when milestones exist
      const wbsP = calcProjectProgressFromWBS({ milestones: form.milestones || [] });
      const payload = wbsP != null ? { ...form, progress: wbsP } : form;
      await onSaveForm(payload, mode, existing?.spId, existing?.id);
      setRoute(mode === "edit" ? { view: "project", projectId: existing?.id } : { view: "projects" });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { label: "Basic Info", icon: "clipboard" },
    { label: "Timeline & Budget", icon: "calendar" },
    { label: "Activities", icon: "target" },
    { label: "Risks & Issues", icon: "alert" },
    { label: "Documents", icon: "doc" },
    { label: "Updates", icon: "note" },
  ];

  const s = fInputStyle(T, false);
  const sErr = k => fInputStyle(T, !!errors[k]);
  const ss = { ...s, background: T.selectBg };

  // RAGBtn / setH lived here for the old Health 8-dim step. That step was
  // dropped in Phase 1 simplification; the form no longer renders any health
  // controls. Cleaned up.

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
          {(() => {
            // One PM shows in the portal; the backup only gains access to
            // update when the PM is away. Both live in the same pmEmail
            // field (comma-joined) so no SP schema change is needed.
            const [pmMain = "", pmBackup = ""] = (form.pmEmail || "").split(/[,;]/).map(x => x.trim());
            const join = (a, b) => [a, b].map(x => (x || "").trim()).filter(Boolean).join(", ");
            return (
              <>
                <FField label="PM Email"><input value={pmMain} onChange={e => set("pmEmail", join(e.target.value, pmBackup))} placeholder="pm@tree.com.sa" type="email" style={s} /></FField>
                <FField label="Backup PM Email"><input value={pmBackup} onChange={e => set("pmEmail", join(pmMain, e.target.value))} placeholder="Optional — can update when the PM is away" type="email" style={s} /></FField>
              </>
            );
          })()}
          <FField label="Sponsor"><input value={form.sponsor} onChange={e => set("sponsor", e.target.value)} placeholder="Full name" style={s} /></FField>
          <FField label="Sponsor Email"><input value={form.sponsorEmail || ""} onChange={e => set("sponsorEmail", e.target.value)} placeholder="sponsor@tree.com.sa" type="email" style={s} /></FField>
          <FField label="Current Gate"><select value={form.gate} onChange={e => set("gate", e.target.value)} style={ss}>{["Gate 1","Gate 2","Gate 3","Gate 4","Gate 5"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Status"><select value={form.status} onChange={e => set("status", e.target.value)} style={ss}>{["Not Started","On Track","At Risk","Delayed","Completed"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Priority"><select value={form.priority} onChange={e => set("priority", e.target.value)} style={ss}>{["Critical","High","Medium","Low"].map(o => <option key={o}>{o}</option>)}</select></FField>
          <FField label="Classification"><input value={form.classification} onChange={e => set("classification", e.target.value)} placeholder="e.g. Strategic Initiative" style={s} /></FField>
          <FField label="Strategic Objective"><input value={form.strategic} onChange={e => set("strategic", e.target.value)} placeholder="e.g. Digital Transformation" style={s} /></FField>
        </div>
        <FField label="Objective"><textarea value={form.objective} onChange={e => set("objective", e.target.value)} rows={3} style={{ ...s, resize: "vertical" }} /></FField>
        <FField label="Business Case"><textarea value={form.businessCase} onChange={e => set("businessCase", e.target.value)} rows={3} style={{ ...s, resize: "vertical" }} /></FField>
        {/* Roadmap toggle */}
        <div onClick={() => set("isRoadmap", !form.isRoadmap)}
          style={{ background: form.isRoadmap ? `${T.primary}18` : T.bg, border: `1.5px solid ${form.isRoadmap ? T.primary : T.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", transition: "all 0.15s" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}><Ico name="map" size={14} /> Roadmap Project</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Tag this project as part of the strategic roadmap — enables Roadmap filter across all views</div>
          </div>
          <div style={{ width: 44, height: 24, borderRadius: 12, background: form.isRoadmap ? T.primary : T.border, position: "relative", flexShrink: 0, transition: "background 0.2s", marginLeft: 16 }}>
            <div style={{ position: "absolute", top: 2, left: form.isRoadmap ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
          </div>
        </div>
      </div>
    );
    if (step === 1) return (
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 16 }}>
        <FField label="Start Date"><input type="date" value={form.startDate || ""} onChange={e => set("startDate", e.target.value)} style={s} /></FField>
        <FField label="Planned End Date"><input type="date" value={form.plannedEnd || ""} onChange={e => set("plannedEnd", e.target.value)} style={s} /></FField>
        <FField label="Roadmap Deadline" title="Strategic checkpoint. Overrunning it raises a Roadmap Breach flag — it does NOT change the IPI math."><input type="date" value={form.roadmapDeadline || ""} onChange={e => set("roadmapDeadline", e.target.value)} style={s} /></FField>
        {(() => {
          const gateN = parseGateNumber(form.gate);
          const locked = gateN >= 3 && !!form.baselineEnd;
          const overRoadmap = form.baselineEnd && form.roadmapDeadline && new Date(form.baselineEnd) > new Date(form.roadmapDeadline);
          return (
            <>
              <FField label="Baseline End (SPI reference)" title="Locked at Gate 3. SPI is always measured against this baseline, never the roadmap.">
                <input type="date" value={form.baselineEnd || ""} disabled={locked}
                  onChange={e => set("baselineEnd", e.target.value)}
                  style={{ ...s, opacity: locked ? 0.65 : 1, cursor: locked ? "not-allowed" : "auto" }} />
                <div style={{ fontSize: 10, color: "#5a7a6e", marginTop: 3 }}>
                  {locked ? "🔒 Locked at Gate 3 — the SPI reference" : gateN >= 3 ? "Will lock to Planned End on save" : "Locks automatically when the project reaches Gate 3"}
                </div>
              </FField>
              {overRoadmap && (
                <FField label="Baseline Exception Note (required)" title="The baseline overruns the roadmap — document why before saving.">
                  <input value={form.baselineExceptionNote || ""} onChange={e => set("baselineExceptionNote", e.target.value)}
                    placeholder="Why the baseline overruns the roadmap…"
                    style={{ ...s, borderColor: String(form.baselineExceptionNote || "").trim() ? undefined : "#FF5000" }} />
                </FField>
              )}
            </>
          );
        })()}
        <FField label="Progress (%)"><input type="number" min={0} max={100} value={form.progress} onChange={e => set("progress", Number(e.target.value))} style={s} /></FField>
        <FField label="Planned Progress (%)"><input type="number" min={0} max={100} value={form.plannedProgress} onChange={e => set("plannedProgress", Number(e.target.value))} style={s} /></FField>
        <FField label="Budget (SAR)"><input type="number" min={0} step={10000} value={form.budget} onChange={e => set("budget", Number(e.target.value))} style={s} /></FField>
        <FField label="Forecast (SAR)"><input type="number" min={0} step={10000} value={form.forecast} onChange={e => set("forecast", Number(e.target.value))} style={s} /></FField>
        <FField label="Actual Cost (SAR)"><input type="number" min={0} step={10000} value={form.actualCost} onChange={e => set("actualCost", Number(e.target.value))} style={s} /></FField>
      </div>
    );
    if (step === 2) return <MilestoneListEditor items={form.milestones} onChange={v => set("milestones", v)} />;
    if (step === 3) return (
      <div>
        <RiskListEditor items={form.risks} onChange={v => set("risks", v)} />
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, marginTop: 4 }}>
          <IssueListEditor items={form.issues} onChange={v => set("issues", v)} />
        </div>
      </div>
    );
    if (step === 4) return (
      <div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>
          Manage project documents. Toggle <strong>Count in IPI</strong> to include a document in the score; choose the gate by which it must be delivered, set status, and paste the SharePoint link.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(form.documents || []).map((doc, i) => {
            const mandatory = isMandatoryDoc(doc);
            return (
            <div key={doc.id || i} style={{ background: T.bg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${T.border}` }}>

              {/* Row 1: name + IPI toggle + gate + status + remove */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {doc.type}
                    {mandatory && <> · <span style={{ color: T.accent, fontWeight: 700 }}>Mandatory</span></>}
                  </div>
                </div>

                {/* Count in IPI toggle — disabled for mandatory (always required) */}
                <label title={mandatory ? "Mandatory document — always counts in IPI" : "Include this document in the IPI score"}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, cursor: mandatory ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox"
                    checked={!!doc.required}
                    disabled={mandatory}
                    onChange={e => updateDoc(i, {
                      required: e.target.checked,
                      requiredAtGate: e.target.checked
                        ? (doc.requiredAtGate || parseGateNumber(form.gate) || 1)
                        : doc.requiredAtGate,
                    })}
                    style={{ cursor: mandatory ? "not-allowed" : "pointer" }}
                  />
                  Count in IPI
                </label>

                {/* Gate selector — only for required docs */}
                {doc.required && (
                  <select value={doc.requiredAtGate || 1}
                    onChange={e => updateDoc(i, { requiredAtGate: parseInt(e.target.value, 10) })}
                    style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, background: T.inputBg, color: T.inputText }}>
                    {[1,2,3,4,5].map(g => <option key={g} value={g}>Due at Gate {g}</option>)}
                  </select>
                )}

                <select value={doc.status || "Pending"}
                  onChange={e => updateDoc(i, { status: e.target.value, lastUpdated: new Date().toISOString().split("T")[0] })}
                  style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, background: T.inputBg, color: T.inputText, cursor: "pointer" }}>
                  {["Pending","Draft","Submitted","Under Review","Approved","Final","Received","Current"].map(s => <option key={s}>{s}</option>)}
                </select>

                {!mandatory && (
                  <button onClick={() => removeDoc(i)} title="Remove this document"
                    style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer" }}>
                    ✕
                  </button>
                )}
              </div>

              {/* Row 2: SharePoint link */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="url"
                  value={doc.url || ""}
                  onChange={e => updateDoc(i, { url: e.target.value })}
                  placeholder="Paste SharePoint link here…"
                  style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 12, background: T.inputBg, color: T.inputText, outline: "none" }}
                />
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: T.accent, whiteSpace: "nowrap", fontWeight: 600 }}>
                    Open ↗
                  </a>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Add Custom Document */}
        <div style={{ marginTop: 18, padding: 14, background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.3px", textTransform: "uppercase", marginBottom: 10 }}>
            + Add Document
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr", gap: 8, marginBottom: 8 }}>
            <input type="text"
              value={newDocName}
              onChange={e => setNewDocName(e.target.value)}
              placeholder="Document name (e.g. BRD, Project Plan)"
              style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, background: T.inputBg, color: T.inputText, outline: "none" }}
            />
            <select value={newDocGate}
              onChange={e => setNewDocGate(parseInt(e.target.value, 10))}
              style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, background: T.inputBg, color: T.inputText }}>
              {[1,2,3,4,5].map(g => <option key={g} value={g}>Due at Gate {g}</option>)}
            </select>
            <select value={newDocStatus}
              onChange={e => setNewDocStatus(e.target.value)}
              style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 13, background: T.inputBg, color: T.inputText }}>
              {["Pending","Draft","Submitted","Under Review","Approved","Final","Received","Current"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="url"
              value={newDocUrl}
              onChange={e => setNewDocUrl(e.target.value)}
              placeholder="SharePoint link (optional)"
              style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, background: T.inputBg, color: T.inputText, outline: "none" }}
            />
            <button onClick={addCustomDoc}
              disabled={!newDocName.trim()}
              style={{
                background: newDocName.trim() ? T.btnPrimBg : T.border,
                color: newDocName.trim() ? T.btnPrimText : T.muted,
                border: "none", borderRadius: 6,
                padding: "8px 18px", fontSize: 13, fontWeight: 700,
                cursor: newDocName.trim() ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}>
              + Add
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: T.muted, fontStyle: "italic" }}>
            New documents default to <strong>Count in IPI = on</strong>. Toggle off in the row above if a document is informational only.
          </div>
        </div>
      </div>
    );
    if (step === 5) return (
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
              border: step === i ? "none" : `1px solid ${T.border}`,
              display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Ico name={st.icon} size={13} /> {st.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: bp === "mobile" ? 16 : 24 }}>
        {renderStep()}
      </div>

      {saveError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 16px", marginTop: 12, color: "#991b1b", fontSize: 13 }}>
          ⚠ {saveError}
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
// ████████████████████████████████████████████████████████████████████████████
//  APP — root component, the orchestrator
// ████████████████████████████████████████████████████████████████████████████
//  Owns the application's top-level state: which view is open, the loaded
//  projects/requests/gates/closures from SharePoint, the current user, the
//  user's role lookup, the dark-mode flag. Renders the chrome (Sidebar +
//  Header) once and switches the main content area based on the `route`
//  object. All write paths (submitUpdate, savePMONote, archiveProject, etc.)
//  are defined here and passed down to the child views as props.
//
export default function App() {
  const [route, setRoute] = useState({ view: "home" });
  const activeT = useT();
  const dark = themeStore.dark;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // What-If hub — a single piece of state drives the picker AND whichever
  // specific calculator is active. Values: null (closed) · "picker" · "ipi"
  // · "cost" · "roi". Back arrow in a calculator returns to "picker"; ×
  // returns to null.
  const [whatIfView, setWhatIfView] = useState(null);
  const [docGenOpen, setDocGenOpen] = useState(false);
  const toggleDark = () => themeStore.toggle();
  const { email: currentUserEmail, name: currentUserName } = useCurrentUser();
  const [userRole, setUserRole] = useState(ROLE_EXEC);    // fail-open: unprovisioned users get read-only exec view
  const [userDeptId, setUserDeptId] = useState(null);
  const [roleResolved, setRoleResolved] = useState(isUsingMock()); // mock: skip role lookup, load immediately
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [gateSubmissions, setGateSubmissions] = useState([]);
  const [closureSubmissions, setClosureSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);

  // ── Bootstrap: non-project data (no role dependency) ─────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [depts, reqs, gates, closures] = await Promise.all([
          SPService.getDepartments(),
          SPService.getRequests(),
          SPService.getGateSubmissions(),
          SPService.getClosureSubmissions(),
        ]);
        if (cancelled) return;
        setDepartments(depts);
        setRequests(reqs);
        setGateSubmissions(gates);
        setClosureSubmissions(closures);
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Failed to load data");
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
        setRoleResolved(true);
      })
      .catch(() => { setRoleResolved(true); }); // fail-open: keep exec default
  }, [currentUserEmail]);
  // ── Projects: server-side filtered once role is known ─────────
  useEffect(() => {
    if (!roleResolved) return;
    let cancelled = false;
    (async () => {
      try {
        const projs = await SPService.getProjects({ role: userRole, email: currentUserEmail, deptId: userDeptId });
        if (cancelled) return;
        setProjects(projs);
        setLoadedAt(new Date());
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Failed to load projects");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roleResolved, userRole, userDeptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PM default landing: their own projects, not the actions queue.
  // A PM opening the portal expects to see their project first — landing
  // on an (often empty) approvals queue made it look like the portal had
  // nothing for them. Actions stays one click away with its badge.
  useEffect(() => {
    if (userRole === ROLE_PM) setRoute({ view: "projects" });
  }, [userRole]);

  const addDept = useCallback(async (d) => {
    if (!isUsingMock()) {
      const created = await SPService.createDept(d);
      setDepartments(prev => [...prev, created]);
    } else {
      setDepartments(prev => [...prev, { ...d, spId: Date.now() }]);
    }
  }, []);

  const updateDept = useCallback((id, data) => {
    setDepartments(prev => {
      const dept = prev.find(d => d.id === id);
      if (!isUsingMock() && dept?.spId) SPService.updateDeptSP(dept.spId, data).catch(console.error);
      return prev.map(d => d.id === id ? { ...d, ...data } : d);
    });
  }, []);

  const deleteDept = useCallback((id) => {
    setDepartments(prev => {
      const dept = prev.find(d => d.id === id);
      if (!isUsingMock() && dept?.spId) SPService.deleteDeptSP(dept.spId).catch(console.error);
      return prev.filter(d => d.id !== id);
    });
  }, []);
  const deptCtx = { departments, addDept, updateDept, deleteDept };

  // theme handled by themeStore pub/sub

  // Role-based project filtering:
  // PM        → only projects where they are the assigned PM
  // Dept Head → only projects in their department
  // Others    → full list
  const visibleProjects = useMemo(() => {
    if (userRole === ROLE_PM) {
      // pmEmail = "primary, backup" — the backup PM gets the same access so
      // they can update when the PM is away; only the primary shows in the
      // portal. Fallback to name match for projects without pmEmail yet.
      if (currentUserEmail) {
        const email = currentUserEmail.trim().toLowerCase();
        return projects.filter(p =>
          p.pmEmail ? p.pmEmail.split(/[,;]/).map(e => e.trim().toLowerCase()).includes(email)
                    : (p.pm || "").trim().toLowerCase() === (currentUserName || "").trim().toLowerCase()
        );
      }
    }
    if (userRole === ROLE_DEPT_HEAD) {
      if (!userDeptId) return projects;
      const ids = userDeptId.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!ids.length || ids.includes("all")) return projects;
      return projects.filter(p => ids.includes((p.deptId || "").toLowerCase()));
    }
    return projects;
  }, [projects, userRole, currentUserEmail, currentUserName, userDeptId]);

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
    roadmapDeadline,
    health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
    milestones, risks, benefits, documents, note,
  }) => {
    const today = new Date().toISOString().split("T")[0];
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Replan memory: if an activity's finish date moved, stamp prevDate so the
    // Gantt (portal + print) shows "old date struck → new date".
    const trackedMilestones = Array.isArray(milestones)
      ? trackMilestoneDateChanges(milestones, project.milestones || [])
      : milestones;

    // Build update log entries
    const logEntries = [];
    if (note?.trim()) {
      logEntries.push({ id: `U${Date.now()}`, date: today, owner: project.pm, note: note.trim() });
    }
    // Auto-log document status changes
    if (documents) {
      const changed = documents.filter(d => {
        const orig = (project.documents || []).find(o => o.id === d.id);
        return orig && orig.status !== d.status;
      });
      if (changed.length) {
        const docNote = "Document update: " + changed.map(d => `${d.name} → ${d.status}`).join(", ");
        logEntries.push({ id: `U${Date.now() + 1}`, date: today, owner: project.pm, note: docNote });
      }
    }
    const newUpdates = logEntries.length
      ? [...(project.updates || []), ...logEntries]
      : project.updates || [];

    // Capture IPI snapshot for time-weighted history.
    // EVERY save appends a separate, immutable snapshot with a full ISO
    // datetime, the user who saved it, and a frozen copy of the components
    // (SPI/CPI/MCI/penalty/EV/PV). Same-day overwrites are NOT allowed —
    // multiple updates the same day each get their own row in the audit
    // trail. An auditor inspecting ipiHistory in SharePoint can reconstruct
    // exactly what was reported, by whom, at what minute.
    const snapState = {
      ...project,
      status, progress, plannedProgress, startDate, plannedEnd,
      budget, actualCost, milestones: trackedMilestones,
      documents: documents ?? project.documents,
    };
    const fullResult = calcProjectIPIFull(snapState);
    const snapComp   = fullResult.components || {};
    const nowIso     = new Date().toISOString();
    const ipiSnap = {
      date:     nowIso,            // full ISO datetime — backwards-compatible with date-only via _toMs
      day:      today,             // YYYY-MM-DD for display grouping
      ipi:      fullResult.ipi,
      spi:      snapComp.spi,
      penalty:  snapComp.penalty,
      spiFinal: snapComp.spiFinal,
      cpi:      snapComp.cpi,
      mci:      snapComp.mci,
      ev:       fullResult.ev,
      pv:       fullResult.pv,
      daysLate: fullResult.daysLateVsPlan,      // lateness trend preserved in the audit trail
      roadmap:  fullResult.roadmapStatus,       // "met" | "breach" | null at time of save
      by:       currentUserName || "system",
      status,
    };
    // Append, never overwrite. Older entries are immutable.
    const ipiHistory = [...(project.ipiHistory || []), ipiSnap];

    const isPMOrDeptHead = userRole === ROLE_PM || userRole === ROLE_DEPT_HEAD;
    const nowCompleted  = status === "Completed";
    const wasCompleted  = project.status === "Completed";
    const capturedFinish = nowCompleted && !project.actualFinishDate ? today
                         : !nowCompleted && wasCompleted              ? null
                         : project.actualFinishDate;
    const updated = {
      ...project,
      status, phase, gate, priority, progress, plannedProgress, startDate, plannedEnd,
      actualFinishDate: capturedFinish,
      roadmapDeadline: isPMOrDeptHead ? project.roadmapDeadline : roadmapDeadline,
      health, budget, forecast, actualCost, spi, cpi, daysRemaining, daysDelayed,
      milestones: trackedMilestones, risks, benefits,
      ...(documents ? { documents } : {}),
      updates: newUpdates, lastUpdate: today,
      ipiHistory,
      // PM submission: flag for PMO validation; other roles leave pmoStatus unchanged.
      // Also clear the previous PMOValidationNote on resubmit — otherwise the
      // Returned banner keeps showing the stale feedback after the PM has fixed
      // the issue, confusing which note is current.
      ...(userRole === ROLE_PM ? {
        pmoStatus: "Submitted",
        lastSubmittedBy: currentUserName,
        lastSubmittedDate: today,
        pmoValidationNote: "",
      } : {}),
    };
    if (!isUsingMock() && project.spId) {
      // PMO-authored fields never overwritten from a PM/dept_head save —
      // EXCEPT pmoValidationNote, which PM is allowed to clear on resubmit
      // so the returned banner stops surfacing stale feedback.
      const PMO_PROTECTED = ["PMOValidatedBy", "PMOValidatedDate", "PMONotes", "RoadmapDeadline", "BaselineEnd", "BaselineExceptionNote"];
      const omit = (userRole === ROLE_PM || userRole === ROLE_DEPT_HEAD) ? PMO_PROTECTED : [];
      await SPService.updateProject(project.spId, updated, omit);
    }
    setProjects(prev => prev.map(p => p.id === projectId ? updated : p));
  }, [projects, userRole, currentUserName]);

  // ── PMO validate / return a PM update ───────────────────────────
  const validateUpdate = useCallback(async (projectId, { approved, note }) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const today = new Date().toISOString().split("T")[0];
    const stateUpdate = approved
      ? { pmoStatus: "Validated", pmoValidatedBy: currentUserName, pmoValidatedDate: today, pmoValidationNote: "" }
      : { pmoStatus: "Returned",  pmoValidationNote: note };
    if (!isUsingMock() && project.spId) {
      await SPService.validateUpdate(project.spId, { approved, note, validatedBy: currentUserName, validatedDate: today });
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...stateUpdate } : p));
  }, [projects, currentUserName]);

  const savePMONote = useCallback(async (projectId, note) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (!isUsingMock() && project.spId) {
      await SPService.savePMONote(project.spId, note);
    }
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, pmoNotes: note } : p));
  }, [projects]);

  // ── Form save: persists to SP then updates local state ──────────
  const onSaveForm = useCallback(async (form, mode, spId, localId) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const newUpdate = form._newUpdate?.trim();
    const updates = newUpdate
      ? [...(form.updates || []), { id: `U${Date.now()}`, date: todayStr, owner: form.pm, note: newUpdate }]
      : (form.updates || []);
    const capturedFinish = form.status === "Completed"
      ? (form.actualFinishDate || todayStr)
      : null;
    const full = { ...form, updates, _newUpdate: undefined, lastUpdate: todayStr, actualFinishDate: capturedFinish };
    if (mode === "edit" && Array.isArray(full.milestones)) {
      const prevMs = projects.find(p => p.id === localId)?.milestones || [];
      full.milestones = trackMilestoneDateChanges(full.milestones, prevMs);
    }

    // ── Gate-3 baseline capture + lock ──────────────────────────────────────
    // When a project reaches Gate 3 or beyond, freeze the current plannedEnd as
    // the immutable SPI baseline (once). Thereafter plannedEnd can move but the
    // baseline — and therefore the schedule score — cannot be gamed by padding.
    if (parseGateNumber(full.gate) >= 3 && !full.baselineEnd && full.plannedEnd) {
      full.baselineEnd = full.plannedEnd;
    }
    // Gate-3 governance validation: a baseline that overruns the strategic
    // Roadmap Deadline must carry a documented exception before it can be saved.
    if (full.baselineEnd && full.roadmapDeadline
        && new Date(full.baselineEnd) > new Date(full.roadmapDeadline)
        && !String(full.baselineExceptionNote || "").trim()) {
      throw new Error("Baseline end is later than the Roadmap Deadline — record a baseline exception note before saving (Gate-3 governance).");
    }

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
  }, [projects]);

  const getTitle = () => {
    if (route.view === "home") {
      // Dept Heads see the same dashboard but computed from THEIR projects
      // only (visibleProjects is dept-scoped). Calling it "Enterprise" while
      // showing one department's numbers was misleading — label it honestly.
      if (userRole === ROLE_DEPT_HEAD && userDeptId && !userDeptId.toLowerCase().includes("all")) {
        const ids = userDeptId.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        const names = departments.filter(d => ids.includes((d.id || "").toLowerCase())).map(d => d.name);
        if (names.length) return [`${names.join(" · ")} Portfolio`, `Overview scoped to your department${names.length > 1 ? "s" : ""}`];
      }
      return ["Enterprise Portfolio Dashboard", "Executive overview across all departments"];
    }
    if (route.view === "departments") return ["Departments Overview", `IPI comparison across ${departments.length} departments`];
    if (route.view === "projects")    return userRole === ROLE_PM
      ? ["My Projects", "Projects where you are the assigned PM"]
      : ["All Projects", "Complete project portfolio"];
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
        <Ico name="alert" size={36} color="#dc2626" />
        <h2 style={{ color: activeT.text, margin: 0 }}>Failed to load data</h2>
        <p style={{ color: activeT.muted, fontSize: 13, margin: 0 }}>{loadError}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: "8px 20px", background: activeT.primary, color: activeT.btnPrimText || "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Retry</button>
      </div>
    );
  }

  // Deactivated accounts — full lockout screen
  if (userRole === ROLE_LOCKED) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: activeT.bg, flexDirection: "column", gap: 16, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <Ico name="lock" size={44} color="#dc2626" strokeWidth={1.2} />
        <div style={{ fontWeight: 900, fontSize: 20, color: activeT.text }}>Account Deactivated</div>
        <div style={{ fontSize: 13, color: activeT.muted, textAlign: "center", maxWidth: 340, lineHeight: 1.6 }}>
          Your account has been deactivated. Please contact the PMO team to restore access.
        </div>
        <a href="mailto:pmo@tree.com" style={{ marginTop: 4, fontSize: 13, color: activeT.primary, fontWeight: 600, textDecoration: "none" }}>pmo@tree.com</a>
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
            <span style={{ display: "inline-flex", color: activeT.headerText }}><Ico name="shield" size={18} /></span>
            <span style={{ fontWeight: 900, fontSize: 15, color: activeT.headerText }}>GRC Portal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: activeT.headerText, opacity: 0.7 }}>{currentUserName || currentUserEmail}</span>
            <button onClick={toggleDark} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: activeT.headerText, display: "inline-flex", alignItems: "center" }}><Ico name={dark ? "sun" : "moon"} size={14} /></button>
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
      <Sidebar route={route} setRoute={setRoute} projects={visibleProjects} requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} currentUserEmail={currentUserEmail} currentUserName={currentUserName} userRole={userRole} userDeptId={userDeptId} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenWhatIf={() => setWhatIfView("picker")} onOpenDocGen={() => setDocGenOpen(true)} />
      {docGenOpen && <DocGenerator onClose={() => setDocGenOpen(false)} currentUserName={currentUserName} />}
      {whatIfView === "picker" && <WhatIfPicker  onClose={() => setWhatIfView(null)} onPick={(k) => setWhatIfView(k)} />}
      {whatIfView === "ipi"    && <IPICalculator onClose={() => setWhatIfView(null)} onBack={() => setWhatIfView("picker")} />}
      {whatIfView === "cost"   && <CostCalculator onClose={() => setWhatIfView(null)} onBack={() => setWhatIfView("picker")} />}
      {whatIfView === "roi"    && <ROICalculator  onClose={() => setWhatIfView(null)} onBack={() => setWhatIfView("picker")} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header title={title} subtitle={subtitle} route={route} setRoute={setRoute} dark={dark} toggleDark={toggleDark} onMenuClick={() => setSidebarOpen(true)} projects={projects} currentUserName={currentUserName} />
        <main style={{ flex: 1, overflowY: "auto", background: activeT.bg }}>
          <AnimStyles />
          {/* Portfolio-level views — blocked for PM role */}
          {route.view === "home"        && userRole !== ROLE_PM && <HomeView          projects={visibleProjects} requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} setRoute={setRoute} loadedAt={loadedAt} userRole={userRole} />}
          {route.view === "departments" && userRole !== ROLE_PM && <DepartmentsOverview projects={visibleProjects} setRoute={setRoute} />}
          {route.view === "projects"    && <AllProjectsView    projects={visibleProjects} setRoute={setRoute} route={route} userRole={userRole} />}
          {route.view === "department"  && userRole !== ROLE_PM && <DepartmentView     projects={visibleProjects} deptId={route.deptId} setRoute={setRoute} userRole={userRole} userDeptId={userDeptId} />}
          {/* Project workspace — accessible to all roles (PM sees only their own via visibleProjects) */}
          {route.view === "project"     && <ProjectView        projects={projects} projectId={route.projectId} setRoute={setRoute} submitUpdate={submitUpdate} savePMONote={savePMONote} userRole={userRole} />}
          {route.view === "requests"    && <MyRequestsView     requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} setRoute={setRoute} currentUserName={currentUserName} currentUserEmail={currentUserEmail} userRole={userRole} />}
          {route.view === "actions"     && <MyActionsView      requests={requests} gateSubmissions={gateSubmissions} closureSubmissions={closureSubmissions} projects={visibleProjects} setRoute={setRoute} currentUserEmail={currentUserEmail} currentUserName={currentUserName} userRole={userRole} validateUpdate={validateUpdate} />}
          {route.view === "admin"       && (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && <AdminView projects={projects} setRoute={setRoute} onSaveForm={onSaveForm} archiveProject={archiveProject} restoreProject={restoreProject} deleteForever={deleteForever} />}
          {route.view === "form"        && (userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD) && <ProjectForm projectId={route.projectId} mode={route.mode || "create"} projects={projects} setRoute={setRoute} onSaveForm={onSaveForm} />}
        </main>
      </div>
    </div>
    </DeptContext.Provider>
  );
}
