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
  decayWindowDays: 90,   // penalty reaches 0 after this many days past roadmap date
  cap:             1.05, // max SPI and CPI — over-achievement cannot bank credit above 5%
  weights: { spi: 0.50, cpi: 0.25, mci: 0.25 },
};

/**
 * Full IPI calculation per spec.
 * Returns { ipi (0–100), status, components, ev, pv }
 *
 * SPI  = progress / plannedProgress  (dynamic — no manual entry needed)
 * CPI  = project.cpi field (manual — PM enters in UpdatePanel)
 * MCI  = approved required docs / total required docs
 * penalty = roadmap-deadline decay applied to SPI only
 */
export function calcProjectIPIFull(project, asOfDate = TODAY) {
  const { cap, weights, decayWindowDays } = IPI_DEFAULTS;

  // ── SPI from progress fields (dynamic) ───────────────────────────
  const ev = (project.progress      ?? 0) / 100;
  const pv = (project.plannedProgress ?? 0) / 100;
  const spi = pv === 0 ? null : Math.min(cap, ev / pv);

  // ── CPI from manual PM field (capped) ────────────────────────────
  const cpiRaw = project.cpi;
  const cpi = (!cpiRaw || cpiRaw === 0) ? null : Math.min(cap, cpiRaw);

  // ── MCI: artifact / doc delivery ─────────────────────────────────
  const reqDocs = (project.documents ?? []).filter(d => d.required);
  const mci = reqDocs.length === 0
    ? 1
    : Math.min(1, reqDocs.filter(d =>
        ["Approved", "Final", "Received", "Current", "Submitted"].includes(d.status)
      ).length / reqDocs.length);

  // ── Roadmap-deadline penalty (hits SPI only) ─────────────────────
  const roadmapDeadline = project.roadmapDeadline;
  let penalty = 1;
  if (roadmapDeadline) {
    // If project is completed, freeze the penalty at the finish date (lastUpdate proxy)
    const finishDate = project.status === "Completed" ? (project.lastUpdate || asOfDate) : null;
    const measurementDate = finishDate || asOfDate;
    if (measurementDate > roadmapDeadline) {
      const daysOverdue = Math.floor(
        (new Date(measurementDate) - new Date(roadmapDeadline)) / 86_400_000
      );
      penalty = Math.max(0, 1 - daysOverdue / decayWindowDays);
    }
  }

  // ── Final SPI and IPI ─────────────────────────────────────────────
  const spiFinal = spi === null ? null : spi * penalty;

  // Graceful fallback: treat null SPI/CPI as 1.0 so other components still contribute
  const spiVal = spiFinal ?? 1.0;
  const cpiVal = cpi       ?? 1.0;

  const ipiDecimal = weights.spi * spiVal + weights.cpi * cpiVal + weights.mci * mci;

  // Keep 0–100 integer scale for backward compat with charts and badges
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

export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  if (!dp.length) return 0;
  return Math.round(dp.reduce((s, p) => s + calcProjectIPI(p), 0) / dp.length);
}

/** Updated bands to match spec: 100=OnTrack, 90–99=Watch, <90=AtRisk */
export function ipiColor(score) {
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
