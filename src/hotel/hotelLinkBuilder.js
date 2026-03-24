/**
 * 宿泊リンクビルダー
 *
 * 楽天: /yado/?keyword= 方式（宿一覧ページ — /search?keyword= は404のため）
 * じゃらん: uww2011init.do?keyword= — 単一encodeのみ（uww2011.do は404）
 * ハブ宿: needsCar + gatewayHub がある場合はハブ都市の宿も追加
 *
 * エンコード方針: アフィリエイトベースURL（keyword= まで）を事前エンコードし、
 * キーワード部分のみを enc() で1回追加する。二重エンコードを防止する。
 */

// 楽天トラベル アフィリエイト + /yado/?keyword= まで事前エンコード済み
// 注意: /search?keyword= は404のため /yado/?keyword= を使用する
const RAKUTEN_BASE = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=' +
  encodeURIComponent('https://travel.rakuten.co.jp/yado/?keyword=');

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
 * キーワードから楽天・じゃらんのリンクペアを生成する。
 * @param {string} keyword - 宿検索キーワード（生の日本語文字列）
 * @returns {Array<{type, label, url}>}
 */
function buildLinkPair(keyword) {
  const enc = safeEncode;
  return [
    { type: 'rakuten', label: '楽天トラベルで探す', url: RAKUTEN_BASE + enc(keyword) },
    { type: 'jalan',   label: 'じゃらんで探す',     url: JALAN_BASE  + enc(keyword) },
  ];
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  // hotelKeyword: 完全なキーワードとして使用（ホテル付加不要）
  // hotelSearch: 地名のみ → " ホテル" を付加
  const keyword = dest.hotelKeyword
    ?? `${dest.hotelSearch || dest.name} ホテル`;

  const result = {
    heading: `${dest.name || keyword}の宿を探す`,
    links:   buildLinkPair(keyword),
  };

  // ハブ宿: 車必須 + gatewayHub が設定されている場合のみ表示（珠洲→金沢 など）
  if (dest.needsCar && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    result.hubLinks = {
      heading: `${dest.gatewayHub}の宿（拠点として）`,
      links:   buildLinkPair(dest.gatewayHub),
    };
  }

  return result;
}
