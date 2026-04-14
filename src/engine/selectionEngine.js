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

import { calculateTravelTimeMinutes, calculateDistanceStars, haversineKm } from './distanceCalculator.js';

/**
 * テーマ判定（v2）
 * 温泉: onsenLevel >= 2 のみ（ハードフィルタ）
 * 他テーマ: primary または secondary に含まれるか（alias含む）
 *
 * 後方互換: primary 未設定の場合は tags にフォールバック
 */
/** onsenLevel >= 2 のみ温泉目的地として扱う */
function isValidOnsen(dest) {
  return (dest.onsenLevel ?? 0) >= 2;
}

function matchTheme(dest, theme) {
  if (!theme) return true;

  if (theme === '温泉') {
    return isValidOnsen(dest);
  }

  // 離島は常に「海」テーマに一致
  if (theme === '海' && (dest.isIsland || dest.destType === 'island')) return true;

  const aliases = THEME_TAG_ALIASES[theme] ?? [theme];

  // primary / secondary フィールド優先、なければ tags にフォールバック
  const primaryTags   = dest.primary   ?? [];
  const secondaryTags = dest.secondary ?? [];
  const legacyTags    = (primaryTags.length === 0 && secondaryTags.length === 0)
    ? (dest.tags ?? [])
    : [];

  return [...primaryTags, ...secondaryTags, ...legacyTags]
    .some(t => aliases.includes(t));
}

/** テーマ → 一致させるタグ群（エイリアス） */
const THEME_TAG_ALIASES = {
  '絶景':   ['絶景', '自然', '山', '渓谷', '富士山', '高原', '湖', '火山', 'アルプス', '秘境', '滝', '高山'],
  '海':     ['海', '海の幸', '離島', 'ダイビング', '港町', 'リゾート'],
  '街歩き': ['街歩き', '歴史', '城下町', '宿場町', '古都', '寺社', '城', '文化', '武家屋敷', '世界遺産'],
  'グルメ': ['グルメ', '海の幸', '食文化', '食'],
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
  // 出発地の別名（博多=福岡 など）
  const departureAliases = DEPARTURE_ALIASES[departure] ?? [];
  if (departureAliases.includes(destination.name)) return true;
  // 目的地の別名（"横浜市" で横浜が除外される など）
  const destAliases = destination.aliases ?? [];
  if (destAliases.includes(departure)) return true;
  return false;
}

function isSamePrefectureOvernight(destination, departure, stayType) {
  if (stayType === 'daytrip') return false;
  // free / 2night / 3night+ はすべて宿泊前提として扱う
  if (destination.isIsland || destination.destType === 'island') return false;
  const destPref = DESTINATION_PREFECTURE_MAP[destination.id];
  if (!destPref) return false;
  return destPref === DEPARTURE_PREFECTURE[departure];
}

/** @deprecated matchTheme を使用 */
function matchesTheme(city, theme) {
  return matchTheme(city, theme);
}

/** destType別の収益寄与度ブースト */
const DEST_TYPE_BOOST = {
  onsen:     1.5,  // 温泉：宿CV率高
  island:    1.3,  // 島：宿泊ほぼ必須
  mountain:  1.2,  // 山岳：泊まり前提
  remote:    1.2,  // 秘境：泊まり前提
  city:      1.0,  // 都市：標準
  sight:     0.9,  // 観光地：宿導線やや弱
  peninsula: 1.0,
  // ── ニッチ拡張 ──
  hidden:    1.1,  // 隠れ名所：発見感が強く宿泊前提
  view:      1.0,  // 絶景：日帰りも多いが泊まれば更に良い
  weird:     0.9,  // 珍スポット：話題性高・宿導線弱め
  ruins:     0.9,  // 遺構：マニア向け・宿薄い
  portTown:  1.1,  // 港町：海の幸＋宿がセット
  railway:   0.9,  // ローカル線：乗車体験中心・宿薄い
};

/**
 * travelTimeScore: 出発地からの移動時間による重み係数（T4: テーマ別減衰）
 *
 * 減衰定数（decay）をテーマで変える:
 *   温泉   → 220（遠め許容: 温泉は遠くても行く価値あり）
 *   絶景   → 250（さらに遠め許容: 絶景は距離を厭わない）
 *   海     → 200（やや遠め許容）
 *   街歩き → 130（近場優先: 気軽に行ける街歩きがフィット）
 *   グルメ → 150（やや近場優先）
 *   default → 180
 */
