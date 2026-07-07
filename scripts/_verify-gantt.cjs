// Live verification of the executive Gantt redesign:
//  1. portal Gantt (Activities tab, P001 — has a bar w/ name inside,
//     diamonds, and two replanned dates with strikethrough)
//  2. print report popup (the CEO-facing artefact — the priority)
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "http://localhost:5199/";
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/gantt-redesign";

const clickByText = async (page, selector, text) => {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent.includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) throw new Error(`not found: "${text}" in ${selector}`);
};

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1100 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));

  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 300)));

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2500));

  // Navigate: All Projects → PMO Transformation → Activities tab
  await clickByText(page, ".pmo-sidebar button", "All Projects");
  await new Promise(r => setTimeout(r, 800));
  // Click the table ROW (innermost td) for the project — clicking an outer
  // div can land on a non-interactive wrapper.
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
    if (!td) {
      const el = [...document.querySelectorAll("div,span,a,button")].reverse()
        .find(e => e.textContent.trim() === "PMO Transformation");
      el?.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${OUT}/_nav-debug.png` });
  console.log("after row click, h1 =", await page.evaluate(() => document.querySelector("h1")?.textContent || document.title));
  const tabOk = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".pmo-tabs button")].find(b => b.textContent.trim() === "Activities");
    if (el) { el.click(); return true; }
    return false;
  });
  console.log("activities tab clicked:", tabOk);
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot the Gantt card
  const gantt = await page.evaluateHandle(() => {
    const heads = [...document.querySelectorAll("div")].filter(d => d.textContent === "Gantt Chart");
    return heads.length ? heads[heads.length - 1].parentElement.parentElement : document.body;
  });
  await gantt.asElement().screenshot({ path: `${OUT}/portal-gantt.png` });
  console.log("portal gantt captured");

  // Sanity: strikethrough dates present?
  const check = await page.evaluate(() => ({
    struck: [...document.querySelectorAll("s")].map(s => s.textContent).slice(0, 5),
    hasLegendReplan: document.body.innerText.includes("date replanned"),
    barNames: document.body.innerText.includes("Tooling Implementation"),
  }));
  console.log("portal check:", JSON.stringify(check));

  // ── Print report (the priority artefact)
  const popupPromise = new Promise(res => browser.once("targetcreated", t => res(t.page())));
  await clickByText(page, "button", "Print Report");
  const popup = await popupPromise;
  await popup.setViewport({ width: 1200, height: 850 });
  await new Promise(r => setTimeout(r, 2500));
  await popup.screenshot({ path: `${OUT}/print-report.png`, fullPage: true });
  const pcheck = await popup.evaluate(() => ({
    struck: [...document.querySelectorAll(".dt s, .head-meta s")].map(s => s.textContent).slice(0, 6),
    names: [...document.querySelectorAll(".bar-name, .out-lbl")].map(e => e.textContent.trim()).slice(0, 10),
    legend: document.body.innerText.includes("date replanned"),
  }));
  console.log("print check:", JSON.stringify(pcheck));

  if (errors.length) console.log("PAGE ERRORS:", errors.join(" ;; "));
  else console.log("no page errors");
  await browser.close();
})();
