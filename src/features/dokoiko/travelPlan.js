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
import { buildRentalLink }       from '../../transport/linkBuilder.js';
import { DEPARTURE_CITY_INFO }   from '../../config/constants.js';

export function buildTravelPlan(destination, departure) {
  const transportLinks = resolveTransportLinks(destination, departure);

  /* メイン交通手段タイプを判定（render での強調表示に使用） */
  const mainCtaLink = transportLinks.find(l => l.type === 'main-cta');
  const mainCtaType = _ctaTypeToCategory(mainCtaLink?.cta?.type ?? null);

  const hotelLinks = buildHotelLinks(destination);
  const hasRental  = transportLinks.some(l => l.type === 'rental');

  /* レンタカー必須 / mountain / remote で既存ルートが公共交通を含む場合、
   * 「直行レンタカー」代替ルートを生成する */
  const isCarRequired = destination.needsCar
    || destination.destType === 'remote'
    || destination.destType === 'mountain';
  const hasTransitInMain = transportLinks.some(
    l => l.type === 'main-cta' && ['jr-east','jr-west','jr-ex','jr-kyushu','jr-window','skyscanner','google-flights'].includes(l.cta?.type)
  );
  const altTransportLinks = (isCarRequired && hasTransitInMain)
    ? _buildDirectCarLinks(destination, departure)
    : null;

  return { transportLinks, altTransportLinks, hotelLinks, mainCtaType, hasRental };
}

/** レンタカー直行ルート（Pattern B）を生成する */
function _buildDirectCarLinks(destination, departure) {
  const destLabel  = destination.displayName || destination.name;
  const destTarget = destination.mapPoint ?? destLabel;
  const fromStation = DEPARTURE_CITY_INFO[departure]?.rail ?? departure;
  const url = (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(fromStation)}` +
    `&destination=${encodeURIComponent(destTarget)}` +
    `&travelmode=driving`
  );
  const cta = { type: 'google-maps', label: `${departure}からそのまま車で行く（Googleマップ）`, url };
  return [
    { type: 'summary', transfers: 0 },
    { type: 'main-cta', cta },
    { type: 'step-group', stepLabel: `① ${fromStation} → ${destLabel}（レンタカー直行）`, cta, caution: null },
    buildRentalLink(),
  ];
}

function _ctaTypeToCategory(ctaType) {
  if (!ctaType) return null;
  if (ctaType === 'skyscanner' || ctaType === 'google-flights') return 'flight';
  if (['jr-east', 'jr-west', 'jr-kyushu', 'jr-ex', 'jr-window'].includes(ctaType)) return 'jr';
  if (ctaType === 'ferry') return 'ferry';
  if (ctaType === 'google-maps') return 'map';
  return null;
}
