/**
 * 宿泊リンク制御モジュール
 *
 * city.hasHotel === true の場合に宿泊ブロックを表示する。
 * city.hubHotel が存在する場合、ハブ都市の宿泊ブロックも追加表示。
 *
 * 実際のリンクURL生成は affiliate.js (applyAffiliateLinks) が担う。
 */

export function buildHotelLinks(city, destinations) {
  // 宿泊ブロックは常に表示（hasHotel=false でもキーワード検索 URL を使用）
  const hub = city.hubHotel
    ? destinations.find(d => d.id === city.hubHotel) || null
    : null;

  return { show: true, hub };
}
