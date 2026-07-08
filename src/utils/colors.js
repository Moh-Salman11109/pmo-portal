export const statusColor = {
  "On Track":   { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" },
  "At Risk":    { bg: "#fef9c3", text: "#854d0e", dot: "#eab308" },
  "Delayed":    { bg: "#fee2e2", text: "#991b1b", dot: "#dc2626" },
  "Completed":  { bg: "#dbeafe", text: "#1e40af", dot: "#3b82f6" },
  "Not Started":{ bg: "#f3f4f6", text: "#4b5563", dot: "#9ca3af" },
};

export const healthColor = {
  "Green": { bg: "#dcfce7", text: "#15803d", label: "Green" },
  "Amber": { bg: "#fef9c3", text: "#854d0e", label: "Amber" },
  "Red":   { bg: "#fee2e2", text: "#991b1b", label: "Red" },
};

export const riskColor = {
  "Critical": { bg: "#fff3ee", text: "#FF5000" },
  "High":     { bg: "#fdece2", text: "#b23800" },
  "Medium":   { bg: "#fdf6e8", text: "#d97706" },
  "Low":      { bg: "#eefaf4", text: "#007a62" },
};

export const RAG_COLOR = {
  Green: { bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
  Amber: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  Red:   { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" },
};

export const trendIcon  = t => t === "Improving" ? "↑" : t === "Worsening" ? "↓" : "→";
export const trendColor = t => t === "Improving" ? "#15803d" : t === "Worsening" ? "#dc2626" : "#d97706";

// Department identity colours — every shade derived from the Tree brand
// palette (Canopy, Sea, Orange, Maroon, Moss, Lichen). This map is the
// single source of truth for dept colour: it OVERRIDES whatever is stored
// in mock data or the SP DeptColor column so brand compliance can't drift.
export const DEPT_COLORS = {
  strategy:    "#003932",   // Canopy
  digital:     "#00b894",   // Sea, darkened for contrast on light surfaces
  it:          "#0a5448",   // Deep canopy-teal
  operations:  "#3a5547",   // Moss, dark
  finance:     "#7a9485",   // Moss, mid
  grc:         "#490300",   // Maroon
  hr:          "#FF5000",   // Orange
  quality:     "#b23800",   // Orange, deep
  performance: "#7a2620",   // Maroon, warm
};
const DEPT_FALLBACKS = ["#003932", "#490300", "#FF5000", "#3a5547", "#0a5448", "#7a9485"];
export const deptColor = (id) => {
  const key = (id || "").toLowerCase();
  if (DEPT_COLORS[key]) return DEPT_COLORS[key];
  // Unknown dept (added later in SP): stable pick from the brand family
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return DEPT_FALLBACKS[h % DEPT_FALLBACKS.length];
};
