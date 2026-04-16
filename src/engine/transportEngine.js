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
      // DB照合のみ（hasDirectFlight依存を排除）
      if (!city?.airportGateway && !city?.flightHub) return false;
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
    if (isShinkansenStrong(departure, city)) return { tier: 1, reason: '電車で行ける' };

    if (distKm <= 300 && !hasVia)  return { tier: 1, reason: '電車で行ける' };
    if (distKm <= 600)             return { tier: 2, reason: '電車で行ける' };
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
  const isIsland = dt === 'island' || city?.isIsland === true;

  // 離島: primary は ferry/plane のまま（到着後レンタカーは別途 requiresCar で表示）
  if (isIsland) return transportType;

  // 半島・秘境地域: secondaryTransport または requiresCar で car/bus を決定
  if (dt === 'peninsula' || dt === 'remote') {
    if (city.secondaryTransport === 'bus')  return 'bus';
    if (city.secondaryTransport === 'car')  return 'car';
    if (city.requiresCar === true)           return 'car';
    return 'bus';
  }

  // 秘境/山奥 (onsen/mountain/sight 等で requiresCar=true):
  // 電車CTAのみを禁止 → レンタカーで行く
  if (city?.requiresCar === true) return 'car';

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
  const isPeninsula = city?.destType === 'peninsula';
  const islandType = resolveIslandDisplayType(city);

  // 島・半島の専用reason
  if (islandType === 'ferry')  return 'フェリーで渡れる';
  if (islandType === 'bus')    return 'バスでそのまま行ける';
  if (islandType === 'car')    return '車で行ける';

  // 複合ルート（乗り換えあり）
  if (accessType === 'bus') {
    if (transportType === 'flight') return '飛行機＋バスで行ける';
    if (transportType === 'ferry')  return 'フェリー＋バスで渡れる';
    return '乗り換え少なく行ける';
  }
  if (accessType === 'car') {
    if (transportType === 'flight') return '飛行機＋車で行ける';
    if (transportType === 'ferry')  return 'フェリー＋車で渡れる';
    return '乗り換え少なく行ける';
  }

  // 単独ルート
  switch (transportType) {
    case 'flight': return '飛行機がいちばん現実的';
    case 'ferry':  return 'フェリーで自然に行ける';
    case 'rail':   return distanceKm < 200 ? '直通で行ける' : '乗り換え少なく行ける';
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
    // stepType（BFS由来の正しい型）を優先参照
    const type = classifySegmentType(mode, from, to, sg.stepType);
    const operator = sg.operator ?? null;
    segments.push({
      from,
      to,
      mode,
      type,
      bookable: isBookableSegment(type),
      operator,
    });
  }
  return segments;
}

function classifySegmentType(mode, from, to, stepType = null) {
  // stepType が明示されている場合はそれを優先
  if (stepType === 'shinkansen') return 'shinkansen';
  if (stepType === 'flight')     return 'flight';
  if (stepType === 'ferry')      return 'ferry';
  if (stepType === 'bus')        return /高速/.test(mode) ? 'highway_bus' : 'local_bus';
  if (stepType === 'car')        return 'rental';
  // stepType === 'rail' の場合は mode で判定（特急/在来線/空港アクセス等）
  if (/新幹線/.test(mode))           return 'shinkansen';
  if (/飛行機|航空/.test(mode))      return 'flight';
  if (/フェリー/.test(mode))         return 'ferry';
  if (/高速バス/.test(mode))         return 'highway_bus';
  if (/レンタカー/.test(mode))        return 'rental';
  if (/マリンライナー/.test(mode))   return 'rail_express';
  if (/特急/.test(mode))             return 'rail_express';
  if (/徒歩/.test(mode))             return 'walk';
  // stepType が rail なら flight 誤分類を禁止（X駅→Y空港でも rail_local のまま）
  if (stepType === 'rail')           return 'rail_local';
  // stepType なし: mode テキストのみで判定（文字列ベースの空港判定は完全廃止）
  if (/バス/.test(mode))             return 'local_bus';
  return 'rail_local';
}

function isBookableSegment(type) {
  return ['shinkansen', 'flight', 'ferry', 'highway_bus'].includes(type);
}

/** 私鉄パターン（JRチェーンから除外） */
const PRIVATE_RAILWAY = /近鉄|南海|小田急|東武|西武|京王|京急|京成|京阪|阪急|阪神|名鉄|相鉄|東急|えちぜん|えちご|富山地方|長野電鉄|島原|松浦|鹿島臨海|叡山|江ノ電|秩父鉄道|上田電鉄|ケーブル|ロープウェイ|モノレール|ゆりかもめ/;

