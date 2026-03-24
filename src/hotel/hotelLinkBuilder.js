/**
 * 宿泊リンクビルダー — シンプル版
 *
 * 「〇〇の宿を探す」見出し + 楽天 / じゃらん の2ボタンのみ。
 * null は絶対に返さない。keyword は単一encodeのみ。
 */

// アフィリエイトラッパー + 検索URLプレフィックス（keyword部分のみ後付けencode）
const RAKUTEN_BASE = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=' +
  encodeURIComponent('https://travel.rakuten.co.jp/hotel/search.do?f_keyword=');

const JALAN_BASE = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=' +
  encodeURIComponent('https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=');

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array }} — null を返さない
 */
export function buildHotelLinks(dest) {
  const keyword = dest.hotelSearch || dest.displayName || dest.name || '旅先';
  const enc     = encodeURIComponent;

  return {
    heading: `${dest.name || keyword}の宿を探す`,
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: RAKUTEN_BASE + enc(keyword) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: JALAN_BASE + enc(keyword) },
    ],
  };
}
