/**
 * buildTravelPlan — 旅行プラン生成の司令塔
 *
 * 交通・宿を1オブジェクトにまとめて返す。
 * app.js から呼び出し、render.js はこの結果を描画するだけ。
 *
 * @param {object} destination — destinations.json エントリ
 * @param {string} departure   — 出発都市名
 * @returns {{
 *   transportLinks: Array, — step-group 配列（render.js が受け取る形式そのまま）
 *   hotelLinks: object,    — buildHotelLinks の戻り値
 * }}
 */

import { resolveTransportLinks } from '../../transport/resolveTransportLinks.js';
import { buildHotelLinks }       from '../../hotel/hotelLinkBuilder.js';

export function buildTravelPlan(destination, departure) {
  const transportLinks = resolveTransportLinks(destination, departure);
  const hotelLinks     = buildHotelLinks(destination);
  return { transportLinks, hotelLinks };
}
