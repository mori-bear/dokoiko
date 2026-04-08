/**
 * finalAccess を文字列 → 構造化オブジェクトに変換する。
 *
 * "walk" → { "type": "walk" }
 * "bus"  → { "type": "bus", "from": representativeStation }
 * "car"  → { "type": "car" }
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST_PATH = resolve(__dirname, '../src/data/destinations.json');

const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf-8'));

let converted = 0;
for (const dest of destinations) {
  const fa = dest.finalAccess;
  if (typeof fa === 'string') {
    const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
    if (fa === 'walk') {
      dest.finalAccess = { type: 'walk' };
    } else if (fa === 'bus') {
      dest.finalAccess = {
        type: 'bus',
        from: dest.representativeStation ?? null,
      };
    } else if (fa === 'car') {
      dest.finalAccess = {
        type: 'car',
      };
    } else {
      dest.finalAccess = { type: fa };
    }
    converted++;
  }
}

writeFileSync(DEST_PATH, JSON.stringify(destinations, null, 2) + '\n', 'utf-8');
console.log(`変換完了: ${converted} / ${destinations.length} 件`);
