'use strict';
// Navigate from Jalan top page and use the search form
const puppeteer = require('puppeteer');

async function findJalanFormat() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  // Capture all navigation events
  const navUrls = [];
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navUrls.push(frame.url().substring(0, 150));
    }
  });

  // Go to Jalan top
  await page.goto('https://www.jalan.net/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'docs/j1_top.png' });
  console.log('Top page loaded:', page.url());

  // Find the hotel search form
  const searchInput = await page.$('input[name="keyword"], input[placeholder*="地名"], input[placeholder*="宿名"]').catch(() => null);
  console.log('Search input found:', searchInput ? 'yes' : 'no');

  if (searchInput) {
    await searchInput.type('鎌倉');
    await page.screenshot({ path: 'docs/j2_typed.png' });
    // Submit the form
    const form = await searchInput.evaluateHandle(el => el.closest('form'));
    if (form) {
      await page.evaluate(f => f.submit(), form);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      console.log('After search URL:', page.url());
    }
  }

  await page.screenshot({ path: 'docs/j3_result.png' });
  console.log('All navigations:', navUrls);
  await browser.close();
}

findJalanFormat().catch(e => console.error(e.message));
