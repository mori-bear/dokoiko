/**
 * 宿泊リンク制御モジュール
 *
 * city.hasHotel === true の場合に宿泊ブロックを表示する。
 * city.hubHotel が存在する場合、ハブ都市の宿泊ブロックも追加表示。
 *
 * 実際のリンクURL生成は affiliate.js (applyAffiliateLinks) が担う。
 */

export function buildHotelLinks(city, destinations) {
  const hub = city.hubHotel
    ? destinations.find(d => d.id === city.hubHotel) || null
    : null;

  return { show: city.hasHotel !== false, hub };
}
