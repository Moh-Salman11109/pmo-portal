// Render the regenerated methodology to PDF + screenshot the pages that changed
// (cover, SPI ch.3, Baseline/Roadmap ch.7, worked example ch.9, glossary ch.16).
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/methodology-2026-07";
const SRC = "file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/PMO-Portal-IPI-Methodology.html";
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 1160 });
  await page.goto(SRC, { waitUntil: "load", timeout: 40000 });
  await page.evaluateHandle("document.fonts.ready");
  await new Promise(r => setTimeout(r, 600));
  await page.pdf({ path: `${OUT}/PMO-Portal-IPI-Methodology-2026-07.pdf`, format: "A4", printBackground: true });

  // Screenshot the .page whose <h2 class="section"> matches each target chapter.
  const targets = ["SPI — Schedule Performance", "Roadmap as a Dormant", "Worked Example — Single", "Glossary"];
  const idx = await page.evaluate((wants) => {
    const secs = [...document.querySelectorAll("h2.section")];
    const out = {};
    wants.forEach(w => {
      const h = secs.find(s => s.innerText.includes(w));
      if (h) { const pg = h.closest(".page"); out[w] = [...document.querySelectorAll(".page")].indexOf(pg); }
    });
    return out;
  }, targets);
  console.log("section page indices:", JSON.stringify(idx));
  const pages = await page.$$(".page");
  for (const [label, i] of Object.entries(idx)) {
    if (i < 0) continue;
    const safe = label.replace(/[^a-z0-9]+/gi, "-").slice(0, 24);
    await pages[i].screenshot({ path: `${OUT}/p${i}-${safe}.png` });
  }
  console.log("done:", OUT);
  await browser.close();
})();
