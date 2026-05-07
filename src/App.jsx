
import React, { useState, useMemo, useCallback, createContext, useContext, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area } from "recharts";

// ─── THEME TOKENS ────────────────────────────────────────────────
const THEMES = {
  light: {
    primary:    "#003932",
    accent:     "#00ffb3",
    secondary:  "#a1b9ab",
    light:      "#c9d5c9",
    danger:     "#ff5000",
    critical:   "#490300",
    bg:         "#f4f6f4",
    surface:    "#ffffff",
    border:     "#dce8dc",
    text:       "#0d1f1c",
    muted:      "#5a7a6e",
    sidebarBg:  "#003932",
    cardHover:  "#f0f7f4",
    inputBg:    "#ffffff",
    tableBg:    "#f4f6f4",
    // semantic
    headerBg:   "#003932",   // project header, banners
    headerText: "#ffffff",   // text ON dark header backgrounds
    btnPrimBg:  "#003932",   // primary button bg
    btnPrimText:"#00ffb3",   // primary button text
    accentText: "#0d1f1c",   // text ON accent-coloured backgrounds
    badgeBg:    "#e8f5f0",   // light tint badge
    inputText:  "#0d1f1c",
    selectBg:   "#ffffff",
  },
  dark: {
    primary:    "#00ffb3",   // accent is the "brand" highlight in dark
    accent:     "#00ffb3",
    secondary:  "#a1b9ab",
    light:      "#c9d5c9",
    danger:     "#ff5000",
    critical:   "#ff6b6b",
    bg:         "#0a1512",
    surface:    "#0f1e1a",
    border:     "#1a3330",
    text:       "#e8f5f0",
    muted:      "#7aaa96",
    sidebarBg:  "#060e0c",
    cardHover:  "#132820",
    inputBg:    "#132820",
    tableBg:    "#0a1512",
    // semantic
    headerBg:   "#061210",   // very dark for project header / banners
    headerText: "#e8f5f0",   // text ON dark header backgrounds
    btnPrimBg:  "#00ffb3",   // primary button bg in dark = accent
    btnPrimText:"#061210",   // dark text ON green button
    accentText: "#061210",   // text ON accent backgrounds
    badgeBg:    "#0f2a22",
    inputText:  "#e8f5f0",
    selectBg:   "#132820",
  },
};

// ─── THEME STORE (module-level, no context needed) ────────────────
// Simple pub/sub store - guaranteed to work
const themeStore = {
  dark: false,
  listeners: new Set(),
  get T() { return this.dark ? THEMES.dark : THEMES.light; },
  toggle() {
    this.dark = !this.dark;
    this.listeners.forEach(fn => fn());
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
};

// Hook that re-renders on theme change
const useT = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const unsub = themeStore.subscribe(() => rerender(n => n + 1));
    return unsub;
  }, []);
  return themeStore.T;
};

// Keep ThemeContext for compatibility (Header needs dark prop)
const ThemeContext = createContext(null);
const useDark = () => themeStore.dark;

let T = THEMES.light;

// ─── DATA LAYER ─────────────────────────────────────────────────
const DEPARTMENTS = [
  { id: "strategy", name: "Strategy & PMO", icon: "⚡", color: "#003932" },
  { id: "digital", name: "Digital", icon: "💻", color: "#0066cc" },
  { id: "operations", name: "Operations", icon: "⚙️", color: "#7c3aed" },
  { id: "grc", name: "GRC", icon: "🛡️", color: "#dc2626" },
  { id: "hr", name: "HR", icon: "👥", color: "#d97706" },
  { id: "it", name: "IT", icon: "🖥️", color: "#059669" },
  { id: "finance", name: "Finance", icon: "💰", color: "#0891b2" },
  { id: "quality", name: "Quality", icon: "✅", color: "#7c3aed" },
  { id: "performance", name: "Performance", icon: "📈", color: "#db2777" },
];

// ─── DEPARTMENTS CONTEXT (live CRUD) ──────────────────────────────
const DeptContext = createContext(null);
const useDepts = () => useContext(DeptContext);

// ─── OPTIONAL DOCUMENTS LIST (يختار منها في Admin) ───────────────
const OPTIONAL_DOCS = [
  "Resource Plan", "PO", "Invoice", "Security Approval",
  "Technical Specification", "Risk Assessment", "Vendor Contract",
  "Legal Review", "Compliance Certificate", "UAT Sign-off",
  "Change Request", "Stakeholder Register", "Communication Plan",
  "Training Plan", "Handover Document",
];

// ─── GATE DEFINITIONS ────────────────────────────────────────────
const GATE_DEFS = [
  { id: "G1", label: "Gate 1", name: "Initiation",  desc: "Project request & classification" },
  { id: "G2", label: "Gate 2", name: "Planning",    desc: "Charter, Business Case & stakeholder sign-off" },
  { id: "G3", label: "Gate 3", name: "Plan Submit", desc: "Project plan submitted" },
  { id: "G4", label: "Gate 4", name: "Execution",   desc: "Execution, IPI tracking & reporting" },
  { id: "G5", label: "Gate 5", name: "Closure",     desc: "Closure document & stakeholder sign-off" },
];

