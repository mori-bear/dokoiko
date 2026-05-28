// marugame の hero 画像を「丸亀城 香川」で Pixabay → Wikimedia Commons の順に取得。
// md5 衝突回避。
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const SITE_IMG = '/Users/moririn/MORI-LAB/projects/dokoiko-site/public/images';
const PUB_IMG = path.join(ROOT, 'images');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';
const ID = 'marugame';

const dests = JSON.parse(fs.readFileSync(path.join(ROOT,'data/destinations.json'),'utf-8'));
// 既存 md5 (除外: 自身)
const usedMd5 = new Set();
for (const d of dests) {
  if (d.id === ID) continue;
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  usedMd5.add(crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'));
}

function get(url){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));const req=https.get(u,{headers:{'User-Agent':UA,'Accept':'*/*'}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}const c=[];r.on('data',x=>c.push(x));r.on('end',()=>res(Buffer.concat(c)))});req.on('error',rej);req.setTimeout(20000,()=>req.destroy(new Error('timeout')))}go(url)})}
async function getText(url){ return (await get(url)).toString('utf-8'); }

async function pixabay(q,page=1){
  const p=new URLSearchParams({key:PIXABAY_KEY,q,image_type:'photo',lang:'ja',per_page:'15',safesearch:'true',orientation:'horizontal',page:String(page)});
  try{const j=JSON.parse(await getText('https://pixabay.com/api/?'+p.toString()));return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean);}catch{return [];}
}
async function commons(query, max=12){
  try{
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

const candidates = [
  { src:'pixabay', fn: () => pixabay('丸亀城',1) },
  { src:'pixabay', fn: () => pixabay('丸亀城 香川',1) },
  { src:'pixabay', fn: () => pixabay('Marugame Castle',1) },
  { src:'commons', fn: () => commons('Marugame Castle', 12) },
  { src:'commons', fn: () => commons('丸亀城', 12) },
  { src:'commons', fn: () => commons('Marugame Kagawa', 12) },
  { src:'pixabay', fn: () => pixabay('丸亀城',2) },
];

let placed=null, tried=new Set();
for (const c of candidates) {
  const urls = await c.fn();
  for (const url of urls) {
    if (tried.has(url)) continue;
    tried.add(url);
    try {
      const buf = await get(url);
      if (buf.length < 80000) continue;
      const h = crypto.createHash('md5').update(buf).digest('hex');
      if (usedMd5.has(h)) continue;
      const dst1 = path.join(SITE_IMG, ID, 'main.jpg');
      const dst2 = path.join(PUB_IMG, ID, 'main.jpg');
      fs.mkdirSync(path.dirname(dst1), { recursive:true });
      fs.mkdirSync(path.dirname(dst2), { recursive:true });
      fs.writeFileSync(dst1, buf); fs.writeFileSync(dst2, buf);
      placed = { src:c.src, url, size:buf.length };
      break;
    } catch {}
  }
  if (placed) break;
}
console.log(placed ? `OK ${placed.src} -> ${placed.size} bytes` : 'FAIL no candidate');
