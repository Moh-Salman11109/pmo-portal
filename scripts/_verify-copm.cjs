// Co-PM visibility check: P001 lists TWO PM emails (strategy + digital).
// Both PM accounts must see "PMO Transformation" in My Projects; a project
// they are NOT listed on must stay hidden.
const puppeteer = require("puppeteer");

const BASE = "http://localhost:5199/";
const PMS = ["pm.strategy@pmo.test", "pm.digital@pmo.test"];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });

  for (const email of PMS) {
    await page.evaluateOnNewDocument(e => localStorage.setItem("pmo_mock_email", e), email);
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise(r => setTimeout(r, 2200));
    const snap = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        seesP001: t.includes("PMO Transformation"),
        // P002 belongs to a different PM (no co-PM entry) — must NOT leak
        seesOther: t.includes("PMO Framework"),
        rows: (t.match(/STRAT-|DIG-|IT-/g) || []).length,
      };
    });
    console.log(email, "→", JSON.stringify(snap));
  }
  await browser.close();
})();
