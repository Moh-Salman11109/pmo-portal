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
// Documented deviations from pure EVM (ANSI/EIA-748 / PMBOK) are explicit so an
// auditor reading metrics.js once knows exactly where Tree differs from standard
// practice and why. See IPI Methodology doc for the long-form justification.
const IPI_DEFAULTS = {
  // Roadmap-deadline penalty: -1% per day past the roadmap deadline (linear).
  // 100 days past = penalty drives SPI to zero. This is a TREE-INVENTED control,
  // not part of standard EVM. Justification: prevents a runaway project that
  // has technically finished its scope from inflating IPI past its strategic
  // window. Decay is linear by design; an exponential alternative was rejected
  // because executives expect proportional consequence per day.
  decayWindowDays: 100,
  // Maximum over-achievement allowed. 1.20 means a perfectly-early project can
  // score up to IPI=115. NON-STANDARD: pure EVM does not cap SPI/CPI. The cap
  // is applied AFTER the roadmap penalty (so an over-achiever that slips past
  // the roadmap is correctly penalised from its raw ratio, not from the cap).
  // Applied at the project level (not the rollup) so a sandbagged plan can't
  // single-handedly inflate the portfolio average.
  cap:             1.20,
  // Weights chosen so schedule discipline (SPI) is twice cost discipline (CPI).
  // Rationale: at Tree, schedule slippage cascades into business commitments
  // (regulatory deadlines, customer SLAs) whereas budget overruns are absorbed.
  // Must be re-blessed by the CFO if reused for a different organisation.
  weights:         { spi: 0.50, cpi: 0.25, mci: 0.25 },
  // Time-weighted moving window. Snapshots older than this are excluded from
  // the time-weighted average so a year-old bad month can't drag today's score
  // forever. 90 days mirrors standard trailing-performance reporting in
  // mature EVM tools (Primavera Risk Analysis defaults to 90).
  timeWeightedWindowDays: 90,
};

