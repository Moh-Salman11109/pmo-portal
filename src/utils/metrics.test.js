import { describe, it, expect } from "vitest";
import { calcProjectIPIFull, parseGateNumber, calcAnticipatedMCI } from "./metrics.js";

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
