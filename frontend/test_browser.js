const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error));

  try {
    await page.goto("http://localhost:3000/results", { waitUntil: "networkidle0" });
    console.log("Page loaded.");
  } catch (e) {
    console.log("Error loading page:", e.message);
  }
  
  await browser.close();
})();
