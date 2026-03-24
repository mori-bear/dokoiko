/**
 * 宿泊リンクビルダー
 *
 * 楽天: travel.rakuten.co.jp/yado/{hotelArea}/ 方式（都道府県エリアページ — HTTP 200確認済み）
 *   - hotelArea は都道府県コード（prefecture レベル）を使用
 *   - /search?keyword= は404のため禁止
 * じゃらん: uww2011init.do?keyword= — 単一encodeのみ（uww2011.do は404）
 * ハブ宿: needsCar + gatewayHub がある場合はハブ都市の宿も追加
 *
 * エンコード方針: アフィリエイトベースURL（keyword= まで）を事前エンコードし、
 * キーワード部分のみを safeEncode() で1回追加する。二重エンコードを防止する。
 */

// 楽天トラベル アフィリエイト ベースURL（pc= パラメータは動的に生成）
const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=';

// 楽天 エリアページ ベースURL（都道府県コードを動的に挿入）
const RAKUTEN_YADO = 'https://travel.rakuten.co.jp/yado/';

// じゃらん アフィリエイト + keyword= まで事前エンコード済み（uww2011init.do が正しい形式）
const JALAN_BASE = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=' +
  encodeURIComponent('https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=');

/**
 * 安全なエンコード（既にエンコード済みの文字列を二重エンコードしない）
 * @param {string} str
 */
function safeEncode(str) {
  try {
    return decodeURIComponent(str) === str
      ? encodeURIComponent(str)
      : str;
  } catch {
    return encodeURIComponent(str);
  }
}

/**
 * 楽天エリアページURLを生成する（アフィリエイト付き）
 * @param {string|null} hotelArea - 都道府県コード（例: 'tokyo', 'ishikawa'）
 * @returns {string} URL
 */
function buildRakutenUrl(hotelArea) {
  // 不正なhotelAreaは総合トップにフォールバック
  if (!hotelArea || hotelArea.includes('%') || hotelArea.includes(' ') || hotelArea.includes('/')) {
    return RAKUTEN_AFF + encodeURIComponent(RAKUTEN_YADO);
  }
  const innerUrl = `${RAKUTEN_YADO}${hotelArea}/`;
  return RAKUTEN_AFF + encodeURIComponent(innerUrl);
}

/**
 * じゃらんURLを生成する（アフィリエイト付き）
 * @param {string} keyword - 宿検索キーワード（生の日本語文字列）
 * @returns {string} URL
 */
function buildJalanUrl(keyword) {
  const encoded = safeEncode(keyword.trim());
  // 二重エンコード検出
  if (encoded.includes('%25')) {
    console.warn('[hotelLinkBuilder] double encode detected:', keyword);
  }
  return JALAN_BASE + encoded;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const keyword = (dest.hotelKeyword || dest.name).trim();

  const result = {
    heading: `${dest.name || keyword}の宿を探す`,
    links: [
      { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(dest.hotelArea) },
      { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(keyword) },
    ],
  };

  // ハブ宿: 車必須 + gatewayHub が設定されている場合のみ表示（珠洲→金沢 など）
  // gatewayHub は別都市のため hotelArea が使えない → null（japan フォールバック）
  if (dest.needsCar && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hubKeyword = dest.gatewayHub.trim();
    result.hubLinks = {
      heading: `${dest.gatewayHub}の宿（拠点として）`,
      links: [
        { type: 'rakuten', label: '楽天トラベルで探す', url: buildRakutenUrl(null) },
        { type: 'jalan',   label: 'じゃらんで探す',     url: buildJalanUrl(hubKeyword) },
      ],
    };
  }

  return result;
}
