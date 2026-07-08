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
  // Zero required documents used to return 1.0 (assumed full compliance)
  // — this let a PM inflate MCI to full green just by unchecking every
  // "required" flag. Now returns null (compliance not measurable) so the
  // component is excluded from the IPI rollup instead of falsely rewarded.
  if (reqDocs.length === 0) return null;
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
  // Maximum over-achievement allowed. 1.20 means a perfectly-early project can
  // score up to IPI=120. NON-STANDARD: pure EVM does not cap SPI/CPI. The cap
  // bounds genuine early delivery (measured against the project's own baseline)
  // to a defendable ceiling. Applied at the project level (not the rollup) so a
  // sandbagged plan can't single-handedly inflate the portfolio average.
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
 *   Schedule reference = the project's own committed BASELINE finish
 *             (baselineEnd, locked at Gate-3; falls back to plannedEnd). The
 *             Roadmap Deadline never feeds the math — it is a checkpoint that
 *             raises `roadmapBreach` when reached while incomplete.
 *     • IN-PROGRESS (< 100%): planned% is CLAMPED at 100% at the baseline, so a
 *       late-but-incomplete project reads SPI = actual% (proportional shortfall)
 *       and cannot be rewarded for roadmap slack.
 *     • COMPLETED (Option C): SPI = baselineDuration / actualDuration — late
 *       delivery lowers the score proportionally, early delivery raises it;
 *       no jump to 1.0 on closure. `daysLateVsPlan` carries the label.
 *
 * Cap (1.20) is applied at the very end of the SPI pipeline. Pure EVM does not
 * cap; Tree caps to bound the IPI to a defendable 0–120. The legacy `penalty`
 * field is retained (always 1.0) for old audit-modal compatibility.
 *
 * IPI ROLLUP — RE-NORMALISED, NOT NEUTRAL-FILLED:
 * Missing components (e.g. no actualCost → cpi=null) are EXCLUDED and the
 * remaining weights re-normalised to sum to 1. This closes the perverse
 * incentive where a PM could inflate IPI by withholding data; truthful
 * partial reporting now scores honestly on what's present.
 */
