/**
 * 交通リンクビルダー
 *
 * ボタン文言ルール:
 *   Google Maps → 「📍 行き方を見る（Googleマップ）」
 *   Skyscanner  → 「✈ 飛行機で行く（○○空港 → ○○空港）」
 *   JR予約      → 「🚄 ○○ → ○○（えきねっと）」
 *   レンタカー  → 「🚗 レンタカーを探す」
 *   フェリー    → 「⛴ フェリーを調べる（○○）」
 *   バス        → 「🚌 高速バスを探す」
 *
 * 注意:
 *   - 飛行機経路の Google Maps（driving）は使用しない
 *   - 詳細な所要時間はすべて外部サービスへ委ねる
 */

/* ── 内部ユーティリティ ── */

function mapsUrl(origin, destination, mode) {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${mode}`
  );
}

/* ── Skyscanner 空港名→IATAマップ ──
 *
 * destinations.json の airportGateway 値と完全一致させること。
 * 未登録の空港名が来た場合は buildSkyscannerLink() が null を返し、
 * transportRenderer.js のフィルタで除外される（エラーにはならない）。
 * 新都市追加時はここにエントリーを追加すること。
 */

export const AIRPORT_IATA = {
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
  '女満別空港':   'MMB',
  '中標津空港':   'SHB',
  '屋久島空港':   'KUM',
  '奄美空港':     'ASJ',
  '五島福江空港': 'FUJ',
  '青森空港':     'AOJ',
  '阿蘇くまもと空港': 'KMJ',
  '静岡空港':     'FSZ',
  '出雲空港':     'IZO',
  '出雲縁結び空港': 'IZO',  // 出雲空港の正式名称エイリアス
  '小松空港':     'KMQ',    // 石川県・金沢エリア（能登等）
  '大分空港':     'OIT',    // 大分県（豊後高田等）
  '南紀白浜空港': 'SHM',    // 和歌山県（田辺・白浜等）
  '対馬空港':     'TSJ',    // 長崎県・対馬
  '種子島空港':   'TNE',    // 鹿児島県・種子島
  '壱岐空港':     'IKI',    // 長崎県・壱岐
  '但馬空港':     'TJH',    // 兵庫県・城崎温泉方面
  '岩国錦帯橋空港': 'IWK',  // 山口県・岩国
  '庄内空港':       'SYO',  // 山形県・鶴岡・酒田
  '徳島空港':       'TKS',  // 徳島県
  '旭川空港':       'AKJ',  // 北海道・旭川
  '松本空港':       'MMJ',  // 長野県・松本
  '岡山桃太郎空港': 'OKJ',  // 岡山県
  '与那国空港':     'OGN',  // 沖縄県・与那国
  '長崎空港':       'NGS',  // 長崎県
  '高知空港':       'KCZ',  // 高知県
  '鹿児島空港':     'KOJ',  // 鹿児島県
  '函館空港':       'HKD',  // 北海道・函館
  '神戸空港':       'UKB',  // 兵庫県・神戸
};

/**
 * airportHub 都市名 → 空港名マップ
 * city.airportHub（都市名）から空港名を解決するために使用。
 */
export const AIRPORT_HUB_GATEWAY = {
  '那覇':   '那覇空港',
  '石垣':   '石垣空港',
  '鹿児島': '鹿児島空港',
  '福岡':   '福岡空港',
};

/* ── Google Maps（transit / driving 統一） ── */

export function buildGoogleMapsLink(origin, destination, mode = 'transit', label = null, coords = null) {
  const dest = coords ? `${coords.lat},${coords.lng}` : destination;
  let lbl = label ?? '行き方を見る（Googleマップ）';
  // 📍 プレフィックスをまだ持っていない場合に付与
  if (!lbl.startsWith('📍') && !lbl.startsWith('🚗') && !lbl.startsWith('🚌')) {
    lbl = '📍 ' + lbl;
  }
  return {
    type: 'google-maps',
    label: lbl,
    url: mapsUrl(origin, dest, mode),
  };
}

/* ── IATA 短縮名（出発空港ラベル用）── */
export const IATA_SHORT_NAME = {
  'HND': '羽田',   'NRT': '成田',
  'CTS': '新千歳', 'AKJ': '旭川',   'HKD': '函館',  'MMB': '女満別', 'KUH': '釧路', 'SHB': '中標津',
  'AOJ': '青森',   'SDJ': '仙台',   'HNA': '花巻',
  'MMJ': '松本',   'FSZ': '静岡',
  'NGO': 'セントレア', 'KMQ': '小松', 'TOY': '富山',
  'ITM': '伊丹',   'KIX': '関西',   'UKB': '神戸',
  'HIJ': '広島',   'OKJ': '岡山',   'IZO': '出雲',  'YGJ': '米子',
  'TAK': '高松',   'MYJ': '松山',   'KCZ': '高知',  'TKS': '徳島',
  'FUK': '福岡',   'KMJ': '熊本',   'KOJ': '鹿児島', 'NGS': '長崎', 'KMI': '宮崎',
  'OKA': '那覇',   'ISG': '石垣',   'MMY': '宮古',
};

/**
 * IATA コードから空港名（「○○空港」形式）を返す。
 * IATA_SHORT_NAME → AIRPORT_IATA逆引きの順で解決。
 * 未解決の場合は null を返す（IATAコードをUIに露出しない）。
 */
export function iataToAirportName(iata) {
  if (!iata) return null;
  const short = IATA_SHORT_NAME[iata];
  if (short) return short.endsWith('空港') ? short : short + '空港';
  // 逆引き: AIRPORT_IATA の value から key を探す
  return Object.keys(AIRPORT_IATA).find(k => AIRPORT_IATA[k] === iata) || null;
}

/* ── Skyscanner ── */

/**
 * @param {string} fromIata    — 出発空港 IATA
 * @param {string} toAirportName — 到着空港の日本語名
 * ラベル例: ✈ 飛行機で行く（羽田空港 → 那覇空港）
 */
export function buildSkyscannerLink(fromIata, toAirportName) {
  const toIata = AIRPORT_IATA[toAirportName];
  if (!toIata) return null;
  const fromAirportName = iataToAirportName(fromIata);
  if (!fromAirportName) return null; // IATAコード露出防止
  return {
    type: 'skyscanner',
    label: `✈ 飛行機で行く（${fromAirportName} → ${toAirportName}）`,
    url: `https://www.skyscanner.jp/transport/flights/${fromIata.toLowerCase()}/${toIata.toLowerCase()}/`,
  };
}

