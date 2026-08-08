import { calcProjectIPIFull } from "../utils/metrics.js";

// ============================================================================
//  SCORE CONTEXT CHIPS — the mandatory companions to an IPI pill
// ============================================================================
//  Governance rule (approved 2026-07-09): the IPI band pill must NEVER render
//  alone for a project that finished late. Wherever a per-project IPI pill is
//  shown, render <ScoreChips> right next to it so the amber "Late Delivery"
//  chip and the roadmap commitment chip travel with the score.
//
//    • Late Delivery (amber)  — completed AND daysLateVsPlan > 0.
//    • Roadmap (outlined)     — commitment status, visually distinct from the
//        performance bands so it never reads as a score:
//          met    → subtle green "✓ Met Roadmap · X days ahead"
//          breach → red "⚠ Roadmap Breach"
//      In-progress projects only ever show the red breach chip.
//
//  These are presentation only — the numbers come straight off the engine.
// ============================================================================

// Compute the chip context from the engine result. Accepts either a project
// (recomputes) or a precomputed calcProjectIPIFull result via `result`.
export function scoreContext(project, result) {
  const r = result || (project ? calcProjectIPIFull(project) : null);
  if (!r) return { daysLate: 0, roadmapStatus: null, roadmapDaysAhead: 0, complete: false, excluded: false };
  return {
    daysLate:        r.complete && r.daysLateVsPlan > 0 ? r.daysLateVsPlan : 0,
    roadmapStatus:   r.roadmapStatus || null,        // "met" | "breach" | null
    roadmapDaysAhead: r.roadmapDaysAhead || 0,
    roadmapDaysLate: r.roadmapDaysLate || 0,
    roadmapPenaltyPct: r.roadmapPenalty != null ? Math.round((1 - r.roadmapPenalty) * 100) : 0,
    complete:        !!r.complete,
    excluded:        !!r.excluded,
    governanceBreach: !!r.governanceBreach,
    mciPct:          r.components && r.components.mci != null ? Math.round(r.components.mci * 100) : null,
  };
}

// size: "sm" (tables/cards) | "md" (hero). Chips share the pill's row.
export const ScoreChips = ({ project, result, size = "sm", onDark = false }) => {
  const ctx = scoreContext(project, result);
  if (!ctx.daysLate && !ctx.roadmapStatus && !ctx.excluded && !ctx.governanceBreach) return null;

  const fs   = size === "md" ? 11 : 10;
  const pad  = size === "md" ? "2px 9px" : "2px 8px";
  const gap  = size === "md" ? 6 : 5;
  const base = { fontSize: fs, fontWeight: 700, padding: pad, borderRadius: 10, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1.3 };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, flexWrap: "wrap" }}>
      {ctx.excluded && (
        <span style={{ ...base, background: onDark ? "rgba(255,255,255,0.12)" : "#eef2f6", color: onDark ? "rgba(255,255,255,0.75)" : "#475569", fontWeight: 700 }}>
          ◔ Tracking only · not in IPI
        </span>
      )}
      {ctx.governanceBreach && (
        // Non-compensatory governance flag — mandatory companion so a green
        // schedule/cost score can never travel alone while docs are missing.
        <span style={{ ...base, background: onDark ? "rgba(220,38,38,0.18)" : "#fee2e2", color: onDark ? "#fca5a5" : "#b91c1c", border: onDark ? "1px solid rgba(220,38,38,0.5)" : "1px solid #fecaca", fontWeight: 800 }}>
          ⚠ Governance Risk{ctx.mciPct != null ? ` · docs ${ctx.mciPct}%` : ""}
        </span>
      )}
      {ctx.daysLate > 0 && (
        <span style={{ ...base, background: "#fdf1dd", color: "#b45309", fontWeight: 800 }}>
          Late Delivery · {ctx.daysLate}d
        </span>
      )}
      {ctx.roadmapStatus === "met" && (
        // Outlined / informational — deliberately NOT a filled score band.
        <span style={{ ...base, background: "transparent", color: onDark ? "#7dffd9" : "#007a62", border: `1px solid ${onDark ? "rgba(0,255,179,0.45)" : "#b5ead7"}` }}>
          ✓ Met Roadmap{ctx.roadmapDaysAhead > 0 ? ` · ${ctx.roadmapDaysAhead}d ahead` : ""}
        </span>
      )}
      {ctx.roadmapStatus === "breach" && (
        <span style={{ ...base, background: onDark ? "rgba(220,38,38,0.18)" : "#fee2e2", color: onDark ? "#fca5a5" : "#b91c1c", border: onDark ? "1px solid rgba(220,38,38,0.5)" : "1px solid #fecaca" }}>
          ⚠ Roadmap Breach{ctx.roadmapPenaltyPct > 0 ? ` · −${ctx.roadmapPenaltyPct}%` : ""}
        </span>
      )}
    </span>
  );
};

// ─── Data Confidence chip ──────────────────────────────────────────────────
// A SEPARATE signal from the score: how much real data backs the number. Shown
// beside the IPI so a thin-data 100 (schedule-only) can't read as a well-
// evidenced 100. Never affects the score — presentation of engine.dataConfidence.
export const ConfidenceChip = ({ project, result, size = "sm", onDark = false }) => {
  const r = result || (project ? calcProjectIPIFull(project) : null);
  const dc = r && r.dataConfidence;
  if (!dc || dc.level === "n/a") return null;
  const map = {
    High:   { c: onDark ? "#7dffd9" : "#007a62", b: onDark ? "rgba(0,255,179,0.12)" : "#e0f8ee" },
    Medium: { c: onDark ? "#fcd34d" : "#b45309", b: onDark ? "rgba(217,119,6,0.15)" : "#fdf3e0" },
    Low:    { c: onDark ? "#ff9d7a" : "#b23800", b: onDark ? "rgba(255,80,0,0.15)" : "#ffe8de" },
  };
  const m = map[dc.level] || map.Low;
  const fs = size === "md" ? 11 : 10;
  const title = `Data confidence: ${dc.level}. Based on ${dc.basis.join(", ") || "—"}${dc.missing.length ? ` · missing ${dc.missing.join(", ")}` : ""}.`;
  return (
    <span title={title} style={{
      fontSize: fs, fontWeight: 700, padding: size === "md" ? "2px 9px" : "2px 8px", borderRadius: 10,
      background: m.b, color: m.c, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", lineHeight: 1.3,
    }}>
      ◍ Data {dc.level}{dc.missing.length ? ` · −${dc.missing.join("/")}` : ""}
    </span>
  );
};

export default ScoreChips;
