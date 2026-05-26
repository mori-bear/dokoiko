// 全destinationsの上部 600px を Playwright で並列キャプチャし
// /tmp/gallery.html に 4列グリッドでまとめる。
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DEST = path.join(ROOT, 'data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DEST, 'utf-8'));
const SHOTS_DIR = '/tmp/gallery_shots';
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const PUBLIC_BASE = process.env.PUBLIC_BASE || 'https://tabidokoiko.com';
const CONCURRENCY = Number(process.env.CONC || 10);
const VIEWPORT = { width: 390, height: 844 };
const CLIP = { x: 0, y: 0, width: 390, height: 600 };

console.log(`shots: ${dests.length} pages, concurrency=${CONCURRENCY}`);

const browser = await chromium.launch({ headless: true });

let idx = 0;
let done = 0;
let failed = [];
const startTs = Date.now();

async function worker(id) {
  const ctx = await browser.newContext({
    ...devices['iPhone 14'],
    viewport: VIEWPORT,
  });
  const page = await ctx.newPage();
  while (idx < dests.length) {
    const i = idx++;
    const d = dests[i];
    const out = path.join(SHOTS_DIR, `${d.id}.png`);
    // skip if exists & non-empty
    try {
      const st = fs.statSync(out);
      if (st.size > 2000) { done++; if (done % 50 === 0) log(); continue; }
    } catch {}
    const url = `${BASE}/destinations/${encodeURIComponent(d.id)}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      // ヒーロー画像があれば読み込み待ち
      try { await page.locator('.dest-hero-img').first().waitFor({ state: 'visible', timeout: 3000 }); } catch {}
      // 念のため少し待つ (lazy CSS)
      await page.waitForTimeout(150);
      await page.screenshot({ path: out, clip: CLIP, type: 'png' });
    } catch (e) {
      failed.push({ id: d.id, error: String(e.message || e) });
    }
    done++;
    if (done % 50 === 0) log();
  }
  await ctx.close();
}

function log() {
  const el = ((Date.now() - startTs) / 1000).toFixed(1);
  const rate = (done / Math.max(1, Number(el))).toFixed(1);
  console.log(`[${done}/${dests.length}] ${el}s rate=${rate}/s failed=${failed.length}`);
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, k) => worker(k)));
await browser.close();
log();

// HTML gallery
const items = dests.map(d => {
  const png = `gallery_shots/${d.id}.png`;
  const exists = fs.existsSync(path.join(SHOTS_DIR, `${d.id}.png`));
  return { id: d.id, name: d.name, prefecture: d.prefecture || '', exists, png };
});
const okCount = items.filter(i => i.exists).length;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>どこ行こ？ 全 ${dests.length} destination ギャラリー</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif; margin: 0; background: #f5f5f5; color: #222; }
  header { padding: 16px 24px; background: #fff; border-bottom: 1px solid #e5e5e5; position: sticky; top: 0; z-index: 10; }
  h1 { margin: 0; font-size: 18px; }
  .summary { font-size: 13px; color: #666; margin-top: 4px; }
  .search { margin-top: 8px; }
  .search input { width: 280px; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 20px; }
  @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 800px)  { .grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 480px)  { .grid { grid-template-columns: 1fr; } }
  .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden; text-decoration: none; color: inherit; display: block; transition: transform .15s, box-shadow .15s; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
  .card img { width: 100%; height: auto; display: block; aspect-ratio: 390 / 600; background: #eee; object-fit: cover; }
  .card .body { padding: 10px 12px; }
  .card .name { font-size: 14px; font-weight: 500; margin: 0 0 4px; }
  .card .pref { font-size: 12px; color: #888; margin: 0; }
  .missing { opacity: 0.4; }
  .missing img { background: repeating-linear-gradient(45deg, #eee, #eee 8px, #f5f5f5 8px, #f5f5f5 16px); }
</style>
</head>
<body>
<header>
  <h1>どこ行こ？ 全 ${dests.length} destination ギャラリー</h1>
  <div class="summary">スクショ生成済: ${okCount}/${dests.length} ・ クリックで本番ページへ</div>
  <div class="search"><input id="q" type="search" placeholder="名前または都道府県で絞り込み" autocomplete="off"></div>
</header>
<div class="grid" id="grid">
${items.map(it => `  <a class="card${it.exists ? '' : ' missing'}" href="${PUBLIC_BASE}/destinations/${it.id}/" target="_blank" rel="noopener" data-name="${it.name}" data-pref="${it.prefecture}">
    <img loading="lazy" src="${it.png}" alt="${it.name}">
    <div class="body">
      <p class="name">${it.name}</p>
      <p class="pref">${it.prefecture}</p>
    </div>
  </a>`).join('\n')}
</div>
<script>
  const q = document.getElementById('q');
  const cards = Array.from(document.querySelectorAll('.card'));
  q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    cards.forEach(c => {
      const hay = (c.dataset.name + ' ' + c.dataset.pref).toLowerCase();
      c.style.display = (!v || hay.includes(v)) ? '' : 'none';
    });
  });
</script>
</body>
</html>
`;
fs.writeFileSync('/tmp/gallery.html', html);

console.log(`\nSummary:`);
console.log(`  shots ok: ${okCount}/${dests.length}`);
console.log(`  failed:   ${failed.length}`);
if (failed.length) {
  fs.writeFileSync('/tmp/gallery_failed.json', JSON.stringify(failed, null, 2));
  console.log('  see /tmp/gallery_failed.json');
}
console.log(`  gallery:  /tmp/gallery.html`);
