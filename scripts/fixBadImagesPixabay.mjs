// imageAudit.json で NG と判定された destination の hero 画像を
// Pixabay で再取得し dokoiko-site/public/images/{id}/main.jpg を上書き。
// フォールバック: 取得失敗時はそのまま (画像は触らない)
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const SITE_ROOT = '/Users/moririn/MORI-LAB/projects/dokoiko-site';
const IMG_DIR = path.join(SITE_ROOT, 'public/images');
const AUDIT = path.join(process.cwd(), 'logs/imageAudit.json');
const DEST_JSON = path.join(SITE_ROOT, 'src/data/destinations.json');

const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf-8'));
const dests = JSON.parse(fs.readFileSync(DEST_JSON, 'utf-8'));
const destMap = new Map(dests.map(d => [d.id, d]));

const NG_KEYS = ['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top'];
const ng = audit.results.filter(r => NG_KEYS.some(k => r[k])).filter(r => destMap.has(r.id));

const reasonMap = new Map(ng.map(r => [r.id, NG_KEYS.filter(k => r[k]).join(',')]));

console.log(`NG candidates: ${ng.length}`);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++; if (hops>5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let b=''; res.setEncoding('utf-8');
        res.on('data', c=>b+=c); res.on('end', ()=>resolve(b));
      }).on('error', reject);
    }
    go(url);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++; if (hops>5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on('finish', () => f.close(()=>resolve()));
        f.on('error', reject);
      }).on('error', reject);
    }
    go(url);
  });
}
async function pixabay(q, opts = {}) {
  const params = new URLSearchParams({
    key: PIXABAY_KEY, q, image_type: 'photo', lang: 'ja',
    per_page: '5', safesearch: 'true', orientation: 'horizontal',
    ...opts,
  });
  try {
    const body = await get(`https://pixabay.com/api/?${params.toString()}`);
    const j = JSON.parse(body);
    return (j?.hits || []).map(h => h.largeImageURL || h.webformatURL).filter(Boolean);
  } catch (e) { return []; }
}

let ok = 0, fail = 0;
const log = [];
const startTs = Date.now();
for (let i = 0; i < ng.length; i++) {
  const r = ng[i];
  const d = destMap.get(r.id);
  if (!d) { fail++; continue; }
  const prefShort = (d.prefecture || '').replace(/[県府都]$/, '');
  const queries = [
    `${d.name} 観光 風景`,
    `${d.name} ${prefShort}`,
    d.name,
    prefShort ? `${prefShort} 観光` : null,
  ].filter(Boolean);
  let chosen = null, queryUsed = null;
  for (const q of queries) {
    const hits = await pixabay(q);
    if (hits.length) {
      // pick the first hit
      chosen = hits[0]; queryUsed = q; break;
    }
    await new Promise(rs => setTimeout(rs, 300));
  }
  if (!chosen) { fail++; log.push({ id: r.id, ok: false, reason: 'NO_HITS', ngReasons: reasonMap.get(r.id) }); continue; }
  const folder = path.join(IMG_DIR, d.id);
  fs.mkdirSync(folder, { recursive: true });
  const dst = path.join(folder, 'main.jpg');
  // backup
  const bak = dst + '.bak';
  try { if (fs.existsSync(dst) && !fs.existsSync(bak)) fs.copyFileSync(dst, bak); } catch {}
  try {
    await download(chosen, dst);
    const sz = fs.statSync(dst).size;
    if (sz < 5000) {
      // restore
      if (fs.existsSync(bak)) fs.copyFileSync(bak, dst);
      fail++; log.push({ id: r.id, ok: false, reason: 'TOO_SMALL', size: sz, queryUsed, ngReasons: reasonMap.get(r.id) }); continue;
    }
    ok++;
    log.push({ id: r.id, ok: true, queryUsed, src: chosen, size: sz, ngReasons: reasonMap.get(r.id) });
  } catch (e) {
    if (fs.existsSync(bak)) fs.copyFileSync(bak, dst);
    fail++; log.push({ id: r.id, ok: false, reason: String(e.message || e).slice(0,120), queryUsed, ngReasons: reasonMap.get(r.id) });
  }
  if ((i+1) % 20 === 0) {
    const el = ((Date.now()-startTs)/1000).toFixed(1);
    console.log(`[${i+1}/${ng.length}] ${el}s ok=${ok} fail=${fail}`);
  }
}
const el = ((Date.now()-startTs)/1000).toFixed(1);
console.log(`DONE ${el}s ok=${ok} fail=${fail}`);
fs.writeFileSync(path.join(process.cwd(), 'logs/fixBadImages.json'), JSON.stringify({ ok, fail, log }, null, 2));
console.log('saved logs/fixBadImages.json');
