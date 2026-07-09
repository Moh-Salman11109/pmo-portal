// Re-run the user's IPI Calculator scenario under the new engine:
// Start 07/01, Planned End 07/30, Roadmap 08/15, As-of 08/05, Progress 100,
// Budget 100, Actual 100, Gate 4, 2 required docs, 2 approved.
// Expected (Option C): SPI 0.829, IPI 91 "Watch", not 110.
const puppeteer = require("puppeteer");
const fs = require("fs");
const OUT = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/ipi-scenario";

const setVal = (el, v) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
};

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 250)));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2400));
  await page.evaluate(() => [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("What-If"))?.click());
  await new Promise(r => setTimeout(r, 600));
  await page.evaluate(() => {
    const card = [...document.querySelectorAll("div")].reverse().find(d => d.textContent.trim() === "IPI Calculator" && d.style.fontWeight);
    (card?.parentElement?.parentElement || card)?.click();
  });
  await new Promise(r => setTimeout(r, 700));

  const fill = await page.evaluate((setValStr) => {
    const s = eval(`(${setValStr})`);
    const inputs = [...document.querySelectorAll("input")];
    const dates = inputs.filter(i => i.type === "date");        // start, plannedEnd, roadmap, asOf
    const nums  = inputs.filter(i => i.type !== "date");        // progress, plannedProgress, budget, actualCost, req, approved
    // Breach scenario: plannedEnd (30 Aug) AFTER roadmap (30 Jul); finish 25 Aug.
    s(dates[0], "2026-07-01"); s(dates[1], "2026-08-30"); s(dates[2], "2026-07-30"); s(dates[3], "2026-08-25");
    s(nums[0], "100");   // actual progress
    // nums[1] = planned progress → leave blank (auto)
    s(nums[2], "22"); s(nums[3], "22");   // budget, actual cost
    s(nums[4], "2"); s(nums[5], "2");        // required, approved
    const sel = document.querySelector("select"); if (sel) s(sel, "Gate 4");
    return { dates: dates.length, nums: nums.length };
  }, setVal.toString());
  console.log("filled:", JSON.stringify(fill));
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Calculate IPI/.test(b.textContent))?.click());
  await new Promise(r => setTimeout(r, 700));

  const result = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      hasOverAchieved: t.includes("Over Achieved"),
      hasWatch: t.includes("Watch"),
      hasOnTrack: t.includes("On Track"),
      hasCritical: t.includes("Critical"),
      snippet: t.replace(/\s+/g, " ").slice(0, 600),
    };
  });
  console.log("result flags:", JSON.stringify({ Watch: result.hasWatch, OnTrack: result.hasOnTrack, OverAchieved: result.hasOverAchieved }));
  console.log("panel text:", result.snippet);
  await page.screenshot({ path: `${OUT}/calc-scenario.png` });
  console.log(errors.length ? "ERRORS: " + errors.join(" ;; ") : "no page errors");
  await browser.close();
})();
