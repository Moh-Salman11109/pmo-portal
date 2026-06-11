import { GATE_DEFS } from "../data/constants.js";
import { TODAY, daysSince } from "./dates.js";

export function getDeptStats(deptId, projects) {
  const dp        = projects.filter(p => p.deptId === deptId);
  const total     = dp.length;
  const onTrack   = dp.filter(p => p.status === "On Track").length;
  const active    = dp.filter(p => p.status === "On Track" || p.status === "At Risk").length;
  const delayed   = dp.filter(p => p.status === "Delayed").length;
  const completed = dp.filter(p => p.status === "Completed").length;
  const highRisk  = dp.filter(p => p.riskLevel === "High" || p.riskLevel === "Critical").length;
  const health    = total ? Math.round(dp.reduce((s, p) => s + p.progress, 0) / total) : 0;
  const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
  const actualCost  = dp.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtil  = totalBudget ? Math.round((actualCost / totalBudget) * 100) : 0;
  return { total, onTrack, active, delayed, completed, highRisk, health, totalBudget, actualCost, budgetUtil };
}

// ─── IPI Global Defaults ─────────────────────────────────────────────────────
const IPI_DEFAULTS = {
  decayWindowDays: 90,
  cap:             1.05,
  weights: { spi: 0.50, cpi: 0.25, mci: 0.25 },
};

/**
 * Full IPI calculation per spec.
 * Returns { ipi (0–100), status, components, ev, pv }
 *
 * SPI  = EVM from milestones (weight × progress) if milestones exist,
 *        else progress / plannedProgress
 * CPI  = BCWP / actualCost  (auto from budget fields)
 *        fallback → project.cpi manual field
 * MCI  = approved required docs / total required docs
 * penalty = roadmap-deadline decay applied to SPI only
 */
export function calcProjectIPIFull(project, asOfDate = TODAY) {
  const { cap, weights, decayWindowDays } = IPI_DEFAULTS;

  // ── SPI: EVM from milestones if available, else from progress fields ──────
  const milestones = project.milestones || [];
  let ev, pv, spi;

  const msWithDates = milestones.filter(m => m.date);
  if (milestones.length > 0 && msWithDates.length > 0) {
    // Earned Value = Σ(weight × progress%) / Σ weights
    // Planned Value = Σ(weight of milestones with endDate ≤ today) / Σ weights
    const totalWeight = milestones.reduce((s, m) => s + (m.weight || 1), 0);
    const earnedWeight = milestones.reduce((s, m) => {
      const pct = m.progress != null ? m.progress
                : m.status === "Completed" ? 100
                : m.status === "In Progress" ? 50
                : 0;
      return s + (m.weight || 1) * (pct / 100);
    }, 0);
    const plannedWeight = milestones
      .filter(m => m.date && m.date <= asOfDate)
      .reduce((s, m) => s + (m.weight || 1), 0);

    ev = earnedWeight / totalWeight;
    pv = plannedWeight / totalWeight;
    // pv=0 means no milestone was due yet — neutral (null→1.0), not a reward
    spi = pv === 0 ? null : Math.min(cap, ev / pv);
  } else {
    // Fallback: simple progress vs planned
    ev = (project.progress      ?? 0) / 100;
    pv = (project.plannedProgress ?? 0) / 100;
    spi = pv === 0 ? null : Math.min(cap, ev / pv);
  }

  // ── CPI: auto from budget/actualCost, fallback to manual project.cpi ──────
  const budget     = project.budget     || 0;
  const actualCost = project.actualCost || 0;
  const progress   = project.progress   ?? 0;
  let cpi;
  if (budget > 0 && actualCost > 0) {
    const bcwp = (progress / 100) * budget;
    cpi = Math.min(cap, bcwp / actualCost);
  } else if (project.cpi && project.cpi !== 0) {
    cpi = Math.min(cap, project.cpi);
  } else {
    cpi = null;
  }

  // ── MCI: artifact / doc delivery ─────────────────────────────────────────
  const allDocs  = project.documents ?? [];
  const reqDocs  = allDocs.filter(d => d.required);
  // 0    = no documents at all → penalized, PM hasn't submitted anything
  // 1    = docs exist but none marked required → full compliance assumed
  const mci = allDocs.length === 0
    ? 0
    : reqDocs.length === 0
      ? 1
      : Math.min(1, reqDocs.filter(d =>
          ["Approved", "Final", "Received", "Current", "Submitted"].includes(d.status)
        ).length / reqDocs.length);

  // ── Roadmap-deadline penalty (hits SPI only) ──────────────────────────────
  const roadmapDeadline = project.roadmapDeadline;
  let penalty = 1;
  if (roadmapDeadline) {
    const finishDate = project.status === "Completed" ? (project.lastUpdate || asOfDate) : null;
    const measurementDate = finishDate || asOfDate;
    if (measurementDate > roadmapDeadline) {
      const daysOverdue = Math.floor(
        (new Date(measurementDate) - new Date(roadmapDeadline)) / 86_400_000
      );
      penalty = Math.max(0, 1 - daysOverdue / decayWindowDays);
    }
  }

  // ── Final SPI and IPI ─────────────────────────────────────────────────────
  const spiFinal = spi === null ? null : spi * penalty;

  const spiVal = spiFinal ?? 1.0;
  const cpiVal = cpi       ?? 1.0;
  const ipiDecimal = weights.spi * spiVal + weights.cpi * cpiVal + weights.mci * mci;
  const ipi = Math.max(0, Math.min(100, Math.round(ipiDecimal * 100)));

  const status = ipiDecimal >= 1.00 ? "On Track"
               : ipiDecimal >= 0.90 ? "Watch"
               :                      "At Risk";

  return {
    ipi,
    status,
    components: {
      spi:      spi     === null ? null : +spi.toFixed(3),
      penalty:  +penalty.toFixed(3),
      spiFinal: spiFinal === null ? null : +spiFinal.toFixed(3),
      cpi:      cpi     === null ? null : +cpi.toFixed(3),
      mci:      +mci.toFixed(3),
    },
    ev: +ev.toFixed(3),
    pv: +pv.toFixed(3),
  };
}

