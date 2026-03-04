import { DEPARTURE_CITY_INFO } from '../config/constants.js';
import {
  buildGoogleMapsLink,
  buildSkyscannerLink,
  buildJrLink,
} from './linkBuilder.js';

/**
 * 交通リンクを組み立てる。
 *
 * access に情報がある交通手段はすべて表示する（優遇・除外なし）。
 *   - 鉄道あり    → JR予約 + Googleマップ（transit）
 *   - 飛行機あり  → Skyscanner
 *   - フェリーのみ → Googleマップ（港→）
 */
export function resolveTransportLinks(city, departure, datetime) {
  const fromCity = DEPARTURE_CITY_INFO[departure];
  if (!fromCity) return [];

  const dest = city.mapDestination || city.name;
  const { access } = city;
  if (!access) return [];

  const hasRail  = !!access.railGateway;
  // 短距離（★1〜2）は航空表示しない。★3以上のみ有効。
  const hasAir   = !!access.airportGateway && (city.distanceStars ?? 0) >= 3;
  const hasFerry = !!access.ferryGateway && !hasRail && !hasAir;

  const links = [];

  // 鉄道: JR予約 + Googleマップ（transit）
  if (hasRail) {
    const jrLink = buildJrLink(resolveRailProvider(departure, city));
    if (jrLink) links.push(jrLink);
    links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
  }

  // 飛行機: Skyscanner（IATA未登録の空港は自動スキップ）
  if (hasAir) {
    const sc = buildSkyscannerLink(fromCity.iata, access.airportGateway);
    if (sc) links.push(sc);
  }

  // フェリーのみ: Googleマップ（出発地 → フェリー港）
  if (hasFerry) {
    links.push(buildGoogleMapsLink(fromCity.rail, access.ferryGateway, datetime, 'transit'));
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
