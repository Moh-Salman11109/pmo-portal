// Live check: admin → All Projects → open first project → Actions tab.
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
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2500));
  const step = async (label, fn) => { const ok = await page.evaluate(fn); console.log(label, ok ? "OK" : "FAIL"); await new Promise(r => setTimeout(r, 900)); return ok; };
  await step("nav All Projects:", () => { const el = [...document.querySelectorAll("*")].find(e => e.textContent === "All Projects" && e.children.length === 0); if (!el) return false; el.closest("[style]").click(); return true; });
  await step("open PMO Transformation:", () => { const el = [...document.querySelectorAll("td,div,span")].find(e => e.children.length === 0 && e.textContent.trim() === "PMO Transformation"); if (!el) return false; el.click(); return true; });
  await step("click Actions tab:", () => { const el = [...document.querySelectorAll("button,div,span")].find(e => e.children.length === 0 && e.textContent.trim() === "Actions"); if (!el) return false; el.click(); return true; });
  await page.screenshot({ path: `${OUT}/actions-tab.png` });
  console.log(errors.length ? "PAGE ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
