/**
 * fixJalanEncoding.js — hotelAreas.json の jalanUrl を Shift-JIS → UTF-8 に一括変換
 *
 * jalanKeyword（平文 UTF-8）が全件あるため、それで jalanUrl を再生成する。
 * Shift-JIS 処理は完全に廃止。
 *
 * 使い方:
 *   node scripts/fixJalanEncoding.js          # dry-run (変換後URLを表示)
 *   node scripts/fixJalanEncoding.js --apply  # 書き込み
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const AREAS_FILE = path.join(ROOT, 'src/data/hotelAreas.json');

const areas = JSON.parse(fs.readFileSync(AREAS_FILE, 'utf8'));

const BASE = 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=';

function buildUtf8JalanUrl(keyword) {
  return `${BASE}${encodeURIComponent(keyword)}`;
}

let fixed = 0, skipped = 0;
const samples = [];

for (const area of areas) {
  if (!area.jalanUrl || !area.jalanKeyword) { skipped++; continue; }

  const correct = buildUtf8JalanUrl(area.jalanKeyword);

  if (area.jalanUrl === correct) {
    skipped++;
    continue;
  }

  if (samples.length < 5) {
    samples.push({
      name: area.name,
      old: area.jalanUrl.slice(0, 80),
      new: correct.slice(0, 80),
    });
  }

  if (APPLY) area.jalanUrl = correct;
  fixed++;
}

console.log(`[fixJalanEncoding] ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`  修正: ${fixed}件 / スキップ: ${skipped}件 / 全${areas.length}件`);
console.log('');
console.log('変換サンプル:');
samples.forEach(s => {
  console.log(`  [${s.name}]`);
  console.log(`    old: ${s.old}`);
  console.log(`    new: ${s.new}`);
});

if (APPLY) {
  fs.writeFileSync(AREAS_FILE, JSON.stringify(areas, null, 2), 'utf8');
  console.log(`\n[fixJalanEncoding] 書き込み完了: ${AREAS_FILE}`);
}