/** セグメントがJR系かどうかを判定（mode文字列 + operator で総合判定） */
function isJRSegment(seg) {
  if (seg.type === 'shinkansen') return true;
  if (seg.operator && /^JR/.test(seg.operator)) return true;
  const mode = seg.mode ?? '';
  // 私鉄は明示的に除外（最優先）
  if (PRIVATE_RAILWAY.test(mode)) return false;
  // 明示的にJRと書かれている
  if (/^JR/.test(mode)) return true;
  // マリンライナー・特急はJR
  if (/マリンライナー/.test(mode)) return true;
  if (/特急/.test(mode)) return true;
  // rail_local / rail_express で私鉄でない → JR（ローカル線含む）
  if (seg.type === 'rail_local' || seg.type === 'rail_express') return true;
  return false;
}

/** 連続するJRセグメントをチェーンとして抽出する */
function extractJRChains(segments) {
  const chains = [];
  let current = [];
  for (const seg of segments) {
    if (isJRSegment(seg)) {
      current.push(seg);
    } else {
      if (current.length) {
        chains.push(current);
        current = [];
      }
    }
  }
  if (current.length) chains.push(current);
  return chains;
}

/**
 * JRチェーンの中から採用するチェーンを決定する。
 * 最長（セグメント数）を基本採用。同長なら先頭を優先。
 */
function pickMainJRChain(chains) {
  if (!chains.length) return null;
  return chains.reduce((best, c) => c.length > best.length ? c : best, chains[0]);
}

/**
 * JRチェーンからCTA情報を直接生成する。
 * flight / ferry は別ロジック。bus/car はCTAなし。
 */
function buildJRChainCta(segments) {
  const transportSegs = segments.filter(s => s.type !== 'walk');
  if (!transportSegs.length) return null;

  // flight/ferryの有無を確認
  const flight = segments.find(s => s.type === 'flight');
  const ferry  = segments.find(s => s.type === 'ferry');

  // JRチェーンを抽出
  const chains = extractJRChains(segments);
  const mainChain = pickMainJRChain(chains);

  // flight/ferry がある場合でもJRチェーンがあればJR CTAを優先
  // → ferry/flightはfinalAccessに分離（ユーザーが「どこまでJRで行けるか」を明示）
  if ((flight || ferry) && mainChain?.length) {
    const hasShinkansen = mainChain.some(s => s.type === 'shinkansen');
    const hasLimited    = mainChain.some(s => s.type === 'rail_express');
    const type = hasShinkansen ? 'shinkansen' : hasLimited ? 'limited' : 'jr';
    // 非JR区間の情報を付与（CTA補足テキスト用）
    const nonJrType = flight ? 'flight' : 'ferry';
    const nonJrDest = flight ? flight.to : ferry.to;
    return {
      from: mainChain[0].from,
      to:   mainChain[mainChain.length - 1].to,
      type,
      allJR: false,
      nonJrType,
      nonJrDest,
    };
  }

  // flight/ferryのみ（JRチェーンなし）→ from/to 明確時のみCTA生成
  if (flight && flight.from && flight.to) return { from: flight.from, to: flight.to, type: 'flight', allJR: false, nonJrOnly: true };
  if (ferry  && ferry.from  && ferry.to)  return { from: ferry.from,  to: ferry.to,  type: 'ferry',  allJR: false, nonJrOnly: true };
  // from/to不明 → CTA生成不可（地図フォールバックに任せる）
  if (flight || ferry) return null;

  // JRのみルート
  if (!mainChain) return null;
  const allJR = transportSegs.every(s => isJRSegment(s));
  const hasShinkansen = mainChain.some(s => s.type === 'shinkansen');
  const hasLimited    = mainChain.some(s => s.type === 'rail_express');
  const type = hasShinkansen ? 'shinkansen' : hasLimited ? 'limited' : 'jr';
  return {
    from: mainChain[0].from,
    to:   allJR ? transportSegs[transportSegs.length - 1].to : mainChain[mainChain.length - 1].to,
    type,
    allJR,
  };
}

/**
 * segments から実態ベースの transportType を決定する。
 * 主役交通（flight/新幹線/ferry）を優先し、目的地のローカルバス等は無視する。
 * 優先順位: flight > shinkansen > limited > ferry > bus > rail_private > rail
 */
