/**
 * 交通リンクアセンブラ
 *
 * 交通生成構造:
 *   出発地 → 長距離交通（新幹線/飛行機/高速バス） → gatewayHub → 二次交通（バス/フェリー/車） → destination
 *
 * データフィールド:
 *   city.railGateway      — 最寄りJR駅
 *   city.airportGateway   — 最寄り空港
 *   city.ferryGateway     — フェリー港
 *   city.gatewayHub       — 二次交通の起点都市
 *   city.airportHub       — 航空乗り継ぎ都市（那覇経由→石垣等）
 *   city.secondaryTransport — 'bus'|'ferry'|'car'
 *   city.railProvider     — 'ekinet'|'e5489'|'jrkyushu'（上書き用）
 *   city.lat / city.lng   — 座標（Google Maps destination に使用）
 *
 * 表示順: JR → 高速バス → 飛行機 → フェリー → レンタカー
 *
 * 特例:
 *   ★1（近場） → GoogleMaps 1本のみ
 *   island     → フェリー + 飛行機（airportHub対応）
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import { calculateDistanceStars } from '../engine/distanceCalculator.js';
import { CITY_AIRPORT }        from './airportMap.js';
import { FLIGHT_ROUTES }       from './flightRoutes.js';
import {
  AIRPORT_IATA,
  AIRPORT_HUB_GATEWAY,
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/* ── 座標ヘルパー ── */

function coords(city) {
  return (city.lat && city.lng) ? { lat: city.lat, lng: city.lng } : null;
}

/* ─── 航空路線実在チェック ─── */

function isFlightAvailable(departure, airportGateway) {
  const fromIata = CITY_AIRPORT[departure];
  const toIata   = AIRPORT_IATA[airportGateway];
  if (!fromIata || !toIata) return false;
  return (FLIGHT_ROUTES[fromIata] ?? []).includes(toIata);
}

/* ─── 島向け飛行機リンク（airportHub 対応） ─── */

function getFlightForIsland(city, departure, fromCity) {
  const airport = gw(city, 'airportGateway');

  // 直行便チェック
  if (airport && isFlightAvailable(departure, airport)) {
    return [buildSkyscannerLink(fromCity.iata, airport)].filter(Boolean);
  }

  // airportHub 経由
  const hub = city.airportHub;
  if (!hub) return [];
  const hubAirport = AIRPORT_HUB_GATEWAY[hub];
  if (!hubAirport) return [];
  if (!isFlightAvailable(departure, hubAirport)) return [];
  return [buildSkyscannerLink(fromCity.iata, hubAirport)].filter(Boolean);
}

/* ─── JR / 鉄道リンク ─── */

function getRail(city, departure, fromCity) {
  const railGateway = gw(city, 'railGateway');
  if (!railGateway) return [];

  const links = [];

  // JR予約ボタン（常に表示）
  const jr = buildJrLink(resolveRailProvider(departure, city));
  if (jr) links.push(jr);

  // 出発駅 → railGateway（GoogleMaps transit）
  links.push(buildGoogleMapsLink(fromCity.rail, railGateway, 'transit'));

  // 二次交通: railGateway → destination
  const hasSecondary = city.secondaryTransport || city.railNote;
  if (hasSecondary) {
    const stType = typeof city.secondaryTransport === 'string'
      ? city.secondaryTransport
      : (city.secondaryTransport?.type ?? 'bus');
    const label = stType === 'ferry' ? `フェリーで${city.name}へ（Googleマップ）`
                : stType === 'car'   ? `車で${city.name}へ（Googleマップ）`
                : `バスで${city.name}へ（Googleマップ）`;
    links.push(buildGoogleMapsLink(railGateway, city.name, 'transit', label, coords(city)));
  }

  return links;
}

/* ─── 飛行機リンク（非島） ─── */

function getFlight(city, departure, fromCity) {
  const airport = gw(city, 'airportGateway');
  if (!airport) return [];
  if (!isFlightAvailable(departure, airport)) return [];

  return [
    buildSkyscannerLink(fromCity.iata, airport),
    buildGoogleMapsLink(airport, city.name, 'transit', '空港から市内へ（Googleマップ）', coords(city)),
  ].filter(Boolean);
}

/* ─── フェリーリンク ─── */

