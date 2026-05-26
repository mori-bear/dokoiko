// uniqueImages.json の finalDupSamples を再取得 (2+件 groups の2件目)
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

function get(url){ return new Promise((res,rej)=>{ let h=0; function go(u){ h++; if(h>5) return rej(new Error('redir')); const req = https.get(u, { headers: { 'User-Agent': UA, 'Accept':'*/*' } }, r => { if(r.statusCode>=300 && r.statusCode<400 && r.headers.location){ r.resume(); return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString()); } if(r.statusCode!==200){ r.resume(); return rej(new Error('HTTP '+r.statusCode)); } const chunks=[]; r.on('data',c=>chunks.push(c)); r.on('end',()=>res({body:Buffer.concat(chunks)})); }); req.on('error',rej); req.setTimeout(20000,()=>req.destroy(new Error('timeout'))); } go(url); }); }
async function getText(url){ return (await get(url)).body.toString('utf-8'); }
async function getBinary(url){ return (await get(url)).body; }
function md5(buf){ return crypto.createHash('md5').update(buf).digest('hex'); }

async function commons(query, max=10){
  try {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=${max}&srsearch=${encodeURIComponent(query)}`;
    const j = JSON.parse(await getText(u));
    const titles = (j?.query?.search || []).map(s => s.title);
    if (!titles.length) return [];
    const u2 = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1200&titles=${encodeURIComponent(titles.join('|'))}`;
    const j2 = JSON.parse(await getText(u2));
    const pages = j2?.query?.pages || {};
    const urls = [];
    for (const k of Object.keys(pages)) { const ii = pages[k]?.imageinfo?.[0]; const url = ii?.thumburl || ii?.url; if (url && /\.(jpe?g|png|webp)$/i.test(url.split('?')[0])) urls.push(url); }
    return urls;
  } catch { return []; }
}
async function wiki(lang, title){ try { const j = JSON.parse(await getText(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)); return j?.originalimage?.source || j?.thumbnail?.source || null; } catch { return null; } }
async function pixabay(q, page=1, per=15){ const p = new URLSearchParams({ key: PIXABAY_KEY, q, image_type:'photo', lang:'ja', per_page:String(per), safesearch:'true', orientation:'horizontal', page:String(page) }); try { const j = JSON.parse(await getText('https://pixabay.com/api/?' + p.toString())); return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean); } catch { return []; } }
async function openverse(q, page=1, per=12){ try { const j = JSON.parse(await getText(`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=${per}&page=${page}&aspect_ratio=wide&license_type=commercial,modification`)); return (j?.results||[]).map(r=>r.url).filter(Boolean); } catch { return []; } }

function* candidates(d){
  const name = d.name || '';
  const pref = (d.prefecture || '').replace(/[県府都]$/,'').split(/[・,／\/]/)[0].trim();
  const prefEn = PREF_ROMAJI[d.prefecture] || (PREF_ROMAJI[d.prefecture?.split(/[・,／\/]/)[0]] || '');
  // 別シード(round2 用) で違う組み合わせを試す
  for (const q of [`${name} 写真`, `${name} 観光地`, `${name} ${pref} 風景`, prefEn ? `${name} ${prefEn} photo` : null]) {
    if (!q) continue;
    yield { source:'commons', q, fn: () => commons(q, 12) };
  }
  yield { source:'wiki_ja', q:name, fn: async () => { const u = await wiki('ja', name); return u?[u]:[]; } };
  if (prefEn) yield { source:'wiki_en', q:`${name} ${prefEn}`, fn: async () => { const u = await wiki('en', `${name} ${prefEn}`); return u?[u]:[]; } };
  for (const page of [9,10,11,12,13]) {
    for (const q of [`${name}`, `${pref} 景色`, `Japan ${prefEn || pref}`]) {
      yield { source: `pixabay_p${page}`, q, fn: () => pixabay(q, page, 20) };
    }
  }
  for (const page of [2,3,4]) {
    for (const q of [`${name} Japan`, `${prefEn || pref} Japan landscape`]) {
      yield { source: `openverse_p${page}`, q, fn: () => openverse(q, page, 20) };
    }
  }
}

