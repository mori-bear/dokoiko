'use strict';
const puppeteer = require('puppeteer');

async function compare() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
  await page.setViewport({ width: 1280, height: 900 });

  const tests = [
    { label: 'uwp1700 (current)', url: 'https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市') },
    { label: 'uwp2011 (from search form)', url: 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent('神奈川県 鎌倉市') },
    { label: 'uwp2011 zero results',   url: 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=XYZXYZ99999' },
    { label: 'uwp2011 石垣市',         url: 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent('沖縄県 石垣市') },
    { label: 'uwp2011 座間味村',        url: 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent('沖縄県 座間味村') },
  ];

  for (const { label, url } of tests) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      const finalUrl = page.url();
      const title = await page.title().catch(() => '');
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const countMatch = bodyText.match(/([0-9,]+)\s*件/g);
      const hasHotelPrice = bodyText.includes('円');
      const sample = bodyText.split('\n').filter(l => l.trim()).slice(0, 8).join(' | ').substring(0, 200);
      console.log(`\n=== ${label} ===`);
      console.log('URL:', finalUrl.substring(0, 100));
      console.log('Title:', title.substring(0, 60));
      console.log('件:', countMatch ? countMatch.slice(0, 5).join(', ') : 'none');
      console.log('hasPrice(円):', hasHotelPrice);
      console.log('sample:', sample);
      await page.screenshot({ path: `docs/jalan_${label.replace(/[^a-z0-9]/gi, '_')}.png` });
    } catch (e) {
      console.log(`\n=== ${label} === ERROR: ${e.message}`);
    }
  }

  await browser.close();
}

compare().catch(e => console.error(e.message));
