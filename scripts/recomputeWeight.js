/**
 * recomputeWeight.js — destination.weight を destType + アクセス良さで再計算
 *
 * weight = base(destType) × accessBonus × penalty
 *
 * base:
 *   onsen:    1.5（最強・宿CV率高）
 *   island:   1.3（宿泊ほぼ必須）
 *   mountain: 1.2（泊まり前提）
 *   remote:   1.2
 *   city:     1.0（標準）
 *   sight:    0.9（宿導線やや弱）
 *   peninsula:1.0
 *
 * accessBonus:
 *   accessPoint.type === 'station' → 1.1（駅アクセス良）
 *   accessPoint.type === 'airport' → 1.0
 *   accessPoint.type === 'port'    → 0.95
 *   accessPoint.type === 'bus'     → 0.85（バスアクセスのみ）
 *
 * penalty（route_validation_warnings.csvから引き継ぎ可能）:
 *   detour候補 → × 0.9
 *   too_long候補 → × 0.8
 *
 * 使い方:
 *   node scripts/recomputeWeight.js              # dry-run
 *   node scripts/recomputeWeight.js --apply      # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const DESTS_FILE = path.join(ROOT, 'src/data/destinations.json');
const WARN_FILE  = path.join(ROOT, 'route_validation_warnings.csv');

const DESTS = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));

const BASE_WEIGHT = {
  onsen:     1.5,
  island:    1.3,
  mountain:  1.2,
  remote:    1.2,
  peninsula: 1.0,
  city:      1.0,
  sight:     0.9,
};

const ACCESS_BONUS = {
  station: 1.1,
  airport: 1.0,
  port:    0.95,
  bus:     0.85,
};

/* route warning から penalty対象を収集（任意・ファイル無くてもOK） */
const detourIds = new Set();
const tooLongIds = new Set();
if (fs.existsSync(WARN_FILE)) {
  const lines = fs.readFileSync(WARN_FILE, 'utf8').split('\n').slice(1);
  for (const line of lines) {
    const [type, , destId] = line.split(',');
    if (type === 'detour')  detourIds.add(destId);
    if (type === 'too_long') tooLongIds.add(destId);
  }
}

let changed = 0;
const dist = { '0.9': 0, '1.0': 0, '1.2': 0, '1.3': 0, '1.5': 0, other: 0 };

for (const d of DESTS) {
  const base  = BASE_WEIGHT[d.destType] ?? 1.0;
  const access = ACCESS_BONUS[d.accessPoint?.type] ?? 1.0;
  let penalty = 1.0;
  if (detourIds.has(d.id))  penalty *= 0.9;
  if (tooLongIds.has(d.id)) penalty *= 0.8;

  const newWeight = Math.round(base * access * penalty * 100) / 100;
  if (d.weight !== newWeight) {
    if (APPLY) d.weight = newWeight;
    changed++;
  }

  const key = newWeight.toFixed(1);
  dist[key] = (dist[key] ?? 0) + 1;
}

console.log(`[recomputeWeight] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  変更: ${changed}件 / 全${DESTS.length}件`);
console.log(`  route warning: detour=${detourIds.size}, too_long=${tooLongIds.size}`);
console.log(`  新weight分布:`, dist);

if (APPLY) {
  fs.writeFileSync(DESTS_FILE, JSON.stringify(DESTS, null, 2));
  console.log(`\n[recomputeWeight] 書き込み完了`);
}
