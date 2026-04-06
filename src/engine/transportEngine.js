/**
 * transportEngine.js — 交通ロジック「唯一の真実」
 *
 * 設計:
 *   1. generateCandidates — 全候補をDB照合で生成
 *   2. calculateTime      — 擬似所要時間を算出
 *   3. assignTier          — Tier（直行/乗換/現実的/その他）を付与
 *   4. selectBestRoute     — Tier→時間の優先順で最適1つを選択
 *
 * Tier制:
 *   Tier1: 直行（DB確認済み直行便 / 島直通フェリー / 直通rail）
 *   Tier2: 乗換1回以内（新幹線 / 経由便）
 *   Tier3: 現実的（長距離rail / hub経由）
 *   Tier4: その他（基本出さない）
 *
 * 例外:
 *   - 新幹線強区間（東京〜大阪/名古屋）→ rail 優先
 *   - 島 + 直行flight → ferry と時間比較
 *   - 150km未満の flight → rail 優先
 */

import { DEPARTURE_COORDS }       from '../config/constants.js';
import { calcDistanceKm }          from '../utils/geo.js';
import { resolveTransportLinks }   from '../transport/resolveTransportLinks.js';
import { resolveCtaByType }        from './ctaResolver.js';
import { buildRouteMapUrl }        from '../utils/map/buildRouteMapUrl.js';
import { loadJson }                from '../lib/loadJson.js';
import {
  findRegionPath,
  DEPARTURE_REGION_MAP,
} from './regionGraph.js';

/* ── 交通DB ── */
const FLIGHT_ROUTES = await loadJson('../data/flightRoutes.json', import.meta.url);
const FERRY_ROUTES  = await loadJson('../data/ferries.json',      import.meta.url);

function hasFlightInDB(departure, airport) {
  if (!departure || !airport) return false;
  return FLIGHT_ROUTES.some(r => r.from === departure && r.to === airport);
}

function hasFerryInDB(destId, port) {
  if (!destId && !port) return false;
  return FERRY_ROUTES.some(r => (destId && r.destId === destId) || (port && r.from === port));
}

/* ── 閾値 ── */
const FLIGHT_MIN_KM   = 150;
const FLIGHT_PREFER_KM = 400;
const OKINAWA          = '沖縄';

/* ── 新幹線強区間（flight より rail が体感的に優れる区間） ── */
const SHINKANSEN_STRONG = new Set([
  '東京-大阪', '東京-名古屋', '東京-京都', '東京-新大阪',
  '大阪-東京', '名古屋-東京', '京都-東京', '新大阪-東京',
  '大阪-名古屋', '名古屋-大阪', '大阪-京都', '京都-大阪',
  '東京-静岡', '静岡-東京', '東京-浜松', '浜松-東京',
  '大阪-広島', '広島-大阪', '大阪-岡山', '岡山-大阪',
  '東京-仙台', '仙台-東京', '東京-宇都宮', '宇都宮-東京',
  '東京-長野', '長野-東京', '東京-金沢', '金沢-東京',
]);

function isShinkansenStrong(departure, city) {
  // 目的地の最寄ハブ駅がある都市で判定
  const dest = city?.hubCity ?? city?.displayName ?? city?.name ?? '';
  return SHINKANSEN_STRONG.has(`${departure}-${dest}`);
}

/* ══════════════════════════════════════════════════════
   ① validateRoute — DB照合ハードフィルター
══════════════════════════════════════════════════════ */

export function validateRoute(type, city, distKm = 0, departure = '') {
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  switch (type) {
    case 'rail':
      if (city?.region === OKINAWA) return false;
      if (isIsland)                 return false;
      return true;

    case 'flight':
      if (city?.region === OKINAWA) return true;
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      if (distKm > 0 && distKm < FLIGHT_MIN_KM) return false;
      if (departure && city?.airportGateway && !hasFlightInDB(departure, city.airportGateway)) return false;
      return true;

    case 'ferry':
      if (!isIsland && !city?.ferryGateway) return false;
      if (city?.ferryGateway && !hasFerryInDB(city?.id, city?.ferryGateway)) return false;
      return true;

    default:
      return true;
  }
}

/* ══════════════════════════════════════════════════════
   ② calculateTime — 擬似所要時間（分）
══════════════════════════════════════════════════════ */

function calculateTime(type, distKm) {
  switch (type) {
    case 'flight': return 90 + Math.round(distKm / 13) + 30; // 空港往復 + 飛行 + 到着
    case 'rail':   return Math.round(distKm / 200 * 60) + 10; // 新幹線概算 + 待ち
    case 'ferry':  return 60 + Math.round(distKm * 2);         // 港往復 + 航行
    default:       return 9999;
  }
}

