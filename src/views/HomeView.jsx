// ============================================================================
//  HOME VIEW — Portfolio Overview Dashboard
// ============================================================================
//
//  The first page an executive lands on after login. Built as five clearly
//  separated tiers so the page reads top-to-bottom as a story rather than a
//  flat dump of cards:
//
//    Tier 1 — Hero               Greeting, big Portfolio IPI with gauge,
//                                three quick stats (with project names, not
//                                just counts), composition strip
//
//    Tier 2 — Today's priorities Intervention Panel (8 signals), Risk
//                                Watchlist (early warnings on projects not
//                                already flagged)
//
//    Tier 3 — Workflow           Gate Pipeline (G1–G5 with bottleneck
//                                detection that ignores G4 execution),
//                                Pending Approvals (gates + closures merged
//                                and sorted by age), Overdue Milestones in
//                                aged buckets
//
//    Tier 4 — Performance        Department IPI bar chart, Portfolio Budget
//
//    Tier 5 — Inventory          Department cards with rotating accent
//                                stripes from the Tree palette
//
//  Each tier label carries a one-sentence narrative subtitle computed from
//  the data (e.g. "Gate 3 is your bottleneck with 8 projects stacked").
//
// ============================================================================

import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useT, themeStore, ttStyle } from "../theme.js";
import { useBp } from "../hooks/useBp.js";
import { useDepts } from "../deptContext.js";
import { ROLE_PM } from "../roles.js";
import { GATE_DEFS } from "../data/constants.js";
import { TODAY, daysSince } from "../utils/dates.js";
import { getDeptStats, calcDeptIPI, calcPortfolioIPI, ipiColor, ipiColorDark } from "../utils/metrics.js";
import { fmtSAR } from "../utils/format.js";
import { Progress } from "../components/Progress.jsx";
import { RiskBadge } from "../components/Badge.jsx";

