// ============================================================================
//  IPI ENGINE — performance metrics for projects, departments and portfolio
// ============================================================================
//
//  The math that turns project data into a single 0–115 health score (IPI):
//
//     IPI = 0.5 · SPI + 0.25 · CPI + 0.25 · MCI
//
//     SPI — Schedule Performance Index (planned vs actual progress, with
//           a 1%/day roadmap penalty if the project overshoots its roadmap
//           deadline)
//     CPI — Cost Performance Index (planned vs actual cost)
//     MCI — Maturity & Compliance Index (gate-aware: only docs that are
//           due by the current gate count)
//
//  Rollups (dept, portfolio) take the budget × priority weighted average of
//  the underlying project IPIs. Today's rollups use the snapshot IPI;
//  historical comparisons (the "vs last month" arrow on Home) use the
//  time-weighted IPI from the project's ipiHistory.
//
//  Every helper is pure — no side effects, no external state — so the
//  vitest suite in metrics.test.js (46 cases) can exercise them directly.
//
// ============================================================================

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
  // Risk level: derived from open risks (not stale manual field)
  const highRisk  = dp.filter(p => {
    const lvl = deriveRiskLevel(p);
    return lvl === "High" || lvl === "Critical";
  }).length;
  // Dept health: average of effective (WBS-aware) progress across projects
  const health    = total ? Math.round(dp.reduce((s, p) => s + effectiveProgress(p), 0) / total) : 0;
  const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
  const actualCost  = dp.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtil  = totalBudget ? Math.round((actualCost / totalBudget) * 100) : 0;
  return { total, onTrack, atRisk, active, delayed, completed, highRisk, health, totalBudget, actualCost, budgetUtil };
}

// ─── Gate Helpers ────────────────────────────────────────────────────────────
/**
 * Parse a Gate label like "Gate 4" or "G3" into its number 1-5.
 * Falls back to 1 (most restrictive — every doc is due) when the input
 * is missing or unrecognised, so projects without an explicit gate behave
 * exactly as they did before this change.
 */
