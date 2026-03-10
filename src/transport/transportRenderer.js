import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる（マルチルート方式）。
 *
 * 表示順: 飛行機 → フェリー → JR → GoogleMaps → レンタカー
 *
 * 特例:
 *   ★1（近場）        → GoogleMaps のみ
 *   portHubs（島）    → フェリー + GoogleMaps（港まで）+ レンタカー（early return）
 *   airportGateway    → Skyscanner + GoogleMaps（空港→市内）
 *   ferryGateway      → フェリーリンク（airportGateway・railGatewayなし時 + GoogleMaps）
 *   railGateway       → JR予約 + GoogleMaps（出発地→目的地）
 *   railNote          → 二次交通テキスト（JRリンクと併用）
 *   shouldShowRental  → レンタカー（needsCar / isIsland / 自然系タグ）
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest  = city.name;
  const stars = city.distanceStars ?? 0;
  const access = city.access;

  // ★1: 近場 → GoogleMaps のみ
  if (stars === 1) {
    const ls = [buildGoogleMapsLink(fromCity.rail, dest, 'transit')];
    if (shouldShowRental(city)) ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  if (!access) {
    if (city.needsCar) {
      return [
        buildGoogleMapsLink(fromCity.rail, dest, 'driving'),
        buildRentalLink(),
      ].filter(l => l?.url);
    }
    return [buildGoogleMapsLink(fromCity.rail, dest, 'transit')].filter(l => l?.url);
  }

  const railGateway    = access.railGateway    ?? null;
  const airportGateway = access.airportGateway ?? null;
  const ferryGateway   = access.ferryGateway   ?? null;
  const railNote       = access.railNote        ?? null;

  // 島・portHubs（フェリーが主要手段 — 早期リターン）
  if (city.portHubs && city.portHubs.length > 0) {
    const port = selectNearestPort(city, departure);
    const ls = [];
    if (port) {
      const ferryLink = buildFerryLink(port);
      if (ferryLink) ls.push(ferryLink);
      ls.push(buildGoogleMapsLink(fromCity.rail, port, 'transit'));
    }
    ls.push(buildRentalLink());
    return ls.filter(l => l?.url);
  }

  // 非島: 全ルート収集
  const links = [];

  // 飛行機ルート
  if (airportGateway) {
    const sc = buildSkyscannerLink(fromCity.iata, airportGateway);
    if (sc) links.push(sc);
    // 空港 → 市内
    links.push(buildGoogleMapsLink(airportGateway, dest, 'transit', '空港から市内へ（Googleマップ）'));
  }

  // フェリールート（portHubsなし）
  if (ferryGateway) {
    const fl = buildFerryLink(ferryGateway);
    if (fl) links.push(fl);
    // フェリーのみ（airport・railなし）→ 出発地→港まで GoogleMaps
    if (!airportGateway && !railGateway) {
      links.push(buildGoogleMapsLink(fromCity.rail, ferryGateway, 'transit'));
    }
  }

  // JRルート（railGateway あれば常に表示）
  if (railGateway) {
    const jrLink = buildJrLink(resolveRailProvider(departure, city));
    if (jrLink) links.push(jrLink);

    // airportなし → 出発地→目的地 GoogleMaps
    if (!airportGateway) {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
    }

    // 二次交通テキスト（バス・私鉄等）
    if (railNote) {
      links.push({ type: 'note', label: `${railGateway} → ${dest}（${railNote}）`, url: null });
    }
  }

  // どの手段もない → GoogleMaps のみ
  if (!airportGateway && !ferryGateway && !railGateway) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));
  }

  // レンタカー
  if (shouldShowRental(city)) links.push(buildRentalLink());

  return links.filter(l => l && (l.url || l.type === 'note'));
}

/**
 * レンタカー表示条件
 * destinations.json で needsCar=true が設定された都市 + 島
 */
function shouldShowRental(city) {
  return city.needsCar === true || city.isIsland === true;
}

/**
 * portHubs から出発地に最も近い港を選択する。
 */
const PORT_SELECT = {
  'izu-oshima': (dep) => {
    if (['静岡'].includes(dep)) return '稲取港';
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

function selectNearestPort(city, departure) {
  const portHubs = city.portHubs;
  if (!portHubs || portHubs.length === 0) return null;
  if (portHubs.length === 1) return portHubs[0];

  const selector = PORT_SELECT[city.id];
  if (selector) return selector(departure);

  return portHubs[0];
}

/**
 * スマートEX: 東海道・山陽・九州新幹線を双方向カバー
 */
const EX_CITIES = new Set([
  '東京', '横浜', '大宮', '品川',
  '名古屋',
  '京都', '大阪', '神戸', '姫路',
  '岡山', '広島', '小倉', '博多', '熊本', '鹿児島', '長崎',
]);

function resolveRailProviderByName(departure, targetCityName) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(targetCityName)) {
    return 'ex';
  }
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}

function resolveRailProvider(departure, city) {
  return resolveRailProviderByName(departure, city.name);
}
