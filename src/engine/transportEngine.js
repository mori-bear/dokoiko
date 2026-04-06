/**
 * transportEngine.js — 交通ロジック「唯一の真実」
 *
 * 設計原則:
 *   1. このファイルの出力のみが正しい交通情報
 *   2. render / steps / gateway は一切ロジックを持たない
 *   3. CTA は engine 内で1回だけ確定する（inject/上書き禁止）
 *   4. 非現実ルートはルールベースで完全排除
 *
 * ── ルールベース＋スコアリング設計 ──────────────────────────────
 *
 * Phase 1: ルールベース除外（validateRoute）
 *   - island → rail 禁止
 *   - 沖縄  → rail/ferry 禁止
 *   - 150km未満 → flight 禁止
 *   - 1000km超  → rail 禁止
 *   - ferry港なし＋非離島 → ferry 禁止
 *   - 空港情報なし → flight 禁止
 *
 * Phase 2: スコアリング（scoreCandidate）
 *   base:  flight=20, ferry=15, rail=10
 *   距離適正: rail ≤200km +30, flight ≥500km +20
 *   インフラ: 直行便+15, 離島ferry+20, ferryGateway+10
 *   CTA:     CTA生成不可 -50
 *   destType: bus+5, peninsula+10
 *
 * Phase 3: 最高スコア候補を選択 → CTA確定 → 出力
 *
 * 処理フロー（buildTransportContext）:
 *   ① distanceKm 計算
 *   ② buildCandidates — 全候補生成・ルール除外・スコアリング・最適選択
 *   ③ accessType 算出
 *   ④ regionGraph BFS — 地方経路
 *   ⑤ resolveTransportLinks — step-group 生成
 *   ⑥ buildCanonicalStepGroups — CTA 一本化
 *   ⑦ buildRouteMapUrl — Google Maps URL
 *   ⑧ buildRouteReason — 納得感テキスト
 */

import { DEPARTURE_COORDS }                       from '../config/constants.js';
import { calcDistanceKm }                          from '../utils/geo.js';
import { resolveTransportLinks }                   from '../transport/resolveTransportLinks.js';
import { resolveCtaByType }                        from './ctaResolver.js';
import { buildRouteMapUrl }                        from '../utils/map/buildRouteMapUrl.js';
import {
  findRegionPath,
  getRegionTransportHint,
  DEPARTURE_REGION_MAP,
} from './regionGraph.js';

/* ── 判定閾値 ── */
const FLIGHT_DISTANCE_KM    = 500;
const FLIGHT_MIN_DISTANCE   = 150;
const RAIL_MAX_DISTANCE     = 1000;
const FLIGHT_ONLY_REGION    = '沖縄';

/* ══════════════════════════════════════════════════════
   ① ルールベース除外（ハードフィルター）
══════════════════════════════════════════════════════ */

/**
 * ルートが物理的に可能かを判定（false = 完全除外）。
 *
 * @param {'flight'|'ferry'|'rail'} type
 * @param {object} city
 * @param {number} distKm
 * @returns {boolean}
 */
export function validateRoute(type, city, distKm = 0) {
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  switch (type) {
    case 'rail':
      if (city?.region === FLIGHT_ONLY_REGION) return false;  // 沖縄: 物理的に不可
      if (isIsland)                            return false;  // 離島: 鉄道なし
      // 距離はスコアで制御（長距離でも候補に残し、他に選択肢がない場合のフォールバック）
      return true;

    case 'flight':
      if (city?.region === FLIGHT_ONLY_REGION) return true;
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      if (distKm > 0 && distKm < FLIGHT_MIN_DISTANCE) return false;
      // 離島: 500km以内はferry優先（flightは除外）
      if (isIsland && distKm > 0 && distKm <= 500) return false;
      // 一般: 500km未満はrail圏内（flightは除外）
      if (!isIsland && distKm > 0 && distKm < FLIGHT_DISTANCE_KM) return false;
      return true;

    case 'ferry':
      if (city?.isIsland !== true && !city?.ferryGateway) return false;
      return true;

    default:
      return true;
  }
}

/* ══════════════════════════════════════════════════════
   ② スコアリング（候補比較用）
══════════════════════════════════════════════════════ */

/**
 * 候補のスコアを算出する。高い方が最適。
 *
 * @param {'flight'|'ferry'|'rail'} type
 * @param {number} distKm
 * @param {object} city
 * @param {boolean} hasCta — CTA生成可能か
 * @returns {number}
 */
