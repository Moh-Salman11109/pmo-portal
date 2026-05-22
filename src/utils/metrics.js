import { GATE_DEFS } from "../data/constants.js";
import { daysSince }  from "./dates.js";

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

// IPI per project = SPI×50% + CPI×25% + DocsCompliance×25%, capped at 100
export function calcProjectIPI(project) {
  const allDocs   = project.documents ?? [];
  const reqDocs   = allDocs.filter(d => d.required === true);
  const docsTotal = reqDocs.length;
  const docsReady = reqDocs.filter(d =>
    ["Approved","Final","Received","Current","Submitted"].includes(d.status)
  ).length;
  const docsScore = docsTotal > 0 ? docsReady / docsTotal : 0;
  const spi = Math.min(project.spi ?? 1, 1.2);
  const cpi = Math.min(project.cpi ?? 1, 1.2);
  const raw = (spi * 0.5) + (cpi * 0.25) + (docsScore * 0.25);
  return Math.min(Math.round((raw / 1.15) * 100), 100);
}

export function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  if (!dp.length) return 0;
  return Math.round(dp.reduce((s, p) => s + calcProjectIPI(p), 0) / dp.length);
}

export function ipiColor(score) {
  if (score >= 90) return { color: "#15803d", bg: "#dcfce7", label: "Excellent" };
  if (score >= 70) return { color: "#005c4b", bg: "#e8f5f0", label: "Good" };
  if (score >= 55) return { color: "#854d0e", bg: "#fef9c3", label: "Fair" };
  return             { color: "#991b1b", bg: "#fee2e2", label: "Poor" };
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