export function parseGateNumber(gate) {
  if (gate == null) return 1;
  const m = String(gate).match(/(\d+)/);
  if (!m) return 1;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

// ─── MCI computation (gate-aware) ────────────────────────────────────────────
/**
 * Compute the Maturity & Compliance Index for a set of documents, evaluated
 * as if the project were at `atGate`. Single source of truth — called by
 * calcProjectIPIFull (current gate) and calcAnticipatedMCI (future gate).
 *
 * Returns:
 *   null = no docs at all OR all required docs are future-gate (neutral)
 *   1    = docs exist but none marked required → full compliance assumed
 *   0..1 = (approved + 0.5×inReview) ÷ docs due at atGate
 *
 * Credit tiers: Approved/Final/Received/Current = 1.0 · Submitted/Under Review = 0.5 · else 0
 */
export function computeMCI(documents, atGate) {
  const allDocs = documents ?? [];
  if (allDocs.length === 0) return null;
  const reqDocs = allDocs.filter(d => d.required);
  if (reqDocs.length === 0) return 1;
  const dueDocs = reqDocs.filter(d => (d.requiredAtGate || 1) <= atGate);
  if (dueDocs.length === 0) return null;
  const credit = dueDocs.reduce((s, d) => {
    if (["Approved", "Final", "Received", "Current"].includes(d.status)) return s + 1.0;
    if (["Submitted", "Under Review"].includes(d.status)) return s + 0.5;
    return s;
  }, 0);
  return Math.min(1, credit / dueDocs.length);
}

/**
 * "What will MCI be when this project enters its next gate?" Lets PMO see
 * upcoming MCI drops BEFORE they happen so they can chase docs proactively.
 *
 * Returns { atGate, mci, deltaDocs } where deltaDocs is the count of
 * additional required docs that become due at atGate vs today. Returns null
 * when there's no meaningful "next" (project at Gate 5, or no future docs).
 */
export function calcAnticipatedMCI(project) {
  const currentGate = parseGateNumber(project.gate);
  if (currentGate >= 5) return null;
  const nextGate = currentGate + 1;
  const reqDocs  = (project.documents ?? []).filter(d => d.required);
  const newlyDue = reqDocs.filter(d => {
    const g = d.requiredAtGate || 1;
    return g > currentGate && g <= nextGate;
  });
  if (newlyDue.length === 0) return null;   // MCI won't change at next gate
  return { atGate: nextGate, mci: computeMCI(project.documents, nextGate), deltaDocs: newlyDue.length };
}

// ─── IPI Global Defaults ─────────────────────────────────────────────────────
// These thresholds are governance-grade — change only with PMO + auditor sign-off.
const IPI_DEFAULTS = {
  // Roadmap-deadline penalty: -1% per day past the roadmap deadline (linear decay).
  // 100 days past = penalty drives SPI to zero. The user (Product Owner) explicitly
  // asked for "1% per day or more" — 1% is the documented minimum.
  decayWindowDays: 100,
  // Maximum over-achievement allowed. 1.20 means a perfectly-early project can
  // score up to IPI=115. Stops a single sandbagged plan from inflating the
  // portfolio average to absurd levels.
  cap:             1.20,
  weights:         { spi: 0.50, cpi: 0.25, mci: 0.25 },
};

/**
 * Full IPI calculation — governance-grade, regulator-auditable.
 * Returns { ipi (0–120), status, components, ev, pv }.
 *
 *   SPI  = EVM from leaf activities (weight × actual%) ÷ (weight × planned%)
 *          • Leaves = items without children in the WBS (so a milestone with
 *            activities under it counts via its children, not its own progress).
 *          • Planned% at asOfDate is LINEARLY INTERPOLATED between the leaf's
 *            startDate and endDate — partial credit while the work is in flight.
 *          • A leaf completed BEFORE its planned end pushes SPI above 1.0
 *            (over-achievement); a leaf running late pushes it below 1.0.
 *   CPI  = BCWP / actualCost = (progress × budget) / actualCost
 *   MCI  = approved required docs / total required docs
 *   penalty = roadmap-deadline linear decay (1% per day past), applied to SPI only.
 *
 * Both SPI and CPI are capped at 1.20 so a single outlier can't blow up the index.
 */
export function calcProjectIPIFull(project, asOfDate = TODAY) {
  const { cap, weights, decayWindowDays } = IPI_DEFAULTS;
  const nowMs = new Date(asOfDate).getTime();

  // ── Identify WBS leaves: items that no other item lists as its parent.
  // Legacy projects with flat milestones (no parentId on anything) → every
  // milestone is a leaf, so the old behaviour is preserved.
  const items = project.milestones || [];
  const parentIds = new Set(items.filter(m => m.parentId).map(m => m.parentId));
  const leaves = items.filter(m => !parentIds.has(m.id));

  // Per-leaf actual progress (defensive clamp to [0..100]).
  const actualPct = (m) => {
    const raw = m.progress != null ? m.progress
              : m.status === "Completed"   ? 100
              : m.status === "In Progress" ? 50
              :                                0;
    return Math.max(0, Math.min(100, raw)) / 100;
  };

  // Per-leaf PLANNED progress at asOfDate.
  //   • With both startDate + date: linear interpolation between them
  //   • With only date: step function (0 before, 1 after)
  //   • With neither: 0 (not yet in the plan)
  const plannedPct = (m) => {
    const startMs = m.startDate ? new Date(m.startDate).getTime() : null;
    const endMs   = m.date      ? new Date(m.date).getTime()      : null;
    if (startMs && endMs && endMs > startMs) {
      if (nowMs <= startMs) return 0;
      if (nowMs >= endMs)   return 1;
      return (nowMs - startMs) / (endMs - startMs);
    }
    if (endMs) return nowMs >= endMs ? 1 : 0;
    return 0;
  };

  // ── SPI: EVM from leaves; fallback to project-level dates if no leaves
  let ev, pv, spi;
  const totalW = leaves.reduce((s, m) => s + (m.weight || 1), 0);

  // Project progress used for both SPI fallback (no-WBS path) and CPI BCWP.
  // SOURCE OF TRUTH: effectiveProgress — prefers the WBS rollup so a stale
  // project.progress field can never drift from the activity-driven reality
  // shown in the UI. Falls back to project.progress only when no WBS exists.
  const effProgress = effectiveProgress(project);

  if (leaves.length > 0 && totalW > 0) {
    ev = leaves.reduce((s, m) => s + (m.weight || 1) * actualPct(m),  0) / totalW;
    pv = leaves.reduce((s, m) => s + (m.weight || 1) * plannedPct(m), 0) / totalW;
    spi = pv === 0 ? null : Math.min(cap, ev / pv);
  } else if (project.startDate && project.plannedEnd) {
    // No WBS — fall back to project-level dates + effective progress
    ev = effProgress / 100;
    const startMs = new Date(project.startDate).getTime();
    const endMs   = new Date(project.plannedEnd).getTime();
    if (endMs > startMs) {
      pv = nowMs <= startMs ? 0 : nowMs >= endMs ? 1 : (nowMs - startMs) / (endMs - startMs);
    } else {
      pv = 0;
    }
    spi = pv === 0 ? null : Math.min(cap, ev / pv);
  } else {
    // No dates at all — neutral (treated as on track for IPI rollup purposes)
    ev = 0; pv = 0; spi = null;
  }

  // ── CPI: auto from budget/actualCost, fallback to manual project.cpi ──────
  // BCWP uses effProgress (not project.progress) so CPI always reflects the
  // same progress number the user sees in the UI — no drift possible.
  const budget     = project.budget     || 0;
  const actualCost = project.actualCost || 0;
  let cpi;
  if (budget > 0 && actualCost > 0) {
    const bcwp = (effProgress / 100) * budget;
    cpi = Math.min(cap, bcwp / actualCost);
  } else if (project.cpi && project.cpi !== 0) {
    cpi = Math.min(cap, project.cpi);
  } else {
    cpi = null;
  }

  // ── MCI: artifact / doc delivery (GATE-AWARE) ────────────────────────────
  // See computeMCI for the full contract. Computed at the project's current
  // gate; calcAnticipatedMCI projects the same logic at a future gate.
  const mci = computeMCI(project.documents, parseGateNumber(project.gate));

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
  // Null-aware rollup: each null component is treated as neutral (1.0) so a
  // project with no schedule data isn't artificially penalised. If ALL three
  // are null, IPI itself is null — caller should display "Pending Plan".
  const spiFinal = spi === null ? null : spi * penalty;
  const allNull  = spiFinal === null && cpi === null && mci === null;
  const spiVal = spiFinal ?? 1.0;
  const cpiVal = cpi      ?? 1.0;
  const mciVal = mci      ?? 1.0;
  const ipiDecimal = weights.spi * spiVal + weights.cpi * cpiVal + weights.mci * mciVal;
  const ipi = allNull ? null : Math.max(0, Math.round(ipiDecimal * 100));

  const status = allNull               ? "Pending Plan"
               : ipiDecimal >  1.00    ? "Over Achieved"
               : ipiDecimal >= 1.00    ? "On Track"
               : ipiDecimal >= 0.90    ? "Watch"
               :                         "At Risk";

  return {
    ipi,
    status,
    components: {
      spi:      spi     === null ? null : +spi.toFixed(3),
      penalty:  +penalty.toFixed(3),
      spiFinal: spiFinal === null ? null : +spiFinal.toFixed(3),
      cpi:      cpi     === null ? null : +cpi.toFixed(3),
      mci:      mci     === null ? null : +mci.toFixed(3),
    },
    ev: +ev.toFixed(3),
    pv: +pv.toFixed(3),
  };
}

/** Returns the 0–120 IPI score only (backward compat). May be null when the
 *  project has no schedule/cost/doc data at all ("Pending Plan"). */
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
    .filter(h => h.date && h.ipi != null && h.date <= asOfDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Acceptable approximation until history accrues for this date range
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
 * Department IPI — budget×priority weighted average of project IPIs.
 * Projects whose IPI is null ("Pending Plan") are EXCLUDED from the rollup,
 * so an unstaffed dept with placeholder projects doesn't pull the average down.
 * Returns null when no measurable projects in the dept.
 */
export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId && !p.archived);
  // Snapshot IPI per project, so the dept rollup matches the IPI column
  // shown in the department's project table. Time-weighted IPI is reserved
  // for historical comparisons (see calcPortfolioIPI's asOfDate branch).
  const measured = dp.map(p => ({ p, ipi: calcProjectIPI(p) })).filter(x => x.ipi != null);
  if (!measured.length) return null;
  const totalW = measured.reduce((s, x) => s + projectWeight(x.p), 0);
  if (totalW === 0) return null;
  return Math.round(
    measured.reduce((s, x) => s + x.ipi * projectWeight(x.p), 0) / totalW
  );
}

