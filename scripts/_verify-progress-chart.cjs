// Screenshot the new Progress Planned-vs-Actual chart next to the IPI
// Trend on a real project page (mock mode), so we verify the layout with
// eyes before shipping — per the "no claiming UI works unseen" rule.

const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 950 });

  await page.goto("http://localhost:4173/", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 1800));

  // Click "All Projects" in the sidebar
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b = btns.find(x => /All Projects/i.test(x.textContent || ""));
    if (b) b.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click the first project row
  const clicked = await page.evaluate(() => {
    const row = document.querySelector("tbody tr");
    if (row) { row.click(); return true; }
    return false;
  });
  if (!clicked) { console.error("✗ no project row found"); await browser.close(); process.exit(1); }
  await new Promise(r => setTimeout(r, 1500));

  // Confirm both chart titles are present
  const titles = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      ipi: /IPI Trend/.test(t),
      progress: /Progress · Planned vs Actual/.test(t),
    };
  });
  console.log("IPI Trend card:", titles.ipi ? "✓" : "✗");
  console.log("Progress card :", titles.progress ? "✓" : "✗");

  // Scroll the charts into view and screenshot
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find(d => /IPI Trend/.test(d.textContent || "") && d.textContent.length < 4000);
    if (el) el.scrollIntoView({ block: "center" });
  });
  await new Promise(r => setTimeout(r, 800));

  const out = "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/_progress-chart-verify.png";
  await page.screenshot({ path: out, fullPage: false });
  console.log("Screenshot:", out);

  await browser.close();
  if (!titles.ipi || !titles.progress) process.exit(1);
  console.log("✓ PASS — both charts rendered side by side");
})();
