// Runs the full IPI engine against every scenario the audit demands,
// so verdicts in the report are backed by real numeric outputs, not memory.

import { calcProjectIPIFull, calcProjectIPI, calcDeptIPI, calcPortfolioIPI, deriveProjectStatus, computeMCI } from "../src/utils/metrics.js";

const ASOF = "2026-07-03";

const scen = (label, project) => {
  const r = calcProjectIPIFull(project, ASOF);
  const status = deriveProjectStatus(project);
  console.log(`\n=== ${label} ===`);
  console.log(`  IPI     : ${r.ipi ?? "null"}   status: ${status?.status || "-"}`);
  console.log(`  SPI raw : ${r.components.spi ?? "null"}   penalty: ${r.components.penalty}`);
  console.log(`  spiFinal: ${r.components.spiFinal ?? "null"}`);
  console.log(`  CPI     : ${r.components.cpi ?? "null"}`);
  console.log(`  MCI     : ${r.components.mci ?? "null"}`);
  console.log(`  EV/PV   : ${r.ev} / ${r.pv}`);
};

// A. Perfect project (mid-way, on plan, on budget, all docs)
scen("A. Perfect midway", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 50,
  budget: 1_000_000, actualCost: 500_000,
  gate: "Gate 4",
  documents: [
    { name:"D1", required: true, requiredAtGate: 1, status:"Approved" },
    { name:"D2", required: true, requiredAtGate: 2, status:"Approved" },
    { name:"D3", required: true, requiredAtGate: 3, status:"Approved" },
    { name:"D4", required: true, requiredAtGate: 4, status:"Approved" },
  ],
});

