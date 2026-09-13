import { describe, it, expect } from "vitest";
import { computeRoi, addCalendarMonths, RoiInputError, ROI_HORIZON_YEARS } from "./roi.js";

// Base scenario from the spec. Money tolerance 0.01 SAR; ROI tolerance 1e-6 pp.
const BASE = {
  projectCost: 1_000_000,
  annualNetBenefit: 400_000,
  implementationMonths: 12,
  analysisHorizonYears: 5,
  annualDiscountRatePercent: 10,
  startDate: new Date(Date.UTC(2026, 8, 8)), // 2026-09-08
};
const run = (over = {}) => computeRoi({ ...BASE, ...over });
const money = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01);
const roi = (actual, expected) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-6);

describe("ROI engine — acceptance table (monthly cash-flow model)", () => {
  it("base scenario: 48 operating months, 60% ROI, NPV 204600.414724, recovery 42/30", () => {
    const r = run();
    expect(r.operatingMonths).toBe(48);
    roi(r.cumulativeRoiPercent, 60);
    money(r.npv, 204600.414724);
    expect(r.recoveryMonthFromStart).toBe(42);
    expect(r.paybackAfterLaunchMonths).toBe(30);
    expect(r.npvClass).toBe("positive");
    expect(r.breakEvenDate.toISOString().slice(0, 10)).toBe("2030-03-08");
  });
  it("discount 0%: NPV equals undiscounted net cash benefit (600000)", () => {
    const r = run({ annualDiscountRatePercent: 0 });
    money(r.npv, 600000);
    money(r.npv, r.netCashBenefit);
    roi(r.cumulativeRoiPercent, 60);
    expect(r.recoveryMonthFromStart).toBe(42);
  });
  it("implementation 0 months: 60 operating months, 100% ROI, NPV 584616.675702, recovery 30", () => {
    const r = run({ implementationMonths: 0 });
    expect(r.operatingMonths).toBe(60);
    roi(r.cumulativeRoiPercent, 100);
    money(r.npv, 584616.675702);
    expect(r.recoveryMonthFromStart).toBe(30);
  });
  it("implementation 8 months: 52 operating months, 73.3333% ROI, NPV 327270.102521, recovery 38", () => {
    const r = run({ implementationMonths: 8 });
    expect(r.operatingMonths).toBe(52);
    roi(r.cumulativeRoiPercent, 73.33333333333333);
    money(r.npv, 327270.102521);
    expect(r.recoveryMonthFromStart).toBe(38);
  });
  it("annual benefit 0: -100% ROI, NPV -1000000, never recovers within horizon", () => {
    const r = run({ annualNetBenefit: 0 });
    roi(r.cumulativeRoiPercent, -100);
    money(r.npv, -1_000_000);
    expect(r.recoveryMonthFromStart).toBeNull();
    expect(r.recovered).toBe(false);
    expect(r.breakEvenDate).toBeNull();
  });
  it("implementation 60 (= horizon): 0 operating months, -100% ROI, NPV -1000000", () => {
    const r = run({ implementationMonths: 60 });
    expect(r.operatingMonths).toBe(0);
    expect(r.hasOperatingWindow).toBe(false);
    roi(r.cumulativeRoiPercent, -100);
    money(r.npv, -1_000_000);
    expect(r.recoveryMonthFromStart).toBeNull();
  });
  it("implementation 72 (> horizon): still 0 operating months, -100% ROI, NPV -1000000", () => {
    const r = run({ implementationMonths: 72 });
    expect(r.operatingMonths).toBe(0);
    roi(r.cumulativeRoiPercent, -100);
    money(r.npv, -1_000_000);
    expect(r.recoveryMonthFromStart).toBeNull();
  });
  it("annual benefit 100000: -60% ROI, NPV -698849.896319, never recovers", () => {
    const r = run({ annualNetBenefit: 100_000 });
    roi(r.cumulativeRoiPercent, -60);
    money(r.npv, -698849.896319);
    expect(r.recoveryMonthFromStart).toBeNull();
  });
});

describe("ROI engine — boundaries (month-end cash model)", () => {
  it("C=1200 B=1200 D=0 H=1 r=0 => ROI 0, NPV 0, recovery at month 12 exactly", () => {
    const r = computeRoi({ projectCost: 1200, annualNetBenefit: 1200, implementationMonths: 0, analysisHorizonYears: 1, annualDiscountRatePercent: 0 });
    roi(r.cumulativeRoiPercent, 0);
    money(r.npv, 0);
    expect(r.npvClass).toBe("zero");
    expect(r.recoveryMonthFromStart).toBe(12);
  });
  it("C=1050 B=1200 D=0 H=1 r=0 => recovery at month 11 (not 10.5)", () => {
    const r = computeRoi({ projectCost: 1050, annualNetBenefit: 1200, implementationMonths: 0, analysisHorizonYears: 1, annualDiscountRatePercent: 0 });
    expect(r.recoveryMonthFromStart).toBe(11);
  });
  it("no benefit at month D; first benefit at month D+1", () => {
    const r = run();
    expect(r.cashFlows[12]).toBe(0);
    expect(r.cashFlows[13]).toBeGreaterThan(0);
    expect(r.cashFlows[13]).toBe(400_000 / 12);
  });
});

