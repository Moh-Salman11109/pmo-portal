import { useT } from "../theme.js";

export const Progress = ({ value, color, height = 6 }) => {
  const T = useT();
  return (
    <div style={{ background: T.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, value)}%`, height: "100%", background: color || T.accent, borderRadius: height, transition: "width 0.3s" }} />
    </div>
  );
};
