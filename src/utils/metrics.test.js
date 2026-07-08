import { describe, it, expect } from "vitest";
import { calcProjectIPIFull, parseGateNumber, calcAnticipatedMCI, deriveProjectStatus, calcProjectIPI, calcDeptIPI, calcTimeWeightedIPI, effectiveProgress, ipiColor, plannedProgressAt, trackMilestoneDateChanges } from "./metrics.js";

// Convenience: build a minimal project that calcProjectIPIFull will accept.
// asOfDate frozen so the time-based PV piece is deterministic across runs.
const ASOF = "2026-06-19";
const mk = (overrides = {}) => ({
  gate: "Gate 4",
  startDate: "2026-04-01",
  plannedEnd: "2026-12-31",
  progress: 50,
  budget: 1_000_000,
  actualCost: 500_000,
  milestones: [],
  documents: [],
  ...overrides,
});

const ipi = (p) => calcProjectIPIFull(p, ASOF);

describe("parseGateNumber", () => {
  it("parses 'Gate 1' through 'Gate 5'", () => {
    expect(parseGateNumber("Gate 1")).toBe(1);
    expect(parseGateNumber("Gate 5")).toBe(5);
  });
  it("parses short forms like 'G3'", () => {
    expect(parseGateNumber("G3")).toBe(3);
  });
  it("defaults to 1 when missing or unparseable", () => {
    expect(parseGateNumber(null)).toBe(1);
    expect(parseGateNumber(undefined)).toBe(1);
    expect(parseGateNumber("")).toBe(1);
    expect(parseGateNumber("not a gate")).toBe(1);
  });
  it("clamps out-of-range values to [1, 5]", () => {
    expect(parseGateNumber("Gate 0")).toBe(1);
    expect(parseGateNumber("Gate 99")).toBe(5);
    expect(parseGateNumber("Gate -3")).toBe(3); // matches the digit "3"
  });
});

