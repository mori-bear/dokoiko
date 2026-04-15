// scripts/enforceDestinationRules.js
// 離島・山奥温泉・港町に対してルールを一括適用する
//
// ■ 離島:  bookingStation=null / accessType=ferry|plane / hubCity=最寄り都市
// ■ 山奥温泉: accessType=car（requiresCar=true のもの）
// ■ 港町: railGateway設定済みでbookingStationなし → bookingStation を付与
//
// node scripts/enforceDestinationRules.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTS_PATH = path.join(__dirname, '../src/data/destinations.json');
const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf-8'));

let changed = 0;

function mark(d, field, value, reason) {
  if (JSON.stringify(d[field]) !== JSON.stringify(value)) {
    console.log(`  ${d.id} [${d.name}] ${field}: ${JSON.stringify(d[field])} → ${JSON.stringify(value)}  (${reason})`);
    d[field] = value;
    changed++;
  }
}

// ── ① 離島ルール ─────────────────────────────────────────────────────

console.log('\n【① 離島】');

for (const d of dests) {
  const isIsland = d.destType === 'island' || d.isIsland === true;
  if (!isIsland) continue;

  // bookingStation: 必ず null
  mark(d, 'bookingStation', null, '離島はbookingStation不要');

  // accessType: ferryGateway があれば ferry、空港のみなら plane
  const hasFerry  = !!d.ferryGateway;
  const hasAir    = !!d.airportGateway;
  const expected  = hasFerry ? 'ferry' : hasAir ? 'plane' : null;
  if (expected) mark(d, 'accessType', expected, hasFerry ? 'フェリーでの到達' : '飛行機での到達');
}

// ── ② 山奥温泉ルール ─────────────────────────────────────────────────

console.log('\n【② 山奥温泉（requiresCar=true）】');

for (const d of dests) {
  if (d.destType !== 'onsen') continue;
  if (!d.requiresCar) continue;

  // accessType: 'car'
  mark(d, 'accessType', 'car', '山奥温泉・車必須');
}

// ── ③ 港町ルール（railGateway設定済みだがbookingStationなし）────────

console.log('\n【③ 港町・bookingStation補完】');

// 手動マッピング: id → bookingStation
const BOOKING_FIX = {
  'mihonoseki': { name: '境港駅',    company: 'JR' },  // JR境線
  'iga':        { name: '伊賀上野駅', company: 'JR' },  // JR関西本線
  'matsushiro': { name: '長野駅',    company: 'JR' },  // JR北陸新幹線
};

for (const [id, station] of Object.entries(BOOKING_FIX)) {
  const d = dests.find(x => x.id === id);
  if (!d) { console.log(`  ⚠ 見つからない: ${id}`); continue; }
  mark(d, 'bookingStation', station, `railGateway=${d.railGateway} → bookingStation補完`);
}

// ── ④ 港町・accessType 補完（city系でrequiresCar or ferryGateway）────

console.log('\n【④ 港町・accessType補完】');

// ルール: ferryGateway あり → ferry / requiresCar あり → car
for (const d of dests) {
  if (d.destType !== 'city') continue;
  if (d.accessType) continue;  // 設定済みはスキップ

  if (d.ferryGateway) {
    mark(d, 'accessType', 'ferry', '港町・フェリーアクセス');
  } else if (d.requiresCar) {
    mark(d, 'accessType', 'car', '港町・車必須');
  }
}

// ── 保存 ─────────────────────────────────────────────────────────────

fs.writeFileSync(DESTS_PATH, JSON.stringify(dests, null, 2), 'utf-8');
console.log(`\n✓ 修正完了: ${changed}件のフィールドを更新`);
