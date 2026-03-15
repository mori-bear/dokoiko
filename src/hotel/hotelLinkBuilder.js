/**
 * 宿泊リンクビルダー
 *
 * アーキテクチャ: destination → hotelArea → 宿リンク
 *   - initHotelAreas(areasArray) で事前初期化（app.js の init() で呼ぶ）
 *   - buildHotelLinks(dest) は dest.hotelArea → areaMap lookup → URL生成
 *   - hotelArea が未設定または未登録の場合: prefecture + city でフォールバック
 *
 * 楽天トラベル: area.rakutenKeyword キーワード検索 → 楽天アフィリエイト経由
 *   https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query={keyword}
 *
 * じゃらん: キーワード検索（area.rakutenKeyword 流用）
 *   https://www.jalan.net/uw/uwp1700/uww1701.do?keyword={keyword}
 *
 * 日帰りルール: render.js 側で stayType=daytrip 時に非表示制御済み
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** hotelAreas マップ（initHotelAreas で初期化） */
let areaMap = new Map();

/**
 * アプリ起動時に hotelAreas.json データを渡して初期化する。
 * @param {Array<{id, name, prefecture, city, rakutenKeyword, jalanCode}>} areasArray
 */
export function initHotelAreas(areasArray) {
  areaMap = new Map(areasArray.map(a => [a.id, a]));
}

/** キーワード解決: hotelArea → area.rakutenKeyword → フォールバック */
function resolveKeyword(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.rakutenKeyword) return area.rakutenKeyword;
  }
  return `${dest.prefecture} ${dest.city}`;
}

/**
 * @param {object} dest — destinations.json / hubs.json エントリ
 * @returns {Array<{type, label, url}>}
 */
export function buildHotelLinks(dest) {
  return [
    buildRakutenHotelLink(dest),
    buildJalanHotelLink(dest),
  ].filter(Boolean);
}

/** 楽天 target URL（テスト用にも export）*/
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

/** じゃらん target URL（テスト用にも export）*/
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
