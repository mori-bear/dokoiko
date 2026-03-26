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
// 楽天リファラルパラメータ（アフィリエイトラッパーなし・URLパラメータのみ）
const RAKUTEN_PARAMS = '?scid=af_sp_etc&sc2id=af_101_0_0';

function buildRakutenUrl(dest) {
  if (!dest.hotelArea) return `https://travel.rakuten.co.jp/${RAKUTEN_PARAMS}`;
  return `https://travel.rakuten.co.jp/yado/${dest.hotelArea}/${RAKUTEN_PARAMS}`;
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

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合（珠洲→金沢 など）
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
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
