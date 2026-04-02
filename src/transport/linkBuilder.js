/**
 * 交通リンクビルダー
 *
 * ボタン文言ルール:
 *   Google Maps → 「📍 行き方を見る（Googleマップ）」
 *   Skyscanner  → 「✈ 飛行機で行く（○○空港 → ○○空港）」
 *   JR予約      → 「🚄 ○○ → ○○（えきねっと）」
 *   レンタカー  → 「🚗 レンタカーを探す」
 *   フェリー    → 「🚢 フェリーを調べる（○○）」
 *   バス        → 「🚌 高速バスを探す」
 *
 * 注意:
 *   - 飛行機経路の Google Maps（driving）は使用しない
 *   - 詳細な所要時間はすべて外部サービスへ委ねる
 *   - URL生成はこのファイルのみ（他ファイルへのインライン記述禁止）
 */

import { loadJson } from '../lib/loadJson.js';

/* ── JR予約プロバイダDB / フェリーDB ── */
/* `with { type: 'json' }` は Safari 17.2+ 限定のため loadJson() に切り替え（Safari 15+ 対応） */
const [TRAIN_PROVIDERS, FERRY_DATA] = await Promise.all([
  loadJson('../data/trainProviders.json', import.meta.url),
  loadJson('../data/ferries.json',        import.meta.url),
]);

/**
 * ferries.json から 港名（from） → { operator, url } のマップを構築する。
 * 同一港に複数の目的地がある場合は最初のエントリを使用する。
 * url が null のエントリは除外する（CTA なし扱い）。
 */
const PORT_FERRY_MAP = {};
for (const entry of FERRY_DATA) {
  if (entry.from && entry.url && !PORT_FERRY_MAP[entry.from]) {
    PORT_FERRY_MAP[entry.from] = { operator: entry.operator, url: entry.url };
  }
}

/**
 * ferries.json から 目的地ID（destId） → { operator, url, from } のマップを構築する。
 * 同一港から複数の目的地がある場合（泊港→渡嘉敷/座間味）に正確なリンクを返す。
 */
const DEST_FERRY_MAP = {};
for (const entry of FERRY_DATA) {
  if (entry.destId && entry.url) {
    DEST_FERRY_MAP[entry.destId] = { operator: entry.operator, url: entry.url, from: entry.from };
  }
}

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
  // null/undefined/空文字ガード — 「指定した地点」表示を防ぐ
  if (!origin?.trim() || (!coords && !destination?.trim())) return null;
  // テキスト名を優先（座標をそのまま使うと「指定した地点」になる）
  const dest = destination?.trim() ? destination : (coords ? `${coords.lat},${coords.lng}` : null);
  if (!dest) return null;
  const lbl = label ?? '行き方を見る（Googleマップ）';
  return {
    type: 'google-maps',
    label: lbl,
    url: mapsUrl(origin, dest, mode),
  };
}

/**
 * 空港・港が絡む区間マップのモードを自動選択する。
 * 空港/港 → どこか、どこか → 空港/港 の場合は driving で海越えを防ぐ。
 * それ以外は transit（電車・バスを優先）。
 */
export function resolveMapMode(from, to) {
  const isAirportOrPort = s => s?.endsWith('空港') || s?.endsWith('港');
  return (isAirportOrPort(from) || isAirportOrPort(to)) ? 'driving' : 'transit';
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
    label: `空席を確認する（${fromAirportName} → ${toAirportName}）`,
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
    label: `Google Flightsで比較（${fromAirportName} → ${toAirportName}）`,
    url: `https://www.google.com/flights#search;f=${fromIata};t=${toIata};tt=o`,
  };
}

/* ── JR予約（trainProviders.json DB参照） ── */

/**
 * @param {string} bookingProvider — 'ekinet'|'e5489'|'ex'|'jrkyushu'|'madoguchi'
 * @param {{from:string, to:string}|null} route — 表示する駅間ルート（任意）
 */