/** Google Flights リンク（Skyscanner と並列表示） */
export function buildGoogleFlightsLink(fromIata, toAirportName) {
  const toIata = AIRPORT_IATA[toAirportName];
  if (!toIata) return null;
  const fromAirportName = iataToAirportName(fromIata);
  if (!fromAirportName) return null; // IATAコード露出防止
  return {
    type: 'google-flights',
    label: `✈ Google Flightsで比較（${fromAirportName} → ${toAirportName}）`,
    url: `https://www.google.com/flights#search;f=${fromIata};t=${toIata};tt=o`,
  };
}

/* ── JR予約（1ボタン） ── */

/**
 * @param {string} bookingProvider
 * @param {{from:string, to:string}|null} route — 表示する駅間ルート（任意）
 */
export function buildJrLink(bookingProvider, route = null) {
  function lbl(provider) {
    if (route?.from && route?.to) return `🚄 ${route.from} → ${route.to}（${provider}）`;
    return `🚄 JRを予約する（${provider}）`;
  }
  switch (bookingProvider) {
    case 'ekinet':    return { type: 'jr-east',   label: lbl('えきねっと'),  url: 'https://www.eki-net.com/' };
    case 'e5489':     return { type: 'jr-west',   label: lbl('JRネット予約'),     url: 'https://www.jr-odekake.net/goyoyaku/' };
    case 'ex':        return { type: 'jr-ex',     label: lbl('スマートEX'), url: 'https://smart-ex.jp/' };
    case 'jrkyushu':  return { type: 'jr-kyushu', label: lbl('JR九州予約'), url: 'https://train.yoyaku.jrkyushu.co.jp/' };
    // オンライン予約不可ルート — 窓口購入案内
    case 'madoguchi': return { type: 'jr-window', label: (route?.from && route?.to ? `🚃 ${route.from} → ${route.to}（窓口で購入）` : '🚃 窓口で購入'), url: 'https://www.jr-odekake.net/' };
    default:          return null;
  }
}

/* ── レンタカー ── */

export function buildRentalLink() {
  const target = 'https://www.jalan.net/rentacar/';
  const vc = `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${encodeURIComponent(target)}`;
  return {
    type: 'rental',
    label: '🚗 レンタカーを探す',
    url: vc,
  };
}

