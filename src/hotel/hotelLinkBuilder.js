/**
 * 宿泊リンクビルダー
 *
 * 楽天: エリアコード検索（f_cid）— キーワード検索より確実に宿一覧に到達する
 * じゃらん: キーワード検索（keyword=）— 単一encodeのみ
 */

// 楽天トラベル アフィリエイトプレフィックス
const RAKUTEN_AFFILIATE = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';

// じゃらん アフィリエイト + keyword= まで事前エンコード済み
const JALAN_BASE = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=' +
  encodeURIComponent('https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=');

/**
 * 楽天トラベル URL（エリアコード方式）
 * @param {object} dest
 * @returns {string|null}
 */
function buildRakutenLink(dest) {
  if (!dest.hotelArea) return null;
  const inner = `https://hotel.travel.rakuten.co.jp/hotel/search.do?f_flg=0&f_cid=${dest.hotelArea}`;
  return RAKUTEN_AFFILIATE + encodeURIComponent(inner);
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array }} — null を返さない
 */
export function buildHotelLinks(dest) {
  const keyword = dest.hotelSearch || dest.displayName || dest.name || '旅先';

  const rakutenUrl = buildRakutenLink(dest);
  const jalanUrl   = JALAN_BASE + encodeURIComponent(keyword);

  const links = [];
  if (rakutenUrl) links.push({ type: 'rakuten', label: '楽天トラベルで探す', url: rakutenUrl });
  links.push({ type: 'jalan', label: 'じゃらんで探す', url: jalanUrl });

  return {
    heading: `${dest.name || keyword}の宿を探す`,
    links,
  };
}
