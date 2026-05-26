// /tmp/gallery_shots/{id}.png を Claude Vision で 5基準判定。
// 結果を logs/imageAudit.json に保存。
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// .env from dokoiko-site (ANTHROPIC_API_KEY)
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SHOTS = '/tmp/gallery_shots';
const DEST_JSON = path.join(ROOT, 'data/destinations.json');
const OUT_JSON = path.join(ROOT, 'logs/imageAudit.json');

const dests = JSON.parse(fs.readFileSync(DEST_JSON, 'utf-8'));
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const CONCURRENCY = Number(process.env.CONC || 16);

const client = new Anthropic();

const SYS = `You are auditing screenshots of a Japanese travel destination page.
Each image is the top 600px of an iPhone-width (390px) page; the hero image fills most of the frame.
Return ONLY a JSON object — no markdown, no prose.`;

const SCHEMA = `Return JSON with these boolean keys plus a short reason (max 40 chars):
{
  "is_map_or_diagram": <true if the hero is a map, chart, illustration, or diagram (not a photograph)>,
  "not_japan": <true if the hero clearly depicts a non-Japanese location (Europe, other Asia, etc.)>,
  "animal_food_person_only": <true if hero is ONLY animal/food/person closeup with no landscape/scenery>,
  "placeholder": <true if hero is solid color or pure gradient placeholder>,
  "blank_top": <true if the top of the page is mostly blank/white (layout broken)>,
  "reason": "<<= 40 chars>"
}`;

function b64(file) {
  return fs.readFileSync(file).toString('base64');
}

async function audit(d) {
  const file = path.join(SHOTS, `${d.id}.png`);
  if (!fs.existsSync(file)) return { id: d.id, name: d.name, prefecture: d.prefecture, error: 'NO_SHOT' };
  const data = b64(file);
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data } },
          { type: 'text', text: `Destination: ${d.name} (${d.prefecture}).\n${SCHEMA}` },
        ],
      }],
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id: d.id, name: d.name, prefecture: d.prefecture, error: 'NO_JSON', raw: txt.slice(0,200) };
    const j = JSON.parse(m[0]);
    return { id: d.id, name: d.name, prefecture: d.prefecture, ...j };
  } catch (e) {
    return { id: d.id, name: d.name, prefecture: d.prefecture, error: String(e.message || e).slice(0, 200) };
  }
}

const results = [];
let idx = 0;
const startTs = Date.now();
async function worker() {
  while (idx < dests.length) {
    const i = idx++;
    const d = dests[i];
    const r = await audit(d);
    results.push(r);
    if (results.length % 25 === 0) {
      const el = ((Date.now()-startTs)/1000).toFixed(1);
      const rate = (results.length / Math.max(1, Number(el))).toFixed(2);
      const ngc = results.filter(x => x.is_map_or_diagram || x.not_japan || x.animal_food_person_only || x.placeholder || x.blank_top).length;
      console.log(`[${results.length}/${dests.length}] ${el}s rate=${rate}/s ng=${ngc} err=${results.filter(x=>x.error).length}`);
      // 中間保存
      fs.writeFileSync(OUT_JSON, JSON.stringify({ partial: true, model: MODEL, results }, null, 2));
    }
  }
}

console.log(`auditing ${dests.length} images, model=${MODEL}, concurrency=${CONCURRENCY}`);
await Promise.all(Array.from({length: CONCURRENCY}, ()=>worker()));

const totalEl = ((Date.now()-startTs)/1000).toFixed(1);
const ng = results.filter(x => x.is_map_or_diagram || x.not_japan || x.animal_food_person_only || x.placeholder || x.blank_top);
const errs = results.filter(x => x.error);
console.log(`done in ${totalEl}s  NG=${ng.length}  err=${errs.length}`);

fs.writeFileSync(OUT_JSON, JSON.stringify({ partial: false, model: MODEL, finishedAt: new Date().toISOString(), elapsedSec: Number(totalEl), results }, null, 2));

// 簡易サマリ
const counts = { is_map_or_diagram:0, not_japan:0, animal_food_person_only:0, placeholder:0, blank_top:0 };
for (const r of results) for (const k of Object.keys(counts)) if (r[k]) counts[k]++;
console.log('NG counts:', counts);
console.log('saved', OUT_JSON);