function scoreCandidate(type, distKm, city, hasCta) {
  let score = 0;
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  /* ── ベーススコア ── */
  switch (type) {
    case 'flight': score = 20; break;
    case 'ferry':  score = 15; break;
    case 'rail':   score = 10; break;
  }

  /* ── 距離適正 ── */
  if (type === 'rail') {
    if      (distKm <= 200) score += 30;   // 鉄道最適距離
    else if (distKm <= 400) score += 15;   // 新幹線圏内
    else if (distKm <= 600) score += 0;    // 長め
    else if (distKm <= 800) score -= 20;   // かなり長い
    else                    score -= 50;   // 非推奨距離
  }

  if (type === 'flight') {
    if      (distKm >= 700)  score += 25;  // 飛行機最適距離
    else if (distKm >= 500)  score += 20;  // 飛行機推奨
    else if (distKm >= 300)  score += 0;   // 微妙
    else                     score -= 30;  // 近距離フライト
  }

  if (type === 'ferry') {
    if (isIsland)            score += 20;  // 離島フェリーは自然
    if (city?.ferryGateway)  score += 10;  // フェリー港あり
  }

  /* ── インフラボーナス ── */
  if (type === 'flight' && city?.hasDirectFlight === true) score += 15;

  /* ── regionGraph ヒント ── */
  // 地方間で陸路不通の場合、flight/ferryにボーナス
  // （validateRouteを通過した候補のみここに来るので安全）

  /* ── CTA ペナルティ ── */
  if (!hasCta) score -= 50;

  /* ── destType ボーナス ── */
  if (city?.secondaryTransport === 'bus') score += 5;
  if (city?.destType === 'peninsula')     score += 10;

  return score;
}

/**
 * 後方互換: 旧 scoreTransport API（QA等で使用）。
 * 新設計では buildCandidates 内で scoreCandidate を使用。
 */
export function scoreTransport(transportType, distanceKm, city = null) {
  const hasCta = true; // 旧API互換: CTA有無は考慮しない
  return Math.max(0, Math.min(100, scoreCandidate(transportType, distanceKm, city, hasCta)));
}

/* ══════════════════════════════════════════════════════
   ③ 候補生成・最適選択
══════════════════════════════════════════════════════ */

/** @typedef {{ type: string, score: number, cta: object|null }} Candidate */

/**
 * 全交通手段を評価し、スコア順にソートした候補リストを返す。
 * ルール違反の候補は含まれない。
 *
 * @param {string} departure
 * @param {object} city
 * @param {number} distKm
 * @returns {Candidate[]}
 */
