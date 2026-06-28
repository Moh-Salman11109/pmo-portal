import React, { useState, useMemo } from "react";
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

  // ── Inputs ────────────────────────────────────────────────────
  const [startDate, setStartDate]             = useState("2026-04-04");
  const [plannedEnd, setPlannedEnd]           = useState("2026-07-30");
  const [roadmapDeadline, setRoadmapDeadline] = useState("2026-08-30");
  const [asOfDate, setAsOfDate]               = useState(todayISO());
  const [progress, setProgress]               = useState(100);
  const [budget, setBudget]                   = useState("");
  const [actualCost, setActualCost]           = useState("");
  const [currentGate, setCurrentGate]         = useState("Gate 4");
  const [requiredDocs, setRequiredDocs]       = useState("");
  const [approvedDocs, setApprovedDocs]       = useState("");

  // ── Compute IPI ───────────────────────────────────────────────
  const result = useMemo(() => {
    const gateNum = parseInt(currentGate.replace("Gate ", ""), 10) || 1;

    // Build a synthetic project object the engine understands.
    const project = {
      startDate, plannedEnd,
      roadmapDeadline: roadmapDeadline || null,
      progress: Number(progress) || 0,
      budget:     Number(budget) || 0,
      actualCost: Number(actualCost) || 0,
      gate: currentGate,
      milestones: [],
      documents: [],
    };

    // If user supplied docs counts, build a representative documents array
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

    return calcProjectIPIFull(project, asOfDate || TODAY);
  }, [startDate, plannedEnd, roadmapDeadline, asOfDate, progress, budget, actualCost, currentGate, requiredDocs, approvedDocs]);

  const band     = result.ipi != null ? ipiColor(result.ipi)     : null;
  const bandDark = result.ipi != null ? ipiColorDark(result.ipi) : null;

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
              {field("Roadmap deadline", <input type="date" value={roadmapDeadline} onChange={e => setRoadmapDeadline(e.target.value)} style={inputStyle} />, "Optional — penalty trigger")}
              {field("As-of date", <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} style={inputStyle} />, "Defaults to today")}
            </div>
            {field("Progress %",
              <input type="number" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} style={inputStyle} />,
              "0 = not started · 100 = complete"
            )}

            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase", margin: "20px 0 12px" }}>Cost (optional)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
              {field("Budget (SAR)", <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" style={inputStyle} />)}
              {field("Actual cost (SAR)", <input type="number" min="0" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0" style={inputStyle} />)}
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 4 }}>Leave empty → CPI treated as neutral (1.00)</div>

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
            <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic", marginTop: 4 }}>Leave empty → MCI treated as neutral (1.00)</div>
          </div>

          {/* ── Result column ── */}
          <div style={{ padding: "22px 24px", background: T.bg, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.primary, letterSpacing: "0.5px", textTransform: "uppercase" }}>Result</div>

            {result.ipi == null ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                Add at least a start date, a planned end and a progress value to compute the IPI.
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
                      { k: "SPI (raw)",       v: result.components.spi,      hint: "Earned ÷ Planned" },
                      { k: "Penalty",         v: result.components.penalty,  hint: "1 − days_past/100" },
                      { k: "SPI × Penalty",   v: result.components.spiFinal, hint: "Used in IPI", strong: true },
                      { k: "CPI",             v: result.components.cpi,      hint: "BCWP ÷ Actual Cost" },
                      { k: "MCI",             v: result.components.mci,      hint: "Approved ÷ Required" },
                    ].map(r => (
                      <div key={r.k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: r.strong ? "#e6f9f5" : T.surface, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: r.strong ? 800 : 700, color: T.text }}>{r.k}</span>
                          <span style={{ fontSize: 10, color: T.muted, marginLeft: 8 }}>{r.hint}</span>
                        </div>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 800, color: r.v == null ? T.muted : T.primary }}>
                          {r.v == null ? "neutral 1.00" : r.v.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Math equation */}
                <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "ui-monospace, monospace", fontSize: 11.5, lineHeight: 1.7 }}>
                  <div style={{ fontFamily: "inherit", fontSize: 10, color: T.muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>Calculation</div>
                  <div style={{ color: T.text }}>
                    IPI = 0.50 × {(result.components.spiFinal ?? 1.0).toFixed(3)}
                    {" + "}
                    0.25 × {(result.components.cpi ?? 1.0).toFixed(3)}
                    {" + "}
                    0.25 × {(result.components.mci ?? 1.0).toFixed(3)}
                  </div>
                  <div style={{ color: T.primary, fontWeight: 700, marginTop: 4 }}>
                    = {((0.5 * (result.components.spiFinal ?? 1.0) + 0.25 * (result.components.cpi ?? 1.0) + 0.25 * (result.components.mci ?? 1.0))).toFixed(4)} → <strong>{result.ipi}</strong>
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

export default IPICalculator;
