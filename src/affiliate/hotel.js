/**
 * 宿泊リンク制御モジュール
 *
 * 実際のリンクURL生成は affiliate.js (applyAffiliateLinks) が担う。
 * このモジュールは「宿泊ブロックを表示するか」の判定のみを行う。
 */

export function buildHotelLinks(city, stayType) {
  if (stayType !== '1night') {
    return { show: false };
  }
  return { show: true };
}
