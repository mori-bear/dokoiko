// 全destination description を Claude Haiku で 4点品質判定
// 4点 = 固有名詞 + 五感表現 + 連続「ます」回避 + 200字以上
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

const client = new Anthropic();
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';
const CONCURRENCY = Number(process.env.CONC || 18);

const SYS = `あなたは日本の旅行先紹介文の品質を判定する評価者です。JSONのみ返してください。`;

function buildPrompt(d) {
  return `次の旅行先紹介文を4基準で評価:
基準:
- 固有名詞: 実在する施設・地名・産物名が含まれるか
- 五感表現: 視覚・聴覚・嗅覚・触覚・味覚を喚起する語があるか
- 文末多様性: 「〜ます。」の連続(3回以上)が無いか
- 200字以上: 既に200字以上ある (true 固定でOK)

旅行先: ${d.name} (${d.prefecture})
紹介文:
${d.description}

JSONのみ返却:
{"hasProperNouns":bool,"hasSensory":bool,"variedEndings":bool,"hasLength":bool,"score":0-4,"reason":"<=40chars"}`;
}

async function audit(d) {
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 180, system: SYS,
      messages: [{ role: 'user', content: buildPrompt(d) }],
    });
    const txt = res.content?.[0]?.text || '';
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return { id: d.id, error: 'NO_JSON' };
    return { id: d.id, name: d.name, prefecture: d.prefecture, ...JSON.parse(m[0]) };
  } catch (e) {
    const msg = String(e.message||e);
    if (/429|rate_limit/i.test(msg)) { await new Promise(r=>setTimeout(r,4000)); return audit(d); }
    return { id: d.id, error: msg.slice(0,200) };
  }
}

const results = [];
let idx = 0;
const startTs = Date.now();
async function worker(){
  while(idx<dests.length){
    const i=idx++;
    results.push(await audit(dests[i]));
    if(results.length%50===0){
      const el=((Date.now()-startTs)/1000).toFixed(1);
      const ngc = results.filter(r => (r.score!==undefined && r.score<3)).length;
      const errs = results.filter(r=>r.error).length;
      console.log(`[${results.length}/${dests.length}] ${el}s ng=${ngc} err=${errs}`);
      fs.writeFileSync(path.join(ROOT,'logs/articleQualityAI.json'), JSON.stringify({ partial:true, results },null,2));
    }
  }
}
console.log(`auditing ${dests.length} articles, model=${MODEL}`);
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));

const el = ((Date.now()-startTs)/1000).toFixed(1);
const ng = results.filter(r => r.score!==undefined && r.score<3);
const errs = results.filter(r=>r.error);
console.log(`done ${el}s NG(score<3)=${ng.length} err=${errs.length}`);
fs.writeFileSync(path.join(ROOT,'logs/articleQualityAI.json'), JSON.stringify({
  partial:false, finishedAt:new Date().toISOString(),
  total:results.length, ng:ng.length, errs:errs.length, results
},null,2));
