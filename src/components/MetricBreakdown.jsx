// Audit-quality breakdown modals for the two headline project metrics —
// Progress % and IPI Score. Designed to be opened by clicking the metric
// on the project hero, and to be screenshot as evidence: every number on
// screen is traceable to a formula that's also on screen, with no hidden
// steps. The PM, sponsor or auditor should be able to verify the result
// by hand with nothing more than what's in the modal.
//
// Two exports:
//   <IPIBreakdownModal      project … />
//   <ProgressBreakdownModal project … />

import React from "react";
import {
  calcProjectIPIFull,
  calcProjectIPISnapshot,
  calcTimeWeightedIPI,
  calcProjectIPIDisplay,
  calcProjectProgressFromWBS,
  effectiveProgress,
  parseGateNumber,
  ipiColor,
} from "../utils/metrics.js";
import { TODAY } from "../utils/dates.js";

// ─── Fixed palette ─────────────────────────────────────────────────────
// The audit modals deliberately render in a fixed light scheme regardless of
// the app's theme — they are designed to be screenshot as evidence and must
// stay legible against any background a reviewer pastes them into.
const PAL = {
  ink:      "#0d1f1c",
  text:     "#1a2e2a",
  muted:    "#56716c",
  border:   "#d1e8e4",
  surface:  "#ffffff",
  surface2: "#f4f8f6",
  accent:   "#00b894",
  brand:    "#003932",
  brandDk:  "#001f1a",
  sea:      "#00FFB3",
};

// Print stylesheet — flattens every clipping/scroll constraint that exists
// for the on-screen modal so the printed PDF can grow naturally across as
// many A4 pages as the audit content needs. The previous version inherited
// the modal's `maxHeight: 92vh` + `overflowY: auto` and produced a single-
// page screenshot with the rest of the audit truncated. Every constraint
// here uses !important to override the React inline styles, and the
// `overflow / max-height` reset cascades to descendants so the nested
// time-weighted history scroller also expands.
const PRINT_CSS = `
@media print {
  html, body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    overflow: visible !important;
  }
  body * { visibility: hidden !important; }
  .audit-print-root, .audit-print-root * { visibility: visible !important; }
  .audit-backdrop {
    position: static !important;
    background: white !important;
    backdrop-filter: none !important;
    padding: 0 !important;
    display: block !important;
    height: auto !important;
    overflow: visible !important;
    inset: auto !important;
  }
  .audit-print-root {
    position: static !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    max-height: none !important;
    height: auto !important;
    width: 100% !important;
    max-width: none !important;
    overflow: visible !important;
    page-break-inside: auto !important;
  }
  .audit-print-root * {
    overflow: visible !important;
    max-height: none !important;
  }
  .audit-print-root section { page-break-inside: avoid; }
  .audit-print-root table { page-break-inside: auto !important; }
  .audit-print-root tr    { page-break-inside: avoid !important; page-break-after: auto !important; }
  .audit-print-noprint { display: none !important; }
  @page { size: A4; margin: 12mm; }
}
`;

// ─── Shared modal chrome ───────────────────────────────────────────────
const Shell = ({ title, subtitle, accent, onClose, children }) => {
  const print = () => {
    // Defer so React paints the print-friendly layout first
    setTimeout(() => window.print(), 0);
  };
  return (
    <div
      className="audit-backdrop"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 18, 14, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <style>{PRINT_CSS}</style>
      <div
        className="audit-print-root"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PAL.surface,
          color: PAL.text,
          borderRadius: 14,
          width: "min(900px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          border: `1px solid ${PAL.border}`,
        }}
      >
        <div style={{
          background: `linear-gradient(135deg, ${PAL.brand} 0%, ${PAL.brandDk} 100%)`,
          color: "#fff",
          padding: "18px 22px",
          borderRadius: "14px 14px 0 0",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          borderBottom: `4px solid ${accent}`,
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, fontWeight: 800, marginBottom: 4 }}>
              Audit Breakdown
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.3px" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <div className="audit-print-noprint" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={print}
              aria-label="Save as PDF"
              title="Save as PDF"
              style={{
                background: PAL.sea,
                border: `1px solid ${PAL.sea}`,
                borderRadius: 8,
                color: PAL.brand,
                height: 32,
                padding: "0 12px",
                fontSize: 11, fontWeight: 800,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                letterSpacing: "0.04em",
              }}
            >
              <span style={{ fontSize: 13 }}>↓</span> SAVE PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 8,
                color: "#fff",
                width: 32, height: 32,
                fontSize: 18, fontWeight: 800,
                cursor: "pointer",
                display: "grid", placeItems: "center",
              }}
            >×</button>
          </div>
        </div>

        <div style={{ padding: "20px 22px 24px", background: PAL.surface, color: PAL.text }}>{children}</div>
      </div>
    </div>
  );
};

