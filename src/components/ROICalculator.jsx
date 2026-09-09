import { useState } from "react";
import { useT } from "../theme.js";
import { Ico } from "./Icon.jsx";
import { computeRoi } from "../utils/roi.js";

// ============================================================================
//  ROI CALCULATOR — modal accessible from the What-If hub
// ============================================================================
//  Answers: "Is this project worth doing?" — the question every steering
//  committee eventually asks. Takes the project cost, the expected annual
//  benefit, the implementation duration, and a horizon; returns payback
//  period, cumulative ROI, NPV (discounted), and a break-even date.
//  Nothing is persisted; this is a planning-conversation tool.
// ============================================================================

// Discount rate default for NPV. 8% is used as an initial placeholder only;
// the field is editable at runtime and the intended rate is a decision for
// PMO/CFO to set explicitly rather than something the tool prescribes.
const DEFAULT_DISCOUNT = 0.08;

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmt2 = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Money/percentage math lives in ../utils/roi.js (pure, tested). This component
// only collects inputs, calls computeRoi once, and formats the result.
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
  // A shown result belongs to the inputs it was computed from. When any input
  // changes we flag it stale rather than silently presenting old numbers.
  const [stale,          setStale]          = useState(false);

  // Mandatory fields must be non-empty. We distinguish empty from 0: an empty
  // field blocks Calculate; an explicit 0 (or negative) flows to the engine,
  // which validates it. We never coerce "" into a default via `|| default`.
  const canCalc = totalCost !== "" && annualBenefit !== "" && durationMonths !== "";
  const touch = (setter) => (value) => { setter(value); if (result) setStale(true); };

  const calculate = () => {
    try {
      // The engine is the single source of truth. The discount percentage is
      // passed as-is (e.g. 10) and divided by 100 exactly once inside it.
      // startDate is captured now and frozen into the result so re-renders do
      // not move the break-even date.
      const r = computeRoi({
        projectCost: Number(totalCost),
        annualNetBenefit: Number(annualBenefit),
        implementationMonths: Number(durationMonths),
        analysisHorizonYears: Number(horizonYears),
        annualDiscountRatePercent: Number(discount),
        startDate: new Date(),
      });
      setError("");
      setResult(r);
      setStale(false);
    } catch (e) {
      setResult(null);
      setStale(false);
      setError(e && e.message ? e.message : "Check the inputs and try again.");
    }
  };

  const reset = () => {
    setTotalCost(""); setAnnualBenefit(""); setDurationMonths("");
    setHorizonYears("5"); setDiscount((DEFAULT_DISCOUNT * 100).toString());
    setResult(null); setError(""); setStale(false);
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
                       onChange={e => touch(setTotalCost)(e.target.value)} style={inputStyle} />,
                "One-time delivery cost, paid at project start"
              )}
              {field("Expected Annual Net Cash Benefit (SAR)",
                <input type="number" placeholder="1,800,000" value={annualBenefit}
                       onChange={e => touch(setAnnualBenefit)(e.target.value)} style={inputStyle} />,
                "Incremental annual cash inflow or savings after recurring cash costs. Excludes the initial project investment, which is entered separately."
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", margin: "18px 0 12px" }}>
              Timing
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {field("Implementation duration (months)",
                <input type="number" min="0" step="1" placeholder="8" value={durationMonths}
                       onChange={e => touch(setDurationMonths)(e.target.value)} style={inputStyle} />,
                "Whole months before benefits begin"
              )}
              {field("Analysis horizon (years)",
                <select value={horizonYears} onChange={e => touch(setHorizonYears)(e.target.value)} style={inputStyle}>
                  <option value="3">3 years</option>
                  <option value="5">5 years</option>
                  <option value="7">7 years</option>
                  <option value="10">10 years</option>
                </select>,
                "Total analysis period from project start, including implementation."
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 12 }}>
              {field("Discount rate (%) for NPV",
                <input type="number" min="0" max="100" step="0.5" value={discount}
                       onChange={e => touch(setDiscount)(e.target.value)} style={inputStyle} />,
                "Effective annual rate. Default 8%"
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
                <div style={{ opacity: 0.4, display: "flex", justifyContent: "center" }}><Ico name="trend" size={30} /></div>
                <div style={{ fontWeight: 600, color: T.text }}>Awaiting input</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Enter cost, expected annual benefit, and duration, then press
                  <strong style={{ color: T.primary }}> Calculate ROI</strong>.
                </div>
              </div>
            ) : (
              <>
                {stale && (
                  <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, color: "#92400e", fontSize: 11.5, fontWeight: 600 }}>
                    Inputs changed — press Calculate ROI to refresh these results.
                  </div>
                )}

                {/* NPV classification — descriptive, not an investment approval */}
                {(() => {
                  const npvLabel = result.npvClass === "positive" ? "Positive NPV" : result.npvClass === "negative" ? "Negative NPV" : "Approximately zero NPV";
                  const npvColor = result.npvClass === "positive" ? "#059669" : result.npvClass === "negative" ? "#dc2626" : "#d97706";
                  return (
                    <div style={{
                      background: "linear-gradient(135deg, #001f1a 0%, #003932 100%)",
                      color: "white", borderRadius: 12, padding: "16px 20px",
                      borderBottom: `3px solid ${npvColor}`,
                    }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Result</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: npvColor, letterSpacing: "-0.5px", lineHeight: 1 }}>
                        {npvLabel}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
                        Financial estimate under the stated assumptions. Not an investment approval.
                      </div>
                    </div>
                  );
                })()}

                {!result.hasOperatingWindow && (
                  <div style={{ padding: "8px 12px", background: "#fef2f0", border: "1px solid #f5d4d0", borderRadius: 8, color: "#991b1b", fontSize: 11.5, fontWeight: 600 }}>
                    Implementation ≥ horizon: there is no operating period inside the analysis window.
                  </div>
                )}

                {/* Key metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>Payback</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.recovered ? `${result.paybackAfterLaunchMonths}m` : "—"}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                      {result.recovered ? "After launch — month-end basis" : "Not recovered within analysis horizon"}
                    </div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>ROI ({result.inputs.analysisHorizonYears}y from start)</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: result.cumulativeRoiPercent >= 0 ? "#059669" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.cumulativeRoiPercent >= 0 ? "+" : ""}{result.cumulativeRoiPercent.toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Cumulative · undiscounted</div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>NPV @ {result.inputs.annualDiscountRatePercent}%</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: result.npv >= 0 ? "#059669" : "#dc2626", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.npv >= 0 ? "+" : ""}{fmt(result.npv)}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>SAR · present value</div>
                  </div>
                  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase" }}>Break-even</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px", marginTop: 3 }}>
                      {result.breakEvenDate ? fmtDate(result.breakEvenDate) : "—"}
                    </div>
                    <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                      {result.breakEvenDate ? `Undiscounted · ${result.recoveryMonthFromStart}m from project start` : "Not reached within analysis horizon"}
                    </div>
                  </div>
                </div>

                {/* Assumptions */}
                <details style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 14px" }}>
                  <summary style={{ cursor: "pointer", fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: "0.3px", textTransform: "uppercase" }}>Assumptions</summary>
                  <ul style={{ margin: "8px 0 2px", paddingInlineStart: 16, color: T.muted, fontSize: 11, lineHeight: 1.7 }}>
                    <li>All initial investment is paid at project start.</li>
                    <li>Net operating cash flows are constant and received at each monthly period end after implementation.</li>
                    <li>The analysis horizon includes implementation.</li>
                    <li>The discount rate is effective annual.</li>
                    <li>ROI and payback are undiscounted.</li>
                    <li>No separate tax, inflation, growth, working-capital, or residual-value modeling.</li>
                  </ul>
                </details>

                {/* Math trace — generated from the calculation result */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
                  <div style={{ fontFamily: "inherit", fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>Calculation</div>
                  <div style={{ color: T.text }}>
                    Operating months = max(0, {result.horizonMonths} − {result.inputs.implementationMonths}) = {result.operatingMonths}<br/>
                    Total net operating benefits = ({fmt(result.inputs.annualNetBenefit)} ÷ 12) × {result.operatingMonths} = {fmt(result.totalNetOperatingBenefits)}<br/>
                    Net cash benefit = {fmt(result.totalNetOperatingBenefits)} − {fmt(result.inputs.projectCost)} = {fmt(result.netCashBenefit)}<br/>
                    Cumulative ROI = {fmt(result.netCashBenefit)} ÷ {fmt(result.inputs.projectCost)} × 100 = {result.cumulativeRoiPercent.toFixed(1)}%<br/>
                    NPV = −{fmt(result.inputs.projectCost)} + Σ(({fmt(result.inputs.annualNetBenefit)} ÷ 12) ÷ (1+{result.inputs.annualDiscountRatePercent}%)^(m/12), m={result.inputs.implementationMonths + 1}..{result.horizonMonths}) = {fmt(result.npv)}
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
