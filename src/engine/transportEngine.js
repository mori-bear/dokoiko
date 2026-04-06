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

    // 例外: 新幹線強区間 → flight を Tier3 に降格
    if (hasDirect && isShinkansenStrong(departure, city)) {
      return { tier: 3, reason: '新幹線の方が便利な区間' };
    }

    if (hasDirect && distKm >= FLIGHT_PREFER_KM) return { tier: 1, reason: '直行で最短' };
    if (hasDirect)                                return { tier: 2, reason: '直行便あり' };
    return { tier: 2, reason: '経由便で行ける' };
  }

  if (type === 'ferry') {
    if (isIsland && city?.ferryGateway) return { tier: 1, reason: 'フェリーで直接渡れる' };
    return { tier: 3, reason: 'フェリーで行ける' };
  }

  if (type === 'rail') {
    // 例外: 新幹線強区間 → rail を Tier1 に昇格
    if (isShinkansenStrong(departure, city)) return { tier: 1, reason: '新幹線で直行' };

    if (distKm <= 300 && !hasVia)  return { tier: 1, reason: '乗り換えなしで直通' };
    if (distKm <= 600)             return { tier: 2, reason: '新幹線で行ける' };
    return { tier: 3, reason: '鉄道で行ける' };
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
    let rejectedReason;
    if (c.tier > best.tier) {
      rejectedReason = '直行がない';
    } else if (c.time > best.time + 30) {
      rejectedReason = '時間がかかる';
    } else {
      rejectedReason = `${best.type}の方が早い`;
    }
    alternatives.push({
      transportType: c.type,
      time: c.time,
      tier: c.tier,
      rejectedReason,
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

export function buildRouteReason(transportType, distanceKm, city = null, isFallback = false, mapOnlyFallback = false) {
  if (mapOnlyFallback) return '地図でルートを確認';

  const accessType = resolveAccessType(city, transportType);
  const isIsland = city?.isIsland === true || city?.destType === 'island';

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
      return isIsland ? '船で直接渡れる' : 'フェリーで直接行ける';
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
   ⑧ CTA一本化
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

  return {
    /* ── UI用データ（⑦ bestRoute / alternatives 形式） ── */
    bestRoute: {
      transportType,
      accessType,
      time: best ? calculateTime(transportType, distanceKm) : 0,
      reason: selectionReason,
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
