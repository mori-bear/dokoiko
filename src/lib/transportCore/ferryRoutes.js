/**
 * ferryRoutes.js — フェリー港別就航先マップ
 *
 * 形式: 出発港名 → 就航先都市 ID 配列
 * transport renderer の補助データとして使用する。
 *
 * 注意: destinations.json の gateways.ferry が主データソース。
 *       このマップは「ある港からどこへ行けるか」の逆引きに使う。
 */

export const FERRY_ROUTES = {
  // 関東発
  '竹芝客船ターミナル': ['izu-oshima', 'kouzushima'],
  '熱海港':             ['izu-oshima'],
  '稲取港':             ['izu-oshima'],

  // 瀬戸内海
  '高松港':             ['naoshima', 'shodoshima'],
  '宇野港':             ['naoshima'],
  '宮島口港':           ['miyajima'],

  // 南西
  '那覇港':             ['tokashiki-jima'],
  '鹿児島港':           ['amami'],

  // 九州
  '博多港':             ['goto'],
  '長崎港':             ['goto'],

  // 関西・広域
  '大阪南港':           ['新島', 'izu-oshima'],
};

/**
 * 指定した都市 ID に就航する出発港一覧を返す。
 *
 * @param {string} cityId
 * @returns {string[]} 出発港名配列
 */
export function getDeparturePortsFor(cityId) {
  return Object.entries(FERRY_ROUTES)
    .filter(([, dests]) => dests.includes(cityId))
    .map(([port]) => port);
}
