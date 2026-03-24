/**
 * 宿泊リンクビルダー — シンプル版
 *
 * 「〇〇の宿を探す」見出し + 楽天 / じゃらん の2ボタンのみ。
 * null は絶対に返さない。
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array }} — null を返さない
 */
export function buildHotelLinks(dest) {
  const enc  = encodeURIComponent;
  // hotelSearch → name → デフォルト の優先順でキーワードを決定
  const keyword = (typeof dest.hotelSearch === 'string' && dest.hotelSearch)
    ? dest.hotelSearch
    : (typeof dest.name === 'string' && dest.name) ? dest.name : '旅先';

  const rakutenSearch = `https://travel.rakuten.co.jp/package/search/?f_keyword=${enc(keyword)}`;
  const jalanSearch   = `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${enc(keyword)}`;

  return {
    heading: `${keyword}の宿を探す`,
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: RAKUTEN_AFF + enc(rakutenSearch) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: VC_BASE + enc(jalanSearch) },
    ],
  };
}

