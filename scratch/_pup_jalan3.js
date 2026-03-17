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

  // Intercept navigation to capture the search result URL
  const urls = [];
  page.on('response', res => {
    const u = res.url();
    if (u.includes('jalan.net') && !u.includes('static') && !u.includes('.js') && !u.includes('.css') && !u.includes('.png') && !u.includes('.gif')) {
      urls.push(`${res.status()} ${u.substring(0, 120)}`);
    }
  });

  // Go to jalan hotel search top
  const searchUrl = 'https://www.jalan.net/yado/yadosearch/';
  console.log('Testing hotel search page:', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Final URL:', page.url());
  console.log('Title:', await page.title().catch(() => ''));

  // Try another likely URL
  const urls2 = [
    'https://www.jalan.net/yado/search/result/?keyword=' + encodeURIComponent('鎌倉'),
    'https://www.jalan.net/hotel/search/?keyword=' + encodeURIComponent('鎌倉'),
    'https://www.jalan.net/uw/uwp3000/uww3001.do?stayMonth=3&stayDay=15&stayNight=1&adultNum=2&keyword=' + encodeURIComponent('鎌倉'),
  ];

  for (const u of urls2) {
    console.log('\nTrying:', u.substring(0, 100));
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {});
    await new Promise(r => setTimeout(r, 1500));
    console.log('→ Final:', page.url().substring(0, 100));
    console.log('  Title:', (await page.title().catch(() => '')).substring(0, 60));
  }

  // Take screenshot of last page
  await page.screenshot({ path: 'docs/jalan_search2.png' });

  // Print all captured URLs
  console.log('\n--- All Jalan requests ---');
  urls.slice(-20).forEach(u => console.log(u));

  await browser.close();
}

findJalanFormat().catch(e => console.error(e.message));
