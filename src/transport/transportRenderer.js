import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる。
 *
 * 表示優先順:
 *   1. JR/私鉄予約（鉄道あり）
 *   2. Skyscanner（就航あり）
 *   3. Googleマップ（飛行機なし時のみ）
 *
 * ルール:
 *   - 飛行機表示時はGoogleマップ削除
 *   - 鉄道＋飛行機どちらもある場合: JR + Skyscanner（Googleマップなし）
 *   - 鉄道のみ: JR + Googleマップ
 *   - 飛行機のみ: Skyscanner
 *   - フェリーのみ: Googleマップ（港→）
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest = city.mapDestination || city.name;
  const { access } = city;
  if (!access) return [];

  const hasRail   = !!access.railGateway;
  const hasAirRaw = !!access.airportGateway;
  const hasFerry  = !!access.ferryGateway && !hasRail && !hasAirRaw;

  // Skyscanner: AIRPORT_IATAに未登録の空港名はnullになり表示されない（エラーなし）
  let skyscannerLink = null;
  if (hasAirRaw) {
    skyscannerLink = buildSkyscannerLink(fromCity.iata, access.airportGateway);
  }
  const hasAir = !!skyscannerLink;

  const links = [];

  // 1. JR予約（鉄道あり）
  if (hasRail) {
    const provider = resolveRailProvider(departure, city);
    const jrLink = buildJrLink(provider);
    if (jrLink) links.push(jrLink);
  }

  // 2. Skyscanner（就航あり）
  if (hasAir) {
    links.push(skyscannerLink);
  }

  // 3. Googleマップ（飛行機なし時のみ）
  if (!hasAir) {
    if (hasRail) {
      links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    } else if (hasFerry) {
      links.push(buildGoogleMapsLink(fromCity.rail, access.ferryGateway, datetime, 'transit'));
    }
  }

  return links.filter(link => link && link.url);
}

/**
 * 出発地×到着地でJR予約プロバイダを決定する。
 *
 * EX（スマートEX）:
 *   東京・横浜・大宮 発 → 東海道/山陽新幹線圏の主要都市 着 の場合のみ
 *   JR西日本エリア発は e5489 固定（EX適用なし）
 *
 *   east → ekinet（EX対象外の東北/北海道方面）
 *   west → e5489 固定
 *   kyushu → JR九州ネット予約
 */

// EXを使う出発地（東海道側 JR East 主要駅のみ）
const EX_DEPARTURE = new Set(['東京', '横浜', '大宮']);

// EX対象の到着都市名（東海道/山陽/九州新幹線）
const EX_DEST = new Set([
  '名古屋', '京都', '大阪', '神戸', '姫路',
  '広島', '岡山', '博多', '熊本', '鹿児島', '長崎',
]);

function resolveRailProvider(departure, city) {
  if (EX_DEPARTURE.has(departure) && EX_DEST.has(city.name)) {
    return 'ex';
  }
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
