import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildFerryLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる。
 *
 * 優先順位:
 *   1. portHubs あり（島）   → フェリー + Googleマップ transit（港まで）
 *   2. ferryGateway のみ     → フェリー + Googleマップ transit
 *   3. airportGateway のみ   → Skyscanner
 *   4. その他（鉄道・バス等）→ JR予約（shinkansenAccess=true のみ）+ Googleマップ transit
 *   5. needsCar=true         → Googleマップ driving
 *
 * ★1 の場合: Googleマップ transit のみ
 * Googleマップは常に 出発地 → city.name の1発ルート。
 * accessHub がある場合は二次交通テキストを付加する。
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest   = city.name;
  const stars  = city.distanceStars ?? 0;
  const access = city.access;
  const links  = [];

  const railGateway    = access?.railGateway    ?? null;
  const airportGateway = access?.airportGateway ?? null;
  const ferryGateway   = access?.ferryGateway   ?? null;
  const accessHub      = city.accessHub         ?? null;

  // ★1: Googleマップのみ（近場）
  if (stars === 1) {
    return [buildGoogleMapsLink(fromCity.rail, dest, 'transit')];
  }

  if (!access) return [];

  // 1. 島・portHubs: 出発地に最も近い港を選択
  if (city.portHubs && city.portHubs.length > 0) {
    const port = selectNearestPort(city, departure);
    if (port) {
      const ferryLink = buildFerryLink(port);
      if (ferryLink) links.push(ferryLink);
      links.push(buildGoogleMapsLink(fromCity.rail, port, 'transit'));
      return links.filter(l => l && l.url);
    }
  }

  // 2. フェリー（ferryGateway あり・railGateway なし）
  if (ferryGateway && !railGateway) {
    const ferryLink = buildFerryLink(ferryGateway);
    if (ferryLink) links.push(ferryLink);
    links.push(buildGoogleMapsLink(fromCity.rail, ferryGateway, 'transit'));
    return links.filter(l => l && l.url);
  }

  // 3. 航空（airportGateway あり・railGateway なし）
  if (airportGateway && !railGateway) {
    const sc = buildSkyscannerLink(fromCity.iata, airportGateway);
    if (sc) links.push(sc);
    return links.filter(l => l && l.url);
  }

  // 4. 鉄道・バス等（railGateway あり）
  if (railGateway) {
    // JR予約: shinkansenAccess=true のみ表示
    if (city.shinkansenAccess === true) {
      const jrLink = buildJrLink(resolveRailProvider(departure, city));
      if (jrLink) links.push(jrLink);
    }

    // Googleマップ: 常に出発地 → city.name
    links.push(buildGoogleMapsLink(fromCity.rail, dest, 'transit'));

    // 二次交通テキスト（accessHub がある場合）
    if (accessHub) {
      links.push({ type: 'note', label: `※ ${railGateway}からバス`, url: null });
    }

    return links.filter(l => l && (l.url || l.type === 'note'));
  }

  // 5. 車（needsCar=true のみ）
  if (city.needsCar) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, 'driving'));
  }
  return links.filter(l => l && l.url);
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

/**
 * JR予約プロバイダを決定する（city名ベース）。
 */
function resolveRailProviderByName(departure, targetCityName) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(targetCityName)) {
    return 'ex';
  }
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}

/**
 * JR予約プロバイダを決定する（city オブジェクトベース）。
 */
function resolveRailProvider(departure, city) {
  return resolveRailProviderByName(departure, city.name);
}
