/**
 * 交通リンクアセンブラ（gateways 構造対応・関数分割版）
 *
 * データ構造:
 *   city.gateways.rail[]    — 鉄道ゲートウェイ（駅名）
 *   city.gateways.airport[] — 空港ゲートウェイ
 *   city.gateways.bus[]     — 高速バスターミナル
 *   city.gateways.ferry[]   — フェリー港（島=出発港 / 非島=到着港）
 *   city.accessHub          — 二次交通の中継拠点
 *   city.railNote           — 二次交通メモ（バス等）
 *
 * 表示順: JR → 高速バス → 飛行機 → フェリー → レンタカー
 *
 * アクセス構造: 出発都市 → 交通gateway → destination
 *
 * 特例:
 *   ★1（近場）  → GoogleMaps 1本のみ
 *   isIsland    → フェリー優先（早期リターン）
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import { calculateDistanceStars } from '../engine/distanceCalculator.js';
import { CITY_AIRPORT }        from './airportMap.js';
import { FLIGHT_ROUTES }       from './flightRoutes.js';
import {
  AIRPORT_IATA,
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/* ─── 航空路線実在チェック ─── */

function isFlightAvailable(departure, airportGateway) {
  const fromIata = CITY_AIRPORT[departure];
  const toIata   = AIRPORT_IATA[airportGateway];
  if (!fromIata || !toIata) return false;
  return (FLIGHT_ROUTES[fromIata] ?? []).includes(toIata);
}

/* ─── JR / 鉄道リンク ─── */

function getRail(city, departure, fromCity) {
  const railGateway = gw(city, 'railGateway');
  const railNote    = city.railNote ?? null;
  if (!railGateway) return [];

  const links = [];

  // 条件9: railGateway が存在すれば常にJR予約ボタンを表示
  const jr = buildJrLink(resolveRailProvider(departure, city));
  if (jr) links.push(jr);

  // 条件8: 出発駅 → 鉄道ゲートウェイ（GoogleMaps transit）
  links.push(buildGoogleMapsLink(fromCity.rail, railGateway, 'transit'));

  // 条件10: バスが必要な場合 GoogleMaps transit（note ではなくリンク）
  if (railNote) {
    links.push(buildGoogleMapsLink(railGateway, city.name, 'transit', `バスで${city.name}へ（Googleマップ）`));
  }

  return links;
}

/* ─── 飛行機リンク ─── */

function getFlight(city, departure, fromCity) {
  const airport = gw(city, 'airportGateway');
  if (!airport) return [];

  if (!isFlightAvailable(departure, airport)) return [];

  return [
    buildSkyscannerLink(fromCity.iata, airport),
    // Stage2: 空港 → 目的地市内
    buildGoogleMapsLink(airport, city.name, 'transit', '空港から市内へ（Googleマップ）'),
  ].filter(Boolean);
}

/* ─── フェリーリンク ─── */

/**
 * @param {boolean} isIsland — true: 出発港選択モード / false: 到着港表示のみ
 */
function getFerry(city, departure, fromCity, isIsland) {
  // フラットフィールド優先、fallback: gateways.ferry配列
  const ferryGateway = gw(city, 'ferryGateway');
  const ferries = ferryGateway
    ? [ferryGateway]
    : (city.gateways?.ferry ?? []);
  if (!ferries.length) return [];

  if (isIsland) {
    // 島アクセス: 最寄り出発港を選択して Ferry + GoogleMaps（出発駅→港）
    const port = selectNearestPort(city, departure, ferries);
    if (!port) return [];
    const fl = buildFerryLink(port);
    return [
      fl,
      buildGoogleMapsLink(fromCity.rail, port, 'transit'),
    ].filter(l => l?.url);
  } else {
    // 非島: フェリーリンクのみ（到着港案内）
    const fl = buildFerryLink(ferries[0]);
    return fl ? [fl] : [];
  }
}

/* ─── 高速バスリンク（条件7: JR → 高速バス → 飛行機 順序） ─── */

function getHighwayBus(city, fromCity) {
  const buses = city.gateways?.bus ?? [];
  if (!buses.length) return [];
  // 条件10: 高速バスも GoogleMaps transit で案内
  return buses.map(terminal =>
    buildGoogleMapsLink(fromCity.rail, terminal, 'transit', `高速バスで${terminal}へ（Googleマップ）`)
  );
}

/* ─── 二次交通（railGateway なし・空港バス等） ─── */

