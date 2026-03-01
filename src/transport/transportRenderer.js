import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
  buildRentalLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる（最大3リンク）。
 *
 * 表示順・ルール:
 *   1. 鉄道 — Google Maps transit + JR予約（出発地別分岐）
 *   2. 航空 — Skyscanner + レンタカー（railが存在する場合は完全非表示）
 *   3. バス  — rail不在かつ枠が余る場合のみ
 *   4. フェリー — rail・air不在かつ枠が余る場合のみ
 *
 * 思想:
 *   - 物理的に存在しない交通手段は絶対に出さない
 *   - 鉄道で到達できる都市に航空リンクは表示しない
 *   - Google Maps の driving（空港→目的地）は使用しない
 *   - 合計最大3リンク
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest = city.mapDestination || city.name;
  const { access } = city;
  if (!access) return [];

  const links = [];

  // 1. 鉄道（最優先）
  if (access.rail) {
    const { bookingProvider } = access.rail;
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    const jrLink = buildJrLink(resolveBookingProvider(bookingProvider, departure));
    if (jrLink) links.push(jrLink);
  }

  // 2. 航空（railが存在する場合は完全非表示）
  if (access.air && !access.rail && links.length < 3) {
    const { airportName } = access.air;
    const skyscanner = buildSkyscannerLink(fromCity.iata, airportName);
    if (skyscanner && links.length < 3) links.push(skyscanner);
    if (links.length < 3) links.push(buildRentalLink());
  }

  // 3. 高速バス（rail不在かつ枠が余る場合のみ）
  if (access.bus && !access.rail && links.length < 3) {
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
  }

  // 4. フェリーのみ（rail・air不在かつ枠が余る場合のみ）
  if (access.ferry && !access.rail && !access.air && links.length < 3) {
    links.push(buildGoogleMapsLink(access.ferry.portName, dest, datetime, 'transit'));
  }

  return links.filter(Boolean);
}

/**
 * 出発地×目的地のbookingProviderから最適なJR予約サービスを決定する。
 *
 * 分岐規則（要件E）:
 *   東日本・北海道エリア → ekinet
 *   東海道・山陽・九州新幹線含む区間 → e5489
 *   九州在来線特急中心 → jrkyushu
 *   EX（新幹線単体・東海道系のみ） → データでex指定の区間のみ
 *
 *   出発地による補正:
 *     名古屋出発 → JR東海管轄のためex最優先（東西どちらも）
 *     大阪/広島/高松出発 → JR西日本エリアのためekinet→e5489に補正
 *     大阪/広島/高松出発 → jrkyushu→e5489に補正（山陽経由）
 *     福岡出発 → 本州向けはe5489に補正
 *     東京/仙台/札幌出発 → jrkyushu→e5489に補正（山陽経由が現実的）
 */
function resolveBookingProvider(dataProvider, departure) {
  if (!dataProvider) return null;

  switch (departure) {
    case '東京':
    case '仙台':
    case '札幌':
      // 九州方面は山陽新幹線経由のe5489が実用的
      if (dataProvider === 'jrkyushu') return 'e5489';
      return dataProvider;

    case '名古屋':
      // JR東海本拠地: 東西どちらの方面もEXが最適
      if (dataProvider === 'ekinet' || dataProvider === 'e5489') return 'ex';
      // 九州方面も山陽経由のEX
      if (dataProvider === 'jrkyushu') return 'ex';
      return dataProvider;

    case '大阪':
    case '広島':
    case '高松':
      // JR西日本エリア出発: 東日本向けはe5489経由
      if (dataProvider === 'ekinet') return 'e5489';
      // 九州方面もe5489（山陽新幹線で接続）
      if (dataProvider === 'jrkyushu') return 'e5489';
      return dataProvider;

    case '福岡':
      // 九州出発で本州へ: e5489（山陽新幹線接続）
      if (dataProvider === 'ekinet') return 'e5489';
      if (dataProvider === 'e5489') return 'e5489';
      // 九州内はjrkyushuのまま
      return dataProvider;

    default:
      return dataProvider;
  }
}
