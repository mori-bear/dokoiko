/**
 * mapPoint一括設定スクリプト
 * - mapPoint未設定の全destinationsにspots[0]を設定
 * - spots[0]が駅名の場合はspots[1]以降を試みる
 * - それでも見つからなければfinalPointを使用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const destPath = path.resolve(__dirname, '../src/data/destinations.json');
const data = JSON.parse(fs.readFileSync(destPath, 'utf8'));

let updated = 0;
let skipped = 0;
const noMapPoint = [];

for (const dest of data) {
  if (dest.mapPoint) {
    skipped++;
    continue;
  }

  // spotsから駅名以外の最初の候補を探す
  let candidate = null;
  if (Array.isArray(dest.spots)) {
    for (const spot of dest.spots) {
      if (spot && !spot.endsWith('駅') && !spot.endsWith('駅前')) {
        candidate = spot;
        break;
      }
    }
  }

  // spotsにないならfinalPointを試みる
  if (!candidate && dest.finalPoint && !dest.finalPoint.endsWith('駅')) {
    candidate = dest.finalPoint;
  }

  if (candidate) {
    dest.mapPoint = candidate;
    updated++;
  } else {
    noMapPoint.push(dest.id);
  }
}

fs.writeFileSync(destPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`更新: ${updated}件`);
console.log(`スキップ（既設定）: ${skipped}件`);
if (noMapPoint.length > 0) {
  console.log(`mapPoint設定不可: ${noMapPoint.length}件`);
  noMapPoint.forEach(id => console.log('  -', id));
} else {
  console.log('全件mapPoint設定完了');
}