function classifyTransport(segments) {
  // 主役交通の判定にはlocal_bus/walk/rentalを除外
  const mainSegs = segments.filter(s =>
    s.type !== 'walk' && s.type !== 'rental' && s.type !== 'local_bus'
  );
  // 優先順位: flight > shinkansen > limited > rail > ferry > bus
  if (mainSegs.some(s => s.type === 'flight'))      return 'flight';
  if (mainSegs.some(s => s.type === 'shinkansen'))  return 'shinkansen';
  if (mainSegs.some(s => s.type === 'rail_express' && isJRSegment(s))) return 'limited';
  if (mainSegs.some(s => s.type === 'ferry'))       return 'ferry';
  if (mainSegs.some(s => s.type === 'highway_bus')) return 'bus';
  const hasPrivate = mainSegs.some(s =>
    (s.type === 'rail_local' || s.type === 'rail_express') && !isJRSegment(s)
  );
  if (hasPrivate) return 'rail_private';
  return 'rail';
}

/**
 * finalAccess を表示すべきか判定する。
 * JRのみで到達できるなら非表示。
 * フェリー/飛行機がJRチェーンと共存する場合（mixed）も表示する。
 */
function shouldShowFinalAccessFromSegments(segments, jrChainCta) {
  if (jrChainCta?.allJR) return false;
  // mixed（JR + ferry/flight）の場合は必ず表示
  if (jrChainCta?.nonJrType) return true;
  return segments.some(s => {
    if (s.type === 'local_bus' || s.type === 'highway_bus') return true;
    if (s.type === 'ferry') return true;
    if (s.type === 'walk' && !/徒歩/.test(s.mode ?? '')) return false;
    if ((s.type === 'rail_local' || s.type === 'rail_express') && !isJRSegment(s)) return true;
    return false;
  });
}

/**
 * 島・半島の表示用 transportType を決定する。
 * engineのtransportType（rail等）を上書きして、ユーザーが理解できる手段にする。
 */
function resolveIslandDisplayType(city) {
  if (!city) return null;
  const isIsland = city.isIsland === true || city.destType === 'island';
  const isPeninsula = city.destType === 'peninsula';
  if (!isIsland && !isPeninsula) return null;

  // フェリーアクセスがある島
  if (city.ferryGateway) return 'ferry';
  // 空港アクセスがある島
  if (city.airportGateway) return 'flight';
  // 橋接続の島・半島
  if (city.requiresCar) return 'car';
  if (city.secondaryTransport === 'bus') return 'bus';
  return 'bus';
}

/**
 * ユーザー向け表示ルート。到着駅を明示する。
 * 島・半島は常に「出発地 → 目的地名」で表示。
 */
function buildDisplayRoute(departure, city, waypoints) {
  const destName = city?.displayName || city?.name || '';
  const clean = (n) => n.replace(/駅$|港$|空港$/, '');
  const isIsland = city?.isIsland === true || city?.destType === 'island';
  const isPeninsula = city?.destType === 'peninsula';

  // 島・半島: 常に「出発地 → 目的地名」（到着地点は島/半島名）
  if (isIsland || isPeninsula) {
    return { from: departure, to: destName, arrivalStation: destName, destName, needsAccess: false };
  }

  // 通常ルート: waypointsの末端を到着駅とする
  const lastWp = waypoints?.length > 0 ? waypoints[waypoints.length - 1] : null;
  const arrivalRaw = lastWp || city?.representativeStation || destName;
  const arrival = clean(arrivalRaw);

  const destClean = clean(destName);
  const STATION_CITY_ALIAS = { '博多': '福岡', '天神': '福岡', '新大阪': '大阪', '品川': '東京', '新横浜': '横浜' };
  const aliased = STATION_CITY_ALIAS[arrival] ?? arrival;
  const sameAsDest = arrival === destClean
    || destClean.includes(arrival)
    || arrival.includes(destClean)
    || aliased === destClean;

  return {
    from: departure,
    to: sameAsDest ? destName : arrival,
    arrivalStation: arrival,
    destName,
    needsAccess: !sameAsDest,
  };
}

/**
 * CTA到達点を解決する。ctaのtype（JR/flight/ferry）に応じて
 * 実在する正しい到達点を返す。
 */
