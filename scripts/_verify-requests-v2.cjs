const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/requests-v2";
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1150 });
  // admin sees ALL requests/gates/closures (filterByUser returns full list) — richest view
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 250)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2400));
  await page.evaluate(() => [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("New Request"))?.click());
  await new Promise(r => setTimeout(r, 1200));
  const scrollMain = (y) => page.evaluate((yy) => { const m = document.querySelector("main") || document.scrollingElement; m.scrollTop = yy; }, y);
  await page.screenshot({ path: `${OUT}/01-top.png` });
  await scrollMain(720);
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/02-mid.png` });
  await scrollMain(99999);
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/03-bottom.png` });
  console.log(errors.length ? "ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
