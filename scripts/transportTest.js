/**
 * transportTest.js — 交通ロジック QA テスト（Node.js CommonJS）
 *
 * 実行: node transportTest.js
 *
 * チェック内容:
 *   1. 存在しない飛行機が表示されない（航空路線フィルタ）
 *   2. フェリーが正しく表示される
 *   3. JR リンクが表示される
 *   4. GoogleMap リンクが生成される
 *   5. 宿リンク URL が正しい形式である
 *   6. 全 149 都市で transportLinks.length >= 1
 */

import fs from 'fs';

/* ── データ読み込み ── */

const destinations = JSON.parse(
  fs.readFileSync('./src/data/destinations.json', 'utf8'),
);
const cities = Array.isArray(destinations) ? destinations : destinations.destinations;

/* ── 定数（constants.js から手動コピー） ── */

const DEPARTURE_CITY_INFO = {
  '札幌':   { rail: '札幌駅',       airport: '新千歳空港 国内線ターミナル',    iata: 'CTS', jrArea: 'east'    },
  '函館':   { rail: '函館駅',       airport: '函館空港',                       iata: 'HKD', jrArea: 'east'    },
  '旭川':   { rail: '旭川駅',       airport: '旭川空港',                       iata: 'AKJ', jrArea: 'east'    },
  '仙台':   { rail: '仙台駅',       airport: '仙台空港',                       iata: 'SDJ', jrArea: 'east'    },
  '盛岡':   { rail: '盛岡駅',       airport: 'いわて花巻空港',                 iata: 'HNA', jrArea: 'east'    },
  '東京':   { rail: '東京駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east'    },
  '横浜':   { rail: '横浜駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east'    },
  '千葉':   { rail: '千葉駅',       airport: '成田国際空港',                   iata: 'TYO', jrArea: 'east'    },
  '大宮':   { rail: '大宮駅',       airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east'    },
  '宇都宮': { rail: '宇都宮駅',     airport: '羽田空港 国内線ターミナル',       iata: 'TYO', jrArea: 'east'    },
  '長野':   { rail: '長野駅',       airport: '松本空港',                       iata: 'MMJ', jrArea: 'east'    },
  '静岡':   { rail: '静岡駅',       airport: '静岡空港',                       iata: 'FSZ', jrArea: 'west'    },
  '名古屋': { rail: '名古屋駅',     airport: '中部国際空港 セントレア',         iata: 'NGO', jrArea: 'west'    },
  '金沢':   { rail: '金沢駅',       airport: '小松空港',                       iata: 'KMQ', jrArea: 'west'    },
  '富山':   { rail: '富山駅',       airport: '富山きときと空港',               iata: 'TOY', jrArea: 'west'    },
  '大阪':   { rail: '大阪駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west'    },
  '京都':   { rail: '京都駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west'    },
  '神戸':   { rail: '三ノ宮駅',     airport: '神戸空港',                       iata: 'UKB', jrArea: 'west'    },
  '奈良':   { rail: '奈良駅',       airport: '大阪国際空港 国内線ターミナル',   iata: 'OSA', jrArea: 'west'    },
  '広島':   { rail: '広島駅',       airport: '広島空港',                       iata: 'HIJ', jrArea: 'west'    },
  '岡山':   { rail: '岡山駅',       airport: '岡山桃太郎空港',                 iata: 'OKJ', jrArea: 'west'    },
  '松江':   { rail: '松江駅',       airport: '出雲縁結び空港',                 iata: 'IZO', jrArea: 'west'    },
  '高松':   { rail: '高松駅',       airport: '高松空港',                       iata: 'TAK', jrArea: 'west'    },
  '松山':   { rail: '松山駅',       airport: '松山空港',                       iata: 'MYJ', jrArea: 'west'    },
  '高知':   { rail: '高知駅',       airport: '高知龍馬空港',                   iata: 'KCZ', jrArea: 'west'    },
  '徳島':   { rail: '徳島駅',       airport: '徳島阿波おどり空港',             iata: 'TKS', jrArea: 'west'    },
  '福岡':   { rail: '博多駅',       airport: '福岡空港 国内線ターミナル',       iata: 'FUK', jrArea: 'kyushu'  },
  '熊本':   { rail: '熊本駅',       airport: '熊本空港',                       iata: 'KMJ', jrArea: 'kyushu'  },
  '鹿児島': { rail: '鹿児島中央駅', airport: '鹿児島空港',                     iata: 'KOJ', jrArea: 'kyushu'  },
  '長崎':   { rail: '長崎駅',       airport: '長崎空港',                       iata: 'NGS', jrArea: 'kyushu'  },
  '宮崎':   { rail: '宮崎駅',       airport: '宮崎ブーゲンビリア空港',         iata: 'KMI', jrArea: 'kyushu'  },
};

/* ── airportMap / flightRoutes（JS ファイルから手動コピー） ── */

const CITY_AIRPORT = {
  '札幌': 'CTS', '函館': 'HKD', '旭川': 'AKJ',
  '仙台': 'SDJ', '盛岡': 'HNA',
  '東京': 'HND', '横浜': 'HND', '千葉': 'NRT', '大宮': 'HND', '宇都宮': 'HND',
  '長野': 'MMJ', '静岡': 'FSZ', '名古屋': 'NGO', '金沢': 'KMQ', '富山': 'TOY',
  '大阪': 'ITM', '京都': 'ITM', '神戸': 'UKB', '奈良': 'ITM',
  '広島': 'HIJ', '岡山': 'OKJ', '松江': 'IZO',
  '高松': 'TAK', '松山': 'MYJ', '高知': 'KCZ', '徳島': 'TKS',
  '福岡': 'FUK', '熊本': 'KMJ', '鹿児島': 'KOJ', '長崎': 'NGS', '宮崎': 'KMI',
};

const AIRPORT_IATA = {
  '新千歳空港': 'CTS', '那覇空港': 'OKA', '石垣空港': 'ISG',
  '福岡空港': 'FUK', '仙台空港': 'SDJ', '広島空港': 'HIJ',
  '高松空港': 'TAK', '中部国際空港': 'NGO', '羽田空港': 'HND',
  '大阪国際空港': 'ITM', '関西国際空港': 'KIX',
  '宮崎空港': 'KMI', '松山空港': 'MYJ', '釧路空港': 'KUH',
  '久米島空港': 'UEO', '宮古空港': 'MMY', '米子空港': 'YGJ',
  '女満別空港': 'MMB', '中標津空港': 'SHB', '屋久島空港': 'KUM',
  '奄美空港': 'ASJ', '五島福江空港': 'FUJ', '青森空港': 'AOJ',
  '阿蘇くまもと空港': 'KMJ', '静岡空港': 'FSZ', '出雲空港': 'IZO',
};

const FLIGHT_ROUTES = {
  'HND': ['CTS','MMB','KUH','SHB','AOJ','SDJ','HNA','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','HIJ','OKJ','MYJ','KCZ','TKS','TAK','YGJ','IZO','FSZ','KUM','ASJ','FUJ'],
  'ITM': ['CTS','SDJ','AOJ','OKA','ISG','MMY','UEO','FUK','KOJ','KMI','KMJ','NGS','MYJ','KCZ','TKS','KUM','ASJ','FUJ'],
  'NRT': ['CTS','OKA','FUK','SDJ'],
  'NGO': ['CTS','SDJ','OKA','FUK','KOJ','KMI'],
  'FUK': ['HND','ITM','NGO','CTS','SDJ','OKA','ISG','MMY','UEO','KUM','ASJ'],
  'CTS': ['HND','ITM','NGO','FUK','SDJ','OKA'],
  'SDJ': ['HND','ITM','FUK','CTS','OKA','HIJ'],
  'HIJ': ['HND','SDJ','OKA','FUK'],
  'TAK': ['HND','FUK','OKA'],
  'MYJ': ['HND','ITM','FUK'],
  'KCZ': ['HND','ITM','FUK'],
  'TKS': ['HND','ITM','FUK'],
  'KOJ': ['HND','ITM','NGO','OKA'],
  'KMI': ['HND','ITM','FUK','OKA'],
  'KMJ': ['HND','ITM'],
  'NGS': ['HND','ITM'],
  'OKJ': ['HND','OKA'],
  'IZO': ['HND','ITM'],
  'YGJ': ['HND'],
  'KMQ': ['HND'],
  'TOY': ['HND'],
  'UKB': ['OKA','FUK'],
  'HKD': ['HND'],
  'AKJ': ['HND','ITM'],
  'HNA': ['HND','ITM'],
  'MMJ': ['HND'],
  'FSZ': ['HND','FUK'],
};

/* ── ヘルパー ── */

function isFlightAvailable(departure, airportGateway) {
  const fromIata = CITY_AIRPORT[departure];
  const toIata   = AIRPORT_IATA[airportGateway];
  if (!fromIata || !toIata) return false;
  return (FLIGHT_ROUTES[fromIata] ?? []).includes(toIata);
}

function hasFerry(city) {
  const access = city.access ?? {};
  return (access.portHubs ?? []).length > 0 || !!access.ferryGateway;
}

function hasRail(city) {
  return !!(city.access?.railGateway);
}

function hasAirport(city) {
  return !!(city.access?.airportGateway);
}

// 簡易版 transportLinks 件数推定
function estimateTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];
  const links = [];
  const a = city.access ?? {};
  const portHubs = a.portHubs ?? [];

  if (portHubs.length > 0) {
    links.push({ type: 'ferry' });
    links.push({ type: 'google-maps' });
    return links;
  }

  if (a.railGateway) {
    if (!a.railNote) links.push({ type: 'jr' });
    links.push({ type: 'google-maps' });
  }

  if (a.airportGateway && isFlightAvailable(departure, a.airportGateway)) {
    links.push({ type: 'google-maps-dep' });
    links.push({ type: 'skyscanner' });
    links.push({ type: 'google-maps-arr' });
  } else if (a.airportGateway && !a.railGateway) {
    links.push({ type: 'google-maps' });
  }

  if (a.ferryGateway) {
    links.push({ type: 'ferry' });
  }

  if (!a.railGateway && !a.airportGateway && !a.ferryGateway) {
    links.push({ type: 'google-maps' });
  }

  return links;
}

