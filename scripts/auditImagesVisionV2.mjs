// 7基準で Vision 判定 (前5 + テキスト被り + 明暗)
// 結果を logs/imageAuditV2.json に保存
// 任意で TARGETS_FILE=path/ids.json を渡すと、その ids のみ判定
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SHOTS = '/tmp/gallery_shots';
const DEST_JSON = path.join(ROOT, 'data/destinations.json');
const OUT_JSON = process.env.OUT || path.join(ROOT, 'logs/imageAuditV2.json');

const dests = JSON.parse(fs.readFileSync(DEST_JSON, 'utf-8'));

let targets = dests;
if (process.env.TARGETS_FILE) {
  const ids = JSON.parse(fs.readFileSync(process.env.TARGETS_FILE, 'utf-8'));
  const set = new Set(ids);
  targets = dests.filter(d => set.has(d.id));
  console.log(`subset audit: ${targets.length} targets`);
}

const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const CONCURRENCY = Number(process.env.CONC || 18);

const client = new Anthropic();

const SYS = `You are auditing screenshots of a Japanese travel destination page.
Each image is the top 600px of an iPhone-width (390px) page; the hero image fills most of the frame.
Return ONLY a JSON object — no markdown, no prose.`;

const SCHEMA = `Return JSON:
{
  "is_map_or_diagram": <true if hero is map/chart/illustration/diagram, not a photo>,
  "not_japan": <true if hero clearly depicts a non-Japanese location>,
  "animal_food_person_only": <true if hero is ONLY animal/food/person closeup with no landscape>,
  "placeholder": <true if hero is solid color/pure gradient placeholder>,
  "blank_top": <true if the top of the page is mostly blank/white (layout broken)>,
  "text_overlay_unreadable": <true if the destination title or hero text is hard to read against the image (low contrast / obscured by busy background)>,
  "too_dark_or_bright": <true if the hero is so dark or so over-exposed that subject is hard to recognize>,
  "reason": "<<=40chars>"
}`;

const NG_KEYS = ['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top','text_overlay_unreadable','too_dark_or_bright'];

async function audit(d) {
  const file = path.join(SHOTS, `${d.id}.png`);
  if (!fs.existsSync(file)) return { id: d.id, name: d.name, prefecture: d.prefecture, error: 'NO_SHOT' };
  const data = fs.readFileSync(file).toString('base64');
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 220, system: SYS,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
        { type: 'text', text: `Destination: ${d.name} (${d.prefecture}).\n${SCHEMA}` },
      ]}],
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id: d.id, name: d.name, prefecture: d.prefecture, error: 'NO_JSON', raw: txt.slice(0,200) };
    const j = JSON.parse(m[0]);
    return { id: d.id, name: d.name, prefecture: d.prefecture, ...j };
  } catch (e) {
    const msg = String(e.message || e);
    if (/429|rate_limit/i.test(msg)) {
      await new Promise(r => setTimeout(r, 4000));
      return audit(d);
    }
    return { id: d.id, name: d.name, prefecture: d.prefecture, error: msg.slice(0, 200) };
  }
}

const results = [];
let idx = 0;
const startTs = Date.now();
async function worker() {
  while (idx < targets.length) {
    const i = idx++;
    const r = await audit(targets[i]);
    results.push(r);
    if (results.length % 25 === 0) {
      const el = ((Date.now()-startTs)/1000).toFixed(1);
      const rate = (results.length / Math.max(1, Number(el))).toFixed(2);
      const ngc = results.filter(x => NG_KEYS.some(k => x[k])).length;
      console.log(`[${results.length}/${targets.length}] ${el}s rate=${rate}/s ng=${ngc} err=${results.filter(x=>x.error).length}`);
      fs.writeFileSync(OUT_JSON, JSON.stringify({ partial:true, model:MODEL, results }, null, 2));
    }
  }
}
console.log(`auditing ${targets.length} images, model=${MODEL}, concurrency=${CONCURRENCY}`);
await Promise.all(Array.from({length: CONCURRENCY}, ()=>worker()));

const elapsedSec = Number(((Date.now()-startTs)/1000).toFixed(1));
const ng = results.filter(r => NG_KEYS.some(k => r[k]));
const errs = results.filter(r => r.error);
console.log(`done ${elapsedSec}s NG=${ng.length} err=${errs.length}`);
const counts = Object.fromEntries(NG_KEYS.map(k => [k, results.filter(r=>r[k]).length]));
console.log('counts:', counts);

fs.writeFileSync(OUT_JSON, JSON.stringify({ partial:false, model:MODEL, finishedAt:new Date().toISOString(), elapsedSec, counts, results }, null, 2));
console.log('saved', OUT_JSON);
