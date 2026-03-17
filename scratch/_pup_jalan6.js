'use strict';
// Test Jalan uwp2011 with Shift-JIS encoded keyword
const puppeteer = require('puppeteer');
const iconv = require('iconv-lite');

function encodeShiftJIS(str) {
  const buf = iconv.encode(str, 'Shift_JIS');
  let encoded = '';
  for (const byte of buf) {
    encoded += '%' + byte.toString(16).padStart(2, '0').toUpperCase();
  }
  return encoded;
}

function jalanUrl(kw) {
  return 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeShiftJIS(kw);
}

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  const tests = [
    { kw: '神奈川県 鎌倉市' },
    { kw: 'XYZXYZ99999' },
    { kw: '沖縄県 石垣市' },
    { kw: '沖縄県 座間味村' },
    { kw: '群馬県 草津町' },
  ];

  for (const { kw } of tests) {
    const url = jalanUrl(kw);
    console.log('\nTesting:', kw, '→', url.substring(0, 100));
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      const title = await page.title().catch(() => '');
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const countMatch = bodyText.match(/([0-9,]+)\s*件/g);
      const hasError = bodyText.includes('見つかりませんでした') || bodyText.includes('該当する宿がありません');
      const hasHotels = bodyText.includes('円') && (bodyText.includes('泊') || bodyText.includes('ホテル'));
      console.log('  title:', title.substring(0, 80));
      console.log('  件:', countMatch ? countMatch.slice(0, 5).join(', ') : 'none');
      console.log('  hasError:', hasError, '| hasHotels:', hasHotels);
      await page.screenshot({ path: `docs/j6_${kw.replace(/[^\w]/g, '_')}.png` });
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
  }

  await browser.close();
}

test().catch(e => console.error(e.message));
