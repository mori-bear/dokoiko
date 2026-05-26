// 全destinationのhero画像(main.jpg) を md5 計算、重複グループを抽出。
// 重複グループ内で「1枚だけ残し、残りを Pixabay で再取得」
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';

const ROOT = path.resolve(process.cwd());
const SITE_IMG = '/Users/moririn/MORI-LAB/projects/dokoiko-site/public/images';
const PUB_IMG = path.join(ROOT, 'images');
const DEST_JSON_PUB = path.join(ROOT, 'data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DEST_JSON_PUB, 'utf-8'));
const destMap = new Map(dests.map(d => [d.id, d]));

const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

function get(url){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':UA,'Accept':'*/*'}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}let b='';r.setEncoding('utf-8');r.on('data',c=>b+=c);r.on('end',()=>res(b))}).on('error',rej)}go(url)})}
function download(url,dst){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':UA}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}const f=fs.createWriteStream(dst);r.pipe(f);f.on('finish',()=>f.close(()=>res()));f.on('error',rej)}).on('error',rej)}go(url)})}
async function pixabay(q, page=1){
  const params=new URLSearchParams({key:PIXABAY_KEY,q,image_type:'photo',lang:'ja',per_page:'15',safesearch:'true',orientation:'horizontal',page:String(page)});
  try{ const b=await get('https://pixabay.com/api/?'+params.toString()); const j=JSON.parse(b); return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean) }catch{ return [] }
}

// 1. md5 重複検出
console.log('hashing...');
const md5Groups = new Map(); // md5 -> [{id, file, size}]
let scanned = 0;
for (const d of dests) {
  const f = path.join(SITE_IMG, d.id, 'main.jpg');
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  const h = crypto.createHash('md5').update(buf).digest('hex');
  const arr = md5Groups.get(h) || []; arr.push({ id:d.id, size:buf.length }); md5Groups.set(h, arr);
  scanned++;
}
const dupGroups = Array.from(md5Groups.entries()).filter(([_, arr]) => arr.length > 1);
console.log(`scanned: ${scanned}, dup groups: ${dupGroups.length}, total dup imgs: ${dupGroups.reduce((a,[,b])=>a+b.length,0)}`);

const summary = dupGroups.map(([h, arr]) => ({ md5:h, count:arr.length, ids: arr.map(x=>x.id), size: arr[0].size }));
fs.writeFileSync(path.join(ROOT, 'logs/dupImages.json'), JSON.stringify({ scanned, dupGroups: summary }, null, 2));

// 2. 各重複グループで「1枚残し、残りを Pixabay 再取得」
const toFetch = [];
for (const [_, arr] of dupGroups) {
  // index 0 はそのまま、1..n を再取得
  for (let i=1; i<arr.length; i++) toFetch.push(arr[i].id);
}
console.log(`will refetch: ${toFetch.length}`);

let ok=0, fail=0;
const log=[];
const startTs = Date.now();
for (let i=0; i<toFetch.length; i++){
  const id = toFetch[i];
  const d = destMap.get(id);
  if (!d){ fail++; log.push({id, ok:false, reason:'NO_DEST'}); continue; }
  const prefShort = (d.prefecture||'').replace(/[県府都]$/,'').split(/[・,／\/]/)[0].trim();
  const queries = [
    `${d.name} 観光 風景`,
    `${d.name} ${prefShort}`,
    `${d.name}`,
    `${prefShort} 自然 風景`,
    `${prefShort} 観光 風景`,
    `Japan ${prefShort} landscape`,
  ];
  let chosen=null, queryUsed=null;
  // ページ番号を id 末尾文字でずらすことで重複回避
  const offset = Math.abs([...id].reduce((s,c)=>s+c.charCodeAt(0),0)) % 5; // 0..4
  for (const q of queries) {
    let hits = [];
    try { hits = await pixabay(q, 1); } catch {}
    if (hits.length) {
      const idx = (offset + i) % hits.length;
      chosen = hits[idx]; queryUsed = q; break;
    }
    await new Promise(rs=>setTimeout(rs, 200));
  }
  if (!chosen){ fail++; log.push({id, ok:false, reason:'NO_HITS'}); continue; }
  const folder1=path.join(SITE_IMG, id);
  const folder2=path.join(PUB_IMG, id);
  fs.mkdirSync(folder1,{recursive:true});
  fs.mkdirSync(folder2,{recursive:true});
  const dst=path.join(folder1,'main.jpg');
  try {
    await download(chosen, dst);
    const sz = fs.statSync(dst).size;
    if (sz<5000){ fail++; log.push({id, ok:false, reason:'TOO_SMALL'}); continue; }
    fs.copyFileSync(dst, path.join(folder2,'main.jpg'));
    ok++; log.push({id, ok:true, queryUsed, src:chosen, size:sz});
  } catch(e){ fail++; log.push({id, ok:false, reason:String(e.message||e).slice(0,120)}); }
  if ((i+1) % 25 === 0) {
    const el = ((Date.now()-startTs)/1000).toFixed(1);
    console.log(`[${i+1}/${toFetch.length}] ${el}s ok=${ok} fail=${fail}`);
  }
}
console.log(`DONE ok=${ok} fail=${fail}`);
fs.writeFileSync(path.join(ROOT,'logs/dupImagesFix.json'), JSON.stringify({ ok, fail, log }, null, 2));

// 再 md5 で重複ゼロを確認
const post = new Map();
for (const d of dests){
  const f=path.join(SITE_IMG, d.id, 'main.jpg');
  if(!fs.existsSync(f)) continue;
  const h = crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
  const arr = post.get(h)||[]; arr.push(d.id); post.set(h, arr);
}
const stillDup = Array.from(post.values()).filter(a=>a.length>1);
console.log(`post-fix dup groups: ${stillDup.length}`);
fs.writeFileSync(path.join(ROOT, 'logs/dupImagesPostFix.json'), JSON.stringify({ stillDupGroups: stillDup.length, samples: stillDup.slice(0,20) }, null, 2));
