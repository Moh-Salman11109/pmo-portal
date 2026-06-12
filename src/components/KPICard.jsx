import { useState } from "react";
import { useT } from "../theme.js";

export const KPICard = ({ label, value, sub, color, icon, onClick }) => {
  const T = useT();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hovered ? (color || T.accent) : T.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.18s, border-color 0.18s, transform 0.18s",
        boxShadow: hovered ? `0 6px 22px rgba(0,0,0,0.11)` : "none",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || T.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );
};
