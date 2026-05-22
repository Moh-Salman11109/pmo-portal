import { useState, useEffect } from "react";

export const THEMES = {
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
    headerBg:   "#003932",
    headerText: "#ffffff",
    btnPrimBg:  "#003932",
    btnPrimText:"#00ffb3",
    accentText: "#0d1f1c",
    badgeBg:    "#e8f5f0",
    inputText:  "#0d1f1c",
    selectBg:   "#ffffff",
  },
  dark: {
    primary:    "#00ffb3",
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
    headerBg:   "#061210",
    headerText: "#e8f5f0",
    btnPrimBg:  "#00ffb3",
    btnPrimText:"#061210",
    accentText: "#061210",
    badgeBg:    "#0f2a22",
    inputText:  "#e8f5f0",
    selectBg:   "#132820",
  },
};

export const themeStore = {
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
  },
};

export const useT = () => {
  const [, rerender] = useState(0);
  useEffect(() => {
    const unsub = themeStore.subscribe(() => rerender(n => n + 1));
    return unsub;
  }, []);
  return themeStore.T;
};

export const useDark = () => themeStore.dark;

export const ttStyle = () => {
  const dark = themeStore.dark;
  return {
    contentStyle: {
      fontSize: 12,
      borderRadius: 10,
      border: `1px solid ${dark ? "rgba(0,255,179,0.3)" : "#dce8dc"}`,
      background: dark ? "#0c1f1b" : "#ffffff",
      color: dark ? "#e8f5f0" : "#0d1f1c",
      boxShadow: dark ? "0 4px 20px rgba(0,0,0,0.45)" : "0 4px 16px rgba(0,57,50,0.10)",
      padding: "8px 14px",
    },
    labelStyle: {
      color: dark ? "#a1b9ab" : "#5a7a6e",
      fontWeight: 600,
      marginBottom: 2,
    },
    itemStyle:  { color: dark ? "#e8f5f0" : "#0d1f1c" },
    cursor:     { fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,57,50,0.04)" },
  };
};
