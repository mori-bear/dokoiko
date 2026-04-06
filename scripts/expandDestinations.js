/**
 * expandDestinations.js
 *
 * シードデータ（seeds/destinations_seed.json）から
 * destinations.json に追加できる完全エントリを生成する。
 *
 * 使い方:
 *   node scripts/expandDestinations.js
 *   → src/data/destinations.json にマージして上書き
 *   → 重複 id は既存エントリを優先してスキップ
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = join(__dir, '..');

const existing = JSON.parse(readFileSync(join(root, 'src/data/destinations.json'), 'utf8'));
const seeds    = JSON.parse(readFileSync(join(root, 'scripts/destinations_seed.json'), 'utf8'));

const existingIds = new Set(existing.map(d => d.id));

/* ── 地域 → railProvider マッピング ── */
const REGION_PROVIDER = {
  '北海道': 'ekinet',
  '東北':   'ekinet',
  '関東':   'ekinet',
  '中部':   'e5489',
  '近畿':   'e5489',
  '中国':   'e5489',
  '四国':   'e5489',
  '九州':   'jrkyushu',
  '沖縄':   null,
};

/* ── travelTime 最小値 → stayAllowed / stayRecommendation ── */
function deriveStay(travelTime) {
  const min = Math.min(...Object.values(travelTime).filter(v => v > 0));
  if (min < 120)  return { stayAllowed: ['daytrip', '1night'], stayRecommendation: 'daytrip' };
  if (min < 240)  return { stayAllowed: ['1night'],             stayRecommendation: '1night'  };
  if (min < 420)  return { stayAllowed: ['1night', '2night'],   stayRecommendation: '2night'  };
  return           { stayAllowed: ['2night'],                    stayRecommendation: '2night'  };
}

/* ── 地域 → hotelArea prefix ── */
const REGION_HOTEL_AREA = {
  '北海道': 'hokkaido',
  '東北':   null, // 県コードで対応
  '関東':   null,
  '中部':   null,
  '近畿':   null,
  '中国':   null,
  '四国':   null,
  '九州':   null,
  '沖縄':   'okinawa',
};

const PREF_HOTEL_AREA = {
  '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi', '秋田県': 'akita',
  '山形県': 'yamagata', '福島県': 'fukushima',
  '茨城県': 'ibaraki', '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama',
  '千葉県': 'chiba', '東京都': 'tokyo', '神奈川県': 'kanagawa',
  '新潟県': 'niigata', '富山県': 'toyama', '石川県': 'ishikawa', '福井県': 'fukui',
  '山梨県': 'yamanashi', '長野県': 'nagano', '岐阜県': 'gifu', '静岡県': 'shizuoka',
  '愛知県': 'aichi',
  '三重県': 'mie', '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka',
  '兵庫県': 'hyogo', '奈良県': 'nara', '和歌山県': 'wakayama',
  '鳥取県': 'tottori', '島根県': 'shimane', '岡山県': 'okayama', '広島県': 'hiroshima',
  '山口県': 'yamaguchi',
  '徳島県': 'tokushima', '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi',
  '福岡県': 'fukuoka', '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto',
  '大分県': 'oita', '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima',
  '沖縄県': 'okinawa',
};

function expand(seed) {
  const stay = deriveStay(seed.travelTime);
  const railProvider = seed.railProvider ?? REGION_PROVIDER[seed.region] ?? 'e5489';
  const hotelArea = seed.hotelArea ?? REGION_HOTEL_AREA[seed.region] ?? PREF_HOTEL_AREA[seed.prefecture] ?? null;

  const railGateway    = seed.railGateway    ?? seed.accessStation ?? null;
  const busGateway     = seed.busGateway     ?? null;
  const ferryGateway   = seed.ferryGateway   ?? null;
  const airportGateway = seed.airportGateway ?? null;

  const isIsland = seed.destType === 'island' || seed.isIsland === true;
  const requiresCar = seed.requiresCar ?? false;
  const secondaryTransport = seed.secondaryTransport ?? (requiresCar && !seed.destType?.match(/island/) ? 'car' : null);

  return {
    id:                seed.id,
    name:              seed.name,
    type:              'destination',
    region:            seed.region,
    hub:               seed.hub ?? null,
    hubCity:          seed.hubCity ?? seed.name,
    stayAllowed:       seed.stayAllowed ?? stay.stayAllowed,
    departures:        seed.departures ?? [],
    weight:            seed.weight ?? 1.2,
    description:       seed.description,
    tags:              seed.tags,
    spots:             seed.spots ?? [],
    shinkansenAccess:  seed.shinkansenAccess ?? false,
    requiresCar,
    hotelSearch:       seed.hotelSearch ?? seed.name,
    gateways: {
      rail:    railGateway ? [railGateway] : [],
      airport: airportGateway ? [airportGateway] : [],
      bus:     busGateway ? [busGateway] : [],
      ferry:   ferryGateway ? [ferryGateway] : [],
    },
    accessHub:         seed.accessHub ?? null,
    railNote:          seed.railNote ?? null,
    secondaryTransport,
    destType:          seed.destType ?? 'city',
    railGateway,
    busGateway,
    ferryGateway,
    airportGateway,
    prefecture:        seed.prefecture,
    lat:               seed.lat,
    lng:               seed.lng,
    stayBias:          1,
    hubCity:           seed.hubCity ?? seed.name,
    airportHub:        seed.airportHub ?? null,
    railProvider:      railProvider,
    travelTime:        seed.travelTime,
    stayRecommendation: seed.stayRecommendation ?? stay.stayRecommendation,
    city:              seed.city ?? seed.name,
    hubStation:        seed.hubStation ?? railGateway,
    accessStation:     seed.accessStation ?? railGateway,
    hotelArea,
    hotelKeyword:      seed.hotelKeyword ?? seed.name,
    ...(seed.finalPoint ? { finalPoint: seed.finalPoint } : {}),
    ...(seed.isIsland   ? { isIsland: true } : {}),
    ...(seed.jalanPath  ? { jalanPath: seed.jalanPath } : {}),
    access: seed.access ?? {
      steps: railGateway ? [{
        type: 'rail',
        to: railGateway,
        provider: railProvider === 'ekinet' ? 'えきねっと' : railProvider === 'jrkyushu' ? 'JR九州ネット予約' : 'e5489',
      }] : [],
    },
  };
}

const expanded = [];
let skipped = 0;
for (const seed of seeds) {
  if (existingIds.has(seed.id)) {
    skipped++;
    continue;
  }
  expanded.push(expand(seed));
}

const merged = [...existing, ...expanded];
writeFileSync(join(root, 'src/data/destinations.json'), JSON.stringify(merged, null, 2), 'utf8');
console.log(`✓ destinations.json 更新完了`);
console.log(`  既存: ${existing.length} 件`);
console.log(`  追加: ${expanded.length} 件`);
console.log(`  スキップ（重複）: ${skipped} 件`);
console.log(`  合計: ${merged.length} 件`);