function buildCandidates(departure, city, distKm) {
  const TYPES = ['flight', 'ferry', 'rail'];
  const candidates = [];

  for (const type of TYPES) {
    // Phase 1: ルールベース除外
    if (!validateRoute(type, city, distKm)) continue;

    // CTA 生成試行
    const cta = resolveCtaByType(type, departure, city);

    // Phase 2: スコアリング
    const score = scoreCandidate(type, distKm, city, !!cta);

    candidates.push({ type, score, cta });
  }

  // スコア降順ソート
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * 後方互換: 旧 determineTransportType API。
 * 新設計では buildCandidates の最高スコア候補を返す。
 */
export function determineTransportType(departure, city, distKm = 0) {
  const candidates = buildCandidates(departure, city, distKm);
  return candidates.length > 0 ? candidates[0].type : 'rail';
}

/* ══════════════════════════════════════════════════════
   ④ accessType（ラストマイル交通手段）
══════════════════════════════════════════════════════ */

/**
 * @param {object} city
 * @param {'flight'|'ferry'|'rail'} transportType
 * @returns {'rail'|'flight'|'ferry'|'bus'|'car'}
 */
export function resolveAccessType(city, transportType) {
  const dt = city?.destType;
  if (dt === 'peninsula' || dt === 'remote') {
    if (city.secondaryTransport === 'bus')  return 'bus';
    if (city.secondaryTransport === 'car')  return 'car';
    if (city.requiresCar === true)           return 'car';
    return 'bus';
  }
  return transportType;
}

/* ══════════════════════════════════════════════════════
   ⑤ 納得感テキスト
══════════════════════════════════════════════════════ */

/**
 * ルート理由文。「なぜこの手段か」を具体的に伝える。
 * 比較要素（最短・直通・乗り換え少）を含める。
 */
export function buildRouteReason(transportType, distanceKm, city = null, isFallback = false, mapOnlyFallback = false) {
  if (mapOnlyFallback) return '地図でルートを確認';

  const accessType = resolveAccessType(city, transportType);
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  // 複合ルート（幹線 + ラストマイル）
  if (accessType === 'bus' || accessType === 'car') {
    const lastMile = accessType === 'bus' ? 'バス' : '車';
    if (transportType === 'flight') return `最寄空港まで飛んで${lastMile}に乗り換え`;
    if (transportType === 'ferry')  return `フェリーで渡って${lastMile}に乗り換え`;
    if (distanceKm <= 200) return `電車で近くまで行って${lastMile}に乗り換え`;
    return `新幹線で近くまで行って${lastMile}に乗り換え`;
  }

  switch (transportType) {
    case 'flight':
      if (city?.hasDirectFlight) return '直行便あり、最短で着ける';
      return '飛行機が最短ルート';

    case 'ferry':
      if (isIsland) return '船で直接渡れる';
      return 'フェリーで直接行ける';

    case 'rail':
      if (distanceKm <= 100) return '乗り換え少なく一直線で行ける';
      if (distanceKm <= 300) return '新幹線で乗り換えなしで行ける';
      if (distanceKm <= 600) return '新幹線1本で行ける距離';
      return '新幹線で行ける最遠エリア';

    default:
      return '';
  }
}

/* ══════════════════════════════════════════════════════
   ⑥ CTA一本化
══════════════════════════════════════════════════════ */

function buildCanonicalStepGroups(rawStepGroups, canonicalCta, transportType) {
  if (canonicalCta) {
    const stripped   = rawStepGroups.filter(item => item.type !== 'main-cta');
    const result     = [...stripped];
    const summaryIdx = result.findIndex(i => i.type === 'summary');
    const insertAt   = summaryIdx >= 0 ? summaryIdx + 1 : 0;
    result.splice(insertAt, 0, { type: 'main-cta', cta: canonicalCta });
    return result;
  }

  if (transportType === 'rail') return rawStepGroups;
  return rawStepGroups.filter(item => item.type !== 'main-cta');
}

/* ══════════════════════════════════════════════════════
   ⑦ メインエントリーポイント
══════════════════════════════════════════════════════ */

/**
 * 出発地・目的地から交通コンテキストを構築する（唯一の真実）。
 *
 * 新設計:
 *   1. 全候補生成 → ルール除外 → スコアリング → 最適1つ選択
 *   2. fallback不要（候補が複数あればスコア順で自動選択）
 *   3. 全候補除外 → mapOnlyFallback
 *
 * @param {string} departure
 * @param {object} city
 * @returns {object}
 */
export function buildTransportContext(departure, city) {
  /* ① 距離計算 */
  const depCoords  = DEPARTURE_COORDS[departure];
  const distanceKm = depCoords && city?.lat && city?.lng
    ? Math.round(calcDistanceKm(depCoords, city))
    : 0;

  /* ② 全候補生成・ルール除外・スコアリング・最適選択 */
  const candidates = buildCandidates(departure, city, distanceKm);
  const best = candidates[0] ?? null;

  let transportType  = best?.type ?? 'rail';
  let cta            = best?.cta  ?? null;
  let score          = best?.score ?? 0;
  let valid          = !!best;
  let isFallback     = false;
  let mapOnlyFallback = false;

  if (!best) {
    mapOnlyFallback = true;
  } else if (!cta) {
    // CTA なしの最高スコア候補:
    //   rail は step 由来CTA が機能するため mapOnly にしない
    //   flight/ferry は次点でCTAありを探す
    if (transportType === 'rail') {
      // rail: step 由来 CTA に委ねる（buildCanonicalStepGroups が維持）
    } else {
      const withCta = candidates.find(c => c.cta);
      if (withCta) {
        transportType = withCta.type;
        cta           = withCta.cta;
        score         = withCta.score;
        isFallback    = true;
      } else {
        // rail 候補があれば step 由来 CTA を使う
        const railCandidate = candidates.find(c => c.type === 'rail');
        if (railCandidate) {
          transportType = 'rail';
          score         = railCandidate.score;
          isFallback    = true;
        } else {
          mapOnlyFallback = true;
        }
      }
    }
  }

  /* ③ accessType */
  const accessType = resolveAccessType(city, transportType);

  /* ④ 地方経路 */
  const fromRegion = DEPARTURE_REGION_MAP[departure] ?? null;
  const regionPath = fromRegion && city?.region
    ? findRegionPath(fromRegion, city.region)
    : null;

  /* ⑤ 経由地 */
  const destName = city?.displayName || city?.name;
  const via = city?.localHub
    ?? ((city?.hubCity && city.hubCity !== destName) ? city.hubCity : null)
    ?? null;

  /* ⑥ step-group 生成 */
  const rawStepGroups = resolveTransportLinks(city, departure);

  /* ⑦ CTA 一本化 */
  const stepGroups = buildCanonicalStepGroups(rawStepGroups, cta, transportType);

  /* ⑧ Google Maps URL */
  const mapUrl = buildRouteMapUrl(departure, city, via ?? null);

  /* ⑨ 納得感テキスト */
  const reason = buildRouteReason(transportType, distanceKm, city, isFallback, mapOnlyFallback);

  return {
    transportType,
    accessType,
    distanceKm,
    score,
    valid,
    isFallback,
    mapOnlyFallback,
    reason,
    regionPath,
    via,
    stepGroups,
    cta,
    mapUrl,
  };
}