/* ══════════════════════════════════════════════════════
   ③ assignTier — Tier付与
══════════════════════════════════════════════════════ */

/**
 * @returns {{ tier: number, reason: string }}
 */
function assignTier(type, distKm, city, hasCta, departure) {
  const isIsland = city?.isIsland === true || city?.destType === 'island';
  const destName = city?.displayName || city?.name;
  const hasVia   = city?.localHub || (city?.hubCity && city.hubCity !== destName);

  if (!hasCta && type !== 'rail') return { tier: 4, reason: '予約手段なし' };

  if (type === 'flight') {
    const hasDirect = departure && city?.airportGateway && hasFlightInDB(departure, city.airportGateway);

    if (hasDirect && isShinkansenStrong(departure, city)) {
      return { tier: 3, reason: '直行で一気に行ける' };
    }

    if (hasDirect && distKm >= FLIGHT_PREFER_KM) return { tier: 1, reason: '直行で一気に行ける' };
    if (hasDirect)                                return { tier: 2, reason: '直行で一気に行ける' };
    return { tier: 2, reason: '飛行機で行ける' };
  }

  if (type === 'ferry') {
    if (isIsland && city?.ferryGateway) return { tier: 1, reason: 'フェリーで直接渡れる' };
    return { tier: 3, reason: 'フェリーで行ける' };
  }

  if (type === 'rail') {
    if (isShinkansenStrong(departure, city)) return { tier: 1, reason: '電車でスムーズに行ける' };

    if (distKm <= 300 && !hasVia)  return { tier: 1, reason: '電車でスムーズに行ける' };
    if (distKm <= 600)             return { tier: 2, reason: '電車でスムーズに行ける' };
    return { tier: 3, reason: '電車で行ける' };
  }

  return { tier: 4, reason: '' };
}

/* ══════════════════════════════════════════════════════
   ④ generateCandidates — 全候補生成
══════════════════════════════════════════════════════ */

function generateCandidates(departure, city, distKm) {
  const TYPES = ['flight', 'ferry', 'rail'];
  const candidates = [];
  const rejected   = [];

  for (const type of TYPES) {
    if (!validateRoute(type, city, distKm, departure)) {
      rejected.push({ type, reason: getRejectReason(type, city, distKm, departure) });
      continue;
    }

    const cta  = resolveCtaByType(type, departure, city);
    const time = calculateTime(type, distKm);
    const { tier, reason } = assignTier(type, distKm, city, !!cta, departure);

    candidates.push({ type, tier, time, cta, reason });
  }

  return { candidates, rejected };
}

function getRejectReason(type, city, distKm, departure) {
  const isIsland = city?.isIsland === true || city?.destType === 'island';
  switch (type) {
    case 'rail':
      if (city?.region === OKINAWA) return '沖縄に鉄道なし';
      if (isIsland)                 return '離島に鉄道なし';
      return '条件外';
    case 'flight':
      if (!city?.airportGateway && !city?.flightHub) return '直行便なし';
      if (distKm > 0 && distKm < FLIGHT_MIN_KM) return '近距離すぎる';
      if (departure && city?.airportGateway && !hasFlightInDB(departure, city.airportGateway))
        return `${departure}からの直行便なし`;
      return '条件外';
    case 'ferry':
      if (!isIsland && !city?.ferryGateway) return 'フェリー港なし';
      if (city?.ferryGateway && !hasFerryInDB(city?.id, city?.ferryGateway)) return 'フェリー航路なし';
      return '条件外';
    default: return '条件外';
  }
}

/* ══════════════════════════════════════════════════════
   ⑤ selectBestRoute — 最適1つ選択
══════════════════════════════════════════════════════ */

/**
 * Tier昇順 → 時間昇順で最適候補を選択。
 * 非選択候補は比較理由付きで rejected に追加。
 *
 * @returns {{ best, alternatives, rejected }}
 */
function selectBestRoute(candidates, rejected) {
  // Tier昇順 → 時間昇順
  candidates.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : a.time - b.time);

  const best = candidates[0] ?? null;
  const alternatives = [];

  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    alternatives.push({
      transportType: c.type,
      rejectedReason: buildRejectedReason(best.type, c.type, c.tier, best.tier),
    });
  }

  return { best, alternatives, rejected };
}

/* ══════════════════════════════════════════════════════
   ⑥ accessType
══════════════════════════════════════════════════════ */

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
   ⑦ UI用 reason テキスト
══════════════════════════════════════════════════════ */

/**
 * ルート理由文（意味ベース・数値なし）。
 * 15〜25文字。ユーザーが一瞬で納得できる文言。
 */
