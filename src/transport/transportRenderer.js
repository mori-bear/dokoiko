import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる。
 *
 * 表示順:
 *   1. Googleマップ（railGatewayがある場合のみ）
 *   2. JR/私鉄予約（鉄道のみ）
 *   3. 航空券比較（air、rail不在のみ）
 *   4. レンタカー（air、rail不在のみ）
 *   5. フェリーのみの場合: Googleマップ（出発駅→港）
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest = city.mapDestination || city.name;
  const { access } = city;
  if (!access) return [];

  const links = [];

  // 1. Googleマップ（railGatewayがある場合のみ）
  if (access.railGateway) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
  }

  // 2. JR/私鉄予約（鉄道のみ）
  if (access.railGateway) {
    const provider = resolveRailProvider(departure);
    const jrLink = buildJrLink(provider);
    if (jrLink) links.push(jrLink);
  }

  // 3 & 4. 航空（rail不在のみ）
  if (access.airportGateway && !access.railGateway && links.length < 3) {
    const skyscanner = buildSkyscannerLink(fromCity.iata, access.airportGateway);
    if (skyscanner && links.length < 3) links.push(skyscanner);
    if (links.length < 3) links.push(buildRentalLink());
  }

  // 5. フェリーのみ（rail・air不在）
  if (access.ferryGateway && !access.railGateway && !access.airportGateway && links.length < 3) {
    links.push(buildGoogleMapsLink(fromCity.rail, access.ferryGateway, datetime, 'transit'));
  }

  return links.filter(link => link && link.url);
}

/**
 * 出発地の JR エリアに基づいて予約プロバイダを決定する。
 *
 * jrArea:
 *   east   → えきねっと（JR東日本）
 *   kyushu → JR九州ネット予約
 *   west   → e5489（JR西日本 / 東海）
 */
function resolveRailProvider(departure) {
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