// ─── Small primitives — fixed palette so the modal is always legible ──
const Section = ({ num, title, sub, accent, children }) => (
  <section style={{ marginBottom: 18 }}>
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10,
      borderBottom: `1px solid ${PAL.border}`,
      paddingBottom: 6, marginBottom: 10,
    }}>
      <span style={{ fontFamily: "monospace", color: accent, fontSize: 11, fontWeight: 800 }}>{num}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: PAL.ink, letterSpacing: "-0.1px" }}>{title}</span>
      {sub && <span style={{ fontSize: 10, color: PAL.muted, marginLeft: "auto" }}>{sub}</span>}
    </div>
    {children}
  </section>
);

const KV = ({ k, v, mono }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "1fr auto",
    gap: 12, padding: "5px 0",
    borderBottom: `1px dashed ${PAL.border}`,
    fontSize: 11.5,
  }}>
    <span style={{ color: PAL.muted }}>{k}</span>
    <span style={{
      color: PAL.ink, fontWeight: 600,
      fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : "inherit",
      fontFeatureSettings: '"tnum"',
    }}>{v}</span>
  </div>
);

const Formula = ({ children }) => (
  <div style={{
    background: PAL.surface2,
    color: PAL.ink,
    border: `1px solid ${PAL.border}`,
    borderLeft: `3px solid ${PAL.accent}`,
    borderRadius: 6,
    padding: "8px 12px",
    margin: "8px 0",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre",
  }}>{children}</div>
);

const Pill = ({ children, color, bg }) => (
  <span style={{
    display: "inline-block",
    padding: "1px 8px",
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 10,
    color: color || "#fff",
    background: bg || "#003932",
    letterSpacing: "0.3px",
  }}>{children}</span>
);

const num3 = (n) => n == null ? "—" : Number(n).toFixed(3);
const num2 = (n) => n == null ? "—" : Number(n).toFixed(2);
const sar  = (n) => n == null ? "—" : Number(n).toLocaleString("en-US") + " SAR";
const pct  = (n) => n == null ? "—" : `${Math.round(n)}%`;

