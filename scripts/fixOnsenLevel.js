/**
 * fixOnsenLevel.js — 温泉が主要な魅力の8件を onsenLevel: 1 → 2 に昇格（一回限り）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, '../src/data/destinations.json');

const PROMOTE_TO_2 = [
  'dogo-onsen',
  'sounkyo',
  'niseko',
  'totsukawa',
  'kikuchi',
  'kumano-hongu',
  'hachimantai',
  'dewa-sanzan',
];

const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
const arr = Array.isArray(data) ? data : (data.destinations || Object.values(data));

const set = new Set(PROMOTE_TO_2);
const log = [];
const skipped = [];
const seen = new Set();
for (const d of arr) {
  if (!set.has(d.id)) continue;
  seen.add(d.id);
  const before = d.onsenLevel ?? 0;
  // 既に2以上ならダウングレードしない（昇格スクリプトのため）
  if (before >= 2) {
    skipped.push({ id: d.id, name: d.name, reason: `既に${before}` });
    continue;
  }
  d.onsenLevel = 2;
  log.push({ id: d.id, name: d.name, before, after: 2 });
}

const missing = PROMOTE_TO_2.filter(id => !seen.has(id));
if (missing.length > 0) {
  console.error(`データ未発見ID: ${missing.join(', ')}`);
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(arr, null, 2) + '\n');

console.log(`✓ ${log.length}件昇格 / ${skipped.length}件スキップ / 想定 ${PROMOTE_TO_2.length}件`);
for (const r of log) console.log(`  ${r.id} (${r.name}) onsenLevel: ${r.before} → ${r.after}`);
for (const r of skipped) console.log(`  [skip] ${r.id} (${r.name}) ${r.reason}`);
