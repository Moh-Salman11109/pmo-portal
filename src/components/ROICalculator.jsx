import { useState } from "react";
import { useT } from "../theme.js";

// ============================================================================
//  ROI CALCULATOR — modal accessible from the What-If hub
// ============================================================================
//  Answers: "Is this project worth doing?" — the question every steering
//  committee eventually asks. Takes the project cost, the expected annual
//  benefit, the implementation duration, and a horizon; returns payback
//  period, cumulative ROI, NPV (discounted), and a break-even date.
//  Nothing is persisted; this is a planning-conversation tool.
// ============================================================================

// Discount rate for NPV. 8% is a reasonable default for internal-return
// analysis at a Saudi insurer; adjust here if PMO adopts a different WACC.
const DEFAULT_DISCOUNT = 0.08;

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// NPV of an annuity — sum of discounted annual cash flows over `years`.
const npv = (annual, years, rate) => {
  let s = 0;
  for (let y = 1; y <= years; y++) s += annual / Math.pow(1 + rate, y);
  return s;
};

// Add months to a Date, preserving day-of-month as best as possible.
const addMonths = (date, months) => {
  const d = new Date(date);
  const target = d.getMonth() + months;
  d.setMonth(target);
  return d;
};
const fmtDate = (d) =>
  d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const ROICalculator = ({ onClose, onBack }) => {
  const T = useT();

  const [totalCost,      setTotalCost]      = useState("");
  const [annualBenefit,  setAnnualBenefit]  = useState("");
  const [durationMonths, setDurationMonths] = useState("");
  const [horizonYears,   setHorizonYears]   = useState("5");
  const [discount,       setDiscount]       = useState((DEFAULT_DISCOUNT * 100).toString());
  const [result,         setResult]         = useState(null);
  const [error,          setError]          = useState("");

  const canCalc = totalCost !== "" && annualBenefit !== "" && durationMonths !== "";

  const calculate = () => {
    const cost   = Number(totalCost);
    const benA   = Number(annualBenefit);
    const dur    = Number(durationMonths);
    const yrs    = Number(horizonYears);
    const rate   = Number(discount) / 100;

    if (!canCalc || [cost, benA, dur, yrs, rate].some(n => isNaN(n))) {
      setError("Fill in the numeric fields above.");
      return;
    }
    if (cost <= 0 || benA <= 0 || dur < 0 || yrs <= 0) {
      setError("Cost, benefit, and horizon must be positive; duration cannot be negative.");
      return;
    }
    setError("");

    // Simple payback (in months) starts counting AFTER implementation.
    const monthlyBenefit = benA / 12;
    const paybackMonths  = monthlyBenefit > 0 ? cost / monthlyBenefit : Infinity;
    const totalMonthsToBreakEven = dur + paybackMonths;
    const breakEvenDate  = addMonths(new Date(), totalMonthsToBreakEven);

    // Cumulative ROI: benefits earned over `yrs` (after implementation),
    // MINUS total cost, ÷ total cost. Undiscounted, expressed as %.
    const yearsOfBenefit = Math.max(0, yrs - (dur / 12));
    const totalBenefit   = benA * yearsOfBenefit;
    const roiPct         = ((totalBenefit - cost) / cost) * 100;

    // NPV: discounted stream of annual benefits over horizon MINUS cost.
    // Simplification: treats benefit as if it starts year 1 (small bias for
    // long implementations; acceptable for planning-grade estimates).
    const npvVal = npv(benA, yearsOfBenefit, rate) - cost;

    // Verdict — simple bands. PMO can override in real committee discussion.
    let verdict = "Marginal";
    let verdictColor = "#d97706";
    if (paybackMonths <= 24 && roiPct >= 100) { verdict = "Strong"; verdictColor = "#059669"; }
    else if (paybackMonths <= 36 && roiPct >= 50) { verdict = "Acceptable"; verdictColor = "#059669"; }
    else if (paybackMonths > 60 || roiPct < 0) { verdict = "Weak"; verdictColor = "#dc2626"; }

    setResult({
      paybackMonths, totalMonthsToBreakEven, breakEvenDate,
      roiPct, totalBenefit, npvVal, verdict, verdictColor,
      cost, benA, dur, yrs, rate,
    });
  };

  const reset = () => {
    setTotalCost(""); setAnnualBenefit(""); setDurationMonths("");
    setHorizonYears("5"); setDiscount((DEFAULT_DISCOUNT * 100).toString());
    setResult(null); setError("");
  };

  const inputStyle = {
    border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 11px",
    fontSize: 13, background: T.inputBg, color: T.inputText, outline: "none",
    width: "100%", boxSizing: "border-box", colorScheme: "light",
  };
  const field = (label, child, hint = null) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.3px", textTransform: "uppercase" }}>{label}</label>
      {child}
      {hint && <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{hint}</span>}
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,31,26,0.55)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 20px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.surface, borderRadius: 16, maxWidth: 880, width: "100%",
        overflow: "hidden", boxShadow: "0 20px 80px rgba(0,0,0,0.4)",
      }}>
        {/* Hero */}
        <div style={{
          background:
            "radial-gradient(circle at 85% 50%, rgba(0,255,179,0.12) 0%, transparent 50%), " +
            "linear-gradient(135deg, #001f1a 0%, #003932 60%, #006b56 100%)",
          color: "white", padding: "18px 24px", borderBottom: "3px solid #00FFB3",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {onBack && (
              <button onClick={onBack} title="Back to What-If tools" style={{
                background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.2)",
                color: "white", width: 32, height: 32, borderRadius: 8, fontSize: 15,
                cursor: "pointer", display: "grid", placeItems: "center",
              }}>←</button>
            )}
            <div>
              <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 4 }}>
                What-If Tool
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: "white", letterSpacing: "-0.3px", margin: 0 }}>
                ROI Calculator
              </h2>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, marginTop: 3 }}>
                Payback period, cumulative ROI, and NPV. Answer "is this project worth doing?".
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", width: 32, height: 32, borderRadius: 8, fontSize: 16, cursor: "pointer",
          }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr" }}>
          {/* Inputs */}
          <div style={{ padding: "22px 24px", borderRight: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12 }}>
              Financials
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {field("Total project cost (SAR)",
                <input type="number" min="0" placeholder="3,000,000" value={totalCost}
                       onChange={e => setTotalCost(e.target.value)} style={inputStyle} />,
                "One-time delivery cost"
              )}
              {field("Expected annual benefit (SAR)",
                <input type="number" min="0" placeholder="1,800,000" value={annualBenefit}
                       onChange={e => setAnnualBenefit(e.target.value)} style={inputStyle} />,
                "Recurring saving or revenue per year"
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", margin: "18px 0 12px" }}>
              Timing
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {field("Implementation duration (months)",
                <input type="number" min="0" placeholder="8" value={durationMonths}
                       onChange={e => setDurationMonths(e.target.value)} style={inputStyle} />,
                "Before benefits begin"
              )}
              {field("Analysis horizon (years)",
                <select value={horizonYears} onChange={e => setHorizonYears(e.target.value)} style={inputStyle}>
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="7">7 years</option>
                  <option value="10">10 years</option>
                </select>,
                "Post-launch benefit window"
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
              {field("Discount rate (%) for NPV",
                <input type="number" min="0" max="100" step="0.5" value={discount}
                       onChange={e => setDiscount(e.target.value)} style={inputStyle} />,
                "Default 8% (Tree internal rate)"
              )}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: "9px 12px", background: "#fef2f0", border: "1px solid #f5d4d0", borderRadius: 8, color: "#991b1b", fontSize: 12, fontWeight: 600 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={calculate} disabled={!canCalc} style={{
                flex: 1, padding: "12px 18px",
                background: canCalc ? T.primary : T.border,
                color: canCalc ? T.accent : T.muted,
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 800, letterSpacing: "0.3px",
                cursor: canCalc ? "pointer" : "not-allowed",
              }}>
                Calculate ROI →
              </button>
              <button onClick={reset} style={{
                padding: "12px 18px", background: "transparent", color: T.muted,
                border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Reset</button>
            </div>
          </div>

          {/* Results */}
          <div style={{ padding: "22px 24px", background: T.bg, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Result
            </div>

            {!result ? (
              <div style={{
                flex: 1, padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13,
                border: `2px dashed ${T.border}`, borderRadius: 12,
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, minHeight: 320,
              }}>
                <div style={{ fontSize: 32, opacity: 0.4 }}>📊</div>
                <div style={{ fontWeight: 600, color: T.text }}>Awaiting input</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Enter cost, expected annual benefit, and duration, then press
                  <strong style={{ color: T.primary }}> Calculate ROI</strong>.
                </div>
              </div>
            ) : (
              <>
                {/* Verdict banner */}
                <div style={{
                  background: "linear-gradient(135deg, #001f1a 0%, #003932 100%)",
                  color: "white", borderRadius: 12, padding: "16px 20px",
                  borderBottom: `3px solid ${result.verdictColor}`,
                }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Verdict</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: result.verdictColor, letterSpacing: "-0.5px", lineHeight: 1 }}>
                    {result.verdict}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
                    Based on payback ≤ 24m + ROI ≥ 100% (Strong)
                  </div>
                </div>

                {/* Key metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>Payback</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.paybackMonths.toFixed(0)}m
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>After launch</div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>ROI ({result.yrs}-yr)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: result.roiPct >= 0 ? "#059669" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.roiPct >= 0 ? "+" : ""}{result.roiPct.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Undiscounted</div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>NPV @ {(result.rate * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: result.npvVal >= 0 ? "#059669" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.npvVal >= 0 ? "+" : ""}{fmt(result.npvVal)}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>SAR (present value)</div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>Break-even</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {fmtDate(result.breakEvenDate)}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{result.totalMonthsToBreakEven.toFixed(0)}m from today</div>
                  </div>
                </div>

                {/* Math trace */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
                  <div style={{ fontFamily: "inherit", fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>Calculation</div>
                  <div style={{ color: T.text }}>
                    Payback = {fmt(result.cost)} ÷ ({fmt(result.benA)} ÷ 12) = {result.paybackMonths.toFixed(1)} months<br/>
                    Total benefit ({result.yrs}y − {(result.dur/12).toFixed(1)}y impl) = {fmt(result.totalBenefit)} SAR<br/>
                    ROI = ({fmt(result.totalBenefit)} − {fmt(result.cost)}) ÷ {fmt(result.cost)} = {result.roiPct.toFixed(1)}%<br/>
                    NPV = Σ(annual ÷ (1+{(result.rate*100).toFixed(1)}%)^y) − cost = {fmt(result.npvVal)} SAR
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
