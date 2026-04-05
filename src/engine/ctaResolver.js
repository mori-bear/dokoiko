/**
 * ctaResolver.js — 交通手段タイプ別 CTA 生成エンジン
 *
 * 責務:
 *   - transportType ('flight'|'ferry'|'rail'|'bus'|'rental') から CTA オブジェクトを生成する
 *   - URL 生成は linkBuilder.js に委譲（このファイルは URL を直接組み立てない）
 *   - JR CTA は railProvider が存在する場合のみ生成（沖縄などで誤表示しない）
 *
 * 設計原則:
 *   - switch 文で交通種別を明示（if の連鎖禁止）
 *   - 各 case は独立（他の case の副作用なし）
 *   - null を返す場合は必ずコメントで理由を明記
 */

import {
  buildJrLink,
  buildSkyscannerLink,
  buildGoogleFlightsLink,
  buildFerryLink,
  buildFerryLinkForDest,
  buildHighwayBusLink,
  buildRentalLink,
} from '../transport/linkBuilder.js';
import { CITY_AIRPORT } from '../utilities/airportMap.js';
import { AIRPORT_HUB_GATEWAY } from '../transport/linkBuilder.js';

/**
 * 交通手段タイプと目的地情報から CTA オブジェクトを生成する。
 *
 * @param {'flight'|'ferry'|'rail'|'bus'|'rental'} transportType
 * @param {string} departure  — 出発都市名（'東京'など）
 * @param {object} city       — destinations.json エントリ
 * @returns {object|null}     — linkBuilder が返す CTA オブジェクト、生成不可なら null
 */
export function resolveCtaByType(transportType, departure, city) {
  switch (transportType) {

    case 'flight': {
      // 出発地の IATA コードがなければ CTA 生成不可
      const fromIata  = CITY_AIRPORT[departure] ?? null;
      if (!fromIata) return null;

      // 到着空港: airportGateway → flightHub 経由 AIRPORT_HUB_GATEWAY の順
      const toAirport = city.airportGateway
        ?? (city.flightHub ? (AIRPORT_HUB_GATEWAY[city.flightHub] ?? null) : null)
        ?? '';

      // Skyscanner → Google Flights の順（どちらも失敗なら null）
      // JR へのフォールバックは絶対にしない
      return buildSkyscannerLink(fromIata, toAirport)
          ?? buildGoogleFlightsLink(fromIata, toAirport)
          ?? null;
    }

    case 'ferry': {
      // 目的地 ID + 出発港 でフェリーリンクを生成
      const gw      = city.ferryGateway ?? departure;
      const bookUrl = city.ferryBookingUrl ?? null;
      const op      = city.ferryOperator   ?? null;
      return buildFerryLinkForDest(city.id, gw, bookUrl, op)
          ?? buildFerryLink(gw, bookUrl, op)
          ?? null;
    }

    case 'rail': {
      // 沖縄 or 離島 の場合は JR CTA を生成しない
      // （railProvider: null は北海道など鉄道ある地域にも存在するため region/isIsland で判定）
      if (city?.region === '沖縄' || city?.isIsland === true) return null;
      if (!city.railProvider) return null;
      return buildJrLink(city.railProvider) ?? null;
    }

    case 'bus': {
      return buildHighwayBusLink(departure, city.displayName ?? city.name) ?? null;
    }

    case 'rental': {
      const gatewayCity = city.gatewayHub
        ?? city.gateway?.replace(/駅$/, '')
        ?? city.gatewayStations?.[0]?.name?.replace(/駅$/, '')
        ?? null;
      return gatewayCity ? (buildRentalLink(gatewayCity) ?? null) : null;
    }

    default:
      return null;
  }
}
