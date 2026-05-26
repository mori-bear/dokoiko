// 修正対象IDのスクショだけ撮り直し、Vision で再判定
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SHOTS = '/tmp/gallery_shots';
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'logs/fixBadImages.json'), 'utf-8'));
const ids = FIX.log.filter(x => x.ok).map(x => x.id);
const dests = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/destinations.json'), 'utf-8'));
const destMap = new Map(dests.map(d=>[d.id,d]));
const targets = ids.map(id => destMap.get(id)).filter(Boolean);
console.log(`recapturing ${targets.length} pages...`);

const BASE = 'http://localhost:4173';
const browser = await chromium.launch({ headless: true });
const VIEWPORT = { width: 390, height: 844 };
const CLIP = { x:0, y:0, width:390, height:600 };
const CONC = 10;
let idx = 0;
async function shotWorker() {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], viewport: VIEWPORT });
  const page = await ctx.newPage();
  while (idx < targets.length) {
    const i = idx++;
    const d = targets[i];
    const url = `${BASE}/destinations/${encodeURIComponent(d.id)}`;
    try {
      await page.goto(url, { waitUntil:'domcontentloaded', timeout:25000 });
      try { await page.locator('.dest-hero-img').first().waitFor({state:'visible', timeout:3000}); } catch {}
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(SHOTS, `${d.id}.png`), clip: CLIP, type:'png' });
    } catch (e) {}
  }
  await ctx.close();
}
await Promise.all(Array.from({length: CONC}, ()=>shotWorker()));
await browser.close();
console.log('shots recaptured.');

// 再 audit
const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';
const NG_KEYS = ['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top'];
const SYS = `You are auditing screenshots of a Japanese travel destination page. Return ONLY a JSON object.`;
const SCHEMA = `{"is_map_or_diagram":bool,"not_japan":bool,"animal_food_person_only":bool,"placeholder":bool,"blank_top":bool,"reason":"<=40chars"}`;

async function audit(d) {
  const file = path.join(SHOTS, `${d.id}.png`);
  if (!fs.existsSync(file)) return { id:d.id, name:d.name, error:'NO_SHOT' };
  const data = fs.readFileSync(file).toString('base64');
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 200, system: SYS,
      messages:[{role:'user',content:[
        {type:'image', source:{type:'base64', media_type:'image/png', data}},
        {type:'text', text:`Destination: ${d.name} (${d.prefecture}).\n${SCHEMA}`}
      ]}]
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id:d.id, name:d.name, error:'NO_JSON' };
    const j = JSON.parse(m[0]);
    return { id:d.id, name:d.name, prefecture:d.prefecture, ...j };
  } catch (e) {
    const msg = String(e.message||e);
    if (/429|rate_limit/i.test(msg)) { await new Promise(r=>setTimeout(r,4000)); return audit(d); }
    return { id:d.id, name:d.name, error:msg.slice(0,200) };
  }
}

const results = [];
let i2 = 0;
async function auditWorker() {
  while (i2 < targets.length) {
    const i = i2++;
    results.push(await audit(targets[i]));
  }
}
await Promise.all(Array.from({length: 12}, ()=>auditWorker()));

const stillNG = results.filter(r => NG_KEYS.some(k=>r[k]));
console.log(`audit: total=${results.length} stillNG=${stillNG.length}`);
fs.writeFileSync(path.join(ROOT, 'logs/reauditFixed.json'),
  JSON.stringify({ total: results.length, stillNG: stillNG.length, results }, null, 2));
console.log('saved logs/reauditFixed.json');