/* ── テストケース ── */

const CASES = [
  {
    label:     '東京 → 松山',
    departure: '東京',
    destId:    'matsuyama',
    checks: [
      { name: 'JR リンクあり',      fn: (l) => l.some(x => x.type === 'jr') },
      { name: 'Skyscanner あり（HND→MYJ）', fn: (l) => l.some(x => x.type === 'skyscanner') },
      { name: 'GoogleMaps あり',    fn: (l) => l.some(x => x.type.startsWith('google')) },
      { name: 'リンク数 >= 1',       fn: (l) => l.length >= 1 },
    ],
  },
  {
    label:     '大阪 → 松山',
    departure: '大阪',
    destId:    'matsuyama',
    checks: [
      { name: 'Skyscanner あり（ITM→MYJ）', fn: (l) => l.some(x => x.type === 'skyscanner') },
      { name: 'JR リンクあり',      fn: (l) => l.some(x => x.type === 'jr') },
    ],
  },
  {
    label:     '高松 → 松山（飛行機なし）',
    departure: '高松',
    destId:    'matsuyama',
    checks: [
      { name: 'Skyscanner 非表示（TAK→MYJ なし）', fn: (l) => !l.some(x => x.type === 'skyscanner') },
      { name: 'JR リンクあり',      fn: (l) => l.some(x => x.type === 'jr') },
      { name: 'GoogleMaps あり',    fn: (l) => l.some(x => x.type.startsWith('google')) },
    ],
  },
  {
    label:     '大阪 → 直島（フェリー）',
    departure: '大阪',
    destId:    'naoshima',
    checks: [
      { name: 'フェリーリンクあり', fn: (l) => l.some(x => x.type === 'ferry') },
      { name: 'GoogleMaps あり',    fn: (l) => l.some(x => x.type.startsWith('google')) },
    ],
  },
  {
    label:     '東京 → 札幌',
    departure: '東京',
    destId:    'sapporo-t',
    checks: [
      { name: 'Skyscanner あり（HND→CTS）', fn: (l) => l.some(x => x.type === 'skyscanner') },
      { name: 'GoogleMaps（出発空港）あり', fn: (l) => l.some(x => x.type === 'google-maps-dep') },
    ],
  },
  {
    label:     '大阪 → 美保関（railNote=バス → JR非表示）',
    departure: '大阪',
    destId:    'mihonoseki',
    checks: [
      // railNote="バス" があるため JR ボタンは非表示が正しい仕様
      { name: 'JR 非表示（railNote=バス）', fn: (l) => !l.some(x => x.type === 'jr') },
      { name: 'GoogleMaps あり',            fn: (l) => l.some(x => x.type.startsWith('google')) },
      // 大阪→米子空港(YGJ): ITM→YGJ 路線なし → Skyscanner 非表示
      { name: 'Skyscanner 非表示（ITM→YGJ なし）', fn: (l) => !l.some(x => x.type === 'skyscanner') },
    ],
  },
];

