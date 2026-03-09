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
 * access フィールドから交通手段を判定する（優先順位）:
 *   1. portHubs あり（島）   → フェリー（最寄り港選択） + Googleマップ transit
 *   2. ferryGateway のみ     → フェリー + Googleマップ transit
 *   3. airportGateway のみ   → Skyscanner
 *   4. railGateway + accessHub あり → JR予約(accessHubまで) + 2段階Googleマップ
 *   5. railGateway + railNote なし  → JR予約リンク + Googleマップ transit
 *   6. railGateway + railNote あり  → Googleマップ transit のみ（バス・私鉄等）
 *   7. needsCar=true       → Googleマップ driving
 *
 * ★1 の場合: Googleマップ transit のみ（JR/航空ボタン非表示）
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest      = city.name;
  const stars     = city.distanceStars ?? 0;
  const access    = city.access;
  const accessHub = city.accessHub ?? null;
  const links     = [];

  const railGateway    = access?.railGateway    ?? null;
  const railNote       = access?.railNote       ?? null;
  const airportGateway = access?.airportGateway ?? null;
  const ferryGateway   = access?.ferryGateway   ?? null;

  // 経路目的地の優先順位: railGateway > accessHub > city.name
  const targetStation = railGateway ?? accessHub ?? city.name;

  // ★1: Googleマップのみ
  if (stars === 1) {
    return [buildGoogleMapsLink(fromCity.rail, targetStation, 'transit')];
  }

  if (!access) return [];

  // 1. 島・portHubs: 出発地に最も近い港を選択
  if (city.portHubs && city.portHubs.length > 0) {
    const port = selectNearestPort(city, departure);
    if (port) {
      const ferryLink = buildFerryLink(port);
      if (ferryLink) links.push(ferryLink);
      links.push(buildGoogleMapsLink(fromCity.rail, port, 'transit'));
      return links.filter(link => link && link.url);
    }
  }

  // 2. フェリー（ferryGateway あり・railGateway なし）
  if (ferryGateway && !railGateway) {
    const ferryLink = buildFerryLink(ferryGateway);
    if (ferryLink) links.push(ferryLink);
    links.push(buildGoogleMapsLink(fromCity.rail, ferryGateway, 'transit'));
    return links.filter(link => link && link.url);
  }

  // 3. 航空（airportGateway あり・railGateway なし）
  if (airportGateway && !railGateway) {
    const sc = buildSkyscannerLink(fromCity.iata, airportGateway);
    if (sc) links.push(sc);
    return links.filter(link => link && link.url);
  }

  // 4. accessHub あり → 2段階ルーティング
  //    出発地 → railGateway（JR予約 + Googleマップ transit）
  //    railGateway → destination（Googleマップ transit: バス等）
  if (railGateway && accessHub) {
    const jrLink = buildJrLink(resolveRailProviderByName(departure, railGateway));
    if (jrLink) links.push(jrLink);
    links.push(buildGoogleMapsLink(fromCity.rail, railGateway, 'transit'));
    links.push(buildGoogleMapsLink(railGateway, city.name, 'transit', `${accessHub}駅 → ${city.name}（バス）`));
    return links.filter(link => link && link.url);
  }

  // 5 / 6. 鉄道（railGateway あり・accessHub なし）
  if (railGateway) {
    if (!railNote) {
      // railNote なし → JR直通 → JR予約リンク表示
      const jrLink = buildJrLink(resolveRailProvider(departure, city));
      if (jrLink) links.push(jrLink);
    }
    // railNote あり → バス・私鉄等でのアクセス → Googleマップのみ
    links.push(buildGoogleMapsLink(fromCity.rail, railGateway, 'transit'));
    return links.filter(link => link && link.url);
  }

  // 7. 車（needsCar=true のみ driving）
  if (city.needsCar) {
    links.push(buildGoogleMapsLink(fromCity.rail, city.name, 'driving'));
  }
  return links.filter(link => link && link.url);
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
 * EX対象: 出発・到着ともに EX_CITIES の場合
 * それ以外: 出発地の jrArea で判定
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
 * JR予約プロバイダを決定する（city オブジェクトベース、既存互換）。
 */
function resolveRailProvider(departure, city) {
  return resolveRailProviderByName(departure, city.name);
}
