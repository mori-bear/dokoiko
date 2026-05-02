/**
 * buildTravelPlan — 旅行プラン生成の司令塔
 *
 * transportEngine.buildTransportContext を唯一の交通情報源として使用する。
 * render.js はこの結果を描画するだけ（交通手段の再判定禁止）。
 *
 * @param {object} destination — destinations.json エントリ
 * @param {string} departure   — 出発都市名
 * @param {Array}  allDests    — hubs + destinations の全エントリ（hub ID 解決用）
 * @returns {{
 *   transportLinks: Array,         — step-group 配列（render.js 互換形式）
 *   hotelLinks: object,            — buildHotelLinks の戻り値
 *   transportContext: object,      — engine の完全コンテキスト（拡張用）
 * }}
 */

import { buildTransportContext } from '../../engine/transportEngine.js';
import { buildHotelLinks, resolveStay } from '../../hotel/hotelLinkBuilder.js';

export function buildTravelPlan(destination, departure, allDests = []) {
  /* 交通コンテキスト（engine が唯一の正） */
  const context = buildTransportContext(departure, destination);

  /* 宿泊（交通から完全独立） */
  const hotelLinks   = buildHotelLinks(destination);
  const stayCityName = resolveStay(destination);

  /* ハブ都市が目的地自身と異なる場合: 目的地直接リンクとハブリンクを分離 */
  const destName = destination.displayName || destination.name;
  const hasHubCity = destination.hubCity && destination.hubCity !== destName;
  const destHotelLinks = hasHubCity ? buildHotelLinks({ ...destination, hubCity: null }) : hotelLinks;

  /* hubCity ベースのハブリンク（奈良→京都 など） */
  let hubHotelLinks = hasHubCity ? hotelLinks : null;

  /* hub フィールドベースの乗り継ぎ拠点リンク（与那国島→那覇 など）
   * hubCity ハブが未設定の場合のみ適用 */
  if (!hubHotelLinks && destination.hub && destination.hub !== destination.id) {
    const hubEntry = allDests.find(d => d.id === destination.hub);
    if (hubEntry) {
      hubHotelLinks = buildHotelLinks(hubEntry);
    }
  }

  return {
    transportLinks:   context.stepGroups,
    hotelLinks:       destHotelLinks,   // 目的地直接リンク（メイン）
    hubHotelLinks,                      // ハブ都市リンク（前泊・乗り継ぎ）
    stayCityName,
    transportContext: context,
  };
}
