/**
 * deduplicateDestinations.js — destinations.json の重複排除
 *
 * 重複判定:
 *   1. id 一致
 *   2. 正規化name + prefecture 一致（例: 同じ「城崎温泉」が兵庫県で複数）
 *
 * 優先度（重複時に残すもの）:
 *   1. _generated/_enriched フラグなし（手動登録）を優先
 *   2. id が短い（既存の命名規則）を優先
 *
 * 使い方:
 *   node scripts/deduplicateDestinations.js              # dry-run
 *   node scripts/deduplicateDestinations.js --apply      # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const DEST_PATH = path.join(ROOT, 'src/data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DEST_PATH, 'utf8'));

function normalize(name) {
  return (name ?? '')
    .replace(/（[^）]*）$/, '')
    .replace(/\([^)]*\)$/, '')
    .replace(/\s+/g, '')
    .trim();
}

function priority(d) {
  // 手動登録（_generatedフラグなし）を優先
  if (d._generated || d._enriched) return 1;
  return 0; // 優先（小さいほど優先）
}

/* id重複排除 */
const byId = new Map();
for (const d of dests) {
  const existing = byId.get(d.id);
  if (!existing || priority(d) < priority(existing)) {
    byId.set(d.id, d);
  }
}

/* name + prefecture 重複排除 */
const byKey = new Map();
let idDupes = dests.length - byId.size;
let nameDupes = 0;
const dupLog = [];

for (const d of byId.values()) {
  const key = `${normalize(d.displayName || d.name)}__${d.prefecture ?? ''}`;
  const existing = byKey.get(key);
  if (!existing) {
    byKey.set(key, d);
  } else {
    // 優先度比較
    const winner = priority(d) < priority(existing) ? d
      : priority(d) > priority(existing) ? existing
      : (d.id.length < existing.id.length ? d : existing);
    byKey.set(key, winner);
    const loser = winner === d ? existing : d;
    nameDupes++;
    if (dupLog.length < 10) dupLog.push(`  ${loser.id} ← ${winner.id} (${key})`);
  }
}

const deduped = Array.from(byKey.values());

console.log(`[dedupe] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  入力: ${dests.length}件`);
console.log(`  id重複削除: ${idDupes}件`);
console.log(`  name+prefecture重複削除: ${nameDupes}件`);
console.log(`  結果: ${deduped.length}件`);
if (dupLog.length) {
  console.log('\n[重複サンプル（削除対象 ← 残す対象）]');
  dupLog.forEach(l => console.log(l));
}

if (APPLY) {
  fs.writeFileSync(DEST_PATH, JSON.stringify(deduped, null, 2));
  console.log(`\n[dedupe] 書き込み完了: ${DEST_PATH}`);
}
