// imageAudit.json の error エントリのみを再判定して結果をマージ
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const OUT = path.join(ROOT, 'logs/imageAudit.json');
const SHOTS = '/tmp/gallery_shots';

const audit = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
const targets = audit.results.filter(r => r.error);
console.log(`retry: ${targets.length} entries`);

const client = new Anthropic();
const MODEL = 'claude-haiku-4-5-20251001';
const CONCURRENCY = Number(process.env.CONC || 8); // 控えめに

const SYS = `You are auditing screenshots of a Japanese travel destination page.
Each image is the top 600px of an iPhone-width (390px) page; the hero image fills most of the frame.
Return ONLY a JSON object — no markdown, no prose.`;

const SCHEMA = `Return JSON: {"is_map_or_diagram":bool,"not_japan":bool,"animal_food_person_only":bool,"placeholder":bool,"blank_top":bool,"reason":"<=40chars"}`;

async function one(r) {
  const file = path.join(SHOTS, `${r.id}.png`);
  if (!fs.existsSync(file)) return { ...r, error: 'NO_SHOT' };
  const data = fs.readFileSync(file).toString('base64');
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYS,
      messages: [{ role:'user', content:[
        { type:'image', source:{type:'base64', media_type:'image/png', data} },
        { type:'text', text:`Destination: ${r.name} (${r.prefecture}).\n${SCHEMA}` },
      ]}],
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id: r.id, name: r.name, prefecture: r.prefecture, error: 'NO_JSON' };
    const j = JSON.parse(m[0]);
    return { id: r.id, name: r.name, prefecture: r.prefecture, ...j };
  } catch (e) {
    // exponential backoff for 429
    const msg = String(e.message || e);
    if (/429|rate_limit/i.test(msg)) {
      await new Promise(rs => setTimeout(rs, 4000));
      return await one(r); // 1 retry
    }
    return { id: r.id, name: r.name, prefecture: r.prefecture, error: msg.slice(0,200) };
  }
}

const idMap = new Map(audit.results.map((r,i)=>[r.id, i]));
let idx = 0;
const startTs = Date.now();
async function worker() {
  while (idx < targets.length) {
    const i = idx++;
    const r = targets[i];
    const updated = await one(r);
    const pos = idMap.get(r.id);
    audit.results[pos] = updated;
    if ((i+1) % 10 === 0) {
      const el = ((Date.now()-startTs)/1000).toFixed(1);
      console.log(`[${i+1}/${targets.length}] ${el}s`);
      fs.writeFileSync(OUT, JSON.stringify(audit, null, 2));
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, ()=>worker()));
fs.writeFileSync(OUT, JSON.stringify(audit, null, 2));

const keys=['is_map_or_diagram','not_japan','animal_food_person_only','placeholder','blank_top'];
const ng = audit.results.filter(r => keys.some(k=>r[k]));
const errs = audit.results.filter(r => r.error);
console.log(`done. NG=${ng.length} err=${errs.length}`);
