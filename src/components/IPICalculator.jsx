import { useState } from "react";
import { useT } from "../theme.js";
import { calcProjectIPIFull, ipiColor, ipiColorDark } from "../utils/metrics.js";
import { TODAY } from "../utils/dates.js";

// ============================================================================
//  IPI CALCULATOR — modal accessible from the sidebar
// ============================================================================
//  Lets the user plug in raw project parameters (dates, progress, budget,
//  documents) and get the IPI back without having to register the project in
//  SharePoint first. Internally calls the same calcProjectIPIFull function the
//  portal uses everywhere else, so what-if numbers always agree with what the
//  real portal would show once the project is created.
// ============================================================================

const todayISO = () => new Date().toISOString().split("T")[0];

const IPICalculator = ({ onClose }) => {
  const T = useT();

  // ── Inputs (start empty — user fills them in then clicks Calculate) ──
  const [startDate, setStartDate]             = useState("");
  const [plannedEnd, setPlannedEnd]           = useState("");
  const [roadmapDeadline, setRoadmapDeadline] = useState("");
  const [asOfDate, setAsOfDate]               = useState(todayISO());
  const [progress, setProgress]               = useState("");
  const [plannedProgress, setPlannedProgress] = useState("");
  const [budget, setBudget]                   = useState("");
  const [actualCost, setActualCost]           = useState("");
  const [currentGate, setCurrentGate]         = useState("Gate 4");
  const [requiredDocs, setRequiredDocs]       = useState("");
  const [approvedDocs, setApprovedDocs]       = useState("");

  // ── Result is computed ON DEMAND when the user clicks Calculate ──
  const [result, setResult] = useState(null);
  const [error, setError]   = useState("");

  const canCalculate = startDate && plannedEnd && progress !== "";

  const calculate = () => {
    if (!canCalculate) {
      setError("Fill in start date, planned end, and progress to calculate.");
      return;
    }
    // Defensive validation — guard against typed-in garbage
    const prog = Number(progress);
    const planned = plannedProgress !== "" ? Number(plannedProgress) : null;
    if (isNaN(prog) || prog < 0 || prog > 100) {
      setError("Actual progress must be between 0 and 100.");
      return;
    }
    if (planned !== null && (isNaN(planned) || planned < 0 || planned > 100)) {
      setError("Planned progress must be between 0 and 100.");
      return;
    }
    if (new Date(plannedEnd) < new Date(startDate)) {
      setError("Planned end cannot be before the start date.");
      return;
    }
    setError("");
    const gateNum = parseInt(currentGate.replace("Gate ", ""), 10) || 1;
    const project = {
      startDate, plannedEnd,
      roadmapDeadline: roadmapDeadline || null,
      progress: Number(progress) || 0,
      plannedProgress: plannedProgress !== "" ? Number(plannedProgress) : null,
      budget:     Number(budget) || 0,
      actualCost: Number(actualCost) || 0,
      gate: currentGate,
      milestones: [],
      documents: [],
    };
    const req = parseInt(requiredDocs, 10);
    const app = parseInt(approvedDocs, 10);
    if (!isNaN(req) && req > 0) {
      const approved = Math.min(app || 0, req);
      for (let i = 0; i < req; i++) {
        project.documents.push({
          name: `Doc ${i + 1}`,
          required: true,
          requiredAtGate: gateNum,
          status: i < approved ? "Approved" : "Pending",
        });
      }
    }
    setResult(calcProjectIPIFull(project, asOfDate || TODAY));
  };

  const reset = () => {
    setStartDate(""); setPlannedEnd(""); setRoadmapDeadline("");
    setAsOfDate(todayISO()); setProgress(""); setPlannedProgress("");
    setBudget(""); setActualCost("");
    setCurrentGate("Gate 4"); setRequiredDocs(""); setApprovedDocs("");
    setResult(null); setError("");
  };

  const band     = result && result.ipi != null ? ipiColor(result.ipi)     : null;
  const bandDark = result && result.ipi != null ? ipiColorDark(result.ipi) : null;

  // ── Styling helpers ───────────────────────────────────────────
  const field = (label, child, hint = null) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.3px", textTransform: "uppercase" }}>{label}</label>
      {child}
      {hint && <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{hint}</span>}
    </div>
  );
  const inputStyle = {
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 11px",
    fontSize: 13,
    background: T.inputBg,
    color: T.inputText,
    outline: "none",
    width: "100%",
    colorScheme: "light",
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,31,26,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}>

      <div onClick={e => e.stopPropagation()}
        style={{ background: T.surface, borderRadius: 16, maxWidth: 880, width: "100%", overflow: "hidden", boxShadow: "0 20px 80px rgba(0,0,0,0.4)" }}>

        {/* ── Hero strip ── */}
        <div style={{
          background:
            "radial-gradient(circle at 85% 50%, rgba(0,255,179,0.12) 0%, transparent 50%), " +
            "linear-gradient(135deg, #001f1a 0%, #003932 60%, #006b56 100%)",
          color: "white",
          padding: "18px 24px",
          borderBottom: "3px solid #00FFB3",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 4 }}>What-if Tool</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: "white", letterSpacing: "-0.3px", margin: 0 }}>IPI Calculator</h2>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, marginTop: 3 }}>Enter parameters for a project not yet registered. The same engine used across the portal.</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", width: 32, height: 32, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 0 }}>

          {/* ── Inputs column ── */}
          <div style={{ padding: "22px 24px", borderRight: `1px solid ${T.border}` }}>

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12 }}>Schedule (required)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {field("Start date", <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />)}
              {field("Planned end", <input type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} style={inputStyle} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {field("Roadmap deadline", <input type="date" value={roadmapDeadline} onChange={e => setRoadmapDeadline(e.target.value)} style={inputStyle} />, "Optional — used as SPI reference when set (strategic anchor)")}
              {field("As-of date", <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} style={inputStyle} />, "Defaults to today")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {field("Actual progress %",
                <input type="number" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} placeholder="0" style={inputStyle} />,
                "What the project has actually achieved"
              )}
              {field("Planned progress %",
                <input type="number" min="0" max="100" value={plannedProgress} onChange={e => setPlannedProgress(e.target.value)} placeholder="auto" style={inputStyle} />,
                "Leave blank → derived from dates"
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", margin: "20px 0 12px" }}>Cost (optional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              {field("Budget (SAR)", <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" style={inputStyle} />)}
              {field("Actual cost (SAR)", <input type="number" min="0" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0" style={inputStyle} />)}
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 4 }}>Leave empty → CPI excluded · IPI re-normalises across the remaining components</div>

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", margin: "20px 0 12px" }}>Artefacts (optional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 4 }}>
              {field("Current gate",
                <select value={currentGate} onChange={e => setCurrentGate(e.target.value)} style={inputStyle}>
                  {["Gate 1", "Gate 2", "Gate 3", "Gate 4", "Gate 5"].map(g => <option key={g}>{g}</option>)}
                </select>
              )}
              {field("Required docs", <input type="number" min="0" value={requiredDocs} onChange={e => setRequiredDocs(e.target.value)} placeholder="0" style={inputStyle} />)}
              {field("Approved", <input type="number" min="0" value={approvedDocs} onChange={e => setApprovedDocs(e.target.value)} placeholder="0" style={inputStyle} />)}
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 4 }}>Leave empty → MCI excluded · IPI re-normalises across the remaining components</div>

            {/* Calculate + Reset buttons */}
            {error && (
              <div style={{ marginTop: 14, padding: "9px 12px", background: "#fef2f0", border: "1px solid #f5d4d0", borderRadius: 8, color: "#991b1b", fontSize: 12, fontWeight: 600 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={calculate} disabled={!canCalculate} style={{
                flex: 1, padding: "12px 18px",
                background: canCalculate ? T.primary : T.border,
                color: canCalculate ? T.accent : T.muted,
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 800, letterSpacing: "0.3px",
                cursor: canCalculate ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}>
                Calculate IPI →
              </button>
              <button onClick={reset} style={{
                padding: "12px 18px",
                background: "transparent",
                color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                Reset
              </button>
            </div>
          </div>

          {/* ── Result column ── */}
          <div style={{ padding: "22px 24px", background: T.bg, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase" }}>Result</div>

            {!result ? (
              <div style={{ flex: 1, padding: "40px 20px", textAlign: "center", color: T.muted, fontSize: 13, border: `2px dashed ${T.border}`, borderRadius: 12, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, minHeight: 280 }}>
                <div style={{ fontSize: 32, opacity: 0.4 }}>🧮</div>
                <div style={{ fontWeight: 600, color: T.text }}>Awaiting input</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>Fill in the parameters on the left, then press <strong style={{ color: T.primary }}>Calculate IPI</strong>.</div>
              </div>
            ) : result.ipi == null ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                Not enough data to compute the IPI. Verify the dates and progress.
              </div>
            ) : (
              <>
                {/* Big number */}
                <div style={{
                  background:
                    "radial-gradient(circle at 85% 50%, rgba(0,255,179,0.10) 0%, transparent 50%), " +
                    "linear-gradient(135deg, #001f1a 0%, #003932 100%)",
                  borderRadius: 14,
                  padding: "20px 22px",
                  borderBottom: "3px solid #00FFB3",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 56, fontWeight: 900, color: "white", lineHeight: 0.9, letterSpacing: "-3px" }}>{result.ipi}</div>
                    {band && bandDark && (
                      <div style={{ background: bandDark.bg, border: `1px solid ${bandDark.border}`, color: bandDark.text, padding: "3px 11px", borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        ● {band.label}
                      </div>
                    )}
                  </div>
                  {/* Gauge */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.10)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min(100, result.ipi)}%`, background: `linear-gradient(90deg, ${bandDark.gaugeFrom}, ${bandDark.gaugeTo})`, borderRadius: 4 }} />
                      <div style={{ position: "absolute", left: "70%", top: -3, width: 1, height: 14, background: "rgba(255,255,255,0.25)" }} />
                      <div style={{ position: "absolute", left: "90%", top: -3, width: 1, height: 14, background: "rgba(255,255,255,0.25)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                      <span>0</span><span>At Risk · 70</span><span>Watch · 90</span><span>100</span>
                    </div>
                  </div>
                </div>

                {/* Components breakdown */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: "0.3px", textTransform: "uppercase", marginBottom: 8 }}>Components</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { k: "SPI (raw)",       v: result.components.spi,      hint: `Earned ÷ Planned (vs ${result.scheduleAnchor === "roadmap" ? "Roadmap" : "Planned End"})` },
                      { k: "spiFinal",        v: result.components.spiFinal, hint: "min(1.20, SPI) · used in IPI", strong: true },
                      { k: "CPI",             v: result.components.cpi,      hint: "BCWP ÷ Actual Cost" },
                      { k: "MCI",             v: result.components.mci,      hint: "Σ credit ÷ docs due at gate" },
                    ].map(r => (
                      <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: r.strong ? "#e6f9f5" : T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: r.strong ? 800 : 700, color: T.text }}>{r.k}</span>
                          <span style={{ fontSize: 10, color: T.muted, marginLeft: 8 }}>{r.hint}</span>
                        </div>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: r.v == null ? T.muted : T.primary }}>
                          {r.v == null ? "excluded" : r.v.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Math equation — re-normalised across components actually present.
                    Mirrors the engine's policy: missing inputs are excluded, not
                    treated as a neutral 1.0 (which would have rewarded withholding
                    data). The displayed weights below ALWAYS sum to 1.00. */}
                {(() => {
                  const parts = [];
                  if (result.components.spiFinal !== null) parts.push({ name: "spiFinal", w: 0.50, v: result.components.spiFinal });
                  if (result.components.cpi      !== null) parts.push({ name: "CPI",      w: 0.25, v: result.components.cpi      });
                  if (result.components.mci      !== null) parts.push({ name: "MCI",      w: 0.25, v: result.components.mci      });
                  const sumW = parts.reduce((s, p) => s + p.w, 0) || 1;
                  const isFull = parts.length === 3;
                  return (
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "ui-monospace, monospace", fontSize: 11.5, lineHeight: 1.7 }}>
                      <div style={{ fontFamily: "inherit", fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                        Calculation {isFull ? "(full set)" : `(${parts.length}/3 components · weights re-normalised)`}
                      </div>
                      {parts.length === 0 ? (
                        <div style={{ color: T.muted }}>No components present → IPI = Pending Plan</div>
                      ) : (
                        <>
                          <div style={{ color: T.text }}>
                            IPI = (
                            {parts.map((p, i) => (
                              <span key={p.name}>
                                {i > 0 ? " + " : ""}
                                {(p.w / sumW).toFixed(3)} × {p.v.toFixed(3)}
                              </span>
                            ))}
                            )
                          </div>
                          <div style={{ color: T.primary, fontWeight: 700, marginTop: 4 }}>
                            = {(parts.reduce((s, p) => s + (p.w / sumW) * p.v, 0)).toFixed(4)} → <strong>{result.ipi}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default IPICalculator;
