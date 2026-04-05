/**
 * buildRouteMapUrl.js — Google Maps ルートURL生成ユーティリティ
 *
 * ルール:
 *   - origin      = departure の鉄道駅名 (DEPARTURE_CITY_INFO[departure].rail)
 *   - destination = destOverride → city.accessStation → city.displayName → city.name の順
 *   - 緯度経度は絶対に使用しない（URL に座標を含めない）
 *   - travelmode は常に transit（鉄道・バス・フェリー経路検索）
 *
 * destOverride 用途:
 *   hubCity がある目的地（例: 境港 → hubCity '米子'）では、
 *   destOverride に hubCity を渡すことで Maps の目的地を実際の乗降地点にする。
 *
 * 使用例:
 *   buildRouteMapUrl('東京', city)
 *   → https://www.google.com/maps/dir/?api=1&origin=東京駅&destination=熱海駅&travelmode=transit
 *
 *   buildRouteMapUrl('東京', sakaiminato, '米子')
 *   → https://www.google.com/maps/dir/?api=1&origin=東京駅&destination=米子&travelmode=transit
 */

import { DEPARTURE_CITY_INFO } from '../../config/constants.js';

/**
 * @param {string}      departure    — 出発都市名（'東京'など）
 * @param {object}      city         — destinations.json エントリ
 * @param {string|null} [destOverride] — 目的地を上書きする場合に渡す（hubCity など）
 * @returns {string|null}
 */
export function buildRouteMapUrl(departure, city, destOverride = null) {
  if (!departure || !city) return null;

  const origin = DEPARTURE_CITY_INFO[departure]?.rail;
  const dest   = destOverride
    ?? city.accessStation
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