const HomeView = ({ projects, requests, gateSubmissions, closureSubmissions, setRoute, loadedAt, userRole }) => {
  const bp = useBp();
  const { departments } = useDepts();
  const T = useT();
  const dark = themeStore.dark;

  // ── Derived data ────────────────────────────────────────────────
  const allProjects    = useMemo(() => projects.filter(p => !p.archived),                [projects]);
  const activeProjects = useMemo(() => allProjects.filter(p => p.status !== "Completed"),[allProjects]);

  const portfolioIPI = useMemo(() => calcPortfolioIPI(allProjects), [allProjects]);
  const d30          = useMemo(() => { const d = new Date(TODAY); d.setDate(d.getDate() - 30); return d.toISOString().split("T")[0]; }, []);
  const hasD30       = useMemo(() => allProjects.some(p => (p.ipiHistory || []).some(h => h.date && h.date <= d30)), [allProjects, d30]);
  const prevIPI      = useMemo(() => hasD30 ? calcPortfolioIPI(allProjects, d30) : null, [hasD30, allProjects, d30]);

  const overrunProjects = useMemo(() => allProjects.filter(p => p.budget > 0 && (p.forecast || 0) > p.budget), [allProjects]);
  const overrunExposure = useMemo(() => overrunProjects.reduce((s, p) => s + ((p.forecast || 0) - p.budget), 0), [overrunProjects]);

  const byStatus = { "On Track": 0, "At Risk": 0, "Delayed": 0, "Completed": 0, "Not Started": 0 };
  allProjects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

  const budgetTotal   = allProjects.reduce((s, p) => s + p.budget, 0);
  const costTotal     = allProjects.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtilPct = budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0;

  // Department perf (only depts with projects)
  const deptPerf = useMemo(() => departments
    .map(d => {
      const s   = getDeptStats(d.id, allProjects);
      const ipi = calcDeptIPI(d.id, allProjects);
      const short = d.name.replace("Strategy & PMO", "Strategy").replace("Operations", "Ops").replace("Performance", "Perf");
      return { id: d.id, name: short, fullName: d.name, icon: d.icon, health: s.health, ipi, projects: s.total, stats: s };
    })
    .filter(d => d.projects > 0)
  , [allProjects, departments]);

  const rankedDepts = useMemo(() => [...deptPerf].sort((a, b) => (b.ipi || 0) - (a.ipi || 0)), [deptPerf]);
  const leaderDept  = rankedDepts.find(d => d.ipi != null);
  const laggardDept = [...rankedDepts].reverse().find(d => d.ipi != null);

  // Overdue milestones
  const overdueMilestones = useMemo(() =>
    activeProjects.flatMap(p =>
      (p.milestones || [])
        .filter(m => m.status !== "Completed" && m.date && m.date < TODAY)
        .map(m => ({ ...m, projectId: p.id, projectName: p.name, daysOverdue: daysSince(m.date) || 0 }))
    ).sort((a, b) => b.daysOverdue - a.daysOverdue),
  [activeProjects]);
  const overdue7    = overdueMilestones.filter(m => m.daysOverdue <= 7);
  const overdue30   = overdueMilestones.filter(m => m.daysOverdue > 7 && m.daysOverdue <= 30);
  const overdueOld  = overdueMilestones.filter(m => m.daysOverdue > 30);
  const overdueProjectCount = useMemo(() => new Set(overdueMilestones.map(m => m.projectId)).size, [overdueMilestones]);
  const maturating          = useMemo(() => overdueMilestones.filter(m => m.daysOverdue >= 25 && m.daysOverdue <= 30).length, [overdueMilestones]);

  // Portfolio risks
  const portfolioRisks = useMemo(() =>
    activeProjects.flatMap(p =>
      (p.risks || [])
        .filter(r => (r.level === "Critical" || r.level === "High") && r.status !== "Closed" && r.status !== "Mitigated")
        .map(r => ({ ...r, projectId: p.id, projectCode: p.code, projectName: p.name }))
    ).sort((a, b) => ({ Critical: 3, High: 2 }[b.level] || 0) - ({ Critical: 3, High: 2 }[a.level] || 0)),
  [activeProjects]);

  // Pending gate submissions (in workflow queue, awaiting approval)
  const pendingGates = useMemo(() =>
    (gateSubmissions || []).filter(g => !g.status?.startsWith("Approved") && !g.status?.startsWith("Rejected")),
  [gateSubmissions]);
  // Pending closure submissions (Gate 5 workflow queue)
  const pendingClosures = useMemo(() =>
    (closureSubmissions || []).filter(c => c.status !== "Closed"),
  [closureSubmissions]);

  // Pending approvals — gates + closures combined, oldest first
  const pendingApprovals = useMemo(() => {
    const merged = [
      ...pendingGates.map(g => ({ ...g, _kind: "gate" })),
      ...pendingClosures.map(c => ({ ...c, _kind: "closure", gateLabel: "Gate 5 — Closure", daysAtGate: c.daysInClosure || 0 })),
    ];
    return merged.sort((a, b) => (b.daysAtGate || 0) - (a.daysAtGate || 0));
  }, [pendingGates, pendingClosures]);

  // Gate pipeline counts: union of projects at that gate plus any pending
  // gate or closure submission for it, deduped by project id. Match by
  // gateNumber — SP stores gateLabel as the long form ("Gate 1 — Project
  // Initiation") which won't equal GATE_DEFS' short label. SP also writes
  // ProjectCode = "0" for unlinked submissions; realId() treats that as
  // missing so two unlinked rows get unique fallback keys.
  const realId = (id) => (id && id !== "0") ? id : null;
  const gatePipeline = useMemo(() => GATE_DEFS.map(def => {
    const gateNum = def.id.replace("G", ""); // G1 → "1"
    const ids = new Set();
    activeProjects.forEach(p => { if (p.gate === def.label) ids.add(p.id); });
    pendingGates.forEach(g => { if (String(g.gateNumber) === gateNum) ids.add(realId(g.projectId) || `gs-${g.id}`); });
    if (def.id === "G5") {
      pendingClosures.forEach(c => ids.add(realId(c.projectId) || `cs-${c.id}`));
    }
    return { ...def, count: ids.size };
  }), [activeProjects, pendingGates, pendingClosures]);
  const maxGateCount = Math.max(...gatePipeline.map(g => g.count), 1);
  // Gate 4 is excluded — execution gate by design holds projects for months,
  // a high count there isn't a queue.
  const bottleneckGate = useMemo(() => {
    const approvalGates = gatePipeline.filter(g => g.id !== "G4");
    if (approvalGates.length === 0) return null;
    const max = approvalGates.reduce((a, b) => (a.count > b.count ? a : b), approvalGates[0]);
    return max && max.count > 1 ? max : null;
  }, [gatePipeline]);

  // Intervention flags
  const interventionFlags = useMemo(() => {
    const flags = [];
    activeProjects.forEach(p => {
      const reasons = [];
      let severity  = "medium";

      if (p.status === "Delayed") {
        reasons.push(`Delayed${p.daysDelayed > 0 ? ` — ${p.daysDelayed}d behind` : ""}`);
        severity = "high";
      }
      // Quote the actual risk title in the flag — bare "Critical risk" isn't actionable.
      const openRisks = (p.risks || []).filter(r => r.status !== "Closed" && r.status !== "Mitigated");
      const critical  = openRisks.filter(r => r.level === "Critical");
      const high      = openRisks.filter(r => r.level === "High");
      const truncate  = (s, n) => { const t = (s || "").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
      if (critical.length > 0) {
        const title = truncate(critical[0].title, 42);
        reasons.push(critical.length === 1
          ? (title ? `Critical risk: ${title}` : "Critical risk open")
          : (title ? `${critical.length} critical · top: ${title}` : `${critical.length} critical risks`));
        severity = "high";
      } else if (high.length > 0) {
        const title = truncate(high[0].title, 42);
        reasons.push(high.length === 1
          ? (title ? `High risk: ${title}` : "High risk open")
          : (title ? `${high.length} high · top: ${title}` : `${high.length} high risks`));
        if (severity !== "high") severity = "medium";
      }
      const staleDays = daysSince(p.lastUpdate);
      if (staleDays !== null && staleDays > 14) reasons.push(`No update ${staleDays}d`);
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
    return flags.sort((a, b) => b.score - a.score);
  }, [activeProjects]);
  const flagsHigh  = interventionFlags.filter(f => f.severity === "high").length;
  const flagsMed   = interventionFlags.length - flagsHigh;
  // Watchlist excludes projects already shown in the Intervention Panel —
  // it's the early-warning list, not a duplicate of the same headlines.
  const flaggedProjectIds = useMemo(() => new Set(interventionFlags.map(f => f.project.id)), [interventionFlags]);
  const watchlistRisks    = useMemo(() => portfolioRisks.filter(r => !flaggedProjectIds.has(r.projectId)), [portfolioRisks, flaggedProjectIds]);

  // ── Narrative ──────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 22) return "Good evening";
    return "Working late";
  }, []);
  const todayStr = useMemo(() =>
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  , []);

  const ipiDelta  = (portfolioIPI != null && prevIPI != null) ? (portfolioIPI - prevIPI) : null;
  const trendText = ipiDelta == null ? "no comparison data yet"
    : ipiDelta > 0 ? `▲ +${ipiDelta} vs last month`
    : ipiDelta < 0 ? `▼ ${ipiDelta} vs last month`
    : "— unchanged vs last month";
  const trendColor = ipiDelta == null ? "rgba(255,255,255,0.55)"
    : ipiDelta > 0 ? "#4ade80"
    : ipiDelta < 0 ? "#fca5a5"
    : "rgba(255,255,255,0.55)";
  const ipiBand     = portfolioIPI != null ? ipiColor(portfolioIPI) : null;
  const ipiBandDark = portfolioIPI != null ? ipiColorDark(portfolioIPI) : null;

  // Portfolio narrative — the "data scientist" voice
  const portfolioStory = useMemo(() => {
    if (activeProjects.length === 0) return "No active projects in your portfolio yet.";
    const bits = [`${activeProjects.length} active project${activeProjects.length > 1 ? "s" : ""} across ${rankedDepts.length} department${rankedDepts.length > 1 ? "s" : ""}.`];
    if (leaderDept && laggardDept && leaderDept.id !== laggardDept.id) {
      bits.push(`${leaderDept.fullName} leads at ${leaderDept.ipi}; ${laggardDept.fullName} lags at ${laggardDept.ipi}.`);
    }
    return bits.join(" ");
  }, [activeProjects.length, rankedDepts.length, leaderDept, laggardDept]);

  // Priority tier story
  const priorityStory = useMemo(() => {
    if (interventionFlags.length === 0) return "No projects flagged — everything is within tolerance today.";
    const parts = [];
    if (flagsHigh > 0) parts.push(`${flagsHigh} need decision now`);
    if (flagsMed > 0)  parts.push(`${flagsMed} need monitoring`);
    return parts.join(" · ");
  }, [interventionFlags.length, flagsHigh, flagsMed]);

  // Workflow tier story
  const workflowStory = useMemo(() => {
    const bits = [];
    if (bottleneckGate) bits.push(`${bottleneckGate.label} is your bottleneck with ${bottleneckGate.count} projects stacked`);
    if (pendingApprovals.length > 0) {
      const oldest = pendingApprovals[0].daysAtGate || 0;
      if (oldest > 0) bits.push(`oldest approval ${oldest}d in queue`);
    }
    if (maturating > 0) bits.push(`${maturating} milestone${maturating > 1 ? "s" : ""} will cross 30d this week`);
    return bits.length ? bits.join(" · ") + "." : "Workflow is flowing.";
  }, [bottleneckGate, pendingApprovals, maturating]);

  // Performance tier story
  const performanceStory = useMemo(() => {
    if (rankedDepts.length < 2) return null;
    const spread = (leaderDept?.ipi ?? 0) - (laggardDept?.ipi ?? 0);
    const bits = [`${rankedDepts.length} department${rankedDepts.length > 1 ? "s" : ""} reporting · spread ${spread} points between leader and laggard.`];
    if (overrunProjects.length > 0) {
      bits.push(`${overrunProjects.length} project${overrunProjects.length > 1 ? "s" : ""} forecast overrun — SAR ${(overrunExposure / 1_000_000).toFixed(1)}M exposure.`);
    } else {
      bits.push("No forecast overruns — every project tracking within budget.");
    }
    return bits.join(" ");
  }, [rankedDepts.length, leaderDept, laggardDept, overrunProjects.length, overrunExposure]);

  // ── Layout ─────────────────────────────────────────────────────
  const pad = bp === "mobile" ? "16px" : bp === "tablet" ? "24px" : "32px";
  const isNarrow = bp === "mobile" || bp === "tablet";

  // ── Reusable styles ────────────────────────────────────────────
  const heroGradient = `
    radial-gradient(circle at 88% 18%, rgba(0,255,179,0.10) 0%, transparent 42%),
    radial-gradient(circle at 12% 88%, rgba(0,255,179,0.06) 0%, transparent 38%),
    linear-gradient(135deg, #001f1a 0%, #003932 50%, #006b56 100%)
  `;

  const tierLabel = (ix, title, meta, accent) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "32px 0 14px", flexWrap: "wrap" }}>
      <span style={{ background: accent.bg, color: accent.text, fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 700, padding: "4px 9px", borderRadius: 6, letterSpacing: "0.5px" }}>{ix}</span>
      <h2 style={{ fontSize: bp === "mobile" ? 15 : 17, fontWeight: 800, color: T.text, letterSpacing: "-0.3px", margin: 0 }}>{title}</h2>
      {meta && <span style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginLeft: "auto" }}>{meta}</span>}
    </div>
  );

  return (
    <div style={{ padding: pad, maxWidth: 1500 }}>

      {/* ══════════ TIER 1 — HERO ══════════ */}
      <div style={{
        background: heroGradient, color: "white",
        borderRadius: 20, padding: bp === "mobile" ? "20px 22px" : "28px 36px 30px",
        position: "relative", overflow: "hidden",
        borderBottom: "4px solid #00FFB3",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, position: "relative", zIndex: 2 }}>
          <div>
            <div style={{ color: "#00FFB3", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 4 }}>{greeting}</div>
            <h1 style={{ fontSize: bp === "mobile" ? 22 : 28, fontWeight: 800, color: "white", lineHeight: 1.1, letterSpacing: "-0.5px", margin: 0 }}>Enterprise Portfolio</h1>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{todayStr}{loadedAt && <span style={{ color: "#00FFB3", marginLeft: 8 }}>· Synced {loadedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}</div>
          </div>
          <img src="/tree-logo.png" alt="Tree" style={{ height: 34, opacity: 0.95 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "340px 1fr", gap: 36, alignItems: "center", position: "relative", zIndex: 2 }}>

          {/* IPI block */}
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6 }}>Portfolio IPI</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: bp === "mobile" ? 78 : 110, fontWeight: 900, color: "white", lineHeight: 0.85, letterSpacing: "-5px" }}>
                {portfolioIPI ?? "—"}
              </div>
              {ipiBand && ipiBandDark && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ background: ipiBandDark.bg, border: `1px solid ${ipiBandDark.border}`, color: ipiBandDark.text, padding: "3px 11px", borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>● {ipiBand.label}</div>
                  <div style={{ color: trendColor, fontSize: 11, fontWeight: 700 }}>{trendText}</div>
                </div>
              )}
            </div>
            {/* Horizontal gauge bar */}
            {portfolioIPI != null && (
              <div style={{ marginTop: 18 }}>
                <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, portfolioIPI)}%`, background: `linear-gradient(90deg, ${ipiBandDark.gaugeFrom}, ${ipiBandDark.gaugeTo})`, borderRadius: 5 }} />
                  <div style={{ position: "absolute", left: "70%", top: -3, width: 1, height: 16, background: "rgba(255,255,255,0.25)" }} />
                  <div style={{ position: "absolute", left: "90%", top: -3, width: 1, height: 16, background: "rgba(255,255,255,0.25)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                  <span>0</span><span>At Risk · 70</span><span>Watch · 90</span><span>100</span>
                </div>
              </div>
            )}
          </div>

          {/* Summary column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{portfolioStory}</div>

            {/* Stats — sublines name actual projects, not severity counts. */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[
                {
                  label: "Need attention",
                  value: interventionFlags.length,
                  color: interventionFlags.length > 0 ? "#fca5a5" : "white",
                  sub: interventionFlags.length === 0
                    ? "all clear"
                    : interventionFlags.length === 1
                      ? interventionFlags[0].project.code
                      : interventionFlags.length === 2
                        ? `${interventionFlags[0].project.code} · ${interventionFlags[1].project.code}`
                        : `${interventionFlags[0].project.code} · ${interventionFlags[1].project.code} +${interventionFlags.length - 2} more`,
                },
                {
                  label: "Budget utilised",
                  value: `${budgetUtilPct}%`,
                  color: "white",
                  sub: `${fmtSAR(costTotal)} of ${fmtSAR(budgetTotal)}`,
                },
                {
                  label: "Pending approvals",
                  value: pendingApprovals.length,
                  color: pendingApprovals.length > 0 ? "#00FFB3" : "white",
                  sub: pendingApprovals.length === 0
                    ? "queue clear"
                    : `${(pendingApprovals[0].projectCode || pendingApprovals[0].projectTitle || "—")} · ${pendingApprovals[0].daysAtGate || 0}d`,
                },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 4, fontWeight: 500 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Composition strip */}
            <div>
              <div style={{ display: "flex", gap: 3, height: 8 }}>
                <div style={{ height: "100%", borderRadius: 4, background: "#00FFB3", flex: 50 }} />
                <div style={{ height: "100%", borderRadius: 4, background: "#FF5000", flex: 25 }} />
                <div style={{ height: "100%", borderRadius: 4, background: "#C9D5C9", flex: 25 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: 600, flexWrap: "wrap", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FFB3" }} /><strong style={{ color: "white", fontWeight: 800 }}>SPI</strong> 50% · schedule</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5000" }} /><strong style={{ color: "white", fontWeight: 800 }}>CPI</strong> 25% · cost</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#C9D5C9" }} /><strong style={{ color: "white", fontWeight: 800 }}>MCI</strong> 25% · maturity</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ TIER 2 — PRIORITIES ══════════ */}
      {tierLabel("TIER 2", "Today's priorities", priorityStory, { bg: "#490300", text: "white" })}

      {interventionFlags.length === 0 && (
        <div style={{ background: dark ? "rgba(22,163,74,0.08)" : "#f0fdf4", border: `1px solid ${dark ? "rgba(22,163,74,0.3)" : "#86efac"}`, borderRadius: 14, padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15 }}>✅</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#16a34a" }}>All clear</span>
          <span style={{ fontSize: 12, color: T.muted }}>— No projects flagged for intervention</span>
        </div>
      )}
      {interventionFlags.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: "4px solid #FF5000", borderRadius: 12, padding: "18px 22px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>🚨</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: T.text }}>Requires Attention</span>
            <span style={{ fontSize: 12, color: T.muted, marginLeft: "auto" }}>{interventionFlags.length} flagged across 8 signals</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {interventionFlags.slice(0, 8).map(({ project: p, reasons, severity }) => (
              <div key={p.id}
                onClick={() => setRoute({ view: "project", projectId: p.id })}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  background: severity === "high"
                    ? (dark ? "rgba(220,38,38,0.10)" : "#fef2f0")
                    : (dark ? "rgba(217,119,6,0.10)"  : "#fff5ee"),
                  border: `1px solid ${severity === "high" ? "#f5d4d0" : "#fed7aa"}`,
                  transition: "transform 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
              >
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{severity === "high" ? "🔴" : "🟡"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.code} — {p.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{reasons.map((r, i) => (<span key={i}>{i > 0 && <span style={{ margin: "0 4px", opacity: 0.4 }}>·</span>}{r}</span>))}</div>
                </div>
                <span style={{ color: T.muted, fontSize: 12, flexShrink: 0 }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist — early warning, projects not yet in the intervention panel. */}
      {userRole !== ROLE_PM && watchlistRisks.length > 0 && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ cursor: "pointer", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", background: T.surface, borderLeft: "4px solid #490300", border: `1px solid ${T.border}`, borderLeftWidth: 4, borderLeftColor: "#490300", borderRadius: 12, fontSize: 14, fontWeight: 800, color: T.text, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>👁</span>
            <span>Risk Watchlist</span>
            {watchlistRisks.filter(r => r.level === "Critical").length > 0 && (
              <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{watchlistRisks.filter(r => r.level === "Critical").length} Critical</span>
            )}
            {watchlistRisks.filter(r => r.level === "High").length > 0 && (
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{watchlistRisks.filter(r => r.level === "High").length} High</span>
            )}
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 400, flex: 1, minWidth: 200 }}>· early warning — open risks on projects not yet flagged above</span>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>click to expand ▼</span>
          </summary>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>{["Project", "Risk", "Level", "Owner", "Due Date", "Status"].map(h => (<th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>))}</tr></thead>
              <tbody>
                {watchlistRisks.slice(0, 25).map(r => (
                  <tr key={`${r.projectId}-${r.id}`} style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer" }}
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
                    <td style={{ padding: "10px 14px", fontSize: 12, color: r.dueDate && r.dueDate < TODAY ? "#dc2626" : T.muted }}>{r.dueDate || "—"}{r.dueDate && r.dueDate < TODAY && <span style={{ display: "block", fontSize: 10, color: "#dc2626" }}>overdue</span>}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 600, color: r.status === "Open" ? "#dc2626" : "#eab308" }}>{r.status}</span></td>
                  </tr>
                ))}
                {watchlistRisks.length > 25 && (<tr><td colSpan={6} style={{ padding: "10px 14px", fontSize: 12, color: T.muted, textAlign: "center" }}>+{watchlistRisks.length - 25} more — drill into departments to see all</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ══════════ TIER 3 — WORKFLOW ══════════ */}
      {tierLabel("TIER 3", "Workflow & approvals", workflowStory, { bg: "#003932", text: "#00FFB3" })}

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Gate Pipeline */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "3px solid #00b894", borderRadius: 12, padding: "18px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.text }}>Gate Pipeline</h3>
          <p style={{ margin: "0 0 16px", fontSize: 11, color: T.muted }}>Active projects by current gate — bottlenecks show where work is stacking</p>
          {gatePipeline.every(g => g.count === 0) && (<p style={{ margin: 0, fontSize: 13, color: T.muted }}>No active projects currently in any gate.</p>)}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {gatePipeline.map(g => {
              const barPct = (g.count / maxGateCount) * 100;
              const isBN  = bottleneckGate && g.id === bottleneckGate.id;
              return (
                <div key={g.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, minWidth: 50 }}>{g.label}</span>
                      <span style={{ fontSize: 11, color: T.muted }}>{g.name}</span>
                      {isBN && <span style={{ fontSize: 9.5, fontWeight: 700, background: "#fef9c3", color: "#854d0e", padding: "1px 7px", borderRadius: 8 }}>BOTTLENECK</span>}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: g.count > 0 ? T.primary : T.muted, minWidth: 18, textAlign: "right" }}>{g.count}</span>
                  </div>
                  <div style={{ background: T.border, borderRadius: 5, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${barPct}%`, height: "100%", borderRadius: 5, transition: "width 0.4s", background: isBN ? "#eab308" : g.count > 0 ? "#00b894" : "transparent" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "3px solid #00b894", borderRadius: 12, padding: "18px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.text }}>Pending Approvals</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>Awaiting decision · oldest first</p>
          {pendingApprovals.length === 0 ? (
            <div style={{ fontSize: 13, color: T.muted, padding: "8px 0" }}>✅ No pending approvals</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingApprovals.slice(0, 4).map(g => (
                  <div key={g.id} onClick={() => setRoute({ view: "actions" })} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: T.bg, cursor: "pointer" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.projectTitle || g.projectCode}</div>
                      <div style={{ fontSize: 10.5, color: T.muted }}>{g.gateLabel}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: (g.daysAtGate || 0) > 10 ? "#dc2626" : "#d97706" }}>{g.daysAtGate || 0}d</span>
                  </div>
                ))}
              </div>
              {pendingApprovals.length > 4 && (<div onClick={() => setRoute({ view: "actions" })} style={{ marginTop: 8, fontSize: 12, color: T.primary, fontWeight: 600, textAlign: "center", cursor: "pointer" }}>+{pendingApprovals.length - 4} more →</div>)}
            </>
          )}
        </div>
      </div>

      {/* Overdue Milestones — aged buckets */}
      {overdueMilestones.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "3px solid #00b894", borderRadius: 12, padding: "18px 22px", marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.text }}>Overdue Milestones</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>Aged across the portfolio · {overdueMilestones.length} total across {overdueProjectCount} project{overdueProjectCount !== 1 ? "s" : ""}{maturating > 0 && <span style={{ color: "#c2410c", fontWeight: 700 }}> · {maturating} will cross 30d this week</span>}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "1–7 days",         items: overdue7,   bg: "#fef9c3", color: "#ca8a04" },
              { label: "8–30 days",        items: overdue30,  bg: "#ffedd5", color: "#c2410c" },
              { label: "30+ days · CRITICAL", items: overdueOld, bg: "#fee2e2", color: "#b91c1c" },
            ].map(({ label, items, bg, color }) => (
              <div key={label} style={{ padding: 12, borderRadius: 10, background: bg, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color }}>{items.length}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ TIER 4 — PERFORMANCE ══════════ */}
      {tierLabel("TIER 4", "Performance picture", performanceStory, { bg: "#00b894", text: "white" })}

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Dept IPI Chart */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "3px solid #00FFB3", borderRadius: 12, padding: "18px 22px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.text }} title="IPI: Schedule×50 + Cost×25 + Maturity×25">Department IPI Scores</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>SPI×50% + CPI×25% + MCI×25% — click a bar to drill in</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptPerf} barSize={32} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} width={38} />
              <Tooltip formatter={v => [v, "IPI Score"]} {...ttStyle()} />
              <Bar dataKey="ipi" radius={[6, 6, 0, 0]}>
                {deptPerf.map((entry, i) => { const c = ipiColor(entry.ipi); return <Cell key={i} fill={c.color} />; })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            {[{ l: "On Track 100+", c: "#15803d" }, { l: "Watch 90–99", c: "#854d0e" }, { l: "At Risk 70–89", c: "#c2410c" }, { l: "Critical <70", c: "#991b1b" }].map(b => (
              <div key={b.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: b.c }} />
                <span style={{ fontSize: 10, color: T.muted }}>{b.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Budget */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: "3px solid #00FFB3", borderRadius: 12, padding: "18px 22px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: T.text }}>Portfolio Budget</h3>
          <p style={{ margin: "0 0 14px", fontSize: 11, color: T.muted }}>Across all active projects</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { label: "Approved",  value: fmtSAR(budgetTotal),              color: T.text },
              { label: "Spent",     value: fmtSAR(costTotal),                color: T.text },
              { label: "Remaining", value: fmtSAR(budgetTotal - costTotal),  color: (budgetTotal - costTotal) >= 0 ? "#16a34a" : "#dc2626" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: T.muted }}>Utilisation</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: budgetUtilPct > 90 ? "#dc2626" : T.text }}>{budgetUtilPct}%</span>
            </div>
            <Progress value={budgetUtilPct} height={10} color={budgetUtilPct > 90 ? "#dc2626" : budgetUtilPct > 75 ? "#eab308" : T.accent} />
          </div>
        </div>
      </div>

      {/* ══════════ TIER 5 — INVENTORY (Department cards) ══════════ */}
      {tierLabel("TIER 5", "Department portfolio overview", "click any department to drill in", { bg: "#5a7a6e", text: "white" })}

      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 14 }}>
        {departments.map((d, i) => {
          const stats = getDeptStats(d.id, allProjects);
          const ipi   = calcDeptIPI(d.id, allProjects);
          const band  = ipi != null ? ipiColor(ipi) : null;
          // Rotating accent stripe so dept cards aren't all one color
          const stripes = ["#00FFB3", "#00b894", "#007a62", "#FF5000", "#490300", "#5a7a6e"];
          const stripe  = stripes[i % stripes.length];
          return (
            <div key={d.id} onClick={() => setRoute({ view: "department", deptId: d.id })}
              style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, cursor: "pointer", transition: "all 0.18s", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,57,50,0.10)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: stripe }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, background: T.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{d.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{stats.total} projects</div>
                  </div>
                </div>
                {band && (
                  <span style={{ padding: "5px 10px", borderRadius: 10, fontSize: 12, fontWeight: 800, background: band.bg, color: band.color }}>{ipi}</span>
                )}
              </div>
              <Progress value={stats.health} color={stats.health > 70 ? T.accent : stats.health > 50 ? "#eab308" : "#dc2626"} height={6} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 14 }}>
                {[
                  { label: "On Track", value: stats.onTrack,   color: "#16a34a" },
                  { label: "At Risk",  value: stats.atRisk,    color: "#ea580c" },
                  { label: "Delayed",  value: stats.delayed,   color: "#dc2626" },
                  { label: "Done",     value: stats.completed, color: "#2563eb" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "7px 4px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`, fontSize: 10.5, color: T.muted }}>
                <span>Budget: <span style={{ fontWeight: 700, color: T.text }}>{fmtSAR(stats.totalBudget)}</span></span>
                <span>High Risk: <span style={{ fontWeight: 700, color: stats.highRisk > 0 ? "#dc2626" : T.text }}>{stats.highRisk}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomeView;