function getFerry(city, departure, fromCity, isIsland) {
  const ferryGateway = gw(city, 'ferryGateway');
  const ferries = ferryGateway
    ? [ferryGateway]
    : (city.gateways?.ferry ?? []);
  if (!ferries.length) return [];

  if (isIsland) {
    const port = selectNearestPort(city, departure, ferries);
    if (!port) return [];
    const fl = buildFerryLink(port);
    return [
      fl,
      buildGoogleMapsLink(fromCity.rail, port, 'transit'),
    ].filter(l => l?.url);
  } else {
    const fl = buildFerryLink(ferries[0]);
    return fl ? [fl] : [];
  }
}

/* ─── 高速バスリンク ─── */

function getHighwayBus(city, fromCity) {
  const buses = city.gateways?.bus ?? [];
  if (!buses.length) return [];
  return buses.map(terminal =>
    buildGoogleMapsLink(fromCity.rail, terminal, 'transit', `高速バスで${terminal}へ（Googleマップ）`)
  );
}

/* ─── 二次交通（railGateway なし・gatewayHub あり） ─── */

function getSecondary(city) {
  // railGateway があれば getRail() で処理済み
  if (gw(city, 'railGateway')) return [];

  const st  = city.secondaryTransport;
  const gwHub = city.gatewayHub;

  // 旧形式（object）対応
  if (st && typeof st === 'object' && st.from) {
    return [buildGoogleMapsLink(st.from, st.to, 'transit', `${st.from}からバス（Googleマップ）`, coords(city))];
  }

  if (!st || !gwHub) return [];

  const stType = st; // 'bus'|'ferry'|'car'
  const label = stType === 'ferry' ? `フェリーで${city.name}へ（Googleマップ）`
              : stType === 'car'   ? `車で${city.name}へ（Googleマップ）`
              : `バスで${city.name}へ（Googleマップ）`;
  return [buildGoogleMapsLink(gwHub, city.name, 'transit', label, coords(city))];
}

/* ─── レンタカー ─── */

function getCar(city) {
  const isIsland = !!(city.isIsland || city.destType === 'island');
  if (!city.needsCar && !isIsland) return [];
  return [buildRentalLink()];
}

/* ─── ルート上限 ─── */

function limitRoutes(links, max) {
  const main   = links.filter(l => l.type !== 'note' && l.type !== 'rental');
  const notes  = links.filter(l => l.type === 'note');
  const rental = links.filter(l => l.type === 'rental');
  return [...main.slice(0, max), ...notes, ...rental];
}

/* ─── メインアセンブラ ─── */

function gw(city, key) {
  return city[key] || city.gateways?.[key]?.[0] || null;
}

export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const stars    = calculateDistanceStars(departure, city);
  const isIsland = !!(city.isIsland || city.destType === 'island');
  const hasFerry = !!(gw(city, 'ferryGateway') || (city.gateways?.ferry?.length > 0));

  // 島: フェリー + 飛行機（airportHub 対応）
  if (isIsland && hasFerry) {
    const links = [
      ...getFlightForIsland(city, departure, fromCity),
      ...getFerry(city, departure, fromCity, true),
      ...getCar(city),
    ].filter(l => l && (l.url || l.type === 'note'));
    return limitRoutes(links, 3);
  }

  // ★1 近場: GoogleMaps 1本のみ
  if (stars === 1) {
    const rail = gw(city, 'railGateway') ?? city.name;
    // railGateway が自分と違うなら座標は使わない（中継駅への案内のため）
    const useCoords = !gw(city, 'railGateway') ? coords(city) : null;
    return [
      buildGoogleMapsLink(fromCity.rail, rail, 'transit', null, useCoords),
      ...getCar(city),
    ].filter(l => l?.url);
  }

  // 通常ルート: JR → 高速バス → 飛行機 → フェリー → 二次交通
  const links = [
    ...getRail(city, departure, fromCity),
    ...getHighwayBus(city, fromCity),
    ...getFlight(city, departure, fromCity),
    ...getFerry(city, departure, fromCity, false),
    ...getSecondary(city),
  ];

  // どの手段もない → GoogleMaps フォールバック（座標使用）
  if (!links.length) {
    links.push(buildGoogleMapsLink(fromCity.rail, city.name, 'transit', null, coords(city)));
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

export function resolveRailProvider(departure, city) {
  // city.railProvider が設定されている場合は優先
  if (city.railProvider) return city.railProvider;
  if (EX_CITIES.has(departure) && EX_CITIES.has(city.name)) return 'ex';
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
