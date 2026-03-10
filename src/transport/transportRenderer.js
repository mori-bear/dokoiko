/**
 * 交通リンクアセンブラ（gateways 構造対応・関数分割版）
 *
 * データ構造:
 *   city.gateways.rail[]    — 鉄道ゲートウェイ（駅名）
 *   city.gateways.airport[] — 空港ゲートウェイ
 *   city.gateways.bus[]     — バス・私鉄ターミナル
 *   city.gateways.ferry[]   — フェリー港（島=出発港 / 非島=到着港）
 *   city.accessHub          — 二次交通の中継拠点
 *   city.railNote           — 二次交通メモ（バス等）
 *
 * 表示順: JR → 飛行機 → フェリー → GoogleMaps → レンタカー
 *
 * 特例:
 *   ★1（近場）  → GoogleMaps 1本のみ
 *   isIsland    → フェリー優先（早期リターン）
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';
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
  const rails     = city.gateways?.rail ?? [];
  const railNote  = city.railNote  ?? null;
  const accessHub = city.accessHub ?? null;
  if (!rails.length) return [];

  const links = [];

  // railNote があればバス等二次交通 → JR予約ボタン非表示
  if (!railNote) {
    const jr = buildJrLink(resolveRailProvider(departure, city));
    if (jr) links.push(jr);
  }

  // 二次交通ノート（accessHub → 目的地）
  if (accessHub && railNote) {
    links.push({
      type:  'note',
      label: `${accessHub} → ${city.name}（${railNote}）`,
      url:   null,
    });
  }

  // GoogleMaps: 出発駅 → 鉄道ゲートウェイ
  links.push(buildGoogleMapsLink(fromCity.rail, rails[0], 'transit'));

  return links;
}

/* ─── 飛行機リンク ─── */

function getFlight(city, departure, fromCity) {
  const airports = city.gateways?.airport ?? [];
  if (!airports.length) return [];

  const airport = airports[0];
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
  const ferries = city.gateways?.ferry ?? [];
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

/* ─── バスリンク ─── */

function getBus(city) {
  const buses = city.gateways?.bus ?? [];
  if (!buses.length) return [];
  // バス停情報はノートとして表示
  return [{
    type:  'note',
    label: `バス: ${buses.join(' / ')}`,
    url:   null,
  }];
}

/* ─── レンタカー ─── */

function getCar(city) {
  if (!city.needsCar && !city.isIsland) return [];
  return [buildRentalLink()];
}

/* ─── メインアセンブラ ─── */

export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const stars    = city.distanceStars ?? 0;
  const isIsland = !!city.isIsland;
  const hasFerry = (city.gateways?.ferry ?? []).length > 0;

  // 島フェリー優先（早期リターン）— ★1 より前に判定
  if (isIsland && hasFerry) {
    return [
      ...getFerry(city, departure, fromCity, true),
      ...getCar(city),
    ].filter(l => l && (l.url || l.type === 'note'));
  }

  // ★1 近場: GoogleMaps 1本のみ
  if (stars === 1) {
    const rail = (city.gateways?.rail ?? [])[0];
    return [
      buildGoogleMapsLink(fromCity.rail, rail ?? city.name, 'transit'),
      ...getCar(city),
    ].filter(l => l?.url);
  }

  // 通常ルート: JR → 飛行機 → フェリー → (手段なし時のフォールバック) → レンタカー
  const links = [
    ...getRail(city, departure, fromCity),
    ...getFlight(city, departure, fromCity),
    ...getFerry(city, departure, fromCity, false),
    ...getBus(city),
  ];

  // どの手段もない → GoogleMaps フォールバック
  if (!links.length) {
    links.push(buildGoogleMapsLink(fromCity.rail, city.name, 'transit'));
  }

  links.push(...getCar(city));

  return links.filter(l => l && (l.url || l.type === 'note'));
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
