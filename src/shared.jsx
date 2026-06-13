import { useT } from "./theme.js";

export const SectionHeader = ({ title, subtitle, action, onAction }) => {
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
