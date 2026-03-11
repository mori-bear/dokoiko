/**
 * 抽選エンジン
 *
 * buildPool: stayType + theme + departure でフィルタし重み付きシャッフルを返す。
 *
 * フォールバック:
 *   1. departure + stayType 完全一致
 *   2. 全件（stayType のみ） — 最終手段
 *
 * weight: hub=0.3〜0.35（出にくい）, destination=1.2（出やすい）, island=1.5
 *
 * theme 選択時:
 *   - タグ一致（エイリアス含む）: weight × 3.0 で優先
 *   - タグ不一致: weight × 0.4 で抑制（ランダム性は残す）
 */

import { calculateDistanceStars } from './distanceCalculator.js';

/** テーマ → 一致させるタグ群（エイリアス） */
const THEME_TAG_ALIASES = {
  '温泉':   ['温泉', '秘湯'],
  '絶景':   ['絶景', '自然', '渓谷', '富士山', '高原', '湖', '火山', 'アルプス'],
  '海':     ['海', '海の幸', '離島', 'ダイビング', '港町', 'リゾート'],
  '街歩き': ['街歩き', '歴史', '城下町', '宿場町', '古都'],
  'グルメ': ['グルメ', '海の幸', '食文化'],
};

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
 */
const DEPARTURE_ALIASES = {
  '福岡': ['博多'],
};

/**
 * 出発地の都道府県
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
 * 同一都道府県除外対象（id → 都道府県）
 */
const DESTINATION_PREFECTURE_MAP = {
  'matsushima': '宮城',
  'onomichi':   '広島',
  'otaru':      '北海道',
};

function isSameCity(destination, departure) {
  if (destination.name === departure) return true;
  const aliases = DEPARTURE_ALIASES[departure] ?? [];
  return aliases.includes(destination.name);
}

function isSamePrefectureOvernight(destination, departure, stayType) {
  if (stayType === 'daytrip') return false;
  if (destination.isIsland || destination.destType === 'island') return false;
  const destPref = DESTINATION_PREFECTURE_MAP[destination.id];
  if (!destPref) return false;
  return destPref === DEPARTURE_PREFECTURE[departure];
}

/** テーマがタグに一致するか（エイリアス含む） */
function matchesTheme(city, theme) {
  if (!theme) return true;
  // 離島は常に「海」テーマに一致
  if (theme === '海' && (city.isIsland || city.destType === 'island')) return true;
  const aliases = THEME_TAG_ALIASES[theme] ?? [theme];
  return (city.tags || []).some(t => aliases.includes(t));
}

function getWeight(city, theme) {
  const base = city.weight ?? 1;
  const capW = PREF_CAPITALS.has(city.name) ? 0.6 : 1;

  let themeW = 1;
  if (theme) {
    themeW = matchesTheme(city, theme) ? 3.0 : 0.3;
  }

  return base * capW * themeW;
}

function weightedShuffle(arr, theme) {
  const result = [];
  const pool = arr.map(item => ({ item, w: getWeight(item, theme) }));
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

/**
 * buildShuffledPool — 出発地・日程・テーマでフィルタし重み付きシャッフル済み配列を返す。
 *
 * distanceStars は交通表示用に動的計算して各エントリに付与する（UI非表示）。
 *
 * @param {Array}       destinations - 全目的地配列
 * @param {string}      stayType     - 'daytrip' | '1night' | '2night'
 * @param {string|null} theme        - '温泉'|'絶景'|'海'|'街歩き'|'グルメ'|null
 * @param {string}      departure    - 出発都市名
 * @param {string|null} nearestHub   - フォールバック出発地
 * @returns {Array} 重み付きシャッフル済み目的地配列
 */
export function buildShuffledPool(destinations, stayType, theme, departure = '', nearestHub = null) {
  function matchesDeparture(d) {
    if (!d.departures || d.departures.length === 0) return true;
    if (d.departures.includes(departure)) return true;
    if (nearestHub && d.departures.includes(nearestHub)) return true;
    return false;
  }

  const withStars = destinations
    .filter(d => d.type !== 'spot')
    .map(d => ({
      ...d,
      distanceStars: calculateDistanceStars(departure, d),
    }));

  /**
   * distanceStars (★1〜★3) ベースの日程フィルタ
   *   ★1 → daytrip のみ
   *   ★2 → 1night
   *   ★3 → 1night または 2night
   */
  function matchesStayType(d) {
    const stars = d.distanceStars;
    if (stayType === 'daytrip' && stars !== 1) return false;
    if (stayType === '1night' && stars === 1) return false;
    if (stayType === '2night' && stars !== 3) return false;
    return true;
  }

  const departurePool = withStars.filter(d => {
    if (!matchesStayType(d)) return false;
    if (departure && isSameCity(d, departure)) return false;
    if (departure && isSamePrefectureOvernight(d, departure, stayType)) return false;
    if (!matchesDeparture(d)) return false;
    return true;
  });

  if (departurePool.length > 0) {
    return weightedShuffle(departurePool, theme);
  }

  // 最終フォールバック: 距離のみ（出発地制約なし）
  const globalPool = withStars.filter(matchesStayType);
  return weightedShuffle(globalPool, theme);
}

/** 後方互換ラッパー（1件のみ返す） */
export function buildPool(destinations, stayType, theme, departure = '', nearestHub = null) {
  return buildShuffledPool(destinations, stayType, theme, departure, nearestHub)[0] ?? null;
}
