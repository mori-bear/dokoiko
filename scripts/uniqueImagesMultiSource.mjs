// 重複3件以上のグループで2件目以降を Commons → Wikipedia OGP → Pixabay deep → Openverse の順に取得
// 取得後 md5 で全体重複判定、重複なら次の候補。最後まで取れなければ画像削除 (images=[])。
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const SITE_IMG = '/Users/moririn/MORI-LAB/projects/dokoiko-site/public/images';
const PUB_IMG = path.join(ROOT, 'images');
const SITE_JSON = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const PUB_JSON = path.join(ROOT, 'data/destinations.json');

const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const PREF_ROMAJI = {
  '北海道':'Hokkaido','青森県':'Aomori','岩手県':'Iwate','宮城県':'Miyagi','秋田県':'Akita','山形県':'Yamagata','福島県':'Fukushima',
  '茨城県':'Ibaraki','栃木県':'Tochigi','群馬県':'Gunma','埼玉県':'Saitama','千葉県':'Chiba','東京都':'Tokyo','神奈川県':'Kanagawa',
  '新潟県':'Niigata','富山県':'Toyama','石川県':'Ishikawa','福井県':'Fukui','山梨県':'Yamanashi','長野県':'Nagano',
  '岐阜県':'Gifu','静岡県':'Shizuoka','愛知県':'Aichi','三重県':'Mie',
  '滋賀県':'Shiga','京都府':'Kyoto','大阪府':'Osaka','兵庫県':'Hyogo','奈良県':'Nara','和歌山県':'Wakayama',
  '鳥取県':'Tottori','島根県':'Shimane','岡山県':'Okayama','広島県':'Hiroshima','山口県':'Yamaguchi',
  '徳島県':'Tokushima','香川県':'Kagawa','愛媛県':'Ehime','高知県':'Kochi',
  '福岡県':'Fukuoka','佐賀県':'Saga','長崎県':'Nagasaki','熊本県':'Kumamoto','大分県':'Oita','宮崎県':'Miyazaki','鹿児島県':'Kagoshima','沖縄県':'Okinawa',
};

const dests = JSON.parse(fs.readFileSync(PUB_JSON, 'utf-8'));
const destMap = new Map(dests.map(d => [d.id, d]));

function get(url, opts={}){
  return new Promise((res,rej)=>{
    let h=0;
    function go(u){
      h++; if(h>5) return rej(new Error('redir'));
      const req = https.get(u, { headers: { 'User-Agent': UA, 'Accept':'*/*', ...(opts.headers||{}) } }, r => {
        if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){
          r.resume(); return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString());
        }
        if(r.statusCode!==200){ r.resume(); return rej(new Error('HTTP '+r.statusCode)); }
        const chunks = []; r.on('data', c => chunks.push(c));
        r.on('end', () => res({ body: Buffer.concat(chunks), status: r.statusCode, headers: r.headers }));
      });
      req.on('error', rej);
      req.setTimeout(20000, () => { req.destroy(new Error('timeout')); });
    }
    go(url);
  });
}
async function getText(url){ const r = await get(url); return r.body.toString('utf-8'); }
async function getBinary(url){ const r = await get(url); return r.body; }

// ----- ソース -----
// Commons: search files matching query
async function commons(query, max=5){
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=${max}&srsearch=${encodeURIComponent(query)}`;
    const body = await getText(u);
    const j = JSON.parse(body);
    const titles = (j?.query?.search || []).map(s => s.title);
    if (!titles.length) return [];
    // fetch imageinfo for these titles
    const u2 = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1200&titles=${encodeURIComponent(titles.join('|'))}`;
    const body2 = await getText(u2);
    const j2 = JSON.parse(body2);
    const pages = j2?.query?.pages || {};
    const urls = [];
    for (const k of Object.keys(pages)) {
      const ii = pages[k]?.imageinfo?.[0];
      const url = ii?.thumburl || ii?.url;
      if (url && /\.(jpe?g|png|webp)$/i.test(url.split('?')[0])) urls.push(url);
    }
    return urls;
  } catch (e) { return []; }
}