// ═══════════════════════════════════════════════════════════════════════
// IPI BREAKDOWN MODAL
// ═══════════════════════════════════════════════════════════════════════
export const IPIBreakdownModal = ({ project, onClose }) => {
  if (!project) return null;

  const full     = calcProjectIPIFull(project);
  const snapshot = calcProjectIPISnapshot(project);
  const weighted = calcTimeWeightedIPI(project);
  const display  = calcProjectIPIDisplay(project);
  const sc       = ipiColor(display.primary);
  const comp     = full.components || {};

  // Inputs we'll surface for the audit trail
  const startMs = project.startDate ? new Date(project.startDate).getTime() : null;
  const endMs   = project.plannedEnd ? new Date(project.plannedEnd).getTime() : null;
  const nowMs   = new Date(TODAY).getTime();
  const totalDays   = (startMs && endMs && endMs > startMs)
    ? Math.round((endMs - startMs) / 86_400_000) : null;
  const elapsedDays = (startMs && endMs && endMs > startMs)
    ? Math.max(0, Math.min(totalDays, Math.round((nowMs - startMs) / 86_400_000))) : null;

  const eff = effectiveProgress(project);
  const evRaw = eff / 100;
  const pvAuto = (totalDays && totalDays > 0 && elapsedDays != null)
    ? Math.min(1, elapsedDays / totalDays) : null;
  const pvUsed = (project.plannedProgress != null && project.plannedProgress !== "")
    ? Math.min(1, Number(project.plannedProgress) / 100)
    : pvAuto;

  const budget = project.budget || 0;
  const ac     = project.actualCost || 0;
  const bcwp   = budget > 0 ? evRaw * budget : null;

  const gateNum = parseGateNumber(project.gate);
  const allDocs = (project.documents || []);
  const reqDocs = allDocs.filter(d => d.required);
  const dueDocs = reqDocs.filter(d => (d.requiredAtGate || 1) <= gateNum);

  const roadmapDeadline = project.roadmapDeadline || null;
  let daysPast = 0;
  if (roadmapDeadline) {
    const rdMs = new Date(roadmapDeadline).getTime();
    if (nowMs > rdMs) daysPast = Math.floor((nowMs - rdMs) / 86_400_000);
  }

  // Time-weighted history reconstruction (mirrors calcTimeWeightedIPI exactly,
  // including the 90-day moving window — snapshots dated before today−90d are
  // excluded entirely, not clipped, to match the engine's audit-fix policy).
  const TIME_WINDOW_DAYS = 90;
  const todayMsForHistory = new Date(TODAY).getTime();
  const windowStartForHistory = todayMsForHistory - TIME_WINDOW_DAYS * 86_400_000;
  const history = (project.ipiHistory || [])
    .filter(h => {
      if (!h.date || h.ipi == null) return false;
      const hMs = new Date(h.date).getTime();
      return hMs <= todayMsForHistory && hMs >= windowStartForHistory;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const excludedCount = (project.ipiHistory || []).filter(h => {
    if (!h.date || h.ipi == null) return false;
    return new Date(h.date).getTime() < windowStartForHistory;
  }).length;
  const rows = [];
  let totalWeighted = 0, totalDaysHist = 0;
  for (let i = 0; i < history.length; i++) {
    const fromMs = new Date(history[i].date).getTime();
    const toMs   = i + 1 < history.length ? new Date(history[i + 1].date).getTime() : todayMsForHistory;
    const isLast = i + 1 >= history.length;
    const rawDays = Math.max(0, (toMs - fromMs) / 86_400_000);
    const days = isLast ? Math.max(1, rawDays) : rawDays;
    const w = history[i].ipi * days;
    totalWeighted += w;
    totalDaysHist += days;
    rows.push({
      from:    history[i].date,
      day:     history[i].day || String(history[i].date).slice(0, 10),
      ipi:     history[i].ipi,
      by:      history[i].by || "—",
      days:    days,
      w:       w,
    });
  }

  return (
    <Shell
      title={`IPI Breakdown — ${project.name}`}
      subtitle={`As of ${TODAY} · Project ID ${project.id || "—"}`}
      accent="#00FFB3"
      onClose={onClose}
    >
      {/* Headline */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18,
      }}>
        <div style={{
          background: sc.bg, color: sc.color,
          padding: "14px 16px", borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {display.primary ?? "—"}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", marginTop: 4, textTransform: "uppercase", opacity: 0.85 }}>
            Displayed (Time-Weighted)
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, opacity: 0.7 }}>{sc.label}</div>
        </div>
        <div style={{
          background: PAL.surface2, border: `1px solid ${PAL.border}`,
          padding: "14px 16px", borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: PAL.ink, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>
            {snapshot ?? "—"}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", marginTop: 4, textTransform: "uppercase", color: PAL.muted }}>
            Latest Snapshot
          </div>
          <div style={{ fontSize: 10, color: PAL.muted, marginTop: 2 }}>
            Current state of project
          </div>
        </div>
        <div style={{
          background: PAL.surface2, border: `1px solid ${PAL.border}`,
          padding: "14px 16px", borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: 26, fontWeight: 900,
            color: display.delta == null ? PAL.muted : display.delta > 0 ? "#16a34a" : display.delta < 0 ? "#dc2626" : PAL.ink,
            lineHeight: 1, fontFeatureSettings: '"tnum"',
          }}>
            {display.delta == null ? "—" : (display.delta > 0 ? "+" : "") + display.delta}
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", marginTop: 4, textTransform: "uppercase", color: PAL.muted }}>
            Snapshot vs Weighted
          </div>
          <div style={{ fontSize: 10, color: PAL.muted, marginTop: 2 }}>
            {history.length} snapshots in history
          </div>
        </div>
      </div>

      {/* ─── 01 INPUTS ─── */}
      <Section num="01" title="Inputs read from the project" accent="#00b894">
        <KV k="Project window" v={`${project.startDate || "—"}  →  ${project.plannedEnd || "—"}`} />
        <KV k="Total duration" v={totalDays != null ? `${totalDays} days` : "—"} mono />
        <KV k="As-of date (today)" v={TODAY} mono />
        <KV k="Days elapsed" v={elapsedDays != null ? `${elapsedDays} of ${totalDays} days` : "—"} mono />
        <KV k="Actual progress (effective)" v={`${eff}%`} mono />
        <KV k="Planned progress source" v={project.plannedProgress != null && project.plannedProgress !== "" ? "Manual override" : "Auto from dates"} />
        <KV k="Budget" v={budget ? sar(budget) : "—"} mono />
        <KV k="Actual cost" v={ac ? sar(ac) : "—"} mono />
        <KV k="Current gate" v={`Gate ${gateNum}`} />
        <KV k="Required docs" v={`${reqDocs.length} total · ${dueDocs.length} due at Gate ${gateNum}`} mono />
        <KV k="Roadmap deadline" v={roadmapDeadline || "(none set)"} mono />
        <KV k="Days past roadmap" v={daysPast > 0 ? `${daysPast} days` : "Within roadmap"} mono />
      </Section>

      {/* ─── 02 SPI ─── */}
      <Section num="02" title="SPI — Schedule Performance Index" accent="#00b894" sub="weight 50% (re-normalised when peers absent)">
        <Formula>{`Raw SPI  =  EV ÷ PV       (uncapped — preserves over-achievement signal)
EV       =  ${num3(evRaw)}   ← effective progress / 100
PV       =  ${num3(pvUsed)}${pvAuto != null && pvUsed === pvAuto ? `   ← ${elapsedDays}/${totalDays} (linear time-based)` : "   ← manual override"}
Raw SPI  =  ${num3(evRaw)} ÷ ${num3(pvUsed)}  =  ${num3(comp.spi)}`}</Formula>
        <Formula>{`Penalty  =  1 − (days_past ÷ 100)        ← Tree-invented, 100-day floor
        =  1 − (${daysPast} ÷ 100)
        =  ${num3(comp.penalty)}

SPI × Penalty       =  ${num3(comp.spi)} × ${num3(comp.penalty)}  =  ${num3((comp.spi ?? 0) * (comp.penalty ?? 1))}
spiFinal = min(cap, …)  =  min(1.20, ${num3((comp.spi ?? 0) * (comp.penalty ?? 1))})  =  ${num3(comp.spiFinal)}`}</Formula>
        <div style={{ fontSize: 10, color: PAL.muted, marginTop: 4, lineHeight: 1.6 }}>
          Order matters: penalty hits the RAW ratio first, then the cap clamps the result.
          The reverse order (cap-then-penalty) over-penalises an over-achiever that slips past
          the roadmap — corrected by the post-audit regression test.
        </div>
        <KV k="SPI used in IPI" v={num3(comp.spiFinal ?? comp.spi)} mono />
      </Section>

      {/* ─── 03 CPI ─── */}
      <Section num="03" title="CPI — Cost Performance Index" accent="#00b894" sub="weight 25%">
        {budget > 0 && ac > 0 ? (
          <Formula>{`BCWP  =  Budget × (progress ÷ 100)
       =  ${budget.toLocaleString()} × ${num3(evRaw)}
       =  ${(bcwp || 0).toLocaleString()} SAR

CPI   =  BCWP ÷ Actual Cost    (capped at 1.20)
       =  ${(bcwp || 0).toLocaleString()} ÷ ${ac.toLocaleString()}
       =  ${num3(comp.cpi)}`}</Formula>
        ) : (
          <Formula>{`Budget or actual cost is zero / missing / negative.
CPI = ${comp.cpi == null ? "null  →  EXCLUDED from IPI; remaining weights re-normalise" : num3(comp.cpi)}`}</Formula>
        )}
        <KV k="CPI used in IPI" v={comp.cpi == null ? "excluded (re-normalised)" : num3(comp.cpi)} mono />
      </Section>

      {/* ─── 04 MCI ─── */}
      <Section num="04" title="MCI — Artefact Compliance Index" accent="#00b894" sub="weight 25%">
        <KV k="All documents on project" v={`${allDocs.length}`} mono />
        <KV k="Required documents" v={`${reqDocs.length}`} mono />
        <KV k="Due at current gate (G≤${gateNum})" v={`${dueDocs.length}`} mono />
        {dueDocs.length > 0 && (
          <div style={{
            background: PAL.surface2, border: `1px solid ${PAL.border}`,
            borderRadius: 6, padding: "8px 12px", marginTop: 8,
            fontSize: 11,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: PAL.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Per-doc credit
            </div>
            {dueDocs.map((d, i) => {
              const status = d.status || "(no status)";
              let credit = 0;
              if (["Approved", "Final", "Received", "Current"].includes(status)) credit = 1.0;
              else if (["Submitted", "Under Review"].includes(status)) credit = 0.5;
              const c = credit === 1 ? "#16a34a" : credit === 0.5 ? "#d97706" : "#dc2626";
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto",
                  gap: 10, padding: "3px 0",
                  borderTop: i ? `1px dashed ${PAL.border}` : "none",
                }}>
                  <span style={{ color: PAL.ink }}>{d.name || `Doc ${i+1}`}</span>
                  <Pill bg={c} color="#fff">{status}</Pill>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: c, minWidth: 36, textAlign: "right" }}>
                    {num3(credit)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <Formula>{`MCI  =  Σ(credit) ÷ docs_due_at_gate    (capped at 1.00)
     =  ${num3(comp.mci)}`}</Formula>
        <KV k="MCI used in IPI" v={comp.mci == null ? "excluded (re-normalised)" : `${num3(comp.mci)}  (${pct((comp.mci || 0) * 100)})`} mono />
      </Section>

      {/* ─── 05 SNAPSHOT IPI ─── */}
      <Section num="05" title="Snapshot IPI — present components re-normalised" accent="#00b894">
        {(() => {
          // Build the same parts array the engine uses, then walk it on screen
          // so the audit math is reproducible by hand from this exact panel.
          const parts = [];
          if (comp.spiFinal !== null) parts.push({ name: "SPI (final)", w: 0.50, v: comp.spiFinal });
          if (comp.cpi      !== null) parts.push({ name: "CPI",         w: 0.25, v: comp.cpi      });
          if (comp.mci      !== null) parts.push({ name: "MCI",         w: 0.25, v: comp.mci      });
          if (parts.length === 0) {
            return <div style={{ fontSize: 11, color: PAL.muted }}>All three components are null → IPI is "Pending Plan".</div>;
          }
          const sumW = parts.reduce((s, p) => s + p.w, 0);
          const dec  = parts.reduce((s, p) => s + p.w * p.v, 0) / sumW;
          const isFull = parts.length === 3;
          return (
            <>
              <Formula>{`IPI  =  Σ(weight × value) ÷ Σ(weights)
${parts.map(p => `        ${p.name.padEnd(11)} (w=${p.w.toFixed(2)})  ×  ${num3(p.v)}  =  ${(p.w * p.v).toFixed(4)}`).join("\n")}
        ─────────────────────────────────────
        Σ(w × v)  =  ${parts.reduce((s, p) => s + p.w * p.v, 0).toFixed(4)}
        Σ(w)      =  ${sumW.toFixed(2)}${isFull ? "  (full set — standard 0.50/0.25/0.25)" : "  (re-normalised; missing components excluded)"}

IPI  =  ${parts.reduce((s, p) => s + p.w * p.v, 0).toFixed(4)} ÷ ${sumW.toFixed(2)}
     =  ${dec.toFixed(4)}
     × 100  =  ${snapshot ?? Math.round(dec * 100)}`}</Formula>
              <div style={{ fontSize: 10, color: PAL.muted, marginTop: 6, lineHeight: 1.6 }}>
                Re-normalisation policy: missing components (null) are <strong>excluded</strong> from the
                rollup; weights of present components rescale to sum to 1. Replaces an older
                neutral-1.0 default that rewarded withholding data — fix logged in the post-audit
                regression suite.
              </div>
            </>
          );
        })()}
      </Section>

      {/* ─── 06 TIME-WEIGHTED ─── */}
      <Section num="06" title="Time-Weighted IPI — 90-day moving window" accent="#00b894" sub={`${history.length} snapshots in window`}>
        {history.length === 0 ? (
          <div style={{
            background: PAL.surface2, border: `1px dashed ${PAL.border}`,
            borderRadius: 6, padding: "12px 14px", fontSize: 11.5, color: PAL.muted,
          }}>
            No snapshots inside the 90-day moving window
            {excludedCount > 0 && <> · {excludedCount} older snapshot{excludedCount > 1 ? "s" : ""} excluded</>}.
            Displayed IPI falls back to the current snapshot ({snapshot ?? "—"}).
          </div>
        ) : (
          <>
            <div style={{ maxHeight: 280, overflowY: "auto", border: `1px solid ${PAL.border}`, borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: PAL.surface2, color: PAL.muted }}>
                    <th style={{ textAlign: "left",  padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Saved at</th>
                    <th style={{ textAlign: "left",  padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>By</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>IPI</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Days</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>IPI × Days</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const dt = new Date(r.from);
                    const fmt = isNaN(dt) ? r.from : dt.toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${PAL.border}` }}>
                        <td style={{ padding: "5px 10px", fontFamily: "monospace", fontSize: 10 }}>{fmt}</td>
                        <td style={{ padding: "5px 10px", fontSize: 10.5, color: PAL.muted }}>{r.by}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{r.ipi}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace" }}>{r.days < 1 ? r.days.toFixed(3) : r.days.toFixed(2)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace", color: PAL.muted }}>{r.w.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: PAL.surface2, fontWeight: 800 }}>
                    <td colSpan={3} style={{ padding: "7px 10px", textAlign: "right", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.08em" }}>Totals</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{totalDaysHist.toFixed(2)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{totalWeighted.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Formula>{`Time-Weighted  =  Σ(IPI × days) ÷ Σ(days)
              =  ${totalWeighted.toFixed(1)} ÷ ${totalDaysHist.toFixed(2)}
              =  ${(totalWeighted / Math.max(1, totalDaysHist)).toFixed(2)}
              →  ${weighted}`}</Formula>
            <div style={{ fontSize: 10, color: PAL.muted, marginTop: 6, lineHeight: 1.5 }}>
              <strong>Days</strong> here is the fraction of a day each snapshot was active before
              being superseded by the next save. Multiple same-day saves are visible as
              separate audit rows but each carries a fractional weight, so a frenzy of
              saves on one day cannot dominate the trailing average.
            </div>
          </>
        )}
      </Section>

      {/* ─── 07 FINAL ─── */}
      <Section num="07" title="Final displayed value" accent="#00b894">
        <KV k="Displayed IPI (primary)" v={display.primary ?? "—"} mono />
        <KV k="Latest snapshot (info)" v={snapshot ?? "—"} mono />
        <KV k="Band" v={sc.label} />
        <div style={{ fontSize: 10, color: PAL.muted, marginTop: 8 }}>
          Generated {new Date().toLocaleString("en-GB")} · Source of truth: <code style={{ fontFamily: "monospace", background: PAL.surface2 }}>src/utils/metrics.js</code>
        </div>
      </Section>
    </Shell>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS BREAKDOWN MODAL
// ═══════════════════════════════════════════════════════════════════════
export const ProgressBreakdownModal = ({ project, onClose }) => {
  if (!project) return null;

  const items = project.milestones || [];
  const tops  = items.filter(m => !m.parentId);
  const wbsValue = calcProjectProgressFromWBS(project);
  const eff      = effectiveProgress(project);
  const source   = wbsValue != null ? "WBS rollup (Activities tab)" : "Manual project.progress field";
  const totalW   = tops.reduce((s, m) => s + (m.weight || 1), 0);

  // Per-milestone breakdown
  const msRows = tops.map(m => {
    const kids = items.filter(i => i.parentId === m.id);
    let p, kidsDetail = [];
    if (kids.length === 0) {
      p = m.progress || 0;
    } else {
      const kw = kids.reduce((a, c) => a + (c.weight || 1), 0);
      kidsDetail = kids.map(c => ({
        name: c.name || "(unnamed)",
        weight: c.weight || 1,
        progress: c.progress || 0,
        contrib: (c.weight || 1) * (c.progress || 0),
      }));
      p = kw ? kids.reduce((a, c) => a + (c.weight || 1) * (c.progress || 0), 0) / kw : 0;
    }
    return {
      id: m.id,
      name: m.name || "(unnamed milestone)",
      weight: m.weight || 1,
      progress: p,
      kids: kidsDetail,
      kidsW: kids.reduce((a, c) => a + (c.weight || 1), 0),
      contrib: (m.weight || 1) * p,
    };
  });

  const sumContrib = msRows.reduce((s, r) => s + r.contrib, 0);

  return (
    <Shell
      title={`Progress Breakdown — ${project.name}`}
      subtitle={`As of ${TODAY} · ${source}`}
      accent="#00b894"
      onClose={onClose}
    >
      <div style={{
        background: "rgba(0,184,148,0.10)",
        border: "1px solid rgba(0,184,148,0.30)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{
          fontSize: 38, fontWeight: 900, color: PAL.accent,
          lineHeight: 1, fontFeatureSettings: '"tnum"',
        }}>
          {eff}%
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: PAL.accent, textTransform: "uppercase" }}>
            Displayed Progress
          </div>
          <div style={{ fontSize: 11, color: PAL.ink, marginTop: 4 }}>
            {source}
            {wbsValue != null && wbsValue !== eff && (
              <span style={{ color: PAL.muted, marginLeft: 6 }}>· clamped to [0, 100]</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 01 SOURCE ─── */}
      <Section num="01" title="Source of progress value" accent="#00b894">
        <KV k="WBS rollup available" v={wbsValue != null ? `Yes — ${wbsValue}%` : "No"} />
        <KV k="Manual project.progress" v={project.progress != null ? `${project.progress}%` : "(not set)"} />
        <KV k="Rule" v="WBS wins when activities exist; manual is fallback only" />
        <KV k="Effective (displayed)" v={`${eff}%`} mono />
      </Section>

      {wbsValue == null ? (
        <Section num="02" title="WBS detail" accent="#00b894">
          <div style={{
            background: PAL.surface2, border: `1px dashed ${PAL.border}`,
            borderRadius: 6, padding: "12px 14px", fontSize: 11.5, color: PAL.muted,
          }}>
            No top-level milestones recorded on this project — nothing to roll up.
            The displayed {eff}% comes directly from the manual progress field.
          </div>
        </Section>
      ) : (
        <>
          {/* ─── 02 MILESTONES ─── */}
          <Section num="02" title="Top-level milestones" accent="#00b894" sub={`${tops.length} milestones · total weight ${totalW}`}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: PAL.surface2, color: PAL.muted }}>
                  <th style={{ textAlign: "left",  padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Milestone</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Weight</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Progress</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>W × P</th>
                </tr>
              </thead>
              <tbody>
                {msRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${PAL.border}` }}>
                    <td style={{ padding: "5px 10px", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace" }}>{r.weight}</td>
                    <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{Math.round(r.progress)}%</td>
                    <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "monospace", color: PAL.muted }}>{r.contrib.toFixed(1)}</td>
                  </tr>
                ))}
                <tr style={{ background: PAL.surface2, fontWeight: 800 }}>
                  <td colSpan={2} style={{ padding: "7px 10px", textAlign: "right", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.08em" }}>Σ Weight</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{totalW}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace" }}>{sumContrib.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
            <Formula>{`Project Progress  =  Σ(milestone_weight × milestone_progress) ÷ Σ(weights)
                  =  ${sumContrib.toFixed(1)} ÷ ${totalW}
                  =  ${(sumContrib / Math.max(1, totalW)).toFixed(2)}
                  →  ${wbsValue}%`}</Formula>
          </Section>

          {/* ─── 03 ACTIVITY DETAIL per milestone ─── */}
          {msRows.some(r => r.kids.length > 0) && (
            <Section num="03" title="Activities under each milestone" accent="#00b894">
              {msRows.filter(r => r.kids.length > 0).map((r) => (
                <div key={r.id} style={{
                  border: `1px solid ${PAL.border}`, borderRadius: 8,
                  padding: "10px 12px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: PAL.ink }}>{r.name}</span>
                    <span style={{ fontSize: 10, color: PAL.muted }}>
                      {r.kids.length} activities · weight {r.kidsW} · rolled {Math.round(r.progress)}%
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
                    <thead>
                      <tr style={{ color: PAL.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        <th style={{ textAlign: "left",  padding: "3px 8px" }}>Activity</th>
                        <th style={{ textAlign: "right", padding: "3px 8px" }}>W</th>
                        <th style={{ textAlign: "right", padding: "3px 8px" }}>P</th>
                        <th style={{ textAlign: "right", padding: "3px 8px" }}>W × P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.kids.map((c, i) => (
                        <tr key={i} style={{ borderTop: `1px dashed ${PAL.border}` }}>
                          <td style={{ padding: "3px 8px" }}>{c.name}</td>
                          <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace" }}>{c.weight}</td>
                          <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{c.progress}%</td>
                          <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", color: PAL.muted }}>{c.contrib.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Formula>{`Milestone Progress  =  ${r.kids.reduce((s, c) => s + c.contrib, 0).toFixed(0)} ÷ ${r.kidsW}  =  ${Math.round(r.progress)}%`}</Formula>
                </div>
              ))}
            </Section>
          )}
        </>
      )}

      <Section num="04" title="Verification" accent="#00b894">
        <div style={{ fontSize: 10.5, color: PAL.muted, lineHeight: 1.6 }}>
          Every number above can be reproduced by hand. The displayed {eff}% on the project hero
          equals the result of the rollup shown in section {wbsValue != null ? "02" : "01"} above.
          Source of truth: <code style={{ fontFamily: "monospace", background: PAL.surface2 }}>calcProjectProgressFromWBS</code> and <code style={{ fontFamily: "monospace", background: PAL.surface2 }}>effectiveProgress</code> in <code style={{ fontFamily: "monospace", background: PAL.surface2 }}>src/utils/metrics.js</code>.
        </div>
        <div style={{ fontSize: 10, color: PAL.muted, marginTop: 8 }}>
          Generated {new Date().toLocaleString("en-GB")}
        </div>
      </Section>
    </Shell>
  );
};
