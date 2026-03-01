import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる（最大3モード: rail / air / bus）。
 *
 * 表示順:
 *   1. 🚄 鉄道   — Google Maps（transit）+ JR予約（1ボタン）
 *   2. ✈  航空   — Skyscanner + Google Maps（driving: 出発空港→mapDestination）
 *   3. 🚌 高速バス — Google Maps（transit）
 *
 * - Google Maps の目的地は常に mapDestination（city.name）を使用する
 * - 出発日時を URL に反映する
 * - Yahoo は使用しない
 * - レンタカーは air アクセスがある場合のみ追加
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest = city.mapDestination || city.name;
  const { access } = city;
  if (!access) return [];

  const links = [];

  // 1. 鉄道
  if (access.rail) {
    const { bookingProvider } = access.rail;
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    const jrLink = buildJrLink(bookingProvider);
    if (jrLink) links.push(jrLink);
  }

  // 2. 航空
  if (access.air) {
    const { airportName } = access.air;
    const skyscanner = buildSkyscannerLink(fromCity.iata, airportName);
    if (skyscanner) links.push(skyscanner);
    links.push(buildGoogleMapsLink(fromCity.airport, dest, datetime, 'driving'));
    links.push(buildRentalLink());
  }

  // 3. 高速バス
  if (access.bus) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
  }

  // 4. フェリーのみ（鉄道・航空なし）
  if (access.ferry && !access.rail && !access.air) {
    links.push(buildGoogleMapsLink(access.ferry.portName, dest, datetime, 'transit'));
  }

  return links.filter(Boolean);
}
