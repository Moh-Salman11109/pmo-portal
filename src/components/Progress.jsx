import { useState, useEffect } from "react";
import { useT } from "../theme.js";

export const Progress = ({ value, color, height = 6 }) => {
  const T = useT();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDisplay(Math.min(100, Math.max(0, value))), 60);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div style={{ background: T.border, borderRadius: height, height, overflow: "hidden" }}>
      <div style={{
        width: `${display}%`,
        height: "100%",
        background: color || T.accent,
        borderRadius: height,
        transition: "width 0.75s cubic-bezier(0.4, 0, 0.2, 1)",
      }} />
    </div>
  );
};