/** Returns the 0–100 IPI score only (backward compat). */
export function calcProjectIPI(project) {
  return calcProjectIPIFull(project).ipi;
}

// Priority multiplier used in dept/portfolio weighting
const PRIORITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

/**
 * Composite project weight = budget × priorityMultiplier.
 * When budget = 0, falls back to priority weight alone.
 * Critical+$100M project outweighs Low+$10M project by design.
 */
function projectWeight(p) {
  const pw = PRIORITY_WEIGHT[p.priority] || 2;
  const bw = p.budget || 0;
  return bw > 0 ? bw * pw : pw;
}

/**
 * Department IPI — budget×priority weighted average of project IPIs.
 * Returns null when no projects (display as "—").
 */
export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId && !p.archived);
  if (!dp.length) return null;
  const totalW = dp.reduce((s, p) => s + projectWeight(p), 0);
  return Math.round(
    dp.reduce((s, p) => s + calcProjectIPI(p) * projectWeight(p), 0) / totalW
  );
}

/**
 * Portfolio IPI — budget×priority weighted across all non-archived projects.
 * Returns null when no active projects.
 */
export function calcPortfolioIPI(projects) {
  const active = projects.filter(p => !p.archived);
  if (!active.length) return null;
  const totalW = active.reduce((s, p) => s + projectWeight(p), 0);
  return Math.round(
    active.reduce((s, p) => s + calcProjectIPI(p) * projectWeight(p), 0) / totalW
  );
}

/** Updated bands to match spec: 100=OnTrack, 90–99=Watch, <90=AtRisk */
export function ipiColor(score) {
  if (score == null) return { color: "#6b7280", bg: "#f3f4f6", label: "No Data" };
  if (score >= 100) return { color: "#15803d", bg: "#dcfce7", label: "On Track" };
  if (score >=  90) return { color: "#854d0e", bg: "#fef9c3", label: "Watch" };
  if (score >=  70) return { color: "#c05621", bg: "#fed7aa", label: "At Risk" };
  return               { color: "#991b1b", bg: "#fee2e2", label: "Critical" };
}

export function getGateSLA(project) {
  if (!project?.gates) return null;
  const ordered = GATE_DEFS.map(def => ({
    def,
    g: project.gates.find(g => g.id === def.id) || { status: "Pending" },
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
}