describe("ROI engine — properties", () => {
  it("raising the discount rate lowers NPV but leaves ROI and payback unchanged", () => {
    const low = run({ annualDiscountRatePercent: 5 });
    const high = run({ annualDiscountRatePercent: 15 });
    expect(high.npv).toBeLessThan(low.npv);
    roi(high.cumulativeRoiPercent, low.cumulativeRoiPercent);
    expect(high.recoveryMonthFromStart).toBe(low.recoveryMonthFromStart);
  });
  it("delaying implementation reduces operating benefits and NPV (fixed horizon)", () => {
    const early = run({ implementationMonths: 6 });
    const late = run({ implementationMonths: 24 });
    expect(late.totalNetOperatingBenefits).toBeLessThan(early.totalNetOperatingBenefits);
    expect(late.npv).toBeLessThan(early.npv);
  });
  it("extending the horizon increases operating benefits and NPV", () => {
    const short = run({ analysisHorizonYears: 3 });
    const long = run({ analysisHorizonYears: 7 });
    expect(long.totalNetOperatingBenefits).toBeGreaterThan(short.totalNetOperatingBenefits);
    expect(long.npv).toBeGreaterThan(short.npv);
  });
  it("scaling C and B by the same positive factor keeps ROI/payback and scales NPV", () => {
    const b = run();
    const s = run({ projectCost: 3_000_000, annualNetBenefit: 1_200_000 });
    roi(s.cumulativeRoiPercent, b.cumulativeRoiPercent);
    expect(s.recoveryMonthFromStart).toBe(b.recoveryMonthFromStart);
    money(s.npv, b.npv * 3);
  });
  it("at r=0, NPV equals net cash benefit", () => {
    const r = run({ annualDiscountRatePercent: 0 });
    money(r.npv, r.netCashBenefit);
  });
  it("recovery beyond the horizon is reported as null, not extrapolated", () => {
    // B just too small to recover within 5y: needs > 60 operating months.
    const r = run({ annualNetBenefit: 240_000 }); // monthly 20000, 48 months -> 960000 < 1e6
    expect(r.recoveryMonthFromStart).toBeNull();
    expect(r.netCashBenefit).toBeLessThan(0);
  });
});

describe("ROI engine — input validation and safety", () => {
  it("rejects zero or negative project cost (ROI undefined), not Infinity", () => {
    expect(() => run({ projectCost: 0 })).toThrow(RoiInputError);
    expect(() => run({ projectCost: -5 })).toThrow(RoiInputError);
  });
  it("rejects NaN / non-finite inputs rather than coercing", () => {
    expect(() => run({ projectCost: NaN })).toThrow(RoiInputError);
    expect(() => run({ annualNetBenefit: Infinity })).toThrow(RoiInputError);
  });
  it("accepts zero and negative net benefit explicitly", () => {
    expect(() => run({ annualNetBenefit: 0 })).not.toThrow();
    expect(() => run({ annualNetBenefit: -50_000 })).not.toThrow();
  });
  it("requires a whole, non-negative implementation duration", () => {
    expect(() => run({ implementationMonths: 8.5 })).toThrow(RoiInputError);
    expect(() => run({ implementationMonths: -1 })).toThrow(RoiInputError);
    expect(() => run({ implementationMonths: 0 })).not.toThrow();
  });
  it("rejects a negative discount rate in this tool", () => {
    expect(() => run({ annualDiscountRatePercent: -1 })).toThrow(RoiInputError);
  });
  it("exposes the supported horizon options", () => {
    expect(ROI_HORIZON_YEARS).toEqual([3, 5, 7, 10]);
  });
});

describe("ROI engine — UI wiring contract (values from fields to engine)", () => {
  // Mirrors how ROICalculator maps string inputs -> Number -> engine, and the
  // single 10 -> 10% conversion (percent passed as-is, divided by 100 once).
  it("string fields map to a correct base result; 10 becomes 10% exactly once", () => {
    const fromFields = computeRoi({
      projectCost: Number("1000000"),
      annualNetBenefit: Number("400000"),
      implementationMonths: Number("12"),
      analysisHorizonYears: Number("5"),
      annualDiscountRatePercent: Number("10"),
      startDate: new Date(Date.UTC(2026, 8, 8)),
    });
    money(fromFields.npv, 204600.414724);
    roi(fromFields.cumulativeRoiPercent, 60);
    // A double conversion (0.10%) would give an almost-undiscounted NPV ~ net.
    expect(Math.abs(fromFields.npv - fromFields.netCashBenefit)).toBeGreaterThan(100000);
  });
  it("empty mandatory field becomes NaN via Number('') path guard, and is rejected", () => {
    // Number("") === 0, but the component blocks empty via canCalc; a stray NaN
    // (e.g. Number("abc")) must be rejected by the engine, never coerced.
    expect(() => computeRoi({ ...BASE, projectCost: Number("abc") })).toThrow(RoiInputError);
  });
});

describe("addCalendarMonths", () => {
  it("adds months with day clamping and leap handling", () => {
    expect(addCalendarMonths(new Date(Date.UTC(2026, 8, 8)), 42).toISOString().slice(0, 10)).toBe("2030-03-08");
    expect(addCalendarMonths(new Date(Date.UTC(2026, 0, 31)), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addCalendarMonths(new Date(Date.UTC(2024, 0, 31)), 1).toISOString().slice(0, 10)).toBe("2024-02-29");
  });
});
