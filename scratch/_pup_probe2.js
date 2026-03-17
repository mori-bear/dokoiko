'use strict';
const puppeteer = require('puppeteer');

async function probe() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });

  // Rakuten: wait for result list to appear
  const rUrl = 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=' + encodeURIComponent('神奈川県 鎌倉市');
  await page.goto(rUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000)); // extra wait for JS

  const rText = await page.evaluate(() => document.body.innerText);
  const rCount = rText.match(/([0-9,]+)\s*件/g);
  const rHtml = await page.evaluate(() => document.body.innerHTML);

  console.log('=== Rakuten ===');
  console.log('件patterns:', rCount);
  // Find hotel-related elements
  const rHotelEls = await page.$$eval('[class*="hotel"], [class*="yado"], [class*="lst"]', els => els.slice(0,3).map(e => e.className + ':' + e.tagName)).catch(() => []);
  console.log('hotel elements:', rHotelEls);
  // Look for list items
  const rLis = await page.$$eval('ul li a', els => els.slice(0,10).map(e => e.textContent.trim().substring(0,30))).catch(() => []);
  console.log('li links:', rLis);

  // Jalan
  const jUrl = 'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市');
  await page.goto(jUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  const jText = await page.evaluate(() => document.body.innerText);
  const jCount = jText.match(/([0-9,]+)\s*件/g);
  console.log('\n=== Jalan ===');
  console.log('件patterns:', jCount ? jCount.slice(0,5) : null);
  const jHotelEls = await page.$$eval('[class*="hotel"], [class*="yado"], .lst_hotel', els => els.slice(0,3).map(e => e.className + ':' + e.tagName)).catch(() => []);
  console.log('hotel elements:', jHotelEls);
  // Check for specific jalan result markers
  const jRslt = await page.$('.searchResult, #searchResult').catch(() => null);
  console.log('searchResult el:', jRslt ? 'found' : 'not found');

  // Take a screenshot to see what's showing
  await page.screenshot({ path: 'docs/jalan_test.png' });
  console.log('screenshot saved to docs/jalan_test.png');

  await browser.close();
}

probe().catch(e => console.error(e.message));
