'use strict';
const puppeteer = require('puppeteer');

async function findJalanFormat() {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  // Go to Jalan top and do a keyword search
  console.log('Going to Jalan top...');
  await page.goto('https://www.jalan.net/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: 'docs/jalan_top.png' });

  // Try searching from the search box
  // Look for search input
  const inputs = await page.$$eval('input[type="text"], input[name*="keyword"], input[placeholder*="地域"]',
    els => els.map(e => ({ name: e.name, id: e.id, placeholder: e.placeholder, type: e.type }))
  ).catch(() => []);
  console.log('Inputs found:', inputs.slice(0, 5));

  // Navigate to a known working search
  // Jalan's list search URL format
  const candidates = [
    'https://www.jalan.net/uw/uwp1000/uww1001.do?keyword=' + encodeURIComponent('鎌倉'),
    'https://www.jalan.net/yad/search/?keyword=' + encodeURIComponent('神奈川県 鎌倉市'),
    'https://www.jalan.net/yad000000/search/?keyword=' + encodeURIComponent('神奈川県 鎌倉市'),
    'https://www.jalan.net/uw/uwp3000/uww3001.do?areaId=14&kenId=14',
  ];

  for (const url of candidates) {
    console.log('\nTrying:', url.substring(0, 80));
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(e => console.log('error:', e.message));
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const countMatch = bodyText.match(/([0-9,]+)\s*件/g);
    console.log('Final URL:', finalUrl.substring(0, 100));
    console.log('件 patterns:', countMatch ? countMatch.slice(0, 3) : 'none');
    const hasHotel = bodyText.includes('ホテル') && bodyText.includes('円');
    console.log('hasHotel:', hasHotel);
  }

  await page.screenshot({ path: 'docs/jalan_search.png' });
  await browser.close();
}

findJalanFormat().catch(e => console.error(e.message));