const THEME_DECAY = {
  '温泉':   220,
  '絶景':   250,
  '海':     200,
  '街歩き': 130,
  'グルメ': 150,
};

function travelTimeScore(minutes, theme = null) {
  if (minutes == null) return 1;
  const decay = THEME_DECAY[theme] ?? 180;
  return Math.exp(-minutes / decay);
}

function getWeight(city, theme) {
  const base = city.weight ?? 1;
  const capW = PREF_CAPITALS.has(city.name) ? 0.6 : 1;
  const dtW  = DEST_TYPE_BOOST[city.destType] ?? 1;
  const ttW  = travelTimeScore(city.travelTimeMinutes, theme);

  // 近郊cityペナルティ: 45分未満かつweight<1.1のcityは旅行先として弱い
  // (横浜・鎌倉などPOPULAR扱いでweightが高い目的地は除外)
  const nearCityW = (city.destType === 'city' && (city.travelTimeMinutes ?? 999) < 45 && base < 1.1)
    ? 0.5 : 1;

  let themeW = 1;
  if (theme) {
    themeW = matchTheme(city, theme) ? 3.0 : 0.3;
  }

  return base * capW * dtW * ttW * nearCityW * themeW;
}

/**
 * weightedShuffle: 重み付きシャッフル（多様性制御あり）
 *
 * 多様性ペナルティ（2段階）:
 *   1. 連続ペナルティ: 直前と同一 destType → weight × 0.75
 *   2. 飽和ペナルティ: 同一 destType が3件超えた場合 → weight × 0.7
 *   両条件が重なる場合は乗算 (× 0.75 × 0.7 = × 0.525)
 *
 * 札幌発特別制御:
 *   北海道 onsen は2件以上で ×0.10 — 大量の道内温泉が占有するのを防止
 */
