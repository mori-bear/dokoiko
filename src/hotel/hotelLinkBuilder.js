/**
 * 宿泊リンクビルダー
 *
 * 楽天: travel.rakuten.co.jp/yado/{hotelArea}/ — 都道府県エリアページ直リンク
 * じゃらん: jalan.net/uw/uwp2011/uww2011init.do?keyword= — 直リンク
 *
 * アフィリエイトラッパーなし（hb.afl.rakuten / valuecommerce は使用しない）
 */

/**
 * 楽天エリアページURLを生成する（直リンク）
 * @param {object} dest — destination エントリ
 * @returns {string} URL
 */
function buildRakutenUrl(dest) {
  if (!dest.hotelArea) return 'https://travel.rakuten.co.jp/';
  return `https://travel.rakuten.co.jp/yado/${dest.hotelArea}/`;
}

/**
 * じゃらんURLを生成する（直リンク）
 * @param {object} dest — destination エントリ
 * @returns {string} URL
 */
function buildJalanUrl(dest) {
  const keyword = encodeURIComponent(dest.name);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${keyword}`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const result = {
    heading: `${dest.name}の宿を探す`,
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(dest) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(dest) },
    ],
  };

  // ハブ宿: 車必須 + gatewayHub が設定されている場合のみ表示（珠洲→金沢 など）
  if (dest.needsCar && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hubDest = { name: dest.gatewayHub, hotelArea: null };
    result.hubLinks = {
      heading: `${dest.gatewayHub}の宿（拠点として）`,
      links: [
        { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(hubDest) },
        { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(hubDest) },
      ],
    };
  }

  return result;
}