function resolveCtaDestination(city, cta) {
  if (!city || !cta) return null;
  const clean = (n) => n?.replace(/駅$|港$|空港$/, '') ?? '';
  const JR_TYPES = new Set(['jr-east', 'jr-west', 'jr-kyushu', 'jr-ex', 'jr-window']);
  const FLIGHT_TYPES = new Set(['skyscanner', 'google-flights']);

  if (JR_TYPES.has(cta.type)) {
    // JR: gateway（乗り換え駅）を優先。なければaccessStation
    return clean(city.gateway || city.railGateway || city.accessStation || '');
  }
  if (FLIGHT_TYPES.has(cta.type)) {
    // flight: 空港名
    return clean(city.airportGateway || '');
  }
  if (cta.type === 'ferry') {
    // ferry: フェリー港
    return clean(city.ferryGateway || '');
  }
  return clean(city.gateway || city.railGateway || city.accessStation || '');
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
  const destId = city?.id ?? 'unknown';
  if (!departure) console.error('[transport] departure missing:', destId);
  if (!city) console.error('[transport] city missing');

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
  if (!segments.length && !mapOnlyFallback) {
    console.warn('[transport] segments empty:', destId, '@', departure);
  }
  // 交通セグメントのみでwaypoints構築（徒歩・観光巡回を除外）
  const transportSegs = segments.filter(s => !['walk', 'local_bus'].includes(s.type) || /空港|港|駅/.test(s.to));
  const waypoints = transportSegs.length > 0
    ? [...new Set([transportSegs[0].from, ...transportSegs.map(s => s.to)])]
    : [departure, city?.displayName || city?.name].filter(Boolean);

  // finalAccess: 最寄駅→目的地の最終アクセス手段（構造化オブジェクト）
  const finalAccess = typeof city?.finalAccess === 'object'
    ? city.finalAccess
    : { type: city?.finalAccess ?? 'walk' };
  const repStation = city?.representativeStation ?? null;

  // ⑩ segments ベースで transportType を再判定（BFS 由来の誤判定を補正）
  const classifiedType = classifyTransport(segments);

  // ⑪ JRチェーンCTA + 表示用ルート（showFinalAccessはjrChainCta構築後に判定）
  const jrChainCta = buildJRChainCta(segments);
  const showFinalAccess = shouldShowFinalAccessFromSegments(segments, jrChainCta);
  if (jrChainCta && !jrChainCta.to) {
    console.error('[CTA] to missing:', destId, '@', departure);
  }
  // CTA の to を駅/市に正規化（観光スポット名のみを排除）
  // 実在駅名（加賀温泉駅、松島海岸駅、角館駅、河口湖駅など）は除外
  if (jrChainCta) {
    const cleanTo = jrChainCta.to?.replace(/駅$|空港$|港$/, '') ?? '';
    const repClean = repStation?.replace(/駅$|空港$|港$/, '') ?? '';
    const destClean = (city?.displayName || city?.name || '').replace(/駅$|空港$|港$/, '');
    // 既にrepStationまたはdisplayNameと一致 → 正しい駅名なので補正不要
    const isKnownStation = cleanTo === repClean || cleanTo === destClean;
    // 温泉/寺/神社/館/湖/港 等はisKnownStationガードで実在駅名を保護しつつ検出
    const SPOT_PATTERN = /温泉|海岸|海水浴|公園$|城$|城跡|神社$|神宮$|大社$|寺$|古墳|観音|大仏$|大橋$|半島$|岬$|滝$|湖$|渓谷|キャンプ|ラーメン|うどん|グルメ|ミュージアム|ロード|館$|市場$|港$/;
    if (!isKnownStation && SPOT_PATTERN.test(cleanTo)) {
      console.warn('[CTA] 観光地名を検出・駅名に補正:', cleanTo, '→', repStation || city?.displayName || city?.name);
      jrChainCta.to = repStation || city?.displayName || city?.name || jrChainCta.to;
    }
  }
  const displayRoute = buildDisplayRoute(departure, city, waypoints);
  const islandDisplayType = resolveIslandDisplayType(city);

  // ⑪ CTA到達点（bookableセグメントがない場合のフォールバック用）
  const ctaDestination = resolveCtaDestination(city, cta);

  return {
    /* ── UI用データ（⑦ bestRoute / alternatives 形式） ── */
    bestRoute: {
      transportType: classifiedType,
      accessType,
      distanceKm,
      reason: selectionReason,
      segments,
      waypoints,
      finalAccess,
      showFinalAccess,
      representativeStation: repStation,
      jrChainCta,
      displayRoute,
      islandDisplayType,
      ctaDestination,
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
