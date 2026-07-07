// Doc Generator end-to-end as a PM:
//  sidebar entry visible → picker → charter form (fill + IAS toggles) →
//  generated charter popup captured → back → plan form (months, phases,
//  resources) → generated plan popup captured.
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "http://localhost:5199/";
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/docgen";

const type = async (page, selector, value) => {
  await page.evaluate((sel, v) => {
    const el = document.querySelector(sel);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, selector, value);
};

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1050 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "pm.strategy@pmo.test"));

  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 250)));
  page.on("dialog", d => { console.log("DIALOG:", d.message()); d.dismiss().catch(() => {}); });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2300));

  const hasEntry = await page.evaluate(() =>
    [...document.querySelectorAll(".pmo-sidebar button")].some(b => b.textContent.includes("Doc Generator")));
  console.log("PM sees Doc Generator entry:", hasEntry);

  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("Doc Generator"))?.click();
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: `${OUT}/01-picker.png` });

  // ── Charter path
  await page.evaluate(() => {
    [...document.querySelectorAll("div")].reverse().find(d => d.textContent.trim() === "Project Charter" && d.style.fontWeight)?.parentElement?.parentElement?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Fill some fields by placeholder
  const fill = async (ph, val) => page.evaluate((p, v) => {
    const el = [...document.querySelectorAll("input, textarea")].find(e => e.placeholder === p);
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, ph, val);
  await fill("e.g. Motor Fleet Product", "Motor Fleet Product");
  await fill("Shown under the title", "Commercial fleet insurance product launch");
  await fill("Full name", "Abdulrahman Alhumaid");
  await fill("Increase X by Y\nDeliver Z by Q3", "Sell 150 policies in year one\nBreak even within 12 months");
  // IAS toggle: first question -> No
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("div")].filter(d => d.textContent.trim() === "Capitalization required?" && d.childElementCount === 0);
    const row = rows[0]?.parentElement;
    [...(row?.querySelectorAll("button") || [])].find(b => b.textContent.trim() === "No")?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/02-charter-form.png` });

  // Generate — capture popup
  let popupP = new Promise(res => browser.once("targetcreated", t => res(t.page())));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.includes("Generate Document"))?.click();
  });
  let popup = await popupP;
  await popup.setViewport({ width: 900, height: 1200 });
  await new Promise(r => setTimeout(r, 2200));
  await popup.screenshot({ path: `${OUT}/03-charter-doc.png`, fullPage: true });
  const charterCheck = await popup.evaluate(() => ({
    title: document.body.innerText.includes("Motor Fleet Product"),
    ias: document.body.innerText.includes("Capitalization required?"),
    sig: document.body.innerText.includes("Signature & date"),
  }));
  console.log("charter doc:", JSON.stringify(charterCheck));
  await page.bringToFront();
  await new Promise(r => setTimeout(r, 400));

  // ── Plan path
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "←")?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    [...document.querySelectorAll("div")].reverse().find(d => d.textContent.trim() === "Project Plan" && d.style.fontWeight)?.parentElement?.parentElement?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // name (first empty text input inside the modal), months
  const planFilled = await page.evaluate(() => {
    const set = (el, v) => {
      if (!el) return false;
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    const inputs = [...document.querySelectorAll("input")];
    const okName = set(inputs.find(i => i.type === "text" && !i.value), "Motor Fleet Product");
    const monthInputs = inputs.filter(i => i.type === "month");
    const okM1 = set(monthInputs[0], "2025-12");
    const okM2 = set(monthInputs[1], "2026-08");
    return { okName, okM1, okM2, monthCount: monthInputs.length };
  });
  console.log("plan form fill:", JSON.stringify(planFilled));
  await new Promise(r => setTimeout(r, 400));
  // phase 1 name + outputs + resource row
  await fill("Phase 1 — name", "Phase 1 — Product Design");
  await fill("Key outputs", "Pricing model, policy wording");
  await fill("Role — e.g. Developer", "Actuary");
  await fill("Name / TBD", "TBD");
  await fill("50%", "40%");
  await page.screenshot({ path: `${OUT}/04-plan-form.png` });

  popupP = new Promise(res => browser.once("targetcreated", t => res(t.page())));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => b.textContent.includes("Generate Document"))?.click();
  });
  popup = await Promise.race([popupP, new Promise((_, rej) => setTimeout(() => rej(new Error("plan popup never opened")), 8000))]);
  await popup.setViewport({ width: 900, height: 1200 });
  await new Promise(r => setTimeout(r, 2200));
  await popup.screenshot({ path: `${OUT}/05-plan-doc.png`, fullPage: true });
  const planCheck = await popup.evaluate(() => ({
    title: document.body.innerText.includes("Motor Fleet Product"),
    months: document.body.innerText.includes("Dec 25") && document.body.innerText.includes("Aug 26"),
    resource: document.body.innerText.includes("Actuary"),
    resourceSection: document.body.innerText.includes("Resource Plan"),
  }));
  console.log("plan doc:", JSON.stringify(planCheck));

  console.log(errors.length ? "PAGE ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