// Portfolio IPI — budget × priority weighted across all active projects.
// Today's call uses snapshot IPI (matches dept rollups). A historical
// asOfDate uses time-weighted IPI, since that's the only way to reconstruct
// a project's score on a past date.
export function calcPortfolioIPI(projects, asOfDate = TODAY) {
  const active = projects.filter(p => !p.archived);
  const isHistorical = asOfDate !== TODAY;
  const measured = active
    .map(p => ({ p, ipi: isHistorical ? calcTimeWeightedIPI(p, asOfDate) : calcProjectIPI(p) }))
    .filter(x => x.ipi != null);
  if (!measured.length) return null;
  const totalW = measured.reduce((s, x) => s + projectWeight(x.p), 0);
  if (totalW === 0) return null;
  return Math.round(
    measured.reduce((s, x) => s + x.ipi * projectWeight(x.p), 0) / totalW
  );
}

/**
 * Auto-compute overall project progress from the WBS (Activities tab).
 * For each top-level milestone, progress is the weighted average of its
 * activities (children). The project's overall progress is then the weighted
 * average of those milestones. When a milestone has no children, its own
 * progress field counts directly.
 *
 * Returns null when there are no top-level milestones, so callers can fall
 * back to the manual project.progress field.
 */
export function calcProjectProgressFromWBS(project) {
  const items = project.milestones || [];
  const tops  = items.filter(m => !m.parentId);
  if (tops.length === 0) return null;
  const totalW = tops.reduce((s, m) => s + (m.weight || 1), 0);
  if (totalW === 0) return null;
  const sum = tops.reduce((s, m) => {
    const kids = items.filter(i => i.parentId === m.id);
    let p;
    if (kids.length === 0) {
      p = m.progress || 0;
    } else {
      const w = kids.reduce((a, c) => a + (c.weight || 1), 0);
      p = w ? kids.reduce((a, c) => a + (c.weight || 1) * (c.progress || 0), 0) / w : 0;
    }
    return s + (m.weight || 1) * p;
  }, 0);
  return Math.round(sum / totalW);
}

