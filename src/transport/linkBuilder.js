/**
 * 交通リンクビルダー
 *
 * ボタン文言ルール:
 *   Google Maps → 「所要時間を見る（Googleマップ）」
 *   Skyscanner  → 「航空券を比較する（Skyscanner）」
 *   JR予約      → 各社1ボタン（ekinet/e5489/ex/jrkyushu）
 *   レンタカー  → 「レンタカーを探す（じゃらん）」
 *
 * 注意:
 *   - 飛行機経路の Google Maps（driving）は使用しない
 *   - 詳細な所要時間はすべて外部サービスへ委ねる
 */

/* ── 内部ユーティリティ ── */

function datetimeToUnix(datetimeStr) {
  if (datetimeStr) {
    const t = new Date(datetimeStr).getTime();
    if (!isNaN(t)) return Math.floor(t / 1000);
  }
  return Math.floor((Date.now() + 1800000) / 1000);
}

function mapsUrl(origin, destination, mode, unix) {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${mode}` +
    `&departure_time=${unix}`
  );
}

/* ── Skyscanner 空港名→IATAマップ ── */

const AIRPORT_IATA = {
  '新千歳空港':   'CTS',
  '那覇空港':     'OKA',
  '石垣空港':     'ISG',
  '福岡空港':     'FUK',
  '仙台空港':     'SDJ',
  '広島空港':     'HIJ',
  '高松空港':     'TAK',
  '中部国際空港': 'NGO',
  '羽田空港':     'HND',
  '大阪国際空港': 'ITM',
  '関西国際空港': 'KIX',
  '宮崎空港':     'KMI',
  '松山空港':     'MYJ',
  '釧路空港':     'KUH',
  '久米島空港':   'UEO',
  '宮古空港':     'MMY',
  '米子空港':     'YGJ',
};

/* ── Google Maps（transit / driving 統一） ── */

export function buildGoogleMapsLink(origin, destination, datetime, mode = 'transit') {
  const unix = datetimeToUnix(datetime);
  return {
    type: 'google-maps',
    label: '所要時間を見る（Googleマップ）',
    url: mapsUrl(origin, destination, mode, unix),
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

/* ── JR予約（1ボタン） ── */

export function buildJrLink(bookingProvider) {
  switch (bookingProvider) {
    case 'ekinet':
      return {
        type: 'jr-east',
        label: 'JRを予約する（えきねっと）',
        url: 'https://www.eki-net.com/',
      };
    case 'e5489':
      return {
        type: 'jr-west',
        label: 'JRを予約する（e5489）',
        url: 'https://www.jr-odekake.net/goyoyaku/',
      };
    case 'ex':
      return {
        type: 'jr-ex',
        label: '新幹線を予約する（EX）',
        url: 'https://expy.jp/',
      };
    case 'jrkyushu':
      return {
        type: 'jr-kyushu',
        label: 'JRを予約する（九州ネット予約）',
        url: 'https://train.yoyaku.jrkyushu.co.jp/',
      };
    default:
      return null;
  }
}

/* ── レンタカー ── */

export function buildRentalLink() {
  return {
    type: 'rental',
    label: 'レンタカーを探す（じゃらん）',
    url: 'https://www.jalan.net/rentacar/',
  };
}
