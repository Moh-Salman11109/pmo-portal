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
  "Critical": { bg: "#fee2e2", text: "#991b1b" },
  "High":     { bg: "#fef3c7", text: "#92400e" },
  "Medium":   { bg: "#fef9c3", text: "#854d0e" },
  "Low":      { bg: "#dcfce7", text: "#15803d" },
};

export const RAG_COLOR = {
  Green: { bg: "#dcfce7", text: "#15803d", border: "#16a34a" },
  Amber: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  Red:   { bg: "#fee2e2", text: "#991b1b", border: "#dc2626" },
};

export const trendIcon  = t => t === "Improving" ? "↑" : t === "Worsening" ? "↓" : "→";
export const trendColor = t => t === "Improving" ? "#15803d" : t === "Worsening" ? "#dc2626" : "#d97706";
