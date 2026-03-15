/**
 * 宿泊リンクビルダー（src/hotel/hotelLinkBuilder.js と同内容を維持）
 *
 * 楽天トラベル: prefecture + city キーワード検索 → 楽天アフィリエイト経由
 *   https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query={keyword}
 *
 * じゃらん: エリアページ（jalanPath あり）または キーワード検索（フォールバック）
 *   エリアページ: https://www.jalan.net{jalanPath}  例: /47/LRG_470010/
 *   キーワード:   https://www.jalan.net/uw/uwp1700/uww1701.do?keyword={keyword}
 *
 * keyword = encodeURIComponent(prefecture + " " + city)
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** キーワード: prefecture + " " + city 固定（CLAUDE.md 正式仕様）*/
function resolveKeyword(dest) {
  return `${dest.prefecture} ${dest.city}`;
}

export function buildHotelLinks(dest) {
  return [
    buildRakutenHotelLink(dest),
    buildJalanHotelLink(dest),
  ].filter(Boolean);
}

export function buildRakutenTarget(dest) {
  const keyword = encodeURIComponent(resolveKeyword(dest));
  return `https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query=${keyword}`;
}

function buildRakutenHotelLink(dest) {
  const target = buildRakutenTarget(dest);
  return {
    type:  'rakuten',
    label: `${dest.name}の宿を見る（楽天）`,
    url:   RAKUTEN_AFF + target,
  };
}

export function buildJalanTarget(dest) {
  if (dest.jalanPath) {
    return `https://www.jalan.net${dest.jalanPath}`;
  }
  const keyword = encodeURIComponent(resolveKeyword(dest));
  return `https://www.jalan.net/uw/uwp1700/uww1701.do?keyword=${keyword}`;
}

function buildJalanHotelLink(dest) {
  const target = buildJalanTarget(dest);
  return {
    type:  'jalan',
    label: `${dest.name}の宿を見る（じゃらん）`,
    url:   VC_BASE + encodeURIComponent(target),
  };
}
