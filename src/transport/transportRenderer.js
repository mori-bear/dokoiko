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

  const isIsland = city.type === 'island';
  // 島はJR予約リンク禁止。railGateway は Google Maps 起点としてのみ使用可。
  const hasRail  = !!access.railGateway && !isIsland;
  const hasAir   = !!access.airportGateway;
  // 島はフェリーを常時表示（air との組み合わせも可）
  // 非島: ferryGateway あり かつ air なしの場合のみ
  const hasFerry = !!access.ferryGateway && (isIsland || !hasAir);

  const links = [];
  const stars = city.distanceStars ?? 0;

  // ★4〜5: 飛行機を優先表示 → 鉄道は後続
  // ★1〜3: 鉄道を優先表示 → 飛行機は補助

  if (stars >= 4) {
    // 飛行機（優先）
    if (hasAir) {
      const sc = buildSkyscannerLink(fromCity.iata, access.airportGateway);
      if (sc) links.push(sc);
    }
    // 鉄道（補助）
    if (hasRail) {
      const jrLink = buildJrLink(resolveRailProvider(departure, city));
      if (jrLink) links.push(jrLink);
      links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    }
  } else {
    // 鉄道（優先）
    if (hasRail) {
      const jrLink = buildJrLink(resolveRailProvider(departure, city));
      if (jrLink) links.push(jrLink);
      links.push(buildGoogleMapsLink(fromCity.rail, dest, datetime, 'transit'));
    }
    // 飛行機（補助）
    if (hasAir) {
      const sc = buildSkyscannerLink(fromCity.iata, access.airportGateway);
      if (sc) links.push(sc);
    }
  }

  // フェリー: フェリー予約/案内 + Googleマップ（出発地 → フェリー港）
  if (hasFerry) {
    const ferryLink = buildFerryLink(access.ferryGateway);
    if (ferryLink) links.push(ferryLink);
    links.push(buildGoogleMapsLink(fromCity.rail, access.ferryGateway, datetime, 'transit'));
  }

  // 島で railGateway あり（フェリー港への交通）: Googleマップ transit のみ（JR予約なし）
  if (isIsland && access.railGateway && !hasFerry && !hasAir) {
    links.push(buildGoogleMapsLink(fromCity.rail, access.railGateway, datetime, 'transit'));
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

/**
 * スマートEX（EX予約）: 東海道・山陽・九州新幹線を双方向カバー
 * 出発・到着のどちらかがこのセットに含まれれば EX を優先
 */
const EX_CITIES = new Set([
  '東京', '横浜', '大宮', '品川',
  '名古屋',
  '京都', '大阪', '神戸', '姫路',
  '岡山', '広島', '小倉', '博多', '熊本', '鹿児島', '長崎',
]);

/**
 * JR予約プロバイダを決定する。
 *
 * スマートEX（新幹線）:
 *   出発・到着 両方が EX_CITIES に含まれる場合
 *
 * えきねっと（在来線/特急）: JR東日本エリア
 * JR九州予約: 九州エリア（EX非対象路線）
 * e5489: JR西日本エリア
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