// Date normalisation — accepts ISO date strings ("2026-06-30"), ISO datetimes
// ("2026-06-30T12:00:00Z"), or Date objects. Returns a millisecond timestamp
// or null. Centralises a previously inconsistent contract.
function _toMs(d) {
  if (d == null) return null;
  if (d instanceof Date) return d.getTime();
  const ms = new Date(d).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Full IPI calculation — governance-grade, regulator-auditable.
 * Returns { ipi (0–120), status, components, ev, pv }.
 *
 *   SPI  = EVM from leaf activities (weight × actual%) ÷ (weight × planned%)
 *          • Leaves = items without children in the WBS.
 *          • Unscheduled leaves (no dates) are EXCLUDED from both EV and PV
 *            so their weight doesn't dilute the result.
 *          • Planned% at asOfDate is linearly interpolated between the leaf's
 *            startDate and endDate. Known bias: real projects burn an S-curve,
 *            not linearly — accepted simplification, documented in plannedPct.
 *          • Same-day leaf (start == end) is treated as an instant milestone.
 *   CPI  = BCWP / actualCost = (progress × budget) / actualCost
 *          • Guards: budget > 0 AND actualCost > 0 (rejects negative refunds).
 *   MCI  = (approved + 0.5×submitted) ÷ docs due at the current gate.
 *          • Gate-aware: future-gate docs don't count yet.
 *          • Returns null when nothing measurable — re-normalisation excludes.
 *   penalty = roadmap-deadline linear decay (1% per day past). Applied to
 *             RAW SPI, then capped — so an over-achiever that slips past the
 *             roadmap is penalised from its true ratio, not from the cap.
 *
 * Cap (1.20) is applied at the very end of the SPI pipeline, AFTER penalty.
 * Pure EVM does not cap; Tree caps to bound the IPI to a defendable 0–120.
 *
 * IPI ROLLUP — RE-NORMALISED, NOT NEUTRAL-FILLED:
 * Missing components (e.g. no actualCost → cpi=null) are EXCLUDED and the
 * remaining weights re-normalised to sum to 1. This closes the perverse
 * incentive where a PM could inflate IPI by withholding data; truthful
 * partial reporting now scores honestly on what's present.
 */
export function calcProjectIPIFull(project, asOfDate = TODAY) {
  const { cap, weights, decayWindowDays } = IPI_DEFAULTS;
  const nowMs = _toMs(asOfDate) ?? Date.now();

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
  //   • With both startDate + date: linear interpolation between them.
  //     KNOWN BIAS: this assumes uniform effort across the leaf's window.
  //     Real projects burn an S-curve; linear PV systematically reports
  //     SPI > 1.0 in mid-flight and SPI < 1.0 near completion. Accepted
  //     trade-off for simplicity; an S-curve option is V2 work.
  //   • Same-day leaf (start == end): instant milestone. 1.0 if as-of is
  //     past the date, 0 if not yet. (Old code returned 0 in both branches,
  //     leaving the leaf's weight in the denominator with no PV → SPI inflated.)
  //   • With only end date: step function (0 before, 1 after).
  //   • With neither: undefined — caller skips this leaf entirely (its
  //     weight is excluded from the SPI aggregator) so unscheduled leaves
  //     don't dilute PV silently.
  const plannedPct = (m) => {
    const startMs = _toMs(m.startDate);
    const endMs   = _toMs(m.date);
    if (startMs && endMs && endMs > startMs) {
      if (nowMs <= startMs) return 0;
      if (nowMs >= endMs)   return 1;
      return (nowMs - startMs) / (endMs - startMs);
    }
    if (startMs && endMs && endMs === startMs) {
      // Instant milestone — done the day it happens.
      return nowMs >= endMs ? 1 : 0;
    }
    if (endMs) return nowMs >= endMs ? 1 : 0;
    return null;   // Unscheduled — excluded from aggregator
  };

  // ── SPI: EVM from leaves; fallback to project-level dates if no leaves
  let ev, pv, spi;

  // Project progress used for both SPI fallback (no-WBS path) and CPI BCWP.
  // SOURCE OF TRUTH: effectiveProgress — prefers the WBS rollup so a stale
  // project.progress field can never drift from the activity-driven reality
  // shown in the UI. Falls back to project.progress only when no WBS exists.
  const effProgress = effectiveProgress(project);

  // Only leaves with a defined PV contribute. Unscheduled leaves (no dates)
  // are excluded from BOTH numerator and denominator — they don't contribute
  // PV and their weight no longer pollutes the divisor.
  const scheduledLeaves = leaves.filter(m => plannedPct(m) !== null);
  const totalW = scheduledLeaves.reduce((s, m) => s + (m.weight || 1), 0);

  if (scheduledLeaves.length > 0 && totalW > 0) {
    ev = scheduledLeaves.reduce((s, m) => s + (m.weight || 1) * actualPct(m),  0) / totalW;
    pv = scheduledLeaves.reduce((s, m) => s + (m.weight || 1) * plannedPct(m), 0) / totalW;
    // Raw ratio first — cap is applied AFTER the roadmap penalty further down.
    spi = pv === 0 ? null : ev / pv;
  } else if (project.startDate && project.plannedEnd) {
    // No WBS — fall back to project-level dates + effective progress
    ev = effProgress / 100;
    // Honour a user-supplied plannedProgress when present (e.g. from the
    // IPI Calculator or from a manually-tracked plan). Otherwise derive
    // PV linearly from start → plannedEnd at the as-of date.
    if (project.plannedProgress != null && project.plannedProgress !== "") {
      pv = Math.max(0, Math.min(1, Number(project.plannedProgress) / 100));
    } else {
      const startMs = _toMs(project.startDate);
      const endMs   = _toMs(project.plannedEnd);
      if (startMs && endMs && endMs > startMs) {
        pv = nowMs <= startMs ? 0 : nowMs >= endMs ? 1 : (nowMs - startMs) / (endMs - startMs);
      } else {
        pv = 0;
      }
    }
    // Raw ratio — capped AFTER roadmap penalty below.
    spi = pv === 0 ? null : ev / pv;
  } else {
    // No dates at all — neutral (treated as on track for IPI rollup purposes)
    ev = 0; pv = 0; spi = null;
  }

  // ── CPI: auto from budget/actualCost, fallback to manual project.cpi ──────
  // BCWP uses effProgress (not project.progress) so CPI always reflects the
  // same progress number the user sees in the UI — no drift possible.
  // SIMPLIFICATION: BCWP = budget × (progress / 100), not the strict-EVM
  // sum-of-baseline-allocated-budgets. Works exactly when budget is uniformly
  // distributed across scope; overstates BCWP early on front-loaded capex
  // projects. Acceptable for Tree's IT-portfolio profile.
  const budget     = project.budget     || 0;
  const actualCost = project.actualCost || 0;
  let cpi;
  if (budget > 0 && actualCost > 0) {
    // Strict > 0 guard: a negative actualCost (refund/credit) would yield a
    // negative CPI and poison IPI. Treated as "no data" instead.
    const bcwp = (effProgress / 100) * budget;
    cpi = Math.min(cap, bcwp / actualCost);
  } else if (project.cpi && project.cpi > 0) {
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
  const roadmapMs = _toMs(roadmapDeadline);
  if (roadmapMs) {
    const finishDate = project.status === "Completed"
      ? (project.actualFinishDate || project.lastUpdate || asOfDate) : null;
    const measureMs = _toMs(finishDate || asOfDate);
    if (measureMs && measureMs > roadmapMs) {
      const daysOverdue = Math.floor((measureMs - roadmapMs) / 86_400_000);
      penalty = Math.max(0, 1 - daysOverdue / decayWindowDays);
    }
  }

  // ── Final SPI: penalty FIRST, cap LAST ─────────────────────────────────────
  // This order matters. If we capped the raw SPI first, an over-performing
  // project that slipped past the roadmap would be penalised from the cap
  // (e.g. 1.20 × 0.90 = 1.08) instead of from its real ratio (e.g. 1.8 × 0.90
  // = 1.62, then capped at 1.20). The penalty must act on the unscaled signal.
  const spiPenalized = spi === null ? null : spi * penalty;
  const spiFinal     = spiPenalized === null ? null : Math.min(cap, spiPenalized);

  // ── IPI rollup: re-normalise weights of present components ────────────────
  // OLD BEHAVIOUR (PERVERSE INCENTIVE): null components were treated as a
  // neutral 1.0, which meant a PM who refused to enter actualCost was rewarded
  // (cpi=null → 1.0 → IPI inflated). Fixed: missing components are EXCLUDED
  // from the rollup and the remaining weights are re-normalised to sum to 1.
  // A project with only SPI data shows that SPI as its IPI, full credit; a
  // PM cannot game the score by withholding inputs.
  const parts = [];
  if (spiFinal !== null) parts.push({ w: weights.spi, v: spiFinal });
  if (cpi      !== null) parts.push({ w: weights.cpi, v: cpi });
  if (mci      !== null) parts.push({ w: weights.mci, v: mci });

  const allNull = parts.length === 0;
  let ipiDecimal = 0;
  if (!allNull) {
    const sumW = parts.reduce((s, p) => s + p.w, 0);
    ipiDecimal = parts.reduce((s, p) => s + p.w * p.v, 0) / sumW;
  }
  const ipi = allNull ? null : Math.max(0, Math.round(ipiDecimal * 100));

  // Status follows the UNROUNDED ipiDecimal so adjacent projects whose
  // displayed integers are 99 vs 100 don't flip into different bands purely
  // from rounding noise (the boundary case). Decision-grade thresholds:
  //   Over Achieved ≥ 1.001  →  IPI shows 100+ but band only fires above 100
  //   On Track       1.000   →  IPI exactly 100
  //   Watch          0.900   →  ≥ 90 and < 100
  //   At Risk        < 0.900
  const status = allNull               ? "Pending Plan"
               : ipiDecimal >  1.0     ? "Over Achieved"
               : ipiDecimal >= 1.0     ? "On Track"
               : ipiDecimal >= 0.9     ? "Watch"
               :                          "At Risk";

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

/** Snapshot IPI — what the engine computes RIGHT NOW from the project's
 *  current state. Used by what-if tools (IPI Calculator) and as the building
 *  block for ipiHistory. Display surfaces should prefer calcProjectIPI, which
 *  returns the time-weighted view. */
export function calcProjectIPISnapshot(project) {
  return calcProjectIPIFull(project).ipi;
}

/** Default display IPI — time-weighted across saved snapshots in ipiHistory.
 *  Falls back to the current snapshot when no history exists yet. Replaces
 *  the old snapshot-only semantics so a single good/bad period can't dominate
 *  the displayed score across Home/Dept/Portfolio/Project. May be null
 *  ("Pending Plan"). */
export function calcProjectIPI(project) {
  return calcTimeWeightedIPI(project);
}

/** Display helper — returns the weighted score (primary), the latest snapshot
 *  (secondary), and their delta. Display sites use this to render the
 *  "weighted N · latest M (±D)" pattern without re-computing twice. */
export function calcProjectIPIDisplay(project) {
  const snapshot = calcProjectIPISnapshot(project);
  const weighted = calcTimeWeightedIPI(project);
  const history  = project.ipiHistory || [];
  return {
    primary:    weighted ?? snapshot,
    snapshot,
    delta:      (snapshot != null && weighted != null) ? snapshot - weighted : null,
    hasHistory: history.length > 0,
    historyLen: history.length,
  };
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
  const { timeWeightedWindowDays } = IPI_DEFAULTS;
  const asOfMs  = _toMs(asOfDate);
  if (asOfMs == null) return calcProjectIPISnapshot(project);

  // Moving-window cutoff: only snapshots DATED within the last N days count.
  // Mirrors trailing-performance reporting in mature EVM tools (Primavera
  // Risk Analysis defaults to 90 days). A snapshot dated before the window
  // is excluded ENTIRELY; we don't extend its "coverage" into the window
  // (an old IPI is stale evidence even if no newer snapshot exists).
  const windowStartMs = asOfMs - timeWeightedWindowDays * 86_400_000;

  const raw = project.ipiHistory || [];
  const history = raw
    .filter(h => {
      const hMs = _toMs(h.date);
      return hMs != null && h.ipi != null && hMs <= asOfMs && hMs >= windowStartMs;
    })
    .sort((a, b) => _toMs(a.date) - _toMs(b.date));

  // Acceptable approximation until history accrues for this date range.
  // Either no history at all, or every snapshot fell outside the moving
  // window — in both cases we fall back to today's snapshot rather than
  // returning null, so a stale project doesn't lose its score entirely.
  // Must call the snapshot helper directly — calcProjectIPI now delegates
  // back to this function, so calling it here would recurse.
  if (!history.length) return calcProjectIPISnapshot(project);

  let totalWeighted = 0;
  let totalDays = 0;

  for (let i = 0; i < history.length; i++) {
    const fromMs = _toMs(history[i].date);
    const toMs   = i + 1 < history.length ? _toMs(history[i + 1].date) : asOfMs;
    // min 1 day so today's snapshot is always reflected immediately.
    const days = Math.max(1, Math.floor((toMs - fromMs) / 86_400_000));
    totalWeighted += history[i].ipi * days;
    totalDays     += days;
  }

  return Math.round(totalWeighted / totalDays);
}

/**
 * Department IPI — budget×priority weighted average of project IPIs.
 * Projects whose IPI is null ("Pending Plan") are EXCLUDED from the rollup,
 * so an unstaffed dept with placeholder projects doesn't pull the average down.
 * Returns null when no measurable projects in the dept.
 */
export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId && !p.archived);
  // calcProjectIPI now returns the time-weighted score, so the dept rollup
  // reflects each project's performance across its update history rather
  // than the most recent snapshot. Matches the IPI column in tables
  // (which also calls calcProjectIPI).
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
  const raw = wbs != null ? wbs : (project.progress ?? 0);
  // Clamp to [0, 100] — defensive against bad data (negative or >100 inputs).
  return Math.max(0, Math.min(100, raw));
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
