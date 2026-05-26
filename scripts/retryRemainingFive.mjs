// reauditFixed.json でまだ NG の destination について
// 別クエリで Pixabay → Wikipedia REST → それでもダメなら destinationのprefecture景観で再取得
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { chromium, devices } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const ROOT = path.resolve(process.cwd());
const SITE_IMG = '/Users/moririn/MORI-LAB/projects/dokoiko-site/public/images';
const PUB_IMG = path.join(ROOT, 'images');
const SHOTS = '/tmp/gallery_shots';
const dests = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/destinations.json'), 'utf-8'));
const destMap = new Map(dests.map(d=>[d.id,d]));
const NG_KEYS = ['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top'];

const reaudit = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs/reauditFixed.json'), 'utf-8'));
const stillNG = reaudit.results.filter(r => NG_KEYS.some(k=>r[k]));
console.log('still NG:', stillNG.length);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';
function get(url) {
  return new Promise((resolve, reject) => {
    let hops=0;
    function go(u){ hops++; if(hops>5) return reject(new Error('redirects'));
      https.get(u,{headers:{'User-Agent':UA,'Accept':'application/json,*/*'}},res=>{
        if(res.statusCode>=300 && res.statusCode<400 && res.headers.location){res.resume();return go(res.headers.location.startsWith('http')?res.headers.location:new URL(res.headers.location,u).toString())}
        if(res.statusCode!==200){res.resume();return reject(new Error('HTTP '+res.statusCode))}
        let b='';res.setEncoding('utf-8');res.on('data',c=>b+=c);res.on('end',()=>resolve(b));
      }).on('error',reject);
    } go(url);
  });
}
function download(url, dest){
  return new Promise((resolve, reject)=>{
    let hops=0;
    function go(u){hops++;if(hops>5)return reject(new Error('redirects'));
      https.get(u,{headers:{'User-Agent':UA}},res=>{
        if(res.statusCode>=300 && res.statusCode<400 && res.headers.location){res.resume();return go(res.headers.location.startsWith('http')?res.headers.location:new URL(res.headers.location,u).toString())}
        if(res.statusCode!==200){res.resume();return reject(new Error('HTTP '+res.statusCode))}
        const f=fs.createWriteStream(dest);res.pipe(f);
        f.on('finish',()=>f.close(()=>resolve()));f.on('error',reject);
      }).on('error',reject);
    } go(url);
  });
}
async function pixabay(q){
  const params=new URLSearchParams({key:PIXABAY_KEY,q,image_type:'photo',lang:'ja',per_page:'5',safesearch:'true',orientation:'horizontal'});
  try{ const body=await get('https://pixabay.com/api/?'+params.toString()); const j=JSON.parse(body); return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean);}catch{return []}
}
async function wikiSummary(title){
  try{ const body=await get(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`); const j=JSON.parse(body); return j?.originalimage?.source||j?.thumbnail?.source||null; }catch{return null}
}

async function fetchImage(d){
  const prefShort=(d.prefecture||'').replace(/[県府都]$/,'');
  // 別クエリでより安全な「県名 + 風景」「地域カテゴリ」へフォールバック
  const queries = [
    `${prefShort} 自然 風景`,
    `${prefShort} 観光 風景`,
    `${prefShort} 景色`,
    `Japan ${prefShort} landscape`,
    `${prefShort}`,
  ];
  for(const q of queries){
    const hits = await pixabay(q);
    if (hits.length) return { src:'pixabay', url: hits[0], q };
    await new Promise(rs=>setTimeout(rs,300));
  }
  // Wikipedia
  const wq = `${d.name}`;
  const w = await wikiSummary(wq);
  if (w) return { src:'wiki', url:w, q:wq };
  return null;
}

async function applyOne(r){
  const d = destMap.get(r.id);
  if(!d) return { id:r.id, ok:false, reason:'NO_DEST' };
  const got = await fetchImage(d);
  if(!got) return { id:r.id, ok:false, reason:'NO_HITS' };
  const folder1 = path.join(SITE_IMG, d.id);
  const folder2 = path.join(PUB_IMG, d.id);
  fs.mkdirSync(folder1, {recursive:true});
  fs.mkdirSync(folder2, {recursive:true});
  const dst1 = path.join(folder1, 'main.jpg');
  try{
    await download(got.url, dst1);
    const sz = fs.statSync(dst1).size;
    if(sz<5000) return { id:r.id, ok:false, reason:'TOO_SMALL' };
    fs.copyFileSync(dst1, path.join(folder2, 'main.jpg'));
    return { id:r.id, ok:true, src:got.src, q:got.q, size:sz };
  } catch(e) {
    return { id:r.id, ok:false, reason: String(e.message||e).slice(0,120) };
  }
}

const applied = [];
for(const r of stillNG){
  applied.push(await applyOne(r));
}
console.log('applied:', applied);

// recapture & reaudit
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({...devices['iPhone 14'], viewport:{width:390,height:844}});
const page = await ctx.newPage();
for(const r of stillNG){
  try{
    await page.goto(`http://localhost:4173/destinations/${encodeURIComponent(r.id)}`, {waitUntil:'domcontentloaded', timeout:25000});
    try{ await page.locator('.dest-hero-img').first().waitFor({state:'visible',timeout:3000}); }catch{}
    await page.waitForTimeout(250);
    await page.screenshot({path: path.join(SHOTS, `${r.id}.png`), clip:{x:0,y:0,width:390,height:600}, type:'png'});
  }catch{}
}
await browser.close();

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';
const SYS = `You are auditing screenshots of a Japanese travel destination page. Return ONLY a JSON object.`;
const SCHEMA = `{"is_map_or_diagram":bool,"not_japan":bool,"animal_food_person_only":bool,"placeholder":bool,"blank_top":bool,"reason":"<=40chars"}`;
async function audit(d){
  const f = path.join(SHOTS, `${d.id}.png`);
  if(!fs.existsSync(f)) return { id:d.id, error:'NO_SHOT' };
  const data = fs.readFileSync(f).toString('base64');
  try{
    const res = await client.messages.create({model:MODEL, max_tokens:200, system:SYS,
      messages:[{role:'user',content:[
        {type:'image', source:{type:'base64', media_type:'image/png', data}},
        {type:'text', text:`Destination: ${d.name} (${d.prefecture}).\n${SCHEMA}`}
      ]}]
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if(!m) return { id:d.id, error:'NO_JSON' };
    return { id:d.id, name:d.name, ...JSON.parse(m[0]) };
  }catch(e){
    return { id:d.id, error:String(e.message||e).slice(0,200) };
  }
}
const finalAudit = [];
for(const r of stillNG){ const d = destMap.get(r.id); if(d) finalAudit.push(await audit(d)); }
console.log('final NG:', finalAudit.filter(x=>NG_KEYS.some(k=>x[k])).length);
fs.writeFileSync(path.join(ROOT, 'logs/retry5.json'), JSON.stringify({applied, finalAudit}, null, 2));
