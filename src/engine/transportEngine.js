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
import { loadJson }                                from '../lib/loadJson.js';
import {
  findRegionPath,
  getRegionTransportHint,
  DEPARTURE_REGION_MAP,
} from './regionGraph.js';

/* ── 交通DB（起動時1回ロード） ── */
const FLIGHT_ROUTES = await loadJson('../data/flightRoutes.json', import.meta.url);
const FERRY_ROUTES  = await loadJson('../data/ferries.json',      import.meta.url);

/** 出発地→目的地空港の直行便がDBに存在するか */
function hasFlightInDB(departure, airportGateway) {
  if (!departure || !airportGateway) return false;
  return FLIGHT_ROUTES.some(r => r.from === departure && r.to === airportGateway);
}

/** 目的地のフェリー航路がDBに存在するか */
function hasFerryInDB(destId, ferryGateway) {
  if (!destId && !ferryGateway) return false;
  return FERRY_ROUTES.some(r =>
    (destId && r.destId === destId) || (ferryGateway && r.from === ferryGateway)
  );
}

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
 * DB照合: flight/ferry はDBに存在するルートのみ許可。
 *
 * @param {'flight'|'ferry'|'rail'} type
 * @param {object} city
 * @param {number} distKm
 * @param {string} [departure] — 出発地（DB照合に使用）
 * @returns {boolean}
 */
