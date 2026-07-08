const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/project-v2";
const which = process.argv[2] || "Supply Chain Optimisation";
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1150 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 250)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2400));
  await page.evaluate(() => [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("All Projects"))?.click());
  await new Promise(r => setTimeout(r, 800));
  const clicked = await page.evaluate((w) => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes(w));
    if (td) { (td.closest("tr") || td).click(); return true; } return false;
  }, which);
  console.log("opened project:", clicked, "-", which);
  await new Promise(r => setTimeout(r, 1400));
  const scrollMain = (y) => page.evaluate((yy) => { const m = document.querySelector("main") || document.scrollingElement; m.scrollTop = yy; }, y);

  await page.screenshot({ path: `${OUT}/01-hero-charts-top.png` });
  await scrollMain(700);
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/02-charts.png` });

  // Activities tab
  await page.evaluate(() => [...document.querySelectorAll(".pmo-tabs button")].find(b => b.textContent.trim() === "Activities")?.click());
  await new Promise(r => setTimeout(r, 700));
  await scrollMain(400);
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/03-activities.png` });
  await scrollMain(1100);
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/04-milestone-details.png` });

  // Risks & Issues tab
  await scrollMain(0);
  await page.evaluate(() => [...document.querySelectorAll(".pmo-tabs button")].find(b => b.textContent.trim() === "Risks & Issues")?.click());
  await new Promise(r => setTimeout(r, 700));
  await scrollMain(350);
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/05-riskmatrix.png` });
  await scrollMain(1200);
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/06-register-issues.png` });

  console.log(errors.length ? "ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
