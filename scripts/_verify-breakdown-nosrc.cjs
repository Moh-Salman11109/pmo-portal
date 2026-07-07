// Confirm the IPI + Progress breakdown modals no longer leak source-file paths.
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/breakdown-nosrc";

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));

  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2300));
  await page.evaluate(() => [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("All Projects"))?.click());
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const openAudit = async (which) => page.evaluate((w) => {
    // "AUDIT ↗" markers sit inside the IPI and Progress hero cards
    const marks = [...document.querySelectorAll("*")].filter(e => e.children.length === 0 && /AUDIT/.test(e.textContent));
    const el = marks[w];
    (el?.closest("div[style]") || el)?.click();
  }, which);

  // IPI modal
  await openAudit(0);
  await new Promise(r => setTimeout(r, 900));
  let scan = await page.evaluate(() => ({
    leak: /metrics\.js|Source of truth|src\/utils|calcProject/.test(document.body.innerText),
    generated: /Generated/.test(document.body.innerText),
  }));
  await page.screenshot({ path: `${OUT}/ipi-modal.png` });
  console.log("IPI modal:", JSON.stringify(scan));
  await page.keyboard.press("Escape");
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /×|✕|Close/.test(b.textContent))?.click());
  await new Promise(r => setTimeout(r, 500));

  // Progress modal
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await openAudit(1);
  await new Promise(r => setTimeout(r, 900));
  scan = await page.evaluate(() => ({
    leak: /metrics\.js|Source of truth|src\/utils|calcProject/.test(document.body.innerText),
    generated: /Generated/.test(document.body.innerText),
  }));
  await page.screenshot({ path: `${OUT}/progress-modal.png` });
  console.log("Progress modal:", JSON.stringify(scan));

  console.log(errors.length ? "ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
