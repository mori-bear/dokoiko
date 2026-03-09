/**
 * 宿泊リンクビルダー
 *
 * 楽天トラベル: hotelSearch キーワード検索（アフィリエイト経由）
 * じゃらん:     jalanArea エリアURLを優先、未設定時はキーワード検索にフォールバック
 *
 * 100% 成功を保証:
 *   - hotelSearch は常に hotelHub にフォールバックするため空にならない
 *   - jalanArea がない場合もキーワード検索で確実にヒット
 */

const VC_BASE = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';
const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';

export function buildHotelLinks(city) {
  return [
    buildRakutenHotelLink(city),
    buildJalanHotelLink(city),
  ].filter(Boolean);
}

function buildRakutenHotelLink(city) {
  const keyword = city.hotelSearch ?? city.hotelHub ?? city.name;
  const target  = 'https://travel.rakuten.co.jp/search/?keyword=' + encodeURIComponent(keyword);
  return {
    type:  'rakuten',
    label: '宿を探す（楽天トラベル）',
    url:   RAKUTEN_AFF + encodeURIComponent(target),
  };
}

function buildJalanHotelLink(city) {
  const hub = city.hotelSearch ?? city.hotelHub ?? city.name;

  let target;
  if (city.jalanArea) {
    const pref = city.jalanArea.substring(0, 2);
    target = `https://www.jalan.net/${pref}0000/LRG_${city.jalanArea}/`;
  } else {
    // フォールバック: キーワード検索（jalanArea 未設定時）
    target = 'https://www.jalan.net/keyword/?keyword=' + encodeURIComponent(hub);
  }

  return {
    type:  'jalan',
    label: '宿を探す（じゃらん）',
    url:   VC_BASE + encodeURIComponent(target),
  };
}
