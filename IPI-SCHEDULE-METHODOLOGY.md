# IPI Schedule Methodology — SPI Reference & Completion Rule

**Status:** current (effective 2026-07-09). Supersedes the roadmap‑anchored SPI
model and the earlier 1%/day roadmap‑penalty model. Authoritative source of
truth is `src/utils/metrics.js` → `calcProjectIPIFull`.

## Summary

IPI = `0.50 × spiFinal + 0.25 × CPI + 0.25 × MCI`, re‑normalised when a
component is absent. Weights, the 1.20 cap, CPI and MCI logic are unchanged.
Only the **schedule (SPI)** reference and the **completion** rule changed.

## 1. SPI is measured against the project's own locked baseline

- **Reference = `baselineEnd`** — the committed finish date, **locked at Gate‑3
  approval** (PMO‑protected; a PM cannot edit it). Falls back to `plannedEnd`
  for projects that predate the field (one‑time backfill on first read).
- The **Roadmap Deadline never feeds the SPI math.** Its slack can no longer
  inflate the score. Roadmap is a **checkpoint only** (see §4).

## 2. In‑progress projects (< 100%) — clamped planned value

- Planned % is **clamped at 100 %** at the baseline (both the WBS‑leaf path and
  the no‑WBS fallback). Once the as‑of date reaches the baseline the work is
  "fully due".
- Effect: a late‑but‑incomplete project reads **SPI = actual %** (a proportional
  shortfall), never a roadmap‑inflated bonus.

## 3. Completed projects (Option C) — duration ratio

When a project is complete (`actualFinishDate` set, or effective progress ≥ 100):

```
spiFinal = clamp( baselineDuration / actualDuration , 0 , 1.20 )
  baselineDuration = start → baselineEnd (locked Gate‑3; else plannedEnd)
  actualDuration   = start → actualFinishDate (else as‑of)
```

- **Late** delivery lowers the score proportionally; **early** delivery raises it
  (capped 1.20). **No jump to 1.0 on closure.**
- Guard: zero/negative baseline or actual duration → SPI `null`, status
  **"Data Invalid"**.
- Worked example (the reference scenario): start 01 Jul, baseline 30 Jul,
  finish 05 Aug → SPI = 29 / 35 = **0.829** → IPI **91** (with CPI = MCI = 1.0),
  labelled **6 days late vs plan**.

## 4. Roadmap as a dormant checkpoint — breach cap & decay

The Roadmap Deadline is **dormant**. It has **zero** effect on any number for as
long as the project is on or before it — no anchoring, no reference, no bonus, no
penalty. It **activates only at the moment it is crossed with the project
incomplete**: from that point the composite **IPI is capped at 100** (a
strategically late project can never be Over Achieved) and **decays 1% per day**
past the roadmap, floored at 0 (100 days past → IPI 0). SPI/CPI/MCI components are
reported unpenalised; only the headline IPI is capped and decayed.

```
if roadmapBreach:  IPI = min(100, IPI) × (1 − daysPastRoadmap / 100)   (floored at 0)
```

The plan approver knows the roadmap date and this penalty at Gate‑3 approval, so
it is a **pre‑declared, consciously accepted consequence, not a surprise** — and
it is distinct from the retired always‑on 1%/day model that anchored SPI to the
roadmap.

- **Breach** (red chip "⚠ Roadmap Breach · −X%"): incomplete and the clock has
  reached the roadmap, **or** completed after it.
- **Met** (subtle green "✓ Met Roadmap · X days ahead"): completed on/before it —
  informational only, no bonus.
- Engine fields: `roadmapStatus` / `roadmapBreach` / `roadmapDaysAhead` /
  `roadmapDaysLate` / `roadmapPenalty`.

## 5. Display pairing rule (governance)

Wherever a **per‑project IPI pill** appears (project tables, project hero, IPI
Calculator), it must never render alone for a late project:

- Completed **and** `daysLateVsPlan > 0` → a mandatory amber **"Late Delivery ·
  X days"** chip beside the pill.
- Roadmap chip (outlined, informational — *not* a score band): Met = subtle
  green, Breach = red.

The 3‑band display scale (`ipiColor`: ≥90 On Track / 70–89 Watch / <70 Critical)
is unchanged. The internal EVM `status` field (used in audit/breakdown views)
keeps its own thresholds. Shared implementation: `src/components/ScoreChips.jsx`.

## 6. Governance controls

- `baselineEnd` and `baselineExceptionNote` are **PMO‑protected** (never
  overwritten by a PM/dept‑head save).
- **Gate‑3 capture:** on save at Gate 3+, the current `plannedEnd` is frozen as
  `baselineEnd` if not already set.
- **Gate‑3 validation:** if `baselineEnd > roadmapDeadline`, the save is blocked
  until a `baselineExceptionNote` is recorded.
- `daysLateVsPlan` and `roadmapStatus` are persisted into each `IPIHistoryJSON`
  snapshot so the lateness trend is preserved in the audit trail.

## Result fields (calcProjectIPIFull)

`scheduleAnchor: "baseline"` · `complete` · `daysLateVsPlan` ·
`scheduleDeltaDays` (signed: −early / +late) · `roadmapStatus` ("met" |
"breach" | null) · `roadmapBreach` · `roadmapDaysAhead`. The legacy `penalty`
field remains `1.0` for old audit‑modal compatibility.

---

### PDF methodology — regenerated (rev 2026‑07)

The official PDF (`_build-ipi-methodology-v2.cjs`, generator kept local) has been
aligned to this document as **IPI Methodology — Revision 2026‑07**: Chapter 07 is
now "Baseline &amp; Roadmap Checkpoint" (the retired 1%/day penalty, its decay
diagram and parameter table are gone), Chapter 03 documents the baseline
reference + in‑progress clamp + Option C completion, and the worked example,
audit‑test list and glossary follow suit. Output:
`Desktop/PMO-Portal-Deliverables/PMO-Portal-IPI-Methodology-2026-07.pdf`.