/**
 * The single "true" progress value for a project, regardless of where it came from.
 * Prefers the WBS rollup when activities exist; falls back to project.progress.
 * Use this everywhere a progress % needs to be displayed.
 */
export function effectiveProgress(project) {
  const wbs = calcProjectProgressFromWBS(project);
  return wbs != null ? wbs : (project.progress ?? 0);
}

/**
 * Derive the project's status from its current performance signals.
 * Returns { status, reason } so callers can both render the chip and
 * show the user WHY the derivation landed where it did.
 *
 *   Completed   = WBS-rolled progress hits 100 AND project has reached Gate 5
 *   Delayed     = past plannedEnd and not yet at 100% — explicit slip
 *   Not Started = no activities defined yet OR no IPI signal (Pending Plan)
 *   On Track    = IPI ≥ 90
 *   At Risk     = IPI < 90 but project has signals to be measured against
 *
 * This is the auto-derivation used in the Update panel. The admin Edit Project
 * form preserves a manual override field so PMO can capture contextual signals
 * (e.g. sponsor freeze, regulator pause) that the math cannot see.
 */
export function deriveProjectStatus(project) {
  const progress = effectiveProgress(project);
  const ipi      = calcProjectIPI(project);
  const gateNum  = parseGateNumber(project.gate);

  if (progress >= 100 && gateNum >= 5) {
    return { status: "Completed", reason: "Progress at 100% and project reached Gate 5" };
  }
  if (project.plannedEnd && project.plannedEnd < TODAY && progress < 100) {
    return { status: "Delayed", reason: `Past planned end (${project.plannedEnd}) and not at 100%` };
  }
  if (progress === 0 && (!project.milestones || project.milestones.length === 0)) {
    return { status: "Not Started", reason: "No activities defined yet" };
  }
  if (ipi == null) {
    return { status: "Not Started", reason: "Pending Plan — no schedule, cost or doc data yet" };
  }
  if (ipi >= 90) {
    return { status: "On Track", reason: `IPI ${ipi} ≥ 90 threshold` };
  }
  return { status: "At Risk", reason: `IPI ${ipi} below 90 threshold` };
}

