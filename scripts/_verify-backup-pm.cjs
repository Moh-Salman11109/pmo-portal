// Backup-PM flow, end to end as admin + both PMs:
//  1. admin opens Edit Fields on P001 → sees "PM Email" + "Backup PM Email"
//     as two separate inputs, pre-split from the stored comma value
//  2. edits the backup field, saves → both PMs still see the project
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "http://localhost:5199/";
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/gantt-redesign";

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1100 });

  // ── Admin: open the edit form for P001
  await page.evaluateOnNewDocument(e => localStorage.setItem("pmo_mock_email", e), "admin@pmo.test");
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("All Projects"))?.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Edit Fields")?.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const fields = await page.evaluate(() => {
    const get = (label) => {
      const lbl = [...document.querySelectorAll("label, div")].find(e => e.childElementCount === 0 && e.textContent.trim() === label);
      const wrap = lbl?.closest("div")?.parentElement;
      return wrap?.querySelector("input")?.value ?? null;
    };
    return { pm: get("PM Email"), backup: get("Backup PM Email") };
  });
  console.log("form fields:", JSON.stringify(fields));

  // Screenshot the two fields area
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find(i => i.placeholder && i.placeholder.includes("away"));
    el?.scrollIntoView({ block: "center" });
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}/backup-pm-form.png` });

  // ── Edit the backup email and save
  await page.evaluate(() => {
    const input = [...document.querySelectorAll("input")].find(i => i.placeholder && i.placeholder.includes("away"));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "pm.digital@pmo.test");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].reverse().find(b => /Save|Update Project/i.test(b.textContent))?.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  console.log("saved via form");

  // ── Both PMs must still see P001 (mock state resets per reload, so this
  //    re-checks the stored comma value path, not the in-session edit)
  for (const email of ["pm.strategy@pmo.test", "pm.digital@pmo.test"]) {
    await page.evaluateOnNewDocument(e => localStorage.setItem("pmo_mock_email", e), email);
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise(r => setTimeout(r, 2000));
    const sees = await page.evaluate(() => document.body.innerText.includes("PMO Transformation"));
    console.log(email, "sees P001:", sees);
  }

  await browser.close();
})();