export function calcProjectIPIFull(project, asOfDate = TODAY) {
  const { cap, weights } = IPI_DEFAULTS;
  const asOfMs = _toMs(asOfDate) ?? Date.now();
  // The MEASUREMENT date for SPI: if the project has already been marked
  // Completed and we have an actualFinishDate, freeze the clock at that
  // moment. Otherwise use as-of. This lets a project finished on time keep
  // SPI = 1.0 even when someone reviews it months later.
  const finishMs = project.status === "Completed"
    ? _toMs(project.actualFinishDate || project.lastUpdate)
    : null;
  const nowMs = finishMs && finishMs > 0 ? finishMs : asOfMs;

  // ── Data-reliability guards (applied to project-level SPI paths) ──────────
  // The engine is defensively skeptical of its own inputs. Two conditions
  // make SPI mathematically meaningless and are refused rather than reported:
  //   1. Impossible dates — end at or before start. Anything the engine
  //      returns from bad dates would be misleading; return null.
  //   2. Baseline still forming — fewer than 7 days since start. A single-
  //      day EV/PV ratio has no signal (both approach zero); refuse to guess.
  const projectStartMs = _toMs(project.startDate);
  // SPI reference = the project's own committed BASELINE finish. Prefer the
  // locked baselineEnd (captured at Gate-3 approval, PMO-protected) and fall
  // back to plannedEnd for projects predating the baseline field. The Roadmap
  // Deadline is NEVER part of the SPI math — its slack must not inflate SPI.
  // Roadmap is a checkpoint only (see roadmapBreach below).
  const scheduleEndMs = _toMs(project.baselineEnd) || _toMs(project.plannedEnd);
  // Effective progress drives completion detection, the no-WBS SPI fallback,
  // and CPI's BCWP. Prefers the WBS rollup so a stale project.progress can't
  // drift from the activity-driven reality shown in the UI.
  const effProgress = effectiveProgress(project);
  const isComplete  = effProgress >= 100;
  // Impossible dates → SPI is meaningless. Baseline at/before start, OR a
  // completed project whose finish clock lands at/before start (zero/negative
  // actual duration) both fail the guard and return "Data Invalid".
  const datesInvalid = !!(projectStartMs && scheduleEndMs && scheduleEndMs <= projectStartMs)
    || !!(isComplete && projectStartMs && nowMs <= projectStartMs);
  const elapsedMs = projectStartMs && nowMs > projectStartMs ? nowMs - projectStartMs : 0;
  const tooEarly = projectStartMs && elapsedMs < 7 * 86_400_000;

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
  //   • With both startDate + date: linear interpolation between them,
  //     CLAMPED AT 1.0. Once as-of passes the leaf's planned end the leaf is
  //     "fully due" (planned% = 100%) and does not keep growing. This is the
  //     classic-EVM behaviour: schedule variance converges to zero at the
  //     planned finish. A late-but-incomplete leaf therefore reads actual% <
  //     100% against planned% = 100% → SPI < 1.0 (penalised); a late-but-
  //     complete leaf reads 100/100 = 1.0 (no bonus, no penalty). Early
  //     delivery vs the leaf's own plan is the only way to exceed 1.0.
  //   • KNOWN BIAS: linear interpolation assumes uniform effort. Real work
  //     is S-curve; linear PV systematically reports SPI > 1.0 mid-flight
  //     and SPI < 1.0 near completion. Accepted trade-off for simplicity.
  //   • Same-day leaf (start == end): instant milestone. 1.0 if as-of is
  //     past the date, 0 if not yet.
  //   • With only end date: step function (0 before, 1 after).
  //   • With neither: undefined — caller skips this leaf entirely so
  //     unscheduled leaves don't dilute PV silently.
  const plannedPct = (m) => {
    const startMs = _toMs(m.startDate);
    const endMs   = _toMs(m.date);
    if (startMs && endMs && endMs > startMs) {
      if (nowMs <= startMs) return 0;
      // Clamped at 1.0 — planned value never exceeds "fully due".
      return Math.min(1, (nowMs - startMs) / (endMs - startMs));
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

  // Only leaves with a defined PV contribute. Unscheduled leaves (no dates)
  // are excluded from BOTH numerator and denominator — they don't contribute
  // PV and their weight no longer pollutes the divisor.
  const scheduledLeaves = leaves.filter(m => plannedPct(m) !== null);
  const totalW = scheduledLeaves.reduce((s, m) => s + (m.weight || 1), 0);

  if (datesInvalid || tooEarly) {
    // Refuse to compute SPI when the inputs are meaningless. Component gets
    // excluded from the IPI rollup via re-normalisation, and the caller can
    // read `dataReliability` off the result to warn the user.
    ev = 0; pv = 0; spi = null;
  } else if (isComplete && projectStartMs && scheduleEndMs) {
    // ── Option C — COMPLETED projects score on schedule DURATION ────────────
    // Once a project is delivered, progress % is 100 by definition; the honest
    // schedule signal is how its actual duration compares to the committed
    // baseline duration:
    //     SPI = baselineDuration / actualDuration
    //     baselineDuration = start → baseline (locked Gate-3; else plannedEnd)
    //     actualDuration   = start → finish   (actualFinishDate; else as-of)
    // Late delivery lowers SPI proportionally, early delivery raises it (capped
    // 1.20). `nowMs` already resolves to the finish date for Completed projects
    // and to as-of otherwise, so a 100%-done calculator run and the registered
    // project produce identical results. Durations are guaranteed > 0 here
    // (the datesInvalid guard rejects zero/negative baseline or actual spans).
    const baselineDur = scheduleEndMs - projectStartMs;
    const actualDur   = nowMs - projectStartMs;
    ev  = 1;
    pv  = actualDur / baselineDur;   // > 1 when late, < 1 when early (uncapped)
    spi = baselineDur / actualDur;   // = ev / pv
  } else if (scheduledLeaves.length > 0 && totalW > 0) {
    ev = scheduledLeaves.reduce((s, m) => s + (m.weight || 1) * actualPct(m),  0) / totalW;
    pv = scheduledLeaves.reduce((s, m) => s + (m.weight || 1) * plannedPct(m), 0) / totalW;
    spi = pv === 0 ? null : ev / pv;
  } else if (projectStartMs && scheduleEndMs) {
    // No WBS — fall back to project-level dates + effective progress.
    // Reference is the baseline/plannedEnd (scheduleEndMs above), never the
    // roadmap. PV is CLAMPED AT 1.0: once as-of passes the baseline the
    // project is "fully due", so a late-but-complete project reads SPI = 1.0
    // (not a bonus) and a late-but-incomplete project reads SPI < 1.0.
    ev = effProgress / 100;
    if (project.plannedProgress != null && project.plannedProgress !== "") {
      // Manual override still respected (used mainly by the IPI Calculator).
      pv = Math.max(0, Math.min(1, Number(project.plannedProgress) / 100));
    } else {
      pv = nowMs <= projectStartMs ? 0 : Math.min(1, (nowMs - projectStartMs) / (scheduleEndMs - projectStartMs));
    }
    spi = pv === 0 ? null : ev / pv;
  } else {
    // No usable dates at all — SPI unmeasurable.
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

  // ── Final SPI: only the cap remains ───────────────────────────────────────
  // The old Tree-invented "roadmap penalty" is fully retired. SPI is measured
  // against the project's own baseline and lateness is captured by the clamped
  // PV (planned% pins at 100% at the baseline), so no separate penalty is
  // needed. The `penalty` field is kept (always 1) for legacy audit-modal
  // compatibility.
  const penalty = 1;
  const spiFinal = spi === null ? null : Math.min(cap, spi);

  // ── Roadmap = CHECKPOINT ONLY (no effect on any number) ───────────────────
  // A breach is raised when the as-of/finish clock reaches the Roadmap
  // Deadline while the project is still incomplete. Purely a flag for project
  // health; SPI already reflects the delay against the baseline.
  const roadmapMs = _toMs(project.roadmapDeadline);
  const roadmapBreach = !!(roadmapMs && nowMs >= roadmapMs && effProgress < 100);

  // ── Days late vs the baseline plan ────────────────────────────────────────
  // Days the measurement clock (as-of, or actualFinishDate when Completed) has
  // passed the baseline finish. 0 when on/before plan. Surfaced on the result
  // and persisted into ipiHistory so the lateness trend is preserved.
  const daysLateVsPlan = scheduleEndMs && nowMs > scheduleEndMs
    ? Math.floor((nowMs - scheduleEndMs) / 86_400_000)
    : 0;

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

  // Data-reliability short-circuit — if the schedule inputs are broken, we
  // refuse to publish a composite score even when CPI and MCI look fine.
  // Otherwise a project with impossible dates or a day-old baseline would
  // ship a green IPI on the strength of its cost & doc numbers alone,
  // which is exactly the "false-positive green" case the audit flagged.
  const scheduleBad = datesInvalid || tooEarly;
  const ipi = allNull            ? null
            : scheduleBad         ? null
            :                       Math.max(0, Math.round(ipiDecimal * 100));

  // Status follows the UNROUNDED ipiDecimal so adjacent projects whose
  // displayed integers are 99 vs 100 don't flip into different bands purely
  // from rounding noise. Data-reliability failures get their own statuses.
  const status = allNull            ? "Pending Plan"
               : datesInvalid        ? "Data Invalid"
               : tooEarly            ? "Baseline Forming"
               : ipiDecimal >  1.0   ? "Over Achieved"
               : ipiDecimal >= 1.0   ? "On Track"
               : ipiDecimal >= 0.9   ? "Watch"
               :                       "At Risk";

  // Data-reliability signal — surfaced to callers so the UI can render a
  // caution chip when the SPI computation was refused for a data-quality
  // reason (versus normal "no schedule data" cases).
  const dataReliability =
      datesInvalid ? "invalid_dates"
    : tooEarly     ? "baseline_forming"
    :                "ok";

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
    scheduleAnchor: "baseline",
    roadmapBreach,
    daysLateVsPlan,
    dataReliability,
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
  let asOfMs = _toMs(asOfDate);
  if (asOfMs == null) return calcProjectIPISnapshot(project);
  // Date-only as-of (YYYY-MM-DD) is parsed at midnight UTC. Bump to
  // end-of-day so snapshots saved later the same day (with full timestamps)
  // aren't excluded as "future". Without this, TODAY-as-of would drop every
  // snapshot saved after 00:00 UTC of the current calendar day.
  if (typeof asOfDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    asOfMs += 86_399_999;
  }

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
    // Fractional days so multiple snapshots within the same day don't each
    // claim a full day of weight (which they would under floor()+max(1,…),
    // letting a frenzy of same-day saves dominate the trailing average).
    // The current (latest) snapshot still gets a 1-day floor so a just-saved
    // value is immediately reflected even when no time has elapsed yet.
    const isLast = i + 1 >= history.length;
    const rawDays = Math.max(0, (toMs - fromMs) / 86_400_000);
    const days = isLast ? Math.max(1, rawDays) : rawDays;
    if (days === 0) continue;
    totalWeighted += history[i].ipi * days;
    totalDays     += days;
  }

  if (totalDays === 0) return calcProjectIPISnapshot(project);
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
 * PLANNED progress (0–100) the baseline expected at a given date — the
 * "Planned" curve on the Progress Planned-vs-Actual chart.
 *
 * DISPLAY-GRADE, not scoring-grade: unlike the SPI engine's PV this caps at
 * 100 (a plan never exceeds "done") and the no-WBS fallback anchors on
 * plannedEnd, NOT the Roadmap Deadline — the chart shows what the team
 * planned; the roadmap-anchored judgement lives in SPI.
 *
 *   With activities: Σ(weight × per-leaf planned%) ÷ Σ(weight), where each
 *   leaf interpolates linearly between its startDate and date.
 *   Without: linear from startDate → plannedEnd.
 *   Returns null when there is nothing to plan against (no usable dates).
 */
export function plannedProgressAt(project, asOfDate = TODAY) {
  const nowMs = _toMs(asOfDate);
  if (nowMs == null) return null;

  const items = project.milestones || [];
  const parentIds = new Set(items.filter(m => m.parentId).map(m => m.parentId));
  const leaves = items.filter(m => !parentIds.has(m.id));

  const leafPct = (m) => {
    const s = _toMs(m.startDate), e = _toMs(m.date);
    if (s && e && e > s) return nowMs <= s ? 0 : nowMs >= e ? 1 : (nowMs - s) / (e - s);
    if (e) return nowMs >= e ? 1 : 0;
    return null;   // unscheduled — excluded
  };

  const scheduled = leaves.filter(m => leafPct(m) !== null);
  const totalW = scheduled.reduce((s, m) => s + (m.weight || 1), 0);
  if (scheduled.length > 0 && totalW > 0) {
    const pv = scheduled.reduce((s, m) => s + (m.weight || 1) * leafPct(m), 0) / totalW;
    return Math.round(Math.min(1, pv) * 100);
  }

  const startMs = _toMs(project.startDate);
  const endMs   = _toMs(project.plannedEnd);
  if (startMs && endMs && endMs > startMs) {
    const pv = nowMs <= startMs ? 0 : Math.min(1, (nowMs - startMs) / (endMs - startMs));
    return Math.round(pv * 100);
  }
  return null;
}

/**
 * Replan memory for the Gantt: when an activity's finish date changes on save,
 * remember the date it replaced so the chart can show "18 Jun (struck) → 19 Jun".
 *
 * Window of exactly ONE previous date — a second replan overwrites prevDate
 * with the date being replaced, so the chart always reads "last plan → current
 * plan" and older history never piles up. prevDate persists inside the
 * MilestonesJSON blob; no SharePoint schema change needed.
 */
export function trackMilestoneDateChanges(next = [], prev = []) {
  const prevById = new Map(prev.map(m => [m.id, m]));
  return next.map(m => {
    const old = prevById.get(m.id);
    if (!old) return m;
    if (old.date && m.date && old.date !== m.date) {
      return { ...m, prevDate: old.date };
    }
    if (old.prevDate && !m.prevDate) return { ...m, prevDate: old.prevDate };
    return m;
  });
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

// Strict 3-band RAG scale derived from the Tree brand (v2 design).
// `color` = text/label, `bar` = bar/accent fill, `bg` = chip background.
// The old "Over Achieved" (>100) and "Watch 90-99"/"At Risk 70-89" split is
// intentionally merged: On Track ≥90, Watch 70-89, Critical <70.
export function ipiColor(score) {
  if (score == null) return { color: "#5a7a6e", bg: "#eef3ee", bar: "#a1b9ab", label: "No Data" };
  if (score >= 90) return { color: "#007a62", bg: "#e0f8ee", bar: "#00b894", label: "On Track" };
  if (score >= 70) return { color: "#b45309", bg: "#fdf1dd", bar: "#d97706", label: "Watch" };
  return             { color: "#b23800", bg: "#ffe8de", bar: "#FF5000", label: "Critical" };
}

// Same 3-band mapping as ipiColor() but tuned for dark hero gradients.
// Returns translucent pill colours and a gauge gradient pair.
export function ipiColorDark(score) {
  const band = ipiColor(score).label;
  switch (band) {
    case "On Track":
      return { bg: "rgba(0,255,179,0.12)", border: "rgba(0,255,179,0.45)", text: "#7dffd9", gaugeFrom: "#00b894", gaugeTo: "#00FFB3" };
    case "Watch":
      return { bg: "rgba(217,119,6,0.15)", border: "rgba(217,119,6,0.45)", text: "#fcd34d", gaugeFrom: "#b45309", gaugeTo: "#d97706" };
    case "Critical":
      return { bg: "rgba(255,80,0,0.15)", border: "rgba(255,80,0,0.45)", text: "#ff9d7a", gaugeFrom: "#b23800", gaugeTo: "#FF5000" };
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
