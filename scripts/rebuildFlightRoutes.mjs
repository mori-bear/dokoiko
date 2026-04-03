/**
 * rebuildFlightRoutes.mjs
 *
 * FLIGHT_ROUTES IATA マトリクス（qa.js と同一データ）から
 * src/data/flightRoutes.json を再生成する。
 *
 * 出力形式: [{ "from": "東京", "to": "那覇空港" }, ...]
 *
 * 実行: node scripts/rebuildFlightRoutes.mjs
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/* ── 出発都市 → 出発空港 IATA ── */
const CITY_AIRPORT = {
  '札幌':   'CTS', '函館':   'HKD', '旭川':   'AKJ', '仙台':   'SDJ', '盛岡':   'HNA',
  '東京':   'HND', '横浜':   'HND', '千葉':   'NRT', '大宮':   'HND', '宇都宮': 'HND',
  '長野':   'MMJ', '静岡':   'FSZ', '名古屋': 'NGO', '金沢':   'KMQ', '富山':   'TOY',
  '大阪':   'ITM', '京都':   'ITM', '神戸':   'UKB', '奈良':   'ITM',
  '広島':   'HIJ', '岡山':   'OKJ', '松江':   'IZO',
  '高松':   'TAK', '松山':   'MYJ', '高知':   'KCZ', '徳島':   'TKS',
  '福岡':   'FUK', '熊本':   'KMJ', '鹿児島': 'KOJ', '長崎':   'NGS', '宮崎':   'KMI',
};

/* ── 空港名 → IATA ── */
const AIRPORT_IATA = {
  '新千歳空港':         'CTS',
  '那覇空港':           'OKA',
  '石垣空港':           'ISG',
  '福岡空港':           'FUK',
  '仙台空港':           'SDJ',
  '広島空港':           'HIJ',
  '高松空港':           'TAK',
  '中部国際空港':       'NGO',
  '羽田空港':           'HND',
  '大阪国際空港':       'ITM',
  '関西国際空港':       'KIX',
  '宮崎空港':           'KMI',
  '松山空港':           'MYJ',
  '釧路空港':           'KUH',
  '久米島空港':         'UEO',
  '宮古空港':           'MMY',
  '米子空港':           'YGJ',
  '女満別空港':         'MMB',
  '中標津空港':         'SHB',
  '屋久島空港':         'KUM',
  '奄美空港':           'ASJ',
  '五島福江空港':       'FUJ',
  '青森空港':           'AOJ',
  '阿蘇くまもと空港':   'KMJ',
  '静岡空港':           'FSZ',
  '出雲縁結び空港':     'IZO',
  '小松空港':           'KMQ',
  '大分空港':           'OIT',
  '南紀白浜空港':       'SHM',
  '対馬空港':           'TSJ',
  '種子島空港':         'TNE',
  '壱岐空港':           'IKI',
  '庄内空港':           'SYO',
  '徳島阿波おどり空港': 'TKS',
  '旭川空港':           'AKJ',
  '松本空港':           'MMJ',
  '岡山桃太郎空港':     'OKJ',
  '与那国空港':         'OGN',
  '長崎空港':           'NGS',
  '高知龍馬空港':       'KCZ',
  '鹿児島空港':         'KOJ',
  '函館空港':           'HKD',
  '富山きときと空港':   'TOY',
  '神戸空港':           'UKB',
  'いわて花巻空港':     'HNA',
};

/* ── 就航路線 IATA マトリクス（qa.js の FLIGHT_ROUTES と同一） ── */
const FLIGHT_ROUTES = {
  'HND': ['CTS','MMB','KUH','SHB','AOJ','SDJ','HNA','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','OIT','HIJ','OKJ','MYJ','KCZ','TKS','TAK','YGJ','IZO','FSZ','KUM','ASJ','FUJ','KMQ','SHM','SYO','OGN','TNE'],
  'ITM': ['CTS','SDJ','SYO','AOJ','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','MYJ','KCZ','TKS','KUM','ASJ','FUJ'],
  'NRT': ['CTS','OKA','FUK','SDJ'],
  'NGO': ['CTS','SDJ','OKA','FUK','KOJ','KMI'],
  'FUK': ['HND','ITM','NGO','CTS','SDJ','OKA','ISG','MMY','UEO','KUM','ASJ','TSJ','IKI'],
  'CTS': ['HND','ITM','NGO','FUK','SDJ','OKA'],
  'SDJ': ['HND','ITM','FUK','CTS','OKA','HIJ'],
  'HIJ': ['HND','SDJ','OKA','FUK'],
  'TAK': ['HND','FUK','OKA'],
  'MYJ': ['HND','ITM','FUK'],
  'KCZ': ['HND','ITM','FUK'],
  'TKS': ['HND','ITM','FUK'],
  'KOJ': ['HND','ITM','NGO','OKA','TNE'],
  'KMI': ['HND','ITM','FUK','OKA'],
  'KMJ': ['HND','ITM'],
  'NGS': ['HND','ITM','TSJ'],
  'OKJ': ['HND','OKA'],
  'IZO': ['HND','ITM'],
  'YGJ': ['HND'],
  'KMQ': ['HND'],
  'TOY': ['HND'],
  'OIT': ['HND','ITM'],
  'SHM': ['HND'],
  'UKB': ['OKA','FUK'],
  'HKD': ['HND'],
  'AKJ': ['HND','ITM'],
  'HNA': ['HND','ITM'],
  'MMJ': ['HND'],
  'FSZ': ['HND','FUK'],
  'TSJ': ['FUK','NGS'],
  'TNE': ['KOJ'],
  'IKI': ['FUK'],
  'SYO': ['HND','ITM'],
  'OGN': ['OKA','ISG'],
};

/* ── IATA → [空港名] 逆引き ── */
const IATA_TO_AIRPORTS = {};
for (const [airport, iata] of Object.entries(AIRPORT_IATA)) {
  if (!IATA_TO_AIRPORTS[iata]) IATA_TO_AIRPORTS[iata] = [];
  IATA_TO_AIRPORTS[iata].push(airport);
}

/* ── 生成 ── */
const entries = [];

for (const [city, fromIata] of Object.entries(CITY_AIRPORT)) {
  const reachableIata = FLIGHT_ROUTES[fromIata] ?? [];
  for (const toIata of reachableIata) {
    const airports = IATA_TO_AIRPORTS[toIata] ?? [];
    for (const airport of airports) {
      entries.push({ from: city, to: airport });
    }
  }
}

/* ── 重複除去（同じ from+to を1件に）── */
const seen = new Set();
const unique = entries.filter(e => {
  const key = `${e.from}::${e.to}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

/* ── ソート（from → to 順）── */
unique.sort((a, b) => {
  if (a.from < b.from) return -1;
  if (a.from > b.from) return 1;
  return a.to.localeCompare(b.to, 'ja');
});

const outPath = resolve(ROOT, 'src/data/flightRoutes.json');
writeFileSync(outPath, JSON.stringify(unique, null, 2), 'utf8');

console.log(`✓ flightRoutes.json 再生成: ${unique.length} 件`);

/* ── 統計 ── */
const byCityFrom = {};
for (const e of unique) {
  if (!byCityFrom[e.from]) byCityFrom[e.from] = 0;
  byCityFrom[e.from]++;
}
console.log('\n出発地別 就航先数:');
for (const [city, count] of Object.entries(byCityFrom).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${city}: ${count} 空港`);
}
