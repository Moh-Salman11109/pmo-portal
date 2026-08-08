// Capture real portal screenshots for the lifecycle guide.
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/AppData/Local/Temp/claude/c--Users-nioh1/1f1ccfdb-9cb4-4d07-b09c-ba1be351eb4f/scratchpad/shots";
const BASE = "http://localhost:5198/";
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function newPage(browser, email) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 950, deviceScaleFactor: 2 });
  await p.evaluateOnNewDocument((e) => localStorage.setItem("pmo_mock_email", e), email);
  await p.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await wait(2600);
  return p;
}
// Click the first element whose trimmed text CONTAINS t (handles icon siblings).
const clickText = (p, t) => p.evaluate((tt) => {
  const cands = [...document.querySelectorAll("button, a, [role=button], div, span")];
  const el = cands.find(e => e.textContent.trim() === tt) || cands.find(e => e.textContent.trim().includes(tt) && e.textContent.trim().length < tt.length + 6);
  if (el) { (el.closest("button, a, [role=button]") || el).click(); return true; } return false;
}, t);
const shot = async (p, name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); };

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const log = [];
  const a = await newPage(b, "admin@pmo.test");

  // New Request — gate journey
  log.push(["New Request", await clickText(a, "New Request")]); await wait(1400);
  await shot(a, "01-new-request");

  // Admin → + Add Project (now the full wizard). Wizard uses a stepper of labels.
  log.push(["Admin Panel", await clickText(a, "Admin Panel")]); await wait(1200);
  log.push(["Add Project", await clickText(a, "+ Add Project")]); await wait(1400);
  await shot(a, "02-add-basic");
  log.push(["Timeline", await clickText(a, "Timeline & Budget")]); await wait(900); await shot(a, "03-add-timeline");
  log.push(["Activities", await clickText(a, "Activities")]); await wait(900); await shot(a, "04-add-activities");
  log.push(["Documents", await clickText(a, "Documents")]); await wait(900); await shot(a, "05-add-documents");

  // Project view — gate progress
  await a.goto(BASE, { waitUntil: "networkidle2" }); await wait(2200);
  log.push(["All Projects", await clickText(a, "All Projects")]); await wait(1200);
  log.push(["open project", await clickText(a, "PMO Transformation")]); await wait(1500);
  await a.evaluate(() => { const el = [...document.querySelectorAll("*")].find(e => e.children.length === 0 && e.textContent.trim() === "Gate Progress"); if (el) el.scrollIntoView({ block: "start" }); window.scrollBy(0, -120); });
  await wait(700); await shot(a, "07-gate-progress");
  log.push(["Actions tab", await clickText(a, "Actions")]); await wait(1000);
  await a.evaluate(() => { const el = [...document.querySelectorAll("h3")].find(h => h.textContent === "Action Items"); if (el) el.scrollIntoView({ block: "center" }); });
  await wait(600); await shot(a, "08-actions-tab");

  // My Actions
  await a.goto(BASE, { waitUntil: "networkidle2" }); await wait(2000);
  log.push(["My Actions", await clickText(a, "My Actions")]); await wait(1400);
  await shot(a, "09-my-actions-pmo");

  // PM — Update panel
  const pm = await newPage(b, "pm.strategy@pmo.test");
  log.push(["PM open", await clickText(pm, "PMO Transformation")]); await wait(1500);
  log.push(["Update btn", await clickText(pm, "Update")]); await wait(1500);
  await shot(pm, "10-update-panel");

  console.log("nav:", JSON.stringify(log));
  console.log("files:", fs.readdirSync(OUT).filter(f => f.endsWith(".png")).join(", "));
  await b.close();
})();
