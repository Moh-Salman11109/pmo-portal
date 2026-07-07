import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useT } from "../theme.js";
import { useBp } from "../hooks/useBp.js";
import { isUsingMock } from "../services/sharepoint.js";
import { acquireSpToken } from "../services/auth.js";
import { RAG_COLOR, trendIcon, trendColor } from "../utils/colors.js";
import { Ico } from "../components/Icon.jsx";
import { env } from "../config/runtimeEnv.js";

const GRC_SP_SITE = env.VITE_GRC_SP_SITE_URL || "https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard";

// ── GRC shared modal wrapper ──────────────────────────────────────
const GRCModal = ({ title, onClose, children }) => {
  const T = useT();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.muted, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
};

// ── Period helpers (Q1..Q4 / H1..H2 / YYYY) ───────────────────────
const _now = new Date();
const _yr = _now.getFullYear();
const _qNow = `${_yr}-Q${Math.floor(_now.getMonth() / 3) + 1}`;
const _hNow = `${_yr}-H${_now.getMonth() < 6 ? 1 : 2}`;
const _yearList = (n = 6) => Array.from({ length: n }, (_, i) => String(_yr - i));
const _quarterList = (n = 8) => {
  const out = [];
  for (let y = _yr; y >= _yr - 1; y--) for (let q = 4; q >= 1; q--) out.push(`${y}-Q${q}`);
  return out.slice(0, n);
};
const _halfList = (n = 6) => {
  const out = [];
  for (let y = _yr; y >= _yr - 2; y--) for (let h = 2; h >= 1; h--) out.push(`${y}-H${h}`);
  return out.slice(0, n);
};

// ── Auto-compute RAG from numeric thresholds + direction ──────────
// Returns null when thresholds aren't pure numbers (fallback to manual).
const computeAutoRAG = (value, kri) => {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return null;
  const g = parseFloat(kri.GreenThreshold);
  const r = parseFloat(kri.RedThreshold);
  // Need at least Green and Red as numbers to compute reliably
  if (!Number.isFinite(g) || !Number.isFinite(r)) return null;
  const a = parseFloat(kri.AmberThreshold);
  const hasAmber = Number.isFinite(a);
  const dir = kri.ThresholdDirection || "Lower is better";
  if (dir === "Lower is better") {
    if (v <= g) return "Green";
    if (v >= r) return "Red";
    return hasAmber ? "Amber" : "Amber";
  } else {
    if (v >= g) return "Green";
    if (v <= r) return "Red";
    return "Amber";
  }
};

