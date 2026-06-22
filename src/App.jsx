
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from "recharts";
import { GATE_DEFS, OPTIONAL_DOCS, PROJECT_TYPES, ICON_OPTIONS } from "./data/constants.js";
import { SPService, isUsingMock, FORM_URLS, mapSPItemToClosureSubmission } from "./services/sharepoint.js";
import { acquireSpToken } from "./services/auth.js";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { ROLE_ADMIN, ROLE_PM, ROLE_EXEC, ROLE_DEPT_HEAD, ROLE_GRC, ROLE_GRC_ADMIN, ROLE_PMO_HEAD, ROLE_PMO_STAFF, ROLE_LOCKED } from "./roles.js";
import { THEMES, themeStore, useT, useDark, ttStyle } from "./theme.js";
import { useBp } from "./hooks/useBp.js";
import { statusColor, riskColor, RAG_COLOR, trendIcon, trendColor } from "./utils/colors.js";
import { fmt, fmtSAR } from "./utils/format.js";
import { TODAY, daysSince } from "./utils/dates.js";
import { getDeptStats, calcProjectIPI, calcProjectIPIFull, calcDeptIPI, calcPortfolioIPI, ipiColor, getGateSLA, deriveRiskLevel, deriveBudgetStatus, calcProjectProgressFromWBS, effectiveProgress, parseGateNumber, calcAnticipatedMCI, deriveProjectStatus } from "./utils/metrics.js";
import { exportExcel } from "./utils/export.js";
import { TypeBadge, Badge, RiskBadge } from "./components/Badge.jsx";
import { Progress } from "./components/Progress.jsx";
import { KPICard } from "./components/KPICard.jsx";
import GRCDashboard from "./views/GRCDashboard.jsx";
import HomeView from "./views/HomeView.jsx";
import { DeptContext, useDepts } from "./deptContext.js";
import { SectionHeader } from "./shared.jsx";

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

  // Zone definitions per cell — industry-standard color zones
  const ZONE_MAP = {
    "High-Low":      { bg: "#fffbeb", fill: "#fef3c7", accent: "#f59e0b", text: "#78350f", zone: "Medium"   },
    "High-Medium":   { bg: "#fff7ed", fill: "#ffedd5", accent: "#f97316", text: "#7c2d12", zone: "High"     },
    "High-High":     { bg: "#fef2f2", fill: "#fee2e2", accent: "#dc2626", text: "#7f1d1d", zone: "Critical" },
    "Medium-Low":    { bg: "#fefce8", fill: "#fef9c3", accent: "#eab308", text: "#713f12", zone: "Low"      },
    "Medium-Medium": { bg: "#fffbeb", fill: "#fef3c7", accent: "#f59e0b", text: "#78350f", zone: "Medium"   },
    "Medium-High":   { bg: "#fff7ed", fill: "#ffedd5", accent: "#f97316", text: "#7c2d12", zone: "High"     },
    "Low-Low":       { bg: "#f0fdf4", fill: "#dcfce7", accent: "#16a34a", text: "#14532d", zone: "Low"      },
    "Low-Medium":    { bg: "#f0fdf4", fill: "#d1fae5", accent: "#059669", text: "#064e3b", zone: "Low"      },
    "Low-High":      { bg: "#fefce8", fill: "#fef9c3", accent: "#eab308", text: "#713f12", zone: "Medium"   },
  };
  const ZONE_META = {
    Critical: { color: "#dc2626", bg: "#fee2e2", label: "Critical" },
    High:     { color: "#ea580c", bg: "#ffedd5", label: "High"     },
    Medium:   { color: "#d97706", bg: "#fef3c7", label: "Medium"   },
    Low:      { color: "#16a34a", bg: "#dcfce7", label: "Low"      },
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
                        border: `1.5px solid ${isActive ? z.accent : `${z.accent}50`}`,
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
    () => projects.filter(p => !p.archived && (p.status === "Delayed" || deriveRiskLevel(p) === "Critical")).length,
    [projects]
  );

  // Pending actions = submissions where pendingWithEmail matches current user
  const actionsCount = useMemo(() => {
    const reqPending        = (requests           || []).filter(r => r.pendingWithEmail && r.pendingWithEmail === currentUserEmail).length;
    const gatePending       = (gateSubmissions    || []).filter(g => g.pendingWithEmail && g.pendingWithEmail === currentUserEmail).length;
    const closurePending    = (closureSubmissions || []).filter(c => c.pendingWithEmail && c.pendingWithEmail === currentUserEmail).length;
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

  const navItems = [
    ...(!isPM ? [{ icon: "🏠", label: "Portfolio Overview", route: "home" }] : []),
    ...(!isPM ? [{ icon: "📁", label: "Departments IPI",     route: "departments" }] : []),
    ...(!isPM ? [{ icon: "📋", label: "All Projects",        route: "projects", badge: attnCount }] : []),
    { icon: "📨", label: "New Request",          route: "requests"},
    { icon: "✅", label: "My Actions",            route: "actions",  badge: actionsCount, badgeColor: actionsCount > 0 ? "#d97706" : null },
    ...(isAdmin ? [{ icon: "⚙️", label: "Admin Panel", route: "admin" }] : []),
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
          {!isPM && <div style={{ margin: "16px 0 8px", padding: "0 12px", fontSize: 10, color: "rgba(161,185,171,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Departments</div>}
          {!isPM && departments.map(d => {
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

// ─── GRC KRI DASHBOARD ───────────────────────────────────────────

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
        {(() => { const di = calcDeptIPI(deptId, projects); const c = ipiColor(di); return <KPICard label="Dept IPI" value={di ?? "—"} color={c.color} icon="📊" sub={c.label} />; })()}
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
          🗺 Roadmap{filterRoadmap ? " ✓" : ""}
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
    { key: "Status",     icon: "📊" },
    { key: "Financials", icon: "💰" },
    { key: "Activities", icon: "🎯" },
    { key: "Risks",      icon: "⚠️" },
    { key: "Benefits",   icon: "📈" },
    { key: "Documents",  icon: "📁" },
    { key: "Note",       icon: "📝" },
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
                  🤖 Auto · {derivedStatus.reason}
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
      const isPMTier = userRole === ROLE_PM || userRole === ROLE_DEPT_HEAD;
      const docOpts  = isPMTier
        ? ["Pending", "Draft", "Submitted"]
        : ["Pending", "Draft", "Under Review", "Submitted", "Received", "Current", "Approved", "Final"];
      return (
      <div>
        <SL>DOCUMENT STATUS & LINKS</SL>
        {documents.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>No documents on this project yet.</div>}
        {documents.map((doc, i) => {
          const docLocked = isPMTier && !docOpts.includes(doc.status);
          return (
          <div key={doc.id || i} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{doc.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {doc.type}
                  {doc.required && <> · Required · <span style={{ color: T.accent, fontWeight: 700 }}>Due at Gate {doc.requiredAtGate || 1}</span></>}
                </div>
              </div>
              {doc.required && !isPMTier && (
                <select value={doc.requiredAtGate || 1}
                  title="Gate at which this document becomes mandatory for MCI"
                  onChange={e => setDocuments(prev => prev.map((d, j) => j === i ? { ...d, requiredAtGate: parseInt(e.target.value, 10) } : d))}
                  style={{ ...ss, width: 100, fontSize: 12 }}>
                  {[1,2,3,4,5].map(g => <option key={g} value={g}>Gate {g}</option>)}
                </select>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="url"
                value={doc.url || ""}
                onChange={e => setDocuments(prev => prev.map((d, j) => j === i ? { ...d, url: e.target.value } : d))}
                placeholder="Paste SharePoint link here…"
                style={{ ...s, fontSize: 12, flex: 1 }}
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
        <div style={{ marginTop: 14, fontSize: 12, color: T.muted, fontStyle: "italic" }}>
          Paste the SharePoint file link — it will be saved and shown as a clickable link.
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

// ─── MILESTONE GANTT ──────────────────────────────────────────────
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

  const ticks = [];
  const cur = new Date(t0);
  cur.setDate(1);
  while (cur.getTime() <= t1) {
    ticks.push({ p: toPct(cur.toISOString().slice(0, 10)), label: cur.toLocaleString("en-GB", { month: "short", year: "2-digit" }) });
    cur.setMonth(cur.getMonth() + 1);
  }

  const SC = {
    Completed:     { track: "#dbeafe", fill: "#3b82f6", border: "#1e40af", lbl: "#1e40af" },
    "In Progress": { track: "#dcfce7", fill: "#16a34a", border: "#15803d", lbl: "#15803d" },
    Delayed:       { track: "#fee2e2", fill: "#ef4444", border: "#dc2626", lbl: "#991b1b" },
    Upcoming:      { track: "#f1f5f9", fill: "#94a3b8", border: "#cbd5e1", lbl: "#64748b" },
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px 14px", marginBottom: 20, overflowX: "auto" }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: T.text, marginBottom: 12 }}>Gantt Chart</div>
      <div style={{ minWidth: 640 }}>

        {/* Month labels */}
        <div style={{ display: "flex", marginBottom: 4 }}>
          <div style={{ width: 280, flexShrink: 0 }} />
          <div style={{ flex: 1, position: "relative", height: 20 }}>
            {ticks.map((t, i) => (
              <div key={i} style={{ position: "absolute", left: `${t.p}%`, transform: "translateX(-50%)", fontSize: 9, color: T.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</div>
            ))}
          </div>
        </div>

        {/* Milestone + Activity rows (WBS hierarchy) */}
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
          const labelPad = isMs ? 12 : 28; // indent activities

          return (
            <div key={m.id || i} style={{
              display: "flex",
              alignItems: "center",
              height: isMs ? 38 : 32,
              borderTop: `1px solid ${T.border}`,
              background: isMs ? `${T.primary}06` : "transparent",
            }}>
              <div style={{
                width: 280, flexShrink: 0, paddingRight: 12, paddingLeft: labelPad,
                fontSize: isMs ? 12 : 10.5,
                fontWeight: isMs ? 800 : 500,
                color: sp == null && ep == null ? T.muted : T.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                textAlign: "left",
              }} title={m.name}>
                {isMs ? "📍 " : "↳ "}{m.name || (isMs ? "(unnamed milestone)" : "(activity)")}
              </div>
              <div style={{ flex: 1, position: "relative", height: "100%" }}>
                {ticks.map((t, ti) => (
                  <div key={ti} style={{ position: "absolute", left: `${t.p}%`, top: 0, bottom: 0, width: 1, background: T.border, opacity: 0.4 }} />
                ))}
                {todayPct != null && (
                  <div style={{ position: "absolute", left: `${todayPct}%`, top: 0, bottom: 0, width: 2, background: T.accent, opacity: 0.85, zIndex: 3 }} />
                )}
                {sp == null && ep == null
                  ? <div style={{ position: "absolute", top: 10, left: 8, fontSize: 10, color: T.muted, fontStyle: "italic" }}>No dates</div>
                  : (isMs && !hasDuration)
                    // True milestone with single date → diamond marker
                    ? (
                      <div style={{ position: "absolute", left: `calc(${left}% - 10px)`, top: 8, width: 20, height: 20, background: c.fill, border: `2px solid ${c.border}`, borderRadius: 3, transform: "rotate(45deg)", zIndex: 2 }} />
                    )
                    // Activity OR milestone-with-duration → bar with progress
                    : (
                      <div style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: isMs ? 8 : 6, height: isMs ? 22 : 18, background: c.track, border: `1.5px solid ${c.border}`, borderRadius: isMs ? 5 : 4, overflow: "hidden", zIndex: 1 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: c.fill, opacity: 0.9 }} />
                        {pct > 15 && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: c.lbl }}>{pct}%</div>
                        )}
                      </div>
                    )
                }
                {m.date && ep != null && (() => {
                  // Diamond corners stick out ~14px past the row position after
                  // the 45° rotation — bars don't. Bump the date offset for
                  // milestone diamonds so the label doesn't overlap the marker.
                  const isDiamond = isMs && !hasDuration;
                  const dx = isDiamond ? 18 : 6;
                  return (
                    <div style={{ position: "absolute", left: `calc(${ep}% + ${dx}px)`, top: isMs ? 11 : 9, fontSize: 9, color: T.muted, whiteSpace: "nowrap", zIndex: 4 }}>
                      {new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}

        {/* Today label */}
        {todayPct != null && (
          <div style={{ display: "flex" }}>
            <div style={{ width: 280, flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative", height: 16 }}>
              <div style={{ position: "absolute", left: `${todayPct}%`, transform: "translateX(-50%)", fontSize: 9, color: T.accent, fontWeight: 800, whiteSpace: "nowrap" }}>▲ Today</div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ width: 280, flexShrink: 0 }} />
          {[["#3b82f6","Completed"],["#16a34a","In Progress"],["#ef4444","Delayed / Overdue"],["#94a3b8","Upcoming"]].map(([col, lbl]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
              <div style={{ width: 14, height: 8, background: col, borderRadius: 2 }} />
              {lbl}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.muted }}>
            <div style={{ width: 2, height: 14, background: T.accent, borderRadius: 1 }} />
            Today
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PROJECT DASHBOARD ────────────────────────────────────────────
const PROJECT_TABS_ADMIN = ["Exec Summary", "Overview", "Activities", "Budget", "Risks & Issues", "Benefits", "Documents", "Updates"];
const PROJECT_TABS_PM    = ["Overview", "Activities", "Risks & Issues", "Benefits", "Documents"];
const PROJECT_TABS_EXEC  = ["Exec Summary"];

const ProjectView = ({ projects, projectId, setRoute, submitUpdate, savePMONote, userRole = ROLE_ADMIN }) => {
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
  const canSeeNotes = userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF;
  const [noteEdit,   setNoteEdit]   = useState(false);
  const [noteDraft,  setNoteDraft]  = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // ── IPI — must run before early return so hook call count is stable.
  // Project page shows ONE IPI: the current snapshot, so it matches the
  // SPI/CPI/MCI breakdown displayed beside it. Time-weighted averaging is
  // applied only in dept/portfolio rollups (calcDeptIPI / calcPortfolioIPI).
  const ipiResult  = project ? calcProjectIPIFull(project) : { ipi: 0 };
  const ipi        = ipiResult.ipi;
  const ipiC       = ipiColor(ipi);
  const countedIPI = useCountUp(ipi);

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
        const visual = (m._isMs && !hasDuration)
          ? `<div class="diamond" style="left:calc(${left}% - 8px); background:${c.fill}; border-color:${c.border}"></div>`
          : `<div class="bar" style="left:${left}%; width:${width}%; background:${c.fill}; border-color:${c.border}"><span class="bar-pct" style="color:${c.txt}">${pct}%</span></div>`;
        // Past-fade overlay: a soft Lichen mist over the days that have already
        // passed. Sits BELOW the bars so completed work stays crisp; thicker in
        // the distant past, fading to transparent right at the Today marker —
        // gives the timeline a real sense of time flowing forward.
        const pastFade = todayPct > 0.5
          ? `<div class="past-fade" style="width:${todayPct}%"></div>` : "";
        return `<div class="row ${m._isMs ? "ms" : "act"}">
          <div class="label" title="${esc(m.name)}">${m._isMs ? "📍" : "↳"} ${esc(m.name) || "(unnamed)"}</div>
          <div class="track">${pastFade}${ticks.map(t => `<div class="grid" style="left:${t.p}%"></div>`).join("")}${visual}<div class="today" style="left:${todayPct}%"></div></div>
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

        /* ─── TIMELINE — Lichen borders, Sea today marker, Moss grid, past-fade ─── */
        .timeline { background: #fff; border: 1px solid #C9D5C9; border-radius: 8px; padding: 8px 10px; overflow: hidden; }
        .timeline .axis { display: flex; margin-bottom: 4px; padding-left: 220px; position: relative; height: 12px; }
        .timeline .axis .tick { position: absolute; transform: translateX(-50%); font-size: 8.5px; color: #7a9485; font-weight: 600; }
        .timeline .row { display: flex; align-items: stretch; min-height: 18px; border-top: 1px solid #ecf2ed; }
        .timeline .row.ms { background: rgba(0,57,50,0.04); min-height: 20px; font-weight: 700; }
        .timeline .row.act .label { padding: 3px 10px 3px 22px; font-size: 9px; font-weight: 500; color: #3a5547; }
        /* Label column: compact but still wraps 2 lines for long names */
        .timeline .row .label {
          width: 220px; flex-shrink: 0; padding: 3px 10px 3px 12px;
          font-size: 10px; color: #003932; line-height: 1.2;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; text-overflow: ellipsis;
        }
        .timeline .row .track { flex: 1; position: relative; min-width: 360px; overflow: hidden; }
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
        .timeline .bar { position: absolute; top: 4px; height: 11px; border: 1.5px solid; border-radius: 3px; display: flex; align-items: center; justify-content: center; z-index: 1; min-width: 3px; }
        .timeline .bar-pct { font-size: 7.5px; font-weight: 800; }
        .timeline .diamond { position: absolute; top: 4px; width: 12px; height: 12px; border: 1.5px solid; border-radius: 2px; transform: rotate(45deg); z-index: 2; }
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
          <span class="head-meta">${ordered.length} item${ordered.length === 1 ? "" : "s"} · ▾ Today</span>
        </div>
        <div class="timeline">
          ${ordered.length > 0 ? `<div class="axis">${ticks.map(t => `<div class="tick" style="left:calc(220px + (100% - 220px) * ${t.p} / 100)">${t.label}</div>`).join("")}</div>` : ""}
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
            {project.isRoadmap && <span style={{ background: "rgba(255,255,255,0.2)", color: T.headerText, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>🗺 Roadmap</span>}
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
                      ✏️ Update
                    </button>
                  )}
                  {(userRole === ROLE_ADMIN || userRole === ROLE_PMO_HEAD || userRole === ROLE_PMO_STAFF) && project.pmoStatus === "Submitted" && (
                    <button onClick={() => setRoute({ view: "actions" })}
                      style={{ ...baseBtn, background: "#f59e0b", color: "#fff", border: "1px solid transparent", fontWeight: 800 }}>
                      ✅ Validate
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
                    📄 Print Report
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
        {(() => { const d = daysSince(project.lastUpdate); if (!d || d < 14) return null; return <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: d >= 30 ? "rgba(220,38,38,0.25)" : "rgba(234,179,8,0.25)", color: d >= 30 ? "#fca5a5" : "#fde68a", display: "inline-block" }}>Updated {d}d ago</div>; })()}
        {/* Performance banner — Progress + IPI side by side, equal billing */}
        <div style={{ display: "flex", gap: 14, marginTop: 16, padding: "14px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 12, alignItems: "stretch", flexWrap: "wrap" }}>
          {/* Progress block — promoted out of the corner, given equal visual weight to IPI */}
          <div style={{
            background: "rgba(0,184,148,0.10)",
            border: "1px solid rgba(0,184,148,0.25)",
            borderRadius: 10,
            padding: "10px 16px",
            minWidth: 180,
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: T.accent, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{effectiveProgress}%</span>
              <span style={{ fontSize: 10, color: T.accent, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>Progress</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${effectiveProgress}%`, background: T.accent, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 10, opacity: 0.65, marginTop: 6, color: T.headerText }}>
              {wbsProgress != null ? "Auto-rolled from Activities" : "Manual entry"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ background: ipiC.bg, borderRadius: 10, padding: "8px 18px", textAlign: "center", minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: ipiC.color, lineHeight: 1 }}>{ipi == null ? "—" : countedIPI}</div>
              <div style={{ fontSize: 10, color: ipiC.color, fontWeight: 700 }}>IPI Score</div>
            </div>
            <div style={{ fontSize: 11, color: T.headerText, lineHeight: 1.9, opacity: 0.9 }}>
              <div>
                <span style={{ color: T.accent, fontWeight: 700 }}>SPI</span>
                {" "}{ipiResult.components.spi ?? "N/A"}
                {ipiResult.components.penalty < 1 && (
                  <span style={{ color: "#f87171", fontWeight: 700 }}> × {ipiResult.components.penalty} penalty</span>
                )}
                {" "}→ <strong style={{ color: T.accent }}>{ipiResult.components.spiFinal ?? "N/A"}</strong> × 50%
              </div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>CPI</span> {ipiResult.components.cpi ?? "N/A"} × 25%</div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>MCI</span> {ipiResult.components.mci == null ? "N/A (no docs)" : `${Math.round(ipiResult.components.mci * 100)}% docs`} × 25%</div>
              {(() => {
                const ant = calcAnticipatedMCI(project);
                if (!ant) return null;
                const currentMci = ipiResult.components.mci;
                const willDrop = currentMci != null && ant.mci != null && ant.mci < currentMci;
                return (
                  <div style={{ color: willDrop ? "#fbbf24" : "#86efac", fontSize: 10.5, marginTop: 1 }} title="Forecast MCI when this project enters its next gate, using today's document statuses.">
                    {willDrop ? "⚠" : "✓"} Anticipated at Gate {ant.atGate}: {ant.mci == null ? "—" : `${Math.round(ant.mci * 100)}%`}
                    {" "}<span style={{ opacity: 0.7 }}>({ant.deltaDocs} new doc{ant.deltaDocs > 1 ? "s" : ""} become due)</span>
                  </div>
                );
              })()}
              {project.roadmapDeadline && (
                <div style={{ color: ipiResult.components.penalty < 1 ? "#f87171" : "#86efac", marginTop: 2 }}>
                  {ipiResult.components.penalty < 1
                    ? `⚠ ${Math.round((1 - ipiResult.components.penalty) * 100)}d past roadmap (${project.roadmapDeadline})`
                    : `✓ Within roadmap (${project.roadmapDeadline})`}
                </div>
              )}
            </div>
          </div>
        </div>
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

      <Tab tabs={TABS} active={activeTab} onSelect={setTab} />

      {/* ── GATE TRACKER — always visible ── */}
      <GateTracker gates={project.gates} currentGate={project.gate} startDate={project.startDate} />

      {/* ── PMO returned banner — visible to PM only ── */}
      {userRole === ROLE_PM && project.pmoStatus === "Returned" && (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>↩</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>Update Returned by PMO — revision required</div>
            {project.pmoValidationNote && <div style={{ fontSize: 12, color: "#78350f", marginTop: 4 }}>{project.pmoValidationNote}</div>}
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 6, opacity: 0.8 }}>Please revise and resubmit using the ✏️ Update button above.</div>
          </div>
        </div>
      )}

      {/* ── PMO Internal Notes (hidden from PM) ─────────────────── */}
      {canSeeNotes && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: noteEdit ? 10 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15 }}>📝</span>
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

      {/* ── Submit Update Panel ─────────────────────────────────── */}
      {showUpdate && <UpdatePanel project={project} onClose={() => setShowUpdate(false)} onSubmit={submitUpdate} userRole={userRole} />}

      <div key={activeTab} className="pmo-tab-content">
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
                  { label: "Progress", node: <span style={{ fontSize: 22, fontWeight: 900, color: T.text }}>{effectiveProgress}%</span> },
                  { label: "IPI", node: <span style={{ fontSize: 20, fontWeight: 900, color: ipiC.color }}>{ipi ?? "—"} <span style={{ fontSize: 11, fontWeight: 600 }}>{ipiC.label}</span></span> },
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: remaining >= 0 ? "#15803d" : "#dc2626" }}>{deriveBudgetStatus(project)}</span>
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
            {project.milestones.map((m, i) => {
              // Colours: In Progress = green, Completed = blue, Upcoming = grey,
              // Delayed/Overdue = red. Yellow removed — it visually clashed with At Risk.
              const statusStyles = {
                "Completed":   { bg: "#dbeafe", text: "#1e40af", icon: "✓", lineColor: "#3b82f6" },
                "In Progress": { bg: "#dcfce7", text: "#15803d", icon: "◎", lineColor: "#16a34a" },
                "Upcoming":    { bg: "#f3f4f6", text: "#6b7280", icon: "○", lineColor: "#d1d5db" },
                "Delayed":     { bg: "#fee2e2", text: "#991b1b", icon: "!", lineColor: "#dc2626" },
              };
              const isOverdue = m.status !== "Completed" && m.date && m.date < TODAY;
              const s = isOverdue
                ? { bg: "#fee2e2", text: "#991b1b", icon: "!", lineColor: "#dc2626" }
                : (statusStyles[m.status] || statusStyles["Upcoming"]);
              // Top-level item = milestone (diamond) · child = activity (smaller circle).
              const isMilestone = !m.parentId;
              // Connector line going DOWN from this row's icon → dashed when the
              // next row is an activity (tree branch), solid when transitioning
              // to the next milestone (group break). Creates a clear visual
              // hierarchy without any extra columns.
              const nextItem = project.milestones[i + 1];
              const nextIsActivity = nextItem && nextItem.parentId;
              const connectorStyle = nextIsActivity
                ? `2px dashed ${s.lineColor}`
                : `2px solid ${s.lineColor}`;
              return (
                <div key={m.id} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                    {isMilestone ? (
                      <div style={{ width: 30, height: 30, background: s.bg, border: `2px solid ${s.lineColor}`, transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, borderRadius: 4, marginTop: 2 }}>
                        <span style={{ transform: "rotate(-45deg)", fontSize: 13, color: s.text, fontWeight: 800, lineHeight: 1 }}>{s.icon}</span>
                      </div>
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: s.bg, border: `2px solid ${s.lineColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: s.text, fontWeight: 700, zIndex: 1, marginTop: 6 }}>{s.icon}</div>
                    )}
                    {i < project.milestones.length - 1 && (
                      <div style={{ width: 0, flex: 1, borderLeft: connectorStyle, opacity: 0.45, minHeight: 20 }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 20, paddingLeft: isMilestone ? 0 : 24, position: "relative" }}>
                    {/* Tree-tee: a soft horizontal dashed connector reaching from
                        the vertical line into the activity card's left edge.
                        Only on activities — milestones stand on their own. */}
                    {!isMilestone && (
                      <div style={{ position: "absolute", left: -16, top: 22, width: 16, height: 0, borderTop: `2px dashed ${s.lineColor}`, opacity: 0.45 }} />
                    )}
                    <div style={{
                      background: T.bg, borderRadius: 12, padding: "14px 18px",
                      borderLeft: isMilestone
                        ? `3px solid ${s.lineColor}`
                        : `2px dashed ${s.lineColor}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                        <span style={{ fontSize: isMilestone ? 14 : 13, fontWeight: isMilestone ? 700 : 600, color: T.text }}>
                          {isMilestone ? "" : "↳ "}{m.name}
                        </span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {m.weight > 1 && <span style={{ background: T.surface, color: T.muted, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: `1px solid ${T.border}` }}>W:{m.weight}</span>}
                          {isOverdue && <span style={{ background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em" }}>OVERDUE</span>}
                          <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{m.status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
                        {m.startDate ? `${m.startDate} → ${m.date || "—"}` : (m.date ? `Target: ${m.date}` : "No date set")} · Owner: {m.owner || "—"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${m.progress ?? (m.status === "Completed" ? 100 : 0)}%`, background: s.lineColor, borderRadius: 3, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: s.text, minWidth: 32 }}>{m.progress ?? (m.status === "Completed" ? 100 : 0)}%</span>
                      </div>
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
              <div style={{ display: "flex", gap: 8 }}>
                {project.issues.filter(i => { const d = daysSince(i.raised); return d != null && d > 30 && i.status === "Open"; }).length > 0 && (
                  <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                    {project.issues.filter(i => { const d = daysSince(i.raised); return d != null && d > 30 && i.status === "Open"; }).length} Stale 30d+
                  </span>
                )}
                {project.issues.filter(i => i.escalated).length > 0 && (
                  <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.issues.filter(i => i.escalated).length} Escalated</span>
                )}
              </div>
            </div>
            {project.issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#16a34a", fontSize: 13 }}>✓ No open issues</div>
            ) : (
              project.issues.map(issue => {
                const issueDays = daysSince(issue.raised);
                const isStale   = issueDays != null && issueDays > 30 && issue.status === "Open";
                const borderCol = issue.escalated ? "#dc2626" : isStale ? "#f97316" : issue.severity === "High" ? "#eab308" : T.border;
                return (
                  <div key={issue.id} style={{ padding: "14px 16px", background: T.bg, borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${borderCol}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isStale && <span style={{ background: "#ffedd5", color: "#c2410c", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{issueDays}d open</span>}
                        {issue.escalated && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ESCALATED</span>}
                        <RiskBadge level={issue.severity} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      Owner: {issue.owner} · Raised: {issue.raised}
                      {issue.targetDate && <span> · Target: <span style={{ color: issue.targetDate < TODAY && issue.status === "Open" ? "#dc2626" : T.muted }}>{issue.targetDate}</span></span>}
                      {" · "}Status: <span style={{ fontWeight: 600, color: issue.status === "Open" ? "#dc2626" : issue.status === "Resolved" ? "#16a34a" : T.muted }}>{issue.status}</span>
                    </div>
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
              <span style={{ fontSize: 16 }}>⭐</span>
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
                  // Lifecycle icon: ⚪ not due yet · ⚠️ due and missing · ✅ delivered
                  const lifecycleIcon = isFutureDue ? "⚪" : isReady ? "✅" : "⚠️";
                  // Due-At chip: muted grey for future-gate; brand mint for currently due
                  const dueChip = isFutureDue
                    ? { bg: T.bg, text: T.muted, label: `Gate ${dueGate} · Not due yet` }
                    : { bg: "#dcfce7", text: "#15803d", label: `Gate ${dueGate}` };
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, opacity: isFutureDue ? 0.62 : 1 }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{lifecycleIcon}</span>
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
          📜 Approval Log
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
              ? { bg: "#fee2e2", text: "#991b1b", icon: "❌" }
              : { bg: "#dcfce7", text: "#15803d", icon: "✅" };
            return (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderTop: i > 0 ? `1px dashed ${T.border}` : "none" }}>
                <span style={{ fontSize: 14, lineHeight: "20px", flexShrink: 0 }}>{e.emoji || chip.icon}</span>
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
        <ApprovalLogPanel log={gs.approvalLog} />
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
                        <span style={{ fontSize: 12, color: T.muted }}>
                          {cl.pendingWith ? `Pending with ${cl.pendingWith}` : "In review"} · <strong>{cl.daysInClosure} day{cl.daysInClosure !== 1 ? "s" : ""}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap" }}>
                    {cl.status || "In Review"}
                  </div>
                </div>
                <ApprovalLogPanel log={cl.approvalLog} />
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

  const pendingGates = (gateSubmissions || []).filter(g =>
    !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected") &&
    (isMock || g.pendingWithEmail === currentUserEmail)
  );

  const pendingClosures = (closureSubmissions || []).filter(c =>
    c.status !== "Closed" && c.status !== "Rejected" &&
    (isMock || c.pendingWithEmail === currentUserEmail)
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
              <div key={gs.id}>
                <ActionCard
                  icon="🔖"
                  title={`${gs.gateLabel} — ${gs.projectTitle}`}
                  subtitle={`Submitted by ${gs.submittedBy} · ${gs.daysAtGate} day${gs.daysAtGate !== 1 ? "s" : ""} at gate`}
                  rightContent={<RequestStatusBadge status={gs.status} />}
                  urgency={gs.daysAtGate > 5 ? "medium" : null}
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
                  icon="🔐"
                  title={`${cl.projectTitle}${cl.projectCode ? ` (${cl.projectCode})` : ""}`}
                  subtitle={`PM: ${cl.projectManager} · ${cl.daysInClosure} day${cl.daysInClosure !== 1 ? "s" : ""} in closure · Pending with ${cl.pendingWith}`}
                  rightContent={<span style={{ fontSize: 11, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}>{cl.status || "Stakeholder Review"}</span>}
                  urgency={cl.daysInClosure > 7 ? "medium" : null}
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
                <div style={{ fontSize: 22, flexShrink: 0 }}>📋</div>
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
                    {(() => { const ep = effectiveProgress(p); return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}><Progress value={ep} height={4} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{ep}%</span>
                      </div>
                    ); })()}
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
                <span style={{ fontSize: 22 }}>{d.icon}</span>
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

            {/* IPI breakdown */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "SPI ×50%", value: d.avgSPI != null ? d.avgSPI.toFixed(2) : "—", pts: d.avgSPI != null ? Math.min(d.avgSPI, 1.20) * 50 : 0, color: d.avgSPI == null ? "#6b7280" : d.avgSPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "CPI ×25%", value: d.avgCPI != null ? d.avgCPI.toFixed(2) : "—", pts: d.avgCPI != null ? Math.min(d.avgCPI, 1.20) * 25 : 0, color: d.avgCPI == null ? "#6b7280" : d.avgCPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "MCI ×25%", value: d.avgMCI != null ? `${Math.round(d.avgMCI * 100)}%` : "—", pts: d.avgMCI != null ? d.avgMCI * 25 : 0, color: d.avgMCI == null ? "#6b7280" : d.avgMCI >= 0.8 ? "#16a34a" : "#dc2626" },
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

  const active = projects.filter(p => !p.archived);
  const completedCount = active.filter(p => p.status === "Completed").length;

  const filtered = useMemo(() => active.filter(p => {
    const matchSearch  = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.pm.toLowerCase().includes(search.toLowerCase());
    const matchStatus  = filterStatus === "All"
      ? (showCompleted || p.status !== "Completed")
      : p.status === filterStatus;
    const matchDept    = filterDept    === "All" || p.deptId      === filterDept;
    const matchType    = filterType    === "All" || p.projectType === filterType;
    const matchRoadmap  = !filterRoadmap  || p.isRoadmap === true;
    const matchOverrun  = !filterOverrun  || (p.budget > 0 && (p.forecast || 0) > p.budget);
    return matchSearch && matchStatus && matchDept && matchType && matchRoadmap && matchOverrun;
  }), [active, search, filterStatus, filterDept, filterType, filterRoadmap, showCompleted, filterOverrun]);

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
        <button onClick={() => setFilterRoadmap(v => !v)} style={{ background: filterRoadmap ? T.primary : T.surface, color: filterRoadmap ? "#fff" : T.muted, border: `1px solid ${filterRoadmap ? T.primary : T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontWeight: filterRoadmap ? 700 : 400 }}>
          🗺 Roadmap{filterRoadmap ? " ✓" : ""}
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
            {["Code", "Project Name", "Type", "Department", "PM", "Sponsor", "Progress", "Status", "Risk", "Budget", "Gate", "Last Update"].map(h => (
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
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{p.name}</span>
                      {p.isRoadmap && <span style={{ fontSize: 9, fontWeight: 800, background: T.primary, color: "#fff", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>ROADMAP</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{dept?.icon}</span><span style={{ color: T.muted }}>{dept?.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.sponsor}</td>
                  <td style={{ padding: "12px 14px", minWidth: 90 }}>
                    {(() => { const ep = effectiveProgress(p); return (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1 }}><Progress value={ep} height={4} /></div>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{ep}%</span>
                      </div>
                    ); })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={deriveRiskLevel(p)} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: deriveBudgetStatus(p) === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{deriveBudgetStatus(p)}</td>
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

const MilestoneRow = ({ item, isActivity, items, upd, remove }) => {
  const T = useT();
  const s = fInputStyle(T, false);
  const ss = { ...s, background: T.selectBg };
  const c = STATUS_CHIP[item.status] || STATUS_CHIP.Upcoming;
  const kids = items.filter(i => i.parentId === item.id);
  const autoProgress = !isActivity && kids.length > 0 ? milestoneProgress(item, items) : null;
  const progress = autoProgress != null ? autoProgress : (item.progress ?? 0);
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
          {isActivity ? "🔸 ACTIVITY" : "📍 MILESTONE"}
        </span>
        <input value={item.name} onChange={e => upd(item.id, "name", e.target.value)}
          placeholder={isActivity ? "Activity name *" : "Milestone name *"}
          style={{ ...s, fontWeight: 600 }} />
        <span style={{ background: c.bg, color: c.text, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{item.status}</span>
        <button onClick={() => remove(item.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, cursor: "pointer", color: "#dc2626", fontWeight: 900, fontSize: 14, padding: "4px 10px" }}>×</button>
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
          <MilestoneRow item={m} items={items} upd={upd} remove={remove} />
          <div style={{ marginLeft: 24, paddingLeft: 12, borderLeft: `2px dashed ${T.border}` }}>
            {childrenOf(m.id).map(a => <MilestoneRow key={a.id} item={a} isActivity items={items} upd={upd} remove={remove} />)}
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
    startDate: today, plannedEnd: "", roadmapDeadline: "",
    progress: 0, plannedProgress: 0,
    budget: 0, forecast: 0, actualCost: 0,
    spi: 1.0, cpi: 1.0, daysRemaining: 0, daysDelayed: 0, scheduleVariance: "0",
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    milestones: [], risks: [], issues: [], updates: [], benefits: [], approvals: [],
    documents: [...MANDATORY_DOCS], requiredDocs: [],
    gates: GATE_DEFS.map(g => ({ id: g.id, status: "Pending", date: null, approver: "", notes: "" })),
    updateCadence: "Biweekly", archived: false, pmoStatus: "Draft", dataReliabilityFlag: "Pending",
    isRoadmap: false,
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
    { label: "Basic Info", icon: "📋" },
    { label: "Timeline & Budget", icon: "📅" },
    { label: "Activities", icon: "🎯" },
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
          <FField label="PM Email"><input value={form.pmEmail || ""} onChange={e => set("pmEmail", e.target.value)} placeholder="pm@tree.com.sa" type="email" style={s} /></FField>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>🗺 Roadmap Project</div>
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
        <FField label="Roadmap Deadline" title="The strategic deadline from the roadmap. Overrunning this date applies a daily IPI penalty."><input type="date" value={form.roadmapDeadline || ""} onChange={e => set("roadmapDeadline", e.target.value)} style={s} /></FField>
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
  const activeT = useT();
  const dark = themeStore.dark;
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // ── PM default landing: redirect to actions on first load ────
  useEffect(() => {
    if (userRole === ROLE_PM) setRoute({ view: "actions" });
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
      // Filter by email (unique) with fallback to name match for projects without pmEmail yet
      if (currentUserEmail) {
        const email = currentUserEmail.trim().toLowerCase();
        return projects.filter(p =>
          p.pmEmail ? p.pmEmail.trim().toLowerCase() === email
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

    // Capture IPI snapshot for time-weighted history
    const snapState = {
      ...project,
      status, progress, plannedProgress, startDate, plannedEnd,
      budget, actualCost, milestones,
      documents: documents ?? project.documents,
    };
    const { ipi: snapIPI, components: snapComp } = calcProjectIPIFull(snapState);
    const ipiSnap = {
      date: today,
      ipi:  snapIPI,
      spi:  snapComp.spiFinal,
      cpi:  snapComp.cpi,
      mci:  snapComp.mci,
    };
    const prevHistory = project.ipiHistory || [];
    const ipiHistory  = prevHistory.some(h => h.date === today)
      ? prevHistory.map(h => h.date === today ? ipiSnap : h)
      : [...prevHistory, ipiSnap];

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
      milestones, risks, benefits,
      ...(documents ? { documents } : {}),
      updates: newUpdates, lastUpdate: today,
      ipiHistory,
      // PM submission: flag for PMO validation; other roles leave pmoStatus unchanged
      ...(userRole === ROLE_PM ? { pmoStatus: "Submitted", lastSubmittedBy: currentUserName, lastSubmittedDate: today } : {}),
    };
    if (!isUsingMock() && project.spId) {
      // PMOValidationNote/By/Date are PMO-only writes — never overwrite from PM/dept_head save
      // PMOStatus is intentionally NOT protected: PM sets it to "Submitted" above
      const PMO_PROTECTED = ["PMOValidationNote", "PMOValidatedBy", "PMOValidatedDate", "PMONotes", "RoadmapDeadline"];
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

  // Deactivated accounts — full lockout screen
  if (userRole === ROLE_LOCKED) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: activeT.bg, flexDirection: "column", gap: 16, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ fontSize: 52 }}>🔒</div>
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
          <AnimStyles />
          {/* Portfolio-level views — blocked for PM role */}
          {route.view === "home"        && userRole !== ROLE_PM && <HomeView          projects={visibleProjects} requests={requests} gateSubmissions={gateSubmissions} setRoute={setRoute} loadedAt={loadedAt} userRole={userRole} />}
          {route.view === "departments" && userRole !== ROLE_PM && <DepartmentsOverview projects={visibleProjects} setRoute={setRoute} />}
          {route.view === "projects"    && userRole !== ROLE_PM && <AllProjectsView    projects={visibleProjects} setRoute={setRoute} route={route} userRole={userRole} />}
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
