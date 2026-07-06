import { useT } from "../theme.js";

// ============================================================================
//  WHAT-IF PICKER — sidebar entry point for the What-If tool hub
// ============================================================================
//  A single sidebar button (`What-If Tools`) opens this picker. From here the
//  user chooses which specific scratch-pad calculator to open:
//    · IPI Calculator  — simulate a project's IPI without registering it
//    · Cost Calculator — total the cost of a set of activities
//    · ROI Calculator  — payback, break-even, and NPV for a business case
//  Each tool receives an onBack prop that returns here; onClose closes the
//  whole hub.
// ============================================================================

const TOOLS = [
  {
    key: "ipi",
    icon: "🧮",
    title: "IPI Calculator",
    subtitle: "Simulate a project's IPI score",
    body:
      "Enter start / end dates, progress, cost, and documents — see the IPI, " +
      "SPI, CPI, and MCI that would result. The same engine used across the portal.",
    tag: "Performance",
  },
  {
    key: "cost",
    icon: "💰",
    title: "Cost Calculator",
    subtitle: "Total effort cost by role",
    body:
      "Add activities, choose Junior / Professional / Management / Leadership, " +
      "enter hours or days. Row-by-row totals plus a grand total in SAR.",
    tag: "Planning",
  },
  {
    key: "roi",
    icon: "📊",
    title: "ROI Calculator",
    subtitle: "Payback, break-even, and NPV",
    body:
      "Given total cost and expected annual benefit, get payback in months, " +
      "cumulative ROI, and NPV over 3–10 years. Discounted at Tree's internal rate.",
    tag: "Business case",
  },
];

const WhatIfPicker = ({ onClose, onPick }) => {
  const T = useT();

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
          color: "white", padding: "20px 26px", borderBottom: "3px solid #00FFB3",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#00FFB3", fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 4 }}>
              Planning Hub
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-0.3px", margin: 0 }}>
              What-If Tools
            </h2>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5, marginTop: 3 }}>
              Explore scenarios without touching your data. Nothing is persisted.
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", width: 32, height: 32, borderRadius: 8, fontSize: 16, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Picker grid */}
        <div style={{
          padding: "26px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}>
          {TOOLS.map((t) => (
            <button
              key={t.key}
              onClick={() => onPick(t.key)}
              style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 14, padding: "22px 20px",
                textAlign: "left", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 10,
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.primary;
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,57,50,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontSize: 28 }}>{t.icon}</span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                  color: T.muted, background: T.bg, padding: "3px 8px", borderRadius: 6,
                }}>
                  {t.tag}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.3px", marginBottom: 3 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>
                  {t.subtitle}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.55, flex: 1 }}>
                {t.body}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: T.primary, letterSpacing: "0.3px",
                marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", gap: 6,
              }}>
                Open <span style={{ fontSize: 13 }}>→</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer strip */}
        <div style={{
          padding: "12px 26px", background: T.bg, borderTop: `1px solid ${T.border}`,
          fontSize: 11, color: T.muted, textAlign: "center",
        }}>
          These tools use the live IPI engine — results match what the portal would show for a real project with the same inputs.
        </div>
      </div>
    </div>
  );
};

export default WhatIfPicker;
