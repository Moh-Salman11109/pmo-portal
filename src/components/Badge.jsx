import { useT } from "../theme.js";
import { statusColor, healthColor, riskColor } from "../utils/colors.js";

export const TypeBadge = ({ type }) => {
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

export const Badge = ({ status, size = "sm" }) => {
  const T = useT();
  const c = statusColor[status] || { bg: "#f3f4f6", text: "#374151", dot: "#9ca3af" };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: size === "sm" ? 11 : 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
};

export const HealthBadge = ({ status }) => {
  const c = healthColor[status] || healthColor["Amber"];
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{c.label}</span>
  );
};

export const RiskBadge = ({ level }) => {
  const c = riskColor[level] || riskColor["Medium"];
  return <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>{level}</span>;
};
