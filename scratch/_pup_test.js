'use strict';
const puppeteer = require('puppeteer');

async function testRakuten(kw) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  try {
    const url = 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=' + encodeURIComponent(kw);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const countMatch = bodyText.match(/([0-9,]+)\s*件/);
    const count = countMatch ? countMatch[0] : null;
    const hasHotel = bodyText.includes('宿泊施設') || bodyText.includes('ホテル') || bodyText.includes('旅館');
    const isTop = !finalUrl.includes('kw.travel');
    console.log(JSON.stringify({ kw, finalUrl: finalUrl.substring(0,80), count, hasHotel, isTop }));
  } finally {
    await browser.close();
  }
}

testRakuten('神奈川県 鎌倉市').catch(e => console.error(e.message));
