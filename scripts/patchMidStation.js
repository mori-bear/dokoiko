/**
 * midStation を追加する。
 * gatewayCity → midStation → transferStation の2ステップ乗換に対応。
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST_PATH = resolve(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(readFileSync(DEST_PATH, 'utf-8'));

const MID_PATCHES = {
  // 大阪 → 天王寺（JR環状線） → 大阪阿部野橋（徒歩乗換） → 近鉄
  'asuka':   { midStation: '天王寺' },
  'yoshino': { midStation: '天王寺' },
  // 大阪 → なんば（地下鉄） → 難波（南海）
  'koyasan': { midStation: 'なんば' },
};

let patched = 0;
for (const dest of destinations) {
  const patch = MID_PATCHES[dest.id];
  if (patch && dest.finalAccess?.transferStation) {
    dest.finalAccess.midStation = patch.midStation;
    patched++;
    console.log(`  ✓ ${dest.name}: +midStation ${patch.midStation}`);
  }
}

writeFileSync(DEST_PATH, JSON.stringify(destinations, null, 2) + '\n', 'utf-8');
console.log(`\n${patched}件パッチ適用`);