// B. Delayed project (30% done, should be 60%)
scen("B. Delayed but efficient cost", {
  startDate: "2026-01-01", plannedEnd: "2026-10-01", progress: 30,
  budget: 1_000_000, actualCost: 300_000,     // spent proportionally to actual work
  gate: "Gate 4",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// C. Overspent (on schedule, 2× cost)
scen("C. Overspent 2× cost", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 50,
  budget: 1_000_000, actualCost: 1_000_000,
  gate: "Gate 4",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// D. Good progress, missing docs
scen("D. Ahead of schedule but 1/4 docs approved", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 80,
  budget: 1_000_000, actualCost: 400_000,
  gate: "Gate 4",
  documents: [
    { name:"D1", required: true, requiredAtGate: 1, status:"Approved" },
    { name:"D2", required: true, requiredAtGate: 2, status:"Draft"    },
    { name:"D3", required: true, requiredAtGate: 3, status:"Draft"    },
    { name:"D4", required: true, requiredAtGate: 4, status:"Draft"    },
  ],
});

// E. No actual cost yet (AC = 0)
scen("E. No AC yet", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 30,
  budget: 1_000_000, actualCost: 0,
  gate: "Gate 3",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// F. No planned cost (budget = 0)
scen("F. No budget", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 30,
  budget: 0, actualCost: 100_000,
  gate: "Gate 3",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// G. Planned=0 but actual>0 (just started today, someone claims 20%)
scen("G. Just started, 20% claimed", {
  startDate: ASOF, plannedEnd: "2027-01-01", progress: 20,
  budget: 100_000, actualCost: 10_000,
  gate: "Gate 2",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// H. Not started (start in future)
scen("H. Not started (future start)", {
  startDate: "2027-01-01", plannedEnd: "2027-12-31", progress: 0,
  budget: 100_000, actualCost: 0,
  gate: "Gate 1",
  documents: [],
});

// I. Completed on time
scen("I. Completed on time, reviewed later", {
  startDate: "2025-11-01", plannedEnd: "2026-01-30",
  progress: 100, status: "Completed", actualFinishDate: "2026-01-30",
  budget: 500_000, actualCost: 500_000,
  gate: "Gate 5",
  documents: [{ name:"D1", required: true, requiredAtGate: 5, status:"Approved" }],
});

// J. Inconsistent dates
scen("J. Inconsistent dates (end before start)", {
  startDate: "2026-06-01", plannedEnd: "2026-01-01",
  progress: 50,
  budget: 100_000, actualCost: 50_000,
  gate: "Gate 3",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// K. Overweighted milestones (weights sum to 300 instead of 100)
scen("K. Milestones with weights not summing to 100", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01",
  progress: 40,
  budget: 100_000, actualCost: 40_000,
  gate: "Gate 4",
  milestones: [
    { id:"M1", name:"A", weight: 100, progress: 60, startDate:"2026-01-01", date:"2026-06-01" },
    { id:"M2", name:"B", weight: 100, progress: 30, startDate:"2026-06-01", date:"2026-10-01" },
    { id:"M3", name:"C", weight: 100, progress: 0,  startDate:"2026-10-01", date:"2027-01-01" },
  ],
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// L. All required docs missing
scen("L. Docs exist but none approved", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 30,
  budget: 100_000, actualCost: 30_000,
  gate: "Gate 3",
  documents: [
    { name:"D1", required: true, requiredAtGate: 1, status:"Draft" },
    { name:"D2", required: true, requiredAtGate: 2, status:"Draft" },
    { name:"D3", required: true, requiredAtGate: 3, status:"Draft" },
  ],
});

// M. Gaming: super wide planned end (5 years) with 10% progress in year 1
scen("M. Gaming — very wide planned end, low progress", {
  startDate: "2026-01-01", plannedEnd: "2031-01-01", progress: 10,
  budget: 100_000, actualCost: 10_000,
  gate: "Gate 3",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// N. Gaming: no required documents at all → MCI = 1.0
scen("N. Gaming — zero required docs", {
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 30,
  budget: 100_000, actualCost: 30_000,
  gate: "Gate 3",
  documents: [{ name:"D1", required: false, requiredAtGate: 1, status:"Draft" }],
});

// O. Delayed 30 days past roadmap
scen("O. 30 days past roadmap", {
  startDate: "2026-01-01", plannedEnd: "2026-09-01",
  roadmapDeadline: "2026-06-01",
  progress: 60,
  budget: 100_000, actualCost: 50_000,
  gate: "Gate 4",
  documents: [{ name:"D1", required: true, requiredAtGate: 1, status:"Approved" }],
});

// P. All empty (Pending Plan)
scen("P. Empty pending-plan", {
  startDate: "", plannedEnd: "",
  progress: 0, budget: 0, actualCost: 0,
  milestones: [], documents: [],
});

// Portfolio aggregation tests
console.log("\n\n=== PORTFOLIO AGGREGATION TESTS ===");

const smallGoodProject = {
  id: "small", deptId: "d1", priority: "Low", budget: 100_000, archived: false,
  startDate: "2026-01-01", plannedEnd: "2027-01-01", progress: 50, actualCost: 50_000,
  gate: "Gate 4",
  milestones: [{ id:"M1", weight:1, progress: 50, startDate:"2026-01-01", date:"2026-12-31" }],
  documents: [{ name:"D1", required:true, requiredAtGate:1, status:"Approved" }],
};
const bigBadProject = {
  id: "big", deptId: "d1", priority: "Critical", budget: 50_000_000, archived: false,
  startDate: "2026-01-01", plannedEnd: "2026-10-01", progress: 25, actualCost: 30_000_000,
  gate: "Gate 4",
  milestones: [{ id:"M1", weight:1, progress: 25, startDate:"2026-01-01", date:"2026-09-30" }],
  documents: [{ name:"D1", required:true, requiredAtGate:1, status:"Approved" }],
};

console.log(`\n  Small good project IPI  : ${calcProjectIPI(smallGoodProject)}`);
console.log(`  Big  bad  project IPI  : ${calcProjectIPI(bigBadProject)}`);
console.log(`  Dept IPI (both)        : ${calcDeptIPI("d1", [smallGoodProject, bigBadProject])}`);

// Priority weighting check
const criticalP = { ...smallGoodProject, id:"cp", priority:"Critical", budget: 1_000_000, progress: 50 };
const lowP      = { ...smallGoodProject, id:"lp", priority:"Low",      budget: 1_000_000, progress: 50 };
console.log(`\n  Same size (1M budget) — Critical vs Low IPI should be equal:`);
console.log(`  Critical IPI: ${calcProjectIPI(criticalP)}   Low IPI: ${calcProjectIPI(lowP)}`);
console.log(`  (Dept weight differs though: Critical=budget×4, Low=budget×1)`);
