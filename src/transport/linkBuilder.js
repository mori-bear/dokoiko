/**
 * 交通リンクビルダー
 *
 * ボタン文言ルール:
 *   Google Maps → 「所要時間を見る（Googleマップ）」
 *   Skyscanner  → 「航空券を比較する（Skyscanner）」
 *   JR予約      → 「JRを予約する（会社名）」
 *   EX          → 「新幹線を予約する（EX）」
 *   レンタカー  → 「レンタカーを探す（じゃらん）」
 *   スラッシュ禁止・空港名などをボタン文言に含めない
 */

/* ── 内部ユーティリティ ── */

function unixSec() {
  return Math.floor((Date.now() + 1800000) / 1000);
}

function transitUrl(origin, destination) {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    '&travelmode=transit' +
    `&departure_time=${unixSec()}`
  );
}

function drivingUrl(origin, destination) {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    '&travelmode=driving' +
    `&departure_time=${unixSec()}`
  );
}

/* ── Skyscanner 空港名→IATAマップ ── */

const AIRPORT_IATA = {
  '新千歳空港':       'CTS',
  '那覇空港':         'OKA',
  '石垣空港':         'ISG',
  '福岡空港':         'FUK',
  '仙台空港':         'SDJ',
  '広島空港':         'HIJ',
  '高松空港':         'TAK',
  '中部国際空港':     'NGO',
  '羽田空港':         'HND',
  '大阪国際空港':     'ITM',
  '関西国際空港':     'KIX',
  '宮崎空港':         'KMI',
  '松山空港':         'MYJ',
  '釧路空港':         'KUH',
  '久米島空港':       'UEO',
  '宮古空港':         'MMY',
};

/* ── Google Maps（鉄道・バス・フェリー） ── */

export function buildTransitLink(origin, destination) {
  return {
    type: 'google-maps',
    label: '所要時間を見る（Googleマップ）',
    url: transitUrl(origin, destination),
  };
}

/* ── Google Maps（航空: 空港→空港 driving） ── */

export function buildAirMapsLink(fromAirport, toAirport) {
  return {
    type: 'google-maps',
    label: '所要時間を見る（Googleマップ）',
    url: drivingUrl(fromAirport, toAirport),
  };
}

/* ── Skyscanner ── */

export function buildSkyscannerLink(fromIata, toAirportName) {
  const toIata = AIRPORT_IATA[toAirportName];
  if (!toIata) return null;
  return {
    type: 'skyscanner',
    label: '航空券を比較する（Skyscanner）',
    url: `https://www.skyscanner.jp/transport/flights/${fromIata.toLowerCase()}/${toIata.toLowerCase()}/`,
  };
}

/* ── JR予約 ── */

export function buildJrLink(region) {
  switch (region) {
    case 'east':
      return {
        type: 'jr-east',
        label: 'JRを予約する（えきねっと）',
        url: 'https://www.eki-net.com/',
      };
    case 'central_west_shikoku':
      return {
        type: 'jr-west',
        label: 'JRを予約する（e5489）',
        url: 'https://www.jr-odekake.net/goyoyaku/',
      };
    case 'kyushu':
      return {
        type: 'jr-kyushu',
        label: 'JRを予約する（九州ネット予約）',
        url: 'https://train.yoyaku.jrkyushu.co.jp/',
      };
    default:
      return null;
  }
}

/* ── EX ── */

export function buildJrExLink() {
  return {
    type: 'jr-ex',
    label: '新幹線を予約する（EX）',
    url: 'https://expy.jp/',
  };
}

/* ── レンタカー ── */

export function buildRentalLink() {
  return {
    type: 'rental',
    label: 'レンタカーを探す（じゃらん）',
    url: 'https://www.jalan.net/rentacar/',
  };
}
