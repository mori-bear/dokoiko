/**
 * buildRouteMapUrl.js — Google Maps ルートURL生成ユーティリティ
 *
 * ルール:
 *   - origin    = departure の鉄道駅名 (DEPARTURE_CITY_INFO[departure].rail)
 *   - destination = city.accessStation → city.displayName → city.name の順
 *   - 緯度経度は絶対に使用しない
 *   - travelmode は常に transit（鉄道・バス・フェリー経路検索）
 *
 * 使用例:
 *   buildRouteMapUrl('東京', { accessStation: '熱海駅', name: '熱海' })
 *   → https://www.google.com/maps/dir/?api=1&origin=東京駅&destination=熱海駅&travelmode=transit
 */

import { DEPARTURE_CITY_INFO } from '../../config/constants.js';

/**
 * @param {string} departure  — 出発都市名（'東京'など）
 * @param {object} city       — destinations.json エントリ
 * @returns {string|null}
 */
export function buildRouteMapUrl(departure, city) {
  if (!departure || !city) return null;

  const origin = DEPARTURE_CITY_INFO[departure]?.rail;
  const dest   = city.accessStation ?? city.displayName ?? city.name;

  if (!origin || !dest) return null;

  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    '&travelmode=transit'
  );
}
