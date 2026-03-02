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
 * 表示優先順:
 *   1. JR/私鉄予約（鉄道あり）
 *   2. Skyscanner（就航あり）
 *   3. Googleマップ（飛行機なし時のみ）
 *   4. レンタカー（飛行機あり・鉄道なし時のみ）
 *
 * ルール:
 *   - 飛行機表示時はGoogleマップ削除
 *   - 鉄道＋飛行機どちらもある場合: JR + Skyscanner（Googleマップなし）
 *   - 鉄道のみ: JR + Googleマップ
 *   - 飛行機のみ: Skyscanner + レンタカー
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

  // Skyscanner: 就航確認（IATA変換できない場合は null）
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

  // 4. レンタカー（飛行機あり・鉄道なし）
  if (hasAir && !hasRail) {
    links.push(buildRentalLink());
  }

  return links.filter(link => link && link.url);
}

/**
 * 出発地×到着地でJR予約プロバイダを決定する。
 *
 * EX（スマートEX / EX予約）:
 *   東海道・山陽・九州・西九州新幹線の利用区間。
 *   出発・到着の両方が対象ネットワークに属する場合に適用。
 *
 * その他:
 *   east（東北・北海道新幹線エリア）  → えきねっと
 *   west（JR西日本・四国・山陰在来線）→ e5489
 *   kyushu（九州内特急のみ）          → JR九州ネット予約
 */

// 出発地：東海道/山陽/九州/西九州新幹線ネットワーク
const EX_DEPARTURE = new Set([
  '東京', '横浜', '静岡', '名古屋', '京都', '大阪', '神戸',
  '広島', '岡山', '福岡', '熊本', '鹿児島', '長崎',
]);

// 到着都市名（destinations.json の name フィールド）: EXネットワーク対象
const EX_DEST = new Set([
  '名古屋', '京都', '大阪', '神戸', '姫路',
  '広島', '岡山', '博多',
  '熊本', '鹿児島', '長崎',
]);

function resolveRailProvider(departure, city) {
  // EX: 出発・到着の両方がEXネットワークに属する場合
  if (EX_DEPARTURE.has(departure) && EX_DEST.has(city.name)) {
    return 'ex';
  }
  // 出発地のjrAreaで判定
  const area = DEPARTURE_CITY_INFO[departure]?.jrArea || 'west';
  if (area === 'east')   return 'ekinet';
  if (area === 'kyushu') return 'jrkyushu';
  return 'e5489';
}
