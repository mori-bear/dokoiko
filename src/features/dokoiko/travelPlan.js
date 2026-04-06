/**
 * buildTravelPlan — 旅行プラン生成の司令塔
 *
 * transportEngine.buildTransportContext を唯一の交通情報源として使用する。
 * render.js はこの結果を描画するだけ（交通手段の再判定禁止）。
 *
 * @param {object} destination — destinations.json エントリ
 * @param {string} departure   — 出発都市名
 * @returns {{
 *   transportLinks: Array,         — step-group 配列（render.js 互換形式）
 *   hotelLinks: object,            — buildHotelLinks の戻り値
 *   transportContext: object,      — engine の完全コンテキスト（拡張用）
 * }}
 */

import { buildTransportContext } from '../../engine/transportEngine.js';
import { buildHotelLinks, resolveStay } from '../../hotel/hotelLinkBuilder.js';

export function buildTravelPlan(destination, departure) {
  /* 交通コンテキスト（engine が唯一の正） */
  const context = buildTransportContext(departure, destination);

  /* 宿泊（交通から完全独立） */
  const hotelLinks   = buildHotelLinks(destination);
  const stayCityName = resolveStay(destination);

  return {
    transportLinks:   context.stepGroups,  // render.js 互換: step-group 配列
    hotelLinks,
    stayCityName,                          // 宿泊地名（UI表示用）
    transportContext: context,             // 拡張用: engine の完全コンテキスト
  };
}