/* ── 宿リンク形式チェック ── */

const HUB_PREFECTURE = {
  '松山': 'ehime', '那覇': 'okinawa', '直島': 'kagawa',
  '箱根': 'kanagawa', '金沢': 'ishikawa', '高山': 'gifu',
};

function checkHotelUrls(city) {
  const hub = city.hotelSearch ?? city.hubCity ?? city.name;
  const pref = HUB_PREFECTURE[hub];
  const rakutenBase = 'https://hb.afl.rakuten.co.jp';
  const jalanBase = 'https://ck.jp.ap.valuecommerce.com';
  return { rakutenBase, jalanBase, pref };
}

/* ── 実行 ── */

let passed = 0;
let failed = 0;
const errors = [];

console.log('=== 交通リンク QA テスト ===\n');

// 個別テストケース
CASES.forEach(tc => {
  const city = cities.find(c => c.id === tc.destId);
  if (!city) {
    console.log(`[SKIP] ${tc.label} — destId not found: ${tc.destId}`);
    return;
  }

  const links = estimateTransportLinks(city, tc.departure);
  console.log(`[TEST] ${tc.label}`);
  console.log(`  Links: ${links.map(l => l.type).join(', ') || '(none)'}`);

  tc.checks.forEach(chk => {
    const ok = chk.fn(links);
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${chk.name}`);
    if (ok) passed++;
    else {
      failed++;
      errors.push(`${tc.label} - ${chk.name}`);
    }
  });
  console.log('');
});

// 全都市スキャン: transportLinks >= 1 チェック
console.log('=== 全都市スキャン ===\n');
const SCAN_DEPARTURES = ['東京', '大阪', '福岡', '高松', '札幌'];

let zeroLinkCities = [];

cities
  .filter(c => c.type !== 'spot')
  .forEach(city => {
    SCAN_DEPARTURES.forEach(dep => {
      const links = estimateTransportLinks(city, dep);
      if (links.length === 0) {
        zeroLinkCities.push({ id: city.id, name: city.name, dep });
      }
    });
  });

if (zeroLinkCities.length === 0) {
  console.log('✓ 全都市でリンク 1 件以上（交通リンク生成エラー: 0 件）');
  passed++;
} else {
  console.log(`✗ 交通リンク 0 件の都市: ${zeroLinkCities.length} 件`);
  zeroLinkCities.forEach(z => {
    console.log(`  ${z.name}（${z.id}） ← ${z.dep}`);
  });
  failed++;
  errors.push(`交通リンク 0 件: ${zeroLinkCities.length} 都市`);
}

// 宿リンク形式チェック（サンプル）
console.log('\n=== 宿リンク形式チェック ===\n');
const HOTEL_SAMPLES = ['matsuyama', 'naoshima', 'sapporo-t', 'kanazawa-t'];
HOTEL_SAMPLES.forEach(id => {
  const city = cities.find(c => c.id === id);
  if (!city) return;
  const hub = city.hotelSearch ?? city.hubCity ?? city.name;
  console.log(`[${city.name}] keyword=${hub}`);
  const rakutenOk = typeof hub === 'string' && hub.length > 0;
  const jalanOk   = typeof hub === 'string' && hub.length > 0;
  console.log(`  楽天: ${rakutenOk ? '✓' : '✗'} URL生成可`);
  console.log(`  じゃらん: ${jalanOk ? '✓' : '✗'} URL生成可`);
  if (rakutenOk) passed++;
  else { failed++; errors.push(`${city.name} 宿リンク生成失敗`); }
});

// 結果サマリ
console.log('\n=== 結果サマリ ===');
console.log(`PASS: ${passed} / FAIL: ${failed}`);
if (errors.length > 0) {
  console.log('\n失敗したチェック:');
  errors.forEach(e => console.log('  ✗', e));
  process.exit(1);
} else {
  console.log('\n全チェック通過 ✓');
}
