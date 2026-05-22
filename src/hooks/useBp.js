import { useState, useEffect } from "react";

const getBp = () => {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 640)  return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};

const bpStore = { listeners: new Set() };
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => bpStore.listeners.forEach(fn => fn()), { passive: true });
}

export const useBp = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender(n => n + 1);
    bpStore.listeners.add(fn);
    return () => bpStore.listeners.delete(fn);
  }, []);
  return getBp();
};
