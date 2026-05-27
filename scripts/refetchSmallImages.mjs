// logs/smallImages.json の destination について Pixabay で再取得。
// 取得画像が既存 md5 と衝突しないように確認。
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const SITE_IMG = '/Users/moririn/MORI-LAB/projects/dokoiko-site/public/images';
const PUB_IMG = path.join(ROOT, 'images');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const small = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs/smallImages.json'), 'utf-8'));
const dests = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/destinations.json'), 'utf-8'));

// 既存 md5 set (collision check)
const usedMd5 = new Set();
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  if (small.some(s => s.id === d.id)) continue; // 自身は除外
  usedMd5.add(crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'));
}

function get(url){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));const req=https.get(u,{headers:{'User-Agent':UA,'Accept':'*/*'}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}const c=[];r.on('data',x=>c.push(x));r.on('end',()=>res(Buffer.concat(c)))});req.on('error',rej);req.setTimeout(20000,()=>req.destroy(new Error('timeout')))}go(url)})}
async function getText(url){ return (await get(url)).toString('utf-8'); }
async function pixabay(q,page=1){const p=new URLSearchParams({key:PIXABAY_KEY,q,image_type:'photo',lang:'ja',per_page:'15',safesearch:'true',orientation:'horizontal',page:String(page)});try{const j=JSON.parse(await getText('https://pixabay.com/api/?'+p.toString()));return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean)}catch{return []}}

let ok=0,fail=0;
for (const s of small) {
  const d = dests.find(x=>x.id===s.id);
  if (!d) { fail++; continue; }
  const pref = (d.prefecture||'').replace(/[県府都]$/,'').split(/[・,／\/]/)[0].trim();
  const queries = [
    `${d.name} 観光 風景`,
    `${pref} 自然 風景`,
    `${d.name} ${pref}`,
    `${pref} 風景`,
    `Japan ${pref} landscape`,
  ];
  let placed=null;
  for (const q of queries) {
    for (const page of [1,2,3]) {
      const hits = await pixabay(q, page);
      for (const url of hits) {
        try {
          const buf = await get(url);
          if (buf.length < 80000) continue; // 小さすぎはスキップ
          const h = crypto.createHash('md5').update(buf).digest('hex');
          if (usedMd5.has(h)) continue;
          const dst1 = path.join(SITE_IMG, d.id, 'main.jpg');
          const dst2 = path.join(PUB_IMG, d.id, 'main.jpg');
          fs.mkdirSync(path.dirname(dst1),{recursive:true});
          fs.mkdirSync(path.dirname(dst2),{recursive:true});
          fs.writeFileSync(dst1, buf); fs.writeFileSync(dst2, buf);
          usedMd5.add(h);
          placed = { url, size: buf.length, query: q, page };
          break;
        } catch (e) {}
      }
      if (placed) break;
    }
    if (placed) break;
  }
  if (placed) { ok++; console.log('OK', d.id, '->', placed.size, 'bytes via', placed.query, 'p'+placed.page); }
  else { fail++; console.log('FAIL', d.id); }
}
console.log(`done ok=${ok} fail=${fail}`);