/* ── 高速バス ── */

/**
 * 高速バス検索リンクを生成する。
 * バス比較なび（bushikaku.net）へのリンク。
 */
export function buildHighwayBusLink(from, to) {
  return {
    type: 'bus',
    label: `🚌 高速バスを探す（${from} → ${to}）`,
    url: `https://www.bushikaku.net/`,
  };
}

/* ── フェリー（島アクセス） ── */

/**
 * フェリー港名からフェリー予約・案内リンクを生成する。
 */
const FERRY_LINKS = {
  '竹芝客船ターミナル': { label: '⛴ フェリーを調べる（東海汽船）',           url: 'https://www.tokaikisen.co.jp/' },
  '竹芝桟橋':           { label: '⛴ フェリーを調べる（東海汽船）',           url: 'https://www.tokaikisen.co.jp/' },
  '熱海港':             { label: '⛴ フェリーを調べる（東海汽船）',           url: 'https://www.tokaikisen.co.jp/' },
  '稲取港':             { label: '⛴ フェリーを調べる（東海汽船）',           url: 'https://www.tokaikisen.co.jp/' },
  '泊港':               { label: '⛴ フェリーを調べる（マリンライナー）',     url: 'https://www.agui.net/' },
  '那覇港':             { label: '⛴ フェリーを調べる（マリンライナー）',     url: 'https://www.agui.net/' },
  '鹿児島港':           { label: '⛴ フェリーを調べる（種子屋久高速船）',     url: 'https://www.tykousoku.jp/' },
  '長崎港':             { label: '⛴ フェリーを調べる（九州商船）',           url: 'https://www.kysho.co.jp/' },
  '博多港':             { label: '⛴ フェリーを調べる（九州商船）',           url: 'https://www.kysho.co.jp/' },
  '高松港':             { label: '⛴ フェリーを調べる（小豆島フェリー）',     url: 'https://www.shoudoshima-ferry.co.jp/' },
  '宇野港':             { label: '⛴ フェリーを調べる（宇野港フェリー）',     url: 'https://ferry.co.jp/' },
  '宮島口港':           { label: '⛴ フェリーを調べる（宮島松大フェリー）',   url: 'https://miyajima-matsudai.co.jp/' },
  '石垣港':             { label: '⛴ フェリーを調べる（八重山観光フェリー）', url: 'https://www.yaeyama.co.jp/' },
  '松山観光港':         { label: '⛴ フェリーを調べる（瀬戸内海汽船）',       url: 'https://www.setonaikaikisen.co.jp/' },
  '詫間港':             { label: '⛴ フェリーを調べる（三豊市営フェリー）',    url: 'https://www.city.mitoyo.lg.jp/' },
  '稚内港':             { label: '⛴ フェリーを調べる（ハートランドフェリー）',url: 'https://www.heartlandferry.jp/' },
  '新潟港':             { label: '⛴ フェリーを調べる（佐渡汽船）',            url: 'https://www.sadokisen.co.jp/' },
  '本部港':             { label: '⛴ フェリーを調べる（沖縄県営フェリー）',    url: 'https://okinawa.ferry.co.jp/' },
  '伊江島港':           { label: '⛴ フェリーを調べる（伊江島フェリー）',      url: 'https://www.iejima.org/' },
  '座間味港':           { label: '⛴ フェリーを調べる（座間味村営フェリー）',  url: 'https://vill.zamami.okinawa.jp/' },
  '小浜港':             { label: '⛴ フェリーを調べる（安栄観光）',            url: 'https://www.aneikankou.co.jp/' },
};

export function buildFerryLink(ferryGateway, bookingUrl = null, operatorName = null) {
  if (bookingUrl) {
    const label = operatorName
      ? `⛴ フェリーを予約する（${operatorName}）`
      : `⛴ フェリーを予約する（${ferryGateway}）`;
    return { type: 'ferry', label, url: bookingUrl };
  }
  const info = FERRY_LINKS[ferryGateway];
  if (info) return { type: 'ferry', label: info.label, url: info.url };
  // 未登録港: Googleマップ検索にフォールバック
  return {
    type: 'ferry',
    label: `⛴ フェリーを調べる（${ferryGateway}）`,
    url: `https://www.google.com/maps/search/${encodeURIComponent(ferryGateway + ' フェリー')}`,
  };
}