export function buildRouteReason(transportType, distanceKm, city = null, isFallback = false, mapOnlyFallback = false) {
  if (mapOnlyFallback) return '地図でルートを確認';

  const accessType = resolveAccessType(city, transportType);
  const isIsland = city?.isIsland === true || city?.destType === 'island';

  // 複合ルート（乗り換えあり）
  if (accessType === 'bus') {
    if (transportType === 'flight') return '飛行機＋バスで行ける';
    if (transportType === 'ferry')  return 'フェリー＋バスで渡れる';
    return '乗り換え少なくスムーズ';
  }
  if (accessType === 'car') {
    if (transportType === 'flight') return '飛行機＋車で行ける';
    if (transportType === 'ferry')  return 'フェリー＋車で渡れる';
    return '乗り換え少なくスムーズ';
  }

  // 単独ルート
  switch (transportType) {
    case 'flight': return '飛行機がいちばん現実的';
    case 'ferry':  return isIsland ? 'フェリーで渡れる' : 'フェリーで自然に行ける';
    case 'rail':   return distanceKm < 200 ? '直通で行ける' : '乗り換え少なくスムーズ';
    default:       return 'この行き方が現実的';
  }
}

/**
 * alternative の不採用理由（意味ベース・数値なし）。
 */
export function buildRejectedReason(bestType, altType, altTier, bestTier) {
  if (altTier > bestTier) {
    // Tier差 → 直行がない / 遠回り
    if (altType === 'flight') return '直行便がない';
    if (altType === 'ferry')  return 'フェリー航路がない';
    return '遠回りになる';
  }
  // 同Tier → 時間差
  if (altType === 'rail')   return '遠回りになる';
  if (altType === 'flight') return '直行便がない';
  if (altType === 'ferry')  return '時間がかかる';
  return '現実的でない';
}

/* ══════════════════════════════════════════════════════
   ⑧ セグメント分解（stepGroups → segments）
══════════════════════════════════════════════════════ */

/** stepGroupのstepLabelからfrom/to/modeを抽出し、bookable判定を付与する */
function extractSegments(stepGroups) {
  const segments = [];
  for (const sg of stepGroups) {
    if (sg.type !== 'step-group' || !sg.stepLabel) continue;
    // "① 高松 → 岡山（マリンライナー）" or "② 岡山 → 京都（新幹線）"
    const m = sg.stepLabel.match(/[\s①-⑧\d.]*\s*(.+?)\s*→\s*(.+?)（(.+?)）/u);
    if (!m) continue;
    const from = m[1].trim();
    const to   = m[2].trim();
    const mode = m[3].trim();
    const type = classifySegmentType(mode, from, to);
    segments.push({
      from,
      to,
      mode,
      type,
      bookable: isBookableSegment(type),
    });
  }
  return segments;
}

function classifySegmentType(mode, from, to) {
  if (/新幹線/.test(mode))           return 'shinkansen';
  if (/飛行機|航空/.test(mode))      return 'flight';
  if (/フェリー/.test(mode))         return 'ferry';
  if (/高速バス/.test(mode))         return 'highway_bus';
  if (/レンタカー/.test(mode))        return 'rental';
  if (/マリンライナー/.test(mode))   return 'rail_express';
  if (/特急/.test(mode))             return 'rail_express';
  if (/徒歩/.test(mode))             return 'walk';
  // 空港が絡む区間の判定（stepLabelのモード名が不正確なケースを補正）
  if (/空港$/.test(to) && !/空港$/.test(from)) {
    // X → Y空港: from地域とto地域が異なる場合はflight
    // 同一地域のアクセス（バスで空港へ等）は除外
    const fromClean = from.replace(/駅$/, '');
    const toClean = to.replace(/空港$/, '');
    if (fromClean !== toClean && !toClean.startsWith(fromClean)) return 'flight';
  }
  if (/空港$/.test(from) && /空港$/.test(to)) return 'flight';
  if (/空港$/.test(from) && /駅$/.test(to))   return 'rail_local'; // 空港→駅 = 空港アクセス
  if (/バス/.test(mode))             return 'local_bus';
  return 'rail_local';
}

function isBookableSegment(type) {
  return ['shinkansen', 'flight', 'ferry', 'highway_bus'].includes(type);
}

/** 主役セグメント1つを決定（flight > shinkansen > ferry > highway_bus） */
function pickMainSegment(segments) {
  return segments.find(s => s.type === 'flight')
    ?? segments.find(s => s.type === 'shinkansen')
    ?? segments.find(s => s.type === 'ferry')
    ?? segments.find(s => s.type === 'highway_bus')
    ?? null;
}

/**
 * ユーザー向けシンプル表示ルート（出発地 → 目的地）。
 * flight: 都市名→都市名（空港・駅を省略）
 * shinkansen: 新幹線区間の両端
 * その他: departure → destName
 */
