// imageAuditV2.json の NG を Pixabay で取り直し → reshoot → reaudit を繰り返す
// 最大 MAX_ITER 反復。NG=0 になれば終了。
// 最後にも残れば d.images=[] にフォールバック (本ファイルは出力のみ、images書換はオプション)
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
const AUDIT = path.join(ROOT, 'logs/imageAuditV2.json');
const DEST_JSON_SITE = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const DEST_JSON_PUB = path.join(ROOT, 'data/destinations.json');

const dests = JSON.parse(fs.readFileSync(DEST_JSON_PUB, 'utf-8'));
const destMap = new Map(dests.map(d => [d.id, d]));

const NG_KEYS = ['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top','text_overlay_unreadable','too_dark_or_bright'];
const MAX_ITER = Number(process.env.MAX_ITER || 4);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';
function get(url){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':UA,'Accept':'*/*'}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}let b='';r.setEncoding('utf-8');r.on('data',c=>b+=c);r.on('end',()=>res(b))}).on('error',rej)}go(url)})}
function download(url,dst){return new Promise((res,rej)=>{let h=0;function go(u){h++;if(h>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':UA}},r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return go(r.headers.location.startsWith('http')?r.headers.location:new URL(r.headers.location,u).toString())}if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode))}const f=fs.createWriteStream(dst);r.pipe(f);f.on('finish',()=>f.close(()=>res()));f.on('error',rej)}).on('error',rej)}go(url)})}

async function pixabay(q, opts={}){
  const params=new URLSearchParams({key:PIXABAY_KEY,q,image_type:'photo',lang:'ja',per_page:'10',safesearch:'true',orientation:'horizontal',...opts});
  try{ const b=await get('https://pixabay.com/api/?'+params.toString()); const j=JSON.parse(b); return (j?.hits||[]).map(h=>h.largeImageURL||h.webformatURL).filter(Boolean) }catch{ return [] }
}
async function wikiSummary(title){ try{const b=await get(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);const j=JSON.parse(b);return j?.originalimage?.source||j?.thumbnail?.source||null;}catch{return null} }

// 反復ごとに異なるクエリ戦略
function queriesFor(d, iter){
  const prefShort = (d.prefecture||'').replace(/[県府都]$/,'').split(/[・,／\/]/)[0].trim();
  const themes = ['風景','自然','景色','観光'];
  if (iter === 0) return [`${d.name} 観光 風景`, `${d.name} ${prefShort}`, d.name, `${prefShort} 風景`];
  if (iter === 1) return [`${prefShort} 自然 風景`, `${prefShort} 観光 風景`, `${prefShort} 景色`, `Japan ${prefShort} landscape`];
  if (iter === 2) return [`${prefShort} 山 川`, `${prefShort} 海`, `${prefShort} 田園`, `Japan landscape ${prefShort}`];
  // 最終手段
  return [`Japan landscape`, `Japan nature`, `Japan countryside`];
}

async function fetchAndApply(d, iter){
  const queries = queriesFor(d, iter);
  let chosen=null, queryUsed=null;
  for(const q of queries){
    const hits = await pixabay(q);
    if(hits.length){
      // iter 0 -> 0番目, iter>=1 -> ランダム選択 (バリエーション)
      const pickIdx = iter === 0 ? 0 : Math.min(hits.length-1, iter);
      chosen = hits[pickIdx]; queryUsed=q; break;
    }
    await new Promise(rs=>setTimeout(rs,200));
  }
  if(!chosen){
    const w = await wikiSummary(d.name);
    if(w){ chosen=w; queryUsed='wiki:'+d.name; }
  }
  if(!chosen) return { id:d.id, ok:false, reason:'NO_HITS', iter };
  const folder1=path.join(SITE_IMG,d.id), folder2=path.join(PUB_IMG,d.id);
  fs.mkdirSync(folder1,{recursive:true}); fs.mkdirSync(folder2,{recursive:true});
  const dst=path.join(folder1,'main.jpg');
  try{
    await download(chosen, dst);
    const sz=fs.statSync(dst).size;
    if(sz<5000) return { id:d.id, ok:false, reason:'TOO_SMALL', iter };
    fs.copyFileSync(dst, path.join(folder2,'main.jpg'));
    return { id:d.id, ok:true, queryUsed, src:chosen, size:sz, iter };
  } catch(e){
    return { id:d.id, ok:false, reason:String(e.message||e).slice(0,120), iter };
  }
}

// Playwright reshoot helper
async function reshoot(ids){
  const browser = await chromium.launch({headless:true});
  const ctx = await browser.newContext({...devices['iPhone 14'], viewport:{width:390,height:844}});
  const page = await ctx.newPage();
  for(const id of ids){
    try{
      await page.goto(`http://localhost:4173/destinations/${encodeURIComponent(id)}`,{waitUntil:'domcontentloaded',timeout:25000});
      try{ await page.locator('.dest-hero-img').first().waitFor({state:'visible',timeout:3000}); }catch{}
      await page.waitForTimeout(250);
      await page.screenshot({path: path.join(SHOTS, `${id}.png`), clip:{x:0,y:0,width:390,height:600}, type:'png'});
    }catch{}
  }
  await browser.close();
}

// Audit subset
const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';
const SYS = `You are auditing screenshots of a Japanese travel destination page. Return ONLY a JSON object.`;
const SCHEMA = `{"is_map_or_diagram":bool,"not_japan":bool,"animal_food_person_only":bool,"placeholder":bool,"blank_top":bool,"text_overlay_unreadable":bool,"too_dark_or_bright":bool,"reason":"<=40c"}`;
async function audit(d){
  const f=path.join(SHOTS,`${d.id}.png`);
  if(!fs.existsSync(f)) return { id:d.id, error:'NO_SHOT' };
  const data=fs.readFileSync(f).toString('base64');
  try{
    const res = await client.messages.create({model:MODEL, max_tokens:220, system:SYS,
      messages:[{role:'user',content:[
        {type:'image', source:{type:'base64', media_type:'image/png', data}},
        {type:'text', text:`Destination: ${d.name} (${d.prefecture}).\n${SCHEMA}`}
      ]}]
    });
    const txt = res.content?.[0]?.text||'';
    const m=txt.match(/\{[\s\S]*\}/);
    if(!m) return { id:d.id, error:'NO_JSON' };
    return { id:d.id, name:d.name, prefecture:d.prefecture, ...JSON.parse(m[0]) };
  }catch(e){
    const msg=String(e.message||e);
    if(/429|rate_limit/i.test(msg)){ await new Promise(r=>setTimeout(r,4000)); return audit(d); }
    return { id:d.id, error:msg.slice(0,200) };
  }
}
async function auditMany(targets, conc=12){
  const out=[]; let i=0;
  async function w(){ while(i<targets.length){ const k=i++; out.push(await audit(targets[k])); } }
  await Promise.all(Array.from({length:conc},()=>w()));
  return out;
}

// === main loop ===
const auditFile = JSON.parse(fs.readFileSync(AUDIT,'utf-8'));
let ngIds = auditFile.results.filter(r => NG_KEYS.some(k=>r[k])).map(r=>r.id);
console.log(`initial NG: ${ngIds.length}`);
const masterAudit = new Map(auditFile.results.map(r=>[r.id, r]));
const iterLog = [];

for(let iter=0; iter<MAX_ITER && ngIds.length>0; iter++){
  console.log(`\n=== iter ${iter}: fixing ${ngIds.length} ===`);
  const fixResults = [];
  for(const id of ngIds){
    const d = destMap.get(id);
    if(!d){ fixResults.push({id, ok:false, reason:'NO_DEST'}); continue; }
    fixResults.push(await fetchAndApply(d, iter));
  }
  const ok = fixResults.filter(x=>x.ok).length;
  console.log(`  fetched: ${ok}/${ngIds.length}`);

  console.log(`  reshooting ${ngIds.length}...`);
  await reshoot(ngIds);

  console.log(`  re-auditing ${ngIds.length}...`);
  const targets = ngIds.map(id=>destMap.get(id)).filter(Boolean);
  const aud = await auditMany(targets, 14);
  for(const a of aud) masterAudit.set(a.id, a);
  const remaining = aud.filter(a => NG_KEYS.some(k=>a[k])).map(a=>a.id);
  console.log(`  remaining NG: ${remaining.length}`);
  iterLog.push({ iter, attempted: ngIds.length, ok, remaining: remaining.length });
  ngIds = remaining;
}

// 最終的になお NG が残っていたら images を空にして hero フォールバック
const finalNG = ngIds;
if (finalNG.length) {
  console.log(`\nfinal NG=${finalNG.length} → set images=[] to use fallback`);
  // 両方のdestinations.json を更新
  for (const file of [DEST_JSON_SITE, DEST_JSON_PUB]) {
    const arr = JSON.parse(fs.readFileSync(file,'utf-8'));
    for (const d of arr) {
      if (finalNG.includes(d.id)) d.images = [];
    }
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
  }
}

// 結果保存
fs.writeFileSync(path.join(ROOT,'logs/fixLoopV2.json'), JSON.stringify({
  iterLog,
  finalNG,
  finalAudit: Array.from(masterAudit.values()),
}, null, 2));

console.log('saved logs/fixLoopV2.json');
console.log(`DONE. finalNG=${finalNG.length}`);
