const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const htmlPath = 'file:///C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/PMO-Portal-Handover.html';
  console.log('Loading:', htmlPath);
  await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 1200));
  const outPdf = 'C:/Users/nioh1/Desktop/PMO-Portal-Deliverables/PMO-Portal-Handover.pdf';
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await browser.close();
  console.log('PDF written:', outPdf);
})();
