/**
 * 交通リンクアセンブラ（2段階ルーティング）
 *
 * Stage1: 出発地 → accessHub / airportGateway / portHub
 *   鉄道 / 飛行機（路線実在確認済み）/ フェリー
 *
 * Stage2: accessHub → 目的地（二次交通ノート）
 *   バス / 私鉄 / ローカル
 *
 * 表示順: 鉄道 → 飛行機 → フェリー → GoogleMaps → レンタカー
 *
 * 特例:
 *   ★1（近場）     → GoogleMaps のみ
 *   portHubs（島） → フェリー + GoogleMaps（港まで）+ レンタカー（early return）
 *
 * 航空路線フィルタ:
 *   CITY_AIRPORT + FLIGHT_ROUTES で実在路線のみ Skyscanner 表示。
 *   路線なし → Skyscanner 非表示。
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import { CITY_AIRPORT } from './airportMap.js';
import { FLIGHT_ROUTES } from './flightRoutes.js';
import {
  AIRPORT_IATA,
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/* ── 航空路線実在チェック ── */

function isFlightAvailable(departure, airportGateway) {
  const fromIata = CITY_AIRPORT[departure];
  const toIata   = AIRPORT_IATA[airportGateway];
  if (!fromIata || !toIata) return false;
  const routes = FLIGHT_ROUTES[fromIata] ?? [];
  return routes.includes(toIata);
}

/**
 * 交通リンクを組み立てる（2段階ルーティング）。
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest   = city.name;
  const stars  = city.distanceStars ?? 0;
  const access = city.access ?? {};

  const railGateway    = access.railGateway    ?? null;
  const busGateway     = access.busGateway     ?? null;
  const accessHub      = access.accessHub      ?? null;
  const airportGateway = access.airportGateway ?? null;
  const ferryGateway   = access.ferryGateway   ?? null;
  const railNote       = access.railNote        ?? null;
  const portHubs       = access.portHubs        ?? [];

  // 島・portHubs（フェリーが主要手段 — 早期リターン）★1より先に判定
  if (portHubs.length > 0) {
    const port = selectNearestPort(city, departure, portHubs);
    const ls = [];
    if (port) {
      const fl = buildFerryLink(port);
      if (fl) ls.push(fl);
      // 出発駅 → フェリー乗り場（出発側）
      ls.push(buildGoogleMapsLink(fromCity.rail, port, 'transit'));
    }
    if (city.isIsland || city.needsCar) ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  // ★1: 近場 → GoogleMaps のみ
  if (stars === 1) {
    const ls = [buildGoogleMapsLink(fromCity.rail, dest, 'transit')];
    if (city.needsCar) ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  // 全ルート収集（マルチルート方式）
  const links = [];

  // ── JR / 鉄道ルート（Stage 1: 出発地 → railGateway）──
  if (railGateway) {
    // railNote があればバス等二次交通 → JR予約ボタン非表示
    if (!railNote) {
      const jrLink = buildJrLink(resolveRailProvider(departure, city));
      if (jrLink) links.push(jrLink);
    }

    // Stage2ノート: accessHub → 目的地（バス等）
    if (accessHub && railNote) {
      links.push({ type: 'note', label: `${accessHub} → ${dest}（${railNote}）`, url: null });
    }

    // GoogleMaps: 出発駅 → 目的地の鉄道駅（railGateway を使用）
    // 飛行機ルートが有効な場合は飛行機側の GoogleMaps を優先するが、
    // 両方表示して選択肢を提供する
    const targetGateway = railGateway;
    links.push(buildGoogleMapsLink(fromCity.rail, targetGateway, 'transit'));
  }

  // ── 飛行機ルート（路線実在確認 → Skyscanner）──
  if (airportGateway) {
    const flightOk = isFlightAvailable(departure, airportGateway);
    if (flightOk) {
      // Stage1: 出発駅 → 出発空港（GoogleMaps）
      links.push(
        buildGoogleMapsLink(
          fromCity.rail,
          fromCity.airport,
          'transit',
          `${fromCity.airport}へ（Googleマップ）`,
        ),
      );
      // Skyscanner: 出発空港 → 目的地空港
      const sc = buildSkyscannerLink(fromCity.iata, airportGateway);
      if (sc) links.push(sc);
      // Stage2: 到着空港 → 目的地市内（GoogleMaps）
      links.push(
        buildGoogleMapsLink(airportGateway, dest, 'transit', '空港から市内へ（Googleマップ）'),
      );
    } else if (!railGateway) {
      // 飛行機路線なし + 鉄道なし → フォールバック GoogleMaps（transit）
      links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
    }
  }

  // ── フェリールート（portHubs なし — 追加手段）──
  if (ferryGateway) {
    const fl = buildFerryLink(ferryGateway);
    if (fl) links.push(fl);

    // 他の交通手段（鉄道 or 有効な飛行機）がない場合のみ GoogleMaps 追加
    const hasOtherTransit = railGateway ||
      (airportGateway && isFlightAvailable(departure, airportGateway));
    if (!hasOtherTransit) {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
    }
  }

  // どの手段もない → GoogleMaps のみ
  if (!railGateway && !airportGateway && !ferryGateway) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
  }

  // レンタカー（needsCar=true または isIsland）
  if (city.needsCar || city.isIsland) links.push(buildRentalLink());

  return links.filter(l => l && (l.url || l.type === 'note'));
}

/**
 * portHubs から出発地に最も近い港を選択する。
 */
const PORT_SELECT = {
  'izu-oshima': (dep) => {
    if (dep === '静岡') return '稲取港';
    if (['名古屋', '大阪', '京都', '神戸', '広島', '福岡'].includes(dep)) return '熱海港';
    return '竹芝客船ターミナル';
  },
  'naoshima': (dep) => {
    if (['高松', '松山', '高知', '徳島'].includes(dep)) return '高松港';
    return '宇野港';
  },
  'shodoshima': (dep) => {
    if (['高松', '松山', '高知', '徳島'].includes(dep)) return '高松港';
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

/**
 * スマートEX: 東海道・山陽・九州新幹線
 */
const EX_CITIES = new Set([
  '東京', '横浜', '大宮', '品川',
  '名古屋',
  '京都', '大阪', '神戸', '姫路',
  '岡山', '広島', '小倉', '博多', '熊本', '鹿児島', '長崎',
]);

function resolveRailProviderByName(departure, targetCityName) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(targetCityName)) return 'ex';
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}

function resolveRailProvider(departure, city) {
  return resolveRailProviderByName(departure, city.name);
}
