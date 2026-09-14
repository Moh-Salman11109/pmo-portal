// ============================================================================
//  ROI engine — the single source of truth for the ROI Calculator.
//  Pure: no React, no DOM, no clock (startDate is injected). The UI in
//  components/ROICalculator.jsx formats these numbers; it never re-derives them.
//
//  Monthly cash-flow model (a deliberate assumption of THIS tool):
//    - Investment C is paid once at project start (month 0).
//    - No operating benefit during implementation (months 1..D are 0).
//    - First operating month is D+1; flows run through month N = H*12.
//    - The analysis horizon starts at project start and INCLUDES implementation.
//    - NPV discounts each monthly flow at (1+r)^(m/12); r=0 => undiscounted net.
//    - ROI is cumulative simple ROI on the initial investment (undiscounted).
//    - Payback is the first month the undiscounted cumulative balance >= 0
//      (month-end basis; a 10.5-month recovery shows at month 11).
//  See roi.test.js for the acceptance table and property tests.
// ============================================================================

export const ROI_HORIZON_YEARS = [3, 5, 7, 10];
const MAX_TABLE_MONTHS = 1200; // resource guard only, not a business rule

export class RoiInputError extends Error {
  constructor(field, message) { super(message); this.name = "RoiInputError"; this.field = field; }
}

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

// Add whole calendar months, clamping the day to the target month (leap-safe).
export function addCalendarMonths(start, months) {
  const y = start.getUTCFullYear(), m = start.getUTCMonth(), d = start.getUTCDate();
  const target = m + months;
  const ty = y + Math.floor(target / 12);
  const tm = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, lastDay)));
}

export function computeRoi(input) {
  const {
    projectCost, annualNetBenefit, implementationMonths,
    analysisHorizonYears, annualDiscountRatePercent, startDate = null,
  } = input || {};

  if (!isFiniteNumber(projectCost) || projectCost <= 0)
    throw new RoiInputError("projectCost", "Total project cost must be a number greater than zero.");
  if (!isFiniteNumber(annualNetBenefit)) // zero and negative are valid
    throw new RoiInputError("annualNetBenefit", "Expected annual net cash benefit must be a number.");
  if (!Number.isInteger(implementationMonths) || implementationMonths < 0)
    throw new RoiInputError("implementationMonths", "Implementation duration must be a whole number of months (0 or more).");
  if (!Number.isInteger(analysisHorizonYears) || analysisHorizonYears <= 0)
    throw new RoiInputError("analysisHorizonYears", "Analysis horizon must be a positive whole number of years.");
  if (!isFiniteNumber(annualDiscountRatePercent) || annualDiscountRatePercent < 0)
    throw new RoiInputError("annualDiscountRatePercent", "Discount rate must be a finite, non-negative percentage.");

  const C = projectCost, B = annualNetBenefit, D = implementationMonths;
  const N = analysisHorizonYears * 12;
  if (N > MAX_TABLE_MONTHS) throw new RoiInputError("analysisHorizonYears", "Analysis horizon exceeds the supported table size.");
  const r = annualDiscountRatePercent / 100;
  const monthlyNetBenefit = B / 12;
  const operatingMonths = Math.max(0, N - D);

  // Single cash-flow table CF[0..N]; every figure below derives from it.
  const cashFlows = new Array(N + 1);
  cashFlows[0] = -C;
  for (let m = 1; m <= N; m++) cashFlows[m] = m > D ? monthlyNetBenefit : 0;

  const totalNetOperatingBenefits = monthlyNetBenefit * operatingMonths;
  const netCashBenefit = totalNetOperatingBenefits - C;
  const cumulativeRoiPercent = (netCashBenefit / C) * 100;

  let npv = -C;
  for (let m = 1; m <= N; m++) {
    if (cashFlows[m] === 0) continue;
    npv += cashFlows[m] / Math.pow(1 + r, m / 12);
  }

  const EPS = 1e-6; // guards float dust only; far below any real currency value
  let recoveryMonthFromStart = null, cumulative = cashFlows[0];
  for (let m = 1; m <= N; m++) {
    cumulative += cashFlows[m];
    if (cumulative >= -EPS) { recoveryMonthFromStart = m; break; }
  }
  const paybackAfterLaunchMonths = recoveryMonthFromStart == null ? null : recoveryMonthFromStart - D;

  let breakEvenDate = null;
  if (recoveryMonthFromStart != null && startDate != null) {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    if (Number.isFinite(start.getTime())) breakEvenDate = addCalendarMonths(start, recoveryMonthFromStart);
  }

  return {
    inputs: { projectCost: C, annualNetBenefit: B, implementationMonths: D, analysisHorizonYears, annualDiscountRatePercent, startDate: startDate ?? null },
    horizonMonths: N,
    operatingMonths,
    monthlyNetBenefit,
    totalNetOperatingBenefits,
    netCashBenefit,
    cumulativeRoiPercent,
    npv,
    npvClass: Math.abs(npv) < 0.005 ? "zero" : npv > 0 ? "positive" : "negative",
    recoveryMonthFromStart,
    paybackAfterLaunchMonths,
    breakEvenDate,
    recovered: recoveryMonthFromStart != null,
    hasOperatingWindow: operatingMonths > 0,
    cashFlows,
  };
}