function weightedShuffle(arr, theme, departure = '') {
  const result = [];
  const pool = arr.map(item => ({ item, w: getWeight(item, theme) }));
  let lastType = null;
  const typeCounts = {};  // destType ごとの選出済み件数

  function adjustedW(e) {
    const type = e.item.destType;
    let w = e.w;
    if (lastType != null && type === lastType)   w *= 0.75;  // 連続ペナルティ
    if ((typeCounts[type] ?? 0) >= 3)            w *= 0.70;  // 飽和ペナルティ（全type共通）
    // onsen専用飽和制御（温泉偏重を強力に抑制）
    if (type === 'onsen') {
      if ((typeCounts['onsen'] ?? 0) >= 2)  w *= 0.60;  // 3件目以降 ×0.60
      if ((typeCounts['onsen'] ?? 0) >= 4)  w *= 0.40;  // 5件目以降 さらに ×0.40
      // 札幌発: 北海道onsenは2件まで（道内温泉が独占するのを防止）
      if (departure === '札幌' && e.item.region === '北海道') {
        if ((typeCounts['onsen_hokkaido'] ?? 0) >= 2) w *= 0.10;
      }
    }
    return w;
  }

  while (pool.length > 0) {
    const total = pool.reduce((s, e) => s + adjustedW(e), 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    let cumW = 0;
    for (let i = 0; i < pool.length; i++) {
      cumW += adjustedW(pool[i]);
      if (r <= cumW) { idx = i; break; }
    }
    const selected = pool[idx].item;
    lastType = selected.destType;
    typeCounts[lastType] = (typeCounts[lastType] ?? 0) + 1;
    // 札幌発: 北海道onsen カウンター
    if (departure === '札幌' && selected.destType === 'onsen' && selected.region === '北海道') {
      typeCounts['onsen_hokkaido'] = (typeCounts['onsen_hokkaido'] ?? 0) + 1;
    }
    result.push(selected);
    pool.splice(idx, 1);
  }
  return result;
}

/**
 * buildShuffledPool — 出発地・日程・テーマ・シチュエーションでフィルタし重み付きシャッフル済み配列を返す。
 *
 * distanceStars は交通表示用に動的計算して各エントリに付与する（UI非表示）。
 *
 * @param {Array}         destinations - 全目的地配列
 * @param {string}        stayType     - 'daytrip' | '1night' | '2night'
 * @param {string|null}   theme        - '温泉'|'絶景'|'海'|'街歩き'|'グルメ'|null
 * @param {string}        departure    - 出発都市名
 * @param {string|null}   nearestHub   - フォールバック出発地
 * @param {boolean}       excludeCar   - trueのときrequiresCar=trueの目的地を除外
 * @param {string|null}   situation    - 'solo'|'couple'|'friends'|null（null=全対象）
 * @returns {Array} 重み付きシャッフル済み目的地配列
 */
export function buildShuffledPool(destinations, stayType, theme, departure = '', nearestHub = null, excludeCar = false, situation = null) {
  function matchesDeparture(d) {
    if (!d.departures || d.departures.length === 0) return true;
    if (d.departures.includes(departure)) return true;
    if (nearestHub && d.departures.includes(nearestHub)) return true;
    return false;
  }

  /** situations フィルタ: situations 未設定は全対象として扱う */
  function matchesSituation(d) {
    if (!situation) return true;
    if (!d.situations?.length) return true; // 未設定は全スタイル対応
    return d.situations.includes(situation);
  }

  // 札幌座標（北海道補正で使用）
  const SAPPORO = [43.0642, 141.3469];

  const withStars = destinations
    .filter(d => d.type !== 'spot')
    .map(d => {
      let travelTimeMinutes = calculateTravelTimeMinutes(departure, d);
      // 北海道補正: hubCity='札幌'の目的地が一律60minになる問題を座標距離で補正
      // haversine距離(km) / 60km/h ≈ 分換算で実距離ベースの時間を算出
      if (departure === '札幌' && travelTimeMinutes <= 60 && d.lat && d.lng) {
        const distKm = haversineKm(SAPPORO[0], SAPPORO[1], d.lat, d.lng);
        travelTimeMinutes = Math.max(30, Math.min(Math.round(distKm), 360));
      }
      return {
        ...d,
        travelTimeMinutes,
        distanceStars: calculateDistanceStars(departure, d),
      };
    });

  /**
   * travelTimeMinutes ベースの日程フィルタ（片道時間制限）
   *   daytrip : 片道 120分以内（2時間）
   *   1night  : 片道 240分以内（4時間）
   *   free / 2泊以上 : 制限なし
   *   2night / 3night+ : 後方互換として制限なし扱い
   */
  function matchesStayType(d) {
    const oneWay = d.travelTimeMinutes;
    if (stayType === 'daytrip' && oneWay > 120) return false;
    if (stayType === '1night'  && oneWay > 240) return false;
    // 'free' / '2night' / '3night+' : 制限なし
    return true;
  }

  const departurePool = withStars.filter(d => {
    // 宿泊不可フラグ（isStayable=false）は宿泊プランから除外
    if (stayType !== 'daytrip' && d.isStayable === false) return false;
    if (!matchesStayType(d)) return false;
    if (departure && isSameCity(d, departure)) return false;
    if (departure && isSamePrefectureOvernight(d, departure, stayType)) return false;
    if (!matchesDeparture(d)) return false;
    if (excludeCar && d.requiresCar) return false;
    if (!matchesSituation(d)) return false;
    // 空港・ターミナル系は旅行目的地として不適（T1/T5）
    const dname = d.displayName || d.name || '';
    if (/空港|ターミナル/.test(dname)) return false;
    return true;
  });

  if (departurePool.length > 0) {
    // ハードフィルタ: テーマ選択時は完全一致の候補を優先、0件の場合のみ全件にフォールバック
    const themed = theme ? departurePool.filter(d => matchesTheme(d, theme)) : departurePool;
    return weightedShuffle(themed.length > 0 ? themed : departurePool, theme, departure);
  }

  // 最終フォールバック: 距離のみ（出発地制約なし）
  const globalPool = withStars.filter(d => {
    if (stayType !== 'daytrip' && d.isStayable === false) return false;
    if (!matchesStayType(d)) return false;
    if (excludeCar && d.requiresCar) return false;
    if (!matchesSituation(d)) return false;
    return true;
  });
  const themedGlobal = theme ? globalPool.filter(d => matchesTheme(d, theme)) : globalPool;
  return weightedShuffle(themedGlobal.length > 0 ? themedGlobal : globalPool, theme, departure);
}

/** 後方互換ラッパー（1件のみ返す） */
export function buildPool(destinations, stayType, theme, departure = '', nearestHub = null, excludeCar = false, situation = null) {
  return buildShuffledPool(destinations, stayType, theme, departure, nearestHub, excludeCar, situation)[0] ?? null;
}