const PROJECTS = [
  // STRATEGY & PMO
  {
    id: "P001", code: "STRAT-2025-001", deptId: "strategy",
    name: "PMO Transformation",
    pm: "Mohammed", sponsor: "Alhanouf",
    projectType: "Enterprise Project",
    phase: "Execution", gate: "Gate 4", status: "On Track", priority: "Critical",
    progress: 72, plannedProgress: 68, startDate: "2025-01-15", plannedEnd: "2025-12-31",
    budget: 4500000, forecast: 4350000, actualCost: 2800000,
    riskLevel: "Medium", budgetStatus: "On Budget", strategic: "Digital Transformation",
    lastUpdate: "2025-05-01", classification: "Strategic Initiative",
    objective: "Transform the enterprise PMO into a world-class governance function",
    businessCase: "Improve project success rate from 62% to 90% within 24 months",
    // ── Gate Tracker ──────────────────────────────────────────────
    gates: [
      { id: "G1", status: "Approved", date: "2025-01-20", approver: "Alhanouf", notes: "Classified as Project — Strategic initiative" },
      { id: "G2", status: "Approved", date: "2025-02-01", approver: "Nawaf",    notes: "Charter and Business Case approved" },
      { id: "G3", status: "Approved", date: "2025-02-20", approver: "Alhanouf", notes: "Project plan accepted" },
      { id: "G4", status: "In Progress", date: null,       approver: "",         notes: "" },
      { id: "G5", status: "Pending",     date: null,       approver: "",         notes: "" },
    ],
    // ── Required Documents ─────────────────────────────────────────
    requiredDocs: ["Resource Plan", "Vendor Contract", "Training Plan"],
    milestones: [
      { id: "M1", name: "PMO Framework Approved", date: "2025-02-28", status: "Completed", owner: "Mohammed" },
      { id: "M2", name: "Tooling Implementation", date: "2025-06-30", status: "In Progress", owner: "Nawaf" },
      { id: "M3", name: "Training Programme Launch", date: "2025-09-15", status: "Upcoming", owner: "Munira" },
      { id: "M4", name: "Go-Live", date: "2025-12-15", status: "Upcoming", owner: "Mohammed" },
    ],
    risks: [
      { id: "R1", title: "Resource availability constraints", probability: "High", impact: "High", level: "Critical", owner: "Abdulrahman", status: "Open", mitigation: "Pre-book resource pipeline Q3-Q4", dueDate: "2025-06-01" },
      { id: "R2", title: "Stakeholder adoption resistance", probability: "Medium", impact: "High", level: "High", owner: "Nawaf", status: "Open", mitigation: "Change management programme initiated", dueDate: "2025-07-01" },
      { id: "R3", title: "Tooling integration complexity", probability: "Low", impact: "Medium", level: "Medium", owner: "Ali", status: "Mitigated", mitigation: "POC completed successfully", dueDate: "2025-05-15" },
    ],
    issues: [
      { id: "I1", title: "Delayed vendor contract sign-off", severity: "High", status: "Open", owner: "Alhanouf", raised: "2025-04-10", escalated: true },
      { id: "I2", title: "Training venue booking conflict", severity: "Medium", status: "In Progress", owner: "Munira", raised: "2025-04-22", escalated: false },
    ],
    benefits: [
      { id: "B1", category: "Efficiency", kpi: "Project Success Rate", baseline: "62%", target: "90%", current: "71%", owner: "Mohammed", realization: 38, contribution: "High" },
      { id: "B2", category: "Cost", kpi: "Portfolio Cost Savings", baseline: "0", target: "SAR 2M", current: "SAR 650K", owner: "Alhanouf", realization: 33, contribution: "Medium" },
      { id: "B3", category: "Governance", kpi: "Compliance Score", baseline: "55%", target: "95%", current: "78%", owner: "Abdulrahman", realization: 55, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation Approval", status: "Approved", owner: "Alhanouf", date: "2025-01-20", comments: "Classified as Project" },
      { id: "A2", gate: "Gate 2", title: "Charter & Business Case", status: "Approved", owner: "Nawaf", date: "2025-02-01", comments: "Full approval granted" },
      { id: "A3", gate: "Gate 3", title: "Plan Submission", status: "Approved", owner: "Alhanouf", date: "2025-02-20", comments: "Plan accepted" },
      { id: "A4", gate: "Gate 4", title: "Execution Gate", status: "In Progress", owner: "Alhanouf", date: null, comments: "" },
    ],
    documents: [
      { id: "D1", name: "Project Charter",  type: "Charter",       required: true,  required: true,  status: "Approved",  version: "v2.1", lastUpdated: "2025-02-01" },
      { id: "D2", name: "Business Case",    type: "Business Case", required: true,  required: true,  status: "Approved",  version: "v1.3", lastUpdated: "2025-01-20" },
      { id: "D3", name: "Resource Plan",    type: "Resource Plan", required: true,  status: "Approved",  version: "v1.0", lastUpdated: "2025-02-15" },
      { id: "D4", name: "Vendor Contract",  type: "Vendor Contract",required: true, status: "Draft",     version: "v0.2", lastUpdated: "2025-04-10" },
      { id: "D5", name: "Project Plan",    type: "Project Plan", required: true,  status: "Approved",  version: "v1.0", lastUpdated: "2025-03-20" },
      { id: "D6", name: "Closure E-Document", type: "Closure",       required: true,  required: true,  status: "Pending",   version: "",     lastUpdated: "" },
    ],
    updates: [
      { id: "U1", date: "2025-05-01", owner: "Mohammed", note: "Milestone 2 on track. Vendor contract escalated to sponsor for resolution. Q3 resource pipeline confirmed with HR." },
      { id: "U2", date: "2025-04-15", owner: "Nawaf",    note: "Training needs analysis completed. 3 venues shortlisted for programme delivery in September." },
      { id: "U3", date: "2025-04-01", owner: "Mohammed", note: "Gate 3 approved. Moving into full execution phase as planned." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Amber", quality: "Green", resource: "Amber", benefits: "Green", governance: "Green" },
    spi: 1.06, cpi: 1.03, daysRemaining: 243, daysDelayed: 0, scheduleVariance: "+4 days",
  },
  {
    id: "P002", code: "STRAT-2025-002", deptId: "strategy",
    name: "PMO Framework",
    pm: "Abdulrahman", sponsor: "Bader",
    phase: "Planning", gate: "Gate 2", status: "At Risk", priority: "High",
    progress: 35, plannedProgress: 45, startDate: "2025-02-01", plannedEnd: "2025-10-30",
    budget: 1800000, forecast: 2100000, actualCost: 620000,
    riskLevel: "High", budgetStatus: "Over Budget", strategic: "Corporate Strategy",
    lastUpdate: "2025-04-28", classification: "Strategic",
    objective: "Develop a strategic PMO framework",
    businessCase: "Align all Project to 4 strategic pillars",
    projectType: "Enterprise Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-02-10", approver: "Bader", notes: "Classified as Project" },
      { id: "G2", status: "Returned", date: "2025-04-05", approver: "Bader", notes: "Revise scope and timeline" },
      { id: "G3", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G4", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Stakeholder Register", "Communication Plan"],
    milestones: [
      { id: "M1", name: "Stakeholder Workshops", date: "2025-03-31", status: "Delayed", owner: "Nawaf" },
      { id: "M2", name: "Framework Draft", date: "2025-06-15", status: "Upcoming", owner: "Lujain" },
      { id: "M3", name: "Board Approval", date: "2025-09-01", status: "Upcoming", owner: "Bader" },
    ],
    risks: [
      { id: "R1", title: "Key stakeholder unavailability", probability: "High", impact: "High", level: "Critical", owner: "Nawaf", status: "Open", mitigation: "Rescheduling with exec assistants", dueDate: "2025-05-30" },
    ],
    issues: [
      { id: "I1", title: "Workshop facilitator contract delay", severity: "High", status: "Escalated", owner: "Bader", raised: "2025-03-20", escalated: true },
    ],
    benefits: [
      { id: "B1", category: "Strategic", kpi: "Strategy Alignment Score", baseline: "45%", target: "85%", current: "52%", owner: "Nawaf", realization: 18, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation Approval", status: "Approved", owner: "Bader", date: "2025-02-10", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning Approval", status: "Returned", owner: "Bader", date: "2025-04-05", comments: "Revise scope and timeline" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-02-05" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-01-30" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v3.0", lastUpdated: "2025-04-28" },
    ],
    updates: [
      { id: "U1", date: "2025-04-28", owner: "Nawaf", note: "Gate 2 returned. Revising scope per sponsor feedback. Workshops rescheduled to May 2025." },
    ],
    health: { scope: "Amber", schedule: "Red", budget: "Red", risk: "Red", quality: "Amber", resource: "Red", benefits: "Amber", governance: "Amber" },
    spi: 0.78, cpi: 0.88, daysRemaining: 185, daysDelayed: 18, scheduleVariance: "-18 days",
  },

  // DIGITAL
  {
    id: "P003", code: "DIGI-2025-001", deptId: "digital",
    name: "Digital Customer Portal Phase 2",
    pm: "Ali", sponsor: "Haifa",
    phase: "Execution", gate: "Gate 3", status: "On Track", priority: "Critical",
    progress: 61, plannedProgress: 58, startDate: "2025-01-01", plannedEnd: "2025-11-30",
    budget: 8200000, forecast: 8000000, actualCost: 4500000,
    riskLevel: "Medium", budgetStatus: "On Budget", strategic: "Digital Transformation",
    lastUpdate: "2025-05-02", classification: "Strategic Initiative",
    objective: "Launch next-generation customer self-service portal",
    businessCase: "Reduce call centre volume by 40% and increase NPS by 25 points",
    projectType: "Business Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-01-10", approver: "Haifa", notes: "New enterprise system" },
      { id: "G2", status: "Approved", date: "2025-02-01", approver: "Haifa", notes: "Charter approved" },
      { id: "G3", status: "Approved", date: "2025-03-01", approver: "Haifa", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Security Approval", "UAT Sign-off"],
    milestones: [
      { id: "M1", name: "UX Design Approved", date: "2025-02-28", status: "Completed", owner: "Ali" },
      { id: "M2", name: "Backend API Integration", date: "2025-05-31", status: "In Progress", owner: "Naif" },
      { id: "M3", name: "UAT Sign-off", date: "2025-09-30", status: "Upcoming", owner: "Haifa" },
      { id: "M4", name: "Production Launch", date: "2025-11-15", status: "Upcoming", owner: "Ali" },
    ],
    risks: [
      { id: "R1", title: "Third-party API latency issues", probability: "Medium", impact: "High", level: "High", owner: "Naif", status: "Open", mitigation: "Caching layer implementation", dueDate: "2025-05-31" },
      { id: "R2", title: "Security penetration test findings", probability: "Medium", impact: "Critical", level: "High", owner: "Ali", status: "Open", mitigation: "VAPT scheduled for June", dueDate: "2025-06-30" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "Customer", kpi: "NPS Score", baseline: "42", target: "67", current: "51", owner: "Haifa", realization: 36, contribution: "High" },
      { id: "B2", category: "Cost", kpi: "Call Centre Volume Reduction", baseline: "0%", target: "40%", current: "12%", owner: "Ali", realization: 30, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Haifa", date: "2025-01-10", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Design", status: "Approved", owner: "Haifa", date: "2025-03-01", comments: "Approved with UX revisions" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Haifa", date: "2025-04-01", comments: "Full approval" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-01-08" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v2.0", lastUpdated: "2024-12-15" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v12.0", lastUpdated: "2025-05-02" },
      { id: "D4", name: "April Status Report", type: "Status Report", required: false, status: "Submitted", version: "v1.0", lastUpdated: "2025-05-02" },
    ],
    updates: [
      { id: "U1", date: "2025-05-02", owner: "Ali", note: "Backend integration 75% complete. Security review scheduled for June. UAT plan being finalised with business stakeholders." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Amber", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    spi: 1.05, cpi: 1.04, daysRemaining: 212, daysDelayed: 0, scheduleVariance: "+3 days",
  },
  {
    id: "P004", code: "DIGI-2025-002", deptId: "digital",
    name: "AI Analytics Platform",
    pm: "Maram", sponsor: "Haifa",
    phase: "Initiation", gate: "Gate 1", status: "Not Started", priority: "High",
    progress: 8, plannedProgress: 15, startDate: "2025-04-01", plannedEnd: "2026-03-31",
    budget: 12000000, forecast: 12000000, actualCost: 320000,
    riskLevel: "High", budgetStatus: "On Budget", strategic: "Innovation & Technology",
    lastUpdate: "2025-04-20", classification: "Transformation",
    objective: "Build enterprise AI analytics and predictive intelligence platform",
    businessCase: "Enable data-driven decision making across all business units",
    projectType: "Enterprise Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-04-05", approver: "Haifa", notes: "New enterprise AI system" },
      { id: "G2", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G3", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G4", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Technical Specification", "Vendor Contract"],
    milestones: [
      { id: "M1", name: "Vendor Selection", date: "2025-05-31", status: "In Progress", owner: "Maram" },
      { id: "M2", name: "Architecture Design", date: "2025-07-31", status: "Upcoming", owner: "Naif" },
    ],
    risks: [
      { id: "R1", title: "AI talent scarcity in market", probability: "High", impact: "High", level: "Critical", owner: "Maram", status: "Open", mitigation: "Partner with specialist vendor", dueDate: "2025-06-01" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "Innovation", kpi: "Predictive Accuracy", baseline: "N/A", target: "85%", current: "N/A", owner: "Maram", realization: 0, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation Approval", status: "Pending", owner: "Haifa", date: null, comments: "" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Draft", version: "v0.3", lastUpdated: "2025-04-18" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Under Review", version: "v1.0", lastUpdated: "2025-04-15" },
    ],
    updates: [
      { id: "U1", date: "2025-04-20", owner: "Maram", note: "Vendor RFP issued. 4 responses received. Evaluation committee formed with IT and Finance." },
    ],
    health: { scope: "Amber", schedule: "Amber", budget: "Green", risk: "Red", quality: "Amber", resource: "Red", benefits: "Amber", governance: "Amber" },
    spi: 0.53, cpi: 1.00, daysRemaining: 335, daysDelayed: 0, scheduleVariance: "-7 days",
  },

  // OPERATIONS
  {
    id: "P005", code: "OPS-2025-001", deptId: "operations",
    name: "Supply Chain Optimisation",
    pm: "Adel", sponsor: "Munira",
    phase: "Execution", gate: "Gate 3", status: "Delayed", priority: "High",
    progress: 42, plannedProgress: 58, startDate: "2024-10-01", plannedEnd: "2025-09-30",
    budget: 6500000, forecast: 7200000, actualCost: 3800000,
    riskLevel: "High", budgetStatus: "Over Budget", strategic: "Operational Excellence",
    lastUpdate: "2025-04-30", classification: "Operational",
    objective: "Reduce supply chain costs by 20% and improve delivery performance",
    businessCase: "Deliver SAR 8M annual savings through process and supplier optimisation",
    projectType: "Internal Project",
    gates: [
      { id: "G1", status: "Approved", date: "2024-10-10", approver: "Munira", notes: "Cost > 100K, Duration > 4 weeks" },
      { id: "G2", status: "Approved", date: "2024-11-30", approver: "Munira", notes: "Approved" },
      { id: "G3", status: "Approved", date: "2025-02-01", approver: "Munira", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "Delayed — supplier issues" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Vendor Contract", "PO", "Invoice"],
    milestones: [
      { id: "M1", name: "Process Mapping Complete", date: "2024-12-31", status: "Completed", owner: "Adel" },
      { id: "M2", name: "Supplier Renegotiation", date: "2025-03-31", status: "Delayed", owner: "Naif" },
      { id: "M3", name: "System Integration", date: "2025-07-31", status: "Upcoming", owner: "Ali" },
    ],
    risks: [
      { id: "R1", title: "Supplier contract disputes", probability: "High", impact: "Critical", level: "Critical", owner: "Adel", status: "Open", mitigation: "Legal team engaged. Escalated to CFO.", dueDate: "2025-05-15" },
      { id: "R2", title: "ERP system integration delays", probability: "High", impact: "High", level: "High", owner: "Ali", status: "Open", mitigation: "Dedicated integration sprint team formed", dueDate: "2025-06-30" },
    ],
    issues: [
      { id: "I1", title: "Key supplier refusing contract terms", severity: "Critical", status: "Escalated", owner: "Munira", raised: "2025-03-15", escalated: true },
      { id: "I2", title: "ERP module delivery 6 weeks late", severity: "High", status: "Open", owner: "Adel", raised: "2025-04-01", escalated: false },
    ],
    benefits: [
      { id: "B1", category: "Cost", kpi: "Annual Savings", baseline: "0", target: "SAR 8M", current: "SAR 1.2M", owner: "Munira", realization: 15, contribution: "High" },
      { id: "B2", category: "Operations", kpi: "On-Time Delivery Rate", baseline: "72%", target: "92%", current: "76%", owner: "Adel", realization: 20, contribution: "Medium" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Munira", date: "2024-10-10", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Munira", date: "2024-11-30", comments: "Approved" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Munira", date: "2025-02-01", comments: "Approved" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-10-05" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-09-20" },
      { id: "D3", name: "Project Plan", type: "Plan", required: false, status: "Current", version: "v15.0", lastUpdated: "2025-04-30" },
      { id: "D4", name: "Status Report - April", type: "Status Report", required: false, status: "Submitted", version: "v1.0", lastUpdated: "2025-05-01" },
    ],
    updates: [
      { id: "U1", date: "2025-04-30", owner: "Adel", note: "Critical supplier escalation ongoing. Legal resolution expected by May 15. ERP delays impact schedule by estimated 6 weeks. Recovery plan presented to sponsor." },
    ],
    health: { scope: "Amber", schedule: "Red", budget: "Red", risk: "Red", quality: "Amber", resource: "Amber", benefits: "Red", governance: "Amber" },
    spi: 0.72, cpi: 0.81, daysRemaining: 153, daysDelayed: 28, scheduleVariance: "-28 days",
  },

  // GRC
  {
    id: "P006", code: "GRC-2025-001", deptId: "grc",
    name: "Regulatory Compliance Framework",
    pm: "Abdulrahman", sponsor: "Bader",
    phase: "Execution", gate: "Gate 3", status: "On Track", priority: "Critical",
    progress: 55, plannedProgress: 52, startDate: "2025-01-01", plannedEnd: "2025-12-31",
    budget: 3200000, forecast: 3100000, actualCost: 1600000,
    riskLevel: "Medium", budgetStatus: "On Budget", strategic: "Governance & Compliance",
    lastUpdate: "2025-05-01", classification: "Compliance",
    objective: "Achieve full regulatory compliance across all business lines",
    businessCase: "Mitigate SAR 15M regulatory fine exposure and enhance audit readiness",
    projectType: "Enterprise Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-01-08", approver: "Bader", notes: "Regulatory initiative" },
      { id: "G2", status: "Approved", date: "2025-02-15", approver: "Bader", notes: "Approved" },
      { id: "G3", status: "Approved", date: "2025-03-10", approver: "Bader", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Compliance Certificate", "Legal Review"],
    milestones: [
      { id: "M1", name: "Gap Assessment Complete", date: "2025-02-28", status: "Completed", owner: "Abdulrahman" },
      { id: "M2", name: "Policy Framework Published", date: "2025-05-31", status: "In Progress", owner: "Lujain" },
      { id: "M3", name: "Training Rollout", date: "2025-08-31", status: "Upcoming", owner: "Munira" },
      { id: "M4", name: "Audit Readiness Sign-off", date: "2025-11-30", status: "Upcoming", owner: "Bader" },
    ],
    risks: [
      { id: "R1", title: "Regulatory changes post-publication", probability: "Medium", impact: "High", level: "High", owner: "Abdulrahman", status: "Open", mitigation: "Monthly regulatory watch process established", dueDate: "Ongoing" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "Compliance", kpi: "Regulatory Compliance Score", baseline: "61%", target: "98%", current: "74%", owner: "Abdulrahman", realization: 35, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Bader", date: "2025-01-08", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Bader", date: "2025-02-15", comments: "Approved" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Bader", date: "2025-03-10", comments: "Approved" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-01-05" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-12-20" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v9.0", lastUpdated: "2025-05-01" },
      { id: "D4", name: "Status Report - April", type: "Status Report", required: false, status: "Submitted", version: "v1.0", lastUpdated: "2025-05-01" },
      { id: "D5", name: "Policy Framework v0.8", type: "Governance", required: false, status: "Draft", version: "v0.8", lastUpdated: "2025-04-28" },
    ],
    updates: [
      { id: "U1", date: "2025-05-01", owner: "Abdulrahman", note: "Policy framework 80% complete. Legal review underway. Training content development commenced. On track for May 31 milestone." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Amber", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    spi: 1.06, cpi: 1.03, daysRemaining: 244, daysDelayed: 0, scheduleVariance: "+3 days",
  },

  // HR
  {
    id: "P007", code: "HR-2025-001", deptId: "hr",
    name: "Talent Management System Implementation",
    pm: "Lujain", sponsor: "Alhanouf",
    phase: "Execution", gate: "Gate 3", status: "On Track", priority: "High",
    progress: 68, plannedProgress: 65, startDate: "2024-11-01", plannedEnd: "2025-08-31",
    budget: 5500000, forecast: 5400000, actualCost: 3500000,
    riskLevel: "Low", budgetStatus: "On Budget", strategic: "People & Culture",
    lastUpdate: "2025-04-30", classification: "Operational",
    objective: "Deploy end-to-end talent management platform across the organisation",
    businessCase: "Reduce time-to-hire by 35% and improve retention by 20%",
    projectType: "Internal Project",
    gates: [
      { id: "G1", status: "Approved", date: "2024-11-05", approver: "Alhanouf", notes: "New enterprise system" },
      { id: "G2", status: "Approved", date: "2024-12-10", approver: "Alhanouf", notes: "Approved" },
      { id: "G3", status: "Approved", date: "2025-02-01", approver: "Alhanouf", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Vendor Contract", "UAT Sign-off"],
    milestones: [
      { id: "M1", name: "System Configuration", date: "2025-01-31", status: "Completed", owner: "Lujain" },
      { id: "M2", name: "Data Migration", date: "2025-04-30", status: "Completed", owner: "Ali" },
      { id: "M3", name: "User Acceptance Testing", date: "2025-06-30", status: "In Progress", owner: "Munira" },
      { id: "M4", name: "Go-Live", date: "2025-08-15", status: "Upcoming", owner: "Lujain" },
    ],
    risks: [
      { id: "R1", title: "Data quality issues during migration", probability: "Low", impact: "Medium", level: "Medium", owner: "Ali", status: "Mitigated", mitigation: "Data cleansing completed successfully", dueDate: "2025-04-30" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "HR", kpi: "Time-to-Hire (days)", baseline: "45", target: "29", current: "38", owner: "Lujain", realization: 44, contribution: "High" },
      { id: "B2", category: "HR", kpi: "Employee Retention Rate", baseline: "78%", target: "93%", current: "82%", owner: "Alhanouf", realization: 27, contribution: "Medium" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Alhanouf", date: "2024-11-05", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Alhanouf", date: "2024-12-10", comments: "Approved" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Alhanouf", date: "2025-02-01", comments: "Approved" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-11-02" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-10-25" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v11.0", lastUpdated: "2025-04-30" },
      { id: "D4", name: "Status Report - April", type: "Status Report", required: false, status: "Submitted", version: "v1.0", lastUpdated: "2025-04-30" },
      { id: "D5", name: "UAT Plan", type: "Governance", required: false, status: "Approved", version: "v1.0", lastUpdated: "2025-04-20" },
    ],
    updates: [
      { id: "U1", date: "2025-04-30", owner: "Lujain", note: "Data migration completed successfully. UAT phase commenced May 1. 45 test users onboarded. Go-live preparation timeline confirmed." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    spi: 1.05, cpi: 1.02, daysRemaining: 118, daysDelayed: 0, scheduleVariance: "+3 days",
  },

  // IT
  {
    id: "P008", code: "IT-2025-001", deptId: "it",
    name: "Cloud Infrastructure Migration",
    pm: "Naif", sponsor: "Nawaf",
    phase: "Execution", gate: "Gate 3", status: "At Risk", priority: "Critical",
    progress: 48, plannedProgress: 55, startDate: "2025-01-01", plannedEnd: "2025-12-31",
    budget: 15000000, forecast: 16500000, actualCost: 7200000,
    riskLevel: "High", budgetStatus: "Over Budget", strategic: "Digital Transformation",
    lastUpdate: "2025-05-01", classification: "Infrastructure",
    objective: "Migrate 95% of on-premise workloads to cloud infrastructure",
    businessCase: "Reduce infrastructure costs by 30% and improve system availability to 99.99%",
    projectType: "Enterprise Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-01-10", approver: "Nawaf", notes: "New enterprise system — cloud migration" },
      { id: "G2", status: "Approved", date: "2025-02-15", approver: "Nawaf", notes: "Approved with budget caveat" },
      { id: "G3", status: "Approved", date: "2025-03-20", approver: "Nawaf", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "At risk — legacy issues" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Technical Specification", "Security Approval", "Vendor Contract"],
    milestones: [
      { id: "M1", name: "Wave 1 Migration (Dev/Test)", date: "2025-03-31", status: "Completed", owner: "Naif" },
      { id: "M2", name: "Wave 2 Migration (Non-Critical)", date: "2025-06-30", status: "In Progress", owner: "Ali" },
      { id: "M3", name: "Wave 3 Migration (Critical)", date: "2025-10-31", status: "Upcoming", owner: "Naif" },
      { id: "M4", name: "Legacy Decommission", date: "2025-12-15", status: "Upcoming", owner: "Nawaf" },
    ],
    risks: [
      { id: "R1", title: "Critical system downtime during migration", probability: "Medium", impact: "Critical", level: "Critical", owner: "Naif", status: "Open", mitigation: "Blue-green deployment strategy implemented", dueDate: "2025-10-31" },
      { id: "R2", title: "Cloud costs exceeding estimates", probability: "High", impact: "High", level: "High", owner: "Nawaf", status: "Open", mitigation: "FinOps team engaged. Cost governance process established", dueDate: "Ongoing" },
    ],
    issues: [
      { id: "I1", title: "Legacy application incompatibility discovered", severity: "High", status: "In Progress", owner: "Naif", raised: "2025-04-15", escalated: false },
    ],
    benefits: [
      { id: "B1", category: "Cost", kpi: "Infrastructure Cost Reduction", baseline: "0%", target: "30%", current: "8%", owner: "Nawaf", realization: 27, contribution: "High" },
      { id: "B2", category: "Availability", kpi: "System Uptime", baseline: "99.2%", target: "99.99%", current: "99.7%", owner: "Naif", realization: 54, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Nawaf", date: "2025-01-10", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Nawaf", date: "2025-02-15", comments: "Approved with budget caveat" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Nawaf", date: "2025-03-20", comments: "Approved" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-01-08" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-12-15" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v14.0", lastUpdated: "2025-05-01" },
      { id: "D4", name: "Architecture Design", type: "Technical", required: false, status: "Approved", version: "v2.0", lastUpdated: "2025-02-10" },
    ],
    updates: [
      { id: "U1", date: "2025-05-01", owner: "Naif", note: "Wave 2 migration 60% complete. Legacy app compatibility issue being resolved by vendor. FinOps review identifies SAR 1.2M potential savings if right-sizing implemented by Q3." },
    ],
    health: { scope: "Green", schedule: "Amber", budget: "Red", risk: "Red", quality: "Green", resource: "Amber", benefits: "Amber", governance: "Green" },
    spi: 0.87, cpi: 0.86, daysRemaining: 244, daysDelayed: 12, scheduleVariance: "-12 days",
  },

  // FINANCE
  {
    id: "P009", code: "FIN-2025-001", deptId: "finance",
    name: "Finance Transformation Programme",
    pm: "Haifa", sponsor: "Bader",
    phase: "Planning", gate: "Gate 2", status: "On Track", priority: "High",
    progress: 28, plannedProgress: 25, startDate: "2025-03-01", plannedEnd: "2026-06-30",
    budget: 9800000, forecast: 9800000, actualCost: 1100000,
    riskLevel: "Medium", budgetStatus: "On Budget", strategic: "Operational Excellence",
    lastUpdate: "2025-04-28", classification: "Transformation",
    objective: "Transform finance function through automation and process standardisation",
    businessCase: "Reduce month-end close from 12 to 5 days and automate 70% of manual processes",
    projectType: "Internal Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-03-05", approver: "Bader", notes: "Cost > 100K, new enterprise system" },
      { id: "G2", status: "Pending", date: null, approver: "", notes: "Gate 2 approval pack in preparation" },
      { id: "G3", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G4", status: "Pending", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Technical Specification", "Vendor Contract"],
    milestones: [
      { id: "M1", name: "Current State Assessment", date: "2025-03-31", status: "Completed", owner: "Haifa" },
      { id: "M2", name: "Future State Design", date: "2025-06-30", status: "In Progress", owner: "Adel" },
      { id: "M3", name: "Technology Selection", date: "2025-09-30", status: "Upcoming", owner: "Naif" },
    ],
    risks: [
      { id: "R1", title: "Complexity of ERP integration", probability: "Medium", impact: "High", level: "High", owner: "Haifa", status: "Open", mitigation: "Specialist ERP consultant engaged", dueDate: "2025-09-30" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "Efficiency", kpi: "Month-End Close Duration (days)", baseline: "12", target: "5", current: "12", owner: "Haifa", realization: 0, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Bader", date: "2025-03-05", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Pending", owner: "Bader", date: null, comments: "" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-03-03" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-02-20" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v4.0", lastUpdated: "2025-04-28" },
    ],
    updates: [
      { id: "U1", date: "2025-04-28", owner: "Haifa", note: "Current state assessment report completed and distributed. Future state workshops scheduled for May and June. Gate 2 approval pack being prepared." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Amber", quality: "Green", resource: "Green", benefits: "Amber", governance: "Green" },
    spi: 1.12, cpi: 1.00, daysRemaining: 425, daysDelayed: 0, scheduleVariance: "+8 days",
  },

  // QUALITY
  {
    id: "P010", code: "QUAL-2025-001", deptId: "quality",
    name: "ISO 9001:2025 Certification",
    pm: "Munira", sponsor: "Abdulrahman",
    phase: "Execution", gate: "Gate 3", status: "Completed", priority: "Critical",
    progress: 100, plannedProgress: 100, startDate: "2024-07-01", plannedEnd: "2025-04-30",
    budget: 2200000, forecast: 2100000, actualCost: 2050000,
    riskLevel: "Low", budgetStatus: "On Budget", strategic: "Quality & Excellence",
    lastUpdate: "2025-05-01", classification: "Compliance",
    objective: "Achieve ISO 9001:2025 certification across all business units",
    businessCase: "Required for key client contracts and regulatory requirements",
    projectType: "Enterprise Project",
    gates: [
      { id: "G1", status: "Approved", date: "2024-07-05", approver: "Abdulrahman", notes: "Regulatory initiative" },
      { id: "G2", status: "Approved", date: "2024-08-15", approver: "Abdulrahman", notes: "Approved" },
      { id: "G3", status: "Approved", date: "2024-10-01", approver: "Abdulrahman", notes: "Plan submitted" },
      { id: "G4", status: "Approved", date: "2025-04-15", approver: "Abdulrahman", notes: "Certification achieved" },
      { id: "G5", status: "Approved", date: "2025-05-01", approver: "Abdulrahman", notes: "Closure complete. Excellent delivery." },
    ],
    requiredDocs: ["Compliance Certificate"],
    milestones: [
      { id: "M1", name: "Gap Analysis", date: "2024-09-30", status: "Completed", owner: "Munira" },
      { id: "M2", name: "Process Documentation", date: "2024-12-31", status: "Completed", owner: "Lujain" },
      { id: "M3", name: "Internal Audit", date: "2025-02-28", status: "Completed", owner: "Munira" },
      { id: "M4", name: "Certification Audit", date: "2025-04-15", status: "Completed", owner: "Abdulrahman" },
    ],
    risks: [],
    issues: [],
    benefits: [
      { id: "B1", category: "Quality", kpi: "Certification Achievement", baseline: "Not Certified", target: "Certified", current: "Certified", owner: "Munira", realization: 100, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Abdulrahman", date: "2024-07-05", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Abdulrahman", date: "2024-08-15", comments: "Approved" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Abdulrahman", date: "2024-10-01", comments: "Approved" },
      { id: "A4", gate: "Gate 4", title: "Closure", status: "Approved", owner: "Abdulrahman", date: "2025-05-01", comments: "Certified. Outstanding programme delivery." },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-07-03" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2024-06-25" },
      { id: "D3", name: "Closure Report", type: "Closure", required: false, status: "Approved", version: "v1.0", lastUpdated: "2025-05-01" },
      { id: "D4", name: "Lessons Learned", type: "Lessons Learned", required: false, status: "Final", version: "v1.0", lastUpdated: "2025-04-30" },
      { id: "D5", name: "ISO Certificate", type: "Governance", required: false, status: "Received", version: "v1.0", lastUpdated: "2025-04-25" },
    ],
    updates: [
      { id: "U1", date: "2025-05-01", owner: "Munira", note: "Certification achieved on April 25, 2025. Excellent audit outcome. Closure report approved. Lessons learned documented." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    spi: 1.00, cpi: 1.02, daysRemaining: 0, daysDelayed: 0, scheduleVariance: "On Time",
  },

  // PERFORMANCE
  {
    id: "P011", code: "PERF-2025-001", deptId: "performance",
    name: "KPI Management Platform",
    pm: "Mohammed", sponsor: "Alhanouf",
    phase: "Execution", gate: "Gate 3", status: "On Track", priority: "High",
    progress: 58, plannedProgress: 55, startDate: "2025-02-01", plannedEnd: "2025-10-31",
    budget: 3800000, forecast: 3700000, actualCost: 1900000,
    riskLevel: "Low", budgetStatus: "On Budget", strategic: "Performance Excellence",
    lastUpdate: "2025-04-29", classification: "Strategic",
    objective: "Implement enterprise KPI management and performance reporting platform",
    businessCase: "Enable real-time performance visibility for all executives and department heads",
    projectType: "Internal Project",
    gates: [
      { id: "G1", status: "Approved", date: "2025-02-05", approver: "Alhanouf", notes: "New enterprise system — KPI platform" },
      { id: "G2", status: "Approved", date: "2025-03-15", approver: "Alhanouf", notes: "Approved" },
      { id: "G3", status: "Approved", date: "2025-04-01", approver: "Alhanouf", notes: "Plan submitted" },
      { id: "G4", status: "In Progress", date: null, approver: "", notes: "" },
      { id: "G5", status: "Pending", date: null, approver: "", notes: "" },
    ],
    requiredDocs: ["Technical Specification"],
    milestones: [
      { id: "M1", name: "KPI Library Defined", date: "2025-03-31", status: "Completed", owner: "Mohammed" },
      { id: "M2", name: "Platform Configuration", date: "2025-06-30", status: "In Progress", owner: "Maram" },
      { id: "M3", name: "Executive Dashboard Launch", date: "2025-09-15", status: "Upcoming", owner: "Alhanouf" },
    ],
    risks: [
      { id: "R1", title: "Data source integration complexity", probability: "Low", impact: "Medium", level: "Low", owner: "Mohammed", status: "Open", mitigation: "API integration plan reviewed and approved", dueDate: "2025-06-30" },
    ],
    issues: [],
    benefits: [
      { id: "B1", category: "Performance", kpi: "Executive Reporting Automation", baseline: "20%", target: "90%", current: "35%", owner: "Mohammed", realization: 17, contribution: "High" },
    ],
    approvals: [
      { id: "A1", gate: "Gate 1", title: "Initiation", status: "Approved", owner: "Alhanouf", date: "2025-02-05", comments: "Approved" },
      { id: "A2", gate: "Gate 2", title: "Planning", status: "Approved", owner: "Alhanouf", date: "2025-03-15", comments: "Approved" },
      { id: "A3", gate: "Gate 3", title: "Execution", status: "Approved", owner: "Alhanouf", date: "2025-04-01", comments: "Approved" },
    ],
    documents: [
      { id: "D1", name: "Project Charter", type: "Charter", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-02-03" },
      { id: "D2", name: "Business Case", type: "Business Case", required: true,  status: "Approved", version: "v1.0", lastUpdated: "2025-01-25" },
      { id: "D3", name: "RAID Log", type: "RAID", required: false, status: "Current", version: "v7.0", lastUpdated: "2025-04-29" },
    ],
    updates: [
      { id: "U1", date: "2025-04-29", owner: "Mohammed", note: "Platform configuration 45% complete. KPI mapping sessions completed with 7 departments. Integration with ERP and BI tools in progress." },
    ],
    health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
    spi: 1.05, cpi: 1.03, daysRemaining: 185, daysDelayed: 0, scheduleVariance: "+3 days",
  },
];

// ─── COMPUTED METRICS ─────────────────────────────────────────────
function getDeptStats(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  const total = dp.length;
  const active = dp.filter(p => p.status === "On Track" || p.status === "At Risk").length;
  const delayed = dp.filter(p => p.status === "Delayed").length;
  const completed = dp.filter(p => p.status === "Completed").length;
  const highRisk = dp.filter(p => p.riskLevel === "High" || p.riskLevel === "Critical").length;
  const health = total ? Math.round(dp.reduce((s, p) => s + p.progress, 0) / total) : 0;
  const totalBudget = dp.reduce((s, p) => s + p.budget, 0);
  const actualCost = dp.reduce((s, p) => s + p.actualCost, 0);
  const budgetUtil = totalBudget ? Math.round((actualCost / totalBudget) * 100) : 0;
  return { total, active, delayed, completed, highRisk, health, totalBudget, actualCost, budgetUtil };
}

// ─── IPI CALCULATIONS ─────────────────────────────────────────────
// IPI per project = SPI×50% + CPI×25% + DocsCompliance×25%
// Capped at 1.2 to avoid inflated scores; normalised to 0–100
function calcProjectIPI(project) {
  // Only count REQUIRED documents in compliance score
  const allDocs = project.documents ?? [];
  const reqDocs = allDocs.filter(d => d.required === true);
  const docsTotal = reqDocs.length;
  const docsReady = reqDocs.filter(d =>
    ["Approved","Final","Received","Current","Submitted"].includes(d.status)
  ).length;
  const docsScore = docsTotal > 0 ? docsReady / docsTotal : 0;

  const spi = Math.min(project.spi ?? 1, 1.2);
  const cpi = Math.min(project.cpi ?? 1, 1.2);

  const raw = (spi * 0.5) + (cpi * 0.25) + (docsScore * 0.25);
  return Math.min(Math.round((raw / 1.15) * 100), 100);
}

// IPI per department = average of its projects' IPIs
function calcDeptIPI(deptId, projects) {
  const dp = projects.filter(p => p.deptId === deptId);
  if (!dp.length) return 0;
  return Math.round(dp.reduce((s, p) => s + calcProjectIPI(p), 0) / dp.length);
}

// IPI colour band
function ipiColor(score) {
  if (score >= 85) return { color: "#15803d", bg: "#dcfce7", label: "Excellent" };
  if (score >= 70) return { color: T.primary, bg: "#e8f5f0", label: "Good" };
  if (score >= 55) return { color: "#854d0e", bg: "#fef9c3", label: "Fair" };
  return { color: "#991b1b", bg: "#fee2e2", label: "Poor" };
}

// ─── SHAREPOINT SERVICE LAYER (swap mock → Graph API here) ─────────
// Replace these functions with real API calls when connecting SharePoint.
// Each function signature stays identical so the UI never changes.
const SPService = {
  // GET
  getProjects: async (mockProjects) => mockProjects,
  // UPSERT
  saveProject: async (project) => project,
  // DELETE / ARCHIVE
  archiveProject: async (id) => id,
  // Example Graph API call (uncomment when ready):
  // getProjects: async () => {
  //   const res = await fetch(
  //     `https://graph.microsoft.com/v1.0/sites/{siteId}/lists/Projects/items?$expand=fields`,
  //     { headers: { Authorization: `Bearer ${token}` } }
  //   );
  //   const data = await res.json();
  //   return data.value.map(item => item.fields);
  // },
};

// ─── HELPERS ──────────────────────────────────────────────────────
const fmt = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n;
const fmtSAR = (n) => `SAR ${fmt(n)}`;

const statusColor = {
  "On Track": { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" },
  "At Risk": { bg: "#fef9c3", text: "#854d0e", dot: "#eab308" },
  "Delayed": { bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  "Completed": { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "Not Started": { bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
};

const healthColor = {
  "Green": { bg: "#dcfce7", text: "#15803d", label: "Green" },
  "Amber": { bg: "#fef9c3", text: "#854d0e", label: "Amber" },
  "Red": { bg: "#fee2e2", text: "#991b1b", label: "Red" },
};

const riskColor = {
  "Critical": { bg: "#fee2e2", text: "#991b1b" },
  "High": { bg: "#fef3c7", text: "#92400e" },
  "Medium": { bg: "#fef9c3", text: "#854d0e" },
  "Low": { bg: "#dcfce7", text: "#15803d" },
};

// ─── UI COMPONENTS ───────────────────────────────────────────────
// ─── GATE TRACKER COMPONENT ──────────────────────────────────────
const GateTracker = ({ gates }) => {
  const T = useT();
  const [expanded, setExpanded] = useState(null);

  const gateStyle = {
    "Approved":    { bg: "#dcfce7", text: "#15803d", border: "#16a34a", icon: "✓" },
    "In Progress": { bg: "#fef9c3", text: "#854d0e", border: "#eab308", icon: "◎" },
    "Pending":     { bg: T.bg,      text: T.muted,   border: T.border,  icon: "○" },
    "Returned":    { bg: "#fee2e2", text: "#991b1b", border: "#dc2626", icon: "↩" },
    "Rejected":    { bg: "#fee2e2", text: "#991b1b", border: "#dc2626", icon: "✕" },
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>Gate Progress</div>
      {/* Track */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 12 }}>
        {GATE_DEFS.map((def, i) => {
          const g = gates?.find(x => x.id === def.id) || { status: "Pending" };
          const s = gateStyle[g.status] || gateStyle["Pending"];
          const isLast = i === GATE_DEFS.length - 1;
          return (
            <div key={def.id} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
              {/* Gate circle */}
              <div onClick={() => setExpanded(expanded === def.id ? null : def.id)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 64 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: s.bg, border: `2px solid ${s.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: s.text, fontWeight: 900,
                  transition: "transform 0.15s",
                  transform: expanded === def.id ? "scale(1.15)" : "scale(1)",
                }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.text, marginTop: 4, whiteSpace: "nowrap" }}>{def.label}</div>
                <div style={{ fontSize: 9, color: T.muted, whiteSpace: "nowrap" }}>{def.name}</div>
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{ flex: 1, height: 2, background: g.status === "Approved" ? "#16a34a" : T.border, marginBottom: 22, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded && (() => {
        const def = GATE_DEFS.find(d => d.id === expanded);
        const g = gates?.find(x => x.id === expanded) || { status: "Pending" };
        const s = gateStyle[g.status] || gateStyle["Pending"];
        return (
          <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "14px 18px", marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 13, color: s.text }}>{def.label} — {def.name}</span>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: s.text, opacity: 0.8 }}>{def.desc}</p>
              </div>
              <span style={{ background: s.border, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, alignSelf: "flex-start" }}>{g.status}</span>
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 12, color: s.text }}>
              {g.date     && <div>📅 Date: <strong>{g.date}</strong></div>}
              {g.approver && <div>👤 Approver: <strong>{g.approver}</strong></div>}
              {g.notes    && <div>💬 Notes: <strong>{g.notes}</strong></div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── PROJECT TYPE BADGE ───────────────────────────────────────────
const PROJECT_TYPES = [
  "Business Project",
  "Enterprise Project",
  "Internal Project",
];

const TypeBadge = ({ type }) => {
  const styles = {
    "Business Project":   { bg: "#dbeafe", text: "#1e40af", icon: "🔵" },
    "Enterprise Project": { bg: "#ede9fe", text: "#6d28d9", icon: "🟣" },
    "Internal Project":   { bg: "#dcfce7", text: "#15803d", icon: "🟢" },
  };
  const s = styles[type] || styles["Internal Project"];
  return (
    <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {s.icon} {type}
    </span>
  );
};

// ─── DOCUMENT COMPLIANCE CARD ─────────────────────────────────────
const DocComplianceBar = ({ project }) => {
  const T = useT();
  const allDocs = project.documents ?? [];
  const reqDocs = allDocs.filter(d => d.required);
  const ready   = reqDocs.filter(d => ["Approved","Final","Received","Current","Submitted"].includes(d.status));
  const pct     = reqDocs.length ? Math.round((ready.length / reqDocs.length) * 100) : 0;
  const color   = pct === 100 ? "#16a34a" : pct >= 60 ? "#eab308" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: T.border, borderRadius: 6, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>{pct}%</span>
      <span style={{ fontSize: 11, color: T.muted }}>{ready.length}/{reqDocs.length} required</span>
    </div>
  );
};

const Badge = ({ status, size = "sm" }) => {
  const T = useT();
  const c = statusColor[status] || { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: size === "sm" ? 11 : 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
};

const HealthBadge = ({ status }) => {
  const c = healthColor[status] || healthColor["Amber"];
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{c.label}</span>
  );
};

const RiskBadge = ({ level }) => {
  const c = riskColor[level] || riskColor["Medium"];
  return <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{level}</span>;
};

const Progress = ({ value, color, height = 6 }) => {
  const T = useT();
  return (
    <div style={{ background: T.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: "100%", background: color || T.accent, borderRadius: height, transition: "width 0.3s" }} />
    </div>
  );
};

const KPICard = ({ label, value, sub, color, icon }) => {
  const T = useT();
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
};

const SectionHeader = ({ title, subtitle, action, onAction }) => {
  const T = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>{title}</h2>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 13, color: T.muted }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{action}</button>
      )}
    </div>
  );
};

const Tab = ({ tabs, active, onSelect }) => {
  const T = useT();
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: `2px solid ${T.border}`, marginBottom: 24 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{ background: "none", border: "none", borderBottom: active === t ? `2px solid ${T.primary}` : "2px solid transparent", marginBottom: -2, padding: "10px 16px", fontSize: 13, fontWeight: active === t ? 700 : 500, color: active === t ? T.primary : T.muted, cursor: "pointer", transition: "all 0.15s" }}>{t}</button>
      ))}
    </div>
  );
};

// ─── SIDEBAR ─────────────────────────────────────────────────────
const Sidebar = ({ route, setRoute, projects }) => {
  const { departments } = useDepts();
  const T = useT();
  const navItems = [
    { icon: "🏠", label: "Portfolio Overview", route: "home" },
    { icon: "📁", label: "Departments", route: "departments" },
    { icon: "📋", label: "All Projects", route: "projects" },
    { icon: "⚙️", label: "Admin Panel", route: "admin" },
  ];
  return (
    <div style={{ width: 220, minWidth: 220, background: T.sidebarBg, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: T.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>PMO Portal</div>
            <div style={{ color: T.secondary, fontSize: 10, lineHeight: 1.2 }}>Enterprise Governance</div>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {navItems.map(item => (
          <button key={item.route} onClick={() => setRoute({ view: item.route })} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none",
            background: route.view === item.route ? "rgba(0,255,179,0.12)" : "transparent",
            color: route.view === item.route ? T.accent : T.secondary, cursor: "pointer", fontSize: 13, fontWeight: route.view === item.route ? 600 : 400,
            marginBottom: 2, transition: "all 0.15s", textAlign: "left"
          }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
          </button>
        ))}
        <div style={{ margin: "16px 0 8px", padding: "0 12px", fontSize: 10, color: "rgba(161,185,171,0.5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Departments</div>
        {departments.map(d => {
          const stats = getDeptStats(d.id, projects.filter(p => !p.archived));
          return (
            <button key={d.id} onClick={() => setRoute({ view: "department", deptId: d.id })} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "none",
              background: route.deptId === d.id ? "rgba(0,255,179,0.12)" : "transparent",
              color: route.deptId === d.id ? T.accent : T.secondary, cursor: "pointer", fontSize: 12, fontWeight: 400,
              marginBottom: 1, transition: "all 0.15s", textAlign: "left"
            }}>
              <span style={{ fontSize: 14 }}>{d.icon}</span>
              <span style={{ flex: 1 }}>{d.name}</span>
              <span style={{ background: "rgba(255,255,255,0.1)", color: T.light, fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>{stats.total}</span>
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: `1px solid rgba(255,255,255,0.08)` }}>
        <div style={{ fontSize: 11, color: T.secondary }}>Logged in as</div>
        <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Mohammed</div>
        <div style={{ fontSize: 11, color: T.secondary }}>PMO Director</div>
      </div>
    </div>
  );
};

// ─── HEADER ──────────────────────────────────────────────────────
const Header = ({ title, subtitle, route, setRoute, dark, toggleDark }) => {
  const T = useT();
  return (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {route.view !== "home" && (
          <button onClick={() => setRoute({ view: "home" })} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", color: T.muted }}>← Back</button>
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</h1>
          {subtitle && <p style={{ margin: 0, fontSize: 12, color: T.muted }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.muted }}>May 2025</span>

        {/* ── Dark Mode Toggle ── */}
        <button onClick={toggleDark} title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: dark ? "#0f2a22" : T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 20, padding: "6px 14px",
            cursor: "pointer", transition: "all 0.2s",
            fontSize: 12, fontWeight: 600,
            color: T.text,
          }}>
          <span style={{ fontSize: 15 }}>{dark ? "☀️" : "🌙"}</span>
          <span style={{ color: T.text }}>{dark ? "Light" : "Dark"}</span>
          {/* pill toggle */}
          <div style={{
            width: 32, height: 18, borderRadius: 10,
            background: dark ? T.accent : "#cbd5e1",
            position: "relative", transition: "background 0.3s", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 2,
              left: dark ? 16 : 2,
              width: 14, height: 14, borderRadius: "50%",
              background: dark ? "#061210" : "#fff",
              transition: "left 0.3s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </div>
        </button>

        <div style={{ width: 34, height: 34, background: dark ? T.accent : "#003932", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: dark ? "#061210" : T.accent, fontWeight: 700, fontSize: 14 }}>M</div>
      </div>
    </div>
  );
};

// ─── HOME / PORTFOLIO OVERVIEW ────────────────────────────────────
const HomeView = ({ projects, setRoute }) => {
  const { departments } = useDepts();
  const T = useT();
  const allProjects = projects.filter(p => !p.archived);
  const byStatus = { "On Track": 0, "At Risk": 0, "Delayed": 0, "Completed": 0, "Not Started": 0 };
  allProjects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
  const statusPie = Object.entries(byStatus).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const PIE_COLORS = ["#16a34a", "#eab308", "#dc2626", "#3b82f6", "#9ca3af"];

  const budgetTotal = allProjects.reduce((s, p) => s + p.budget, 0);
  const costTotal = allProjects.reduce((s, p) => s + p.actualCost, 0);

  const deptPerf = departments.map(d => {
    const s = getDeptStats(d.id, allProjects);
    const ipi = calcDeptIPI(d.id, allProjects);
    // shorten name to fit chart
    const short = d.name
      .replace("Strategy & PMO", "Strategy")
      .replace("Operations", "Ops")
      .replace("Performance", "Perf")
      .replace("Finance", "Finance");
    return { name: short, health: s.health, ipi, projects: s.total, icon: d.icon };
  });

  const riskDist = [
    { name: "Low",      value: allProjects.filter(p => p.riskLevel === "Low").length,      fill: "#16a34a" },
    { name: "Medium",   value: allProjects.filter(p => p.riskLevel === "Medium").length,    fill: "#eab308" },
    { name: "High",     value: allProjects.filter(p => p.riskLevel === "High").length,      fill: "#dc2626" },
    { name: "Critical", value: allProjects.filter(p => p.riskLevel === "Critical").length,  fill: "#490300" },
  ].filter(x => x.value);

  // budget per dept for bar chart
  const budgetPerDept = departments.map(d => {
    const s = getDeptStats(d.id, allProjects);
    const short = d.name.replace("Strategy & PMO","Strategy").replace("Operations","Ops").replace("Performance","Perf");
    return { name: short, budget: +(s.totalBudget/1000000).toFixed(1), spent: +(s.actualCost/1000000).toFixed(1) };
  });

  return (
    <div style={{ padding: "32px", maxWidth: 1500 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.text }}> from Helloe World to مثل منت شايف</h1>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>Real-time portfolio overview across all departments · May 2025</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPICard label="Total Projects"    value={allProjects.length}          icon="📋" />
        <KPICard label="On Track"          value={byStatus["On Track"] || 0}   color="#16a34a" icon="✅" />
        <KPICard label="At Risk"           value={byStatus["At Risk"] || 0}    color="#eab308" icon="⚠️" />
        <KPICard label="Delayed"           value={byStatus["Delayed"] || 0}    color="#dc2626" icon="🔴" />
        <KPICard label="Completed"         value={byStatus["Completed"] || 0}  color="#3b82f6" icon="🏁" />
        <KPICard label="Portfolio Budget"  value={fmtSAR(budgetTotal)} sub={`${fmtSAR(costTotal)} spent`} icon="💰" />
      </div>

      {/* ── ROW 1: Department Health (wide) + Budget Summary ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Department Health Score — bigger */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Department Health Score</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>Portfolio progress % across all {departments.length} departments</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptPerf} barSize={32} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={38} />
              <Tooltip formatter={v => [`${v}%`, "Health"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${themeStore.T.border}`, background: themeStore.T.surface, color: themeStore.T.text }} />
              <Bar dataKey="health" radius={[6, 6, 0, 0]} minPointSize={4}>
                {deptPerf.map((entry, i) => (
                  <Cell key={i} fill={entry.health === 0 ? T.border : entry.health >= 70 ? T.accent : entry.health >= 50 ? "#eab308" : "#dc2626"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Summary */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Budget Summary</h3>
          <p style={{ margin: "0 0 20px", fontSize: 12, color: T.muted }}>Portfolio level</p>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {[
              { label: "Total Approved", value: fmtSAR(budgetTotal),              color: T.text },
              { label: "Total Spent",    value: fmtSAR(costTotal),                color: T.text },
              { label: "Remaining",      value: fmtSAR(budgetTotal - costTotal),  color: (budgetTotal - costTotal) >= 0 ? "#16a34a" : "#dc2626" },
              { label: "Utilisation",    value: `${budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0}%`, color: T.primary },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 13, color: T.muted }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.muted }}>Overall Utilisation</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0}%</span>
              </div>
              <Progress value={budgetTotal ? Math.round((costTotal / budgetTotal) * 100) : 0} height={10}
                color={budgetTotal && costTotal / budgetTotal > 0.9 ? "#dc2626" : T.accent} />
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: IPI (wide) + Risk Profile ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 }}>

        {/* Department IPI Scores — bigger, all departments visible */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Department IPI Scores</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>SPI×50% + CPI×25% + Docs×25% — all {departments.length} departments</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptPerf} barSize={32} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: T.muted, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} width={38} />
              <Tooltip formatter={v => [v, "IPI Score"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${themeStore.T.border}`, background: themeStore.T.surface, color: themeStore.T.text }} />
              <Bar dataKey="ipi" radius={[6, 6, 0, 0]}>
                {deptPerf.map((entry, i) => {
                  const c = ipiColor(entry.ipi);
                  return <Cell key={i} fill={c.color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
            {[
              { label: "Excellent 85+", color: "#15803d" },
              { label: "Good 70+",      color: "#003932" },
              { label: "Fair 55+",      color: "#854d0e" },
              { label: "Poor <55",      color: "#991b1b" },
            ].map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span style={{ fontSize: 11, color: T.muted }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Profile */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>Risk Profile</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted }}>By risk level</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={42}>
                {riskDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: themeStore.T.surface, color: themeStore.T.text }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {riskDist.map(r => (
              <div key={r.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.fill }} />
                  <span style={{ fontSize: 12, color: T.text }}>{r.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Cards */}
      <SectionHeader title="Department Portfolio Overview" subtitle="Click a department to view its projects" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {departments.map(d => {
          const stats = getDeptStats(d.id, allProjects);
          return (
            <div key={d.id} onClick={() => setRoute({ view: "department", deptId: d.id })} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,57,50,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 40, height: 40, background: T.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{d.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{stats.total} projects</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.primary }}>{stats.health}%</div>
                  <div style={{ fontSize: 10, color: T.muted }}>health</div>
                </div>
              </div>
              <Progress value={stats.health} color={stats.health > 70 ? T.accent : stats.health > 50 ? "#eab308" : "#dc2626"} height={6} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 16 }}>
                {[
                  { label: "Active", value: stats.active, color: "#16a34a" },
                  { label: "At Risk", value: stats.total - stats.active - stats.delayed - stats.completed, color: "#eab308" },
                  { label: "Delayed", value: stats.delayed, color: "#dc2626" },
                  { label: "Done", value: stats.completed, color: "#3b82f6" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: `1px solid rgba(255,255,255,0.15)` }}>
                <div style={{ fontSize: 12, color: T.muted }}>Budget: <span style={{ fontWeight: 600, color: T.text }}>{fmtSAR(stats.totalBudget)}</span></div>
                <div style={{ fontSize: 12, color: T.muted }}>High Risk: <span style={{ fontWeight: 600, color: stats.highRisk > 0 ? "#dc2626" : T.text }}>{stats.highRisk}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── DEPARTMENT VIEW ──────────────────────────────────────────────
const DepartmentView = ({ projects, deptId, setRoute }) => {
  const { departments } = useDepts();
  const T = useT();
  const dept = departments.find(d => d.id === deptId);
  const deptProjects = projects.filter(p => p.deptId === deptId && !p.archived);
  const stats = getDeptStats(deptId, projects.filter(p => !p.archived));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterRisk, setFilterRisk] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [view, setView] = useState("table");

  const filtered = useMemo(() => deptProjects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || p.status === filterStatus;
    const matchRisk   = filterRisk   === "All" || p.riskLevel === filterRisk;
    const matchType   = filterType   === "All" || p.projectType === filterType;
    return matchSearch && matchStatus && matchRisk && matchType;
  }), [deptProjects, search, filterStatus, filterRisk, filterType]);

  if (!dept) return <div style={{ padding: 32 }}>Department not found</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, background: T.primary, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{dept.icon}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.text }}>{dept.name}</h1>
          <p style={{ margin: 0, color: T.muted, fontSize: 13 }}>Department Project Portfolio · {deptProjects.length} projects</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPICard label="Total Projects" value={stats.total} icon="📋" />
        <KPICard label="On Track" value={stats.active} color="#16a34a" icon="✅" />
        <KPICard label="Delayed" value={stats.delayed} color="#dc2626" icon="🔴" />
        <KPICard label="Completed" value={stats.completed} color="#3b82f6" icon="🏁" />
        <KPICard label="Portfolio Health" value={`${stats.health}%`} color={T.primary} icon="💪" />
        {(() => { const di = calcDeptIPI(deptId, projects); const c = ipiColor(di); return <KPICard label="Dept IPI" value={di} color={c.color} icon="📊" sub={c.label} />; })()}
      </div>

      {/* Filters */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or code..." style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1, minWidth: 180, background: T.inputBg, color: T.inputText }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          {["All", "On Track", "At Risk", "Delayed", "Completed", "Not Started"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          {["All", "Low", "Medium", "High", "Critical"].map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          <option value="All">All Types</option>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div style={{ display: "flex", gap: 4 }}>
          {["table", "card"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? T.btnPrimBg : "transparent",
              color: view === v ? T.btnPrimText : T.muted,
              border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer"
            }}>
              {v === "table" ? "≡ Table" : "⊞ Cards"}
            </button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {["Code", "Project Name", "PM", "Type", "Phase", "Progress", "Status", "IPI", "Risk", "Budget Status", "Gate", "Last Update"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id })} style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", background: i % 2 === 0 ? "transparent" : T.bg, transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = themeStore.dark ? '#132820' : '#f0f7f4'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : themeStore.T.bg}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.primary, whiteSpace: "nowrap" }}>{p.code}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: themeStore.T.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{p.sponsor}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, whiteSpace: "nowrap" }}>{p.phase}</td>
                  <td style={{ padding: "12px 14px", minWidth: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={5} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.text, minWidth: 30 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}>
                    {(() => { const sc = ipiColor(calcProjectIPI(p)); return <span style={{ background: sc.bg, color: sc.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{calcProjectIPI(p)}</span>; })()}
                  </td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{p.budgetStatus}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px", fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{p.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 32, textAlign: "center", color: T.muted }}>No projects match the filters</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id })} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,57,50,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.primary, background: "#e8f5f0", padding: "3px 8px", borderRadius: 6 }}>{p.code}</span>
                <Badge status={p.status} />
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text }}>{p.name}</h3>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: T.muted }}>PM: {p.pm} · {p.phase}</p>
              <Progress value={p.progress} height={6} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <RiskBadge level={p.riskLevel} />
                <span style={{ fontSize: 11, color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600, padding: "2px 8px", background: p.budgetStatus === "Over Budget" ? "#fee2e2" : "#dcfce7", borderRadius: 10 }}>{p.budgetStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PROJECT DASHBOARD ────────────────────────────────────────────
const ProjectView = ({ projects, projectId, setRoute, updateProject }) => {
  const { departments } = useDepts();
  const T = useT();
  const project = projects.find(p => p.id === projectId);
  const [tab, setTab] = useState("Overview");
  const TABS = ["Overview", "Health", "Milestones", "Budget", "Risks & Issues", "Approvals", "Benefits", "Documents", "Updates"];

  if (!project) return <div style={{ padding: 32 }}>Project not found</div>;

  const budgetUtil = Math.round((project.actualCost / project.budget) * 100);
  const remaining = project.budget - project.actualCost;
  const healthItems = Object.entries(project.health);

  // ── IPI ──────────────────────────────────────────────────────────
  const ipi = calcProjectIPI(project);
  const ipiC = ipiColor(ipi);
  const docsTotal = project.documents?.length || 0;
  const docsReady = project.documents?.filter(d =>
    ["Approved","Final","Received","Current","Submitted"].includes(d.status)
  ).length || 0;
  const docsCompliance = docsTotal > 0 ? Math.round((docsReady / docsTotal) * 100) : 0;

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      {/* Project Header */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: "24px 28px", marginBottom: 24, color: T.headerText }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span style={{ background: T.accent, color: T.accentText, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{project.code}</span>
              <span style={{ background: "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{project.gate}</span>
              <span style={{ background: "rgba(255,255,255,0.15)", color: T.headerText, fontSize: 11, padding: "3px 10px", borderRadius: 20 }}>{project.priority}</span>
              <TypeBadge type={project.projectType || "Project"} />
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900 }}>{project.name}</h1>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>{project.objective}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <Badge status={project.status} />
            <div style={{ marginTop: 12, fontSize: 32, fontWeight: 900, color: T.accent }}>{project.progress}%</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Overall Progress</div>
          </div>
        </div>
        {/* IPI banner row */}
        <div style={{ display: "flex", gap: 10, marginTop: 16, padding: "14px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ background: ipiC.bg, borderRadius: 10, padding: "8px 18px", textAlign: "center", minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: ipiC.color, lineHeight: 1 }}>{ipi}</div>
              <div style={{ fontSize: 10, color: ipiC.color, fontWeight: 700 }}>IPI Score</div>
            </div>
            <div style={{ fontSize: 11, color: T.headerText, lineHeight: 1.8, opacity: 0.85 }}>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>SPI</span> {project.spi?.toFixed(2)} × 50% = <strong style={{ color: T.accent }}>{((Math.min(project.spi ?? 1, 1.2)) * 0.5 * 100).toFixed(0)}pts</strong></div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>CPI</span> {project.cpi?.toFixed(2)} × 25% = <strong style={{ color: T.accent }}>{((Math.min(project.cpi ?? 1, 1.2)) * 0.25 * 100).toFixed(0)}pts</strong></div>
              <div><span style={{ color: T.accent, fontWeight: 700 }}>Docs</span> {docsCompliance}% × 25% = <strong style={{ color: T.accent }}>{(docsCompliance * 0.25).toFixed(0)}pts</strong></div>
            </div>
          </div>
          <div style={{ background: ipiC.bg, color: ipiC.color, padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{ipiC.label}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "PM", value: project.pm },
            { label: "Sponsor", value: project.sponsor },
            { label: "Department", value: departments.find(d => d.id === project.deptId)?.name },
            { label: "Phase", value: project.phase },
            { label: "Start Date", value: project.startDate },
            { label: "Planned End", value: project.plannedEnd },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <Tab tabs={TABS} active={tab} onSelect={setTab} />

      {/* ── GATE TRACKER — always visible ── */}
      <GateTracker gates={project.gates} />

      {/* OVERVIEW TAB */}
      {tab === "Overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Project Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  ["Strategic Objective", project.strategic],
                  ["Classification", project.classification],
                  ["Current Phase", project.phase],
                  ["Gate Status", project.gate],
                  ["Risk Level", project.riskLevel],
                  ["Budget Status", project.budgetStatus],
                  ["Schedule Variance", project.scheduleVariance],
                  ["Days Remaining", project.daysRemaining === 0 ? "Completed" : project.daysRemaining],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: "10px 14px", background: T.bg, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Business Case</h3>
              <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{project.businessCase}</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Progress Tracker</h3>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Overall Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{project.progress}%</span>
                </div>
                <Progress value={project.progress} color={T.accent} height={10} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Planned Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{project.plannedProgress}%</span>
                </div>
                <Progress value={project.plannedProgress} color="#94a3b8" height={10} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                <div style={{ textAlign: "center", padding: 12, background: T.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.primary }}>{project.spi.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>SPI</div>
                </div>
                <div style={{ textAlign: "center", padding: 12, background: T.bg, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: T.primary }}>{project.cpi.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>CPI</div>
                </div>
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Budget Snapshot</h3>
              {[
                { label: "Approved Budget", value: fmtSAR(project.budget), color: T.text },
                { label: "Actual Cost", value: fmtSAR(project.actualCost), color: T.text },
                { label: "Remaining", value: fmtSAR(remaining), color: remaining >= 0 ? "#16a34a" : "#dc2626" },
                { label: "Utilisation", value: `${budgetUtil}%`, color: budgetUtil > 90 ? "#dc2626" : T.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEALTH TAB */}
      {tab === "Health" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {healthItems.map(([area, status]) => (
              <div key={area} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, textTransform: "capitalize" }}>{area}</div>
                <HealthBadge status={status} />
                <div style={{ marginTop: 12, width: 50, height: 50, borderRadius: "50%", background: healthColor[status]?.bg || T.bg, border: `3px solid ${healthColor[status]?.text || T.muted}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "12px auto 0", fontSize: 20 }}>
                  {status === "Green" ? "✅" : status === "Amber" ? "⚠️" : "🔴"}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Performance Indicators</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                { label: "Schedule Performance Index (SPI)", value: project.spi, threshold: 0.9, format: (v) => v.toFixed(2) },
                { label: "Cost Performance Index (CPI)", value: project.cpi, threshold: 0.9, format: (v) => v.toFixed(2) },
                { label: "Budget Utilisation", value: budgetUtil, threshold: 90, format: (v) => `${v}%` },
              ].map(({ label, value, threshold, format }) => (
                <div key={label} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12 }}>
                  <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: value >= threshold ? T.primary : "#dc2626" }}>{format(value)}</div>
                  <div style={{ fontSize: 11, color: value >= threshold ? "#16a34a" : "#dc2626", marginTop: 4 }}>
                    {value >= threshold ? "✓ Healthy" : "⚠ Below threshold"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MILESTONES TAB */}
      {tab === "Milestones" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Milestone Timeline</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {project.milestones.map((m, i) => {
              const statusStyles = {
                "Completed": { bg: "#dcfce7", text: "#15803d", icon: "✓", lineColor: "#16a34a" },
                "In Progress": { bg: "#fef9c3", text: "#854d0e", icon: "◎", lineColor: "#eab308" },
                "Upcoming": { bg: "#f3f4f6", text: "#6b7280", icon: "○", lineColor: "#d1d5db" },
                "Delayed": { bg: "#fee2e2", text: "#991b1b", icon: "!", lineColor: "#dc2626" },
              };
              const s = statusStyles[m.status] || statusStyles["Upcoming"];
              return (
                <div key={m.id} style={{ display: "flex", gap: 16, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.bg, border: `2px solid ${s.lineColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: s.text, fontWeight: 700, zIndex: 1 }}>{s.icon}</div>
                    {i < project.milestones.length - 1 && <div style={{ width: 2, flex: 1, background: s.lineColor, opacity: 0.3, minHeight: 20 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 20 }}>
                    <div style={{ background: T.bg, borderRadius: 12, padding: "14px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.name}</span>
                        <span style={{ background: s.bg, color: s.text, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{m.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.muted }}>Target: {m.date} · Owner: {m.owner}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BUDGET TAB */}
      {tab === "Budget" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Financial Summary</h3>
            {[
              { label: "Approved Budget", value: fmtSAR(project.budget), sub: "Total approved allocation" },
              { label: "Forecast Budget", value: fmtSAR(project.forecast), sub: "Estimated total at completion", color: project.forecast > project.budget ? "#dc2626" : "#16a34a" },
              { label: "Actual Cost to Date", value: fmtSAR(project.actualCost), sub: `${budgetUtil}% of budget consumed` },
              { label: "Remaining Budget", value: fmtSAR(remaining), sub: "Available to spend", color: remaining < 0 ? "#dc2626" : "#16a34a" },
              { label: "Cost Variance", value: fmtSAR(project.budget - project.actualCost), sub: "Positive = under budget", color: project.budget >= project.actualCost ? "#16a34a" : "#dc2626" },
              { label: "Cost Performance Index", value: project.cpi.toFixed(2), sub: "> 1.0 = under budget", color: project.cpi >= 1 ? "#16a34a" : "#dc2626" },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: color || T.text }}>{value}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Budget Utilisation</h3>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>Actual Spend</span>
                  <span style={{ fontWeight: 700 }}>{budgetUtil}%</span>
                </div>
                <Progress value={budgetUtil} color={budgetUtil > 90 ? "#dc2626" : budgetUtil > 75 ? "#eab308" : T.accent} height={14} />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[{ name: "Budget", Approved: project.budget / 1000000, Forecast: project.forecast / 1000000, Actual: project.actualCost / 1000000 }]} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="M" />
                  <Tooltip formatter={(v) => `SAR ${v.toFixed(2)}M`} />
                  <Bar dataKey="Approved" fill={T.secondary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Forecast" fill={T.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" fill={T.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* RISKS & ISSUES TAB */}
      {tab === "Risks & Issues" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Risk Register</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "Critical").length} Critical</span>
                <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.risks.filter(r => r.level === "High").length} High</span>
              </div>
            </div>
            {project.risks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: T.muted }}>No risks recorded</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Risk", "Probability", "Impact", "Level", "Owner", "Status", "Due Date"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{project.risks.map(r => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px", fontSize: 12 }}>
                      <div style={{ fontWeight: 600, color: T.text }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>Mitigation: {r.mitigation}</div>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.probability}</td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.impact}</td>
                    <td style={{ padding: "12px" }}><RiskBadge level={r.level} /></td>
                    <td style={{ padding: "12px", fontSize: 12 }}>{r.owner}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: r.status === "Open" ? "#dc2626" : r.status === "Mitigated" ? "#16a34a" : "#eab308" }}>{r.status}</span>
                    </td>
                    <td style={{ padding: "12px", fontSize: 12, color: T.muted }}>{r.dueDate}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Issue Log</h3>
              <span style={{ background: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{project.issues.filter(i => i.escalated).length} Escalated</span>
            </div>
            {project.issues.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#16a34a", fontSize: 13 }}>✓ No open issues</div>
            ) : (
              project.issues.map(issue => (
                <div key={issue.id} style={{ padding: "14px 16px", background: T.bg, borderRadius: 10, marginBottom: 10, borderLeft: `4px solid ${issue.escalated ? "#dc2626" : issue.severity === "High" ? "#eab308" : T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{issue.title}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {issue.escalated && <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>ESCALATED</span>}
                      <RiskBadge level={issue.severity} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>Owner: {issue.owner} · Raised: {issue.raised} · Status: <span style={{ fontWeight: 600 }}>{issue.status}</span></div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* APPROVALS TAB */}
      {tab === "Approvals" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Approved", count: project.approvals.filter(a => a.status === "Approved").length, color: "#16a34a" },
              { label: "Pending", count: project.approvals.filter(a => a.status === "Pending").length, color: "#eab308" },
              { label: "Returned", count: project.approvals.filter(a => a.status === "Returned").length, color: "#dc2626" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ padding: "12px 20px", background: T.bg, borderRadius: 10, textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {project.approvals.map(a => {
              const c = { "Approved": { color: "#16a34a", bg: "#dcfce7" }, "Pending": { color: "#eab308", bg: "#fef9c3" }, "Returned": { color: "#dc2626", bg: "#fee2e2" }, "Rejected": { color: "#991b1b", bg: "#fee2e2" } };
              const style = c[a.status] || c["Pending"];
              return (
                <div key={a.id} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderLeft: `4px solid ${style.color}` }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{a.gate} · Approval Owner: {a.owner}</div>
                    {a.comments && <div style={{ fontSize: 12, color: T.muted, marginTop: 4, fontStyle: "italic" }}>"{a.comments}"</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: style.bg, color: style.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 }}>{a.status}</span>
                    {a.date && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{a.date}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BENEFITS TAB */}
      {tab === "Benefits" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Benefits Realization Tracker</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {project.benefits.map(b => (
              <div key={b.id} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginRight: 8 }}>{b.category}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{b.kpi}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.muted }}>Owner: {b.owner}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                  {[["Baseline", b.baseline], ["Target", b.target], ["Current", b.current]].map(([label, val]) => (
                    <div key={label} style={{ textAlign: "center", padding: "10px", background: T.surface, borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}><Progress value={b.realization} color={T.accent} height={8} /></div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.primary, minWidth: 40 }}>{b.realization}%</span>
                  <span style={{ fontSize: 11, color: T.muted }}>realized</span>
                  <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 600, padding: "2px 8px", borderRadius: 6 }}>{b.contribution} impact</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {tab === "Documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Compliance Summary */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Document Compliance</h3>
              <span style={{ fontSize: 12, color: T.muted }}>Required docs affect IPI score</span>
            </div>
            <DocComplianceBar project={project} />
          </div>

          {/* Required Documents */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>⭐</span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Required Documents</h3>
              <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Affects IPI</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>
                {["Document", "Type", "Version", "Status", "Last Updated"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{project.documents.filter(d => d.required).map(d => {
                const docStatus = {
                  "Approved":    { bg: "#dcfce7", text: "#15803d" },
                  "Final":       { bg: "#dcfce7", text: "#15803d" },
                  "Received":    { bg: "#dcfce7", text: "#15803d" },
                  "Current":     { bg: "#dbeafe", text: "#1e40af" },
                  "Submitted":   { bg: "#dbeafe", text: "#1e40af" },
                  "Draft":       { bg: "#fef9c3", text: "#854d0e" },
                  "Under Review":{ bg: "#fef9c3", text: "#854d0e" },
                  "Pending":     { bg: "#fee2e2", text: "#991b1b" },
                };
                const ds = docStatus[d.status] || { bg: T.bg, text: T.muted };
                const isReady = ["Approved","Final","Received","Current","Submitted"].includes(d.status);
                return (
                  <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{isReady ? "✅" : "⚠️"}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.type}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.text }}>{d.version || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: ds.bg, color: ds.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{d.status || "Not Submitted"}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.lastUpdated || "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>

          {/* Optional / Additional Documents */}
          {project.documents.filter(d => !d.required).length > 0 && (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 16 }}>📎</span>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.text }}>Additional Documents</h3>
                <span style={{ fontSize: 11, background: T.bg, color: T.muted, fontWeight: 600, padding: "2px 8px", borderRadius: 10 }}>Does not affect IPI</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Document", "Type", "Version", "Status", "Last Updated"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{project.documents.filter(d => !d.required).map(d => {
                  const ds = { "Approved": { bg: "#dcfce7", text: "#15803d" }, "Current": { bg: "#dbeafe", text: "#1e40af" }, "Draft": { bg: "#fef9c3", text: "#854d0e" } }[d.status] || { bg: T.bg, text: T.muted };
                  return (
                    <tr key={d.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📄</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.type}</td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.text }}>{d.version || "—"}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: ds.bg, color: ds.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>{d.status}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{d.lastUpdated || "—"}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* UPDATES TAB */}
      {tab === "Updates" && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Project Updates & Activity Feed</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {project.updates.map(u => (
              <div key={u.id} style={{ padding: "16px 20px", background: T.bg, borderRadius: 12, borderLeft: `4px solid ${T.accent}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, background: T.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: T.accent, fontWeight: 700, fontSize: 12 }}>
                      {u.owner.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{u.owner}</div>
                      <div style={{ fontSize: 11, color: T.muted }}>Project Update</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: T.muted }}>{u.date}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6 }}>{u.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── DEPARTMENT CRUD COMPONENT ────────────────────────────────────
const ICON_OPTIONS = ["⚡","💻","⚙️","🛡️","👥","🖥️","💰","✅","📈","🏗️","📊","🔬","📣","🤝","🌐","🔒","📦","🧪","🏆","💡"];

const DeptCRUD = ({ projects }) => {
  const { departments, addDept, updateDept, deleteDept } = useDepts();
  const T = useT();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", id: "", icon: "⚡", color: "#003932" });
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", id: "", icon: "⚡", color: "#003932" });
    setShowForm(true);
  };

  const openEdit = (d) => {
    setEditing(d.id);
    setForm({ name: d.name, id: d.id, icon: d.icon, color: d.color });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast("Department name is required", "error"); return; }
    if (!editing && !form.id.trim()) { showToast("Department ID is required", "error"); return; }
    if (!editing && departments.find(d => d.id === form.id.trim().toLowerCase())) {
      showToast("Department ID already exists", "error"); return;
    }
    if (editing) {
      updateDept(editing, { name: form.name, icon: form.icon, color: form.color });
      showToast("Department updated ✓");
    } else {
      addDept({ id: form.id.trim().toLowerCase().replace(/\s+/g, "-"), name: form.name, icon: form.icon, color: form.color });
      showToast("Department added ✓");
    }
    setShowForm(false);
  };

  const handleDelete = (id) => {
    const hasProjects = projects.filter(p => p.deptId === id).length > 0;
    if (hasProjects) { showToast("Cannot delete — department has projects. Archive projects first.", "error"); return; }
    deleteDept(id);
    setConfirmDelete(null);
    showToast("Department deleted ✓");
  };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "error" ? "#dc2626" : T.primary, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 400, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Delete Department?</h3>
            <p style={{ margin: "0 0 24px", color: T.muted, fontSize: 13 }}>
              This will permanently remove <strong>{departments.find(d => d.id === confirmDelete)?.name}</strong>. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing ? "Edit Department" : "Add New Department"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.muted }}>×</button>
            </div>

            {/* Preview */}
            <div style={{ background: T.headerBg, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{form.icon}</span>
              <div>
                <div style={{ color: T.headerText, fontWeight: 700, fontSize: 15 }}>{form.name || "Department Name"}</div>
                <div style={{ color: T.headerText, fontSize: 11, opacity: 0.7 }}>ID: {form.id || "dept-id"}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Department Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Strategy & PMO"
                  style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>

              {!editing && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Department ID * <span style={{ fontWeight: 400 }}>(unique, no spaces)</span></label>
                  <input value={form.id} onChange={e => setForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="e.g. strategy"
                    style={{ width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 8 }}>Icon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ICON_OPTIONS.map(ic => (
                    <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                      style={{ width: 38, height: 38, fontSize: 20, border: `2px solid ${form.icon === ic ? T.primary : T.border}`, borderRadius: 8, background: form.icon === ic ? T.badgeBg : T.surface, cursor: "pointer" }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 4 }}>Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    style={{ width: 44, height: 36, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 12, color: T.muted }}>{form.color}</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {editing ? "Save Changes" : "Add Department"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: T.muted }}>{departments.length} departments in system</div>
        <button onClick={openAdd} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Department</button>
      </div>

      {/* Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: T.bg }}>
            {["Icon", "Department Name", "ID", "Total Projects", "On Track", "Delayed", "Completed", "Health", "IPI", "Actions"].map(h => (
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{departments.map((d, i) => {
            const s = getDeptStats(d.id, projects);
            const dIPI = calcDeptIPI(d.id, projects);
            const ipiC = ipiColor(dIPI);
            const hasProjects = s.total > 0;
            return (
              <tr key={d.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.bg }}>
                <td style={{ padding: "12px 14px", fontSize: 22 }}>{d.icon}</td>
                <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 700 }}>{d.name}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, background: "#e8f5f0", color: T.primary, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{d.id}</span>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 15, fontWeight: 800 }}>{s.total}</td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#16a34a", fontWeight: 700 }}>{s.active}</span></td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#dc2626", fontWeight: 700 }}>{s.delayed}</span></td>
                <td style={{ padding: "12px 14px" }}><span style={{ color: "#3b82f6", fontWeight: 700 }}>{s.completed}</span></td>
                <td style={{ padding: "12px 14px", minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1 }}><Progress value={s.health} height={5} color={s.health > 70 ? T.accent : s.health > 50 ? "#eab308" : "#dc2626"} /></div>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{s.health}%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: ipiC.bg, color: ipiC.color, fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{dIPI}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(d)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: T.text }}>Edit</button>
                    <button onClick={() => setConfirmDelete(d.id)} disabled={hasProjects}
                      title={hasProjects ? "Archive all projects first" : "Delete department"}
                      style={{ background: hasProjects ? "#f3f4f6" : "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: hasProjects ? "not-allowed" : "pointer", color: hasProjects ? "#9ca3af" : "#dc2626", fontWeight: 600 }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ADMIN PANEL ──────────────────────────────────────────────────
const AdminView = ({ projects, setRoute, addProject, updateProject, archiveProject, restoreProject, deleteForever }) => {
  const { departments } = useDepts();
  const T = useT();
  const activeProjects  = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p =>  p.archived);
  const [adminTab, setAdminTab] = useState("Projects");
  const [editingProject, setEditingProject] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => {
    setEditingProject(null);
    setFormData({ name: "", code: "", deptId: "strategy", pm: "", sponsor: "", phase: "Initiation", gate: "Gate 1", status: "Not Started", priority: "Medium", progress: 0, riskLevel: "Low", budgetStatus: "On Budget", budget: 0, startDate: "", plannedEnd: "", objective: "", strategic: "" });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingProject(p.id);
    setFormData({ ...p });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.code) { showToast("Project name and code are required", "error"); return; }
    if (editingProject) {
      updateProject(editingProject, formData);
      showToast("Project updated successfully");
    } else {
      addProject(formData);
      showToast("Project added successfully");
    }
    setShowForm(false);
  };

  const handleDelete = (id) => {
    archiveProject(id);
    showToast("Project archived");
  };

  const Field = ({ label, field, type = "text", options }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>{label}</label>
      {options ? (
        <select value={formData[field] || ""} onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none" }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={formData[field] || ""} onChange={e => setFormData(prev => ({ ...prev, [field]: type === "number" ? Number(e.target.value) : e.target.value }))}
          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, background: toast.type === "error" ? "#dc2626" : T.primary, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.type === "error" ? "⚠ " : "✓ "}{toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.text }}>Admin Panel</h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>Data Management & System Administration</p>
        </div>
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600 }}>🔒 Admin Access</div>
      </div>

      <Tab tabs={["Projects", "Archived", "Departments"]} active={adminTab} onSelect={setAdminTab} />

      {adminTab === "Projects" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: T.muted }}>{activeProjects.length} active projects · <span style={{ color: T.danger }}>{archivedProjects.length} archived</span></div>
            <button onClick={openAdd} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Project</button>
          </div>

          {showForm && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: T.surface, borderRadius: 16, padding: 32, width: 640, maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editingProject ? "Edit Project" : "Add New Project"}</h2>
                  <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T.muted }}>×</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Field label="Project Name *" field="name" />
                  <Field label="Project Code *" field="code" />
                  <Field label="Department" field="deptId" options={departments.map(d => d.id)} />
                  <Field label="Project Manager" field="pm" />
                  <Field label="Sponsor" field="sponsor" />
                  <Field label="Phase" field="phase" options={["Initiation", "Planning", "Execution", "Monitoring", "Closure"]} />
                  <Field label="Gate" field="gate" options={["Gate 1", "Gate 2", "Gate 3", "Gate 4", "Gate 5"]} />
                  <Field label="Status" field="status" options={["Not Started", "On Track", "At Risk", "Delayed", "Completed"]} />
                  <Field label="Priority" field="priority" options={["Low", "Medium", "High", "Critical"]} />
                  <Field label="Risk Level" field="riskLevel" options={["Low", "Medium", "High", "Critical"]} />
                  <Field label="Budget (SAR)" field="budget" type="number" />
                  <Field label="Progress %" field="progress" type="number" />
                  <Field label="Start Date" field="startDate" type="date" />
                  <Field label="Planned End Date" field="plannedEnd" type="date" />
                  <Field label="Budget Status" field="budgetStatus" options={["On Budget", "Over Budget", "Under Budget"]} />
                  <Field label="Strategic Objective" field="strategic" />
                  <Field label="Project Type" field="projectType" options={PROJECT_TYPES} />
                </div>
                {/* Optional Documents Selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.muted, display: "block", marginBottom: 6 }}>
                    Additional Required Documents <span style={{ fontWeight: 400 }}>(Project Charter, Business Case & Closure always required)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {OPTIONAL_DOCS.map(doc => {
                      const selected = (formData.requiredDocs || []).includes(doc);
                      return (
                        <button key={doc} type="button"
                          onClick={() => {
                            const current = formData.requiredDocs || [];
                            setFormData(p => ({
                              ...p,
                              requiredDocs: selected ? current.filter(d => d !== doc) : [...current, doc]
                            }));
                          }}
                          style={{
                            padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            background: selected ? T.btnPrimBg : T.surface,
                            color: selected ? T.btnPrimText : T.text,
                            border: `1px solid ${selected ? T.accent : T.border}`,
                            transition: "all 0.15s",
                          }}>
                          {selected ? "✓ " : ""}{doc}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4 }}>Project Objective</label>
                  <textarea value={formData.objective || ""} onChange={e => setFormData(prev => ({ ...prev, objective: e.target.value }))}
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", minHeight: 70, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  <button onClick={handleSave} style={{ background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save Project</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: T.bg }}>
                {["ID", "Code", "Project Name", "Department", "PM", "Status", "Progress", "Gate", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{activeProjects.map(p => (
                <tr key={p.id} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 700, color: T.muted }}>{p.id}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.primary }}>{p.code}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{departments.find(d => d.id === p.deptId)?.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px", minWidth: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={4} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.gate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: T.text }}>Edit</button>
                      <button onClick={() => setRoute({ view: "project", projectId: p.id })} style={{ background: "#e8f5f0", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: T.primary, fontWeight: 600 }}>View</button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 600 }}>Archive</button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {adminTab === "Archived" && (
        <div>
          {/* Banner */}
          <div style={{ background: "#1a0800", border: `1px solid #7c2d12`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>🗄️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#fed7aa", fontSize: 14 }}>Archived Projects — {archivedProjects.length} projects</div>
              <div style={{ fontSize: 12, color: "#9a5c38" }}>Archived projects are hidden from all dashboards and reports. You can restore them anytime or delete permanently.</div>
            </div>
          </div>

          {archivedProjects.length === 0 ? (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>No Archived Projects</div>
              <div style={{ fontSize: 13, color: T.muted }}>When you archive a project it will appear here</div>
            </div>
          ) : (
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: T.bg }}>
                  {["Code", "Project Name", "Department", "PM", "Status", "Archived Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{archivedProjects.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.bg, opacity: 0.85 }}>
                    <td style={{ padding: "12px 14px", fontSize: 12, fontWeight: 600, color: T.muted }}>{p.code}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, opacity: 0.7 }}>{p.id}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{departments.find(d => d.id === p.deptId)?.name}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                    <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.archivedDate || "—"}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Restore */}
                        <button onClick={() => { restoreProject(p.id); showToast(`"${p.name}" restored successfully`); }}
                          style={{ background: "#dcfce7", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "#15803d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          ↩ Restore
                        </button>
                        {/* Delete Forever */}
                        <button onClick={() => { if (window.confirm(`Delete "${p.name}" permanently? This cannot be undone.`)) { deleteForever(p.id); showToast(`"${p.name}" deleted permanently`, "error"); }}}
                          style={{ background: "#fee2e2", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, cursor: "pointer", color: "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          🗑 Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adminTab === "Departments" && (
        <DeptCRUD projects={activeProjects} />
      )}

    </div>
  );
};

// ─── DEPARTMENTS OVERVIEW PAGE ───────────────────────────────────
const DepartmentsOverview = ({ projects, setRoute }) => {
  const { departments } = useDepts();
  const T = useT();
  const [sort, setSort] = useState("ipi-desc");
  const activeProjects = projects.filter(p => !p.archived);

  const deptData = useMemo(() => departments.map(d => {
    const dp = activeProjects.filter(p => p.deptId === d.id);
    const stats = getDeptStats(d.id, activeProjects);
    const deptIPI = calcDeptIPI(d.id, activeProjects);
    const ipiC = ipiColor(deptIPI);

    // avg SPI / CPI across dept projects
    const avgSPI = dp.length ? (dp.reduce((s, p) => s + (p.spi ?? 1), 0) / dp.length) : 1;
    const avgCPI = dp.length ? (dp.reduce((s, p) => s + (p.cpi ?? 1), 0) / dp.length) : 1;

    // docs compliance across all dept docs
    const allDocs = dp.flatMap(p => p.documents ?? []);
    const readyDocs = allDocs.filter(doc => ["Approved","Final","Received","Current","Submitted"].includes(doc.status));
    const docsCompliance = allDocs.length ? Math.round((readyDocs.length / allDocs.length) * 100) : 0;

    const openRisks = dp.flatMap(p => p.risks ?? []).filter(r => r.status === "Open").length;
    const openIssues = dp.flatMap(p => p.issues ?? []).filter(i => i.status !== "Closed").length;
    const escalated = dp.flatMap(p => p.issues ?? []).filter(i => i.escalated).length;

    return { ...d, dp, stats, deptIPI, ipiC, avgSPI, avgCPI, docsCompliance, openRisks, openIssues, escalated };
  }), [activeProjects, departments]);

  const sorted = useMemo(() => {
    const arr = [...deptData];
    if (sort === "ipi-desc") arr.sort((a, b) => b.deptIPI - a.deptIPI);
    if (sort === "ipi-asc")  arr.sort((a, b) => a.deptIPI - b.deptIPI);
    if (sort === "projects")  arr.sort((a, b) => b.stats.total - a.stats.total);
    if (sort === "name")      arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [deptData, sort]);

  // portfolio-level IPI = avg of dept IPIs
  const portfolioIPI = deptData.length
    ? Math.round(deptData.reduce((s, d) => s + d.deptIPI, 0) / deptData.length)
    : 0;
  const portfolioIpiC = ipiColor(portfolioIPI);

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: T.text }}>Departments Overview</h1>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>IPI-driven comparison across all {departments.length} departments · {projects.length} total projects</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.muted }}>Sort by:</span>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, outline: "none", background: T.surface }}>
            <option value="ipi-desc">IPI ↓ High first</option>
            <option value="ipi-asc">IPI ↑ Low first</option>
            <option value="projects">Most projects</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Portfolio IPI banner */}
      <div style={{ background: T.headerBg, borderRadius: 16, padding: "20px 28px", marginBottom: 28, display: "flex", alignItems: "center", gap: 24, color: T.headerText }}>
        <div style={{ background: portfolioIpiC.bg, borderRadius: 14, padding: "14px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: portfolioIpiC.color, lineHeight: 1 }}>{portfolioIPI}</div>
          <div style={{ fontSize: 11, color: portfolioIpiC.color, fontWeight: 700, marginTop: 2 }}>Portfolio IPI</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.headerText, marginBottom: 4 }}>Enterprise Portfolio Performance Index</div>
          <div style={{ fontSize: 12, color: T.headerText, opacity: 0.7, marginBottom: 12 }}>
            Weighted average of all department IPIs — Formula: SPI×50% + CPI×25% + Docs Compliance×25%
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Excellent (85–100)", color: "#15803d" },
              { label: "Good (70–84)",       color: "#0891b2" },
              { label: "Fair (55–69)",       color: "#854d0e" },
              { label: "Poor (<55)",         color: "#991b1b" },
            ].map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: b.color }} />
                <span style={{ fontSize: 11, color: T.muted }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* mini bar chart of dept IPIs — wider to show all */}
        <div style={{ width: 280 }}>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={deptData.map(d => ({
              name: d.name.replace("Strategy & PMO","Strategy").replace("Operations","Ops").replace("Performance","Perf").split(" ")[0],
              ipi: d.deptIPI
            }))} barSize={20} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: T.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} hide />
              <Tooltip formatter={v => [`IPI: ${v}`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8, background: themeStore.T.surface, border: `1px solid ${themeStore.T.border}`, color: themeStore.T.text }} />
              <Bar dataKey="ipi" radius={[3, 3, 0, 0]}>
                {deptData.map((d, i) => (
                  <Cell key={i} fill={ipiColor(d.deptIPI).color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        {sorted.map((d, rank) => (
          <div key={d.id}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", transition: "all 0.2s", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,57,50,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>

            {/* Card header */}
            <div style={{ background: T.headerBg, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{d.icon}</span>
                <div>
                  <div style={{ color: T.headerText, fontWeight: 800, fontSize: 14 }}>{d.name}</div>
                  <div style={{ color: T.headerText, fontSize: 11, opacity: 0.7 }}>{d.stats.total} projects</div>
                </div>
              </div>
              {/* IPI score */}
              <div style={{ background: d.ipiC.bg, borderRadius: 12, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: d.ipiC.color, lineHeight: 1 }}>{d.deptIPI}</div>
                <div style={{ fontSize: 9, color: d.ipiC.color, fontWeight: 700 }}>IPI</div>
              </div>
            </div>

            {/* IPI breakdown */}
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "SPI ×50%", value: d.avgSPI.toFixed(2), pts: Math.min(d.avgSPI, 1.2) * 50, color: d.avgSPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "CPI ×25%", value: d.avgCPI.toFixed(2), pts: Math.min(d.avgCPI, 1.2) * 25, color: d.avgCPI >= 0.9 ? "#16a34a" : "#dc2626" },
                { label: "Docs ×25%", value: `${d.docsCompliance}%`, pts: d.docsCompliance * 0.25, color: d.docsCompliance >= 80 ? "#16a34a" : "#dc2626" },
              ].map(({ label, value, pts, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "8px 4px", background: T.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: T.muted, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted }}>{pts.toFixed(0)}pts</div>
                </div>
              ))}
            </div>

            {/* Project status breakdown */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>Project Status</span>
                <span style={{ fontSize: 11, color: T.muted }}>{d.stats.total} total</span>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {d.stats.total > 0 && [
                  { count: d.stats.active, color: "#16a34a", label: "On Track" },
                  { count: d.stats.total - d.stats.active - d.stats.delayed - d.stats.completed, color: "#eab308", label: "At Risk" },
                  { count: d.stats.delayed, color: "#dc2626", label: "Delayed" },
                  { count: d.stats.completed, color: "#3b82f6", label: "Done" },
                ].map(({ count, color, label }) => count > 0 && (
                  <div key={label} title={`${label}: ${count}`} style={{ height: 6, flex: count, background: color, borderRadius: 4 }} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {[
                  { label: "On Track", val: d.stats.active, color: "#16a34a" },
                  { label: "At Risk", val: d.stats.total - d.stats.active - d.stats.delayed - d.stats.completed, color: "#eab308" },
                  { label: "Delayed", val: d.stats.delayed, color: "#dc2626" },
                  { label: "Done", val: d.stats.completed, color: "#3b82f6" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk & Issues row */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Open Risks", val: d.openRisks, color: d.openRisks > 2 ? "#dc2626" : d.openRisks > 0 ? "#854d0e" : "#15803d" },
                { label: "Open Issues", val: d.openIssues, color: d.openIssues > 2 ? "#dc2626" : d.openIssues > 0 ? "#854d0e" : "#15803d" },
                { label: "Escalated", val: d.escalated, color: d.escalated > 0 ? "#dc2626" : "#15803d" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "6px", background: T.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color }}>{val}</div>
                  <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Budget row */}
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Budget Utilisation</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{d.stats.budgetUtil}%</span>
              </div>
              <Progress value={d.stats.budgetUtil} color={d.stats.budgetUtil > 90 ? "#dc2626" : d.stats.budgetUtil > 75 ? "#eab308" : T.accent} height={6} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Budget: <strong style={{ color: T.text }}>{fmtSAR(d.stats.totalBudget)}</strong></span>
                <span style={{ fontSize: 11, color: T.muted }}>Spent: <strong style={{ color: T.text }}>{fmtSAR(d.stats.actualCost)}</strong></span>
              </div>
            </div>

            {/* Footer actions */}
            <div style={{ padding: "12px 20px", display: "flex", gap: 8 }}>
              <button onClick={() => setRoute({ view: "department", deptId: d.id })} style={{ flex: 1, background: T.btnPrimBg, color: T.btnPrimText, border: "none", borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                View Projects →
              </button>
              <div style={{ background: d.ipiC.bg, color: d.ipiC.color, borderRadius: 8, padding: "8px 12px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center" }}>
                #{rank + 1} Rank
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ALL PROJECTS VIEW ────────────────────────────────────────────
const AllProjectsView = ({ projects, setRoute }) => {
  const { departments } = useDepts();
  const T = useT();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterType, setFilterType] = useState("All");

  const active = projects.filter(p => !p.archived);
  const filtered = useMemo(() => active.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.pm.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || p.status === filterStatus;
    const matchDept = filterDept === "All" || p.deptId === filterDept;
    const matchType = filterType === "All" || p.projectType === filterType;
    return matchSearch && matchStatus && matchDept && matchType;
  }), [active, search, filterStatus, filterDept, filterType]);

  return (
    <div style={{ padding: 32, maxWidth: 1400 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: T.text }}>All Projects</h1>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 13 }}>Complete portfolio · {active.length} active projects across all departments</p>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, codes, or PMs..." style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", flex: 1, background: T.inputBg, color: T.inputText }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          {["All", "On Track", "At Risk", "Delayed", "Completed", "Not Started"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: T.selectBg, color: T.inputText }}>
          <option value="All">All Types</option>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div style={{ display: "flex", alignItems: "center", fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{filtered.length} results</div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: T.bg }}>
            {["Code", "Project Name", "Type", "Department", "PM", "Sponsor", "Phase", "Progress", "Status", "Risk", "Budget", "Gate"].map(h => (
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p, i) => {
              const dept = departments.find(d => d.id === p.deptId);
              return (
                <tr key={p.id} onClick={() => setRoute({ view: "project", projectId: p.id })} style={{ borderTop: `1px solid ${T.border}`, cursor: "pointer", background: i % 2 === 0 ? "transparent" : T.bg }}
                  onMouseEnter={e => e.currentTarget.style.background = themeStore.dark ? '#132820' : '#f0f7f4'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : themeStore.T.bg}>
                  <td style={{ padding: "12px 14px", fontSize: 11, fontWeight: 700, color: T.primary }}>{p.code}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: themeStore.T.text }}>{p.name}</td>
                  <td style={{ padding: "12px 14px" }}><TypeBadge type={p.projectType || "Internal Project"} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span>{dept?.icon}</span><span style={{ color: T.muted }}>{dept?.name}</span>
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.pm}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.sponsor}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{p.phase}</td>
                  <td style={{ padding: "12px 14px", minWidth: 90 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1 }}><Progress value={p.progress} height={4} /></div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px" }}><Badge status={p.status} /></td>
                  <td style={{ padding: "12px 14px" }}><RiskBadge level={p.riskLevel} /></td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: p.budgetStatus === "Over Budget" ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{p.budgetStatus}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>{p.gate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── APP ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [route, setRoute] = useState({ view: "home" });
  const [dark, setDark] = useState(false);
  const toggleDark = () => {
    themeStore.toggle();           // notifies ALL useT() subscribers instantly
    setDark(themeStore.dark);      // keep local state in sync for Header prop
  };
  const activeT = themeStore.T;
  const [projects, setProjects] = useState(PROJECTS);

  // ── Departments live state ─────────────────────────────────────
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const addDept    = useCallback((d) => setDepartments(prev => [...prev, d]), []);
  const updateDept = useCallback((id, data) => setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...data } : d)), []);
  const deleteDept = useCallback((id) => setDepartments(prev => prev.filter(d => d.id !== id)), []);
  const deptCtx = { departments, addDept, updateDept, deleteDept };

  // theme handled by themeStore pub/sub

  // ── CRUD helpers passed down to AdminView ──────────────────────
  const addProject = useCallback((data) => {
    const newId = `P${String(projects.length + 1).padStart(3, "0")}`;
    const today = new Date().toISOString().split("T")[0];
    // Build required documents list
    const mandatoryDocs = [
      { id: "D1", name: "Project Charter",  type: "Charter",       required: true, status: "Pending", version: "", lastUpdated: "" },
      { id: "D2", name: "Business Case",    type: "Business Case", required: true, status: "Pending", version: "", lastUpdated: "" },
      { id: "D3", name: "Closure Document", type: "Closure",       required: true, status: "Pending", version: "", lastUpdated: "" },
    ];
    const optionalDocs = (data.requiredDocs || []).map((name, i) => ({
      id: `D${i + 4}`, name, type: name, required: true, status: "Pending", version: "", lastUpdated: ""
    }));
    const defaultGates = GATE_DEFS.map(g => ({
      id: g.id, status: "Pending", date: null, approver: "", notes: ""
    }));
    setProjects(prev => [...prev, {
      ...data,
      id: newId,
      projectType: data.projectType || "Internal Project",
      gates: defaultGates,
      milestones: [], risks: [], issues: [], benefits: [],
      approvals: [], updates: [],
      documents: [...mandatoryDocs, ...optionalDocs],
      health: { scope: "Green", schedule: "Green", budget: "Green", risk: "Green", quality: "Green", resource: "Green", benefits: "Green", governance: "Green" },
      spi: 1.0, cpi: 1.0, daysRemaining: 0, daysDelayed: 0,
      scheduleVariance: "0", actualCost: 0,
      forecast: Number(data.budget),
      lastUpdate: today,
    }]);
  }, [projects.length]);

  const updateProject = useCallback((id, data) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data, lastUpdate: new Date().toISOString().split("T")[0] } : p));
  }, []);

  const archiveProject = useCallback((id) => {
    const today = new Date().toISOString().split("T")[0];
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: true, archivedDate: today } : p));
  }, []);

  const restoreProject = useCallback((id) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, archived: false, archivedDate: null } : p));
  }, []);

  const deleteForever = useCallback((id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Dynamic title ───────────────────────────────────────────────
  const getTitle = () => {
    if (route.view === "home") return ["Enterprise Portfolio Dashboard", "Executive overview across all departments"];
    if (route.view === "departments") return ["Departments Overview", `IPI comparison across ${departments.length} departments`];
    if (route.view === "projects") return ["All Projects", "Complete project portfolio"];
    if (route.view === "admin") return ["Admin Panel", "System data management"];
    if (route.view === "department") {
      const d = departments.find(x => x.id === route.deptId);
      return [d?.name || "Department", "Project portfolio"];
    }
    if (route.view === "project") {
      const p = projects.find(x => x.id === route.projectId);
      return [p?.name || "Project", p?.code || ""];
    }
    return ["PMO Portal", ""];
  };

  const [title, subtitle] = getTitle();

  return (
    <ThemeContext.Provider value={{ T: activeT, dark }}>
    <DeptContext.Provider value={deptCtx}>
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: activeT.bg, color: activeT.text,
      overflow: "hidden",
    }}>
      <Sidebar route={route} setRoute={setRoute} projects={projects} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header title={title} subtitle={subtitle} route={route} setRoute={setRoute} dark={dark} toggleDark={toggleDark} />
        <main style={{ flex: 1, overflowY: "auto", background: activeT.bg }}>
          {route.view === "home"        && <HomeView          projects={projects} setRoute={setRoute} />}
          {route.view === "departments" && <DepartmentsOverview projects={projects} setRoute={setRoute} />}
          {route.view === "projects"    && <AllProjectsView    projects={projects} setRoute={setRoute} />}
          {route.view === "department"  && <DepartmentView     projects={projects} deptId={route.deptId} setRoute={setRoute} />}
          {route.view === "project"     && <ProjectView        projects={projects} projectId={route.projectId} setRoute={setRoute} updateProject={updateProject} />}
          {route.view === "admin"       && <AdminView          projects={projects} setRoute={setRoute} addProject={addProject} updateProject={updateProject} archiveProject={archiveProject} restoreProject={restoreProject} deleteForever={deleteForever} />}
        </main>
      </div>
    </div>
    </DeptContext.Provider>
    </ThemeContext.Provider>
  );
}
