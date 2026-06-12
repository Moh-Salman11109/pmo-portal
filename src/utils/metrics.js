import { GATE_DEFS } from "../data/constants.js";
import { TODAY, daysSince } from "./dates.js";

export function getDeptStats(deptId, projects) {
  const dp        = projects.filter(p => p.deptId === deptId);
  const total     = dp.length;
  const onTrack   = dp.filter(p => p.status === "On Track").length;
  const atRisk    = dp.filter(p => p.status === "At Risk").length;
  const active    = onTrack + atRisk;
  const delayed   = dp.filter(p => p.status === "Delayed").length;
  const completed = dp.filter(p => p.status === "Completed").length;
  const highRisk  = dp.filter(p => p.riskLevel === "High" || p.riskLevel === "Critical").length;
  const health    = total ? Math.round(dp.reduce((s, p) => s + p.progress, 0) / total) : 0;
  const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
  const actualCost  = dp.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtil  = totalBudget ? Math.round((actualCost / totalBudget) * 100) : 0;
  return { total, onTrack, atRisk, active, delayed, completed, highRisk, health, totalBudget, actualCost, budgetUtil };
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

    // EV ceiling: milestone statuses (e.g. "In Progress" → 50%) can inflate EV above
    // what the PM actually reports as overall progress. Cap EV at reported progress so
    // a milestone-heavy project can't auto-claim more completion than the PM stated.
    ev = Math.min(ev, (project.progress ?? 0) / 100);

    // PV floor: if only 1-2 milestones have past due dates the denominator is tiny and
    // SPI spikes. Enforce the timeline-based PV as a minimum — the clock doesn't stop
    // ticking just because most milestones have future dates.
    if (project.startDate && project.plannedEnd) {
      const msStart  = new Date(project.startDate).getTime();
      const msEnd    = new Date(project.plannedEnd).getTime();
      const msNow    = new Date(asOfDate).getTime();
      const duration = msEnd - msStart;
      if (duration > 0) {
        const datePV = Math.max(0, Math.min(1, (msNow - msStart) / duration));
        pv = Math.max(pv, datePV);
      }
    }

    // pv=0 means no milestone was due yet AND project hasn't started — neutral
    spi = pv === 0 ? null : Math.min(cap, ev / pv);
  } else {
    // Fallback: derive PV from project dates if available (accurate), else from plannedProgress
    ev = (project.progress ?? 0) / 100;
    if (project.startDate && project.plannedEnd) {
      const msStart = new Date(project.startDate).getTime();
      const msEnd   = new Date(project.plannedEnd).getTime();
      const msNow   = new Date(asOfDate).getTime();
      const duration = msEnd - msStart;
      pv = duration > 0 ? Math.max(0, Math.min(1, (msNow - msStart) / duration)) : 0;
    } else {
      pv = (project.plannedProgress ?? 0) / 100;
    }
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
  // Credit tiers: Approved/Final/Received/Current = 1.0 · Submitted/Under Review = 0.5 · everything else = 0
  const mci = allDocs.length === 0
    ? 0
    : reqDocs.length === 0
      ? 1
      : Math.min(1, reqDocs.reduce((s, d) => {
          if (["Approved", "Final", "Received", "Current"].includes(d.status)) return s + 1.0;
          if (["Submitted", "Under Review"].includes(d.status)) return s + 0.5;
          return s;
        }, 0) / reqDocs.length);

  // ── Roadmap-deadline penalty (hits SPI only) ──────────────────────────────
  const roadmapDeadline = project.roadmapDeadline;
  let penalty = 1;
  if (roadmapDeadline) {
    const finishDate = project.status === "Completed"
      ? (project.actualFinishDate || project.lastUpdate || asOfDate) : null;
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
  const ipi = Math.max(0, Math.round(ipiDecimal * 100));

  const status = ipiDecimal >  1.00 ? "Over Achieved"
               : ipiDecimal >= 1.00 ? "On Track"
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
 * Time-weighted average IPI over the project's saved update history.
 * Each snapshot covers the period from its date until the next snapshot (or today).
 * Prevents a single good/bad month from dominating the displayed score.
 * Falls back to current-snapshot IPI when no history exists yet.
 */
export function calcTimeWeightedIPI(project, asOfDate = TODAY) {
  const raw = project.ipiHistory || [];
  const history = raw
    .filter(h => h.date && h.ipi != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!history.length) return calcProjectIPI(project);

  let totalWeighted = 0;
  let totalDays = 0;

  for (let i = 0; i < history.length; i++) {
    const from = history[i].date;
    const to   = i + 1 < history.length ? history[i + 1].date : asOfDate;
    // min 1 day so today's snapshot is always reflected immediately
    const days = Math.max(1, Math.floor(
      (new Date(to) - new Date(from)) / 86_400_000
    ));
    totalWeighted += history[i].ipi * days;
    totalDays     += days;
  }

  return totalDays > 0
    ? Math.round(totalWeighted / totalDays)
    : history[history.length - 1].ipi;
}

/**
 * Department IPI — budget×priority weighted average of project time-weighted IPIs.
 * Returns null when no projects (display as "—").
 */
export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId && !p.archived);
  if (!dp.length) return null;
  const totalW = dp.reduce((s, p) => s + projectWeight(p), 0);
  return Math.round(
    dp.reduce((s, p) => s + calcTimeWeightedIPI(p) * projectWeight(p), 0) / totalW
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
    active.reduce((s, p) => s + calcTimeWeightedIPI(p) * projectWeight(p), 0) / totalW
  );
}

export function ipiColor(score) {
  if (score == null) return { color: "#6b7280", bg: "#f3f4f6", label: "No Data" };
  if (score > 100)  return { color: "#166534", bg: "#bbf7d0", label: "Over Achieved" };
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
