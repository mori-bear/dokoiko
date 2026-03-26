/**
 * buildTravelPlan — 旅行プラン生成の司令塔
 *
 * 交通・宿・レンタカーを1オブジェクトにまとめて返す。
 * app.js から呼び出し、render.js はこの結果を描画するだけ。
 *
 * @param {object} destination — destinations.json エントリ
 * @param {string} departure   — 出発都市名
 * @returns {{
 *   transportLinks: Array,   — step-group 配列（render.js が受け取る形式そのまま）
 *   hotelLinks: object,      — buildHotelLinks の戻り値
 *   mainCtaType: string|null,— 'flight' | 'jr' | 'ferry' | 'map' | null
 *   hasRental: boolean        — レンタカーリンクを含むか
 * }}
 */

import { resolveTransportLinks } from '../../transport/resolveTransportLinks.js';
import { buildHotelLinks }       from '../../hotel/hotelLinkBuilder.js';

export function buildTravelPlan(destination, departure) {
  const transportLinks = resolveTransportLinks(destination, departure);

  /* メイン交通手段タイプを判定（render での強調表示に使用） */
  const mainCtaLink = transportLinks.find(l => l.type === 'main-cta');
  const mainCtaType = _ctaTypeToCategory(mainCtaLink?.cta?.type ?? null);

  const hotelLinks = buildHotelLinks(destination);
  const hasRental  = transportLinks.some(l => l.type === 'rental');

  return { transportLinks, hotelLinks, mainCtaType, hasRental };
}

function _ctaTypeToCategory(ctaType) {
  if (!ctaType) return null;
  if (ctaType === 'skyscanner' || ctaType === 'google-flights') return 'flight';
  if (['jr-east', 'jr-west', 'jr-kyushu', 'jr-ex', 'jr-window'].includes(ctaType)) return 'jr';
  if (ctaType === 'ferry') return 'ferry';
  if (ctaType === 'google-maps') return 'map';
  return null;
}
