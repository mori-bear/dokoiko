'use strict';
// Quick probe to find distinguishing markers between results/no-results/top-page
// for both Rakuten and Jalan
const puppeteer = require('puppeteer');

async function probe(tests) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  for (const { label, url } of tests) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      const finalUrl = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const countMatch = bodyText.match(/([0-9,]+)\s*件/g);
      const lines = bodyText.split('\n').filter(l => l.trim()).slice(0, 30);
      console.log(`\n=== ${label} ===`);
      console.log('final URL:', finalUrl.substring(0, 100));
      console.log('件 patterns:', countMatch ? countMatch.slice(0, 5) : 'none');
      console.log('first lines:', lines.slice(0, 10).join(' | '));
    } catch (e) {
      console.log(`\n=== ${label} === ERROR: ${e.message}`);
    }
  }
  await browser.close();
}

probe([
  { label: 'Rakuten valid (鎌倉市)', url: 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=' + encodeURIComponent('神奈川県 鎌倉市') },
  { label: 'Rakuten zero (XYZXYZ)', url: 'https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=XYZXYZ99999' },
  { label: 'Jalan valid (鎌倉市)',   url: 'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市') },
  { label: 'Jalan zero (XYZXYZ)',   url: 'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=XYZXYZ99999' },
]).catch(e => console.error(e.message));
