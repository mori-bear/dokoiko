// scripts/migrateBookingData.js
// bookingStation / mainSpot / stayArea を全件付与するマイグレーション
//
// bookingStation の決定ルール:
//   1. 島 → null（フェリーアクセス）
//   2. railGateway なし → null
//   3. railGateway の駅名が目的地名を含む → その駅名（駅suffix除去）
//   4. hubCity === name（目的地自体が都市 → 直接アクセス可） → railGateway の駅名
//   5. それ以外（hub都市経由でバス/車が必要） → null
//
// mainSpot: spots[0] または name
// stayArea: { rakuten: hotelSearch, jalan: hotelSearch }

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath  = path.join(__dirname, '../src/data/destinations.json');
const data      = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

/** 駅/空港/港 suffix 除去 */
function cleanStation(s) {
  return String(s ?? '').replace(/駅$|空港$|港$/, '').trim();
}

/**
 * bookingStation を推定する。
 * 実在する JR 最寄り駅が目的地のアクセス拠点のときのみ設定。
 * 目的地自体に JR 駅がない（バス・車が必要）場合は null。
 */
function inferBookingStation(dest) {
  const name = dest.displayName || dest.name || '';
  const hub  = dest.hubCity || '';
  const rg   = dest.railGateway || '';
  const dt   = dest.destType || '';

  // 島 → null（船でアクセス）
  if (dt === 'island' || dest.isIsland) return null;

  // railGateway がない → null
  if (!rg) return null;

  const station = cleanStation(rg);

  // ケース①: railGateway の駅名が目的地名を含む
  //   例: "加賀温泉駅" → "加賀温泉" ⊃ "加賀温泉"
  if (station.includes(name) || (name.length >= 2 && station.startsWith(name.slice(0, 2)))) {
    // 前方一致2文字は誤検知リスクがあるため「含む」条件を優先
    if (station.includes(name)) return station;
  }

  // ケース②: hubCity === name（目的地自体が拠点都市）
  //   例: 鎌倉(hub=鎌倉), 草津温泉(hub=草津温泉), 軽井沢(hub=軽井沢)
  if (hub && hub === name) return station;

  // それ以外: 目的地とは別の都市の駅 → バス/車が必要 → null
  return null;
}

/**
 * mainSpot を決定する。
 * spots[0] があればそれ、なければ destination name。
 */
function inferMainSpot(dest) {
  const spots = dest.spots || [];
  if (spots.length > 0) {
    const first = spots[0];
    return typeof first === 'object' ? (first.name || dest.name) : String(first);
  }
  return dest.displayName || dest.name || '';
}

/**
 * stayArea を決定する。
 * hotelSearch（既存フィールド）があればそれを使用。
 * なければ hubCity（hub≠name の場合）か destination name。
 */
function inferStayArea(dest) {
  const hs   = dest.hotelSearch;
  const name = dest.displayName || dest.name || '';
  const hub  = dest.hubCity || '';

  if (hs) return { rakuten: hs, jalan: hs };

  // mountain/remote は hubCity で宿を探すことが多い
  const dt = dest.destType || '';
  if (hub && hub !== name && (dt === 'mountain' || dt === 'remote')) {
    return { rakuten: hub, jalan: hub };
  }

  return { rakuten: name, jalan: name };
}

let ok = 0, skip = 0;

data.forEach(dest => {
  if (dest.type !== 'destination') { skip++; return; }

  const bookingStation = inferBookingStation(dest);
  const mainSpot       = inferMainSpot(dest);
  const stayArea       = inferStayArea(dest);

  dest.bookingStation = bookingStation;
  dest.mainSpot       = mainSpot;
  dest.stayArea       = stayArea;

  ok++;
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`SUCCESS: ${ok} / SKIP: ${skip}`);

// サンプル確認（5件）
const samples = ['kamakura', 'ryujin-onsen', 'kusatsu-onsen', 'nikko', 'amami'];
console.log('\n--- サンプル確認 ---');
data.forEach(d => {
  if (samples.includes(d.id)) {
    console.log(`${d.name}: bookingStation=${JSON.stringify(d.bookingStation)} mainSpot=${JSON.stringify(d.mainSpot)}`);
    console.log(`  stayArea: ${JSON.stringify(d.stayArea)}`);
  }
});
