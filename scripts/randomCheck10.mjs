// ランダム10件選定 + Playwright iPhone 390x844 で8項目チェック
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DEST_JSON = path.join(ROOT, 'data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DEST_JSON, 'utf-8'));

const SAMPLE_N = 10;
// 完全ランダム
function pickRandom(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const picked = pickRandom(dests, SAMPLE_N);
console.log('[picked]', picked.map(d => `${d.id}(${d.name})`).join(', '));

const BASE = process.env.BASE_URL || 'http://localhost:4173';

const viewport = { width: 390, height: 844 };
const ua = devices['iPhone 14'].userAgent;

const results = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport,
  userAgent: ua,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

for (const d of picked) {
  const url = `${BASE}/destinations/${d.id}.html`;
  const r = {
    id: d.id, name: d.name, url,
    httpOk: false,
    imageOk: false,
    descLen: 0,
    descOk: false,
    spotsCount: 0,
    spotsOk: false,
    hotelButtonOk: false,
    rentalCarOk: false,
    nearbyOk: false,
    accessOk: false,
    objectObjectFound: false,
    consoleErrors: [],
    note: '',
  };
  try {
    const consoleMsgs = [];
    page.removeAllListeners('console');
    page.on('console', m => { if (m.type() === 'error') consoleMsgs.push(m.text()); });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    r.httpOk = resp && resp.ok();
    r.consoleErrors = consoleMsgs;

    // 1. ヒーロー画像
    const heroImg = page.locator('.dest-hero-img, img').first();
    try {
      await heroImg.waitFor({ timeout: 5000 });
      const w = await heroImg.evaluate(el => el.naturalWidth || (el.complete ? 1000 : 0));
      const src = await heroImg.getAttribute('src');
      r.imageOk = (w > 100) && !!src;
      r.imageSrc = src;
    } catch { r.imageOk = false; }

    // 2. description 200字以上 (article.lead と dest.description の合算)
    const leadTexts = await page.locator('.lead, .dest-description').allTextContents();
    const totalDesc = leadTexts.map(t => (t || '').trim()).join('\n');
    r.descLen = totalDesc.length;
    r.descOk = r.descLen >= 200;

    // 3. spots 2件以上 (spot-title が h3)
    const spotsCount = await page.locator('.spot-title, .spot-content').count();
    r.spotsCount = spotsCount;
    r.spotsOk = spotsCount >= 2;

    // 4. 宿ボタン (楽天 + じゃらん)
    const rakutenHotel = await page.locator('.hotel-section a[href*="rakuten"], .hotel-card-rakuten').count();
    const jalanHotel = await page.locator('.hotel-section a[href*="jalan"], .hotel-card-jalan').count();
    r.hotelButtonOk = rakutenHotel > 0 && jalanHotel > 0;
    r.rakutenHotel = rakutenHotel; r.jalanHotel = jalanHotel;

    // 5. レンタカー (rentacar-section / rentacar-card)
    const carCount = await page.locator('.rentacar-section, .rentacar-card').count();
    r.rentalCarOk = carCount > 0;

    // 6. 近くの旅先カード
    const nearbyCount = await page.locator('.nearby-card').count();
    r.nearbyOk = nearbyCount > 0;

    // 7. アクセスセクション
    const accessCount = await page.locator('.access-section').count();
    r.accessOk = accessCount > 0;

    // 8. [object Object] が無いか
    const bodyText = await page.locator('body').innerText();
    r.objectObjectFound = bodyText.includes('[object Object]');

  } catch (e) {
    r.note = String(e.message || e);
  }
  results.push(r);
  console.log(JSON.stringify(r));
}

await browser.close();

// Summary
const fail = results.filter(r =>
  !r.httpOk || !r.imageOk || !r.descOk || !r.spotsOk ||
  !r.hotelButtonOk || !r.rentalCarOk || !r.nearbyOk || !r.accessOk ||
  r.objectObjectFound
);
console.log('\n=== SUMMARY ===');
console.log('total:', results.length, 'fail:', fail.length);
fail.forEach(f => {
  const issues = [];
  if (!f.httpOk) issues.push('HTTP');
  if (!f.imageOk) issues.push('IMG');
  if (!f.descOk) issues.push(`DESC(${f.descLen})`);
  if (!f.spotsOk) issues.push(`SPOTS(${f.spotsCount})`);
  if (!f.hotelButtonOk) issues.push('HOTEL');
  if (!f.rentalCarOk) issues.push('CAR');
  if (!f.nearbyOk) issues.push('NEARBY');
  if (!f.accessOk) issues.push('ACCESS');
  if (f.objectObjectFound) issues.push('OBJECT');
  console.log(` - ${f.id} (${f.name}): ${issues.join(', ')}`);
});

fs.writeFileSync(path.join(ROOT, 'logs/randomCheck10.json'), JSON.stringify({ picked: picked.map(p=>p.id), results }, null, 2));
console.log('saved logs/randomCheck10.json');
process.exit(fail.length ? 1 : 0);
