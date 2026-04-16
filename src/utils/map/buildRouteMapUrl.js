/**
 * buildRouteMapUrl.js — Google Maps ルートURL生成ユーティリティ
 *
 * ルール:
 *   - origin      = departure の鉄道駅名 (DEPARTURE_CITY_INFO[departure].rail)
 *   - destination = destOverride（hubCity等） → lat,lng → city.name の優先順
 *   - 空港・駅を destination に使わない（選択画面を排除、1タップ遷移）
 *   - lat,lng が利用可能なら座標で直接ピン指定（最も正確）
 *   - travelmode は常に transit（鉄道・バス・フェリー経路検索）
 *
 * destOverride 用途:
 *   hubCity がある目的地（例: 境港 → hubCity '米子'）では、
 *   destOverride に hubCity を渡すことで Maps の目的地を実際の乗降地点にする。
 *
 * 使用例:
 *   buildRouteMapUrl('東京', city)
 *   → &destination=35.123,139.456  (lat/lng あり)
 *   → &destination=熱海  (lat/lng なし)
 *
 *   buildRouteMapUrl('東京', sakaiminato, '米子')
 *   → &destination=米子  (destOverride 優先)
 */

import { DEPARTURE_CITY_INFO } from '../../config/constants.js';

/**
 * @param {string}      departure      — 出発都市名（'東京'など）
 * @param {object}      city           — destinations.json エントリ
 * @param {string|null} [destOverride] — 目的地を上書きする場合に渡す（hubCity など）
 * @returns {string|null}
 */
export function buildRouteMapUrl(departure, city, destOverride = null) {
  if (!departure || !city) return null;

  const origin = DEPARTURE_CITY_INFO[departure]?.rail;

  // destination 優先順:
  //   1. destOverride（hubCity など、明示指定）
  //   2. city.navigation（秘境・山奥・温泉郷 のナビ地点）
  //   3. lat,lng（座標が使えるなら最も正確、選択画面を排除）
  //   4. city.name（最終フォールバック）
  // 空港・駅名は使わない
  const nav = city.navigation;
  const dest = destOverride
    ?? (nav?.lat && nav?.lng ? `${nav.lat},${nav.lng}` : null)
    ?? ((city.lat && city.lng) ? `${city.lat},${city.lng}` : null)
    ?? city.displayName
    ?? city.name;

  if (!origin || !dest) return null;

  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    '&travelmode=transit'
  );
}
