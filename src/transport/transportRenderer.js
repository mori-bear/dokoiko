import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildTransitLink,
  buildAirMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildJrExLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる（ゲートウェイモデル）。
 *
 * 表示順:
 *   1. 🚄 鉄道     — Google Maps + JR予約
 *   2. 🚄 EX      — 東海道・山陽新幹線エリアのみ
 *   3. ✈  航空     — Skyscanner + Google Maps（空港→空港）
 *   4. 🚌 高速バス  — Google Maps
 *   5. 🚢 フェリー  — child 限定、Google Maps
 *   6. 🚗 レンタカー — air gateway 存在時のみ
 */
export function resolveTransportLinks(city, departure) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const fromRail    = fromCity.rail;
  const fromAirport = fromCity.airport;
  const fromIata    = fromCity.iata;
  const { gateways } = city;
  const links = [];
  let hasEx = false;

  // 1. 鉄道
  for (const gw of gateways.rail || []) {
    links.push(buildTransitLink(fromRail, gw.name));
    const jrLink = buildJrLink(gw.region);
    if (jrLink) links.push(jrLink);
    if (gw.region === 'central_west_shikoku') hasEx = true;
  }

  // 2. EX
  if (hasEx) {
    links.push(buildJrExLink());
  }

  // 3. 航空
  const airGateways = gateways.air || [];
  for (const gw of airGateways) {
    const skyscanner = buildSkyscannerLink(fromIata, gw.name);
    if (skyscanner) links.push(skyscanner);
    links.push(buildAirMapsLink(fromAirport, gw.name));
  }

  // 4. 高速バス
  for (const gw of gateways.bus || []) {
    links.push(buildTransitLink(departure, gw.name));
  }

  // 5. フェリー（child のみ）
  if (city.type === 'child') {
    for (const gw of gateways.ferry || []) {
      links.push(buildTransitLink(fromRail, gw.name));
    }
  }

  // 6. レンタカー（air gateway 存在時のみ）
  if (airGateways.length > 0) {
    links.push(buildRentalLink());
  }

  return links.filter(Boolean);
}
