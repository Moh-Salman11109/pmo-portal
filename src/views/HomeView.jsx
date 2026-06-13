import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useT, themeStore, ttStyle } from "../theme.js";
import { useBp } from "../hooks/useBp.js";
import { useDepts } from "../deptContext.js";
import { SectionHeader } from "../shared.jsx";
import { ROLE_PM } from "../roles.js";
import { GATE_DEFS } from "../data/constants.js";
import { TODAY, daysSince } from "../utils/dates.js";
import { getDeptStats, calcDeptIPI, calcPortfolioIPI, calcProjectIPI, ipiColor } from "../utils/metrics.js";
import { fmtSAR } from "../utils/format.js";
import { KPICard } from "../components/KPICard.jsx";
import { Progress } from "../components/Progress.jsx";
import { RiskBadge } from "../components/Badge.jsx";

const HomeView = ({ projects, requests, gateSubmissions, setRoute, loadedAt, userRole }) => {
  const bp = useBp();
  const { departments } = useDepts();
  const T = useT();
  const dark = themeStore.dark;

  // ── Stable derived arrays (memoized to prevent re-computation on theme/resize) ──
  const allProjects    = useMemo(() => projects.filter(p => !p.archived),                [projects]);
  const activeProjects = useMemo(() => allProjects.filter(p => p.status !== "Completed"),[allProjects]);

  const portfolioIPI    = useMemo(() => calcPortfolioIPI(allProjects), [allProjects]);
  const d30             = useMemo(() => { const d = new Date(TODAY); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; }, []);
  const prevIPI         = useMemo(() => calcPortfolioIPI(allProjects, d30), [allProjects, d30]);
  const overrunProjects = useMemo(() => allProjects.filter(p => p.budget > 0 && (p.forecast || 0) > p.budget), [allProjects]);
  const overrunExposure = useMemo(() => overrunProjects.reduce((s, p) => s + ((p.forecast || 0) - p.budget), 0), [overrunProjects]);

  // ── Status counts ──────────────────────────────────────────────
  const byStatus = { "On Track": 0, "At Risk": 0, "Delayed": 0, "Completed": 0, "Not Started": 0 };
  allProjects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

  // ── Portfolio budget ───────────────────────────────────────────
  const budgetTotal   = allProjects.reduce((s, p) => s + p.budget, 0);
  const costTotal     = allProjects.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtilPct = budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0;

  // ── Department IPI chart data (memoized — each dept calls getDeptStats + calcDeptIPI) ──
  const deptPerf = useMemo(() => departments.map(d => {
    const s   = getDeptStats(d.id, allProjects);
    const ipi = calcDeptIPI(d.id, allProjects);
    const short = d.name
      .replace("Strategy & PMO", "Strategy")
      .replace("Operations", "Ops")
      .replace("Performance", "Perf");
    return { name: short, health: s.health, ipi, projects: s.total };
  }), [allProjects, departments]);

  // ── Overdue milestones (memoized — O(n×milestones) flatMap + sort) ─────────────
  const overdueMilestones = useMemo(() =>
    activeProjects.flatMap(p =>
      (p.milestones || [])
        .filter(m => m.status !== "Completed" && m.date && m.date < TODAY)
        .map(m => ({
          ...m,
          projectId:   p.id,
          projectName: p.name,
          daysOverdue: daysSince(m.date) || 0,
        }))
    ).sort((a, b) => b.daysOverdue - a.daysOverdue),
  [activeProjects]);

  const overdue7            = overdueMilestones.filter(m => m.daysOverdue <= 7);
  const overdue30           = overdueMilestones.filter(m => m.daysOverdue > 7 && m.daysOverdue <= 30);
  const overdueOld          = overdueMilestones.filter(m => m.daysOverdue > 30);
  const overdueProjectCount = useMemo(() => new Set(overdueMilestones.map(m => m.projectId)).size, [overdueMilestones]);

  // ── Portfolio Risk Register (High + Critical open risks across all active projects) ──
  const portfolioRisks = useMemo(() =>
    activeProjects.flatMap(p =>
      (p.risks || [])
        .filter(r => (r.level === "Critical" || r.level === "High") && r.status !== "Closed" && r.status !== "Mitigated")
        .map(r => ({ ...r, projectId: p.id, projectCode: p.code, projectName: p.name }))
    ).sort((a, b) => {
      const lvl = { Critical: 3, High: 2 };
      return (lvl[b.level] || 0) - (lvl[a.level] || 0);
    }),
  [activeProjects]);

  // ── Pending approvals ──────────────────────────────────────────
  const pendingApprovals = useMemo(() =>
    (gateSubmissions || [])
      .filter(g => !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected"))
      .sort((a, b) => (b.daysAtGate || 0) - (a.daysAtGate || 0)),
  [gateSubmissions]);

  // ── Gate pipeline (count active projects per gate) ─────────────
  const gatePipeline = useMemo(() => GATE_DEFS.map(def => {
    const count   = activeProjects.filter(p => p.gate === def.label).length;
    const g1Subs  = def.id === "G1" ? pendingApprovals : [];
    const avgDays = g1Subs.length
      ? Math.round(g1Subs.reduce((s, g) => s + (g.daysAtGate || 0), 0) / g1Subs.length)
      : null;
    return { ...def, count, avgDays };
  }), [activeProjects, pendingApprovals]);
  const maxGateCount = Math.max(...gatePipeline.map(g => g.count), 1);

  // ── Executive Intervention flags (memoized) ────────────────────
  const interventionFlags = useMemo(() => {
    const flags = [];
    activeProjects.forEach(p => {
      const reasons = [];
      let severity  = "medium";

      if (p.status === "Delayed") {
        reasons.push(`Delayed${p.daysDelayed > 0 ? ` — ${p.daysDelayed}d behind` : ""}`);
        severity = "high";
      }
      if (p.riskLevel === "Critical") {
        reasons.push("Critical risk");
        severity = "high";
      } else if (p.riskLevel === "High") {
        // High risk always surfaces as a reason, even when project is already Delayed
        reasons.push("High risk");
        if (severity !== "high") severity = "medium";
      }
      const staleDays = daysSince(p.lastUpdate);
      if (staleDays !== null && staleDays > 14) {
        reasons.push(`No update ${staleDays}d`);
      }
      if (p.budget > 0) {
        const util = p.actualCost / p.budget;
        if (util > 0.95) { reasons.push(`Budget ${Math.round(util * 100)}%`); severity = "high"; }
        else if (util > 0.85) reasons.push(`Budget ${Math.round(util * 100)}%`);
      }
      const om = (p.milestones || []).filter(m => m.status !== "Completed" && m.date && m.date < TODAY);
      if (om.length > 0) {
        const ageDays = daysSince(om.sort((a, b) => a.date.localeCompare(b.date))[0].date) || 0;
        reasons.push(`${om.length} overdue milestone${om.length > 1 ? "s" : ""}${ageDays > 0 ? ` (${ageDays}d)` : ""}`);
        if (ageDays > 14) severity = "high";
      }

      if (reasons.length > 0) {
        const score = (severity === "high" ? 100 : 50) + reasons.length * 10;
        flags.push({ project: p, reasons, severity, score });
      }
    });
    return flags.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [activeProjects]);

  // ── Layout helpers ─────────────────────────────────────────────
  const pad       = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const kpiCols   = bp === "mobile" ? "repeat(2, 1fr)" : bp === "tablet" ? "repeat(3, 1fr)" : "repeat(6, 1fr)";
  const chartCols = bp === "mobile" || bp === "tablet" ? "1fr" : "2fr 1fr";
  const deptCols  = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
  const heroCols  = bp === "mobile" || bp === "tablet" ? "1fr" : "2fr 1fr";

  const [ipiHovered,     setIpiHovered]     = useState(false);
  const [overrunHovered, setOverrunHovered] = useState(false);

  return (
    <div style={{ padding: pad, maxWidth: 1500 }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 20 : 26, fontWeight: 900, color: T.text }}>Enterprise Portfolio Dashboard</h1>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>
          Real-time portfolio overview · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          {loadedAt && <span style={{ color: T.accent, fontWeight: 600 }}> · Synced {loadedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
        </p>
      </div>

      {/* ── PRINT BUTTON ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => {
          const win = window.open("", "_blank", "width=1100,height=800");
          if (!win) return;
          const rows = allProjects.map(p => {
            const ipiVal = calcProjectIPI(p);
            const col = p.status === "On Track" ? "#16a34a" : p.status === "Delayed" ? "#dc2626" : p.status === "At Risk" ? "#d97706" : "#6b7280";
            return `<tr><td>${p.code}</td><td>${p.name}</td><td style="color:${col};font-weight:700">${p.status}</td><td>${p.priority}</td><td>${p.progress}%</td><td style="font-weight:700">${ipiVal}</td><td>${p.pm || "—"}</td><td>${p.plannedEnd || "—"}</td></tr>`;
          }).join("");
          const pIPI = calcPortfolioIPI(allProjects) ?? "—";
          win.document.write(`<!DOCTYPE html><html><head><title>PMO Report ${TODAY}</title><style>
            body{font-family:Arial,sans-serif;margin:32px;color:#111;font-size:13px}
            h1{font-size:20px;margin:0 0 4px}
            .sub{color:#666;font-size:12px;margin-bottom:20px}
            .kpis{display:flex;gap:16px;margin-bottom:20px}
            .kpi{border:1px solid #e5e7eb;border-radius:8px;padding:10px 18px;text-align:center}
            .kv{font-size:26px;font-weight:900}.kl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.04em}
            table{width:100%;border-collapse:collapse}
            th{background:#f9fafb;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb}
            td{padding:7px 10px;border-bottom:1px solid #f3f4f6}
            @media print{button{display:none!important}}
          </style></head><body>
            <h1>PMO Portfolio Status Report</h1>
            <div class="sub">Generated: ${TODAY} &nbsp;·&nbsp; ${allProjects.length} projects</div>
            <div class="kpis">
              <div class="kpi"><div class="kv" style="color:#003932">${pIPI}</div><div class="kl">Portfolio IPI</div></div>
              <div class="kpi"><div class="kv">${allProjects.length}</div><div class="kl">Total</div></div>
              <div class="kpi"><div class="kv" style="color:#dc2626">${allProjects.filter(p=>p.status==="Delayed").length}</div><div class="kl">Delayed</div></div>
              <div class="kpi"><div class="kv" style="color:#d97706">${allProjects.filter(p=>p.status==="At Risk").length}</div><div class="kl">At Risk</div></div>
              <div class="kpi"><div class="kv" style="color:#16a34a">${allProjects.filter(p=>p.status==="On Track").length}</div><div class="kl">On Track</div></div>
              <div class="kpi"><div class="kv" style="color:#16a34a">${allProjects.filter(p=>p.status==="Completed").length}</div><div class="kl">Completed</div></div>
            </div>
            <table><thead><tr><th>Code</th><th>Project</th><th>Status</th><th>Priority</th><th>Progress</th><th>IPI</th><th>PM</th><th>Planned End</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <div style="margin-top:28px;font-size:10px;color:#999;border-top:1px solid #e5e7eb;padding-top:8px">PMO Portal — Confidential · ${TODAY}</div>
            <script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
          </body></html>`);
          win.document.close();
        }} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
          🖨 Print Report
        </button>
      </div>

      {/* ── EXECUTIVE INTERVENTION PANEL ───────────────────────── */}
      {interventionFlags.length === 0 && (
        <div style={{ background: dark ? "rgba(22,163,74,0.08)" : "#f0fdf4", border: `1px solid ${dark ? "rgba(22,163,74,0.3)" : "#86efac"}`, borderRadius: 14, padding: "14px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15 }}>✅</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#16a34a" }}>All clear</span>
          <span style={{ fontSize: 12, color: T.muted }}>— No projects flagged for intervention</span>
        </div>
      )}
      {interventionFlags.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${dark ? "rgba(220,38,38,0.4)" : "#fca5a5"}`, borderRadius: 14, padding: "18px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🚨</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#dc2626" }}>Requires Attention</span>
            <span style={{ fontSize: 12, color: T.muted }}>— {interventionFlags.length} project{interventionFlags.length > 1 ? "s" : ""} flagged</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {interventionFlags.map(({ project: p, reasons, severity }) => (
              <div key={p.id}
                onClick={() => setRoute({ view: "project", projectId: p.id })}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  background: severity === "high"
                    ? (dark ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.05)")
                    : (dark ? "rgba(217,119,6,0.1)"  : "rgba(217,119,6,0.05)"),
                  border: `1px solid ${severity === "high" ? "rgba(220,38,38,0.2)" : "rgba(217,119,6,0.2)"}`,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{severity === "high" ? "🔴" : "🟡"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.code} — {p.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {reasons.map((r, i) => (
                      <span key={i}>{i > 0 && <span style={{ margin: "0 4px", opacity: 0.4 }}>·</span>}{r}</span>
                    ))}
                  </div>
                </div>
                <span style={{ color: T.muted, fontSize: 12, flexShrink: 0 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PORTFOLIO RISK REGISTER ────────────────────────────── */}
      {userRole !== ROLE_PM && portfolioRisks.length > 0 && (
        <details style={{ marginBottom: 24 }} open={portfolioRisks.filter(r => r.level === "Critical").length > 0}>
          <summary style={{ cursor: "pointer", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 24px", background: T.surface, border: `1px solid ${dark ? "rgba(220,38,38,0.35)" : "#fca5a5"}`, borderRadius: 14, fontSize: 14, fontWeight: 800, color: T.text }}>
            <span style={{ fontSize: 16 }}>⚠</span>
            <span>Portfolio Risk Register</span>
            {portfolioRisks.filter(r => r.level === "Critical").length > 0 && (
              <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                {portfolioRisks.filter(r => r.level === "Critical").length} Critical
              </span>
            )}
            <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
              {portfolioRisks.filter(r => r.level === "High").length} High
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted, fontWeight: 400 }}>click to toggle</span>
          </summary>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {["Project", "Risk", "Level", "Owner", "Due Date", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolioRisks.slice(0, 25).map((r, i) => (
                  <tr key={`${r.projectId}-${r.id}`} style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", transition: "background 0.15s" }}
                    onClick={() => setRoute({ view: "project", projectId: r.projectId })}
                    onMouseEnter={e => e.currentTarget.style.background = T.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.accent }}>{r.projectCode}</div>
                      <div style={{ fontSize: 11, color: T.muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.projectName}</div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, maxWidth: 200 }}>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      {r.mitigation && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>↳ {r.mitigation}</div>}
                    </td>
                    <td style={{ padding: "10px 14px" }}><RiskBadge level={r.level} /></td>
                    <td style={{ padding: "10px 14px", fontSize: 12 }}>{r.owner || "—"}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: r.dueDate && r.dueDate < TODAY ? "#dc2626" : T.muted }}>
                      {r.dueDate || "—"}
                      {r.dueDate && r.dueDate < TODAY && <span style={{ display: "block", fontSize: 10, color: "#dc2626" }}>overdue</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.status === "Open" ? "#dc2626" : "#eab308" }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
                {portfolioRisks.length > 25 && (
                  <tr><td colSpan={6} style={{ padding: "10px 14px", fontSize: 12, color: T.muted, textAlign: "center" }}>
                    +{portfolioRisks.length - 25} more — drill into departments to see all
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ── PORTFOLIO IPI + FORECAST OVERRUN ─────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: heroCols, gap: 14, marginBottom: 24 }}>
        <div
          onClick={() => setRoute({ view: "departments" })}
          onMouseEnter={() => setIpiHovered(true)}
          onMouseLeave={() => setIpiHovered(false)}
          style={{
            background: T.surface, border: `1px solid ${ipiHovered ? T.accent : T.border}`,
            borderRadius: 12, padding: "20px 24px", cursor: "pointer",
            transition: "box-shadow 0.18s, border-color 0.18s, transform 0.18s",
            boxShadow: ipiHovered ? "0 6px 22px rgba(0,0,0,0.11)" : "none",
            transform: ipiHovered ? "translateY(-3px)" : "translateY(0)",
          }}
        >
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Portfolio IPI</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: ipiColor(portfolioIPI).color, lineHeight: 1 }}>
              {portfolioIPI ?? "—"}
            </span>
            {portfolioIPI != null && (
              <span style={{ fontSize: 12, fontWeight: 700, color: ipiColor(portfolioIPI).color, background: ipiColor(portfolioIPI).bg, borderRadius: 20, padding: "3px 12px" }}>
                {ipiColor(portfolioIPI).label}
              </span>
            )}
          </div>
          {prevIPI != null && portfolioIPI != null && (() => {
            const delta = portfolioIPI - prevIPI;
            const color = delta > 0 ? "#16a34a" : delta < 0 ? "#dc2626" : T.muted;
            const text  = delta > 0 ? `▲ +${delta} vs last month` : delta < 0 ? `▼ ${delta} vs last month` : "— unchanged vs last month";
            return <div style={{ fontSize: 12, color, fontWeight: 600 }}>{text}</div>;
          })()}
          <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>SPI 50% · CPI 25% · Docs 25%</div>
        </div>

        <div
          onClick={() => setRoute({ view: "projects", filterOverrun: true })}
          onMouseEnter={() => setOverrunHovered(true)}
          onMouseLeave={() => setOverrunHovered(false)}
          style={{
            background: T.surface, border: `1px solid ${overrunHovered ? (overrunProjects.length > 0 ? "#dc2626" : T.accent) : T.border}`,
            borderRadius: 12, padding: "20px 24px", cursor: "pointer",
            transition: "box-shadow 0.18s, border-color 0.18s, transform 0.18s",
            boxShadow: overrunHovered ? "0 6px 22px rgba(0,0,0,0.11)" : "none",
            transform: overrunHovered ? "translateY(-3px)" : "translateY(0)",
          }}
        >
          <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Forecast Overrun</span>
          <div style={{ fontSize: 40, fontWeight: 900, color: overrunProjects.length > 0 ? "#dc2626" : "#16a34a", lineHeight: 1, margin: "8px 0" }}>
            {overrunProjects.length}
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            {overrunProjects.length > 0
              ? <span style={{ color: "#dc2626", fontWeight: 600 }}>{fmtSAR(overrunExposure)} exposure</span>
              : "No forecast overruns"}
          </div>
        </div>
      </div>

      {/* ── KPI ROW ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 14, marginBottom: 24 }}>
        <KPICard label="Total Projects"     value={allProjects.length}              icon="📋" onClick={() => setRoute({ view: "projects", filterStatus: "All" })} />
        <KPICard label="Delayed"            value={byStatus["Delayed"] || 0}        icon="🔴" color={byStatus["Delayed"] > 0 ? "#dc2626" : "#16a34a"} onClick={() => setRoute({ view: "projects", filterStatus: "Delayed" })} />
        <KPICard label="At Risk"            value={byStatus["At Risk"] || 0}        icon="⚠️" color={byStatus["At Risk"] > 0 ? "#eab308" : "#16a34a"} onClick={() => setRoute({ view: "projects", filterStatus: "At Risk" })} />
        <KPICard label="Overdue Milestones" value={overdueMilestones.length}        icon="📅" color={overdueMilestones.length > 0 ? "#dc2626" : "#16a34a"} sub={overdueMilestones.length > 0 ? `${overdueOld.length} critical (30d+)` : "All on track"} onClick={() => setRoute({ view: "actions" })} />
        <KPICard label="Pending Approvals"  value={pendingApprovals.length}         icon="⏳" color={pendingApprovals.length > 0 ? "#d97706" : "#16a34a"} sub={pendingApprovals.length > 0 ? `Oldest: ${pendingApprovals[0]?.daysAtGate || 0}d` : "Queue clear"} onClick={pendingApprovals.length > 0 ? () => setRoute({ view: "actions" }) : null} />
        <KPICard label="Budget Utilisation" value={`${budgetUtilPct}%`}             icon="💰" color={budgetUtilPct > 90 ? "#dc2626" : budgetUtilPct > 75 ? "#eab308" : T.primary} sub={`${fmtSAR(costTotal)} of ${fmtSAR(budgetTotal)}`} />
      </div>

      {/* ── ROW 1: Gate Pipeline (wide) | Overdue + Pending (narrow) ── */}
      <div style={{ display: "grid", gridTemplateColumns: chartCols, gap: 20, marginBottom: 20 }}>

        {/* Gate Pipeline */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Gate Pipeline</h3>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Active projects by current gate — bottlenecks show where work is stacking</p>
          {gatePipeline.every(g => g.count === 0) && (
            <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>No active projects currently in any gate.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {gatePipeline.map(g => {
              const barPct      = (g.count / maxGateCount) * 100;
              const isBottleneck = g.count > 1 && g.count === maxGateCount;
              return (
                <div key={g.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, minWidth: 52 }}>{g.label}</span>
                      <span style={{ fontSize: 11, color: T.muted }}>{g.name}</span>
                      {isBottleneck && (
                        <span style={{ fontSize: 10, fontWeight: 700, background: "#fef9c3", color: "#854d0e", padding: "1px 7px", borderRadius: 8 }}>BOTTLENECK</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {g.avgDays !== null && <span style={{ fontSize: 11, color: T.muted }}>avg {g.avgDays}d wait</span>}
                      <span style={{ fontSize: 14, fontWeight: 800, color: g.count > 0 ? T.primary : T.muted, minWidth: 18, textAlign: "right" }}>{g.count}</span>
                    </div>
                  </div>
                  <div style={{ background: T.border, borderRadius: 5, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 5, transition: "width 0.4s",
                      background: isBottleneck ? "#eab308" : g.count > 0 ? T.accent : "transparent" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Milestones + Pending Approvals stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Overdue Milestones */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", flex: 1 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: T.text }}>Overdue Milestones</h3>
            {overdueMilestones.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted, padding: "8px 0" }}>✅ All milestones on track</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "1–7 days",  items: overdue7,   color: "#eab308", bg: dark ? "rgba(234,179,8,0.1)"   : "#fef9c3" },
                    { label: "8–30 days", items: overdue30,  color: "#d97706", bg: dark ? "rgba(217,119,6,0.1)"  : "#fef3c7" },
                    { label: "30+ days",  items: overdueOld, color: "#dc2626", bg: dark ? "rgba(220,38,38,0.1)"  : "#fee2e2" },
                  ].filter(({ items }) => items.length > 0).map(({ label, items, color, bg }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, background: bg }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color }}>{items.length}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: T.muted }}>
                  {overdueMilestones.length} total across {overdueProjectCount} project{overdueProjectCount !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>

          {/* Pending Approvals */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 20px", flex: 1 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: T.text }}>Pending Approvals</h3>
            {pendingApprovals.length === 0 ? (
              <div style={{ fontSize: 13, color: T.muted, padding: "8px 0" }}>✅ No pending approvals</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pendingApprovals.slice(0, 4).map(g => (
                    <div key={g.id}
                      onClick={() => setRoute({ view: "actions" })}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, background: T.bg, cursor: "pointer" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.projectTitle || g.projectCode}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{g.gateLabel}</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 10, textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: (g.daysAtGate || 0) > 10 ? "#dc2626" : "#d97706" }}>{g.daysAtGate || 0}d</span>
                      </div>
                    </div>
                  ))}
                </div>
                {pendingApprovals.length > 4 && (
                  <div onClick={() => setRoute({ view: "actions" })} style={{ marginTop: 8, fontSize: 12, color: T.primary, fontWeight: 600, textAlign: "center", cursor: "pointer" }}>
                    +{pendingApprovals.length - 4} more →
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: IPI Chart (wide) + Budget Summary (narrow) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: chartCols, gap: 20, marginBottom: 24 }}>

        {/* Department IPI Scores */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }} title="Integrated Performance Index: Schedule Performance (SPI) × 50% + Cost Performance (CPI) × 25% + Document Compliance × 25%">Department IPI Scores</h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: T.muted }}>SPI×50% + CPI×25% + Docs×25% — delivery performance index</p>
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

        {/* Budget Summary — compact */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Portfolio Budget</h3>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Across all active projects</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { label: "Approved",  value: fmtSAR(budgetTotal),              color: T.text },
              { label: "Spent",     value: fmtSAR(costTotal),                color: T.text },
              { label: "Remaining", value: fmtSAR(budgetTotal - costTotal),  color: (budgetTotal - costTotal) >= 0 ? "#16a34a" : "#dc2626" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.muted }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Utilisation</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: budgetUtilPct > 90 ? "#dc2626" : T.text }}>{budgetUtilPct}%</span>
            </div>
            <Progress value={budgetUtilPct} height={10} color={budgetUtilPct > 90 ? "#dc2626" : budgetUtilPct > 75 ? "#eab308" : T.accent} />
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO TIMELINE ──────────────────────────────────── */}
      {(() => {
        const gps = [...activeProjects].filter(p => p.startDate && p.plannedEnd).sort((a, b) => a.startDate.localeCompare(b.startDate));
        if (gps.length < 2) return null;
        const minTs = Math.min(...gps.map(p => new Date(p.startDate).getTime()));
        const maxTs = Math.max(...gps.map(p => new Date(p.plannedEnd).getTime()));
        const span = maxTs - minTs || 1;
        const todayTs = new Date(TODAY).getTime();
        const tPct = Math.max(0, Math.min(100, ((todayTs - minTs) / span) * 100));
        const barCol = s => s === "On Track" ? "#16a34a" : s === "At Risk" ? "#f59e0b" : s === "Delayed" ? "#dc2626" : s === "Completed" ? "#3b82f6" : "#94a3b8";
        const lbls = [];
        const cur = new Date(minTs); cur.setDate(1);
        while (cur.getTime() <= maxTs) {
          const p = ((cur.getTime() - minTs) / span) * 100;
          if (p >= 0 && p <= 100) lbls.push({ l: cur.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), p });
          cur.setMonth(cur.getMonth() + 3);
        }
        return (
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Portfolio Timeline" subtitle={`${gps.length} projects with scheduled dates`} />
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 20px", overflowX: "auto" }}>
              <div style={{ position: "relative", height: 22, marginLeft: 180, marginBottom: 4, minWidth: 500 }}>
                {lbls.map(({ l, p }) => <div key={l} style={{ position: "absolute", left: `${p}%`, transform: "translateX(-50%)", fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>{l}</div>)}
                {tPct > 2 && tPct < 98 && <div style={{ position: "absolute", left: `${tPct}%`, transform: "translateX(-50%)", fontSize: 9, color: T.accent, fontWeight: 800, whiteSpace: "nowrap" }}>▼ TODAY</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 500 }}>
                {gps.map(p => {
                  const lp = ((new Date(p.startDate).getTime() - minTs) / span) * 100;
                  const wp = Math.max(0.5, ((new Date(p.plannedEnd).getTime() - new Date(p.startDate).getTime()) / span) * 100);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", height: 28 }}>
                      <div style={{ width: 180, flexShrink: 0, paddingRight: 10, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }} onClick={() => setRoute({ view: "project", projectId: p.id })}>
                        <span style={{ fontSize: 9, color: T.accent, fontWeight: 700, textTransform: "uppercase" }}>{p.code}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      </div>
                      <div style={{ flex: 1, position: "relative", height: 20, background: T.bg, borderRadius: 4 }}>
                        <div style={{ position: "absolute", left: `${lp}%`, width: `${wp}%`, height: "100%", background: barCol(p.status), borderRadius: 4, opacity: 0.82, cursor: "pointer", display: "flex", alignItems: "center", paddingLeft: 6, overflow: "hidden" }}
                          onClick={() => setRoute({ view: "project", projectId: p.id })} title={`${p.name} · ${p.startDate} → ${p.plannedEnd} · ${p.progress}%`}>
                          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{p.progress}%</span>
                        </div>
                        {tPct > 0 && tPct < 100 && <div style={{ position: "absolute", left: `${tPct}%`, top: -2, bottom: -2, width: 2, background: T.accent, opacity: 0.8, pointerEvents: "none" }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, marginLeft: 180 }}>
                {[["On Track","#16a34a"],["At Risk","#f59e0b"],["Delayed","#dc2626"],["Not Started","#94a3b8"]].map(([l,c]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 8, background: c, borderRadius: 2, display: "inline-block", opacity: 0.82 }} /><span style={{ color: T.muted }}>{l}</span></span>
                ))}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 2, height: 12, background: T.accent, display: "inline-block" }} /><span style={{ color: T.muted }}>Today</span></span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── RESOURCE LOAD ─────────────────────────────────────────── */}
      {(() => {
        const pm = {};
        activeProjects.forEach(p => {
          if (!p.pm) return;
          if (!pm[p.pm]) pm[p.pm] = { n: p.pm, t: 0, ok: 0, ar: 0, dl: 0 };
          pm[p.pm].t++;
          if (p.status === "On Track") pm[p.pm].ok++;
          else if (p.status === "At Risk") pm[p.pm].ar++;
          else if (p.status === "Delayed") pm[p.pm].dl++;
        });
        const rows = Object.values(pm).sort((a, b) => b.t - a.t);
        if (!rows.length) return null;
        return (
          <div style={{ marginBottom: 24 }}>
            <SectionHeader title="Resource Load" subtitle="Active project assignments per Project Manager" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {rows.map(r => (
                <div key={r.n} style={{ background: T.surface, border: `1px solid ${r.t >= 4 ? "#dc2626" : r.t >= 3 ? "#f59e0b" : T.border}`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{r.n}</div>
                    <span style={{ fontSize: 22, fontWeight: 900, color: r.t >= 4 ? "#dc2626" : r.t >= 3 ? "#f59e0b" : "#16a34a" }}>{r.t}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 10 }}>
                    {r.ok > 0 && <span style={{ background: "#dcfce7", color: "#15803d", borderRadius: 10, padding: "1px 7px" }}>{r.ok} On Track</span>}
                    {r.ar > 0 && <span style={{ background: "#fef9c3", color: "#854d0e", borderRadius: 10, padding: "1px 7px" }}>{r.ar} At Risk</span>}
                    {r.dl > 0 && <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 10, padding: "1px 7px" }}>{r.dl} Delayed</span>}
                  </div>
                  {r.t >= 4 && <div style={{ marginTop: 6, fontSize: 10, color: "#dc2626", fontWeight: 700 }}>⚠ Overloaded</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── DEPARTMENT CARDS ─────────────────────────────────────── */}
      <SectionHeader title="Department Portfolio Overview" subtitle="Click a department to view its projects" />
      <div style={{ display: "grid", gridTemplateColumns: deptCols, gap: 16 }}>
        {departments.map(d => {
          const stats = getDeptStats(d.id, allProjects);
          return (
            <div key={d.id} onClick={() => setRoute({ view: "department", deptId: d.id })}
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
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
                  { label: "On Track", value: stats.onTrack,   color: "#16a34a" },
                  { label: "At Risk",  value: stats.atRisk,   color: "#eab308" },
                  { label: "Delayed",  value: stats.delayed,  color: "#dc2626" },
                  { label: "Done",     value: stats.completed, color: "#3b82f6" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
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

export default HomeView;
