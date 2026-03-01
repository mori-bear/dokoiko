/**
 * 宿泊リンクを組み立てる（キーワード検索方式）。
 *
 * @param {object} city        - 都市オブジェクト
 * @param {string} date        - 未使用（互換性のため残す）
 * @param {string} stayType    - "daytrip" | "1night"
 * @param {string} people      - 未使用（互換性のため残す）
 */
export function buildHotelLinks(city, date, stayType, people) {
  if (stayType !== '1night') {
    return { destination: [], hub: [] };
  }

  return {
    destination: [
      buildRakutenLink(city.name),
      buildJalanLink(city.name),
    ],
    hub: [],
  };
}

export function buildRakutenLink(cityName) {
  const encoded = encodeURIComponent(cityName);

  return {
    type: 'rakuten',
    label: 'この街の宿を見てみる（楽天トラベル）',
    url: `https://travel.rakuten.co.jp/keyword_search/?f_query=${encoded}&cid=511c83ed.aa0fc172.511c83ee.51331b19`,
  };
}

export function buildJalanLink(cityName) {
  const encoded = encodeURIComponent(`${cityName} ホテル`);

  return {
    type: 'jalan',
    label: 'じゃらんで宿を探す',
    url: `https://www.jalan.net/uw/uwp1700/uww1704.do?keyword=${encoded}`,
  };
}
