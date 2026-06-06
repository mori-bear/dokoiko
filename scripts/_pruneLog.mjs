// クレジット枯渇でVision全エラーになった目的地をログから除去し、RESUMEで再処理できるようにする。
// 残す条件: 候補が0件(判定不要) または 候補に1件でも実スコア(score>=0)がある。
// 除去条件: 候補があるのに全てscore===-1(API失敗)。
import fs from 'node:fs';
const P = '/Users/moririn/MORI-LAB/projects/dokoiko/logs/imageQualityUpgrade.json';
const j = JSON.parse(fs.readFileSync(P, 'utf-8'));
const keep = [];
let dropped = 0;
for (const r of j.results) {
  let hasCand = false, hasReal = false;
  for (const s of (r.slots || [])) {
    for (const c of (s.candScores || [])) { hasCand = true; if (typeof c.score === 'number' && c.score >= 0) hasReal = true; }
  }
  if (hasCand && !hasReal) { dropped++; continue; } // クレジット汚染
  keep.push(r);
}
const NGslot = (s) => s.replaced;
let replaced = 0, kept = 0, noCand = 0, noPass = 0;
const rd = new Set();
for (const r of keep) for (const s of (r.slots || [])) {
  if (s.replaced) { replaced++; rd.add(r.id); }
  else if ((s.reason || '').startsWith('KEEP')) kept++;
  else if (s.reason === 'NO_CANDIDATES') noCand++;
  else if (s.reason === 'NO_PASS') noPass++;
}
j.results = keep;
j.counts = { dests: keep.length, replacedDests: rd.size, replaced, kept, noCandidates: noCand, noPass };
fs.writeFileSync(P, JSON.stringify(j, null, 2));
console.log('kept dests:', keep.length, '| dropped(credit-poisoned):', dropped);
console.log('counts:', JSON.stringify(j.counts));
