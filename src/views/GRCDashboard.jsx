import React, { useState, useMemo, useCallback, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useT } from "../theme.js";
import { useBp } from "../hooks/useBp.js";
import { isUsingMock } from "../services/sharepoint.js";
import { acquireSpToken } from "../services/auth.js";
import { RAG_COLOR, trendIcon, trendColor } from "../utils/colors.js";

const GRC_SP_SITE = import.meta.env.VITE_GRC_SP_SITE_URL || "https://treedigitalinsurance.sharepoint.com/sites/GRC-Dashboard";

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

// ── Add KRI Reading form ──────────────────────────────────────────
const GRCReadingForm = ({ kri, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    KRIID:              kri.KRIID,
    KRIName:            kri.Title,
    ActualValue:        "",
    PreviousValue:      "",
    Period:             new Date().toISOString().substring(0, 7),
    RAGStatus:          "Green",
    Trend:              "Stable",
    Comments:           "",
    EscalationRequired: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
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
        <label style={lbl}>Period (YYYY-MM) *</label>
        <input type="month" value={form.Period} onChange={e => set("Period", e.target.value)} style={inp} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={lbl}>RAG Status</label>
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
        <label style={lbl}>Comments</label>
        <textarea value={form.Comments} onChange={e => set("Comments", e.target.value)} rows={3} placeholder="Optional commentary…" style={{ ...inp, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="grc-escal" checked={form.EscalationRequired} onChange={e => set("EscalationRequired", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="grc-escal" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Escalation required</label>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.ActualValue} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.ActualValue ? "not-allowed" : "pointer", opacity: saving || !form.ActualValue ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Reading"}
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

// ── Edit KRI Master form ──────────────────────────────────────────
const GRCMasterForm = ({ kri, onSave, saving, error, onCancel }) => {
  const T = useT();
  const [form, setForm] = useState({
    ID: kri.ID,
    Title: kri.Title || "",
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
    IsActive: kri.IsActive !== false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = { fontSize: 12, fontWeight: 700, color: T.muted, marginBottom: 5, display: "block" };
  const inp = { width: "100%", border: `1px solid ${T.border}`, borderRadius: 7, padding: "8px 11px", fontSize: 13, background: T.inputBg, color: T.inputText, boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={lbl}>KRI Name *</label>
        <input value={form.Title} onChange={e => set("Title", e.target.value)} style={inp} />
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
      <div>
        <label style={lbl}>Threshold Direction</label>
        <select value={form.ThresholdDirection} onChange={e => set("ThresholdDirection", e.target.value)} style={inp}>
          <option>Lower is better</option>
          <option>Higher is better</option>
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="kri-active" checked={form.IsActive} onChange={e => set("IsActive", e.target.checked)} style={{ cursor: "pointer" }} />
        <label htmlFor="kri-active" style={{ fontSize: 13, color: T.text, cursor: "pointer" }}>Active KRI</label>
      </div>
      {error && <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
        <button onClick={onCancel} disabled={saving} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: T.text }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.Title} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 700, cursor: saving || !form.Title ? "not-allowed" : "pointer", opacity: saving || !form.Title ? 0.6 : 1 }}>{saving ? "Saving…" : "Save KRI"}</button>
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
        fetch(`${base}('GRC_KRI_Master')/items?$select=ID,Title,KRIID,KRICategory,KRIOwner/Title,BusinessUnit,MeasurementUnit,GreenThreshold,AmberThreshold,RedThreshold,ThresholdDirection,IsActive,SubCategory,RiskCategoryL1,Metric,BaseData,DataSource&$expand=KRIOwner&$top=500`, { headers }),
        fetch(`${base}('GRC_KRI_Readings')/items?$select=ID,Title,KRIID,KRIName,ReadingDate,ActualValue,PreviousValue,Period,RAGStatus,Trend,Comments,EscalationRequired&$orderby=ReadingDate desc&$top=500`, { headers }),
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
      await spPost("GRC_KRI_Readings", {
        Title:               `${form.KRIID}-${form.Period}`,
        KRIID:               form.KRIID,
        KRIName:             form.KRIName,
        ReadingDate:         new Date().toISOString(),
        ActualValue:         Number(form.ActualValue),
        PreviousValue:       form.PreviousValue ? Number(form.PreviousValue) : null,
        Period:              form.Period,
        RAGStatus:           form.RAGStatus,
        Trend:               form.Trend,
        Comments:            form.Comments || "",
        EscalationRequired:  form.EscalationRequired,
      });
      setReadingModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
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
      await spPatch("GRC_KRI_Master", form.ID, {
        Title:              form.Title,
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
        IsActive:           form.IsActive,
      });
      setMasterModal(null);
      await load();
    } catch(e) { setSaveErr(e.message); }
    finally    { setSaving(false); }
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
    const map = {};
    kriReadings.forEach(r => {
      if (!map[r.KRIID] || r.ReadingDate > map[r.KRIID].ReadingDate) map[r.KRIID] = r;
    });
    return map;
  }, [kriReadings]);

  const kriWithLatest = useMemo(() =>
    activeKRIs.map(k => ({ ...k, latest: latestByKRI[k.KRIID] || null })),
    [activeKRIs, latestByKRI]
  );

  const redCount    = kriWithLatest.filter(k => k.latest?.RAGStatus === "Red").length;
  const amberCount  = kriWithLatest.filter(k => k.latest?.RAGStatus === "Amber").length;
  const greenCount  = kriWithLatest.filter(k => k.latest?.RAGStatus === "Green").length;
  const escalCount  = kriWithLatest.filter(k => k.latest?.EscalationRequired).length;
  const appBreaches = riskReg.filter(r => r.RiskAppetiteBreached && r.RiskStatus !== "Closed").length;

  const parsePeriodToDate = (period) => {
    if (!period) return null;
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1);
    }
    const d = new Date(period);
    return isNaN(d.getTime()) ? null : d;
  };

  const fmtPeriod = (period) => {
    if (!period) return "";
    if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split("-");
      return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    }
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

    const kriRows = kriWithLatest.map(k => {
      const r = k.latest;
      return `<tr>
        <td>${k.Title || "—"}<br><span style="color:#6b7280;font-size:10px">${k.KRIOwner?.Title || k.KRICategory || ""}</span></td>
        <td>${k.KRICategory || "—"}</td>
        <td style="text-align:center;font-weight:700">${r?.ActualValue ?? "—"} ${k.MeasurementUnit || ""}</td>
        <td style="text-align:center">${ragBadge(r?.RAGStatus)}</td>
        <td style="text-align:center">${r?.Trend === "Improving" ? "↑ Improving" : r?.Trend === "Worsening" ? "↓ Worsening" : r?.Trend === "Stable" ? "→ Stable" : "—"}</td>
        <td style="text-align:center">${r?.EscalationRequired ? "⚠ Yes" : "No"}</td>
        <td style="color:#6b7280;font-size:10px">${r?.Comments || ""}</td>
      </tr>`;
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

    const html = `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>GRC Risk Intelligence Report — ${dateStr}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
        .cover { background: linear-gradient(135deg, #001f1a 0%, #003932 60%, #005c4a 100%); color: #fff; padding: 48px 56px; min-height: 180px; }
        .cover h1 { font-size: 26px; font-weight: 900; margin-bottom: 6px; }
        .cover .sub { opacity: 0.65; font-size: 13px; margin-bottom: 24px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin: 32px 40px 0; }
        .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
        .kpi .val { font-size: 26px; font-weight: 900; line-height: 1; }
        .kpi .lbl { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
        section { margin: 32px 40px 0; }
        section h2 { font-size: 14px; font-weight: 800; color: #003932; border-bottom: 2px solid #003932; padding-bottom: 6px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f1f5f9; padding: 7px 10px; text-align: left; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
        td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        .footer { margin: 40px 40px 0; padding: 16px 0; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #9ca3af; font-size: 10px; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          section { page-break-inside: avoid; }
          .cover { page-break-after: avoid; }
        }
      </style>
    </head><body>
      <div class="cover">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <span style="font-size:32px">🛡️</span>
          <div>
            <h1>GRC Risk Intelligence Report</h1>
            <div class="sub">Key Risk Indicators · Risk Register · Risk Appetite · Audit Findings · Corrective Actions</div>
          </div>
        </div>
        <div style="opacity:0.5;font-size:11px">Generated: ${dateStr} &nbsp;|&nbsp; PMO Enterprise Portal</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="val">${kriWithLatest.length}</div><div class="lbl">Total KRIs</div></div>
        <div class="kpi"><div class="val" style="color:#dc2626">${redCount}</div><div class="lbl">Breaching (Red)</div></div>
        <div class="kpi"><div class="val" style="color:#d97706">${amberCount}</div><div class="lbl">At Risk (Amber)</div></div>
        <div class="kpi"><div class="val" style="color:#16a34a">${greenCount}</div><div class="lbl">Within Limits</div></div>
        <div class="kpi"><div class="val" style="color:#7c3aed">${escalCount}</div><div class="lbl">Escalations</div></div>
        <div class="kpi"><div class="val" style="color:#dc2626">${appBreaches}</div><div class="lbl">Appetite Breaches</div></div>
      </div>

      <section>
        <h2>KRI Status Board</h2>
        ${kriWithLatest.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No active KRIs.</p>'
          : `<table><thead><tr><th>KRI / Owner</th><th>Category</th><th>Current Value</th><th>RAG</th><th>Trend</th><th>Escalate</th><th>Comments</th></tr></thead><tbody>${kriRows}</tbody></table>`}
      </section>

      <section>
        <h2>Risk Register — Open Risks (sorted by score)</h2>
        ${sortedRisks.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No open risks.</p>'
          : `<table><thead><tr><th>Risk / Owner</th><th>Category</th><th>Score</th><th>Status</th><th>Appetite Breached</th><th>Mitigation</th></tr></thead><tbody>${riskRows}</tbody></table>`}
      </section>

      <section>
        <h2>Risk Appetite Monitor</h2>
        ${appetite.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No appetite thresholds defined.</p>'
          : `<table><thead><tr><th>Risk Category</th><th>Appetite Statement</th><th>Max Tolerable</th><th>Current Exposure</th><th>Utilisation</th><th>Status</th></tr></thead><tbody>${appRows}</tbody></table>`}
      </section>

      <section>
        <h2>Audit Findings — ${auditFindings.length} total, ${openAF} open &nbsp;|&nbsp; Critical: ${bySev.Critical} &nbsp; High: ${bySev.High} &nbsp; Medium: ${bySev.Medium} &nbsp; Low: ${bySev.Low}</h2>
        ${auditFindings.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No audit findings.</p>'
          : `<table><thead><tr><th>Finding</th><th>Severity</th><th>Business Unit</th><th>Status</th><th>Due Date</th></tr></thead><tbody>${afRows}</tbody></table>`}
      </section>

      <section>
        <h2>Corrective Actions — ${correctiveActions.length} total &nbsp;|&nbsp; Completed: ${caComplete} &nbsp; Open: ${caOpen} &nbsp; Avg Completion: ${avgCompletion}%</h2>
        ${correctiveActions.length === 0
          ? '<p style="color:#9ca3af;padding:12px 0">No corrective actions.</p>'
          : `<table><thead><tr><th>Action</th><th>Completion</th><th>Status</th><th>Target Date</th></tr></thead><tbody>${caRows}</tbody></table>`}
      </section>

      <div class="footer">
        <span>PMO Enterprise Portal — GRC Risk Intelligence Report</span>
        <span>Generated ${dateStr}</span>
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
      <div style={{ fontSize: 36, marginBottom: 12 }}>🛡️</div>
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
              <span style={{ fontSize: 22 }}>🛡️</span>
              <h1 style={{ margin: 0, fontSize: bp === "mobile" ? 17 : 21, fontWeight: 900 }}>GRC Risk Intelligence Dashboard</h1>
            </div>
            <p style={{ margin: 0, opacity: 0.65, fontSize: 12 }}>Key Risk Indicators · Risk Register · Appetite Monitoring</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2 }}>Last refreshed</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={load} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>↻ Refresh</button>
              <button onClick={printGRCReport} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", borderRadius: 7, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>🖨 Print Report</button>
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
          { label: "Total KRIs",           value: kriWithLatest.length, color: T.text,     accent: T.primary },
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

      {/* ── KRI Status Board ── */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: T.text }}>KRI Status Board</h2>
        {kriWithLatest.length === 0 ? (
          <p style={{ color: T.muted, fontSize: 13 }}>No active KRIs found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {["KRI Name / Owner","Category","Current Value","RAG","Trend","Period","Escalate",...(canEdit?[""]:[]),...(globalEdit?[""]:[])].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kriWithLatest.map(kri => {
                  const r  = kri.latest;
                  const rc = RAG_COLOR[r?.RAGStatus];
                  const isSelected = selectedKRI === kri.KRIID;
                  return (
                    <tr key={kri.KRIID}
                      onClick={() => setSelectedKRI(isSelected ? null : kri.KRIID)}
                      style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", background: isSelected ? "#f0f7ff" : "transparent", transition: "background 0.12s" }}>
                      <td style={{ padding: "11px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{kri.Title}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{kri.KRIOwner?.Title || "—"}</div>
                      </td>
                      <td style={{ padding: "11px 12px", fontSize: 12, color: T.muted }}>{kri.KRICategory || "—"}</td>
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
                          <button onClick={() => setMasterModal(kri)}
                            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", color: T.text, whiteSpace: "nowrap" }}>
                            Edit KRI
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {kriWithLatest.length > 0 && <p style={{ margin: "10px 0 0", fontSize: 11, color: T.muted }}>Click any row to view trend chart</p>}
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
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.text }}>📈 Trend — {kri?.Title}</h3>
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
          </div>
        );
      })()}

      {/* ── Risk Heatmap ── */}
      {riskReg.filter(r => r.RiskStatus !== "Closed").length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: T.text }}>🔥 Risk Heatmap</h3>
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
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 800, color: T.text }}>🎯 Risk Appetite by Category</h3>
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
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>⚠️ {globalEdit ? "All Risks" : "Top Risks by Score"}</h3>
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
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>🔍 Audit Findings Summary</h3>
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
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>✅ Corrective Actions Progress</h3>
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
        <GRCModal title={`Add KRI Reading — ${readingModal.Title}`} onClose={() => { setReadingModal(null); setSaveErr(""); }}>
          <GRCReadingForm kri={readingModal} onSave={saveReading} saving={saving} error={saveErr} onCancel={() => { setReadingModal(null); setSaveErr(""); }} />
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
        <GRCModal title={`Edit KRI — ${masterModal.Title}`} onClose={() => { setMasterModal(null); setSaveErr(""); }}>
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
