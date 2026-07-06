import { useState } from "react";
import { useT } from "../theme.js";

// ============================================================================
//  COST CALCULATOR — modal accessible from the sidebar
// ============================================================================
//  Lets the user total the cost of a project (or a scope of activities) by
//  entering rows of <activity · duration · unit · level>. Each row's cost is
//  computed as: (duration in hours) × (rate for the level), and the grand
//  total is shown at the bottom. Nothing is persisted — this is a scratch
//  pad for planning conversations, not a data-entry surface.
// ============================================================================

// Rates in SAR per hour. Edit here to update — the calculator picks up the
// new numbers on next render. Keep the four keys exactly as-is unless you
// also update the select options below.
const RATES = {
  "Junior":                 45.45,
  "Professional/Supervisor": 102.27,
  "Management":             198.86,
  "Leadership":             340.91,
};

const HOURS_PER_DAY = 8;

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const newRow = () => ({
  id: Math.random().toString(36).slice(2, 8),
  activity: "",
  amount: "",
  unit: "Hours",
  level: "Management",
});

const CostCalculator = ({ onClose }) => {
  const T = useT();
  const [rows, setRows] = useState([newRow()]);

  const rowHours = (r) => {
    const amt = Number(r.amount) || 0;
    return r.unit === "Days" ? amt * HOURS_PER_DAY : amt;
  };
  const rowCost = (r) => rowHours(r) * (RATES[r.level] || 0);

  const totalCost  = rows.reduce((s, r) => s + rowCost(r), 0);
  const totalHours = rows.reduce((s, r) => s + rowHours(r), 0);

  const updateRow = (id, patch) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows(rs => (rs.length > 1 ? rs.filter(r => r.id !== id) : rs));
  const addRow    = () => setRows(rs => [...rs, newRow()]);
  const reset     = () => setRows([newRow()]);

  const inputStyle = {
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 11px",
    fontSize: 13,
    background: T.inputBg,
    color: T.inputText,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    colorScheme: "light",
  };
  const labelStyle = {
    fontSize: 10, fontWeight: 700, color: T.muted,
    letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 4,
    display: "block",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,31,26,0.55)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 20px", overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: 16, maxWidth: 960, width: "100%",
          overflow: "hidden", boxShadow: "0 20px 80px rgba(0,0,0,0.4)",
        }}
      >
        {/* Hero */}
        <div style={{
          background:
            "radial-gradient(circle at 85% 50%, rgba(0,255,179,0.12) 0%, transparent 50%), " +
            "linear-gradient(135deg, #001f1a 0%, #003932 60%, #006b56 100%)",
          color: "white", padding: "18px 24px", borderBottom: "3px solid #00FFB3",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 4 }}>
              Planning Tool
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: "white", letterSpacing: "-0.3px", margin: 0 }}>
              Cost Calculator
            </h2>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, marginTop: 3 }}>
              Add activities, choose the role, and get a total effort cost. Rates in SAR/hour.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", width: 32, height: 32, borderRadius: 8, fontSize: 16, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Table body */}
        <div style={{ padding: "20px 24px" }}>
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 2.2fr) 90px 100px minmax(180px, 1.8fr) 110px 32px",
            gap: 10, alignItems: "end",
            paddingBottom: 8, marginBottom: 6,
          }}>
            <span style={labelStyle}>Activity</span>
            <span style={labelStyle}>Amount</span>
            <span style={labelStyle}>Unit</span>
            <span style={labelStyle}>Level</span>
            <span style={{ ...labelStyle, textAlign: "right" }}>Row total (SAR)</span>
            <span />
          </div>

          {rows.map((r) => (
            <div key={r.id} style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 2.2fr) 90px 100px minmax(180px, 1.8fr) 110px 32px",
              gap: 10, alignItems: "center", marginBottom: 8,
            }}>
              <input
                type="text"
                placeholder="e.g. Requirements gathering"
                value={r.activity}
                onChange={(e) => updateRow(r.id, { activity: e.target.value })}
                style={inputStyle}
              />
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={r.amount}
                onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                style={{ ...inputStyle, textAlign: "right", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
              />
              <select
                value={r.unit}
                onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                style={inputStyle}
              >
                <option value="Hours">Hours</option>
                <option value="Days">Days</option>
              </select>
              <select
                value={r.level}
                onChange={(e) => updateRow(r.id, { level: e.target.value })}
                style={inputStyle}
              >
                {/* Rates are intentionally NOT shown in the dropdown — the
                    calculator is often opened next to other people during
                    planning conversations and rate/salary bands are
                    confidential. Rates still live in the RATES map above
                    and drive the row total; they're just not surfaced in UI. */}
                {Object.keys(RATES).map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
              <div style={{
                textAlign: "right", fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 13, fontWeight: 700, color: T.text,
                fontFeatureSettings: '"tnum"',
              }}>
                {fmt(rowCost(r))}
              </div>
              <button
                onClick={() => removeRow(r.id)}
                disabled={rows.length === 1}
                title={rows.length === 1 ? "Keep at least one row" : "Remove row"}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: `1px solid ${T.border}`, background: T.surface,
                  color: rows.length === 1 ? T.muted : "#dc2626",
                  cursor: rows.length === 1 ? "not-allowed" : "pointer",
                  fontSize: 15, fontWeight: 700,
                  opacity: rows.length === 1 ? 0.4 : 1,
                }}
              >×</button>
            </div>
          ))}

          {/* Add row */}
          <button onClick={addRow} style={{
            marginTop: 6, width: "100%",
            padding: "10px", borderRadius: 8,
            border: `1px dashed ${T.border}`, background: "transparent",
            color: T.muted, cursor: "pointer", fontSize: 12, fontWeight: 600,
            transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
          >
            + Add activity
          </button>
        </div>

        {/* Grand total footer */}
        <div style={{
          background:
            "radial-gradient(circle at 85% 50%, rgba(0,255,179,0.10) 0%, transparent 50%), " +
            "linear-gradient(135deg, #001f1a 0%, #003932 100%)",
          color: "white", padding: "18px 24px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          gap: 20, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 4 }}>
              Grand total
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "white", letterSpacing: "-0.8px", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontFeatureSettings: '"tnum"' }}>
              {fmt(totalCost)} <span style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginLeft: 4 }}>SAR</span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              {fmt(totalHours)} total hours · {rows.length} activit{rows.length === 1 ? "y" : "ies"}
            </div>
          </div>
          <button onClick={reset} style={{
            padding: "10px 18px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>Reset</button>
        </div>
      </div>
    </div>
  );
};

export default CostCalculator;