export function validateRoute(type, city, distKm = 0, departure = '') {
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  switch (type) {
    case 'rail':
      if (city?.region === FLIGHT_ONLY_REGION) return false;
      if (isIsland)                            return false;
      return true;

    case 'flight': {
      if (city?.region === FLIGHT_ONLY_REGION) return true;
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      if (distKm > 0 && distKm < FLIGHT_MIN_DISTANCE) return false;
      if (isIsland && distKm > 0 && distKm <= 500) return false;
      if (!isIsland && distKm > 0 && distKm < FLIGHT_DISTANCE_KM) return false;
      // DB照合: flightRoutes.json に存在しないルートは除外
      if (departure && city?.airportGateway) {
        if (!hasFlightInDB(departure, city.airportGateway)) return false;
      }
      return true;
    }

    case 'ferry':
      if (city?.isIsland !== true && !city?.ferryGateway) return false;
      // DB照合: ferries.json に存在しない航路は除外
      if (city?.ferryGateway && !hasFerryInDB(city?.id, city?.ferryGateway)) return false;
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
 * 最適ルート選択ルール（優先順位順）:
 *   1. 直行ルートを最優先（直行便/直通フェリー: +40）
 *   2. 乗り換え少ないルートを優先（経由あり: -10）
 *   3. flight DB確認済み → 他手段を基本除外（+40で圧勝）
 *   4. ferry は島のみ優先採用（島+ferry: +30）
 *   5. bus はラストマイルのみ（destType bonus で制御済み）
 *
 * @param {'flight'|'ferry'|'rail'} type
 * @param {number} distKm
 * @param {object} city
 * @param {boolean} hasCta
 * @param {string} departure — DB照合用
 * @returns {{ score: number, selectionReason: string }}
 */
function scoreCandidate(type, distKm, city, hasCta, departure = '') {
  let score = 0;
  let selectionReason = '';
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  /* ── ベーススコア ── */
  switch (type) {
    case 'flight': score = 20; break;
    case 'ferry':  score = 15; break;
    case 'rail':   score = 10; break;
  }

  /* ── ① 直行ルート最優先 ── */
  if (type === 'flight' && departure && city?.airportGateway && hasFlightInDB(departure, city.airportGateway)) {
    score += 40;  // DB確認済み直行便 → 圧倒的優先
    selectionReason = '直行便あり';
  }

  if (type === 'ferry' && isIsland && city?.ferryGateway) {
    score += 30;  // 島 + 直通フェリー → 強く優先
    selectionReason = '直通フェリーあり';
  }

  /* ── ② 乗り換えペナルティ ── */
  const destName = city?.displayName || city?.name;
  const hasVia = city?.localHub || (city?.hubCity && city.hubCity !== destName);
  if (hasVia) score -= 10;  // 経由地あり = 乗り換え発生

  /* ── 距離適正 ── */
  if (type === 'rail') {
    if      (distKm <= 200) score += 30;
    else if (distKm <= 400) score += 15;
    else if (distKm <= 600) score += 0;
    else if (distKm <= 800) score -= 20;
    else                    score -= 50;
    if (!selectionReason) selectionReason = distKm <= 300 ? '直通で行ける' : '新幹線で行ける';
  }

  if (type === 'flight') {
    if      (distKm >= 700)  score += 25;
    else if (distKm >= 500)  score += 20;
    else if (distKm >= 300)  score += 0;
    else                     score -= 30;
    if (!selectionReason) selectionReason = '最短ルート';
  }

  if (type === 'ferry') {
    if (isIsland)            score += 20;
    if (city?.ferryGateway)  score += 10;
    if (!selectionReason) selectionReason = isIsland ? '船で直接渡れる' : 'フェリーで行ける';
  }

  /* ── インフラボーナス ── */
  if (type === 'flight' && city?.hasDirectFlight === true && !selectionReason) {
    score += 15;
    selectionReason = '直行便あり';
  }

  /* ── CTA ペナルティ ── */
  if (!hasCta) score -= 50;

  /* ── destType ボーナス ── */
  if (city?.secondaryTransport === 'bus') score += 5;
  if (city?.destType === 'peninsula')     score += 10;

  return { score, selectionReason };
}

/**
 * 後方互換: 旧 scoreTransport API（QA等で使用）。
 */
export function scoreTransport(transportType, distanceKm, city = null) {
  const { score } = scoreCandidate(transportType, distanceKm, city, true);
  return Math.max(0, Math.min(100, score));
}

/* ══════════════════════════════════════════════════════
   ③ 候補生成・最適選択
══════════════════════════════════════════════════════ */

/** @typedef {{ type: string, score: number, cta: object|null, selectionReason: string }} Candidate */
/** @typedef {{ type: string, reason: string }} RejectedRoute */

/** validateRoute 除外理由を返す */
function getRejectReason(type, city, distKm, departure) {
  const isIsland = city?.isIsland === true || city?.destType === 'island';
  switch (type) {
    case 'rail':
      if (city?.region === FLIGHT_ONLY_REGION) return '沖縄に鉄道なし';
      if (isIsland)                            return '離島に鉄道なし';
      return '条件外';
    case 'flight':
      if (!city?.airportGateway && !city?.flightHub) return '空港情報なし';
      if (distKm > 0 && distKm < FLIGHT_MIN_DISTANCE) return '近距離すぎる';
      if (isIsland && distKm <= 500) return 'フェリー圏内';
      if (!isIsland && distKm < FLIGHT_DISTANCE_KM) return '鉄道圏内';
      if (departure && city?.airportGateway && !hasFlightInDB(departure, city.airportGateway))
        return `${departure}からの直行便なし`;
      return '条件外';
    case 'ferry':
      if (!isIsland && !city?.ferryGateway) return 'フェリー港なし';
      if (city?.ferryGateway && !hasFerryInDB(city?.id, city?.ferryGateway))
        return 'フェリー航路が未登録';
      return '条件外';
    default: return '条件外';
  }
}

/**
 * 全候補を評価。選択候補（スコア順）と除外候補（理由付き）を返す。
 *
 * @param {string} departure
 * @param {object} city
 * @param {number} distKm
 * @returns {{ candidates: Candidate[], rejected: RejectedRoute[] }}
 */
function buildCandidates(departure, city, distKm) {
  const TYPES = ['flight', 'ferry', 'rail'];
  const candidates = [];
  const rejected   = [];

  for (const type of TYPES) {
    // Phase 1: ルールベース除外 + DB照合
    if (!validateRoute(type, city, distKm, departure)) {
      rejected.push({ type, reason: getRejectReason(type, city, distKm, departure) });
      continue;
    }

    // CTA 生成試行
    const cta = resolveCtaByType(type, departure, city);

    // Phase 2: スコアリング（直行優先・乗り換えペナルティ込み）
    const { score, selectionReason } = scoreCandidate(type, distKm, city, !!cta, departure);

    candidates.push({ type, score, cta, selectionReason });
  }

  // スコア降順ソート
  candidates.sort((a, b) => b.score - a.score);

  // 選択されなかった候補も rejected に追加（理由: スコア負け）
  for (let i = 1; i < candidates.length; i++) {
    rejected.push({ type: candidates[i].type, reason: `${candidates[0].type}の方がスコアが高い` });
  }

  return { candidates, rejected };
}

/**
 * 後方互換: 旧 determineTransportType API。
 */
export function determineTransportType(departure, city, distKm = 0) {
  const { candidates } = buildCandidates(departure, city, distKm);
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
  const { candidates, rejected } = buildCandidates(departure, city, distanceKm);
  const best = candidates[0] ?? null;

  let transportType   = best?.type ?? 'rail';
  let cta             = best?.cta  ?? null;
  let score           = best?.score ?? 0;
  let selectionReason = best?.selectionReason ?? '';
  let valid           = !!best;
  let isFallback      = false;
  let mapOnlyFallback = false;

  if (!best) {
    mapOnlyFallback = true;
  } else if (!cta) {
    if (transportType === 'rail') {
      // rail: step 由来 CTA に委ねる
    } else {
      const withCta = candidates.find(c => c.cta);
      if (withCta) {
        transportType   = withCta.type;
        cta             = withCta.cta;
        score           = withCta.score;
        selectionReason = withCta.selectionReason;
        isFallback      = true;
      } else {
        const railCandidate = candidates.find(c => c.type === 'rail');
        if (railCandidate) {
          transportType   = 'rail';
          score           = railCandidate.score;
          selectionReason = railCandidate.selectionReason;
          isFallback      = true;
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
    selectionReason,     // なぜこの手段が選ばれたか（直行便あり/直通で行ける等）
    rejectedRoutes: rejected, // 除外されたルート（理由付き）
    regionPath,
    via,
    stepGroups,
    cta,
    mapUrl,
  };
}
