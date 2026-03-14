/**
 * 宿泊リンクビルダー
 *
 * 楽天トラベル: キーワード検索 → 楽天アフィリエイト経由
 *   https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=
 *   https://kw.travel.rakuten.co.jp/keyword/Search.do?f_keyword={keyword}
 *
 * じゃらん: 都市キーワード検索 → ValueCommerce 経由
 *   https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858
 *   &vc_url=https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={keyword}
 *
 * キーワード優先順: hotelHub → hotelSearch → name
 *
 * 日帰りルール: render.js 側で stayType=daytrip 時に非表示制御済み
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** キーワード解決: hotelHub → hotelSearch → name */
function resolveKeyword(city) {
  return city.hotelHub ?? city.hotelSearch ?? city.name;
}

/**
 * @param {object} city — destinations.json エントリ
 * @returns {Array<{type, label, url}>}
 */
export function buildHotelLinks(city) {
  return [
    buildRakutenHotelLink(city),
    buildJalanHotelLink(city),
  ].filter(Boolean);
}

/** 楽天 target URL（テスト用にも export）*/
export function buildRakutenTarget(city) {
  const keyword = resolveKeyword(city);
  return `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_keyword=${encodeURIComponent(keyword)}`;
}

function buildRakutenHotelLink(city) {
  const keyword = resolveKeyword(city);
  const target  = buildRakutenTarget(city);
  // pc パラメータはRakutenの仕様に合わせてそのまま連結（keyword のみ encode 済み）
  return {
    type:  'rakuten',
    label: `${keyword}の宿を見る（楽天）`,
    url:   RAKUTEN_AFF + target,
  };
}

/** じゃらん target URL（テスト用にも export）*/
export function buildJalanTarget(city) {
  const keyword = resolveKeyword(city);
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`;
}

function buildJalanHotelLink(city) {
  const keyword = resolveKeyword(city);
  const target  = buildJalanTarget(city);
  return {
    type:  'jalan',
    label: `${keyword}の宿を見る（じゃらん）`,
    url:   VC_BASE + encodeURIComponent(target),
  };
}
