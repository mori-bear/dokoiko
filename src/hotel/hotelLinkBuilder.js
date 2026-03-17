/**
 * 宿泊リンクビルダー
 *
 * アーキテクチャ: destination → hotelArea → 宿リンク
 *   - initHotelAreas(areasArray) で事前初期化（app.js の init() で呼ぶ）
 *   - buildHotelLinks(dest) は dest.hotelArea → areaMap lookup → URL生成
 *   - hotelArea が未設定または未登録の場合: prefecture + city でフォールバック
 *
 * 楽天トラベル (TASK5):
 *   area.rakutenPath → https://travel.rakuten.co.jp{path}（エリアページ直リンク）
 *   フォールバック: area.rakutenKeyword → キーワード検索
 *   https://kw.travel.rakuten.co.jp/keyword/Search.do?f_query={keyword}
 *
 * じゃらん: area.jalanUrl（Shift-JIS事前エンコード済み）→ VC アフィリエイト経由
 *   https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={Shift-JIS encoded keyword}
 *   ブラウザ側でShift-JISエンコードできないため hotelAreas.json に事前計算済みURLを格納
 *
 * 返り値 (TASK4):
 *   { sections: [{ label, links }, ...] }
 *   - 島（isIsland / destType=island）かつ hub あり: 前泊セクション + 目的地セクション
 *   - それ以外: label=null の単一セクション
 *
 * 日帰りルール: render.js 側で stayType=daytrip 時に非表示制御済み
 */

const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';
const VC_BASE     = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=';

/** hotelAreas マップ（initHotelAreas で初期化） */
let areaMap = new Map();

/**
 * アプリ起動時に hotelAreas.json データを渡して初期化する。
 * @param {Array<{id, name, prefecture, city, rakutenPath, rakutenKeyword, jalanCode}>} areasArray
 */
export function initHotelAreas(areasArray) {
  areaMap = new Map(areasArray.map(a => [a.id, a]));
}

/** キーワード解決: hotelArea → area.rakutenKeyword → hotelSearch → hotelHub → prefecture+city */
function resolveKeyword(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.rakutenKeyword) return area.rakutenKeyword;
  }
  if (dest.hotelSearch) return dest.hotelSearch;
  if (dest.hotelHub)    return dest.hotelHub;
  return `${dest.prefecture} ${dest.city}`;
}

/**
 * @param {object} dest — destinations.json / hubs.json エントリ
 * @returns {{ sections: Array<{label: string|null, links: Array<{type, label, url}>}> }}
 */
export function buildHotelLinks(dest) {
  const isIsland = !!(dest.isIsland || dest.destType === 'island');
  const destLinks = [buildRakutenHotelLink(dest), buildJalanHotelLink(dest)].filter(Boolean);

  // TASK4: 島 + hub がある場合は前泊セクションを追加
  if (isIsland && dest.hub) {
    const hubLinks = buildHubHotelLinks(dest.hub);
    const hubArea  = areaMap.get(dest.hub);
    const hubName  = hubArea?.name || dest.hub;
    const sections = [];
    if (hubLinks.length) sections.push({ label: `${hubName}に前泊`, links: hubLinks });
    sections.push({ label: `${dest.name}の宿`, links: destLinks });
    return { sections };
  }

  return { sections: [{ label: null, links: destLinks }] };
}

/** hub ID を使って前泊宿リンクを生成 */
function buildHubHotelLinks(hubId) {
  const area = areaMap.get(hubId);
  if (!area) return [];
  const hubDest = {
    hotelArea:   hubId,
    name:        area.name || hubId,
    prefecture:  area.prefecture,
    city:        area.city,
  };
  return [buildRakutenHotelLink(hubDest), buildJalanHotelLink(hubDest)].filter(Boolean);
}

/** 楽天 target URL（テスト用にも export）
 * TASK5: area.rakutenPath があればエリアページ直リンク、なければキーワード検索
 */
export function buildRakutenTarget(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.rakutenPath) return `https://travel.rakuten.co.jp${area.rakutenPath}`;
  }
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

/**
 * じゃらん target URL（テスト用にも export）
 * area.jalanUrl が存在すれば使用（Shift-JIS事前エンコード済み）
 * フォールバック: UTF-8 keyword（Shift-JIS非対応環境向け暫定）
 */
export function buildJalanTarget(dest) {
  if (dest.hotelArea) {
    const area = areaMap.get(dest.hotelArea);
    if (area?.jalanUrl) return area.jalanUrl;
  }
  const keyword = encodeURIComponent(resolveKeyword(dest));
  return `https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${keyword}`;
}

function buildJalanHotelLink(dest) {
  const target = buildJalanTarget(dest);
  return {
    type:  'jalan',
    label: `${dest.name}の宿を見る（じゃらん）`,
    url:   VC_BASE + encodeURIComponent(target),
  };
}
