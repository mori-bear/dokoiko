// articleQualityAI.json で score<3 の destination の description を
// Sonnet 4.6 でリライトし、destinations.json を更新。
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/moririn/MORI-LAB/projects/dokoiko-site/.env' });

const ROOT = path.resolve(process.cwd());
const SRC = '/Users/moririn/MORI-LAB/projects/dokoiko-site/src/data/destinations.json';
const PUB = path.join(ROOT, 'data/destinations.json');
const QUAL = path.join(ROOT, 'logs/articleQualityAI.json');

const dests = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
const destMap = new Map(dests.map(d => [d.id, d]));
const qual = JSON.parse(fs.readFileSync(QUAL, 'utf-8'));

// score<3 を対象 + error (NO_JSON など score 不明) も念のため対象に
const targets = qual.results.filter(r => (typeof r.score === 'number' && r.score < 3) || r.error).map(r => r.id);
console.log(`rewrite targets: ${targets.length}`);

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-6';
const CONCURRENCY = Number(process.env.CONC || 6);

const SYS = `あなたは日本の旅行先紹介文を書くライターです。
4点品質基準を満たす紹介文を200〜260字で書いてください:
- 固有名詞: 実在する施設・地名・産物名を最低3つ
- 五感表現: 視覚/聴覚/嗅覚/触覚/味覚を喚起する語を含む
- 文末多様性: 「〜ます」の連続を避け、体言止め・「だ」「である」も混ぜる
- 250字前後を目安に、200字以上
旅情を喚起しつつ、実用情報も触れること。返答は紹介文のみ、前置きや解説は不要。`;

async function rewrite(d) {
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 600, system: SYS,
      messages: [{ role: 'user', content:
        `旅行先: ${d.name} (${d.prefecture})
タグ: ${(d.tags||[]).join(', ')}
既存紹介文(改善対象):
${d.description}

上記を4点品質を満たす紹介文にリライトしてください。` }]
    });
    const txt = (res.content?.[0]?.text || '').trim();
    return { id: d.id, ok: txt.length >= 200, newDesc: txt, len: txt.length };
  } catch (e) {
    const msg = String(e.message||e);
    if (/429|rate_limit/i.test(msg)) { await new Promise(r=>setTimeout(r,4000)); return rewrite(d); }
    return { id: d.id, ok: false, error: msg.slice(0,200) };
  }
}

const results = [];
let idx = 0;
const startTs = Date.now();
async function worker(){
  while(idx<targets.length){
    const i = idx++;
    const d = destMap.get(targets[i]);
    if(!d){ results.push({id:targets[i], ok:false, error:'NO_DEST'}); continue; }
    const r = await rewrite(d);
    if (r.ok) {
      d.description = r.newDesc;
    }
    results.push(r);
    if (results.length % 20 === 0) {
      const el = ((Date.now()-startTs)/1000).toFixed(1);
      const okN = results.filter(x=>x.ok).length;
      console.log(`[${results.length}/${targets.length}] ${el}s ok=${okN} fail=${results.length-okN}`);
      fs.writeFileSync(SRC, JSON.stringify(dests, null, 2));
      fs.writeFileSync(PUB, JSON.stringify(dests, null, 2));
    }
  }
}
await Promise.all(Array.from({length:CONCURRENCY},()=>worker()));

fs.writeFileSync(SRC, JSON.stringify(dests, null, 2));
fs.writeFileSync(PUB, JSON.stringify(dests, null, 2));
fs.writeFileSync(path.join(ROOT,'logs/rewriteLowQuality.json'), JSON.stringify({ targets:targets.length, ok:results.filter(r=>r.ok).length, results }, null, 2));
console.log('saved logs/rewriteLowQuality.json');