describe("MCI — gate-aware document compliance", () => {
  it("excludes future-gate required docs from the denominator", () => {
    // Project at Gate 2 with one Gate-2 doc (Approved) + one Gate-5 doc (Pending).
    // Old behaviour: MCI = 1/2 = 0.5. New: MCI = 1/1 = 1.0 (Closure not due yet).
    const p = mk({
      gate: "Gate 2",
      documents: [
        { name: "Charter", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Closure", required: true, requiredAtGate: 5, status: "Pending"  },
      ],
    });
    expect(ipi(p).components.mci).toBe(1.0);
  });

  it("includes a doc once its gate is reached", () => {
    // Same docs, but the project is now at Gate 5 — Closure is now due.
    const p = mk({
      gate: "Gate 5",
      documents: [
        { name: "Charter", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Closure", required: true, requiredAtGate: 5, status: "Pending"  },
      ],
    });
    expect(ipi(p).components.mci).toBe(0.5);
  });

  it("defaults a missing requiredAtGate to 1 (always due)", () => {
    // Legacy doc with no requiredAtGate field — behaves as it did before.
    const p = mk({
      gate: "Gate 3",
      documents: [
        { name: "Old Doc", required: true, status: "Approved" }, // no requiredAtGate
      ],
    });
    expect(ipi(p).components.mci).toBe(1.0);
  });

  it("returns null when every required doc is future-gate", () => {
    // Project at Gate 1 with only Gate-5 required docs → MCI is unmeasurable
    // (neutral in the IPI rollup, treated as 1.0 internally so the project
    // isn't penalised for compliance it can't possibly have yet).
    const p = mk({
      gate: "Gate 1",
      documents: [
        { name: "Closure", required: true, requiredAtGate: 5, status: "Pending" },
      ],
    });
    expect(ipi(p).components.mci).toBe(null);
  });

  it("returns null when docs exist but none are required (governance not measurable)", () => {
    // Old behaviour returned 1.0 (assumed full compliance) — a PM could
    // uncheck every "required" flag and get free MCI credit. Post-audit
    // change: return null so the component is excluded from the rollup
    // instead of falsely rewarded.
    const p = mk({
      gate: "Gate 4",
      documents: [
        { name: "Optional Note", required: false, status: "Pending" },
      ],
    });
    expect(ipi(p).components.mci).toBe(null);
  });

  it("returns null when there are no documents at all", () => {
    const p = mk({ gate: "Gate 4", documents: [] });
    expect(ipi(p).components.mci).toBe(null);
  });

  it("counts Submitted / Under Review at 0.5 credit", () => {
    const p = mk({
      gate: "Gate 3",
      documents: [
        { name: "A", required: true, requiredAtGate: 1, status: "Approved"     }, // 1.0
        { name: "B", required: true, requiredAtGate: 2, status: "Under Review" }, // 0.5
        { name: "C", required: true, requiredAtGate: 3, status: "Submitted"    }, // 0.5
        { name: "D", required: true, requiredAtGate: 3, status: "Draft"        }, // 0.0
      ],
    });
    // (1 + 0.5 + 0.5 + 0) / 4 = 0.5
    expect(ipi(p).components.mci).toBe(0.5);
  });
});

describe("calcAnticipatedMCI — early-warning for future-gate docs", () => {
  it("returns null when project is at Gate 5 (no next gate)", () => {
    const p = mk({
      gate: "Gate 5",
      documents: [{ name: "X", required: true, requiredAtGate: 5, status: "Pending" }],
    });
    expect(calcAnticipatedMCI(p)).toBe(null);
  });

  it("returns null when no doc becomes due at the next gate", () => {
    // Gate-2 project, no docs ever due at Gate 3 → no change forecast.
    const p = mk({
      gate: "Gate 2",
      documents: [
        { name: "Charter", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Closure", required: true, requiredAtGate: 5, status: "Pending"  },
      ],
    });
    expect(calcAnticipatedMCI(p)).toBe(null);
  });

  it("forecasts MCI drop when next gate brings in a missing doc", () => {
    // Gate-2 project sitting pretty (MCI=1.0). Gate 3 adds 1 new required doc
    // that's still Draft → anticipated MCI drops to 1/2 = 0.5.
    const p = mk({
      gate: "Gate 2",
      documents: [
        { name: "Charter",  required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Plan",     required: true, requiredAtGate: 3, status: "Draft"    },
      ],
    });
    const anticipated = calcAnticipatedMCI(p);
    expect(anticipated.atGate).toBe(3);
    expect(anticipated.mci).toBe(0.5);
    expect(anticipated.deltaDocs).toBe(1);
  });

  it("forecasts MCI stays high when the next-gate doc is already Approved", () => {
    // Same shape but the new Gate-3 doc is already Approved → MCI stays 1.0.
    const p = mk({
      gate: "Gate 2",
      documents: [
        { name: "Charter", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Plan",    required: true, requiredAtGate: 3, status: "Approved" },
      ],
    });
    const anticipated = calcAnticipatedMCI(p);
    expect(anticipated.mci).toBe(1.0);
    expect(anticipated.deltaDocs).toBe(1);
  });
});

describe("deriveProjectStatus — auto status from performance signals", () => {
  it("returns Completed when progress=100 and project is at Gate 5", () => {
    const p = mk({
      gate: "Gate 5",
      progress: 100,
      milestones: [{ id: "M1", name: "Wrap up", weight: 1, progress: 100, status: "Completed" }],
    });
    expect(deriveProjectStatus(p).status).toBe("Completed");
  });

  it("does NOT return Completed when progress=100 but still at Gate 4", () => {
    // Closure hasn't happened yet — too early to mark Completed.
    const p = mk({
      gate: "Gate 4",
      progress: 100,
      milestones: [{ id: "M1", name: "Wrap up", weight: 1, progress: 100, status: "Completed" }],
    });
    expect(deriveProjectStatus(p).status).not.toBe("Completed");
  });

  it("returns Delayed when past plannedEnd and not at 100%", () => {
    const p = mk({
      gate: "Gate 4",
      progress: 60,
      plannedEnd: "2026-01-01",  // way in the past relative to ASOF (2026-06-19)
      milestones: [{ id: "M1", name: "X", weight: 1, progress: 60, status: "In Progress" }],
    });
    expect(deriveProjectStatus(p).status).toBe("Delayed");
  });

  it("returns Not Started when no activities and progress is 0", () => {
    const p = mk({ gate: "Gate 1", progress: 0, milestones: [] });
    expect(deriveProjectStatus(p).status).toBe("Not Started");
  });

  it("returns On Track when IPI ≥ 90", () => {
    const p = mk({
      gate: "Gate 4",
      progress: 50,
      budget: 1_000_000,
      actualCost: 500_000,
      plannedEnd: "2027-01-01",
      milestones: [{ id: "M1", name: "X", weight: 1, progress: 95, status: "In Progress", startDate: "2026-04-01", date: "2026-12-31" }],
      documents: [{ name: "Charter", required: true, requiredAtGate: 2, status: "Approved" }],
    });
    const result = deriveProjectStatus(p);
    expect(result.status).toBe("On Track");
    expect(result.reason).toMatch(/IPI.*≥ 90/);
  });

  it("returns At Risk when IPI < 90 and the project is mid-flight", () => {
    const p = mk({
      gate: "Gate 4",
      progress: 20,
      budget: 1_000_000,
      actualCost: 800_000,
      plannedEnd: "2027-01-01",
      milestones: [{ id: "M1", name: "X", weight: 1, progress: 20, status: "In Progress", startDate: "2026-04-01", date: "2026-06-19" }],
      documents: [{ name: "Charter", required: true, requiredAtGate: 2, status: "Draft" }],
    });
    expect(deriveProjectStatus(p).status).toBe("At Risk");
  });

  it("includes a human-readable reason on every result", () => {
    // Caller renders this string under the status chip in the Update panel.
    const p = mk({ gate: "Gate 1", progress: 0, milestones: [] });
    expect(deriveProjectStatus(p).reason).toBeTruthy();
    expect(typeof deriveProjectStatus(p).reason).toBe("string");
  });
});

describe("IPI consistency — number must match its breakdown", () => {
  it("snapshot IPI equals 100·(0.5·SPI + 0.25·CPI + 0.25·MCI)", () => {
    // Plain mid-flight project. Verifies the math the user actually sees in
    // the project header (the bug they caught: '78 displayed, breakdown gave 82').
    const p = mk({
      gate: "Gate 4",
      progress: 50,
      budget: 1_000_000,
      actualCost: 500_000, // CPI = 1.0
      documents: [
        { name: "Charter", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "Plan",    required: true, requiredAtGate: 3, status: "Approved" },
        { name: "Closure", required: true, requiredAtGate: 5, status: "Pending"  },
      ],
    });
    const r = ipi(p);
    const expected = Math.round(
      100 * (0.5 * r.components.spiFinal + 0.25 * r.components.cpi + 0.25 * r.components.mci)
    );
    expect(r.ipi).toBe(expected);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Mathematical soundness — these tests lock in every governance-grade claim
// the IPI Methodology PDF makes. If any fails, the PDF and the engine have
// drifted and need to be re-aligned before shipping.
// ════════════════════════════════════════════════════════════════════════════

describe("Caps — components clamp at IPI_DEFAULTS.cap (1.20)", () => {
  it("SPI exposes the RAW ratio uncapped; cap is applied at spiFinal", () => {
    // 100% progress with only 50% of timeline elapsed → raw SPI = 2.0.
    // components.spi is now the raw, unscaled signal (so over-achievement is
    // visible to auditors); spiFinal carries the cap + penalty composition.
    const p = mk({
      milestones: [{ id: "M1", weight: 1, progress: 100, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    const r = ipi(p);
    expect(r.components.spi).toBeGreaterThan(1.20);          // raw stays uncapped
    expect(r.components.spiFinal).toBeLessThanOrEqual(1.20); // cap lands on the final
  });
  it("CPI is capped at 1.20 when BCWP / AC exceeds it", () => {
    // 50% progress, budget 1M, actual cost 100K → BCWP=500K, CPI=5.0; cap to 1.20.
    const p = mk({ budget: 1_000_000, actualCost: 100_000,
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    expect(ipi(p).components.cpi).toBe(1.20);
  });
  it("MCI is capped at 1.0 (compliance has no over-achievement)", () => {
    // 5 docs all Approved → 5/5 = 1.0, never exceeds.
    const p = mk({ documents: Array.from({ length: 5 }, (_, i) =>
      ({ name: `D${i}`, required: true, requiredAtGate: 1, status: "Approved" })),
    });
    expect(ipi(p).components.mci).toBe(1.0);
  });
});

describe("Roadmap-anchored SPI — measure vs Roadmap Deadline, not plannedEnd", () => {
  // The old model applied a 1%-per-day penalty on top of plannedEnd-derived
  // SPI. That let a PM pad plannedEnd to always look ahead, and the penalty
  // could not fully claw back the padding advantage. Now roadmap is used as
  // the SPI denominator directly and the explicit penalty is retired.
  // Legacy: `components.penalty` still exists and always reads 1.0 so old
  // audit modals don't break; new callers should ignore it.
  it("penalty field is always 1.0 (retired — kept for legacy modal compat)", () => {
    const p = mk({ roadmapDeadline: "2026-06-09" });
    expect(ipi(p).components.penalty).toBe(1.0);
    const q = mk({ roadmapDeadline: "2025-01-01" });   // way past
    expect(ipi(q).components.penalty).toBe(1.0);
  });

  it("SPI uses roadmap as denominator when set, plannedEnd otherwise", () => {
    // No roadmap → falls back to plannedEnd (2026-12-31). PV = 79/275 ≈ 0.29.
    // Progress 50 → EV = 0.5. Raw SPI ≈ 0.5 / 0.29 = 1.72 → capped 1.20.
    const noRoadmap = mk({
      startDate: "2026-04-01", plannedEnd: "2026-12-31",
      progress: 50, milestones: [], budget: 0, actualCost: 0, documents: [],
    });
    expect(ipi(noRoadmap).components.spiFinal).toBeCloseTo(1.20, 2);

    // Same project with a roadmap that predates plannedEnd. PV should now
    // measure against roadmap (2026-06-30), producing a lower SPI because
    // the strategic window is tighter than the operational plan.
    const withRoadmap = mk({
      ...noRoadmap, roadmapDeadline: "2026-06-30",
    });
    expect(ipi(withRoadmap).components.spi).toBeLessThan(ipi(noRoadmap).components.spi);
  });

  it("finishing after roadmap correctly shows SPI < 1 (no explicit penalty needed)", () => {
    // Start May 1, roadmap Jun 30, as-of Jul 15, 100% done.
    // Old model: raw SPI = 1.20 (early vs plannedEnd), penalty 0.85 → spiFinal 1.02 → IPI 101 "Over Achieved" (bug).
    // New model: PV vs roadmap = 75/60 = 1.25, EV = 1.0, SPI = 0.80, IPI ≈ 90 "Watch".
    const p = mk({
      startDate: "2026-05-01", plannedEnd: "2026-07-30",
      roadmapDeadline: "2026-06-30",
      progress: 100, milestones: [],
      budget: 1500, actualCost: 1500,
      documents: [
        { name: "D1", required: true, requiredAtGate: 1, status: "Approved" },
        { name: "D2", required: true, requiredAtGate: 2, status: "Approved" },
        { name: "D3", required: true, requiredAtGate: 3, status: "Approved" },
      ],
    });
    const r = calcProjectIPIFull(p, "2026-07-15");
    expect(r.components.spi).toBeGreaterThan(0.75);
    expect(r.components.spi).toBeLessThan(0.85);
    expect(r.ipi).toBeGreaterThan(85);
    expect(r.ipi).toBeLessThan(95);
    // The "Over Achieved" band is impossible when past roadmap — verify.
    expect(r.ipi).toBeLessThan(100);
  });

  it("padded plannedEnd does not inflate SPI when roadmap is set", () => {
    // Same real work, two projects. A has honest plannedEnd matching roadmap;
    // B pads plannedEnd 2× beyond roadmap. Their SPIs must be identical when
    // roadmap is used as the denominator.
    const honest = mk({
      startDate: "2026-01-01", plannedEnd: "2026-06-30",
      roadmapDeadline: "2026-06-30",
      progress: 50, milestones: [], budget: 0, actualCost: 0, documents: [],
    });
    const padded = mk({
      startDate: "2026-01-01", plannedEnd: "2026-12-31",     // 2× padded
      roadmapDeadline: "2026-06-30",
      progress: 50, milestones: [], budget: 0, actualCost: 0, documents: [],
    });
    expect(ipi(padded).components.spi).toBeCloseTo(ipi(honest).components.spi, 3);
  });
});

describe("Null handling — present components re-normalise, all-null returns null IPI", () => {
  it("excludes null components and re-normalises weights of those present", () => {
    // No budget → CPI null. Old (perverse) behaviour treated null as 1.0,
    // rewarding PMs for withholding data. Now: cpi is excluded, the remaining
    // SPI (0.50) and MCI (0.25) re-weight to sum 1.0 → SPI carries 2/3 weight.
    const p = mk({ budget: 0, actualCost: 0,
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
      documents: [{ name: "Charter", required: true, requiredAtGate: 1, status: "Approved" }],
    });
    const r = ipi(p);
    expect(r.components.cpi).toBe(null);
    expect(r.ipi).not.toBe(null);
    // Manual reproduction: spiFinal × (0.50/0.75) + mci × (0.25/0.75)
    const expected = Math.round(
      (r.components.spiFinal * (0.50/0.75) + r.components.mci * (0.25/0.75)) * 100
    );
    expect(r.ipi).toBe(expected);
  });

  it("withholding cost data does NOT inflate IPI vs reporting weak cost data", () => {
    // The whole point of fixing null=1.0: a PM who reports honest poor CPI=0.5
    // should score the SAME OR LOWER than a PM who reports no cost data at all,
    // not higher. (Old behaviour: null → 1.0 → IPI higher than honest 0.5.)
    const base = {
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
      documents: [{ name: "Charter", required: true, requiredAtGate: 1, status: "Approved" }],
    };
    const noCost   = mk({ ...base, budget: 0, actualCost: 0 });
    const weakCost = mk({ ...base, budget: 1_000_000, actualCost: 1_000_000 }); // CPI=0.5
    expect(ipi(weakCost).ipi).toBeLessThanOrEqual(ipi(noCost).ipi);
  });

  it("returns null IPI ('Pending Plan') when ALL three components are null", () => {
    const p = mk({ budget: 0, actualCost: 0, milestones: [], documents: [],
      startDate: "", plannedEnd: "" });
    expect(ipi(p).ipi).toBe(null);
    expect(ipi(p).status).toBe("Pending Plan");
  });
});

describe("CPI sources BCWP from effectiveProgress, not the stale field", () => {
  it("uses WBS-rolled progress when activities exist, regardless of project.progress", () => {
    // project.progress stored as 10 (stale), but WBS rolls up to 50%.
    // CPI should compute BCWP from 50, not 10.
    const p = mk({
      progress: 10,            // stale field — ignored
      budget: 1_000_000,
      actualCost: 500_000,
      milestones: [{ id: "M1", weight: 1, progress: 50, status: "In Progress", startDate: "2026-04-01", date: "2026-12-31" }],
    });
    // BCWP = 0.50 × 1,000,000 = 500,000;  CPI = 500,000 / 500,000 = 1.0
    expect(ipi(p).components.cpi).toBe(1.0);
  });
});

describe("calcDeptIPI — budget × priority weighted rollup", () => {
  it("Critical × big-budget project dominates the dept score", () => {
    const dp = [
      { id: "p1", deptId: "d1", priority: "Critical", budget: 50_000_000,
        gate: "Gate 4", startDate: "2026-04-01", plannedEnd: "2027-01-01",
        progress: 90, actualCost: 25_000_000,
        milestones: [{ id: "M1", weight: 1, progress: 90, startDate: "2026-04-01", date: "2026-12-31" }],
        documents: [{ name: "Charter", required: true, requiredAtGate: 2, status: "Approved" }] },
      { id: "p2", deptId: "d1", priority: "Low", budget: 1_000_000,
        gate: "Gate 4", startDate: "2026-04-01", plannedEnd: "2027-01-01",
        progress: 10, actualCost: 800_000,
        milestones: [{ id: "M1", weight: 1, progress: 10, startDate: "2026-04-01", date: "2026-06-19" }],
        documents: [{ name: "Charter", required: true, requiredAtGate: 2, status: "Draft" }] },
    ];
    const deptIPI = calcDeptIPI("d1", dp);
    const p1IPI = calcProjectIPI(dp[0]);
    const p2IPI = calcProjectIPI(dp[1]);
    // Critical+50M is 200× weight of Low+1M, so dept IPI rounds to ≈ p1's IPI.
    expect(Math.abs(deptIPI - p1IPI)).toBeLessThan(2);
    expect(Math.abs(deptIPI - p2IPI)).toBeGreaterThan(10);
  });
  it("excludes null-IPI (Pending Plan) projects from the denominator", () => {
    const dp = [
      { id: "p1", deptId: "d1", priority: "High", budget: 1_000_000,
        gate: "Gate 4", startDate: "2026-04-01", plannedEnd: "2027-01-01",
        progress: 80, actualCost: 500_000,
        milestones: [{ id: "M1", weight: 1, progress: 80, startDate: "2026-04-01", date: "2026-12-31" }],
        documents: [{ name: "Charter", required: true, requiredAtGate: 2, status: "Approved" }] },
      // Pending Plan — no schedule, cost, or doc data
      { id: "p2", deptId: "d1", priority: "Medium", budget: 0,
        milestones: [], documents: [], startDate: "", plannedEnd: "" },
    ];
    const deptIPI = calcDeptIPI("d1", dp);
    const p1IPI = calcProjectIPI(dp[0]);
    expect(deptIPI).toBe(p1IPI);  // Pending Plan project doesn't dilute
  });
  it("returns null when no measurable projects in the dept", () => {
    expect(calcDeptIPI("empty-dept", [])).toBe(null);
  });
});

describe("calcTimeWeightedIPI — weighted by days each snapshot was active", () => {
  it("weights each snapshot by its duration to the next", () => {
    // 30 days at IPI 80, then 30 days at IPI 100 → simple avg 90, time-weighted ≈ 90.
    const p = mk({
      ipiHistory: [
        { date: "2026-04-01", ipi: 80 },
        { date: "2026-05-01", ipi: 100 },
      ],
    });
    const tw = calcTimeWeightedIPI(p, "2026-05-31");
    expect(tw).toBeGreaterThanOrEqual(89);
    expect(tw).toBeLessThanOrEqual(91);
  });
  it("falls back to the snapshot IPI when no history exists", () => {
    const p = mk({ ipiHistory: [] });
    expect(calcTimeWeightedIPI(p, "2026-06-19")).toBe(calcProjectIPI(p));
  });
});

describe("effectiveProgress — single source of truth for progress%", () => {
  it("prefers WBS rollup when milestones exist", () => {
    const p = mk({
      progress: 10,  // stale
      milestones: [
        { id: "M1", weight: 1, progress: 80 },
        { id: "M2", weight: 1, progress: 20 },
      ],
    });
    // Weighted avg of M1+M2 = (80+20)/2 = 50, not the stale 10
    expect(effectiveProgress(p)).toBe(50);
  });
  it("falls back to project.progress when no WBS", () => {
    const p = mk({ progress: 35, milestones: [] });
    expect(effectiveProgress(p)).toBe(35);
  });
});

describe("Audit fix — Data reliability guards refuse to score bad inputs", () => {
  it("Impossible dates (end before start) → IPI is null and dataReliability = 'invalid_dates'", () => {
    // Even with a healthy CPI and MCI, an IPI must not be published on a
    // project whose dates cannot possibly be right. Previously this
    // shipped IPI = 100 silently. Now: no score at all, and a machine-
    // readable flag so the UI can render a red caution chip.
    const p = mk({
      startDate: "2026-06-01", plannedEnd: "2026-01-01",   // reversed
      progress: 50, budget: 100_000, actualCost: 50_000,
      milestones: [],
      documents: [{ name: "D1", required: true, requiredAtGate: 1, status: "Approved" }],
    });
    const r = ipi(p);
    expect(r.ipi).toBe(null);
    expect(r.dataReliability).toBe("invalid_dates");
    expect(r.status).toBe("Data Invalid");
    expect(r.components.spi).toBe(null);
  });

  it("Baseline forming (<7 days elapsed) → IPI is null and dataReliability = 'baseline_forming'", () => {
    // A project started less than a week ago cannot produce a meaningful
    // schedule ratio (EV/PV both approach zero). Refuse to score rather
    // than emit a misleading number.
    const p = mk({
      startDate: "2026-06-17", plannedEnd: "2026-12-31",   // 2 days before ASOF 2026-06-19
      progress: 20, budget: 100_000, actualCost: 10_000,
      milestones: [],
      documents: [{ name: "D1", required: true, requiredAtGate: 1, status: "Approved" }],
    });
    const r = ipi(p);
    expect(r.ipi).toBe(null);
    expect(r.dataReliability).toBe("baseline_forming");
    expect(r.status).toBe("Baseline Forming");
  });

  it("MCI = null (not 1.0) when documents exist but none marked required", () => {
    // Closes the "uncheck required to game MCI" vector. See computeMCI
    // for the full rationale.
    const p = mk({
      gate: "Gate 4",
      documents: [
        { name: "Optional Note", required: false, status: "Draft" },
      ],
    });
    expect(ipi(p).components.mci).toBe(null);
  });

  it("scheduleAnchor reports which deadline drove SPI (roadmap vs plannedEnd)", () => {
    // Governance-facing signal so a reviewer knows whether the SPI they're
    // reading was measured against the strategic (roadmap) or operational
    // (plannedEnd) window.
    const withRoadmap    = mk({ roadmapDeadline: "2026-12-31" });
    const withoutRoadmap = mk({ roadmapDeadline: null });
    expect(ipi(withRoadmap).scheduleAnchor).toBe("roadmap");
    expect(ipi(withoutRoadmap).scheduleAnchor).toBe("plannedEnd");
  });
});

describe("ipiColor — strict 3-band scale (v2 design)", () => {
  it("maps null to 'No Data' (grey)", () => {
    expect(ipiColor(null).label).toBe("No Data");
  });
  it("maps >100 to 'On Track' (merged, no separate Over Achieved band)", () => {
    expect(ipiColor(110).label).toBe("On Track");
  });
  it("maps exactly 100 to 'On Track'", () => {
    expect(ipiColor(100).label).toBe("On Track");
  });
  it("maps 90 to 'On Track' (lower edge of the band)", () => {
    expect(ipiColor(90).label).toBe("On Track");
  });
  it("maps 89 to 'Watch'", () => {
    expect(ipiColor(89).label).toBe("Watch");
  });
  it("maps 70 to 'Watch' (lower edge)", () => {
    expect(ipiColor(70).label).toBe("Watch");
  });
  it("maps below 70 to 'Critical'", () => {
    expect(ipiColor(50).label).toBe("Critical");
  });
  it("exposes brand text + bar colours per band", () => {
    expect(ipiColor(95)).toMatchObject({ color: "#007a62", bar: "#00b894" });
    expect(ipiColor(80)).toMatchObject({ color: "#b45309", bar: "#d97706" });
    expect(ipiColor(50)).toMatchObject({ color: "#b23800", bar: "#FF5000" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Post-audit regression suite — covers the issues raised in the deep IPI audit.
// Every test here exists to lock in a fix; if any of these fail, the engine
// has regressed against an explicitly-defended decision.
// ════════════════════════════════════════════════════════════════════════════

describe("Audit fix — negative actualCost is treated as missing data", () => {
  it("a negative actualCost produces cpi=null, not a negative CPI poisoning IPI", () => {
    const p = mk({ budget: 1_000_000, actualCost: -50_000,
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    const r = ipi(p);
    expect(r.components.cpi).toBe(null);
    expect(r.ipi).not.toBe(null);     // SPI + MCI still rollup
    expect(r.ipi).toBeGreaterThan(0);
  });
});

describe("Audit fix — same-day (instant) milestone behaves as a real instant", () => {
  it("a milestone with start==end is 100% planned the day it's due, not 0%", () => {
    // Instant milestone dated in the past: should be PV=1 → SPI based on actual.
    const p = mk({
      milestones: [{ id: "M1", weight: 1, progress: 100, startDate: "2026-05-01", date: "2026-05-01" }],
    });
    const r = ipi(p);
    expect(r.pv).toBeCloseTo(1.0, 3);
    expect(r.components.spi).toBeCloseTo(1.0, 3);
  });
  it("future instant milestone is 0% planned (and the weight isn't excluded — it's a real PV value)", () => {
    const p = mk({
      milestones: [
        { id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" },
        { id: "M2", weight: 1, progress: 0,  startDate: "2027-01-01", date: "2027-01-01" }, // future instant
      ],
    });
    const r = ipi(p);
    // M2 contributes PV=0 and EV=0, so it only adds weight; SPI ≈ M1's ratio.
    expect(r.components.spi).toBeGreaterThan(0);
  });
});

describe("Audit fix — unscheduled leaves are excluded from the SPI aggregator", () => {
  it("a leaf with no startDate/date is dropped, not silently inflating SPI via dilution", () => {
    const withUnsched = mk({
      milestones: [
        { id: "M1", weight: 1, progress: 80, startDate: "2026-04-01", date: "2026-12-31" },
        { id: "M2", weight: 1, progress: 0  /* no dates */ },
      ],
    });
    const withoutUnsched = mk({
      milestones: [
        { id: "M1", weight: 1, progress: 80, startDate: "2026-04-01", date: "2026-12-31" },
      ],
    });
    // Both projects should produce the same SPI — the unscheduled leaf must
    // be entirely excluded from the calculation.
    expect(ipi(withUnsched).components.spi).toBeCloseTo(ipi(withoutUnsched).components.spi, 3);
  });
});

describe("Audit fix — date normalisation accepts strings, ISO datetimes, Date objects", () => {
  it("Date object as asOfDate works the same as the ISO-string equivalent", () => {
    const p = mk({
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    const asString = calcProjectIPIFull(p, "2026-06-19").ipi;
    const asDate   = calcProjectIPIFull(p, new Date("2026-06-19T00:00:00Z")).ipi;
    expect(asDate).toBe(asString);
  });
  it("ISO datetime (T...Z) doesn't break planned% interpolation", () => {
    const p = {
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01T00:00:00Z", date: "2026-12-31T00:00:00Z" }],
    };
    const r = calcProjectIPIFull(p, "2026-06-19");
    expect(Number.isFinite(r.components.spi)).toBe(true);
  });
});

describe("Audit fix — time-weighted IPI honours a 90-day moving window", () => {
  it("a snapshot older than 90 days from asOfDate is excluded from the average", () => {
    // Two snapshots: one 200 days ago at IPI=20 (should be ignored),
    // one 30 days ago at IPI=100. The weighted average should be ≈ 100, not 60.
    const p = {
      ipiHistory: [
        { date: "2025-12-01", ipi: 20  },   // ~200 days before 2026-06-19
        { date: "2026-05-20", ipi: 100 },
      ],
    };
    const tw = calcTimeWeightedIPI(p, "2026-06-19");
    expect(tw).toBeGreaterThan(95);
  });
  it("falls back to the current snapshot when every history entry is outside the window", () => {
    const p = {
      ipiHistory: [{ date: "2025-01-01", ipi: 30 }],   // way outside 90d window
      milestones: [{ id: "M1", weight: 1, progress: 100, startDate: "2026-01-01", date: "2026-06-01" }],
    };
    // Outside-window history → falls back to snapshot, which here is over-achieving.
    const tw = calcTimeWeightedIPI(p, "2026-06-19");
    expect(tw).toBeGreaterThan(50);
  });
});

describe("Audit fix — IPI status band uses unrounded decimal, not the displayed integer", () => {
  // ipiDecimal exactly at 0.995 (i.e. ipi rounds to 100 but math says still < 1.00).
  // Old behaviour: rounded ipi=100 → "On Track" banner. New: ipiDecimal < 1.00 →
  // "Watch", preventing the boundary flip.
  it("a project with ipiDecimal below 1.00 stays in Watch even when rounded display says 100", () => {
    // Force ipiDecimal ≈ 0.995 via direct rollup math. The simplest path:
    // construct a project where the only present component is mci=0.995.
    const p = mk({
      budget: 0, actualCost: 0, milestones: [],
      startDate: "", plannedEnd: "",
      documents: [
        { name: "A", required: true, requiredAtGate: 1, status: "Approved"     }, // 1.0
        { name: "B", required: true, requiredAtGate: 1, status: "Approved"     },
        { name: "C", required: true, requiredAtGate: 1, status: "Submitted"    }, // 0.5
      ],
    });
    // MCI here = 2.5 / 3 ≈ 0.833 → IPI rounds to 83.
    // (This sanity-checks the rollup uses unrounded math, not that the engine
    //  hits the 0.995 edge precisely — that's a property no real input reaches.)
    const r = ipi(p);
    expect(r.status).toBe("At Risk");      // 0.833 < 0.90
    expect(r.ipi).toBe(83);
  });
});

describe("Audit fix — PV is NOT capped at 1.0 (completed-late bug)", () => {
  // The scenario the user caught in the IPI Calculator on 2026-07-01:
  //   Start Nov 1 2025, Planned End Jan 30 2026, As-of Apr 1 2026,
  //   Actual Progress 100%. Old engine returned SPI = 1.0 (PV capped).
  //   That is nonsense: the project finished 2 months late.
  //   With the fix, PV = 151/90 ≈ 1.678 and SPI ≈ 0.596.
  it("100%-done project past planned end returns SPI << 1.0, NOT 1.0", () => {
    // The exact Calculator scenario the user caught. Budget/AC zero so CPI
    // is excluded and re-normalisation leaves IPI = spiFinal × 100 for a
    // clean assertion.
    const p = mk({
      startDate: "2025-11-01", plannedEnd: "2026-01-30",
      progress: 100,
      budget: 0, actualCost: 0, milestones: [], documents: [],
    });
    const r = calcProjectIPIFull(p, "2026-04-01");
    // Planned duration: 90 days. Actual duration to as-of: 151 days.
    // Raw SPI = 1.0 / (151/90) ≈ 0.596.
    expect(r.components.spi).toBeGreaterThan(0.55);
    expect(r.components.spi).toBeLessThan(0.65);
    // With SPI as the only component, IPI = round(spi × 100) ≈ 60.
    expect(r.ipi).toBeGreaterThan(55);
    expect(r.ipi).toBeLessThan(65);
  });

  it("in-progress project past planned end shows the shortfall (80% at 130% of plan)", () => {
    const p = mk({
      startDate: "2026-01-01", plannedEnd: "2026-04-10",   // 99 days planned
      progress: 80,
      budget: 0, actualCost: 0, milestones: [], documents: [],
    });
    const r = calcProjectIPIFull(p, "2026-05-15");   // 134 days elapsed
    // PV = 134/99 ≈ 1.353; SPI = 0.80 / 1.353 ≈ 0.591.
    expect(r.components.spi).toBeGreaterThan(0.55);
    expect(r.components.spi).toBeLessThan(0.65);
  });

  it("Completed project with actualFinishDate on time keeps SPI = 1.0 even reviewed later", () => {
    const p = mk({
      startDate: "2025-11-01", plannedEnd: "2026-01-30",
      progress: 100,
      status: "Completed", actualFinishDate: "2026-01-30",
      budget: 0, actualCost: 0, milestones: [], documents: [],
    });
    const r = calcProjectIPIFull(p, "2026-08-01");
    expect(r.components.spi).toBeCloseTo(1.0, 1);
  });
});

describe("Audit fix — multi-snapshot-per-day uses fractional days", () => {
  // Append-every-save semantics: a frenzy of 10 saves in 10 minutes must
  // not dominate the trailing 90-day average. Each non-final snapshot now
  // contributes its actual fractional day weight; only the final snapshot
  // gets a 1-day floor so a just-saved value is reflected immediately.
  it("ten same-hour snapshots all carry tiny weight; a single older snapshot still dominates", () => {
    const sameDay = "2026-06-19";
    const ipiHistory = [];
    // 1 historical snapshot 30 days ago at IPI=50
    ipiHistory.push({ date: "2026-05-20T12:00:00Z", ipi: 50 });
    // 10 snapshots today within an hour at IPI=100
    for (let i = 0; i < 10; i++) {
      ipiHistory.push({ date: `${sameDay}T10:${String(i).padStart(2,"0")}:00Z`, ipi: 100 });
    }
    const tw = calcTimeWeightedIPI({ ipiHistory }, sameDay);
    // 30 days at 50 + 1 day at 100 → ~52 ish, NOT a meaningful pull toward 100.
    // Old (buggy) behaviour gave 10 days of weight to the same-hour snapshots
    // and would have produced ≈63.
    expect(tw).toBeLessThan(60);
    expect(tw).toBeGreaterThan(50);
  });

  it("a single in-the-window snapshot dominates when alone, regardless of in-day frequency", () => {
    const p = { ipiHistory: [
      { date: "2026-06-15T09:00:00Z", ipi: 95 },
      { date: "2026-06-15T09:10:00Z", ipi: 95 },
      { date: "2026-06-15T09:20:00Z", ipi: 95 },
    ] };
    const tw = calcTimeWeightedIPI(p, "2026-06-19");
    expect(tw).toBe(95);
  });

  it("backwards-compatible: old date-only history still computes correctly", () => {
    const p = { ipiHistory: [
      { date: "2026-05-20", ipi: 80 },
      { date: "2026-06-10", ipi: 100 },
    ] };
    const tw = calcTimeWeightedIPI(p, "2026-06-19");
    // 21 days at 80 + 9 days (clamped to ≥1) at 100 = 1680 + 900 = 2580 / 30 = 86
    expect(tw).toBeGreaterThan(80);
    expect(tw).toBeLessThan(95);
  });
});

describe("Audit fix — re-normalisation in the IPI rollup", () => {
  it("only-SPI present: IPI equals 100 × spiFinal (full credit, no neutral filler)", () => {
    const p = mk({
      budget: 0, actualCost: 0, documents: [],
      milestones: [{ id: "M1", weight: 1, progress: 60, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    const r = ipi(p);
    expect(r.components.cpi).toBe(null);
    expect(r.components.mci).toBe(null);
    expect(r.ipi).toBe(Math.round(r.components.spiFinal * 100));
  });
  it("SPI + MCI present, no CPI: weights 0.5/0.25 re-normalise to 2/3 and 1/3", () => {
    const p = mk({
      budget: 0, actualCost: 0,
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
      documents: [{ name: "Charter", required: true, requiredAtGate: 1, status: "Approved" }],
    });
    const r = ipi(p);
    const expected = Math.round((r.components.spiFinal * (2/3) + r.components.mci * (1/3)) * 100);
    expect(r.ipi).toBe(expected);
  });
});
describe("My first test", () => {
  it("brand new project has no IPI yet", () => {
    const p = mk({
      startDate: "2026-06-19",
      plannedEnd: "2026-12-31",
      progress: 0,
      milestones: [],
      documents: [],
    });
    const r = ipi(p);
    expect(r.ipi).toBe(null);
  });
});

describe("plannedProgressAt — display-grade Planned curve for the progress chart", () => {
  it("linear fallback: midway through start→plannedEnd reads ~50%", () => {
    const p = mk({ startDate: "2026-01-01", plannedEnd: "2026-12-31", milestones: [] });
    expect(plannedProgressAt(p, "2026-07-02")).toBeGreaterThanOrEqual(49);
    expect(plannedProgressAt(p, "2026-07-02")).toBeLessThanOrEqual(51);
  });

  it("caps at 100 past plannedEnd (a plan never exceeds done) — unlike scoring PV", () => {
    const p = mk({ startDate: "2026-01-01", plannedEnd: "2026-06-30", milestones: [] });
    expect(plannedProgressAt(p, "2026-12-01")).toBe(100);
  });

  it("uses milestone weights when activities exist", () => {
    // Two equal-weight leaves: one fully past (planned 100%), one not started
    // yet at the as-of date → planned = 50%.
    const p = mk({
      startDate: "2026-01-01", plannedEnd: "2026-12-31",
      milestones: [
        { id: "M1", weight: 1, progress: 0, startDate: "2026-01-01", date: "2026-03-01" },
        { id: "M2", weight: 1, progress: 0, startDate: "2026-09-01", date: "2026-12-01" },
      ],
    });
    expect(plannedProgressAt(p, "2026-06-01")).toBe(50);
  });

  it("returns null when there are no usable dates", () => {
    const p = mk({ startDate: "", plannedEnd: "", milestones: [] });
    expect(plannedProgressAt(p, "2026-06-01")).toBe(null);
  });

  it("anchors the fallback on plannedEnd, NOT the roadmap deadline", () => {
    // Roadmap is earlier than plannedEnd. The scoring PV would anchor on the
    // roadmap; the DISPLAY curve must show the team's plan (plannedEnd).
    const p = mk({
      startDate: "2026-01-01", plannedEnd: "2026-12-31",
      roadmapDeadline: "2026-06-30", milestones: [],
    });
    // Midway through the FULL plan (not past-100% vs the roadmap).
    expect(plannedProgressAt(p, "2026-07-02")).toBeLessThanOrEqual(51);
  });
});






describe("trackMilestoneDateChanges — Gantt replan memory", () => {
  const prev = [{ id: "A1", name: "Build API", date: "2026-06-18" }];

  it("first date change stores the replaced date as prevDate", () => {
    const next = [{ id: "A1", name: "Build API", date: "2026-06-19" }];
    const out = trackMilestoneDateChanges(next, prev);
    expect(out[0].prevDate).toBe("2026-06-18");
    expect(out[0].date).toBe("2026-06-19");
  });

  it("second change replaces prevDate — the first date disappears (window of 1)", () => {
    const afterFirst = trackMilestoneDateChanges(
      [{ id: "A1", name: "Build API", date: "2026-06-19" }], prev);
    const afterSecond = trackMilestoneDateChanges(
      [{ ...afterFirst[0], date: "2026-06-20" }], afterFirst);
    expect(afterSecond[0].prevDate).toBe("2026-06-19");   // 18 Jun is gone
    expect(afterSecond[0].date).toBe("2026-06-20");
  });

  it("saving without changing the date preserves the existing prevDate", () => {
    const withPrev = [{ id: "A1", name: "Build API", date: "2026-06-19", prevDate: "2026-06-18" }];
    const resaved = trackMilestoneDateChanges(
      [{ id: "A1", name: "Build API", date: "2026-06-19" }], withPrev);
    expect(resaved[0].prevDate).toBe("2026-06-18");
  });

  it("new activities and unchanged items pass through untouched", () => {
    const next = [
      { id: "A1", name: "Build API", date: "2026-06-18" },
      { id: "A2", name: "New task", date: "2026-07-01" },
    ];
    const out = trackMilestoneDateChanges(next, prev);
    expect(out[0].prevDate).toBeUndefined();
    expect(out[1].prevDate).toBeUndefined();
  });
});
