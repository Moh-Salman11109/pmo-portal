const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1050 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("pmo_mock_email", "admin@pmo.test"));
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle2", timeout: 40000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-sidebar button")].find(b => b.textContent.includes("All Projects"))?.click();
  });
  await new Promise(r => setTimeout(r, 700));
  await page.evaluate(() => {
    const td = [...document.querySelectorAll("td")].find(e => e.textContent.includes("PMO Transformation"));
    (td?.closest("tr") || td)?.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    [...document.querySelectorAll(".pmo-tabs button")].find(b => b.textContent.trim() === "Activities")?.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h3")].find(e => e.textContent === "Milestone Details");
    h?.scrollIntoView({ block: "start" });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: "C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/visual-polish/11-milestone-details.png" });
  const pills = await page.evaluate(() => document.body.innerText.match(/Overdue · \w+/g) || []);
  console.log("combined pills:", JSON.stringify(pills.slice(0, 4)));
  await browser.close();
})();
