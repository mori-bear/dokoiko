/**
 * 抽選エンジン
 *
 * buildPool : 条件に合う全件を重み付きシャッフルして返す
 *
 * 抽選優先順:
 *   1. departure + distanceStars 完全一致 + stayAllowed
 *   2. distanceStars ±1〜2（departure + stayAllowed 維持）
 *   3. departure 一致のみ（stayAllowed 維持）
 *   4. nearestHub フォールバック（新出発地用）
 *   5. 全国フォールバック（stayAllowed 維持）
 *
 * island は stayAllowed=["1night"] のみなので daytrip では自然に除外される。
 * weight: urban=0.3（出にくい）, hub=0.35, local=1.2（出やすい）, island=1.5
 *
 * 追加重み:
 *   - ★3,4 を優遇 / ★1,5 を抑制
 *   - 県庁所在地は軽く抑制
 */

import { DEPARTURE_CITY_INFO } from '../config/constants.js';

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

/**
 * 最終的な抽選重みを算出する
 *   base  : destinations.json の weight（type 別設定済み）
 *   starW : ★3,4 を優遇、★1,5 を抑制
 *   capW  : 県庁所在地を軽く抑制
 */
function getSelectionWeight(city) {
  const base  = city.weight ?? 1;
  const starW = STAR_MULTIPLIER[city.distanceStars] ?? 1;
  const capW  = PREF_CAPITALS.has(city.name) ? 0.6 : 1;
  return base * starW * capW;
}

/**
 * 重み付きシャッフル — getSelectionWeight が大きいほど先に出現しやすい
 */
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

export function buildPool(destinations, departure, distanceStars, stayType) {
  // island は stayType=1night 以外では完全除外（stayAllowed より先に評価）
  const byStay = destinations.filter(d => {
    if (d.type === 'island' && stayType !== '1night') return false;
    return d.stayAllowed.includes(stayType);
  });

  // departure フィルタ（nearestHub フォールバック込み）
  let byDeparture = byStay.filter(d => d.departures.includes(departure));
  if (byDeparture.length === 0) {
    const hub = DEPARTURE_CITY_INFO[departure]?.nearestHub;
    if (hub) byDeparture = byStay.filter(d => d.departures.includes(hub));
  }

  // 1. 完全一致
  const exact = byDeparture.filter(d => d.distanceStars === distanceStars);
  if (exact.length > 0) return weightedShuffle(exact);

  // 2. ±1〜2（stayAllowed + departure 維持）
  const seen     = new Set();
  const expanded = [];
  for (const delta of [1, -1, 2, -2]) {
    const s = distanceStars + delta;
    if (s < 1 || s > 5) continue;
    for (const d of byDeparture) {
      if (d.distanceStars === s && !seen.has(d.id)) {
        seen.add(d.id);
        expanded.push(d);
      }
    }
  }
  if (expanded.length > 0) return weightedShuffle(expanded);

  // 3. departure 一致のみ（stayAllowed 維持）
  if (byDeparture.length > 0) return weightedShuffle(byDeparture);

  // 4. 全国フォールバック（stayAllowed 維持）
  return weightedShuffle(byStay.length > 0 ? byStay : destinations);
}

/** 後方互換: pool の先頭 1 件を返す */
export function selectDestination(destinations, departure, distanceStars, stayType) {
  return buildPool(destinations, departure, distanceStars, stayType)[0];
}
