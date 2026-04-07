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
import { DEPARTURE_CITY_INFO } from '../config/constants.js';

/**
 * 出発地 × 目的地の区間でJR予約プロバイダを判定する。
 *
 * ルール:
 *   ① 九州内 → jrkyushu
 *   ② 東日本内（east × east）→ ekinet
 *   ③ 西日本が絡む（east含まない）→ e5489
 *   ④ 東京→大阪など東西跨ぎ → ex（スマートEX）
 *   ⑤ 判定不能 → 目的地のrailProviderにフォールバック
 */
function resolveJrProvider(departure, city) {
  const depArea = DEPARTURE_CITY_INFO[departure]?.jrArea ?? null;
  const destProvider = city.railProvider; // ekinet / e5489 / jrkyushu / ex

  if (!depArea || !destProvider) return destProvider;

  // ① 九州内完結
  if (depArea === 'kyushu' && destProvider === 'jrkyushu') return 'jrkyushu';

  // ② 東日本内完結
  if (depArea === 'east' && destProvider === 'ekinet') return 'ekinet';

  // ③ 西日本エリア同士（west × e5489/jrkyushu）
  if (depArea === 'west' && (destProvider === 'e5489' || destProvider === 'jrkyushu')) return 'e5489';

  // ④ 九州出発で西日本方面
  if (depArea === 'kyushu' && destProvider === 'e5489') return 'e5489';

  // ⑤ 東西跨ぎ（east × west系 or 逆）→ スマートEX
  if ((depArea === 'east' && destProvider !== 'ekinet') ||
      (depArea !== 'east' && destProvider === 'ekinet')) {
    return 'ex';
  }

  return destProvider;
}

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
      if (city?.region === '沖縄' || city?.isIsland === true) return null;
      if (!city.railProvider) return null;
      // 区間ベースでJRプロバイダを判定
      const provider = resolveJrProvider(departure, city);
      return provider ? (buildJrLink(provider) ?? null) : null;
    }

    case 'bus': {
      return buildHighwayBusLink(departure, city.displayName ?? city.name) ?? null;
    }

    case 'rental': {
      const destName = city.displayName ?? city.name;
      const gatewayCity = (city.hubCity && city.hubCity !== destName ? city.hubCity : null)
        ?? city.gateway?.replace(/駅$/, '')
        ?? city.gatewayStations?.[0]?.name?.replace(/駅$/, '')
        ?? null;
      return gatewayCity ? (buildRentalLink(gatewayCity) ?? null) : null;
    }

    default:
      return null;
  }
}