/**
 * Derive the project-level risk level from the active risks array.
 * Highest open risk wins. Falls back to "Low" if no open risks.
 * Use this instead of a manually-maintained project.riskLevel field.
 */
export function deriveRiskLevel(project) {
  const open = (project.risks || []).filter(r => r.status !== "Closed" && r.status !== "Mitigated");
  if (open.some(r => r.level === "Critical")) return "Critical";
  if (open.some(r => r.level === "High"))     return "High";
  if (open.some(r => r.level === "Medium"))   return "Medium";
  return "Low";
}

/**
 * Derive budget status from raw numbers.
 * "Over Budget" when actualCost or forecast exceeds the approved budget.
 * Otherwise "On Budget". "Under Budget" is intentionally not derived — rarely actionable.
 */
export function deriveBudgetStatus(project) {
  const budget     = project.budget     || 0;
  const actualCost = project.actualCost || 0;
  const forecast   = project.forecast   || 0;
  if (!budget) return "On Budget";
  if (actualCost > budget) return "Over Budget";
  if (forecast   > budget) return "Over Budget";
  return "On Budget";
}

export function ipiColor(score) {
  if (score == null) return { color: "#6b7280", bg: "#f3f4f6", label: "No Data" };
  if (score > 100)  return { color: "#166534", bg: "#bbf7d0", label: "Over Achieved" };
  if (score >= 100) return { color: "#15803d", bg: "#dcfce7", label: "On Track" };
  if (score >=  90) return { color: "#854d0e", bg: "#fef9c3", label: "Watch" };
  if (score >=  70) return { color: "#c05621", bg: "#fed7aa", label: "At Risk" };
  return               { color: "#991b1b", bg: "#fee2e2", label: "Critical" };
}

// Same band mapping as ipiColor() but tuned for dark hero gradients.
// Returns translucent pill colours and a gauge gradient pair.
export function ipiColorDark(score) {
  const band = ipiColor(score).label;
  switch (band) {
    case "Over Achieved":
      return { bg: "rgba(0,255,179,0.22)", border: "rgba(0,255,179,0.45)", text: "#00FFB3", gaugeFrom: "#00b894", gaugeTo: "#00FFB3" };
    case "On Track":
      return { bg: "rgba(0,255,179,0.18)", border: "rgba(0,255,179,0.40)", text: "#00FFB3", gaugeFrom: "#00b894", gaugeTo: "#00FFB3" };
    case "Watch":
      return { bg: "rgba(245,158,11,0.20)", border: "rgba(245,158,11,0.45)", text: "#fcd34d", gaugeFrom: "#d97706", gaugeTo: "#fbbf24" };
    case "At Risk":
      return { bg: "rgba(255,80,0,0.20)", border: "rgba(255,80,0,0.45)", text: "#ffa07a", gaugeFrom: "#c2410c", gaugeTo: "#FF5000" };
    case "Critical":
      return { bg: "rgba(220,38,38,0.24)", border: "rgba(220,38,38,0.50)", text: "#fca5a5", gaugeFrom: "#7f1d1d", gaugeTo: "#dc2626" };
    default:
      return { bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.20)", text: "rgba(255,255,255,0.7)", gaugeFrom: "#4b6c67", gaugeTo: "#a1b9ab" };
  }
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
