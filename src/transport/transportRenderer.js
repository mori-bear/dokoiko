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
 * transport.main による分岐:
 *   jr          → JR予約ボタン + Googleマップ(transit)
 *   privateRail → Googleマップ(transit) のみ（私鉄なのでJR予約なし）
 *   bus         → Googleマップ(transit) のみ
 *   air         → Skyscanner + Googleマップ(transit)
 *   ferry       → フェリー予約 + Googleマップ(transit)
 *   car         → Googleマップ(driving)
 *
 * ★1 の場合: Googleマップのみ（JR/航空ボタン非表示）
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest   = city.mapDestination || city.name;
  const stars  = city.distanceStars ?? 0;
  const tr     = city.transport;
  const access = city.access;

  // ★1: Googleマップのみ
  if (stars === 1) {
    return [buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit')];
  }

  if (!tr && !access) return [];

  const main   = tr?.main ?? 'jr';
  const links  = [];

  if (main === 'jr') {
    const jrLink = buildJrLink(resolveRailProvider(departure, city));
    if (jrLink) links.push(jrLink);
    const gw = tr?.railGateway ?? access?.railGateway ?? dest;
    links.push(buildGoogleMapsLink(fromCity.rail, gw, datetime, 'transit'));

  } else if (main === 'privateRail') {
    const gw = tr?.railGateway ?? access?.railGateway ?? dest;
    links.push(buildGoogleMapsLink(fromCity.rail, gw, datetime, 'transit'));

  } else if (main === 'bus') {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));

  } else if (main === 'air') {
    const airport = tr?.airport ?? access?.airportGateway;
    if (airport) {
      const sc = buildSkyscannerLink(fromCity.iata, airport);
      if (sc) links.push(sc);
    }
    // 島・遠方は Skyscanner のみ（Google Maps transit は不要）
    if (!airport) {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    }

  } else if (main === 'ferry') {
    const fg = access?.ferryGateway;
    if (fg) {
      const ferryLink = buildFerryLink(fg);
      if (ferryLink) links.push(ferryLink);
      links.push(buildGoogleMapsLink(fromCity.rail, fg, datetime, 'transit'));
    } else {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    }

  } else if (main === 'car') {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'driving'));

  } else {
    // fallback: Googleマップ transit
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
  }

  return links.filter(link => link && link.url);
}

/**
 * スマートEX（EX予約）: 東海道・山陽・九州新幹線を双方向カバー
 */
const EX_CITIES = new Set([
  '東京', '横浜', '大宮', '品川',
  '名古屋',
  '京都', '大阪', '神戸', '姫路',
  '岡山', '広島', '小倉', '博多', '熊本', '鹿児島', '長崎',
]);

/**
 * JR予約プロバイダを決定する。
 * EX対象: 出発・到着ともに EX_CITIES の場合
 * それ以外: 出発地の jrArea で判定
 */
function resolveRailProvider(departure, city) {
  if (EX_CITIES.has(departure) && EX_CITIES.has(city.name)) {
    return 'ex';
  }
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