function buildDisplayRoute(mainSeg, departure, city) {
  const destName = city?.displayName || city?.name || '';
  if (!mainSeg) return { from: departure, to: destName };

  const clean = (n) => n.replace(/駅$|空港$|港$/, '');

  if (mainSeg.type === 'flight') {
    return { from: clean(mainSeg.from) || departure, to: clean(mainSeg.to) || destName };
  }
  // shinkansen/ferry: そのままの区間
  return { from: clean(mainSeg.from), to: clean(mainSeg.to) };
}

/* ══════════════════════════════════════════════════════
   ⑨ CTA一本化
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
   ⑨ 後方互換 export
══════════════════════════════════════════════════════ */

export function scoreTransport(transportType, distanceKm, city = null) {
  const time = calculateTime(transportType, distanceKm);
  const { tier } = assignTier(transportType, distanceKm, city, true, '');
  const base = [0, 80, 60, 40, 10][tier] ?? 10;
  return Math.max(0, Math.min(100, base - Math.round(time / 50)));
}

export function determineTransportType(departure, city, distKm = 0) {
  const { candidates } = generateCandidates(departure, city, distKm);
  candidates.sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : a.time - b.time);
  return candidates.length > 0 ? candidates[0].type : 'rail';
}

/* ══════════════════════════════════════════════════════
   ⑩ メインエントリーポイント
══════════════════════════════════════════════════════ */

export function buildTransportContext(departure, city) {
  /* ① 距離計算 */
  const depCoords  = DEPARTURE_COORDS[departure];
  const distanceKm = depCoords && city?.lat && city?.lng
    ? Math.round(calcDistanceKm(depCoords, city))
    : 0;

  /* ② 候補生成 → Tier付与 → 最適選択 */
  const { candidates, rejected: rawRejected } = generateCandidates(departure, city, distanceKm);
  const { best, alternatives, rejected } = selectBestRoute(candidates, rawRejected);

  let transportType   = best?.type ?? 'rail';
  let cta             = best?.cta  ?? null;
  let tier            = best?.tier ?? 4;
  let selectionReason = best?.reason ?? '';
  let valid           = !!best;
  let isFallback      = false;
  let mapOnlyFallback = false;

  if (!best) {
    mapOnlyFallback = true;
  } else if (!cta) {
    if (transportType === 'rail') {
      // step 由来 CTA に委ねる
    } else {
      const withCta = candidates.find(c => c.cta);
      if (withCta) {
        transportType   = withCta.type;
        cta             = withCta.cta;
        tier            = withCta.tier;
        selectionReason = withCta.reason;
        isFallback      = true;
      } else {
        const railCandidate = candidates.find(c => c.type === 'rail');
        if (railCandidate) {
          transportType   = 'rail';
          tier            = railCandidate.tier;
          selectionReason = railCandidate.reason;
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

  /* ⑥ step-group */
  const rawStepGroups = resolveTransportLinks(city, departure);
  const stepGroups = buildCanonicalStepGroups(rawStepGroups, cta, transportType);

  /* ⑦ Maps URL */
  const mapUrl = buildRouteMapUrl(departure, city, via ?? null);

  /* ⑧ reason テキスト */
  const reason = buildRouteReason(transportType, distanceKm, city, isFallback, mapOnlyFallback);

  /* ⑨ セグメント分解 */
  const segments = extractSegments(stepGroups);
  // 交通セグメントのみでwaypoints構築（徒歩・観光巡回を除外）
  const transportSegs = segments.filter(s => !['walk', 'local_bus'].includes(s.type) || /空港|港|駅/.test(s.to));
  const waypoints = transportSegs.length > 0
    ? [...new Set([transportSegs[0].from, ...transportSegs.map(s => s.to)])]
    : [departure, city?.displayName || city?.name].filter(Boolean);

  // finalAccess: 最寄駅→目的地の最終アクセス手段
  const finalAccess = city?.finalAccess ?? 'walk';
  const repStation = city?.representativeStation ?? null;

  // ⑩ 主役セグメント + 表示用ルート
  const mainSegment = pickMainSegment(segments);
  const displayRoute = buildDisplayRoute(mainSegment, departure, city);

  return {
    /* ── UI用データ（⑦ bestRoute / alternatives 形式） ── */
    bestRoute: {
      transportType,
      accessType,
      distanceKm,
      reason: selectionReason,
      segments,
      waypoints,
      finalAccess,
      representativeStation: repStation,
      mainSegment,
      displayRoute,
    },
    alternatives,

    /* ── 既存互換フィールド ── */
    transportType,
    accessType,
    distanceKm,
    score: scoreTransport(transportType, distanceKm, city),
    tier,
    valid,
    isFallback,
    mapOnlyFallback,
    reason,
    selectionReason,
    rejectedRoutes: rejected,
    regionPath,
    via,
    stepGroups,
    cta,
    mapUrl,
  };
}
