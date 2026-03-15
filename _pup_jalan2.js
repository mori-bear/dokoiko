'use strict';
const puppeteer = require('puppeteer');

async function findJalanFormat() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  const candidates = [
    // Current format (we know returns map/"該当する宿がありません")
    'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市'),
    // Jalan keyword search for hotel list
    'https://www.jalan.net/uw/uwp1000/uww1001.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市'),
    // Simpler keyword
    'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=' + encodeURIComponent('鎌倉'),
    // Another format
    'https://www.jalan.net/yado/search/?keyword=' + encodeURIComponent('鎌倉'),
  ];

  for (const url of candidates) {
    try {
      console.log('\nTesting:', url.substring(0, 100));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      const finalUrl = page.url();
      const title = await page.title().catch(() => '');
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
      const countMatch = bodyText.match(/([0-9,]+)\s*件/g);
      console.log('→', finalUrl.substring(0, 100));
      console.log('  title:', title.substring(0, 60));
      console.log('  件:', countMatch ? countMatch.slice(0, 3).join(', ') : 'none');
      console.log('  sample:', bodyText.split('\n').filter(l => l.trim()).slice(0, 5).join(' | ').substring(0, 120));
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
  }

  await browser.close();
}

findJalanFormat().catch(e => console.error(e.message));
