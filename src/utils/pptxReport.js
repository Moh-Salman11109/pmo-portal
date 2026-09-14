// ============================================================================
//  PowerPoint project status report (editable native shapes, not an image).
//  Uses the vendored PptxGenJS UMD (public/vendor/pptxgen.bundle.js, loaded
//  lazily by the caller → window.PptxGenJS). No npm dependency.
//  generateProjectPptx(data) builds the deck from the SAME figures the on-screen
//  Print Report uses; the caller passes them in so the two never diverge.
// ============================================================================

// Tree brand palette (hex, no '#')
const C = {
  canopy: "003932", canopyDeep: "001F1A", sea: "00FFB3", seaDeep: "00B894",
  orange: "FF5000", maroon: "490300", red: "DC2626", redDeep: "991B1B",
  blue: "3B82F6", blueDeep: "1E40AF", moss: "A1B9AB", mossDeep: "7A9485",
  amber: "D97706", green: "15803D", ink: "0F2A24", muted: "6B7280",
  line: "D9E6DF", panel: "F4F8F5", white: "FFFFFF",
};

const GATE_LABELS = [
  ["Gate 1", "Project Request"], ["Gate 2", "Initiation"], ["Gate 3", "Planning"],
  ["Gate 4", "Execution"], ["Gate 5", "Closure"],
];

const ipiBand = (ipi, breach) => {
  if (breach) return C.amber;
  if (ipi == null) return C.muted;
  if (ipi >= 80) return C.green;
  if (ipi >= 60) return C.amber;
  return C.red;
};

const fmtShort = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const fmtLong  = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const money = (n) => (n == null || isNaN(n)) ? "—" : Number(n).toLocaleString("en-US");

// Lazy-load the vendored UMD once, on first export — keeps ~460 KB out of the
// initial bundle. Resolves when window.PptxGenJS is ready.
export function loadPptxLib() {
  if (window.PptxGenJS) return Promise.resolve();
  if (window.__pptxLoading) return window.__pptxLoading;
  window.__pptxLoading = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "/vendor/pptxgen.bundle.js";
    el.onload = () => window.PptxGenJS ? resolve() : reject(new Error("PowerPoint library failed to initialise."));
    el.onerror = () => { window.__pptxLoading = null; reject(new Error("Could not load the PowerPoint library.")); };
    document.head.appendChild(el);
  });
  return window.__pptxLoading;
}