function getSecondary(city) {
  // railGateway ありの場合は getRail() 内でバス処理済みのためスキップ
  if (gw(city, 'railGateway')) return [];
  const s = city.secondaryTransport;
  if (!s) return [];
  // 条件10: バスが必要な場合 GoogleMaps transit
  return [buildGoogleMapsLink(s.from, s.to, 'transit', `${s.from}からバス（Googleマップ）`)];
}

/* ─── レンタカー ─── */

function getCar(city) {
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (!city.needsCar && !isIsland) return [];
  return [buildRentalLink()];
}

/**
 * メインリンク（note・rental 以外）を max 件に絞る。
 * note と rental は件数カウント外で常に付加する。
 */
function limitRoutes(links, max) {
  const main   = links.filter(l => l.type !== 'note' && l.type !== 'rental');
  const notes  = links.filter(l => l.type === 'note');
  const rental = links.filter(l => l.type === 'rental');
  return [...main.slice(0, max), ...notes, ...rental];
}

/* ─── メインアセンブラ ─── */

/** 後方互換: gateways配列 → 先頭要素フォールバック */
function gw(city, key) {
  return city[key] || city.gateways?.[key]?.[0] || null;
}

export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  // 条件4: 出発地依存の動的距離計算（static distanceStars ではなく departure 別に計算）
  const stars    = calculateDistanceStars(departure, city);
  const isIsland = !!(city.isIsland || city.destType === 'island');
  const hasFerry = !!(gw(city, 'ferryGateway') || (city.gateways?.ferry?.length > 0));

  // 島フェリー優先（早期リターン）— ★1 より前に判定
  if (isIsland && hasFerry) {
    const links = [
      ...getFerry(city, departure, fromCity, true),
      ...getCar(city),
    ].filter(l => l && (l.url || l.type === 'note'));
    return limitRoutes(links, 3);
  }

  // ★1 近場: GoogleMaps 1本のみ
  if (stars === 1) {
    const rail   = gw(city, 'railGateway') ?? city.name;
    const coords = (city.lat && city.lng && !gw(city, 'railGateway')) ? {lat: city.lat, lng: city.lng} : null;
    return [
      buildGoogleMapsLink(fromCity.rail, rail, 'transit', null, coords),
      ...getCar(city),
    ].filter(l => l?.url);
  }

  // 通常ルート: 条件7の順序 JR → 高速バス → 飛行機 → フェリー → 二次交通
  const links = [
    ...getRail(city, departure, fromCity),
    ...getHighwayBus(city, fromCity),
    ...getFlight(city, departure, fromCity),
    ...getFerry(city, departure, fromCity, false),
    ...getSecondary(city),
  ];

  // どの手段もない → GoogleMaps フォールバック
  if (!links.length) {
    const coords = (city.lat && city.lng) ? {lat: city.lat, lng: city.lng} : null;
    links.push(buildGoogleMapsLink(fromCity.rail, city.name, 'transit', null, coords));
  }

  links.push(...getCar(city));

  const filtered = links.filter(l => l && (l.url || l.type === 'note'));
  return limitRoutes(filtered, 3);
}

/* ─── 最寄り港選択 ─── */

const PORT_SELECT = {
  'izu-oshima': (dep) => {
    if (dep === '静岡') return '稲取港';
    if (['名古屋','大阪','京都','神戸','広島','福岡'].includes(dep)) return '熱海港';
    return '竹芝客船ターミナル';
  },
  'naoshima': (dep) => {
    if (['高松','松山','高知','徳島'].includes(dep)) return '高松港';
    return '宇野港';
  },
  'shodoshima': (dep) => {
    if (['高松','松山','高知','徳島'].includes(dep)) return '高松港';
    return '宇野港';
  },
  'goto': (dep) => {
    if (dep === '長崎') return '長崎港';
    return '博多港';
  },
};

function selectNearestPort(city, departure, portHubs) {
  if (!portHubs || portHubs.length === 0) return null;
  if (portHubs.length === 1) return portHubs[0];
  const selector = PORT_SELECT[city.id];
  if (selector) return selector(departure);
  return portHubs[0];
}

/* ─── JR 予約先選択 ─── */

const EX_CITIES = new Set([
  '東京','横浜','大宮','品川','名古屋',
  '京都','大阪','神戸','姫路',
  '岡山','広島','小倉','博多','熊本','鹿児島','長崎',
]);

function resolveRailProvider(departure, city) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(city.name)) return 'ex';
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
