import { describe, it, expect } from "vitest";
import { calcProjectIPIFull, parseGateNumber, calcAnticipatedMCI, deriveProjectStatus, calcProjectIPI, calcDeptIPI, calcPortfolioIPI, calcTimeWeightedIPI, effectiveProgress, calcProjectProgressFromWBS, ipiColor } from "./metrics.js";

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

  it("returns 1.0 when docs exist but none are required", () => {
    const p = mk({
      gate: "Gate 4",
      documents: [
        { name: "Optional Note", required: false, status: "Pending" },
      ],
    });
    expect(ipi(p).components.mci).toBe(1.0);
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
  it("SPI is capped at 1.20 when raw EV/PV exceeds it", () => {
    // 100% progress with only 50% of timeline elapsed → raw SPI = 2.0; cap to 1.20.
    const p = mk({
      milestones: [{ id: "M1", weight: 1, progress: 100, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    expect(ipi(p).components.spi).toBeLessThanOrEqual(1.20);
    expect(ipi(p).components.spi).toBeGreaterThan(1.0);
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

describe("Roadmap penalty — multiplicative decay 1% per day past deadline", () => {
  it("penalty is 1.0 (no effect) when project is within roadmap", () => {
    const p = mk({ roadmapDeadline: "2027-01-01" });
    expect(ipi(p).components.penalty).toBe(1.0);
  });
  it("penalty is 0.90 when 10 days past roadmap deadline", () => {
    // ASOF is 2026-06-19. Set roadmap to 2026-06-09 → 10 days overdue.
    const p = mk({ roadmapDeadline: "2026-06-09",
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    expect(ipi(p).components.penalty).toBeCloseTo(0.90, 2);
  });
  it("penalty floors at 0 (never negative) when 100+ days past deadline", () => {
    const p = mk({ roadmapDeadline: "2025-01-01",
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    expect(ipi(p).components.penalty).toBe(0);
  });
  it("penalty is applied multiplicatively to SPI (spiFinal = spi × penalty)", () => {
    const p = mk({ roadmapDeadline: "2026-06-09",
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    const r = ipi(p);
    expect(r.components.spiFinal).toBeCloseTo(r.components.spi * r.components.penalty, 3);
  });
});

describe("Null handling — neutral 1.0 default + all-null returns null IPI", () => {
  it("treats individual null components as neutral 1.0 in the IPI sum", () => {
    // No budget → CPI null. Should NOT pull the IPI down.
    const p = mk({ budget: 0, actualCost: 0,
      milestones: [{ id: "M1", weight: 1, progress: 50, startDate: "2026-04-01", date: "2026-12-31" }],
    });
    expect(ipi(p).components.cpi).toBe(null);
    expect(ipi(p).ipi).not.toBe(null);  // still produces a meaningful IPI
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

describe("ipiColor — status bands match the documented thresholds", () => {
  it("maps null to 'No Data' (grey)", () => {
    expect(ipiColor(null).label).toBe("No Data");
  });
  it("maps >100 to 'Over Achieved' (green dark)", () => {
    expect(ipiColor(110).label).toBe("Over Achieved");
  });
  it("maps exactly 100 to 'On Track' (green)", () => {
    expect(ipiColor(100).label).toBe("On Track");
  });
  it("maps 90 to 'Watch' (amber)", () => {
    expect(ipiColor(90).label).toBe("Watch");
  });
  it("maps 70 to 'At Risk' (orange)", () => {
    expect(ipiColor(70).label).toBe("At Risk");
  });
  it("maps below 70 to 'Critical' (red)", () => {
    expect(ipiColor(50).label).toBe("Critical");
  });
});