export function generateProjectPptx(data) {
  const { project, deptName, ipi, spi, cpi, mci, governanceBreach,
          progress, budget, actualCost, budgetUtil, remaining } = data;
  const G = window.PptxGenJS;
  if (!G) throw new Error("PptxGenJS is not loaded.");

  const pptx = new G();
  pptx.defineLayout({ name: "TREE_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "TREE_WIDE";
  pptx.author = "PMO Portal";
  pptx.company = "Tree Digital Insurance";
  const W = 13.333, H = 7.5;

  const status = project.status || "—";
  const reportDate = fmtLong(new Date());

  // ── shared header band for content slides
  const header = (slide, title) => {
    slide.background = { color: C.white };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.9, fill: { color: C.canopy } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: W, h: 0.04, fill: { color: C.sea } });
    slide.addText(project.name || "Project", { x: 0.5, y: 0.12, w: 8.5, h: 0.45, fontSize: 18, bold: true, color: C.white, fontFace: "Segoe UI" });
    slide.addText(title, { x: 0.5, y: 0.55, w: 8.5, h: 0.3, fontSize: 12, color: C.sea, fontFace: "Segoe UI" });
    slide.addText(project.code || "", { x: W - 3.5, y: 0.12, w: 3.0, h: 0.3, align: "right", fontSize: 11, color: "CFE9DF", fontFace: "Segoe UI" });
    slide.addText(reportDate, { x: W - 3.5, y: 0.42, w: 3.0, h: 0.3, align: "right", fontSize: 10, color: "9DC4B6", fontFace: "Segoe UI" });
  };

  const statBox = (slide, x, y, w, h, label, value, valColor) => {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.panel }, line: { color: C.line, width: 1 } });
    slide.addText(String(label).toUpperCase(), { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.28, fontSize: 9, bold: true, color: C.muted, fontFace: "Segoe UI", charSpacing: 1 });
    slide.addText(String(value), { x: x + 0.15, y: y + 0.42, w: w - 0.3, h: h - 0.55, fontSize: 22, bold: true, color: valColor || C.ink, fontFace: "Segoe UI" });
  };

  // ────────────────────────────────────────────────────────────── Slide 1 · Cover
  {
    const s = pptx.addSlide();
    s.background = { color: C.canopyDeep };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: C.canopyDeep } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.12, w: W, h: 0.12, fill: { color: C.sea } });
    s.addText("PROJECT STATUS REPORT", { x: 0.9, y: 1.5, w: 11, h: 0.4, fontSize: 14, bold: true, color: C.sea, charSpacing: 3, fontFace: "Segoe UI" });
    s.addText(project.name || "Project", { x: 0.9, y: 2.1, w: 11.5, h: 1.3, fontSize: 40, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(project.code ? `${project.code}  ·  ${deptName || "—"}` : (deptName || "—"), { x: 0.9, y: 3.5, w: 11.5, h: 0.5, fontSize: 16, color: "9DC4B6", fontFace: "Segoe UI" });

    // status pill
    const pillColor = status === "Delayed" ? C.red : status === "Completed" ? C.blue : status === "On Hold" ? C.amber : C.seaDeep;
    s.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 4.3, w: 2.2, h: 0.5, rectRadius: 0.25, fill: { color: pillColor } });
    s.addText(status, { x: 0.9, y: 4.3, w: 2.2, h: 0.5, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.white, fontFace: "Segoe UI" });

    // footer info line
    const foot = [
      { text: "Project Manager  ", options: { color: "6F9585", fontSize: 11 } },
      { text: `${project.pm || "—"}      `, options: { color: C.white, fontSize: 11, bold: true } },
      { text: "Window  ", options: { color: "6F9585", fontSize: 11 } },
      { text: `${fmtShort(project.startDate)} – ${fmtShort(project.plannedEnd)}      `, options: { color: C.white, fontSize: 11, bold: true } },
      { text: "Generated  ", options: { color: "6F9585", fontSize: 11 } },
      { text: reportDate, options: { color: C.white, fontSize: 11, bold: true } },
    ];
    s.addText(foot, { x: 0.9, y: 6.3, w: 11.5, h: 0.4, fontFace: "Segoe UI" });
  }

  // ────────────────────────────────────────────────────── Slide 2 · Health & IPI
  {
    const s = pptx.addSlide();
    header(s, "Health & Performance");
    const y0 = 1.35;
    // big IPI panel
    s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: y0, w: 3.6, h: 2.2, rectRadius: 0.1, fill: { color: C.canopy } });
    s.addText("IPI SCORE", { x: 0.7, y: y0 + 0.2, w: 3.2, h: 0.3, fontSize: 11, bold: true, color: C.sea, charSpacing: 1, fontFace: "Segoe UI" });
    s.addText(ipi == null ? "—" : String(ipi), { x: 0.7, y: y0 + 0.5, w: 3.2, h: 1.1, fontSize: 60, bold: true, color: C.white, fontFace: "Segoe UI" });
    s.addText(governanceBreach ? "Governance breach — band capped" : "Index of Project Implementation", { x: 0.7, y: y0 + 1.7, w: 3.2, h: 0.4, fontSize: 10, color: governanceBreach ? "FFD8A8" : "9DC4B6", fontFace: "Segoe UI" });
    // band dot
    s.addShape(pptx.ShapeType.ellipse, { x: 3.55, y: y0 + 0.25, w: 0.4, h: 0.4, fill: { color: ipiBand(ipi, governanceBreach) } });

    // breakdown stat boxes
    const bx = 4.4, bw = 2.85, bh = 1.03, gap = 0.15;
    statBox(s, bx, y0, bw, bh, "Progress", progress == null ? "—" : `${Math.round(progress)}%`);
    statBox(s, bx + bw + gap, y0, bw, bh, "SPI (Schedule)", spi == null ? "—" : spi.toFixed(2), spi != null && spi < 0.9 ? C.red : C.ink);
    statBox(s, bx + 2 * (bw + gap), y0, bw, bh, "CPI (Cost)", cpi == null ? "—" : cpi.toFixed(2), cpi != null && cpi < 0.9 ? C.red : C.ink);
    statBox(s, bx, y0 + bh + gap, bw, bh, "MCI (Artefacts)", mci == null ? "—" : mci.toFixed(2), mci != null && mci < 0.6 ? C.amber : C.ink);
    statBox(s, bx + bw + gap, y0 + bh + gap, bw, bh, "Budget Used", budget > 0 ? `${budgetUtil}%` : "—", budgetUtil > 100 ? C.red : C.ink);
    statBox(s, bx + 2 * (bw + gap), y0 + bh + gap, bw, bh, "Remaining", budget > 0 ? `SAR ${money(remaining)}` : "—", remaining < 0 ? C.red : C.ink);

    // budget bar
    const by = y0 + 2.65;
    s.addText("BUDGET", { x: 0.5, y: by, w: 3, h: 0.3, fontSize: 10, bold: true, color: C.muted, charSpacing: 1, fontFace: "Segoe UI" });
    s.addText(`SAR ${money(actualCost)} of ${money(budget)}`, { x: 3.5, y: by, w: 9.3, h: 0.3, align: "right", fontSize: 10, color: C.ink, fontFace: "Segoe UI" });
    s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: by + 0.35, w: 12.3, h: 0.4, rectRadius: 0.05, fill: { color: C.panel }, line: { color: C.line, width: 1 } });
    const usedW = Math.max(0, Math.min(1, budget > 0 ? actualCost / budget : 0)) * 12.3;
    if (usedW > 0.05) s.addShape(pptx.ShapeType.roundRect, { x: 0.5, y: by + 0.35, w: usedW, h: 0.4, rectRadius: 0.05, fill: { color: budgetUtil > 100 ? C.red : C.seaDeep } });
  }

  // ─────────────────────────────────────────────────────── Slide 3 · Gate Progress
  {
    const s = pptx.addSlide();
    header(s, "Gate Progress");
    const gateNum = parseInt(String(project.gate || "").replace(/\D/g, ""), 10) || 0;
    const currIdx = gateNum - 1;
    const isComplete = status === "Completed";
    const gateY = 3.0, size = 1.0, step = W / 5;
    for (let i = 0; i < 5; i++) {
      const cx = step * i + step / 2;
      let st = "Pending";
      if (currIdx >= 0) { if (i < currIdx) st = "Approved"; else if (i === currIdx) st = isComplete ? "Approved" : "In Progress"; }
      const style = st === "Approved" ? { fill: "DCFCE7", ring: "16A34A", txt: "15803D", icon: "✓" }
                  : st === "In Progress" ? { fill: "FEF9C3", ring: "EAB308", txt: "854D0E", icon: "●" }
                  : { fill: C.panel, ring: C.line, txt: C.muted, icon: "○" };
      // connector
      if (i < 4) s.addShape(pptx.ShapeType.line, { x: cx + size / 2, y: gateY + size / 2, w: step - size, h: 0, line: { color: st === "Approved" ? "16A34A" : C.line, width: 2 } });
      s.addShape(pptx.ShapeType.ellipse, { x: cx - size / 2, y: gateY, w: size, h: size, fill: { color: style.fill }, line: { color: style.ring, width: 2.5 } });
      s.addText(style.icon, { x: cx - size / 2, y: gateY, w: size, h: size, align: "center", valign: "middle", fontSize: 26, bold: true, color: style.txt, fontFace: "Segoe UI" });
      s.addText(GATE_LABELS[i][0], { x: cx - step / 2, y: gateY + size + 0.1, w: step, h: 0.3, align: "center", fontSize: 12, bold: true, color: style.txt, fontFace: "Segoe UI" });
      s.addText(GATE_LABELS[i][1], { x: cx - step / 2, y: gateY + size + 0.4, w: step, h: 0.3, align: "center", fontSize: 10, color: C.muted, fontFace: "Segoe UI" });
    }
    s.addText(isComplete ? "Project completed — all gates cleared." : `Currently at ${project.gate || "—"}.`,
      { x: 0.5, y: 5.6, w: 12.3, h: 0.4, align: "center", fontSize: 12, italic: true, color: C.muted, fontFace: "Segoe UI" });
  }

  // ───────────────────────────────────────────────────────── Slide 4 · Schedule (Gantt)
  {
    const s = pptx.addSlide();
    header(s, "Schedule");
    const ms = (project.milestones || []).filter(m => m.date || m.startDate);
    if (!ms.length) {
      s.addText("No scheduled activities.", { x: 0.5, y: 3.2, w: 12.3, h: 0.5, align: "center", fontSize: 14, color: C.muted, fontFace: "Segoe UI" });
    } else {
      const ts = ms.flatMap(m => [m.startDate, m.date].filter(Boolean).map(d => new Date(d).getTime()));
      const spanStart = Math.min(...ts, new Date(project.startDate || ts[0]).getTime());
      const spanEnd = Math.max(...ts, new Date(project.plannedEnd || ts[0]).getTime());
      const span = Math.max(1, spanEnd - spanStart);
      const todayMs = Date.now();
      const chartX = 0.6, chartW = 12.1, chartTop = 1.7, rowH = 0.34;
      const pct = (t) => Math.max(0, Math.min(1, (t - spanStart) / span));
      const xAt = (t) => chartX + pct(t) * chartW;

      // month ticks
      const cur = new Date(spanStart); cur.setDate(1);
      while (cur.getTime() <= spanEnd) {
        const x = xAt(cur.getTime());
        s.addShape(pptx.ShapeType.line, { x, y: chartTop, w: 0, h: 5.2, line: { color: "EEF3F0", width: 1 } });
        s.addText(cur.toLocaleString("en-GB", { month: "short", year: "2-digit" }), { x: x - 0.4, y: chartTop - 0.28, w: 0.8, h: 0.25, align: "center", fontSize: 8, color: C.muted, fontFace: "Segoe UI" });
        cur.setMonth(cur.getMonth() + 1);
      }
      // today line
      if (todayMs >= spanStart && todayMs <= spanEnd) {
        const tx = xAt(todayMs);
        s.addShape(pptx.ShapeType.line, { x: tx, y: chartTop, w: 0, h: 5.25, line: { color: C.red, width: 1.5, dashType: "dash" } });
        s.addText("Today", { x: tx - 0.4, y: chartTop + 5.25, w: 0.8, h: 0.22, align: "center", fontSize: 8, bold: true, color: C.red, fontFace: "Segoe UI" });
      }

      // ordered: milestones then their activities
      const tops = (project.milestones || []).filter(m => !m.parentId);
      const ordered = [];
      tops.forEach(t => { ordered.push({ m: t, ms: true }); (project.milestones || []).filter(k => k.parentId === t.id).forEach(k => ordered.push({ m: k, ms: false })); });
      const MAX = 13;
      const shown = ordered.slice(0, MAX);
      const statusOf = (m) => {
        if (m.status === "Completed") return "Completed";
        if (m.date && new Date(m.date).getTime() < todayMs) return "Delayed";
        if (m.status === "In Progress") return "In Progress";
        return "Upcoming";
      };
      const barColor = { "Completed": C.blue, "In Progress": C.seaDeep, "Delayed": C.red, "Upcoming": C.moss };

      shown.forEach((row, i) => {
        const m = row.m;
        const y = chartTop + 0.15 + i * rowH;
        const start = m.startDate ? new Date(m.startDate).getTime() : new Date(m.date).getTime();
        const end = m.date ? new Date(m.date).getTime() : start;
        const bx = xAt(Math.min(start, end));
        const bw = Math.max(0.12, xAt(Math.max(start, end)) - bx);
        const st = statusOf(m);
        s.addShape(pptx.ShapeType.roundRect, { x: bx, y, w: bw, h: rowH - 0.1, rectRadius: 0.04, fill: { color: barColor[st] }, line: { color: C.white, width: 0.5 } });
        // label inside if wide enough, else to the right
        const label = `${row.ms ? "◆ " : ""}${m.name || "Activity"}`;
        if (bw > 2.2) s.addText(label, { x: bx + 0.08, y, w: bw - 0.16, h: rowH - 0.1, valign: "middle", fontSize: 8.5, bold: row.ms, color: st === "Delayed" || st === "Completed" ? C.white : C.canopy, fontFace: "Segoe UI" });
        else s.addText(label, { x: bx + bw + 0.06, y, w: 3.2, h: rowH - 0.1, valign: "middle", fontSize: 8.5, bold: row.ms, color: C.ink, fontFace: "Segoe UI" });
      });
      if (ordered.length > MAX) s.addText(`+ ${ordered.length - MAX} more activities`, { x: chartX, y: chartTop + 0.15 + MAX * rowH + 0.05, w: 6, h: 0.3, fontSize: 9, italic: true, color: C.muted, fontFace: "Segoe UI" });

      // legend
      const leg = [["Completed", C.blue], ["In Progress", C.seaDeep], ["Delayed / late", C.red], ["Upcoming", C.moss]];
      leg.forEach(([lbl, col], i) => {
        const lx = 0.6 + i * 3.0;
        s.addShape(pptx.ShapeType.rect, { x: lx, y: 7.0, w: 0.22, h: 0.22, fill: { color: col } });
        s.addText(lbl, { x: lx + 0.3, y: 6.98, w: 2.6, h: 0.28, fontSize: 9, color: C.muted, fontFace: "Segoe UI" });
      });
    }
  }

  // ────────────────────────────────────────────────── Slide 5 · Risks & Issues
  {
    const s = pptx.addSlide();
    header(s, "Risks & Issues");
    const risks = [...(project.risks || [])].sort((a, b) => ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[b.level] || 0) - ({ Critical: 4, High: 3, Medium: 2, Low: 1 }[a.level] || 0));
    const lvlColor = { Critical: C.maroon, High: C.orange, Medium: C.amber, Low: C.mossDeep };
    s.addText(`Risks (${risks.length})`, { x: 0.5, y: 1.2, w: 6, h: 0.35, fontSize: 14, bold: true, color: C.ink, fontFace: "Segoe UI" });
    if (!risks.length) {
      s.addText("No risks recorded.", { x: 0.5, y: 1.7, w: 6, h: 0.4, fontSize: 12, color: C.muted, fontFace: "Segoe UI" });
    } else {
      const head = ["Level", "Risk", "Status"].map(t => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.canopy }, fontSize: 10, valign: "middle" } }));
      const rows = risks.slice(0, 12).map(r => ([
        { text: r.level || "—", options: { color: C.white, fill: { color: lvlColor[r.level] || C.muted }, bold: true, fontSize: 9.5, align: "center", valign: "middle" } },
        { text: r.title || r.name || r.description || "—", options: { color: C.ink, fontSize: 9.5, valign: "middle" } },
        { text: r.status || "Open", options: { color: C.muted, fontSize: 9.5, valign: "middle" } },
      ]));
      s.addTable([head, ...rows], { x: 0.5, y: 1.65, w: 7.0, colW: [1.3, 4.3, 1.4], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: 0.32, fontFace: "Segoe UI" });
      if (risks.length > 12) s.addText(`+ ${risks.length - 12} more`, { x: 0.5, y: 6.9, w: 6, h: 0.3, fontSize: 9, italic: true, color: C.muted, fontFace: "Segoe UI" });
    }

    // Issues summary (right column)
    const issues = project.issues || [];
    const open = issues.filter(i => i.status !== "Closed").length;
    const stale = issues.filter(i => { const d = i.raised ? Math.floor((Date.now() - new Date(i.raised).getTime()) / 86400000) : null; return d != null && d > 30 && i.status === "Open"; }).length;
    const escalated = issues.filter(i => i.escalated).length;
    s.addText(`Issues (${issues.length})`, { x: 8.0, y: 1.2, w: 4.8, h: 0.35, fontSize: 14, bold: true, color: C.ink, fontFace: "Segoe UI" });
    statBox(s, 8.0, 1.65, 4.8, 1.0, "Open", String(open));
    statBox(s, 8.0, 2.8, 2.3, 1.0, "Stale 30d+", String(stale), stale > 0 ? C.amber : C.ink);
    statBox(s, 10.5, 2.8, 2.3, 1.0, "Escalated", String(escalated), escalated > 0 ? C.red : C.ink);
  }

  // ─────────────────────────────────────────────────────── Slide 6 · Milestones
  {
    const s = pptx.addSlide();
    header(s, "Milestones");
    const tops = (project.milestones || []).filter(m => !m.parentId);
    if (!tops.length) {
      s.addText("No milestones recorded.", { x: 0.5, y: 3.2, w: 12.3, h: 0.5, align: "center", fontSize: 14, color: C.muted, fontFace: "Segoe UI" });
    } else {
      const head = ["Milestone", "Start", "Finish", "Status", "Progress"].map(t => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.canopy }, fontSize: 10, valign: "middle" } }));
      const rows = tops.slice(0, 14).map(m => {
        const st = m.status === "Completed" ? "Completed" : (m.date && new Date(m.date).getTime() < Date.now() && m.status !== "Completed") ? "Delayed" : (m.status || "Upcoming");
        const stColor = st === "Delayed" ? C.red : st === "Completed" ? C.blue : C.ink;
        return [
          { text: m.name || "—", options: { color: C.ink, bold: true, fontSize: 9.5, valign: "middle" } },
          { text: fmtShort(m.startDate), options: { color: C.muted, fontSize: 9.5, valign: "middle" } },
          { text: fmtShort(m.date), options: { color: C.muted, fontSize: 9.5, valign: "middle" } },
          { text: st, options: { color: stColor, bold: true, fontSize: 9.5, valign: "middle" } },
          { text: `${Math.round(m.progress ?? (m.status === "Completed" ? 100 : 0))}%`, options: { color: C.ink, fontSize: 9.5, align: "right", valign: "middle" } },
        ];
      });
      s.addTable([head, ...rows], { x: 0.5, y: 1.3, w: 12.3, colW: [6.3, 1.6, 1.6, 1.7, 1.1], border: { type: "solid", color: C.line, pt: 0.5 }, rowH: 0.34, fontFace: "Segoe UI" });
      if (tops.length > 14) s.addText(`+ ${tops.length - 14} more`, { x: 0.5, y: 6.9, w: 6, h: 0.3, fontSize: 9, italic: true, color: C.muted, fontFace: "Segoe UI" });
    }
  }

  const safe = String(project.code || project.name || "project").replace(/[^\w-]+/g, "_").slice(0, 40);
  return pptx.writeFile({ fileName: `${safe}-status-report.pptx` });
}
