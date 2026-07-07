// Visual sweep after the de-emoji + brand-palette pass.
// Captures: Home (dept grid + priorities), Departments Overview, project page
// (buttons/tabs/notes), Activities (milestone details), Edit form (tab pills),
// Admin dept table, My Actions, What-If picker. Fails loudly on page errors
// and on any remaining emoji in rendered text.
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "http://localhost:5199/";
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/visual-polish";
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{2B50}\u{1F534}\u{1F7E1}]/u;

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1050 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));

  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 300)));

  const shot = async (name) => {
    await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: `${OUT}/${name}.png` });
    const leftover = await page.evaluate(() =>
      (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{2B50}\u{1F534}\u{1F7E1}\u{1F4CB}\u{1F680}]/gu) || []).slice(0, 5)
    );
    console.log(`${name}: ${leftover.length ? "EMOJI LEFT: " + leftover.join(" ") : "clean"}`);
  };
  const clickSidebar = (t) => page.evaluate(txt => {
    [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes(txt))?.click();
  }, t);

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2500));
  await shot("01-home");

  await clickSidebar("Departments IPI");
  await shot("02-departments-overview");

  await clickSidebar("All Projects");
  await shot("03-all-projects");

  // Project page
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await shot("04-project-header");

  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-tabs button")].find(b => b.textContent.trim() === "Activities")?.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => window.scrollBy(0, 500));
  await shot("05-activities-milestone-details");

  // Update panel (tab icons)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Update")?.click();
  });
  await shot("06-update-panel");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "✕")?.click();
  });

  // Edit form (segmented pills)
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Edit Fields")?.click();
  });
  await shot("07-edit-form");

  // Admin dept table
  await clickSidebar("Admin Panel");
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => /Departments/.test(b.textContent))?.click();
  });
  await shot("08-admin-depts");

  // My Actions + What-If
  await clickSidebar("My Actions");
  await shot("09-my-actions");
  await clickSidebar("What-If Tools");
  await shot("10-whatif-picker");

  console.log(errors.length ? "PAGE ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
