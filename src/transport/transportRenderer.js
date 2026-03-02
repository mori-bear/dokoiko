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
    const provider = resolveRailProvider(departure, city);
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
 * 出発地×到着地でJR予約プロバイダを決定する。
 *
 * EX（スマートEX / EX予約）:
 *   東海道直通区間のみ。
 *   出発・到着の両方が {東京, 横浜, 名古屋, 京都, 大阪} に属する場合のみ適用。
 *
 * それ以外は出発地の jrArea 基準:
 *   east   → えきねっと（JR東日本）
 *   kyushu → JR九州ネット予約
 *   west   → e5489（JR西日本 / 東海）
 */

// 東海道直通EX対象駅（この集合の2都市間のみEX）
const EX_STATIONS = new Set(['東京', '横浜', '名古屋', '京都', '大阪']);

function resolveRailProvider(departure, city) {
  // EX特例: 東海道直通のみ
  if (EX_STATIONS.has(departure) && EX_STATIONS.has(city.name)) {
    return 'ex';
  }
  // 出発地jrAreaベース
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
