// Renders a realistic IPI Breakdown modal sample (matching the JSX
// structure exactly) using the same A4 print template the in-app
// Save-as-PDF uses, then writes a real PDF via headless Chrome so the
// user can verify multi-page output renders cleanly.

const puppeteer = require("puppeteer");
const fs = require("fs");

// CRITICAL: include the EXACT inline-style constraints React applies to
// the modal so we verify the print CSS actually overrides them. If we omit
// maxHeight/overflowY here, the test passes falsely while production fails.
const sampleModalHtml = `
<div class="audit-print-root" style="background:#fff;color:#1a2e2a;border-radius:14px;width:min(900px,100%);max-height:92vh;overflow-y:auto;border:1px solid #d1e8e4;font-family:'Inter',system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,0.45);">
  <div style="background:linear-gradient(135deg,#003932,#001f1a);color:#fff;padding:18px 22px;border-bottom:4px solid #00FFB3;">
    <div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#00FFB3;font-weight:800;margin-bottom:4px">Audit Breakdown</div>
    <div style="font-size:18px;font-weight:900;letter-spacing:-.3px">IPI Breakdown — Digital Insurer Transformation Program</div>
    <div style="font-size:11px;opacity:.75;margin-top:4px">As of 2026-06-30 · Project ID PRJ-2026-45</div>
  </div>
  <div style="padding:20px 22px 24px;background:#fff;color:#1a2e2a">
    <!-- Headline -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px">
      <div style="background:#fef3c7;color:#92400e;padding:14px 16px;border-radius:10px;text-align:center">
        <div style="font-size:30px;font-weight:900;line-height:1">88</div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.1em;margin-top:4px;text-transform:uppercase;opacity:.85">Displayed (Time-Weighted)</div>
        <div style="font-size:10px;font-weight:600;margin-top:2px;opacity:.7">At Risk</div>
      </div>
      <div style="background:#f4f8f6;border:1px solid #d1e8e4;padding:14px 16px;border-radius:10px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#1a2e2a;line-height:1">82</div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.1em;margin-top:4px;text-transform:uppercase;color:#56716c">Latest Snapshot</div>
        <div style="font-size:10px;color:#56716c;margin-top:2px">Current state of project</div>
      </div>
      <div style="background:#f4f8f6;border:1px solid #d1e8e4;padding:14px 16px;border-radius:10px;text-align:center">
        <div style="font-size:26px;font-weight:900;color:#dc2626;line-height:1">-6</div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.1em;margin-top:4px;text-transform:uppercase;color:#56716c">Snapshot vs Weighted</div>
        <div style="font-size:10px;color:#56716c;margin-top:2px">4 snapshots in history</div>
      </div>
    </div>
    ${
      // Generate 7 audit sections like the real modal
      ["Inputs read from the project","SPI — Schedule Performance Index","CPI — Cost Performance Index","MCI — Artefact Compliance Index","Snapshot IPI — present components re-normalised","Time-Weighted IPI — 90-day moving window","Final displayed value"].map((title, i) => `
      <section style="margin-bottom:18px">
        <div style="display:flex;align-items:baseline;gap:10px;border-bottom:1px solid #d1e8e4;padding-bottom:6px;margin-bottom:10px">
          <span style="font-family:monospace;color:#00b894;font-size:11px;font-weight:800">0${i+1}</span>
          <span style="font-size:13px;font-weight:800;color:#0d1f1c;letter-spacing:-.1px">${title}</span>
        </div>
        ${[
          ["Project window","2026-01-01  →  2027-01-01"],
          ["Total duration","365 days"],
          ["As-of date (today)","2026-06-30"],
          ["Days elapsed","180 of 365 days"],
          ["Actual progress (effective)","46%"],
          ["Planned progress source","Manual override"],
          ["Budget","12,200,000 SAR"],
          ["Actual cost","1,075,000 SAR"],
          ["Current gate","Gate 4"],
          ["Required docs","3 total · 2 due at Gate 4"],
          ["Roadmap deadline","2027-01-01"],
          ["Days past roadmap","Within roadmap"],
        ].map(([k,v]) => `
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:5px 0;border-bottom:1px dashed #d1e8e4;font-size:11.5px">
            <span style="color:#56716c">${k}</span>
            <span style="color:#0d1f1c;font-weight:600;font-family:'JetBrains Mono',monospace;font-feature-settings:'tnum'">${v}</span>
          </div>
        `).join("")}
        <div style="background:#f4f8f6;color:#0d1f1c;border:1px solid #d1e8e4;border-left:3px solid #00b894;border-radius:6px;padding:8px 12px;margin:8px 0;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;white-space:pre">Raw SPI  =  EV ÷ PV       (uncapped — preserves over-achievement signal)
EV       =  0.460   ← effective progress / 100
PV       =  0.290   ← manual override
Raw SPI  =  0.460 ÷ 0.290  =  0.791

Penalty  =  1 − (days_past ÷ 100)        ← Tree-invented, 100-day floor
        =  1 − (0 ÷ 100)
        =  1.000

SPI × Penalty       =  0.791 × 1.000  =  0.791
spiFinal = min(cap, …)  =  min(1.20, 0.791)  =  0.791</div>
      </section>
    `).join("")}
  </div>
</div>
`;

// MUST match the in-app popup template EXACTLY — same selectors, same
// !important markers — otherwise the verification doesn't represent reality.
const wrap = (body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Audit PDF Verification</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    margin: 0 !important; padding: 0 !important; background: #fff !important;
    font-family: 'Inter', system-ui, sans-serif; color: #0d1f1c;
    height: auto !important; overflow: visible !important;
  }
  .audit-print-root {
    width: 100% !important; max-width: none !important;
    max-height: none !important; height: auto !important;
    box-shadow: none !important; border: none !important; border-radius: 0 !important;
    background: #fff !important; overflow: visible !important;
    position: static !important; inset: auto !important;
  }
  .audit-print-root * { overflow: visible !important; max-height: none !important; }
  .audit-print-root section { page-break-inside: avoid; break-inside: avoid; }
  .audit-print-root table   { page-break-inside: auto !important;  break-inside: auto !important;  }
  .audit-print-root tr      { page-break-inside: avoid !important; break-inside: avoid !important; }
  @page { size: A4; margin: 10mm; }
</style>
</head>
<body>${body}</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(wrap(sampleModalHtml), { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 1000));   // fonts

  const outPdf = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/_PDF-EXPORT-VERIFICATION.pdf";
  await page.pdf({
    path: outPdf,
    format: "A4",
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    printBackground: true,
  });
  const stats = fs.statSync(outPdf);
  const buf = fs.readFileSync(outPdf);
  const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`✓ PDF: ${outPdf}`);
  console.log(`  Size:  ${stats.size.toLocaleString()} bytes`);
  console.log(`  Pages: ${pages}`);
  await browser.close();
  if (pages < 2) {
    console.error("✗ FAIL — expected ≥ 2 pages, got " + pages);
    process.exit(1);
  }
  console.log("✓ PASS — multi-page output confirmed");
})();
