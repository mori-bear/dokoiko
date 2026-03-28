/**
 * 宿泊リンクビルダー
 *
 * dest.hotelKeyword をそのまま検索キーワードとして使用する。
 * hotelKeyword は destinations.json で全件手動指定済み。
 *
 * 楽天: travel.rakuten.co.jp/search/?keyword={encodeURIComponent(keyword)}
 * じゃらん: jalan.net/search/?keyword={encodeURIComponent(keyword)}
 *
 * エンコードルール:
 *   encodeURIComponent 1回のみ
 *   二重エンコード禁止
 */

/**
 * 楽天トラベル 検索URL
 */
function buildRakutenUrl(keyword) {
  return `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`;
}

/**
 * じゃらん 検索URL
 */
function buildJalanUrl(keyword) {
  return `https://www.jalan.net/search/?keyword=${encodeURIComponent(keyword)}`;
}

/**
 * @param {object} dest — destination エントリ
 * @returns {{ heading: string, links: Array, hubLinks?: {heading, links} }}
 */
export function buildHotelLinks(dest) {
  const keyword = dest.hotelKeyword ?? dest.name;
  const uiName  = dest.displayName || dest.name;

  const result = {
    heading: `${uiName}で泊まる`,
    links: [
      { type: 'rakuten', label: `${uiName}の宿を探す（楽天）`, url: buildRakutenUrl(keyword) },
      { type: 'jalan',   label: `${uiName}の宿を見る（じゃらん）`, url: buildJalanUrl(keyword) },
    ],
  };

  // ハブ宿: 車必須 or remote/mountain + gatewayHub が設定されている場合
  const needsHub = dest.needsCar || dest.destType === 'remote' || dest.destType === 'mountain';
  if (needsHub && dest.gatewayHub && dest.gatewayHub !== dest.name) {
    const hubKeyword = dest.gatewayHub;
    result.hubLinks = {
      heading: `${dest.gatewayHub}で泊まる（拠点）`,
      links: [
        { type: 'rakuten', label: `${dest.gatewayHub}の宿を探す（楽天）`, url: buildRakutenUrl(hubKeyword) },
        { type: 'jalan',   label: `${dest.gatewayHub}の宿を見る（じゃらん）`, url: buildJalanUrl(hubKeyword) },
      ],
    };
  }

  return result;
}