// 現状 md5 マップ
const idToMd5 = new Map();
const md5ToIds = new Map();
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  const h = md5(fs.readFileSync(f));
  idToMd5.set(d.id, h);
  const a = md5ToIds.get(h) || []; a.push(d.id); md5ToIds.set(h, a);
}
const usedMd5 = new Set(idToMd5.values());

// 2件以上の重複グループから「2件目」を対象に
const dupGroups2 = Array.from(md5ToIds.entries()).filter(([_,ids])=>ids.length>=2);
console.log(`dup groups (2+): ${dupGroups2.length}`);
const targets = [];
for (const [_, ids] of dupGroups2) {
  for (let i=1; i<ids.length; i++) targets.push({ id: ids[i] });
}
console.log(`round2 targets: ${targets.length}`);

const results = [];
const tried = new Set();
const startTs = Date.now();
for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  const d = destMap.get(t.id);
  if (!d) { results.push({ id:t.id, ok:false, reason:'NO_DEST' }); continue; }
  let success = null;
  let attempts = 0;
  for (const cand of candidates(d)) {
    if (attempts > 30) break;
    let urls; try { urls = await cand.fn(); } catch { urls = []; }
    for (const url of urls) {
      if (tried.has(url)) continue;
      tried.add(url); attempts++;
      try {
        const buf = await getBinary(url);
        if (!buf || buf.length < 5000) continue;
        const h = md5(buf);
        if (usedMd5.has(h)) continue;
        const dst1 = path.join(SITE_IMG, d.id, 'main.jpg');
        const dst2 = path.join(PUB_IMG, d.id, 'main.jpg');
        fs.mkdirSync(path.dirname(dst1), { recursive:true });
        fs.mkdirSync(path.dirname(dst2), { recursive:true });
        fs.writeFileSync(dst1, buf); fs.writeFileSync(dst2, buf);
        const prev = idToMd5.get(d.id);
        if (prev) { const a = md5ToIds.get(prev)||[]; const j=a.indexOf(d.id); if(j>=0)a.splice(j,1); if(a.length===0){md5ToIds.delete(prev);usedMd5.delete(prev);} }
        idToMd5.set(d.id, h); usedMd5.add(h);
        const a2 = md5ToIds.get(h)||[]; a2.push(d.id); md5ToIds.set(h, a2);
        success = { source: cand.source, q: cand.q, url, md5:h, size: buf.length };
        break;
      } catch {}
    }
    if (success) break;
  }
  if (success) results.push({ id:t.id, ok:true, ...success });
  else {
    // フォールバック: 削除 + images=[]
    try { fs.unlinkSync(path.join(SITE_IMG, d.id, 'main.jpg')); } catch {}
    try { fs.unlinkSync(path.join(PUB_IMG, d.id, 'main.jpg')); } catch {}
    const dd = dests.find(x=>x.id===d.id); if(dd) dd.images=[];
    const prev=idToMd5.get(d.id);
    if(prev){ const a=md5ToIds.get(prev)||[]; const j=a.indexOf(d.id); if(j>=0)a.splice(j,1); if(a.length===0){md5ToIds.delete(prev); usedMd5.delete(prev);} idToMd5.delete(d.id); }
    results.push({ id:t.id, ok:false, fallback:'images=[]' });
  }
  console.log(`[${i+1}/${targets.length}] ${success ? 'OK '+success.source : 'FALLBACK'} ${t.id}`);
}

fs.writeFileSync(SITE_JSON, JSON.stringify(dests, null, 2));
fs.writeFileSync(PUB_JSON, JSON.stringify(dests, null, 2));

// 最終チェック
const post = new Map();
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  const h = md5(fs.readFileSync(f));
  const a = post.get(h) || []; a.push(d.id); post.set(h, a);
}
const stillDup = Array.from(post.entries()).filter(([_,a])=>a.length>=2);
console.log(`POST: still dup (2+): ${stillDup.length}`);
fs.writeFileSync(path.join(ROOT, 'logs/uniqueImagesRound2.json'), JSON.stringify({
  attempted: targets.length, ok: results.filter(r=>r.ok).length, fail: results.filter(r=>!r.ok).length,
  results, stillDupGroups: stillDup.length, stillDupSamples: stillDup.slice(0,20).map(([h,ids])=>({md5:h,ids})),
}, null, 2));
