/**
 * addAccessPoint.js — 全destinationに accessPoint 構造化フィールドを追加
 *
 * 【目的】
 * 従来の accessStation（文字列）は "〇〇駅" を機械的に付与するリスクがあった。
 * accessPoint は type/name 構造で「実在駅かバス/港か」を明示する。
 *
 * 【ルール】
 * - "〇〇駅"で終わる   → type: "station", name: "〇〇" （駅サフィックス除去）
 * - "〇〇空港"で終わる → type: "airport", name: そのまま
 * - "〇〇港"で終わる   → type: "port",    name: そのまま
 * - "バスターミナル/バス停"で終わる → type: "bus", name: そのまま
 * - それ以外（海岸/峠/湖等の地名） → type: "bus"（フォールバック・道路アクセス想定）
 *
 * 既存 accessStation は互換性のため維持。
 *
 * 使い方:
 *   node scripts/addAccessPoint.js          # dry-run
 *   node scripts/addAccessPoint.js --apply  # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const DESTS_FILE = path.join(ROOT, 'src/data/destinations.json');

const DESTS = JSON.parse(fs.readFileSync(DESTS_FILE, 'utf8'));

function resolveAccessPoint(accessStation) {
  if (!accessStation) return null;
  if (/駅$/.test(accessStation)) {
    return { type: 'station', name: accessStation.replace(/駅$/, '') };
  }
  if (/空港$/.test(accessStation)) {
    return { type: 'airport', name: accessStation };
  }
  if (/港$/.test(accessStation)) {
    return { type: 'port', name: accessStation };
  }
  if (/バスターミナル$|バス停$|バスセンター$/.test(accessStation)) {
    return { type: 'bus', name: accessStation };
  }
  // その他（海岸/峠/湖/地名）→ 道路アクセスと想定
  return { type: 'bus', name: accessStation };
}

let added = 0, station = 0, bus = 0, port = 0, airport = 0;
const samples = [];

for (const d of DESTS) {
  const ap = resolveAccessPoint(d.accessStation);
  if (!ap) continue;

  const existing = d.accessPoint;
  if (existing && existing.type === ap.type && existing.name === ap.name) continue;

  if (samples.length < 15) {
    samples.push(`  ${d.id}: accessStation="${d.accessStation}" → accessPoint={type:"${ap.type}", name:"${ap.name}"}`);
  }

  if (APPLY) d.accessPoint = ap;
  added++;
  if (ap.type === 'station') station++;
  else if (ap.type === 'bus') bus++;
  else if (ap.type === 'port') port++;
  else if (ap.type === 'airport') airport++;
}

console.log(`[addAccessPoint] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  対象: ${added}件`);
console.log(`  内訳: station=${station}, bus=${bus}, port=${port}, airport=${airport}`);
console.log('\n[サンプル]');
samples.forEach(s => console.log(s));

if (APPLY) {
  fs.writeFileSync(DESTS_FILE, JSON.stringify(DESTS, null, 2));
  console.log(`\n[addAccessPoint] 書き込み完了: ${DESTS_FILE}`);
}
