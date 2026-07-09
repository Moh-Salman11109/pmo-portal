// Live end-to-end check of the Monthly Portfolio Report:
// mock admin → Home hero → click Print Monthly Report → capture the popup.
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/monthly-report";
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 250)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2600));

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Print Monthly Report"));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!clicked) { console.log("FAIL: button not found"); await browser.close(); process.exit(1); }

  // The report opens in a popup — grab the new page target.
  const target = await browser.waitForTarget(t => t.opener() && t.type() === "page", { timeout: 15000 });
  const report = await target.page();
  await report.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });
  await report.evaluateHandle("document.fonts.ready").catch(() => {});
  await new Promise(r => setTimeout(r, 1200));

  await report.screenshot({ path: `${OUT}/report-full.png`, fullPage: true });
  await report.pdf({ path: `${OUT}/PMO-Monthly-Report-sample.pdf`, format: "A4", printBackground: true });
  const title = await report.title();
  console.log("report title:", title);
  console.log(errors.length ? "PAGE ERRORS: " + errors.join(" ;; ") : "no page errors");
  console.log("done:", OUT);
  await browser.close();
})();
