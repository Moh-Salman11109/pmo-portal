// Fully-filled DEMO samples of the Doc Generator output (Motor Fleet),
// captured as full-page images so the user can judge the real thing.
const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE = "http://localhost:5199/";
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/docgen";

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1050 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "pm.strategy@pmo.test"));
  page.on("dialog", d => { console.log("DIALOG:", d.message()); d.dismiss().catch(() => {}); });

  const set = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype
                : el.tagName === "SELECT" ? window.HTMLSelectElement.prototype
                : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  };
  const setFn = set.toString();

  const fillPh = (ph, val) => page.evaluate((phv, v, sfn) => {
    const s = eval(`(${sfn})`);
    const el = [...document.querySelectorAll("input, textarea")].find(e => e.placeholder === phv && !e.value);
    if (el) { s(el, v); return true; } return false;
  }, ph, val, setFn);

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2300));
  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("Doc Generator"))?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // ════════ CHARTER ════════
  await page.evaluate(() => {
    [...document.querySelectorAll("div")].reverse().find(d => d.textContent.trim() === "Project Charter" && d.style.fontWeight)?.parentElement?.parentElement?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await fillPh("e.g. Motor Fleet Product", "Motor Fleet Product");
  await fillPh("Shown under the title", "Commercial fleet insurance product for SME and corporate clients");
  await fillPh("Full name", "Abdulrahman Alhumaid"); // sponsor (PM prefilled)
  // Project type -> Business Project
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const sel = [...document.querySelectorAll("select")].find(x => [...x.options].some(o => o.value === "Business Project"));
    if (sel) s(sel, "Business Project");
  }, setFn);

  // Textareas by order: purpose, objectives, scopeIn, scopeOut, businessCase, capNote, dependencies, assumptions, acceptance
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const tas = [...document.querySelectorAll("textarea")];
    const vals = [
      "Fleet operators currently have no digital direct channel for insuring commercial vehicle fleets. Brokers dominate the segment, adding commission cost and slowing quote turnaround. A direct digital fleet product opens a growing segment, meets market demand for same-day quotes, and supports the company's direct-distribution strategy.",
      "Sell 150 fleet policies in the first year (target 200)\nAverage premium of SAR 7,500 per policy\nQuote-to-bind in under 24 hours for standard fleets\nBreak even within the first policy year",
      "Fleet product design: pricing model, policy wording, underwriting rules\nDigital quote and bind journey on the existing platform\nIntegration with vehicle registration data\nClaims workflow for multi-vehicle policies\nLaunch campaign to existing SME customers",
      "Individual (retail) motor products\nCross-border fleet coverage\nTelematics-based pricing (future phase)",
      "SAR 350,000 build cost against a first-year GWP potential of ~SAR 1.5M at 200 policies. Using conservative product economics, break-even is reached at ~113 policies against a 150-policy sales floor. Full financial detail is provided in the attached Business Case.",
      "The product platform is built by an external vendor as a distinct, identifiable deliverable with separable cost — the IAS 38 recognition criteria are met and development cost is capitalized as an intangible asset.",
      "IT: integration environment and API access to the policy admin system\nFinance: approved pricing model and reinsurance treaty confirmation\nCompliance: product filing approval before go-live",
      "Regulatory approval is obtained within the planned window\nVendor delivers against the agreed statement of work\nExisting platform can host the fleet journey without re-architecture",
      "Product filed and approved by the regulator\nEnd-to-end quote → bind → policy issuance demonstrated in production\nFirst 10 policies issued and premium collected\nClaims workflow tested with a simulated multi-vehicle claim",
    ];
    tas.forEach((ta, i) => { if (vals[i]) s(ta, vals[i]); });
  }, setFn);

  // Deliverables: fill row 1 + add 2 more
  await fillPh("Deliverable", "Fleet product (live)");
  await fillPh("Description", "Approved product on the digital platform: quote, bind, issue, endorse");
  for (const [n, d] of [["Pricing & underwriting model", "Actuarial pricing model and underwriting rule set, Finance-approved"], ["Launch campaign", "Go-to-market campaign to existing SME base with sales enablement pack"]]) {
    await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Add deliverable")?.click(); });
    await new Promise(r => setTimeout(r, 200));
    await fillPh("Deliverable", n);
    await fillPh("Description", d);
  }

  // Cost + IAS answers (business product, vendor-built → capitalizable: Yes ×8)
  await fillPh("e.g. 350,000 — or 0 for internal", "350,000");
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const inputs = [...document.querySelectorAll("input")];
    const res = inputs.find(i => i.value === "Internal");
    if (res) s(res, "Internal + Vendor (platform build)");
  }, setFn);
  await fillPh("Vendor name and contact — leave empty if none", "Platform vendor selected via procurement — contact held by IT vendor management");
  await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")].filter(sp => sp.textContent.endsWith("?") || sp.textContent.startsWith("Is there") || sp.textContent.startsWith("Can the"));
    const rows = [...new Set(spans.map(sp => sp.parentElement))];
    rows.forEach(row => {
      [...row.querySelectorAll("button")].find(b => b.textContent.trim() === "Yes")?.click();
    });
  });
  await new Promise(r => setTimeout(r, 300));

  // Milestones: 6 date inputs in order + owners
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const dates = [...document.querySelectorAll("input[type=date]")].filter(d => !d.value || d.closest("div"));
    const msDates = [...document.querySelectorAll("input[type=date]")].slice(-6);
    const vals = ["2025-12-15", "2026-01-05", "2026-03-31", "2026-06-15", "2026-08-09", "2026-08-31"];
    msDates.forEach((d, i) => s(d, vals[i]));
    const owners = [...document.querySelectorAll("input")].filter(i => i.placeholder === "Owner");
    const ownerVals = ["Abdulrahman Alhumaid", "Mohammed", "Vendor + IT", "Mohammed", "Mohammed", "Abdulrahman Alhumaid"];
    owners.forEach((o, i) => s(o, ownerVals[i] || ""));
  }, setFn);

  // Risks
  await fillPh("Risk 1", "Regulatory filing takes longer than planned, delaying go-live");
  await fillPh("Mitigation", "Early engagement with the regulator; filing submitted at end of design phase");
  await fillPh("Risk 2", "Sales fall short of the 150-policy floor in year one");
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const mits = [...document.querySelectorAll("input")].filter(i => i.placeholder === "Mitigation" && !i.value);
    if (mits[0]) s(mits[0], "Pre-launch pipeline with existing SME clients; broker channel kept as fallback");
  }, setFn);

  await page.screenshot({ path: `${OUT}/06-charter-form-filled.png`, fullPage: false });

  let popupP = new Promise(res => browser.once("targetcreated", t => res(t.page())));
  await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.includes("Generate Document"))?.click(); });
  let popup = await Promise.race([popupP, new Promise((_, rej) => setTimeout(() => rej(new Error("charter popup failed")), 8000))]);
  await popup.setViewport({ width: 900, height: 1200 });
  await new Promise(r => setTimeout(r, 2200));
  await popup.screenshot({ path: `${OUT}/07-charter-sample.png`, fullPage: true });
  console.log("charter sample captured");
  await page.bringToFront();

  // ════════ PLAN ════════
  await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "←")?.click(); });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => {
    [...document.querySelectorAll("div")].reverse().find(d => d.textContent.trim() === "Project Plan" && d.style.fontWeight)?.parentElement?.parentElement?.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const inputs = [...document.querySelectorAll("input")];
    s(inputs.find(i => i.type === "text" && !i.value), "Motor Fleet Product");
    const sponsor = inputs.find(i => i.type === "text" && !i.value);
    if (sponsor) s(sponsor, "Abdulrahman Alhumaid");
    const m = inputs.filter(i => i.type === "month");
    s(m[0], "2025-12"); s(m[1], "2026-08");
  }, setFn);
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const ta = [...document.querySelectorAll("textarea")][0];
    if (ta) s(ta, "Four phases over nine months: product design first (pricing, wording, underwriting rules), then platform build by the vendor in parallel with regulatory filing, then integration and testing, closing with a controlled launch to the existing SME base. Regulatory approval and UAT completion jointly gate the go-live.");
  }, setFn);

  // Phases: fill row 1, add 3 more
  const phase = async (namePh, name, fromIdx, toIdx, outputs) => {
    await page.evaluate((sfn, phv, n, f, t, o) => {
      const s = eval(`(${sfn})`);
      const nameInput = [...document.querySelectorAll("input")].find(i => i.placeholder === phv && !i.value);
      if (!nameInput) return;
      s(nameInput, n);
      const row = nameInput.parentElement;
      const sels = [...row.querySelectorAll("select")];
      s(sels[0], String(f)); s(sels[1], String(t));
      const out = row.querySelector('input[placeholder="Key outputs"]');
      if (out) s(out, o);
    }, setFn, namePh, name, fromIdx, toIdx, outputs);
  };
  await phase("Phase 1 — name", "Phase 1 — Product Design", 0, 1, "Pricing model, policy wording, underwriting rules");
  for (const [ph, n, f, t, o] of [
    ["Phase 2 — name", "Phase 2 — Platform Build & Filing", 2, 4, "Vendor build, regulatory filing, integration APIs"],
    ["Phase 3 — name", "Phase 3 — Integration & Testing", 5, 6, "End-to-end quote/bind/issue, claims workflow, UAT"],
    ["Phase 4 — name", "Phase 4 — Launch", 7, 8, "Controlled launch, SME campaign, hypercare"],
  ]) {
    await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Add phase")?.click(); });
    await new Promise(r => setTimeout(r, 200));
    await phase(ph, n, f, t, o);
  }

  // Milestones: row 1 + add 3
  const planMs = async (name, date, criteria) => {
    await page.evaluate((sfn, n, d, c) => {
      const s = eval(`(${sfn})`);
      const nameInput = [...document.querySelectorAll("input")].find(i => i.placeholder === "Milestone" && !i.value);
      if (!nameInput) return;
      s(nameInput, n);
      const row = nameInput.parentElement;
      s(row.querySelector("input[type=date]"), d);
      s(row.querySelector('input[placeholder="Exit criteria — what makes it done?"]'), c);
    }, setFn, name, date, criteria);
  };
  await planMs("Pricing model approved", "2026-01-31", "Finance and reinsurance sign-off on the pricing model");
  for (const [n, d, c] of [
    ["Regulatory filing submitted", "2026-03-15", "Complete product file lodged with the regulator"],
    ["UAT complete", "2026-07-15", "End-to-end journey passed; zero critical defects open"],
    ["Go-Live", "2026-08-09", "First live policy issued and premium collected"],
  ]) {
    await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Add milestone")?.click(); });
    await new Promise(r => setTimeout(r, 200));
    await planMs(n, d, c);
  }

  // Resources: row 1 + add 3
  const res = async (role, name, source, alloc, period, notes) => {
    await page.evaluate((sfn, ro, n, so, a, p, no) => {
      const s = eval(`(${sfn})`);
      const roleInput = [...document.querySelectorAll("input")].find(i => i.placeholder === "Role — e.g. Developer" && !i.value);
      if (!roleInput) return;
      s(roleInput, ro);
      const row = roleInput.parentElement;
      s(row.querySelector('input[placeholder="Name / TBD"]'), n);
      s(row.querySelector("select"), so);
      s(row.querySelector('input[placeholder="50%"]'), a);
      s(row.querySelector('input[placeholder="Jan–Jun 26"]'), p);
      s(row.querySelector('input[placeholder="Notes"]'), no);
    }, setFn, role, name, source, alloc, period, notes);
  };
  await res("Product Manager", "Mohammed", "Internal", "50%", "Dec 25 – Aug 26", "Overall delivery lead");
  for (const [ro, n, so, a, p, no] of [
    ["Actuary / Pricing", "TBD (Finance)", "Internal", "40%", "Dec 25 – Feb 26", "Pricing model and reinsurance"],
    ["Platform Developers", "Vendor team", "Vendor", "100%", "Feb 26 – Jul 26", "Quote/bind journey and integrations"],
    ["Underwriter", "TBD (Technical)", "Internal", "30%", "Jan 26 – Aug 26", "Rules, referrals, UAT scenarios"],
  ]) {
    await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "+ Add resource")?.click(); });
    await new Promise(r => setTimeout(r, 200));
    await res(ro, n, so, a, p, no);
  }

  // Workstreams + assumptions
  await page.evaluate((sfn) => {
    const s = eval(`(${sfn})`);
    const ws = [...document.querySelectorAll("input")].find(i => i.placeholder === "Workstream" && !i.value);
    if (ws) {
      s(ws, "Product & Pricing");
      const row = ws.parentElement;
      s(row.querySelector('input[placeholder="Owner"]'), "Finance + Technical");
      s(row.querySelector('input[placeholder="Scope"]'), "Pricing model, wording, underwriting rules, filing");
    }
    const tas = [...document.querySelectorAll("textarea")];
    s(tas[tas.length - 1], "Regulator responds within standard SLA windows\nVendor capacity is secured for the full build window\nExisting platform hosts the journey without re-architecture\nGo-live requires regulatory approval AND UAT sign-off — the later one gates the date");
  }, setFn);

  await page.screenshot({ path: `${OUT}/08-plan-form-filled.png`, fullPage: false });

  popupP = new Promise(res2 => browser.once("targetcreated", t => res2(t.page())));
  await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent.includes("Generate Document"))?.click(); });
  popup = await Promise.race([popupP, new Promise((_, rej) => setTimeout(() => rej(new Error("plan popup failed")), 8000))]);
  await popup.setViewport({ width: 900, height: 1200 });
  await new Promise(r => setTimeout(r, 2200));
  await popup.screenshot({ path: `${OUT}/09-plan-sample.png`, fullPage: true });
  console.log("plan sample captured");

  await browser.close();
  console.log("done:", OUT);
})();
