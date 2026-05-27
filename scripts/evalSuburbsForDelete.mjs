// 大都市圏 destination 238件を Sonnet 4.6 で「旅行目的地として成立するか」評価。
// touristViable=false を削除候補リストに記録 (削除は別ステップで実行)。
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

const URBAN_PREFS = new Set(['東京都','神奈川県','埼玉県','千葉県','大阪府','兵庫県','京都府','奈良県','愛知県','福岡県']);
const targets = dests.filter(d => URBAN_PREFS.has(d.prefecture));
console.log(`evaluating ${targets.length} urban-area destinations`);

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const CONCURRENCY = Number(process.env.CONC || 6);

const SYS = `あなたは日本の旅行先選定の専門家です。判定基準に沿って厳密にJSONのみで回答してください。`;

function buildPrompt(d) {
  return `次の destination が「旅行目的地として成立するか」評価してください。

旅行先名: ${d.name}
都道府県: ${d.prefecture}
タグ: ${(d.tags||[]).join(', ')}
紹介文:
${d.description || ''}

判定基準:
- touristViable=true: 観光・旅行目的で1日かけて訪れる価値がある (温泉・自然・歴史・食文化・街歩き・離島・聖地巡礼・工場夜景・アート等)
- touristViable=false: 大都市圏の純粋なベッドタウンで、観光・旅行目的にならない (出張・通勤対象、観光資源無し)

特に以下は touristViable=true として残す:
- 川崎/四日市/堺等: 工場夜景で観光成立
- 春日部: クレヨンしんちゃん聖地巡礼
- 鎌倉/江ノ島/熱海等: 歴史・名勝
- 街の文化や食で観光成立する町
- 紹介文や spots に明確な観光資源がある

ベッドタウンと判断する例: 上尾/毛呂山/茂原/習志野 のように観光的特徴が乏しい住宅都市。

JSON のみで返答:
{"touristViable": true|false, "reason": "<40字>"}`;
}

async function evalOne(d) {
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 200, system: SYS,
      messages: [{ role:'user', content: buildPrompt(d) }],
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id: d.id, name: d.name, prefecture: d.prefecture, error: 'NO_JSON', raw: txt.slice(0,200) };
    return { id: d.id, name: d.name, prefecture: d.prefecture, ...JSON.parse(m[0]) };
  } catch (e) {
    const msg = String(e.message||e);
    if (/429|rate_limit/i.test(msg)) { await new Promise(r=>setTimeout(r,4000)); return evalOne(d); }
    return { id: d.id, name: d.name, prefecture: d.prefecture, error: msg.slice(0,200) };
  }
}

const results = [];
let idx = 0;
const startTs = Date.now();
async function worker(){
  while(idx<targets.length){
    const i=idx++;
    results.push(await evalOne(targets[i]));
    if(results.length%20===0){
      const el=((Date.now()-startTs)/1000).toFixed(1);
      const ngc = results.filter(r=>r.touristViable===false).length;
      const errs = results.filter(r=>r.error).length;
      console.log(`[${results.length}/${targets.length}] ${el}s ng=${ngc} err=${errs}`);
    }
  }
}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));

const el=((Date.now()-startTs)/1000).toFixed(1);
const toDelete = results.filter(r=>r.touristViable===false);
const errs = results.filter(r=>r.error);
console.log(`done ${el}s touristViable=false: ${toDelete.length} (errors=${errs.length})`);

fs.writeFileSync(path.join(ROOT, 'logs/suburbEval.json'), JSON.stringify({
  evaluated: results.length, toDelete: toDelete.length, errors: errs.length, results,
}, null, 2));
console.log('saved logs/suburbEval.json');
console.log('--- TO DELETE ---');
toDelete.forEach(r=>console.log(`  ${r.id} | ${r.name} | ${r.prefecture} | ${r.reason}`));