// Wikipedia REST summary OGP image
async function wikipediaSummary(lang, title){
  try {
    const u = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const body = await getText(u);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch (e) { return null; }
}

// Pixabay
async function pixabay(q, page=1, per=10){
  const params = new URLSearchParams({
    key: PIXABAY_KEY, q, image_type:'photo', lang:'ja', per_page:String(per),
    safesearch:'true', orientation:'horizontal', page:String(page),
  });
  try {
    const body = await getText('https://pixabay.com/api/?' + params.toString());
    const j = JSON.parse(body);
    return (j?.hits || []).map(h => h.largeImageURL || h.webformatURL).filter(Boolean);
  } catch (e) { return []; }
}

// Openverse
async function openverse(q, page=1, per=10){
  try {
    const u = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=${per}&page=${page}&aspect_ratio=wide&license_type=commercial,modification`;
    const body = await getText(u);
    const j = JSON.parse(body);
    return (j?.results || []).map(r => r.url).filter(Boolean);
  } catch (e) { return []; }
}

// ----- 候補生成 -----
function* candidates(d) {
  const name = d.name || '';
  const pref = (d.prefecture || '').replace(/[県府都]$/,'').split(/[・,／\/]/)[0].trim();
  const prefEn = PREF_ROMAJI[d.prefecture] || (PREF_ROMAJI[d.prefecture?.split(/[・,／\/]/)[0]] || '');

  // 1. Wikimedia Commons (日本語/英語混合クエリ)
  for (const q of [
    `${name} ${pref}`,
    `${name} Japan`,
    prefEn ? `${name} ${prefEn}` : null,
    name,
    prefEn ? `${prefEn} landscape` : null,
  ].filter(Boolean)) {
    yield { source: 'commons', query: q, fn: () => commons(q, 8) };
  }
  // 2. Wikipedia OGP (ja → en)
  for (const t of [name, prefEn ? `${name} (${prefEn})` : null].filter(Boolean)) {
    yield { source: 'wiki_ja', query: t, fn: async () => { const u = await wikipediaSummary('ja', t); return u ? [u] : []; } };
  }
  if (prefEn) {
    for (const t of [`${name}`, `${name} ${prefEn}`]) {
      yield { source: 'wiki_en', query: t, fn: async () => { const u = await wikipediaSummary('en', t); return u ? [u] : []; } };
    }
  }
  // 3. Pixabay deep pages
  for (const page of [5,6,7,8]) {
    for (const q of [`${name} 観光`, `${pref} 自然 風景`, `Japan ${prefEn || pref} landscape`]) {
      yield { source: `pixabay_p${page}`, query: q, fn: () => pixabay(q, page, 15) };
    }
  }
  // 4. Openverse
  for (const q of [
    `${name} Japan`,
    prefEn ? `${prefEn} Japan` : `${pref} Japan`,
    `${name}`,
  ]) {
    yield { source: 'openverse', query: q, fn: () => openverse(q, 1, 12) };
  }
}

// ----- md5 マップ作成 -----
function md5(buf){ return crypto.createHash('md5').update(buf).digest('hex'); }
function fileMd5(p){ return md5(fs.readFileSync(p)); }

console.log('Building current md5 map...');
const idToMd5 = new Map();
const md5ToIds = new Map();
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  const h = fileMd5(f);
  idToMd5.set(d.id, h);
  const arr = md5ToIds.get(h) || []; arr.push(d.id); md5ToIds.set(h, arr);
}
const usedMd5 = new Set(idToMd5.values());
const dupGroups = Array.from(md5ToIds.entries()).filter(([_, ids]) => ids.length >= 3);
console.log(`dup groups (3+): ${dupGroups.length}`);

// 対象 = 各グループの ids[1..] (alphabetical でない、元の挿入順)
const targets = [];
for (const [h, ids] of dupGroups) {
  for (let i = 1; i < ids.length; i++) targets.push({ id: ids[i], oldMd5: h });
}
console.log(`targets to rewrite: ${targets.length}`);

// 取得試行
const tried = new Set(); // url ごとに重複 fetch 避ける
const results = [];
const startTs = Date.now();

for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  const d = destMap.get(t.id);
  if (!d) { results.push({ id: t.id, ok: false, reason: 'NO_DEST' }); continue; }
  let success = null;
  let attempts = [];
  for (const cand of candidates(d)) {
    let urls;
    try { urls = await cand.fn(); } catch { urls = []; }
    for (const url of urls) {
      if (tried.has(url)) continue;
      tried.add(url);
      try {
        const buf = await getBinary(url);
        if (!buf || buf.length < 5000) { attempts.push({ source:cand.source, q:cand.query, url, fail:'TOO_SMALL' }); continue; }
        const h = md5(buf);
        if (usedMd5.has(h)) { attempts.push({ source:cand.source, q:cand.query, url, fail:'DUP_MD5' }); continue; }
        // write
        const dst1 = path.join(SITE_IMG, d.id, 'main.jpg');
        const dst2 = path.join(PUB_IMG, d.id, 'main.jpg');
        fs.mkdirSync(path.dirname(dst1), { recursive: true });
        fs.mkdirSync(path.dirname(dst2), { recursive: true });
        fs.writeFileSync(dst1, buf);
        fs.writeFileSync(dst2, buf);
        // update md5 sets
        const prev = idToMd5.get(d.id);
        if (prev) {
          const arr = md5ToIds.get(prev) || []; const j = arr.indexOf(d.id); if (j >= 0) arr.splice(j,1);
          if (arr.length === 0) { md5ToIds.delete(prev); usedMd5.delete(prev); }
        }
        idToMd5.set(d.id, h);
        usedMd5.add(h);
        const arr2 = md5ToIds.get(h) || []; arr2.push(d.id); md5ToIds.set(h, arr2);
        success = { source: cand.source, query: cand.query, url, md5: h, size: buf.length };
        break;
      } catch (e) {
        attempts.push({ source:cand.source, q:cand.query, url, fail: String(e.message||e).slice(0,80) });
      }
    }
    if (success) break;
  }
  if (success) {
    results.push({ id: t.id, ok: true, ...success });
  } else {
    // フォールバック: 画像なし(削除) — destinations.json で images=[] にする
    const dst1 = path.join(SITE_IMG, d.id, 'main.jpg');
    const dst2 = path.join(PUB_IMG, d.id, 'main.jpg');
    try { fs.unlinkSync(dst1); } catch {}
    try { fs.unlinkSync(dst2); } catch {}
    // destinations.json update
    for (const arr of [dests]) {
      const dd = arr.find(x => x.id === d.id);
      if (dd) dd.images = [];
    }
    // remove from md5 maps
    const prev = idToMd5.get(d.id);
    if (prev) {
      const a = md5ToIds.get(prev) || []; const j = a.indexOf(d.id); if (j>=0) a.splice(j,1);
      if (a.length===0) { md5ToIds.delete(prev); usedMd5.delete(prev); }
      idToMd5.delete(d.id);
    }
    results.push({ id: t.id, ok: false, fallback: 'images=[]', attempts: attempts.slice(0,5) });
  }
  if ((i+1) % 10 === 0 || i+1 === targets.length) {
    const el = ((Date.now()-startTs)/1000).toFixed(1);
    const okN = results.filter(r=>r.ok).length;
    const failN = results.length - okN;
    console.log(`[${i+1}/${targets.length}] ${el}s ok=${okN} fail=${failN}`);
  }
}

// destinations.json 保存 (フォールバック反映)
fs.writeFileSync(SITE_JSON, JSON.stringify(dests, null, 2));
fs.writeFileSync(PUB_JSON, JSON.stringify(dests, null, 2));

// 最終 md5 重複チェック
const post = new Map();
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  const h = fileMd5(f);
  const a = post.get(h) || []; a.push(d.id); post.set(h, a);
}
const stillDup = Array.from(post.entries()).filter(([_,a])=>a.length>=2);
console.log(`POST: still dup groups (2+): ${stillDup.length}`);

fs.writeFileSync(path.join(ROOT, 'logs/uniqueImages.json'), JSON.stringify({
  attempted: targets.length,
  ok: results.filter(r=>r.ok).length,
  fail: results.filter(r=>!r.ok).length,
  results,
  finalDupGroups: stillDup.length,
  finalDupSamples: stillDup.slice(0, 20).map(([h, ids]) => ({ md5:h, ids })),
}, null, 2));
console.log('saved logs/uniqueImages.json');
