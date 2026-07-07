// Shared monochrome line-icon set — the app's single icon language.
// Same visual grammar as the sidebar NavIcon: 16×16 viewBox, 1.5 stroke,
// currentColor. Use these instead of emojis everywhere.
const PATHS = {
  pencil:    <path d="M11.3 2.7l2 2L5.5 12.5l-2.8.8.8-2.8z M9.8 4.2l2 2" />,
  check:     <path d="M3 8.5l3.5 3.5L13 4.5" />,
  printer:   <><rect x="3" y="6" width="10" height="5.5" rx="1" /><path d="M5.5 6V2.5h5V6 M5.5 11.5v2h5v-2" /></>,
  doc:       <><path d="M4 2h5l3 3v9H4z" /><path d="M9 2v3h3" /></>,
  alert:     <path d="M8 2.7l6 10.6H2z M8 6.8v2.8 M8 11.7v.01" />,
  inbox:     <><path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" /><path d="M4 3.5h8l1.5 6v4h-11v-4z" /></>,
  clipboard: <><rect x="3.5" y="3" width="9" height="11" rx="1" /><path d="M6 3V1.8h4V3 M6 6.8h4 M6 9.3h4" /></>,
  flag:      <path d="M4 14.5V2.5 M4 3h8.5l-2 2.75 2 2.75H4" />,
  paperclip: <path d="M10.8 4.3l-4.9 4.9a1.9 1.9 0 002.7 2.7l4.9-4.9a3.1 3.1 0 00-4.4-4.4L4.2 7.5" />,
  calendar:  <><rect x="2.5" y="3.5" width="11" height="10.5" rx="1.5" /><path d="M2.5 6.8h11 M5.5 1.8v3 M10.5 1.8v3" /></>,
  archive:   <><rect x="2.5" y="2.8" width="11" height="3" rx="0.8" /><path d="M3.5 5.8v7.5h9V5.8 M6.5 8.3h3" /></>,
  trash:     <path d="M3 4.3h10 M5.3 4.3V2.8h5.4v1.5 M4.3 4.3l.6 9.4h6.2l.6-9.4 M6.7 6.8v4.4 M9.3 6.8v4.4" />,
  lock:      <><rect x="3.5" y="7" width="9" height="6.8" rx="1.5" /><path d="M5.5 7V4.9a2.5 2.5 0 015 0V7" /></>,
  shield:    <path d="M8 1.8l5.2 1.9v4.1c0 3.3-2.3 5.6-5.2 6.6-2.9-1-5.2-3.3-5.2-6.6V3.7z" />,
  search:    <><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2l3.4 3.4" /></>,
  moon:      <path d="M13.2 9.7A5.8 5.8 0 116.3 2.8a4.6 4.6 0 006.9 6.9z" />,
  sun:       <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.8 M8 12.7v1.8 M1.5 8h1.8 M12.7 8h1.8 M3.4 3.4l1.3 1.3 M11.3 11.3l1.3 1.3 M12.6 3.4l-1.3 1.3 M4.7 11.3l-1.3 1.3" /></>,
  star:      <path d="M8 1.9l1.9 3.9 4.2.6-3 3 .7 4.2L8 11.6l-3.8 2 .7-4.2-3-3 4.2-.6z" />,
  eye:       <><path d="M1.5 8S4 3.6 8 3.6 14.5 8 14.5 8 12 12.4 8 12.4 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>,
  map:       <path d="M5.5 2.8L2.5 4v9.2l3-1.2 5 1.2 3-1.2V2.8l-3 1.2zM5.5 2.8V12 M10.5 4v9.2" />,
  target:    <><circle cx="8" cy="8" r="5.7" /><circle cx="8" cy="8" r="2.6" /><path d="M8 8v.01" /></>,
  chart:     <path d="M2.5 13.5h11 M5 13.5V8.2 M8 13.5V4.5 M11 13.5V9.8" />,
  trend:     <path d="M2.5 11.5L6 8l2.5 2.5 5-5.5 M10.3 5h3.2v3.2" />,
  coins:     <><ellipse cx="8" cy="4.6" rx="4.8" ry="2.1" /><path d="M3.2 4.6v3.2c0 1.15 2.15 2.1 4.8 2.1s4.8-.95 4.8-2.1V4.6 M3.2 7.8v3.2c0 1.15 2.15 2.1 4.8 2.1s4.8-.95 4.8-2.1V7.8" /></>,
  note:      <><path d="M4 2h8v12H4z" /><path d="M6 5.3h4 M6 7.8h4 M6 10.3h2.5" /></>,
  calc:      <><rect x="3.5" y="1.8" width="9" height="12.4" rx="1.4" /><path d="M5.7 4.2h4.6 M5.9 7.5v.01 M8 7.5v.01 M10.1 7.5v.01 M5.9 9.7v.01 M8 9.7v.01 M10.1 9.7v.01 M5.9 11.9v.01 M8 11.9v.01 M10.1 11.9v.01" /></>,
  user:      <><circle cx="8" cy="5.2" r="2.6" /><path d="M3.2 13.8a4.8 4.8 0 019.6 0" /></>,
  chat:      <path d="M2.5 3.3h11v7.2H7.2L4 13.2v-2.7H2.5z" />,
  siren:     <><path d="M4.5 11V8a3.5 3.5 0 017 0v3" /><path d="M2.5 11h11v2.3h-11z M8 1.6v1.6 M3.2 3.4l1.1 1.1 M12.8 3.4l-1.1 1.1" /></>,
  gauge:     <><path d="M2.6 11.5a5.8 5.8 0 1110.8 0" /><path d="M8 9.5l2.6-2.6" /><path d="M8 9.5v.01" /></>,
};

export const Ico = ({ name, size = 16, color = "currentColor", strokeWidth = 1.5, style }) => {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: "middle", ...style }} aria-hidden="true">
      {p}
    </svg>
  );
};

// Two-letter department tile — same idea as the sidebar's DeptGlyph but
// theme-agnostic: tinted with the department's brand colour on any surface.
export const DeptTile = ({ name, color = "#3a5547", size = 38, radius = 10, fontSize, solid = false }) => {
  const initials = (name || "?")
    .split(/\s+/).filter(w => /[A-Za-z؀-ۿ0-9]/.test(w[0] || ""))
    .slice(0, 2).map(w => w[0].toUpperCase()).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: solid ? color : `${color}1a`,
      border: solid ? "1px solid rgba(255,255,255,0.25)" : `1px solid ${color}33`,
      color: solid ? "#fff" : color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: fontSize || Math.round(size * 0.34), fontWeight: 800, letterSpacing: "0.02em",
    }}>
      {initials || "—"}
    </div>
  );
};