export function buildJrLink(bookingProvider, route = null) {
  const p = TRAIN_PROVIDERS[bookingProvider];
  if (!p) return null;
  // label は短縮名（"e5489" / "えきねっと" など）を返す
  // ctaLabel（"このルートで進む（e5489）"）は使わない
  return { type: p.type, label: p.label, url: p.url };
}

/* ── レンタカー ── */

/**
 * @param {string|null} gatewayCity — レンタカー受取拠点（「○○でレンタカーを借りる」に使用）
 */
export function buildRentalLink(gatewayCity = null) {
  const target = 'https://www.jalan.net/rentacar/';
  const vc = `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${encodeURIComponent(target)}`;
  const label = gatewayCity ? `${gatewayCity}でレンタカーを借りる` : 'レンタカーを探す';
  return { type: 'rental', label, url: vc, gatewayCity };
}

/* ── 高速バス ── */

/**
 * 高速バス検索リンクを生成する。
 * バス比較なび（bushikaku.net）へのリンク。
 */
export function buildHighwayBusLink(from, to) {
  return {
    type: 'bus',
    label: `高速バスを探す（${from} → ${to}）`,
    url: `https://www.bushikaku.net/`,
  };
}

/* ── フェリー（ferries.json DB参照） ── */

/**
 * フェリーリンクを生成する（港名ベース）。
 * 優先順位: bookingUrl（直接指定）→ PORT_FERRY_MAP（ferries.json DB）→ null
 * Google Maps へのフォールバックは行わない。
 *
 * @param {string}      ferryGateway  — 出発港名
 * @param {string|null} bookingUrl    — step に直接指定された予約URL
 * @param {string|null} operatorName  — step に直接指定された事業者名
 * @returns {{ type: 'ferry', label: string, url: string } | null}
 */
export function buildFerryLink(ferryGateway, bookingUrl = null, operatorName = null) {
  if (bookingUrl) {
    const label = operatorName
      ? `時刻・料金を見る（${operatorName}）`
      : `時刻・料金を見る（${ferryGateway}）`;
    return { type: 'ferry', label, url: bookingUrl };
  }
  const info = PORT_FERRY_MAP[ferryGateway];
  if (info) {
    const label = info.operator
      ? `時刻・料金を見る（${info.operator}）`
      : `時刻・料金を見る（${ferryGateway}）`;
    return { type: 'ferry', label, url: info.url };
  }
  // 未登録港・URLなし → じゃらん 船・フェリー検索へフォールバック（フェリーCTAを必ず出す）
  return { type: 'ferry', label: `フェリーを探す（${ferryGateway}）`, url: 'https://www.jalan.net/ship/' };
}

/**
 * フェリーリンクを生成する（目的地IDベース）。
 * 同一港から複数目的地が出る場合（泊港→渡嘉敷/座間味など）に正確なリンクを返す。
 * DEST_FERRY_MAP にない場合は buildFerryLink（港名ベース）にフォールバック。
 *
 * @param {string}      destId        — destinations.json の id
 * @param {string}      ferryGateway  — 出発港名（フォールバック用）
 * @param {string|null} bookingUrl    — step に直接指定された予約URL
 * @param {string|null} operatorName  — step に直接指定された事業者名
 * @returns {{ type: 'ferry', label: string, url: string } | null}
 */
export function buildFerryLinkForDest(destId, ferryGateway, bookingUrl = null, operatorName = null) {
  if (bookingUrl) {
    return buildFerryLink(ferryGateway, bookingUrl, operatorName);
  }
  const destInfo = DEST_FERRY_MAP[destId];
  if (destInfo) {
    const label = destInfo.operator
      ? `時刻・料金を見る（${destInfo.operator}）`
      : `時刻・料金を見る（${ferryGateway}）`;
    return { type: 'ferry', label, url: destInfo.url };
  }
  // DEST_FERRY_MAP にない → 港名ベースにフォールバック
  return buildFerryLink(ferryGateway);
}
