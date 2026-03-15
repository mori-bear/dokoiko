/**
 * 宿泊リンクビルダー（src/hotel/hotelLinkBuilder.js と同内容を維持）
 *
 * 楽天トラベル: prefecture + city キーワード検索 → 楽天アフィリエイト経由
 *   https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query={keyword}
 *
 * じゃらん: キーワード検索
 *   https://www.jalan.net/uw/uwp1700/uww1701.do?keyword={keyword}
 *
 * keyword = encodeURIComponent(area.rakutenKeyword || prefecture + " " + city)
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** hotelAreas マップ（initHotelAreas で初期化） */
let areaMap = new Map();

export function initHotelAreas(areasArray) {
  areaMap = new Map(areasArray.map(a => [a.id, a]));
}

function resolveKeyword(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.rakutenKeyword) return area.rakutenKeyword;
  }
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
