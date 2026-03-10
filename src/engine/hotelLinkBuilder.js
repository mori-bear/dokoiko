/**
 * 宿泊リンクビルダー
 *
 * 楽天トラベル: 楽天アフィリエイト直接（hb.afl.rakuten.co.jp）
 * じゃらん:     ValueCommerce 経由（sid=3764408 / pid=892559858）
 *
 * フォールバック順: hotelSearch → hotelHub → name
 * 100% リンク生成を保証
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

export function buildHotelLinks(city) {
  return [
    buildRakutenHotelLink(city),
    buildJalanHotelLink(city),
  ].filter(Boolean);
}

function buildRakutenHotelLink(city) {
  const keyword = city.hotelSearch ?? city.hotelHub ?? city.name;
  const target  = 'https://travel.rakuten.co.jp/search/?keyword=' + encodeURIComponent(keyword) + '&f_tab=hotel';
  return {
    type:  'rakuten',
    label: '周辺の宿を見る（楽天トラベル）',
    url:   RAKUTEN_AFF + encodeURIComponent(target),
  };
}

function buildJalanHotelLink(city) {
  const keyword = city.hotelSearch ?? city.hotelHub ?? city.name;
  const target  = 'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=' + encodeURIComponent(keyword);
  return {
    type:  'jalan',
    label: '周辺の宿を見る（じゃらん）',
    url:   VC_BASE + encodeURIComponent(target),
  };
}
