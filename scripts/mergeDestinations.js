/**
 * mergeDestinations.js — enriched.json を destinations.json にマージ
 *
 * ルール:
 *   - 既存destinations.jsonを先に読み込む（優先）
 *   - id重複は上書きしない（既存データを尊重）
 *   - 安全ガード: name/lat/lng/destType 欠損はスキップ
 *
 * 入力:
 *   src/data/destinations.json   (既存)
 *   src/data/destinations/enriched.json  (新規)
 *
 * 出力:
 *   src/data/destinations.json  (マージ済み)
 *
 * 使い方:
 *   node scripts/mergeDestinations.js
 *   node scripts/mergeDestinations.js --dry-run   # 書き込みなし
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const DEST_PATH    = path.join(ROOT, 'src/data/destinations.json');
const ENRICH_PATH  = path.join(ROOT, 'src/data/destinations/enriched.json');

if (!fs.existsSync(ENRICH_PATH)) {
  console.error(`[merge] ${ENRICH_PATH} が見つかりません。`);
  console.error('  先に: node scripts/generateDestinations.js → node scripts/enrichDestinations.js');
  process.exit(1);
}

const existing = JSON.parse(fs.readFileSync(DEST_PATH, 'utf8'));
const incoming = JSON.parse(fs.readFileSync(ENRICH_PATH, 'utf8'));

const map = new Map();
let skipNoName = 0, skipNoCoord = 0, skipNoType = 0, dupSkip = 0, added = 0;

/* 既存を先に入れる（優先） */
for (const d of existing) {
  map.set(d.id, d);
}

/* 新規を追加（id重複は上書きしない・安全ガード） */
for (const d of incoming) {
  // 安全ガード
  if (!d.name || d.name.trim() === '') { skipNoName++; continue; }
  if (d.lat == null || d.lng == null) { skipNoCoord++; continue; }
  if (!d.destType) { skipNoType++; continue; }

  // id重複は既存を尊重
  if (map.has(d.id)) { dupSkip++; continue; }

  map.set(d.id, d);
  added++;
}

const merged = Array.from(map.values());

console.log(`[merge] ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log(`  既存: ${existing.length}件`);
console.log(`  新規候補: ${incoming.length}件`);
console.log(`  採用: ${added}件`);
console.log(`  スキップ: noName=${skipNoName} noCoord=${skipNoCoord} noType=${skipNoType} dupId=${dupSkip}`);
console.log(`  結果: ${existing.length} → ${merged.length}件`);

if (!DRY_RUN) {
  fs.writeFileSync(DEST_PATH, JSON.stringify(merged, null, 2));
  console.log(`[merge] 書き込み完了: ${DEST_PATH}`);
}
