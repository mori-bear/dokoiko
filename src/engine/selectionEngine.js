/**
 * 抽選エンジン
 *
 * buildPool: star + stayType + departure でフィルタし重み付きシャッフルを返す。
 *
 * フォールバック:
 *   1. distanceStars 完全一致
 *   2. distanceStars ±1
 *   3. 出発地一致のみ（star 無視）
 *   4. 全件（stayType のみ） — 最終手段
 *
 * weight: hub=0.3〜0.35（出にくい）, local=1.2（出やすい）, island=1.5, spot=0.15（低確率）
 *
 * 追加重み:
 *   - ★3,4 を優遇 / ★1,5 を抑制
 *   - 県庁所在地は軽く抑制
 */

import { calculateDistanceStars } from './distanceCalculator.js';

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
 * 出発地の別名マッピング
 * 出発地名と表記が異なる目的地名を同一都市として扱う
 */
const DEPARTURE_ALIASES = {
  '福岡': ['博多'],
};

/**
 * 出発地の都道府県
 * 日帰り以外で同一都道府県の目的地を除外するために使用
 */
const DEPARTURE_PREFECTURE = {
  '札幌': '北海道', '函館': '北海道', '旭川': '北海道',
  '仙台': '宮城',   '盛岡': '岩手',
  '東京': '東京',   '横浜': '神奈川', '千葉': '千葉', '大宮': '埼玉', '宇都宮': '栃木',
  '長野': '長野',   '静岡': '静岡',   '名古屋': '愛知', '金沢': '石川', '富山': '富山',
  '大阪': '大阪',   '京都': '京都',   '神戸': '兵庫', '奈良': '奈良',
  '広島': '広島',   '岡山': '岡山',   '松江': '島根',
  '高松': '香川',   '松山': '愛媛',   '高知': '高知', '徳島': '徳島',
  '福岡': '福岡',   '熊本': '熊本',   '鹿児島': '鹿児島', '長崎': '長崎', '宮崎': '宮崎',
};

/**
 * 同一都道府県除外対象の目的地マップ（id → 都道府県）
 */
const DESTINATION_PREFECTURE_MAP = {
  'matsushima': '宮城',  // 仙台と同一県
  'onomichi':   '広島',  // 広島と同一県
  'otaru':      '北海道', // 札幌と同一道
};

function isSameCity(destination, departure) {
  if (destination.name === departure) return true;
  const aliases = DEPARTURE_ALIASES[departure] ?? [];
  return aliases.includes(destination.name);
}

function isSamePrefectureOvernight(destination, departure, stayType) {
  if (stayType === 'daytrip') return false;
  if (destination.isIsland) return false;
  const destPref = DESTINATION_PREFECTURE_MAP[destination.id];
  if (!destPref) return false;
  return destPref === DEPARTURE_PREFECTURE[departure];
}

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

/** 同一名称の都市を1件に絞る（重み付きシャッフル後の順序維持） */
function deduplicateByName(arr) {
  const seen = new Set();
  return arr.filter(city => {
    if (seen.has(city.name)) return false;
    seen.add(city.name);
    return true;
  });
}

/**
 * buildPool — 出発地・距離・日程でフィルタし重み付きシャッフルを返す。
 *
 * distanceStars を動的計算して各エントリに付与してから選択する。
 *
 * @param {Array}       destinations - 全目的地配列
 * @param {number}      distanceStars - ユーザー選択の★数
 * @param {string}      stayType      - 'daytrip' | '1night' | '2night'
 * @param {string}      departure     - 出発都市名
 * @param {string|null} nearestHub    - 出発都市のnearestHub（フォールバック用）
 *
 * フォールバック順序:
 *   1. departures + distanceStars 完全一致
 *   2. departures + distanceStars ±1
 *   3. departures 一致のみ（star 無視）
 *   4. 全件（stayType のみ） — 最終手段
 */
export function buildPool(destinations, distanceStars, stayType, departure = '', nearestHub = null) {
  // 2泊3日は1泊2日と同じ目的地セットを使用
  const normalizedStay = stayType === '2night' ? '1night' : stayType;

  /** departures フィールドで出発地マッチを判定 */
  function matchesDeparture(d) {
    if (!d.departures || d.departures.length === 0) return true;
    if (d.departures.includes(departure)) return true;
    if (nearestHub && d.departures.includes(nearestHub)) return true;
    return false;
  }

  // 各エントリに動的 distanceStars を付与
  const withStars = destinations.map(d => ({
    ...d,
    distanceStars: calculateDistanceStars(departure, d),
  }));

  // 出発地・stayType・同一都市・同一都道府県でフィルタ
  const departurePool = withStars.filter(d => {
    if (d.isIsland === true && normalizedStay !== '1night') return false;
    if (!d.stayAllowed || !d.stayAllowed.includes(normalizedStay)) return false;
    if (departure && isSameCity(d, departure)) return false;
    if (departure && isSamePrefectureOvernight(d, departure, normalizedStay)) return false;
    if (!matchesDeparture(d)) return false;
    return true;
  });

  // 1. star 完全一致
  const exact = departurePool.filter(d => d.distanceStars === distanceStars);
  if (exact.length > 0) return deduplicateByName(weightedShuffle(exact));

  // 2. star ±1 フォールバック
  const nearStar = departurePool.filter(d => Math.abs(d.distanceStars - distanceStars) <= 1);
  if (nearStar.length > 0) return deduplicateByName(weightedShuffle(nearStar));

  // 3. 出発地一致のみ（star 無視）
  if (departurePool.length > 0) return deduplicateByName(weightedShuffle(departurePool));

  // 4. 最終フォールバック: stayType のみ（出発地制約なし）
  const globalPool = withStars.filter(d => {
    if (d.isIsland === true && normalizedStay !== '1night') return false;
    if (!d.stayAllowed || !d.stayAllowed.includes(normalizedStay)) return false;
    return true;
  });
  return deduplicateByName(weightedShuffle(globalPool));
}