// ── Add / Edit KRI Reading form ───────────────────────────────────
const GRCReadingForm = ({ kri, reading, onSave, saving, error, onCancel }) => {
  const T = useT();
  const isEdit = reading && reading.ID != null;
  const freq = (kri.ReportingFrequency || "Monthly");
  const defaultPeriod =
    freq === "Quarterly"   ? _qNow :
    freq === "Semi-Annual" ? _hNow :
    freq === "Annual"      ? String(_yr) :
                             _now.toISOString().substring(0, 7);
  const [form, setForm] = useState({
    ID:                 reading?.ID ?? null,
    KRIID:              reading?.KRIID ?? kri.KRIID,
    KRIName:            reading?.KRIName ?? kri.Title,
    ActualValue:        reading?.ActualValue ?? "",
    PreviousValue:      reading?.PreviousValue ?? "",
    Period:             reading?.Period ?? defaultPeriod,
    RAGStatus:          reading?.RAGStatus || "Green",
    Trend:              reading?.Trend || "Stable",
    Comments:           reading?.Comments || "",
    Justification:      reading?.Justification || "",
    ActionPlan:         reading?.ActionPlan || "",
    EscalationRequired: reading?.EscalationRequired ?? false,
  });
  const autoRAG = computeAutoRAG(form.ActualValue, kri);
  // When the user types a value, snap RAG to the auto-computed one.
  // Done in onChange (not useEffect) to avoid cascading renders.
  // The user can still override the dropdown afterwards.
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === "ActualValue") {
      const auto = computeAutoRAG(v, kri);
      if (auto) next.RAGStatus = auto;
    }
    return next;
  });
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Actual Value *</label>
          <input type="number" value={form.ActualValue} onChange={e => set("ActualValue", e.target.value)} placeholder="e.g. 42" style={inp} />
        </div>
        <div>
          <label style={lbl}>Previous Value</label>
          <input type="number" value={form.PreviousValue} onChange={e => set("PreviousValue", e.target.value)} placeholder="optional" style={inp} />
        </div>
      </div>
      <div>
        <label style={lbl}>
          Period * <span style={{ fontWeight: 400, color: T.muted, fontSize: 11 }}>· KRI is {freq}</span>
        </label>
        {freq === "Quarterly" && (
          <select value={form.Period} onChange={e => set("Period", e.target.value)} style={inp}>
            {_quarterList(12).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {freq === "Semi-Annual" && (
          <select value={form.Period} onChange={e => set("Period", e.target.value)} style={inp}>
            {_halfList(8).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {freq === "Annual" && (
          <select value={form.Period} onChange={e => set("Period", e.target.value)} style={inp}>
            {_yearList(6).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {freq === "Monthly" && (
          <input type="month" value={form.Period} onChange={e => set("Period", e.target.value)} style={inp} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>
            RAG Status
            {autoRAG && (
              <span style={{ fontWeight: 400, color: T.muted, fontSize: 10, marginLeft: 6 }}>
                auto: {autoRAG}
              </span>
            )}
          </label>
          <select value={form.RAGStatus} onChange={e => set("RAGStatus", e.target.value)} style={inp}>
            {["Green","Amber","Red"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Trend</label>
          <select value={form.Trend} onChange={e => set("Trend", e.target.value)} style={inp}>
            {["Improving","Stable","Worsening"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>Justification / Explanation</label>
        <textarea value={form.Justification} onChange={e => set("Justification", e.target.value)} rows={3} placeholder="Why is the value at this level? Context, drivers, root cause…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div>
        <label style={lbl}>Action Plan</label>
        <textarea value={form.ActionPlan} onChange={e => set("ActionPlan", e.target.value)} rows={3} placeholder="What's being done to address this? Owner, timeline, key steps…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div>
        <label style={lbl}>Comments</label>
        <textarea value={form.Comments} onChange={e => set("Comments", e.target.value)} rows={2} placeholder="Additional notes…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="grc-escal" checked={form.EscalationRequired} onChange={e => set("EscalationRequired", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="grc-escal" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Escalation required</label>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || form.ActualValue === ""} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || form.ActualValue === "" ? "not-allowed" : "pointer", opacity: saving || form.ActualValue === "" ? 0.6 : 1 }}>
          {saving ? "Saving…" : (isEdit ? "Save Changes" : "Save Reading")}
        </button>
      </div>
    </div>
  );
};

// ── Edit Risk Register form ───────────────────────────────────────
const GRCRiskForm = ({ risk, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID:                   risk.ID,
    LikelihoodScore:      risk.LikelihoodScore ?? 3,
    ImpactScore:          risk.ImpactScore ?? 3,
    RiskStatus:           risk.RiskStatus || "Open",
    RiskAppetiteBreached: risk.RiskAppetiteBreached ?? false,
    MitigationSummary:    risk.MitigationSummary || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  const score = (form.LikelihoodScore || 0) * (form.ImpactScore || 0);
  const sc = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.muted }}>{risk.Title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Likelihood (1–5)</label>
          <select value={form.LikelihoodScore} onChange={e => set("LikelihoodScore", Number(e.target.value))} style={inp}>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Impact (1–5)</label>
          <select value={form.ImpactScore} onChange={e => set("ImpactScore", Number(e.target.value))} style={inp}>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>Risk Score:</span>
        <span style={{ background: sc, color: "#fff", borderRadius: 7, padding: "3px 10px", fontSize: 13, fontWeight: 900 }}>{score}</span>
      </div>
      <div>
        <label style={lbl}>Risk Status</label>
        <select value={form.RiskStatus} onChange={e => set("RiskStatus", e.target.value)} style={inp}>
          {["Open","In Progress","Mitigated","Closed"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="grc-breach" checked={!!form.RiskAppetiteBreached} onChange={e => set("RiskAppetiteBreached", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="grc-breach" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Risk appetite breached</label>
      </div>
      <div>
        <label style={lbl}>Mitigation Summary</label>
        <textarea value={form.MitigationSummary} onChange={e => set("MitigationSummary", e.target.value)} rows={3} placeholder="Describe mitigation actions…" style={{ ...inp, resize: "vertical" }} />
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Risk"}
        </button>
      </div>
    </div>
  );
};

// ── Edit Risk Appetite form ───────────────────────────────────────
const GRCAppetiteForm = ({ item, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID:                   item.ID,
    CurrentExposureScore: item.CurrentExposureScore ?? 0,
    AppetiteStatus:       item.AppetiteStatus || "Within Appetite",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px" }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Category</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{item.RiskCategory}</div>
        {item.AppetiteStatement && <div style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>"{item.AppetiteStatement}"</div>}
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Max tolerable score: {item.MaxTolerableScore}</div>
      </div>
      <div>
        <label style={lbl}>Current Exposure Score</label>
        <input type="number" min="0" value={form.CurrentExposureScore} onChange={e => set("CurrentExposureScore", Number(e.target.value))} style={inp} />
      </div>
      <div>
        <label style={lbl}>Appetite Status</label>
        <select value={form.AppetiteStatus} onChange={e => set("AppetiteStatus", e.target.value)} style={inp}>
          {["Within Appetite","Near Limit","Breached"].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Appetite"}
        </button>
      </div>
    </div>
  );
};

// ── Sparkline: tiny inline trend chart for the KRI table ─────────
// Direction-aware: green = improving, red = worsening, neutral = flat.
// Uses the KRI's ThresholdDirection so colour reflects business meaning
// (CSAT going up = good, incidents going up = bad).
const Sparkline = ({ readings, direction, width = 72, height = 22, color = "#003932" }) => {
  if (!readings || readings.length < 2) {
    return <span style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>—</span>;
  }
  const data = readings.slice(-5);
  const values = data.map(r => Number(r.ActualValue)).filter(Number.isFinite);
  if (values.length < 2) {
    return <span style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic" }}>—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last  = values[values.length - 1];
  const first = values[0];
  const higherIsBetter = direction === "Higher is better";
  let lineColor = color;
  if (last !== first) {
    const improving = higherIsBetter ? last > first : last < first;
    lineColor = improving ? "#16a34a" : "#dc2626";
  }
  // Smooth path via Catmull-Rom → cubic Bezier. Curve passes through every
  // reading and bends gently between them — no sharp corners.
  const pts = values.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  let path = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const tension = 6; // higher = tighter (less curvy); 6 is a sweet spot
    const c1x = p1[0] + (p2[0] - p0[0]) / tension;
    const c1y = p1[1] + (p2[1] - p0[1]) / tension;
    const c2x = p2[0] - (p3[0] - p1[0]) / tension;
    const c2y = p2[1] - (p3[1] - p1[1]) / tension;
    path += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const lastPt = pts[pts.length - 1];
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={path}
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2" fill={lineColor} />
    </svg>
  );
};

// ── Multi-select dropdown ─────────────────────────────────────────
const MultiSelect = ({ label, options, selected, onChange }) => {
  const T = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  const active = selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          background: active ? T.primary : T.surface,
          color: active ? "#fff" : T.text,
          border: `1px solid ${active ? T.primary : T.border}`,
          borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6,
        }}>
        <span>{label}{active ? ` · ${selected.length}` : ""}</span>
        <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
          boxShadow: "0 6px 22px rgba(0,0,0,0.12)", minWidth: 220, maxHeight: 320, overflowY: "auto", padding: 6,
        }}>
          {options.length === 0 && <div style={{ padding: 10, fontSize: 12, color: T.muted }}>No options</div>}
          {options.map(opt => (
            <label key={opt} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
              borderRadius: 6, cursor: "pointer", fontSize: 12, color: T.text,
              background: selected.includes(opt) ? `${T.primary}14` : "transparent",
            }}
              onMouseEnter={e => e.currentTarget.style.background = selected.includes(opt) ? `${T.primary}22` : T.bg}
              onMouseLeave={e => e.currentTarget.style.background = selected.includes(opt) ? `${T.primary}14` : "transparent"}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} style={{ cursor: "pointer", margin: 0 }} />
              <span style={{ flex: 1 }}>{opt}</span>
            </label>
          ))}
          {active && (
            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 6 }}>
              <button onClick={() => onChange([])} style={{ width: "100%", background: "transparent", border: "none", color: T.muted, fontSize: 11, padding: "5px", cursor: "pointer", fontWeight: 600 }}>Clear selection</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Edit / Create KRI Master form ─────────────────────────────────
const GRCMasterForm = ({ kri, onSave, saving, error, onCancel }) => {
  const T = useT();
  const isNew = kri.ID == null;
  const [form, setForm] = useState({
    ID: kri.ID,
    Title: kri.Title || "",
    KRIID: kri.KRIID || "",
    KRICategory: kri.KRICategory || "Operational",
    BusinessUnit: kri.BusinessUnit || "",
    SubCategory: kri.SubCategory || "",
    RiskCategoryL1: kri.RiskCategoryL1 || "",
    Metric: kri.Metric || "",
    BaseData: kri.BaseData || "",
    DataSource: kri.DataSource || "",
    MeasurementUnit: kri.MeasurementUnit || "",
    GreenThreshold: kri.GreenThreshold ?? "",
    AmberThreshold: kri.AmberThreshold ?? "",
    RedThreshold: kri.RedThreshold ?? "",
    ThresholdDirection: kri.ThresholdDirection || "Lower is better",
    ReportingFrequency: kri.ReportingFrequency || "Monthly",
    IsActive: kri.IsActive !== false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={lbl}>KRI Name *</label>
          <input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} placeholder="e.g. Delay in patch deployment" />
        </div>
        <div>
          <label style={lbl}>KRI ID</label>
          <input value={form.KRIID} onChange={e => set("KRIID", e.target.value)} style={{ ...inp, ...(isNew ? {} : { background: T.bg, cursor: "not-allowed" }) }} disabled={!isNew} placeholder="auto" />
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
          <input type="checkbox" id="kri-active-top" checked={form.IsActive} onChange={e => set("IsActive", e.target.checked)} style={{ cursor: "pointer" }} />
          <label htmlFor="kri-active-top" style={{ fontSize: 13, color: T.text, cursor: "pointer", marginBottom: 8 }}>Active KRI</label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Category</label>
          <select value={form.KRICategory} onChange={e => set("KRICategory", e.target.value)} style={inp}>
            {["Financial","Operational","Compliance","Conduct of Business","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Business Unit / Department</label>
          <input value={form.BusinessUnit} onChange={e => set("BusinessUnit", e.target.value)} placeholder="e.g. Claims, Cyber, Marketing" style={inp} />
        </div>
        <div>
          <label style={lbl}>Risk Category (Level 1)</label>
          <input value={form.RiskCategoryL1} onChange={e => set("RiskCategoryL1", e.target.value)} placeholder="e.g. Regulatory & AML" style={inp} />
        </div>
        <div>
          <label style={lbl}>Sub-Category (Level 2)</label>
          <input value={form.SubCategory} onChange={e => set("SubCategory", e.target.value)} placeholder="e.g. Regulatory, Fraud" style={inp} />
        </div>
      </div>
      <div>
        <label style={lbl}>Metric (calculation formula)</label>
        <textarea value={form.Metric} onChange={e => set("Metric", e.target.value)} rows={2} placeholder="e.g. (Delayed closure complaints / Total closed complaints) * 100" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div>
        <label style={lbl}>Base Data</label>
        <textarea value={form.BaseData} onChange={e => set("BaseData", e.target.value)} rows={2} placeholder="What raw data is needed to compute this KRI" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Data Source</label>
          <input value={form.DataSource} onChange={e => set("DataSource", e.target.value)} placeholder="e.g. Compliance Department, Ziwo, Medallia" style={inp} />
        </div>
        <div>
          <label style={lbl}>Unit (%, Count, Days…)</label>
          <input value={form.MeasurementUnit} onChange={e => set("MeasurementUnit", e.target.value)} placeholder="e.g. %" style={inp} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div><label style={lbl}>Green Threshold</label><input value={form.GreenThreshold} onChange={e => set("GreenThreshold", e.target.value)} placeholder="e.g. 0 or <5%" style={inp} /></div>
        <div><label style={lbl}>Amber Threshold</label><input value={form.AmberThreshold} onChange={e => set("AmberThreshold", e.target.value)} placeholder="e.g. - or In Between" style={inp} /></div>
        <div><label style={lbl}>Red Threshold</label><input value={form.RedThreshold} onChange={e => set("RedThreshold", e.target.value)} placeholder="e.g. >=1 or >10%" style={inp} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Threshold Direction</label>
          <select value={form.ThresholdDirection} onChange={e => set("ThresholdDirection", e.target.value)} style={inp}>
            <option>Lower is better</option>
            <option>Higher is better</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Reporting Frequency</label>
          <select value={form.ReportingFrequency} onChange={e => set("ReportingFrequency", e.target.value)} style={inp}>
            <option>Monthly</option>
            <option>Quarterly</option>
            <option>Semi-Annual</option>
            <option>Annual</option>
          </select>
        </div>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>{saving ? "Saving…" : (isNew ? "Create KRI" : "Save Changes")}</button>
      </div>
    </div>
  );
};

// ── Add new Risk form ─────────────────────────────────────────────
const GRCNewRiskForm = ({ onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({ Title: "", RiskCategory: "Operational", BusinessUnit: "", LikelihoodScore: 3, ImpactScore: 3, RiskStatus: "Open", RiskAppetiteBreached: false, MitigationSummary: "", NextReviewDate: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  const score = (form.LikelihoodScore || 0) * (form.ImpactScore || 0);
  const sc = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Risk Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} placeholder="Describe the risk…" style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>Category</label>
          <select value={form.RiskCategory} onChange={e => set("RiskCategory", e.target.value)} style={inp}>
            {["Financial","Operational","Compliance","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Business Unit</label><input value={form.BusinessUnit} onChange={e => set("BusinessUnit", e.target.value)} placeholder="Optional" style={inp} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Likelihood (1–5)</label><select value={form.LikelihoodScore} onChange={e => set("LikelihoodScore", Number(e.target.value))} style={inp}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><label style={lbl}>Impact (1–5)</label><select value={form.ImpactScore} onChange={e => set("ImpactScore", Number(e.target.value))} style={inp}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: T.muted }}>Risk Score:</span>
        <span style={{ background: sc, color: "#fff", borderRadius: 7, padding: "3px 10px", fontSize: 13, fontWeight: 900 }}>{score}</span>
      </div>
      <div><label style={lbl}>Risk Status</label><select value={form.RiskStatus} onChange={e => set("RiskStatus", e.target.value)} style={inp}>{["Open","In Progress","Mitigated","Closed"].map(s => <option key={s}>{s}</option>)}</select></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="nr-breach" checked={form.RiskAppetiteBreached} onChange={e => set("RiskAppetiteBreached", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="nr-breach" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Risk appetite breached</label>
      </div>
      <div><label style={lbl}>Mitigation Summary</label><textarea value={form.MitigationSummary} onChange={e => set("MitigationSummary", e.target.value)} rows={3} placeholder="Describe mitigation actions…" style={{ ...inp, resize: "vertical" }} /></div>
      <div><label style={lbl}>Next Review Date</label><input type="date" value={form.NextReviewDate} onChange={e => set("NextReviewDate", e.target.value)} style={inp} /></div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>{saving ? "Saving…" : "Add Risk"}</button>
      </div>
    </div>
  );
};

// ── Add new Risk Appetite category form ───────────────────────────
const GRCNewAppetiteForm = ({ onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({ RiskCategory: "", AppetiteStatement: "", MaxTolerableScore: 10, CurrentExposureScore: 0, AppetiteStatus: "Within Appetite" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={lbl}>Risk Category *</label>
        <select value={form.RiskCategory} onChange={e => set("RiskCategory", e.target.value)} style={inp}>
          <option value="">— Select —</option>
          {["Financial","Operational","Compliance","IT","Strategic","Reputational"].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div><label style={lbl}>Appetite Statement</label><textarea value={form.AppetiteStatement} onChange={e => set("AppetiteStatement", e.target.value)} rows={2} placeholder="We accept…" style={{ ...inp, resize: "vertical" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Max Tolerable Score</label><input type="number" min="1" value={form.MaxTolerableScore} onChange={e => set("MaxTolerableScore", Number(e.target.value))} style={inp} /></div>
        <div><label style={lbl}>Current Exposure Score</label><input type="number" min="0" value={form.CurrentExposureScore} onChange={e => set("CurrentExposureScore", Number(e.target.value))} style={inp} /></div>
      </div>
      <div><label style={lbl}>Appetite Status</label><select value={form.AppetiteStatus} onChange={e => set("AppetiteStatus", e.target.value)} style={inp}>{["Within Appetite","Near Limit","Breached"].map(s => <option key={s}>{s}</option>)}</select></div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.RiskCategory} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.RiskCategory ? "not-allowed" : "pointer", opacity: saving || !form.RiskCategory ? 0.6 : 1 }}>{saving ? "Saving…" : "Add Category"}</button>
      </div>
    </div>
  );
};

const GRCAuditFindingForm = ({ item = null, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: item?.ID || null,
    Title: item?.Title || "",
    FindingSeverity: item?.FindingSeverity || "Medium",
    BusinessUnit: item?.BusinessUnit || "",
    Status: item?.Status || "Open",
    DueDate: item?.DueDate ? item.DueDate.substring(0, 10) : "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Finding Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Severity</label>
          <select value={form.FindingSeverity} onChange={e => set("FindingSeverity", e.target.value)} style={inp}>
            {["Critical","High","Medium","Low"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Status</label>
          <select value={form.Status} onChange={e => set("Status", e.target.value)} style={inp}>
            {["Open","In Progress","Closed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Business Unit</label><input value={form.BusinessUnit} onChange={e => set("BusinessUnit", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Due Date</label><input type="date" value={form.DueDate} onChange={e => set("DueDate", e.target.value)} style={inp} /></div>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>
          {saving ? "Saving…" : item ? "Update Finding" : "Add Finding"}
        </button>
      </div>
    </div>
  );
};

const GRCCorrectiveActionForm = ({ item = null, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: item?.ID || null,
    Title: item?.Title || "",
    Status: item?.Status || "Not Started",
    CompletionPercentage: item?.CompletionPercentage ?? 0,
    TargetDate: item?.TargetDate ? item.TargetDate.substring(0, 10) : "",
    LinkedFindingID: item?.LinkedFindingID || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box", fontFamily: "inherit" };
  const pct = Math.min(100, Math.max(0, Number(form.CompletionPercentage) || 0));
  const pc  = pct >= 70 ? "#00c48c" : pct >= 30 ? "#f5a623" : "#dc2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Action Title *</label><input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><label style={lbl}>Status</label>
          <select value={form.Status} onChange={e => set("Status", e.target.value)} style={inp}>
            {["Not Started","In Progress","Completed"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Target Date</label><input type="date" value={form.TargetDate} onChange={e => set("TargetDate", e.target.value)} style={inp} /></div>
        <div><label style={lbl}>Linked Finding ID</label><input value={form.LinkedFindingID} onChange={e => set("LinkedFindingID", e.target.value)} style={inp} placeholder="Optional" /></div>
      </div>
      <div>
        <label style={lbl}>Completion % — <span style={{ color: pc, fontWeight: 900 }}>{pct}%</span></label>
        <input type="range" min="0" max="100" step="5" value={pct} onChange={e => set("CompletionPercentage", Number(e.target.value))} style={{ width: "100%", accentColor: pc, cursor: "pointer" }} />
        <div style={{ background: T.border, borderRadius: 4, height: 6, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pc, borderRadius: 4, transition: "width 0.15s" }} />
        </div>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>
          {saving ? "Saving…" : item ? "Update Action" : "Add Action"}
        </button>
      </div>
    </div>
  );
};

const GRCDashboard = ({ canEdit = false }) => {
  const T   = useT();
  const bp  = useBp();
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState("");
  const [kriMaster,        setKriMaster]        = useState([]);
  const [kriReadings,      setKriReadings]      = useState([]);
  const [riskReg,          setRiskReg]          = useState([]);
  const [appetite,         setAppetite]         = useState([]);
  const [auditFindings,    setAuditFindings]    = useState([]);
  const [correctiveActions,setCorrectiveActions]= useState([]);
  const [selectedKRI, setSelectedKRI] = useState(null);
  // Edit modals
  const [readingModal,    setReadingModal]    = useState(null);
  const [riskModal,       setRiskModal]       = useState(null);
  const [appetiteModal,   setAppetiteModal]   = useState(null);
  const [masterModal,     setMasterModal]     = useState(null);
  const [newRiskModal,    setNewRiskModal]     = useState(false);
  const [newAppetiteModal,setNewAppetiteModal] = useState(false);
  const [afEditModal,     setAfEditModal]      = useState(null);
  const [afNewModal,      setAfNewModal]       = useState(false);
  const [caEditModal,     setCaEditModal]      = useState(null);
  const [caNewModal,      setCaNewModal]       = useState(false);
  const [globalEdit, setGlobalEdit] = useState(false);
  const [heatmapCell, setHeatmapCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  // KRI table filters
  const [kriSearch,  setKriSearch]  = useState("");
  const [filterDept, setFilterDept] = useState([]);
  const [filterCat,  setFilterCat]  = useState([]);
  const [filterSub,  setFilterSub]  = useState([]);
  const [filterRAG,  setFilterRAG]  = useState([]);
  const [editingReading, setEditingReading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    if (isUsingMock()) {
      setKriMaster([]); setKriReadings([]); setRiskReg([]);
      setAppetite([]); setAuditFindings([]); setCorrectiveActions([]);
      setLoading(false);
      return;
    }
    try {
      const token   = await acquireSpToken();
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata" };
      const base    = `${GRC_SP_SITE}/_api/web/lists/getbytitle`;
      const [mR, rR, rrR, aR, afR, caR] = await Promise.all([
        fetch(`${base}('GRC_KRI_Master')/items?$select=ID,Title,KRIID,KRICategory,KRIOwner/Title,BusinessUnit,MeasurementUnit,GreenThreshold,AmberThreshold,RedThreshold,ThresholdDirection,IsActive,SubCategory,RiskCategoryL1,Metric,BaseData,DataSource,ReportingFrequency&$expand=KRIOwner&$top=500`, { headers }),
        fetch(`${base}('GRC_KRI_Readings')/items?$select=ID,Title,KRIID,KRIName,ReadingDate,ActualValue,PreviousValue,Period,RAGStatus,Trend,Comments,EscalationRequired,Justification,ActionPlan&$orderby=ReadingDate desc&$top=2000`, { headers }),
        fetch(`${base}('GRC_RiskRegister')/items?$select=ID,Title,RiskID,RiskCategory,RiskOwner/Title,BusinessUnit,LikelihoodScore,ImpactScore,RiskStatus,RiskAppetiteBreached,NextReviewDate,MitigationSummary&$expand=RiskOwner&$top=500`, { headers }),
        fetch(`${base}('GRC_RiskAppetite')/items?$select=ID,Title,RiskCategory,AppetiteStatement,MaxTolerableScore,CurrentExposureScore,AppetiteStatus&$top=500`, { headers }),
        fetch(`${base}('GRC_AuditFindings')/items?$select=ID,Title,FindingSeverity,BusinessUnit,Status,DueDate&$top=500`, { headers }),
        fetch(`${base}('GRC_CorrectiveActions')/items?$select=ID,Title,Status,CompletionPercentage,TargetDate,LinkedFindingID&$top=500`, { headers }),
      ]);
      const [m, r, rr, a, af, ca] = await Promise.all([mR.json(), rR.json(), rrR.json(), aR.json(), afR.json(), caR.json()]);
      setKriMaster(m.value          || []);
      setKriReadings(r.value        || []);
      setRiskReg(rr.value           || []);
      setAppetite(a.value           || []);
      setAuditFindings(af.value     || []);
      setCorrectiveActions(ca.value || []);
    } catch(e) { setError(e.message); }
    finally    { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── SP Write helpers ──────────────────────────────────────────
  const spPost = async (listName, data) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
  const spPatch = async (listName, id, data) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items(${id})`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata", "IF-MATCH": "*", "X-HTTP-Method": "MERGE" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
  };
  const spDelete = async (listName, id) => {
    const token = await acquireSpToken();
    const res = await fetch(`${GRC_SP_SITE}/_api/web/lists/getbytitle('${listName}')/items(${id})`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json;odata=nometadata", "Content-Type": "application/json;odata=nometadata", "IF-MATCH": "*", "X-HTTP-Method": "DELETE" },
    });
    if (!res.ok) throw new Error(await res.text());
  };

  // ── Save handlers ─────────────────────────────────────────────
  const saveReading = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const payload = {
        Title:               `${form.KRIID}-${form.Period}`,
        KRIID:               form.KRIID,
        KRIName:             form.KRIName,
        ReadingDate:         new Date().toISOString(),
        ActualValue:         Number(form.ActualValue),
        PreviousValue:       form.PreviousValue !== "" && form.PreviousValue != null ? Number(form.PreviousValue) : null,
        Period:              form.Period,
        RAGStatus:           form.RAGStatus,
        Trend:               form.Trend,
        Comments:            form.Comments || "",
        Justification:       form.Justification || "",
        ActionPlan:          form.ActionPlan || "",
        EscalationRequired:  form.EscalationRequired,
      };
      if (form.ID == null) await spPost("GRC_KRI_Readings", payload);
      else                 await spPatch("GRC_KRI_Readings", form.ID, payload);
      setReadingModal(null);
      setEditingReading(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteReading = async (r) => {
    if (!window.confirm(`Delete reading for ${r.Period}?`)) return;
    setSaving(true);
    try { await spDelete("GRC_KRI_Readings", r.ID); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const saveRisk = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPatch("GRC_RiskRegister", form.ID, {
        LikelihoodScore:    Number(form.LikelihoodScore),
        ImpactScore:        Number(form.ImpactScore),
        RiskStatus:         form.RiskStatus,
        RiskAppetiteBreached: form.RiskAppetiteBreached,
        MitigationSummary:  form.MitigationSummary || "",
      });
      setRiskModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveAppetite = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPatch("GRC_RiskAppetite", form.ID, {
        CurrentExposureScore: Number(form.CurrentExposureScore),
        AppetiteStatus:       form.AppetiteStatus,
      });
      setAppetiteModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveMasterEdit = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const payload = {
        Title:              form.Title,
        KRIID:              form.KRIID || "",
        KRICategory:        form.KRICategory,
        BusinessUnit:       form.BusinessUnit || "",
        SubCategory:        form.SubCategory || "",
        RiskCategoryL1:     form.RiskCategoryL1 || "",
        Metric:             form.Metric || "",
        BaseData:           form.BaseData || "",
        DataSource:         form.DataSource || "",
        MeasurementUnit:    form.MeasurementUnit || "",
        GreenThreshold:     form.GreenThreshold || "",
        AmberThreshold:     form.AmberThreshold || "",
        RedThreshold:       form.RedThreshold   || "",
        ThresholdDirection: form.ThresholdDirection,
        ReportingFrequency: form.ReportingFrequency || "Monthly",
        IsActive:           form.IsActive,
      };
      if (form.ID == null) await spPost("GRC_KRI_Master", payload);
      else                 await spPatch("GRC_KRI_Master", form.ID, payload);
      setMasterModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteKRI = async (kri) => {
    if (!window.confirm(`Delete KRI "${kri.Title}"?\n\nThis cannot be undone.`)) return;
    setSaving(true);
    try { await spDelete("GRC_KRI_Master", kri.ID); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const handleAddKRI = () => {
    // Auto-generate next KRI-XXX id
    const nums = kriMaster.map(k => parseInt((k.KRIID || "").replace(/^KRI-/, ""), 10)).filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    setMasterModal({ ID: null, KRIID: "KRI-" + String(next).padStart(3, "0"), IsActive: true });
    setSaveErr("");
  };

  const deleteRisk = async (id) => {
    if (!window.confirm("Delete this risk? This cannot be undone.")) return;
    setSaving(true); setSaveErr("");
    try { await spDelete("GRC_RiskRegister", id); await load(); }
    catch(e) { setSaveErr(e.message); }
    finally  { setSaving(false); }
  };

  const deleteAppetite = async (id) => {
    if (!window.confirm("Delete this appetite category? This cannot be undone.")) return;
    setSaving(true); setSaveErr("");
    try { await spDelete("GRC_RiskAppetite", id); await load(); }
    catch(e) { setSaveErr(e.message); }
    finally  { setSaving(false); }
  };

  const saveNewRisk = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPost("GRC_RiskRegister", {
        Title:                form.Title,
        RiskCategory:         form.RiskCategory,
        BusinessUnit:         form.BusinessUnit || "",
        LikelihoodScore:      Number(form.LikelihoodScore),
        ImpactScore:          Number(form.ImpactScore),
        RiskStatus:           form.RiskStatus,
        RiskAppetiteBreached: form.RiskAppetiteBreached,
        MitigationSummary:    form.MitigationSummary || "",
        NextReviewDate:       form.NextReviewDate || null,
      });
      setNewRiskModal(false);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveNewAppetite = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      await spPost("GRC_RiskAppetite", {
        Title:                form.RiskCategory,
        RiskCategory:         form.RiskCategory,
        AppetiteStatement:    form.AppetiteStatement || "",
        MaxTolerableScore:    Number(form.MaxTolerableScore),
        CurrentExposureScore: Number(form.CurrentExposureScore),
        AppetiteStatus:       form.AppetiteStatus,
      });
      setNewAppetiteModal(false);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const saveAuditFinding = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const data = { Title: form.Title, FindingSeverity: form.FindingSeverity, BusinessUnit: form.BusinessUnit || "", Status: form.Status, DueDate: form.DueDate || null };
      if (form.ID) { await spPatch("GRC_AuditFindings", form.ID, data); setAfEditModal(null); }
      else         { await spPost("GRC_AuditFindings", data);           setAfNewModal(false); }
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteAuditFinding = async (id) => {
    if (!window.confirm("Delete this audit finding?")) return;
    setSaving(true);
    try { await spDelete("GRC_AuditFindings", id); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const saveCorrectiveAction = async (form) => {
    setSaving(true); setSaveErr("");
    try {
      const data = { Title: form.Title, Status: form.Status, CompletionPercentage: Number(form.CompletionPercentage), TargetDate: form.TargetDate || null, LinkedFindingID: form.LinkedFindingID || "" };
      if (form.ID) { await spPatch("GRC_CorrectiveActions", form.ID, data); setCaEditModal(null); }
      else         { await spPost("GRC_CorrectiveActions", data);           setCaNewModal(false); }
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
  };

  const deleteCorrectiveAction = async (id) => {
    if (!window.confirm("Delete this corrective action?")) return;
    setSaving(true);
    try { await spDelete("GRC_CorrectiveActions", id); await load(); }
    catch(e) { window.alert(e.message); }
    finally  { setSaving(false); }
  };

  const activeKRIs = useMemo(() => kriMaster.filter(k => k.IsActive !== false), [kriMaster]);

  const latestByKRI = useMemo(() => {
    // Compare by Period (chronological), not ReadingDate.
    // ReadingDate is often the same for bulk-imported historical readings,
    // which made "latest" pick the wrong row.
    const periodMs = (p) => {
      if (!p) return -Infinity;
      // Monthly YYYY-MM
      if (/^\d{4}-\d{2}$/.test(p)) {
        const [y, m] = p.split("-");
        return new Date(Number(y), Number(m) - 1, 1).getTime();
      }
      // Quarterly YYYY-QN
      let mm = p.match(/^(\d{4})-Q([1-4])$/i);
      if (mm) return new Date(Number(mm[1]), (Number(mm[2]) - 1) * 3, 1).getTime();
      // Semi-annual YYYY-HN
      mm = p.match(/^(\d{4})-H([12])$/i);
      if (mm) return new Date(Number(mm[1]), Number(mm[2]) === 1 ? 0 : 6, 1).getTime();
      // Annual YYYY
      if (/^\d{4}$/.test(p)) return new Date(Number(p), 0, 1).getTime();
      return -Infinity;
    };
    const map = {};
    kriReadings.forEach(r => {
      const cur = map[r.KRIID];
      if (!cur || periodMs(r.Period) > periodMs(cur.Period)) map[r.KRIID] = r;
    });
    return map;
  }, [kriReadings]);

  // Pre-bucket readings per KRI sorted by Period — used for sparklines + history queries
  const readingsByKRI = useMemo(() => {
    const map = {};
    kriReadings.forEach(r => {
      if (!r.KRIID) return;
      if (!map[r.KRIID]) map[r.KRIID] = [];
      map[r.KRIID].push(r);
    });
    Object.keys(map).forEach(id => {
      map[id].sort((a, b) => (a.Period || "").localeCompare(b.Period || ""));
    });
    return map;
  }, [kriReadings]);

  const kriWithLatest = useMemo(() =>
    activeKRIs.map(k => ({
      ...k,
      latest: latestByKRI[k.KRIID] || null,
      readings: readingsByKRI[k.KRIID] || [],
    })),
    [activeKRIs, latestByKRI, readingsByKRI]
  );

  // Per-department summary — for the cards row above the table
  const deptSummary = useMemo(() => {
    const groups = {};
    kriWithLatest.forEach(k => {
      const d = k.BusinessUnit || "Other";
      if (!groups[d]) groups[d] = { name: d, kris: [], red: 0, amber: 0, green: 0, noReading: 0, latestPeriod: "" };
      groups[d].kris.push(k);
      const rag = k.latest?.RAGStatus;
      if (rag === "Red")        groups[d].red++;
      else if (rag === "Amber") groups[d].amber++;
      else if (rag === "Green") groups[d].green++;
      else                      groups[d].noReading++;
      if (k.latest?.Period && k.latest.Period > groups[d].latestPeriod) groups[d].latestPeriod = k.latest.Period;
    });
    return Object.values(groups)
      .map(g => ({ ...g, total: g.kris.length, greenPct: g.kris.length ? Math.round((g.green / g.kris.length) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [kriWithLatest]);

  // Filter option lists — derived from the full active set so users can always pick any value
  const deptOptions = useMemo(() => [...new Set(activeKRIs.map(k => k.BusinessUnit).filter(Boolean))].sort(), [activeKRIs]);
  const catOptions  = useMemo(() => [...new Set(activeKRIs.map(k => k.KRICategory).filter(Boolean))].sort(), [activeKRIs]);
  const subOptions  = useMemo(() => [...new Set(activeKRIs.map(k => k.SubCategory).filter(Boolean))].sort(), [activeKRIs]);
  const ragOptions  = ["Red", "Amber", "Green", "No reading"];

  const filteredKRIs = useMemo(() => {
    const q = kriSearch.toLowerCase().trim();
    return kriWithLatest.filter(k => {
      if (filterDept.length && !filterDept.includes(k.BusinessUnit))   return false;
      if (filterCat.length  && !filterCat.includes(k.KRICategory))     return false;
      if (filterSub.length  && !filterSub.includes(k.SubCategory))     return false;
      if (filterRAG.length) {
        const rag = k.latest?.RAGStatus || "No reading";
        if (!filterRAG.includes(rag)) return false;
      }
      if (q) {
        const hay = [k.Title, k.KRIID, k.BusinessUnit, k.SubCategory, k.Metric, k.DataSource].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [kriWithLatest, kriSearch, filterDept, filterCat, filterSub, filterRAG]);

  const anyFilterActive = filterDept.length + filterCat.length + filterSub.length + filterRAG.length > 0 || kriSearch.trim() !== "";
  const clearAllFilters = () => { setFilterDept([]); setFilterCat([]); setFilterSub([]); setFilterRAG([]); setKriSearch(""); };

  // KPI counts use the filtered list so they always match what the user sees in the table
  const redCount    = filteredKRIs.filter(k => k.latest?.RAGStatus === "Red").length;
  const amberCount  = filteredKRIs.filter(k => k.latest?.RAGStatus === "Amber").length;
  const greenCount  = filteredKRIs.filter(k => k.latest?.RAGStatus === "Green").length;
  const escalCount  = filteredKRIs.filter(k => k.latest?.EscalationRequired).length;
  const appBreaches = riskReg.filter(r => r.RiskAppetiteBreached && r.RiskStatus !== "Closed").length;

  const parsePeriodToDate = (period) => {
    if (!period) return null;
    // Monthly: YYYY-MM
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1);
    }
    // Quarterly: YYYY-QN  (Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct)
    let m = period.match(/^(\d{4})-Q([1-4])$/i);
    if (m) return new Date(Number(m[1]), (Number(m[2]) - 1) * 3, 1);
    // Semi-annual: YYYY-HN
    m = period.match(/^(\d{4})-H([12])$/i);
    if (m) return new Date(Number(m[1]), Number(m[2]) === 1 ? 0 : 6, 1);
    // Annual: YYYY
    if (/^\d{4}$/.test(period)) return new Date(Number(period), 0, 1);
    const d = new Date(period);
    return isNaN(d.getTime()) ? null : d;
  };

  const fmtPeriod = (period) => {
    if (!period) return "";
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    }
    // Q / H / Y stay as-is — they're already short and readable
    return period;
  };

  const kriHistory = useMemo(() => {
    if (!selectedKRI) return [];
    // Deduplicate by Period — for the same period keep only the latest reading (by ReadingDate)
    const byPeriod = {};
    kriReadings
      .filter(r => r.KRIID === selectedKRI && r.ActualValue != null)
      .forEach(r => {
        const key = r.Period || (r.ReadingDate || "").substring(0, 7);
        if (!byPeriod[key] || (r.ReadingDate || "") > (byPeriod[key].ReadingDate || "")) {
          byPeriod[key] = r;
        }
      });
    return Object.values(byPeriod)
      .sort((a, b) => {
        const da = parsePeriodToDate(a.Period) || new Date(a.ReadingDate || 0);
        const db = parsePeriodToDate(b.Period) || new Date(b.ReadingDate || 0);
        return da - db;
      })
      .slice(-12);
  }, [kriReadings, selectedKRI]);

  const heatmapData = useMemo(() => {
    const cells = {};
    riskReg
      .filter(r => r.RiskStatus !== "Closed")
      .forEach(r => {
        const l = Number(r.LikelihoodScore);
        const i = Number(r.ImpactScore);
        if (l >= 1 && l <= 5 && i >= 1 && i <= 5) {
          const key = `${l}-${i}`;
          if (!cells[key]) cells[key] = [];
          cells[key].push(r.Title);
        }
      });
    return cells;
  }, [riskReg]);

  const printGRCReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
    const fmtScore = (l, i) => {
      const s = Number(l) * Number(i);
      if (s >= 15) return `<span style="color:#991b1b;font-weight:700">${s} Critical</span>`;
      if (s >= 9)  return `<span style="color:#b45309;font-weight:700">${s} High</span>`;
      if (s >= 4)  return `<span style="color:#854d0e">${s} Medium</span>`;
      return `<span style="color:#15803d">${s} Low</span>`;
    };
    const ragBadge = (rag) => {
      const c = { Red: "#dc2626", Amber: "#d97706", Green: "#16a34a" }[rag] || "#6b7280";
      return `<span style="display:inline-block;background:${c};color:#fff;border-radius:4px;padding:1px 8px;font-size:11px;font-weight:700">${rag || "—"}</span>`;
    };
    const sev = (s) => {
      const c = { Critical: "#dc2626", High: "#c2410c", Medium: "#d97706", Low: "#16a34a" }[s] || "#6b7280";
      return `<span style="color:${c};font-weight:700">${s || "—"}</span>`;
    };

    // Escape any HTML chars that might appear in narrative text fields, since
    // we splice them straight into the report markup.
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

    // Sort: Red first (most urgent), then Amber, then Green, then no-reading.
    const ragOrder = { Red: 0, Amber: 1, Green: 2 };
    const kriSorted = [...kriWithLatest].sort((a, b) => {
      const ra = ragOrder[a.latest?.RAGStatus] ?? 3;
      const rb = ragOrder[b.latest?.RAGStatus] ?? 3;
      return ra - rb;
    });

    const kriRows = kriSorted.map(k => {
      const r = k.latest;
      const trend = r?.Trend === "Improving" ? `<span style="color:#15803d">↑ Improving</span>`
                  : r?.Trend === "Worsening" ? `<span style="color:#991b1b">↓ Worsening</span>`
                  : r?.Trend === "Stable"    ? `<span style="color:#6b7280">→ Stable</span>`
                  : '<span style="color:#9ca3af">—</span>';
      const hasNarrative = !!(r?.Justification || r?.ActionPlan);
      const mainRow = `<tr class="kri-main">
        <td>
          <div class="kri-title">${esc(k.Title) || "—"}</div>
          <div class="kri-meta">${esc(k.BusinessUnit || k.KRIOwner?.Title || k.KRICategory || "")}</div>
        </td>
        <td>${esc(k.KRICategory) || "—"}</td>
        <td style="text-align:center"><span class="num">${esc(r?.ActualValue ?? "—")}</span> <span class="unit">${esc(k.MeasurementUnit || "")}</span></td>
        <td style="text-align:center">${ragBadge(r?.RAGStatus)}</td>
        <td style="text-align:center;font-size:10px">${trend}</td>
        <td style="text-align:center">${r?.EscalationRequired ? '<span style="color:#dc2626;font-weight:800">⚠ Yes</span>' : '<span style="color:#9ca3af">No</span>'}</td>
      </tr>`;
      const narrativeRow = hasNarrative ? `<tr class="kri-narrative"><td colspan="6">
        <div class="narrative-grid">
          ${r.Justification ? `<div class="narrative-cell"><div class="narrative-label">Justification</div><div class="narrative-body">${esc(r.Justification)}</div></div>` : ""}
          ${r.ActionPlan ? `<div class="narrative-cell action"><div class="narrative-label">Action Plan</div><div class="narrative-body">${esc(r.ActionPlan)}</div></div>` : ""}
        </div>
      </td></tr>` : "";
      return mainRow + narrativeRow;
    }).join("");

    const sortedRisks = [...riskReg]
      .filter(r => r.RiskStatus !== "Closed")
      .sort((a, b) => (Number(b.LikelihoodScore) * Number(b.ImpactScore)) - (Number(a.LikelihoodScore) * Number(a.ImpactScore)));
    const riskRows = sortedRisks.map(r => `<tr>
      <td>${r.Title || "—"}<br><span style="color:#6b7280;font-size:10px">${r.RiskOwner?.Title || ""} · ${r.BusinessUnit || ""}</span></td>
      <td>${r.RiskCategory || "—"}</td>
      <td style="text-align:center">${fmtScore(r.LikelihoodScore, r.ImpactScore)}</td>
      <td style="text-align:center">${r.RiskStatus || "—"}</td>
      <td style="text-align:center">${r.RiskAppetiteBreached ? '<span style="color:#dc2626;font-weight:700">⚠ Yes</span>' : "No"}</td>
      <td style="font-size:10px;color:#374151">${r.MitigationSummary || ""}</td>
    </tr>`).join("");

    const appRows = appetite.map(a => {
      const pct = a.MaxTolerableScore > 0 ? Math.min(100, Math.round((a.CurrentExposureScore / a.MaxTolerableScore) * 100)) : 0;
      const barColor = a.AppetiteStatus === "Breached" ? "#dc2626" : a.AppetiteStatus === "At Risk" ? "#d97706" : "#16a34a";
      const bar = `<div style="background:#e5e7eb;border-radius:4px;height:8px;width:100%;margin-top:4px"><div style="background:${barColor};height:8px;border-radius:4px;width:${pct}%"></div></div>`;
      return `<tr>
        <td>${a.RiskCategory || "—"}</td>
        <td style="font-size:10px">${a.AppetiteStatement || "—"}</td>
        <td style="text-align:center">${a.MaxTolerableScore ?? "—"}</td>
        <td style="text-align:center;font-weight:700">${a.CurrentExposureScore ?? "—"}</td>
        <td style="min-width:80px">${bar}<span style="font-size:10px;color:#6b7280">${pct}%</span></td>
        <td style="text-align:center"><span style="color:${barColor};font-weight:700">${a.AppetiteStatus || "—"}</span></td>
      </tr>`;
    }).join("");

    const bySev = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    auditFindings.forEach(f => { if (f.FindingSeverity in bySev) bySev[f.FindingSeverity]++; });
    const openAF = auditFindings.filter(f => f.Status !== "Closed").length;
    const afRows = auditFindings.map(f => `<tr>
      <td>${f.Title || "—"}</td>
      <td>${sev(f.FindingSeverity)}</td>
      <td>${f.BusinessUnit || "—"}</td>
      <td>${f.Status || "—"}</td>
      <td>${f.DueDate ? new Date(f.DueDate).toLocaleDateString("en-GB") : "—"}</td>
    </tr>`).join("");

    const caComplete = correctiveActions.filter(c => c.Status === "Completed").length;
    const caOpen = correctiveActions.filter(c => c.Status !== "Completed").length;
    const avgCompletion = correctiveActions.length > 0
      ? Math.round(correctiveActions.reduce((s, c) => s + (Number(c.CompletionPercentage) || 0), 0) / correctiveActions.length)
      : 0;
    const caRows = correctiveActions.map(c => {
      const pct = Number(c.CompletionPercentage) || 0;
      const overdue = c.TargetDate && new Date(c.TargetDate) < now && c.Status !== "Completed";
      return `<tr>
        <td>${c.Title || "—"}<br><span style="color:#6b7280;font-size:10px">Finding: ${c.LinkedFindingID || "—"}</span></td>
        <td style="text-align:center">
          <div style="background:#e5e7eb;border-radius:4px;height:8px;width:80px;display:inline-block;vertical-align:middle">
            <div style="background:${pct >= 100 ? "#16a34a" : "#003932"};height:8px;border-radius:4px;width:${Math.min(100,pct)}%"></div>
          </div> ${pct}%
        </td>
        <td>${c.Status || "—"}</td>
        <td style="${overdue ? "color:#dc2626;font-weight:700" : ""}">${c.TargetDate ? new Date(c.TargetDate).toLocaleDateString("en-GB") : "—"}${overdue ? " ⚠" : ""}</td>
      </tr>`;
    }).join("");

    // ─── Strategic command-centre data — three self-contained dashboard cards ───
    const asOfDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const criticalRisks = sortedRisks.filter(r => (Number(r.LikelihoodScore) * Number(r.ImpactScore)) >= 15).length;

    // KRI card — total + RAG breakdown + exposure
    const totalKRIs = kriWithLatest.length;
    const exposurePct = totalKRIs > 0 ? Math.round(((redCount + amberCount) / totalKRIs) * 100) : 0;
    const kriSegR = totalKRIs > 0 ? (redCount   / totalKRIs) * 100 : 0;
    const kriSegA = totalKRIs > 0 ? (amberCount / totalKRIs) * 100 : 0;
    const kriSegG = totalKRIs > 0 ? (greenCount / totalKRIs) * 100 : 0;
    const card1Headline = `${totalKRIs}`;
    const card1Subline  = `Active KRIs · ${deptOptions.length} business unit${deptOptions.length === 1 ? "" : "s"}`;
    const card1Insight  = redCount > 0
      ? `<span class="danger">${redCount} breaching</span> · exposure <strong>${exposurePct}%</strong> of indicator portfolio`
      : amberCount > 0
        ? `Watch: <strong>${amberCount} approaching limit</strong> · exposure <strong>${exposurePct}%</strong>`
        : (totalKRIs > 0 ? `All ${totalKRIs} within tolerance` : `No active KRIs`);

    // Open Risks card — severity breakdown (Critical/High/Medium/Low by L×I score)
    const riskBySeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    sortedRisks.forEach(r => {
      const s = Number(r.LikelihoodScore) * Number(r.ImpactScore);
      if (s >= 15)      riskBySeverity.Critical++;
      else if (s >= 9)  riskBySeverity.High++;
      else if (s >= 4)  riskBySeverity.Medium++;
      else              riskBySeverity.Low++;
    });
    const totalOpenRisks = sortedRisks.length;
    const rkSegC = totalOpenRisks > 0 ? (riskBySeverity.Critical / totalOpenRisks) * 100 : 0;
    const rkSegH = totalOpenRisks > 0 ? (riskBySeverity.High     / totalOpenRisks) * 100 : 0;
    const rkSegM = totalOpenRisks > 0 ? (riskBySeverity.Medium   / totalOpenRisks) * 100 : 0;
    const rkSegL = totalOpenRisks > 0 ? (riskBySeverity.Low      / totalOpenRisks) * 100 : 0;
    const card2Headline = `${totalOpenRisks}`;
    const card2Subline  = `Open risks · ${criticalRisks} Critical`;
    const card2Insight  = criticalRisks > 0
      ? `<span class="danger">${criticalRisks} Critical-score risk${criticalRisks === 1 ? "" : "s"} (≥15)</span>${appBreaches > 0 ? ` · <span class="danger">${appBreaches} appetite breach${appBreaches === 1 ? "" : "es"}</span>` : ""}`
      : appBreaches > 0
        ? `<span class="danger">${appBreaches} appetite breach${appBreaches === 1 ? "" : "es"} active</span>`
        : (totalOpenRisks > 0 ? `No Critical risks · appetite within bounds` : `Register clean`);

    // Audit card — severity breakdown + corrective progress
    const totalAF = auditFindings.length;
    const afSegC = totalAF > 0 ? (bySev.Critical / totalAF) * 100 : 0;
    const afSegH = totalAF > 0 ? (bySev.High     / totalAF) * 100 : 0;
    const afSegM = totalAF > 0 ? (bySev.Medium   / totalAF) * 100 : 0;
    const afSegL = totalAF > 0 ? (bySev.Low      / totalAF) * 100 : 0;
    const card3Headline = `${openAF}`;
    const card3Subline  = `Open finding${openAF === 1 ? "" : "s"} · ${totalAF} total`;
    const card3Insight  = (bySev.Critical + bySev.High) > 0
      ? `<span class="danger">${bySev.Critical + bySev.High} Critical/High severity</span>${correctiveActions.length > 0 ? ` · CAPs <strong>${avgCompletion}%</strong> complete` : ""}`
      : correctiveActions.length > 0
        ? `CAPs at <strong>${avgCompletion}% complete</strong> across ${correctiveActions.length} item${correctiveActions.length === 1 ? "" : "s"}`
        : (totalAF > 0 ? `All findings Medium/Low severity` : `No findings recorded`);

    const html = `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>GRC Risk Intelligence Report — ${dateStr}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #0d1f1c; background: #fff; line-height: 1.55; }

        /* ────── COVER ────── */
        .cover {
          background: linear-gradient(135deg, #001f1a 0%, #003932 50%, #007a62 100%);
          color: #fff;
          padding: 56px 56px 44px;
          position: relative;
          overflow: hidden;
        }
        .cover::after {
          content: '';
          position: absolute;
          bottom: -80px; right: -80px;
          width: 280px; height: 280px;
          background: rgba(0,184,148,0.10);
          border-radius: 50%;
        }
        .cover .classification {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(220,38,38,0.18); color: #fecaca;
          border: 1px solid rgba(220,38,38,0.35);
          padding: 4px 12px; border-radius: 16px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          margin-bottom: 18px;
        }
        .cover .crest {
          display: inline-flex; align-items: center; gap: 14px;
          margin-bottom: 14px;
        }
        .cover .crest .icon {
          font-size: 36px; line-height: 1;
          background: rgba(0,184,148,0.18);
          padding: 12px 14px; border-radius: 12px;
        }
        .cover h1 {
          font-size: 32px; font-weight: 900; letter-spacing: -0.8px; line-height: 1.05; margin-bottom: 8px;
        }
        .cover h1 em { color: #6ee7b7; font-style: normal; }
        .cover .sub {
          opacity: 0.78; font-size: 13px; font-weight: 400; max-width: 80%;
          margin-bottom: 28px;
        }
        .cover .meta { display: flex; gap: 40px; font-size: 11px; }
        .cover .meta .item .l { color: rgba(110,231,183,0.7); font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
        .cover .meta .item .v { font-weight: 600; }

        /* ────── EXEC SUMMARY ────── */
        .exec-summary {
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          padding: 36px 56px 40px;
          border-bottom: 1px solid #e2e8f0;
        }
        .exec-summary .head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 22px;
        }
        .exec-summary .label {
          font-size: 18px; font-weight: 900; color: #003932; letter-spacing: -0.4px;
          display: inline-flex; align-items: center; gap: 10px;
        }
        .exec-summary .label::before {
          content: ''; display: inline-block;
          width: 4px; height: 22px; background: #00b894; border-radius: 2px;
        }
        .exec-summary .as-of {
          font-size: 10.5px; color: #6b7280; font-weight: 600;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .exec-summary .es-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;
        }
        .es-card {
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 22px 24px 20px;
          position: relative; overflow: hidden;
          box-shadow: 0 1px 0 rgba(15,23,42,0.04);
          display: flex; flex-direction: column; gap: 14px;
        }
        .es-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: var(--accent);
        }
        .es-card.indicators { --accent: #003932; }
        .es-card.risks      { --accent: #d97706; }
        .es-card.audit      { --accent: #7c3aed; }
        .es-card .es-topic {
          display: flex; align-items: center; gap: 9px;
        }
        .es-card .es-icon {
          width: 30px; height: 30px; border-radius: 9px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 15px;
          background: rgba(0,57,50,0.08);
        }
        .es-card.risks .es-icon { background: rgba(217,119,6,0.12); }
        .es-card.audit .es-icon { background: rgba(124,58,237,0.12); }
        .es-card .es-topic-name {
          font-size: 10px; font-weight: 800; color: #475569;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
        .es-card .es-headline-row {
          display: flex; align-items: baseline; gap: 14px;
          padding-bottom: 4px;
        }
        .es-card .es-headline {
          font-family: 'JetBrains Mono', monospace;
          font-size: 44px; font-weight: 700; color: var(--accent);
          line-height: 1; letter-spacing: -1.5px;
        }
        .es-card .es-subline {
          font-size: 11.5px; color: #475569; font-weight: 600;
          line-height: 1.4;
        }
        /* Stacked proportion bar */
        .es-bar {
          display: flex; height: 7px; border-radius: 4px;
          background: #f1f5f9; overflow: hidden;
        }
        .es-bar-seg { height: 100%; transition: width 0.3s; }
        .es-bar-seg.red    { background: #dc2626; }
        .es-bar-seg.orange { background: #ea580c; }
        .es-bar-seg.amber  { background: #d97706; }
        .es-bar-seg.green  { background: #16a34a; }
        .es-bar-seg.purple { background: #7c3aed; }
        /* Mini breakdown chips */
        .es-chips {
          display: flex; gap: 14px; flex-wrap: wrap;
        }
        .es-chip { display: flex; align-items: center; gap: 6px; }
        .es-chip .dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .es-chip .dot.red    { background: #dc2626; }
        .es-chip .dot.orange { background: #ea580c; }
        .es-chip .dot.amber  { background: #d97706; }
        .es-chip .dot.green  { background: #16a34a; }
        .es-chip .num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px; font-weight: 700; color: #0d1f1c;
        }
        .es-chip .lbl {
          font-size: 10px; color: #6b7280; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .es-card .es-insight {
          font-size: 11.5px; line-height: 1.6; color: #1f2937;
          padding-top: 12px; border-top: 1px dashed #e2e8f0;
          margin-top: auto;
        }
        .es-card .es-insight strong { color: var(--accent); font-weight: 700; }
        .es-card .es-insight .danger { color: #991b1b; font-weight: 700; }

        /* ────── KPI GRID ────── */
        .kpi-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px;
          margin: 28px 56px 0;
        }
        .kpi {
          background: #fff; border: 1.5px solid #e2e8f0;
          border-radius: 12px; padding: 16px 18px;
          position: relative; overflow: hidden;
        }
        .kpi::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: var(--accent, #003932);
        }
        .kpi.red    { --accent: #dc2626; }
        .kpi.amber  { --accent: #d97706; }
        .kpi.green  { --accent: #16a34a; }
        .kpi.purple { --accent: #7c3aed; }
        .kpi.brand  { --accent: #003932; }
        .kpi .val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 28px; font-weight: 700; line-height: 1;
          color: var(--accent, #003932);
        }
        .kpi .lbl {
          font-size: 9.5px; color: #6b7280; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em;
          margin-top: 6px;
        }
        .kpi .desc {
          font-size: 10px; color: #94a3b8; margin-top: 2px;
          font-weight: 500;
        }

        /* ────── SECTIONS ────── */
        section { margin: 36px 56px 0; }
        section .section-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
          border-bottom: 2px solid #003932; padding-bottom: 8px;
        }
        section h2 {
          font-size: 15px; font-weight: 900; color: #003932; letter-spacing: -0.2px;
        }
        section h2 .icon { color: #00b894; margin-right: 6px; }
        section .section-meta {
          font-size: 11px; color: #6b7280; font-weight: 500;
        }

        /* ────── TABLES ────── */
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th {
          background: #f1f5f9; padding: 9px 12px; text-align: left;
          font-size: 9.5px; font-weight: 700; color: #475569;
          text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 2px solid #cbd5e1;
        }
        td {
          padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
        }
        tr.kri-main td { background: #fff; }
        tr:last-child td { border-bottom: none; }
        /* Strong divider between each KRI group (main row + optional narrative). */
        tbody tr.kri-main td { border-top: 2.5px solid #cbd5e1; padding-top: 14px; }
        tbody tr.kri-main:first-child td { border-top: none; padding-top: 10px; }
        .kri-title { font-weight: 700; color: #0d1f1c; font-size: 11.5px; line-height: 1.4; }
        .kri-meta  { font-size: 10px; color: #6b7280; margin-top: 2px; }
        .num       { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #0d1f1c; }
        .unit      { color: #94a3b8; font-size: 10px; }

        /* ────── KRI NARRATIVE ROW (replaces Comments) ────── */
        tr.kri-narrative td {
          padding: 0 12px 14px;
          background: #fafbfc !important;
          border-bottom: 1px solid #f1f5f9;
        }
        .narrative-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 0 0 6px;
        }
        .narrative-cell {
          background: #fff7ed;
          border-left: 3px solid #f59e0b;
          border-radius: 0 8px 8px 0;
          padding: 10px 14px;
        }
        .narrative-cell.action {
          background: #ecfdf5;
          border-left-color: #00b894;
        }
        .narrative-label {
          font-size: 9.5px; font-weight: 800; color: #92400e;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
        }
        .narrative-cell.action .narrative-label { color: #047857; }
        .narrative-body {
          font-size: 11px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;
        }

        /* ────── SEVERITY/STATUS CHIPS ────── */
        .rag-chip {
          display: inline-block; padding: 3px 10px; border-radius: 12px;
          font-size: 10px; font-weight: 800; color: #fff; min-width: 50px; text-align: center;
        }
        .rag-Red    { background: #dc2626; }
        .rag-Amber  { background: #d97706; }
        .rag-Green  { background: #16a34a; }

        /* ────── PROGRESS BARS ────── */
        .bar-wrap {
          display: inline-block; width: 100px; height: 8px;
          background: #e5e7eb; border-radius: 4px; vertical-align: middle;
          margin-right: 8px;
        }
        .bar-fill {
          height: 100%; border-radius: 4px;
        }

        /* ────── FOOTER ────── */
        .footer {
          margin: 56px 56px 28px;
          padding: 18px 0 0;
          border-top: 1px solid #e2e8f0;
          display: flex; justify-content: space-between;
          color: #94a3b8; font-size: 10px;
        }
        .footer .conf {
          font-weight: 700; color: #b45309;
          letter-spacing: 0.08em; text-transform: uppercase;
        }

        /* ────── PRINT ────── */
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          section { page-break-inside: avoid; }
          tr.kri-main { page-break-inside: avoid; }
          tr.kri-narrative { page-break-before: avoid; }
          .cover { page-break-after: avoid; }
        }
        @page { size: A4; margin: 0; }
      </style>
    </head><body>

      <!-- ════════════ COVER ════════════ -->
      <div class="cover">
        <div class="crest">
          <div class="icon"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8l5.2 1.9v4.1c0 3.3-2.3 5.6-5.2 6.6-2.9-1-5.2-3.3-5.2-6.6V3.7z"/></svg></div>
          <div>
            <h1>GRC Risk Intelligence<br><em>Quarterly Report</em></h1>
            <div class="sub">Key Risk Indicators · Risk Register · Risk Appetite · Audit Findings · Corrective Actions</div>
          </div>
        </div>
        <div class="meta">
          <div class="item"><div class="l">Generated</div><div class="v">${dateStr}</div></div>
          <div class="item"><div class="l">Source</div><div class="v">GRC Intelligence Dashboard</div></div>
          <div class="item"><div class="l">Scope</div><div class="v">${deptOptions.length} business units · ${kriWithLatest.length} KRIs</div></div>
        </div>
      </div>

      <!-- ════════════ EXECUTIVE COMMAND CENTRE ════════════ -->
      <div class="exec-summary">
        <div class="head">
          <div class="label">Executive Summary</div>
          <div class="as-of">As of ${asOfDate}</div>
        </div>
        <div class="es-grid">

          <!-- Card 1 — KEY RISK INDICATORS -->
          <div class="es-card indicators">
            <div class="es-topic">
              <span class="es-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13.5h11 M5 13.5V8.2 M8 13.5V4.5 M11 13.5V9.8"/></svg></span>
              <span class="es-topic-name">Key Risk Indicators</span>
            </div>
            <div class="es-headline-row">
              <div class="es-headline">${card1Headline}</div>
              <div class="es-subline">${card1Subline}</div>
            </div>
            <div class="es-bar">
              <div class="es-bar-seg red"   style="width:${kriSegR}%"></div>
              <div class="es-bar-seg amber" style="width:${kriSegA}%"></div>
              <div class="es-bar-seg green" style="width:${kriSegG}%"></div>
            </div>
            <div class="es-chips">
              <div class="es-chip"><span class="dot red"></span><span class="num">${redCount}</span><span class="lbl">Breaching</span></div>
              <div class="es-chip"><span class="dot amber"></span><span class="num">${amberCount}</span><span class="lbl">At Risk</span></div>
              <div class="es-chip"><span class="dot green"></span><span class="num">${greenCount}</span><span class="lbl">Within Limits</span></div>
              ${escalCount > 0 ? `<div class="es-chip"><span class="dot" style="background:#7c3aed"></span><span class="num">${escalCount}</span><span class="lbl">Escalations</span></div>` : ""}
            </div>
            <div class="es-insight">${card1Insight}</div>
          </div>

          <!-- Card 2 — OPEN RISKS -->
          <div class="es-card risks">
            <div class="es-topic">
              <span class="es-icon">⚠</span>
              <span class="es-topic-name">Open Risks</span>
            </div>
            <div class="es-headline-row">
              <div class="es-headline">${card2Headline}</div>
              <div class="es-subline">${card2Subline}</div>
            </div>
            <div class="es-bar">
              <div class="es-bar-seg red"    style="width:${rkSegC}%"></div>
              <div class="es-bar-seg orange" style="width:${rkSegH}%"></div>
              <div class="es-bar-seg amber"  style="width:${rkSegM}%"></div>
              <div class="es-bar-seg green"  style="width:${rkSegL}%"></div>
            </div>
            <div class="es-chips">
              <div class="es-chip"><span class="dot red"></span><span class="num">${riskBySeverity.Critical}</span><span class="lbl">Critical</span></div>
              <div class="es-chip"><span class="dot orange"></span><span class="num">${riskBySeverity.High}</span><span class="lbl">High</span></div>
              <div class="es-chip"><span class="dot amber"></span><span class="num">${riskBySeverity.Medium}</span><span class="lbl">Medium</span></div>
              <div class="es-chip"><span class="dot green"></span><span class="num">${riskBySeverity.Low}</span><span class="lbl">Low</span></div>
            </div>
            <div class="es-insight">${card2Insight}</div>
          </div>

          <!-- Card 3 — AUDIT & ACTIONS -->
          <div class="es-card audit">
            <div class="es-topic">
              <span class="es-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.4 3.4"/></svg></span>
              <span class="es-topic-name">Audit &amp; Actions</span>
            </div>
            <div class="es-headline-row">
              <div class="es-headline">${card3Headline}</div>
              <div class="es-subline">${card3Subline}</div>
            </div>
            <div class="es-bar">
              <div class="es-bar-seg red"    style="width:${afSegC}%"></div>
              <div class="es-bar-seg orange" style="width:${afSegH}%"></div>
              <div class="es-bar-seg amber"  style="width:${afSegM}%"></div>
              <div class="es-bar-seg green"  style="width:${afSegL}%"></div>
            </div>
            <div class="es-chips">
              <div class="es-chip"><span class="dot red"></span><span class="num">${bySev.Critical}</span><span class="lbl">Critical</span></div>
              <div class="es-chip"><span class="dot orange"></span><span class="num">${bySev.High}</span><span class="lbl">High</span></div>
              <div class="es-chip"><span class="dot amber"></span><span class="num">${bySev.Medium}</span><span class="lbl">Medium</span></div>
              <div class="es-chip"><span class="dot green"></span><span class="num">${bySev.Low}</span><span class="lbl">Low</span></div>
            </div>
            <div class="es-insight">${card3Insight}</div>
          </div>

        </div>
      </div>

      <!-- ════════════ KRI STATUS BOARD ════════════ -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span>KRI Status Board</h2>
          <div class="section-meta">${kriWithLatest.length} indicators · sorted by RAG severity</div>
        </div>
        ${kriWithLatest.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No active KRIs.</p>'
          : `<table><thead><tr><th style="width:32%">KRI / Business Unit</th><th style="width:14%">Category</th><th style="width:14%;text-align:center">Current</th><th style="width:8%;text-align:center">RAG</th><th style="width:12%;text-align:center">Trend</th><th style="width:10%;text-align:center">Escalate</th></tr></thead><tbody>${kriRows}</tbody></table>`}
      </section>

      <!-- ════════════ RISK REGISTER ════════════ -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span>Risk Register</h2>
          <div class="section-meta">${sortedRisks.length} open risk${sortedRisks.length === 1 ? "" : "s"} · sorted by likelihood × impact</div>
        </div>
        ${sortedRisks.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No open risks.</p>'
          : `<table><thead><tr><th>Risk / Owner</th><th>Category</th><th style="text-align:center">Score</th><th style="text-align:center">Status</th><th style="text-align:center">Appetite</th><th>Mitigation</th></tr></thead><tbody>${riskRows}</tbody></table>`}
      </section>

      <!-- ════════════ APPETITE MONITOR ════════════ -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span>Risk Appetite Monitor</h2>
          <div class="section-meta">Tolerance utilisation by category</div>
        </div>
        ${appetite.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No appetite thresholds defined.</p>'
          : `<table><thead><tr><th>Risk Category</th><th>Appetite Statement</th><th style="text-align:center">Max Tolerable</th><th style="text-align:center">Current</th><th>Utilisation</th><th style="text-align:center">Status</th></tr></thead><tbody>${appRows}</tbody></table>`}
      </section>

      <!-- ════════════ AUDIT FINDINGS ════════════ -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span>Audit Findings</h2>
          <div class="section-meta">${auditFindings.length} total · ${openAF} open · Critical: ${bySev.Critical} · High: ${bySev.High} · Medium: ${bySev.Medium} · Low: ${bySev.Low}</div>
        </div>
        ${auditFindings.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No audit findings.</p>'
          : `<table><thead><tr><th>Finding</th><th style="text-align:center">Severity</th><th>Business Unit</th><th style="text-align:center">Status</th><th style="text-align:center">Due Date</th></tr></thead><tbody>${afRows}</tbody></table>`}
      </section>

      <!-- ════════════ CORRECTIVE ACTIONS ════════════ -->
      <section>
        <div class="section-head">
          <h2><span class="icon">▸</span>Corrective Actions</h2>
          <div class="section-meta">${correctiveActions.length} total · ${caComplete} completed · ${caOpen} open · avg completion ${avgCompletion}%</div>
        </div>
        ${correctiveActions.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No corrective actions.</p>'
          : `<table><thead><tr><th>Action</th><th style="text-align:center">Completion</th><th style="text-align:center">Status</th><th style="text-align:center">Target Date</th></tr></thead><tbody>${caRows}</tbody></table>`}
      </section>

      <!-- ════════════ FOOTER ════════════ -->
      <div class="footer">
        <span>GRC Intelligence Dashboard · Tree Digital Insurance Company</span>
        <span>${dateStr}</span>
      </div>
    </body></html>`;

    const win = window.open("", "_blank", "width=1100,height=850");
    if (!win) { alert("Pop-up blocked — please allow pop-ups for this site."); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  const pad = bp === "mobile" ? "16px" : "32px";

  if (loading) return (
    <div style={{ padding: 64, textAlign: "center", color: T.muted }}>
      <div style={{ marginBottom: 12 }}><Ico name="shield" size={34} color="#490300" /></div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Loading GRC Dashboard…</div>
    </div>
  );
  if (error) return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>Failed to load: {error}</div>
      <button onClick={load} style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer" }}>Retry</button>
    </div>
  );

  return (
    <div style={{ padding: pad, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: "22px 28px", marginBottom: 24, color: T.headerText }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ display: "inline-flex", color: "#fff" }}><Ico name="shield" size={20} /></span>
              <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 17 : 21, fontWeight: 900 }}>GRC Risk Intelligence Dashboard</h1>
            </div>
            <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>Key Risk Indicators · Risk Register · Appetite Monitoring</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2 }}>Last refreshed</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={load} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>↻ Refresh</button>
              <button onClick={printGRCReport} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>Print Report</button>
              {canEdit && (
                <button onClick={() => setGlobalEdit(g => !g)} style={{ background: globalEdit ? "#00ffb3" : "rgba(255,255,255,0.1)", border: globalEdit ? "none" : "1px solid rgba(255,255,255,0.25)", color: globalEdit ? "#061210" : "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: globalEdit ? 800 : 400, cursor: "pointer" }}>
                  {globalEdit ? "✓ Edit Mode ON" : "✎ Global Edit"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: anyFilterActive ? `Filtered KRIs (of ${kriWithLatest.length})` : "Total KRIs", value: filteredKRIs.length, color: T.text,     accent: T.primary },
          { label: "Breaching — Red",      value: redCount,             color: "#dc2626",  accent: "#dc2626" },
          { label: "At Risk — Amber",      value: amberCount,           color: "#d97706",  accent: "#d97706" },
          { label: "Within Limits",        value: greenCount,           color: "#16a34a",  accent: "#16a34a" },
          { label: "Escalations Required", value: escalCount,           color: T.text,     accent: T.primary },
        ].map(({ label, value, color, accent }) => (
          <div key={label} style={{ background: T.surface, border: `2px solid ${accent}22`, borderLeft: `4px solid ${accent}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 5, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Department Summary Cards ── */}
      {deptSummary.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Departments overview · click a card to filter
          </div>
          <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 12 }}>
            {deptSummary.map(d => {
              const isActive = filterDept.length === 1 && filterDept[0] === d.name;
              const healthColor = d.greenPct >= 80 ? "#16a34a" : d.greenPct >= 50 ? "#eab308" : "#dc2626";
              return (
                <div key={d.name}
                  onClick={() => setFilterDept(isActive ? [] : [d.name])}
                  style={{
                    background: T.surface,
                    border: `1.5px solid ${isActive ? T.primary : T.border}`,
                    borderRadius: 14,
                    padding: "16px 18px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: isActive ? `0 4px 16px ${T.primary}28` : "none",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = T.accent; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = T.border; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{d.total} KRIs · Latest {d.latestPeriod || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: healthColor, lineHeight: 1 }}>{d.greenPct}%</div>
                      <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Within Limits</div>
                    </div>
                  </div>
                  {/* RAG breakdown bar */}
                  <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", background: T.bg, marginBottom: 10 }}>
                    {d.red > 0      && <div style={{ flex: d.red,       background: "#dc2626" }} title={`${d.red} Red`} />}
                    {d.amber > 0    && <div style={{ flex: d.amber,     background: "#eab308" }} title={`${d.amber} Amber`} />}
                    {d.green > 0    && <div style={{ flex: d.green,     background: "#16a34a" }} title={`${d.green} Green`} />}
                    {d.noReading > 0 && <div style={{ flex: d.noReading, background: T.border, opacity: 0.6 }} title={`${d.noReading} No Reading`} />}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {[
                      { label: "Green",   v: d.green,     color: "#16a34a", bg: "#dcfce7" },
                      { label: "Amber",   v: d.amber,     color: "#854d0e", bg: "#fef3c7" },
                      { label: "Red",     v: d.red,       color: "#991b1b", bg: "#fee2e2" },
                      { label: "No data", v: d.noReading, color: T.muted,   bg: T.bg },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", padding: "6px 4px", background: s.bg, borderRadius: 6 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.v}</div>
                        <div style={{ fontSize: 9, color: T.muted, marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KRI Status Board ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>
            KRI Status Board
            <span style={{ fontSize: 12, fontWeight: 500, color: T.muted, marginLeft: 10 }}>
              Showing {filteredKRIs.length} of {kriWithLatest.length}
            </span>
          </h2>
          {canEdit && (
            <button onClick={handleAddKRI}
              style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              + Add KRI
            </button>
          )}
        </div>

        {/* ── Filter bar ── */}
        {kriWithLatest.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
            <input value={kriSearch} onChange={e => setKriSearch(e.target.value)} placeholder="Search name, ID, metric, source…"
              style={{ flex: 1, minWidth: 220, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, outline: "none", background: T.inputBg, color: T.inputText }} />
            <MultiSelect label="Department" options={deptOptions} selected={filterDept} onChange={setFilterDept} />
            <MultiSelect label="Category"   options={catOptions}  selected={filterCat}  onChange={setFilterCat} />
            <MultiSelect label="Sub-Cat"    options={subOptions}  selected={filterSub}  onChange={setFilterSub} />
            <MultiSelect label="RAG"        options={ragOptions}  selected={filterRAG}  onChange={setFilterRAG} />
            {anyFilterActive && (
              <button onClick={clearAllFilters}
                style={{ background: "transparent", color: T.muted, border: `1px dashed ${T.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                ✕ Clear all
              </button>
            )}
          </div>
        )}

        {filteredKRIs.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "32px 0" }}>
            {kriWithLatest.length === 0 ? "No active KRIs found." : "No KRIs match the current filters."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {["KRI Name","Department","Category","Sub-Category","Current Value","RAG","Trend","History","Period","Escalate",...(canEdit?[""]:[]),...(globalEdit?[""]:[])].map((h, i) => (
                    <th key={h + i} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredKRIs.map(kri => {
                  const r  = kri.latest;
                  const rc = RAG_COLOR[r?.RAGStatus];
                  const isSelected = selectedKRI === kri.KRIID;
                  return (
                    <tr key={kri.KRIID}
                      onClick={() => setSelectedKRI(isSelected ? null : kri.KRIID)}
                      style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", background: isSelected ? "#f0f7ff" : "transparent", transition: "background 0.12s" }}>
                      <td style={{ padding: "11px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{kri.Title}</div>
                        <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{kri.KRIID || "—"}</span>
                          {kri.ReportingFrequency && kri.ReportingFrequency !== "Monthly" && (
                            <span style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.muted, fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                              {kri.ReportingFrequency}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{kri.BusinessUnit || "—"}</td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.muted }}>{kri.KRICategory || "—"}</td>
                      <td style={{ padding: "11px 12px", fontSize: 11, color: T.muted }}>{kri.SubCategory || "—"}</td>
                      <td style={{ padding: "11px 12px" }}>
                        {r ? (
                          <span style={{ fontSize: 15, fontWeight: 900, color: rc?.text || T.text }}>
                            {r.ActualValue} <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>{kri.MeasurementUnit}</span>
                          </span>
                        ) : <span style={{ fontSize: 12, color: T.muted }}>No reading</span>}
                      </td>
                      <td style={{ padding: "11px 12px" }}>
                        {rc ? (
                          <span style={{ background: rc.bg, color: rc.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{r.RAGStatus}</span>
                        ) : <span style={{ color: T.muted }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 18, fontWeight: 900, color: trendColor(r?.Trend) }}>{r?.Trend ? trendIcon(r.Trend) : "—"}</td>
                      <td style={{ padding: "11px 12px" }}><Sparkline readings={kri.readings} direction={kri.ThresholdDirection} color={T.primary} /></td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.muted }}>{r?.Period || "—"}</td>
                      <td style={{ padding: "11px 12px" }}>
                        {r?.EscalationRequired
                          ? <span style={{ background: T.bg, color: T.primary, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10 }}>⚠ Yes</span>
                          : <span style={{ color: T.muted, fontSize: 12 }}>—</span>}
                      </td>
                      {canEdit && (
                        <td style={{ padding: "11px 12px" }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => setReadingModal(kri)}
                            style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                            + Reading
                          </button>
                        </td>
                      )}
                      {globalEdit && (
                        <td style={{ padding: "11px 12px" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setMasterModal(kri)}
                              style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, whiteSpace: "nowrap" }}>
                              Edit
                            </button>
                            <button onClick={() => deleteKRI(kri)} disabled={saving}
                              style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", color: "#991b1b", whiteSpace: "nowrap", opacity: saving ? 0.5 : 1 }}>
                              <Ico name="trash" size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredKRIs.length > 0 && <p style={{ margin: "10px 0 0", fontSize: 11, color: T.muted }}>Click any row to view trend chart{canEdit && globalEdit ? " · Edit Mode is ON" : ""}</p>}
      </div>

      {/* ── KRI Trend Chart ── */}
      {selectedKRI && kriHistory.length > 0 && (() => {
        const kri = kriMaster.find(k => k.KRIID === selectedKRI);
        const chartData = kriHistory.map(r => ({
          period: fmtPeriod(r.Period || (r.ReadingDate || "").substring(0, 7)),
          value: r.ActualValue,
        }));
        return (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text }}>Trend — {kri?.Title}</h3>
              <button onClick={() => setSelectedKRI(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer", color: T.muted }}>✕ Close</button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {(() => { const g = parseFloat(kri?.GreenThreshold); return Number.isFinite(g) ? <ReferenceLine y={g} stroke="#16a34a" strokeDasharray="4 2" label={{ value: "Green", position: "right", fontSize: 10, fill: "#16a34a" }} /> : null; })()}
                {(() => { const a = parseFloat(kri?.AmberThreshold); return Number.isFinite(a) ? <ReferenceLine y={a} stroke="#eab308" strokeDasharray="4 2" label={{ value: "Amber", position: "right", fontSize: 10, fill: "#d97706" }} /> : null; })()}
                {(() => { const r = parseFloat(kri?.RedThreshold);   return Number.isFinite(r) ? <ReferenceLine y={r} stroke="#dc2626" strokeDasharray="4 2" label={{ value: "Red",   position: "right", fontSize: 10, fill: "#dc2626" }} /> : null; })()}
                <Line type="monotone" dataKey="value" stroke={T.primary} strokeWidth={2.5} dot={{ r: 4, fill: T.primary }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>

            {/* ── Readings list — edit / delete each ── */}
            {canEdit && kriHistory.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  All Readings ({kriHistory.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...kriHistory].sort((a, b) => (b.Period || "").localeCompare(a.Period || "")).map(r => {
                    const rc = RAG_COLOR[r.RAGStatus];
                    const hasGov = r.Justification || r.ActionPlan;
                    return (
                      <div key={r.ID} style={{ padding: "10px 14px", background: T.bg, borderRadius: 8, fontSize: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ minWidth: 70, fontWeight: 700, color: T.text }}>{r.Period}</span>
                          <span style={{ minWidth: 60, fontWeight: 800, color: rc?.text || T.text }}>{r.ActualValue}{kri?.MeasurementUnit ? ` ${kri.MeasurementUnit}` : ""}</span>
                          {rc && <span style={{ background: rc.bg, color: rc.text, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{r.RAGStatus}</span>}
                          {r.Trend && <span style={{ fontSize: 14, color: trendColor(r.Trend) }}>{trendIcon(r.Trend)}</span>}
                          <span style={{ flex: 1, fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.Comments || ""}</span>
                          <button onClick={() => { setReadingModal(kri); setEditingReading(r); }}
                            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: T.text, fontWeight: 600 }}>
                            Edit
                          </button>
                          <button onClick={() => deleteReading(r)} disabled={saving}
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: saving ? "not-allowed" : "pointer", color: "#991b1b", fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
                            🗑
                          </button>
                        </div>
                        {hasGov && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: "grid", gridTemplateColumns: r.Justification && r.ActionPlan ? "1fr 1fr" : "1fr", gap: 12 }}>
                            {r.Justification && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Justification</div>
                                <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.Justification}</div>
                              </div>
                            )}
                            {r.ActionPlan && (
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Action Plan</div>
                                <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.ActionPlan}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Risk Heatmap ── */}
      {riskReg.filter(r => r.RiskStatus !== "Closed").length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.text }}>Risk Heatmap</h3>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Active risks by Likelihood × Impact. Click a populated cell to see risk names.</p>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Grid */}
            <div style={{ flex: "1 1 300px" }}>
              {[5,4,3,2,1].map(l => (
                <div key={l} style={{ display: "flex", alignItems: "stretch", gap: 5, marginBottom: 5 }}>
                  <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: T.muted, display: "flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>{l}</span>
                  {[1,2,3,4,5].map(i => {
                    const score = l * i;
                    const key   = `${l}-${i}`;
                    const risks = heatmapData[key] || [];
                    const count = risks.length;
                    const cellC = score >= 15 ? { bg: "#490300", text: "#ffb3b3", border: "#6b0400" }
                                : score >= 10 ? { bg: "#dc2626", text: "#fff",    border: "#b91c1c" }
                                : score >= 5  ? { bg: "#d97706", text: "#fff",    border: "#b45309" }
                                :               { bg: "#16a34a", text: "#fff",    border: "#15803d" };
                    const isSelected = heatmapCell?.l === l && heatmapCell?.i === i;
                    return (
                      <div key={i}
                        onClick={() => setHeatmapCell(count > 0 ? (isSelected ? null : { l, i, risks }) : null)}
                        style={{
                          flex: 1, minWidth: 44, minHeight: 52,
                          background: count > 0 ? cellC.bg : cellC.bg + "28",
                          border: `1px solid ${isSelected ? cellC.border : cellC.border + "55"}`,
                          borderRadius: 6,
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          cursor: count > 0 ? "pointer" : "default",
                          position: "relative",
                          transition: "transform 0.12s, box-shadow 0.12s",
                          transform: isSelected ? "scale(1.06)" : "scale(1)",
                          boxShadow: isSelected ? `0 0 0 2px ${cellC.border}` : "none",
                        }}>
                        {count > 0 && (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 900, color: cellC.text, lineHeight: 1 }}>{count}</span>
                            <span style={{ fontSize: 9, color: cellC.text, opacity: 0.75 }}>risk{count > 1 ? "s" : ""}</span>
                          </>
                        )}
                        <span style={{ position: "absolute", bottom: 3, right: 5, fontSize: 9, fontWeight: 600, color: count > 0 ? cellC.text : T.muted, opacity: 0.45 }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: 700, color: T.muted }}>{i}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                <span style={{ width: 18, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Impact →</div>
              </div>
              <div style={{ marginTop: 2, paddingLeft: 23, fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>↑ Likelihood</div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, flexShrink: 0 }}>
              {[
                { label: "Critical  15 – 25", bg: "#490300", text: "#ffb3b3" },
                { label: "High      10 – 14",  bg: "#dc2626", text: "#fff"    },
                { label: "Medium    5 – 9",    bg: "#d97706", text: "#fff"    },
                { label: "Low       1 – 4",    bg: "#16a34a", text: "#fff"    },
              ].map(({ label, bg }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 16, height: 16, background: bg, borderRadius: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Cell detail panel */}
          {heatmapCell && (
            <div style={{ marginTop: 16, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                  Likelihood {heatmapCell.l} × Impact {heatmapCell.i} — Score {heatmapCell.l * heatmapCell.i}
                  &nbsp;
                  <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>({heatmapCell.risks.length} risk{heatmapCell.risks.length > 1 ? "s" : ""})</span>
                </span>
                <button onClick={() => setHeatmapCell(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: T.muted, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {heatmapCell.risks.map((name, idx) => (
                  <div key={idx} style={{ fontSize: 13, color: T.text, padding: "7px 12px", background: T.surface, borderRadius: 7, border: `1px solid ${T.border}` }}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom: Appetite + Top Risks ── */}
      <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 20 }}>

        {/* Risk Appetite */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: T.text }}>Risk Appetite by Category</h3>
          {appetite.length === 0
            ? <p style={{ color: T.muted, fontSize: 13 }}>No appetite data.</p>
            : appetite.map(a => {
                const pct = a.MaxTolerableScore > 0 ? Math.min(100, Math.round((a.CurrentExposureScore / a.MaxTolerableScore) * 100)) : 0;
                const sc  = a.AppetiteStatus === "Breached" ? "#dc2626" : a.AppetiteStatus === "Near Limit" ? "#d97706" : "#16a34a";
                return (
                  <div key={a.Title} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.RiskCategory}</span>
                        {a.AppetiteStatement && (
                          <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 2 }}>"{a.AppetiteStatement}"</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + "22", padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>{a.AppetiteStatus}</span>
                        {canEdit && (
                          <button onClick={() => setAppetiteModal(a)}
                            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>
                            Edit
                          </button>
                        )}
                        {globalEdit && (
                          <button onClick={() => deleteAppetite(a.ID)}
                            style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626" }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ background: T.border, borderRadius: 6, height: 8, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: sc, borderRadius: 6, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>Exposure: {a.CurrentExposureScore} / Limit: {a.MaxTolerableScore} ({pct}%)</div>
                  </div>
                );
              })
          }
          {globalEdit && (
            <button onClick={() => setNewAppetiteModal(true)}
              style={{ marginTop: 8, background: T.bg, border: `2px dashed ${T.border}`, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: T.muted, width: "100%" }}>
              + Add Appetite Category
            </button>
          )}
        </div>

        {/* Top Risks */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>{globalEdit ? "All Risks" : "Top Risks by Score"}</h3>
            {globalEdit && (
              <button onClick={() => setNewRiskModal(true)}
                style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Add Risk
              </button>
            )}
          </div>
          {riskReg.length === 0
            ? <p style={{ color: T.muted, fontSize: 13 }}>No risk data.</p>
            : [...riskReg]
                .filter(r => globalEdit || r.RiskStatus !== "Closed")
                .sort((a, b) => (b.LikelihoodScore * b.ImpactScore) - (a.LikelihoodScore * a.ImpactScore))
                .slice(0, globalEdit ? 500 : 6)
                .map(r => {
                  const score = (r.LikelihoodScore || 0) * (r.ImpactScore || 0);
                  const sc    = score >= 15 ? "#dc2626" : score >= 9 ? "#d97706" : "#16a34a";
                  return (
                    <div key={r.RiskID || r.Title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", marginBottom: 8, background: T.bg, borderRadius: 8, border: r.RiskAppetiteBreached ? "1px solid rgba(220,38,38,0.35)" : `1px solid ${T.border}` }}>
                      <div style={{ background: sc, color: "#fff", borderRadius: 7, padding: "4px 9px", fontSize: 14, fontWeight: 900, minWidth: 34, textAlign: "center", flexShrink: 0 }}>{score}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.Title}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{r.RiskCategory} · {r.RiskOwner?.Title || "—"}{globalEdit ? ` · ${r.RiskStatus}` : ""}</div>
                      </div>
                      {r.RiskAppetiteBreached && (
                        <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, flexShrink: 0 }}>Breached</span>
                      )}
                      {canEdit && (
                        <button onClick={() => setRiskModal(r)}
                          style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, flexShrink: 0 }}>
                          Edit
                        </button>
                      )}
                      {globalEdit && (
                        <button onClick={() => deleteRisk(r.ID)}
                          style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>
                          Delete
                        </button>
                      )}
                    </div>
                  );
                })
          }
          {appBreaches > 0 && !globalEdit && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#fee2e2", borderRadius: 8, fontSize: 12, color: "#991b1b", fontWeight: 700 }}>
              ⚠ {appBreaches} risk{appBreaches > 1 ? "s" : ""} breaching risk appetite
            </div>
          )}
        </div>
      </div>

      {/* ── Audit Findings + Corrective Actions ── */}
      {(() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const isOverdue = (dateStr, status) =>
          status !== "Closed" && status !== "Completed" && dateStr && new Date(dateStr) < today;

        // ── Audit Findings stats ──
        const afOpen     = auditFindings.filter(f => f.Status !== "Closed").length;
        const afCritHigh = auditFindings.filter(f => f.Status !== "Closed" && (f.FindingSeverity === "Critical" || f.FindingSeverity === "High")).length;
        const afOverdue  = auditFindings.filter(f => isOverdue(f.DueDate, f.Status)).length;
        const afClosed   = auditFindings.filter(f => f.Status === "Closed").length;

        const sevColor = (sev) => sev === "Critical" ? "#490300" : sev === "High" ? "#ff5000" : sev === "Medium" ? "#f5a623" : "#5a7a6e";
        const statusBadge = (status, dueDate) => {
          const over = isOverdue(dueDate, status);
          if (over || status === "Overdue") return { bg: "#49030022", text: "#490300", label: "Overdue" };
          if (status === "Open")            return { bg: "#dc262622", text: "#dc2626", label: "Open" };
          if (status === "In Progress")     return { bg: "#d9770622", text: "#d97706", label: "In Progress" };
          if (status === "Closed")          return { bg: "#16a34a22", text: "#16a34a", label: "Closed" };
          return { bg: T.border, text: T.muted, label: status || "—" };
        };

        // ── Corrective Actions stats ──
        const caTotal     = correctiveActions.length;
        const caCompleted = correctiveActions.filter(a => a.Status === "Completed" || Number(a.CompletionPercentage) === 100).length;
        const caOverdue   = correctiveActions.filter(a => isOverdue(a.TargetDate, a.Status)).length;
        const caAvgPct    = caTotal > 0
          ? Math.round(correctiveActions.reduce((s, a) => s + (Number(a.CompletionPercentage) || 0), 0) / caTotal)
          : 0;

        const pctColor = (p) => p >= 70 ? "#00c48c" : p >= 30 ? "#f5a623" : "#dc2626";

        const caStatusBadge = (status, targetDate) => {
          const over = isOverdue(targetDate, status);
          if (over)                        return { bg: "#49030022", text: "#490300", label: "Overdue" };
          if (status === "Completed")      return { bg: "#16a34a22", text: "#16a34a", label: "Completed" };
          if (status === "In Progress")    return { bg: "#d9770622", text: "#d97706", label: "In Progress" };
          if (status === "Not Started")    return { bg: "#6b728022", text: "#374151", label: "Not Started" };
          return { bg: T.border, text: T.muted, label: status || "—" };
        };

        const miniStat = (value, label, color = T.text, accent = T.primary) => (
          <div key={label} style={{ background: T.bg, border: `1px solid ${accent}33`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        );

        return (
          <div style={{ display: "grid", gridTemplateColumns: bp === "mobile" ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 24 }}>

            {/* ── Audit Findings ── */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>Audit Findings Summary</h3>
                {globalEdit && (
                  <button onClick={() => { setSaveErr(""); setAfNewModal(true); }}
                    style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    + Add Finding
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {miniStat(afOpen,     "Open",           "#dc2626", "#dc2626")}
                {miniStat(afCritHigh, "Critical / High","#490300", "#490300")}
                {miniStat(afOverdue,  "Overdue",        "#ff5000", "#ff5000")}
                {miniStat(afClosed,   "Closed",         "#16a34a", "#16a34a")}
              </div>
              {auditFindings.length === 0
                ? <p style={{ color: T.muted, fontSize: 13 }}>No audit findings.</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[...auditFindings]
                      .sort((a, b) => {
                        const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
                        return (order[a.FindingSeverity] ?? 4) - (order[b.FindingSeverity] ?? 4);
                      })
                      .map((f, idx) => {
                        const badge = statusBadge(f.Status, f.DueDate);
                        const sc    = sevColor(f.FindingSeverity);
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.bg, borderRadius: 8, borderLeft: `4px solid ${sc}`, border: `1px solid ${T.border}`, borderLeftColor: sc }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.Title}</div>
                              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{f.BusinessUnit || "—"}{f.DueDate ? ` · Due ${new Date(f.DueDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}` : ""}</div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: badge.bg, color: badge.text, whiteSpace: "nowrap", flexShrink: 0 }}>{badge.label}</span>
                            {globalEdit && (
                              <>
                                <button onClick={() => { setSaveErr(""); setAfEditModal(f); }}
                                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, flexShrink: 0 }}>Edit</button>
                                <button onClick={() => deleteAuditFinding(f.ID)}
                                  style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626", flexShrink: 0 }}>Delete</button>
                              </>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
              }
            </div>

            {/* ── Corrective Actions ── */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>Corrective Actions Progress</h3>
                {globalEdit && (
                  <button onClick={() => { setSaveErr(""); setCaNewModal(true); }}
                    style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    + Add Action
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {miniStat(caTotal,     "Total",     T.text,    T.primary)}
                {miniStat(caCompleted, "Completed", "#16a34a", "#16a34a")}
                {miniStat(caOverdue,   "Overdue",   "#ff5000", "#ff5000")}
                <div style={{ background: T.bg, border: `1px solid ${pctColor(caAvgPct)}33`, borderLeft: `3px solid ${pctColor(caAvgPct)}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: pctColor(caAvgPct), lineHeight: 1 }}>{caAvgPct}%</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontWeight: 600 }}>Overall Completion</div>
                </div>
              </div>
              {correctiveActions.length === 0
                ? <p style={{ color: T.muted, fontSize: 13 }}>No corrective actions.</p>
                : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[...correctiveActions]
                      .sort((a, b) => (Number(b.CompletionPercentage) || 0) - (Number(a.CompletionPercentage) || 0))
                      .map((a, idx) => {
                        const pct   = Math.min(100, Math.max(0, Number(a.CompletionPercentage) || 0));
                        const pc    = pctColor(pct);
                        const badge = caStatusBadge(a.Status, a.TargetDate);
                        return (
                          <div key={idx} style={{ padding: "10px 12px", background: T.bg, borderRadius: 8, border: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 7 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.Title}</div>
                                {a.TargetDate && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Target: {new Date(a.TargetDate).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</div>}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: badge.bg, color: badge.text, whiteSpace: "nowrap" }}>{badge.label}</span>
                                {globalEdit && (
                                  <>
                                    <button onClick={() => { setSaveErr(""); setCaEditModal(a); }}
                                      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text }}>Edit</button>
                                    <button onClick={() => deleteCorrectiveAction(a.ID)}
                                      style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#dc2626" }}>Delete</button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, background: T.border, borderRadius: 4, height: 7, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: pc, borderRadius: 4, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: pc, minWidth: 34, textAlign: "right" }}>{pct}%</span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
              }
            </div>

          </div>
        );
      })()}

      {/* ── MODALS ── */}
      {readingModal && (
        <GRCModal title={`${editingReading ? "Edit" : "Add"} KRI Reading — ${readingModal.Title}`} onClose={() => { setReadingModal(null); setEditingReading(null); setSaveErr(""); }}>
          <GRCReadingForm kri={readingModal} reading={editingReading} onSave={saveReading} saving={saving} error={saveErr} onCancel={() => { setReadingModal(null); setEditingReading(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {riskModal && (
        <GRCModal title={`Edit Risk — ${riskModal.Title}`} onClose={() => { setRiskModal(null); setSaveErr(""); }}>
          <GRCRiskForm risk={riskModal} onSave={saveRisk} saving={saving} error={saveErr} onCancel={() => { setRiskModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {appetiteModal && (
        <GRCModal title={`Edit Appetite — ${appetiteModal.RiskCategory}`} onClose={() => { setAppetiteModal(null); setSaveErr(""); }}>
          <GRCAppetiteForm item={appetiteModal} onSave={saveAppetite} saving={saving} error={saveErr} onCancel={() => { setAppetiteModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {masterModal && (
        <GRCModal title={masterModal.ID == null ? "New KRI" : `Edit KRI — ${masterModal.Title}`} onClose={() => { setMasterModal(null); setSaveErr(""); }}>
          <GRCMasterForm kri={masterModal} onSave={saveMasterEdit} saving={saving} error={saveErr} onCancel={() => { setMasterModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {newRiskModal && (
        <GRCModal title="Add New Risk" onClose={() => { setNewRiskModal(false); setSaveErr(""); }}>
          <GRCNewRiskForm onSave={saveNewRisk} saving={saving} error={saveErr} onCancel={() => { setNewRiskModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {newAppetiteModal && (
        <GRCModal title="Add Risk Appetite Category" onClose={() => { setNewAppetiteModal(false); setSaveErr(""); }}>
          <GRCNewAppetiteForm onSave={saveNewAppetite} saving={saving} error={saveErr} onCancel={() => { setNewAppetiteModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {afEditModal && (
        <GRCModal title={`Edit Finding — ${afEditModal.Title}`} onClose={() => { setAfEditModal(null); setSaveErr(""); }}>
          <GRCAuditFindingForm item={afEditModal} onSave={saveAuditFinding} saving={saving} error={saveErr} onCancel={() => { setAfEditModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {afNewModal && (
        <GRCModal title="Add Audit Finding" onClose={() => { setAfNewModal(false); setSaveErr(""); }}>
          <GRCAuditFindingForm onSave={saveAuditFinding} saving={saving} error={saveErr} onCancel={() => { setAfNewModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
      {caEditModal && (
        <GRCModal title={`Edit Action — ${caEditModal.Title}`} onClose={() => { setCaEditModal(null); setSaveErr(""); }}>
          <GRCCorrectiveActionForm item={caEditModal} onSave={saveCorrectiveAction} saving={saving} error={saveErr} onCancel={() => { setCaEditModal(null); setSaveErr(""); }} />
        </GRCModal>
      )}
      {caNewModal && (
        <GRCModal title="Add Corrective Action" onClose={() => { setCaNewModal(false); setSaveErr(""); }}>
          <GRCCorrectiveActionForm onSave={saveCorrectiveAction} saving={saving} error={saveErr} onCancel={() => { setCaNewModal(false); setSaveErr(""); }} />
        </GRCModal>
      )}
    </div>
  );
};

export default GRCDashboard;
