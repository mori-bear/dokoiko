/**
 * 抽選エンジン
 *
 * buildPool: star + stayType のみでフィルタし重み付きシャッフルを返す。
 * 出発地は使用しない —— 「知らない街と出会う装置」としての設計。
 *
 * フォールバック:
 *   1. distanceStars + stayType 完全一致
 *   2. stayType 一致のみ（star 範囲外のとき）
 *   3. 全件（stayType も一致なし ── 実運用では発生しない）
 *
 * weight: urban=0.3（出にくい）, hub=0.35, local=1.2（出やすい）, island=1.5
 *
 * 追加重み:
 *   - ★3,4 を優遇 / ★1,5 を抑制
 *   - 県庁所在地は軽く抑制
 */

/** ★別の重み乗数 — ★3,4 中心設計 */
const STAR_MULTIPLIER = { 1: 0.6, 2: 0.85, 3: 1.3, 4: 1.3, 5: 0.7 };

/** 県庁所在地セット — 抽選確率を軽く抑制 */
const PREF_CAPITALS = new Set([
  '札幌', '青森', '盛岡', '仙台', '秋田', '山形', '福島',
  '水戸', '宇都宮', '前橋', '東京', '横浜', '新潟',
  '富山', '金沢', '福井', '甲府', '長野', '岐阜', '静岡',
  '名古屋', '津', '大津', '京都', '大阪', '神戸', '奈良',
  '和歌山', '鳥取', '松江', '岡山', '広島', '山口',
  '徳島', '高松', '松山', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '那覇',
]);

function getSelectionWeight(city) {
  const base  = city.weight ?? 1;
  const starW = STAR_MULTIPLIER[city.distanceStars] ?? 1;
  const capW  = PREF_CAPITALS.has(city.name) ? 0.6 : 1;
  return base * starW * capW;
}

function weightedShuffle(arr) {
  const result = [];
  const pool = arr.map(item => ({ item, w: getSelectionWeight(item) }));
  while (pool.length > 0) {
    const total = pool.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    result.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return result;
}

export function buildPool(destinations, distanceStars, stayType) {
  // island は stayType=1night 以外では完全除外
  const byStay = destinations.filter(d => {
    if (d.type === 'island' && stayType !== '1night') return false;
    return d.stayAllowed.includes(stayType);
  });

  // star + stayType で完全一致
  const exact = byStay.filter(d => d.distanceStars === distanceStars);
  if (exact.length > 0) return weightedShuffle(exact);

  // フォールバック: stayType 一致のみ
  return weightedShuffle(byStay.length > 0 ? byStay : destinations);
}
