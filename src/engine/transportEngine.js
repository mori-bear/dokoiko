/**
 * transportEngine.js — 交通ロジックの統合エンジン（唯一の正）
 *
 * 設計原則:
 *   - このファイルが返す transportType / cta を唯一の正とする
 *   - render.js は結果を表示するだけ（交通手段の再判定禁止）
 *   - CTA は ctaResolver に一元化し、steps からの推測を上書きする
 *
 * 責務:
 *   1. 交通手段タイプの確定（determineTransportType）
 *   2. スコアリングで妥当性を検証（scoreTransport）
 *   3. 禁止ルールでNG判定を除去（validateRoute）
 *   4. step-group 配列の生成（resolveTransportLinks 委譲）
 *   5. main-cta を engine の canonical CTA で上書き（injectCanonicalCta）
 *   6. Google Maps URL の生成（buildRouteMapUrl 委譲）
 *   7. 地方経路の計算（regionGraph BFS）
 *
 * 判定優先順位（determineTransportType）:
 *   1. region === '沖縄' → flight
 *   2. isIsland + airportGateway + hasDirectFlight → flight（石垣・宮古など）
 *   3. isIsland → ferry
 *   4. 距離 > 500km && hasDirectFlight → flight
 *   5. regionGraph ヒント → flight / ferry
 *   6. それ以外 → rail
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
const FLIGHT_DISTANCE_KM = 500;
const FLIGHT_ONLY_REGION = '沖縄';

/* ══════════════════════════════════════════════════════
   1. 交通手段タイプ確定
══════════════════════════════════════════════════════ */

/**
 * 目的地・出発地から交通手段タイプを確定する。
 * destinations.json の region / isIsland / hasDirectFlight フィールドを優先し、
 * 距離・regionGraph で補完する。
 *
 * @param {string} departure — 出発都市名
 * @param {object} city      — destinations.json エントリ
 * @returns {'flight'|'ferry'|'rail'}
 */
export function determineTransportType(departure, city) {
  // 1. 沖縄地方 → 飛行機（新幹線が存在しない）
  if (city?.region === FLIGHT_ONLY_REGION) return 'flight';

  // 2. 離島で直行便あり → 飛行機（石垣・宮古・奄美など）
  if ((city?.isIsland === true || city?.destType === 'island') &&
      city?.airportGateway && city?.hasDirectFlight === true) return 'flight';

  // 3. 離島 → フェリー
  if (city?.isIsland === true || city?.destType === 'island') return 'ferry';

  // 4. 距離 + 直行便 → 飛行機
  const depCoords = DEPARTURE_COORDS[departure];
  const distKm    = depCoords && city?.lat && city?.lng
    ? calcDistanceKm(depCoords, city)
    : 0;
  if (distKm > FLIGHT_DISTANCE_KM && city?.hasDirectFlight === true) return 'flight';

  // 5. regionGraph ヒント（沖縄・伊豆諸島など陸路未接続の地方）
  const fromRegion = DEPARTURE_REGION_MAP[departure];
  if (fromRegion && city?.region) {
    const hint = getRegionTransportHint(fromRegion, city.region);
    if (hint.type === 'flight') return 'flight';
    if (hint.type === 'ferry')  return 'ferry';
  }

  return 'rail';
}

/* ══════════════════════════════════════════════════════
   2. スコアリング
══════════════════════════════════════════════════════ */

/**
 * 交通手段タイプと距離から適切さをスコアリングする（100 = 最適）。
 *
 * ペナルティ:
 *   - rail + 600km超: -50（新幹線でも非現実的な長距離）
 *   - flight + 300km未満: -40（近距離フライトは非効率）
 *   - ferry: -10（所要時間が長い）
 *
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {number} distanceKm — 出発地〜目的地の直線距離
 * @returns {number} 0〜100
 */
export function scoreTransport(transportType, distanceKm) {
  let score = 100;
  if (transportType === 'rail'   && distanceKm > 600) score -= 50;
  if (transportType === 'flight' && distanceKm < 300) score -= 40;
  if (transportType === 'ferry')                       score -= 10;
  return Math.max(0, score);
}

/* ══════════════════════════════════════════════════════
   3. 禁止ルール（バリデーション）
══════════════════════════════════════════════════════ */

/**
 * ルートが有効かどうかを検証する。
 * false を返すルートは使用禁止（次候補へ降格）。
 *
 * 禁止ルール:
 *   - rail: 沖縄目的地（新幹線が存在しない）
 *   - flight: 空港情報が一切ない目的地
 *   - ferry: フェリー港・離島フラグがない目的地
 *
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {object} city — destinations.json エントリ
 * @returns {boolean}
 */
export function validateRoute(transportType, city) {
  switch (transportType) {
    case 'rail':
      // 沖縄で rail は絶対NG
      if (city?.region === FLIGHT_ONLY_REGION) return false;
      return true;
    case 'flight':
      // 空港情報が全くない場合は NG
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      return true;
    case 'ferry':
      // フェリー港も離島フラグもない場合は NG
      if (!city?.ferryGateway && city?.isIsland !== true) return false;
      return true;
    default:
      return true;
  }
}

/* ══════════════════════════════════════════════════════
   4. canonical CTA 注入（engine の正を step-group に反映）
══════════════════════════════════════════════════════ */

/**
 * step-group 配列の main-cta を engine の canonical CTA で上書きする。
 *
 * 上書き方針:
 *   - flight / ferry: engine の CTA が正確なため必ず上書き
 *   - rail: step-derived CTA の方が JR provider が正確なため上書きしない
 *
 * step-group に main-cta が存在しない場合は summary の直後に挿入する。
 *
 * @param {Array}       stepGroups   — resolveTransportLinks の出力
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {object|null} canonicalCta — ctaResolver が返した CTA
 * @returns {Array}
 */
function injectCanonicalCta(stepGroups, transportType, canonicalCta) {
  // rail は step-derived CTA の方が provider 精度が高い → 上書きしない
  if (transportType === 'rail') return stepGroups;
  // canonical CTA が null なら何もしない
  if (!canonicalCta) return stepGroups;

  const hasMainCta = stepGroups.some(i => i.type === 'main-cta');

  if (hasMainCta) {
    // 既存の main-cta を canonical で置換
    return stepGroups.map(item =>
      item.type === 'main-cta' ? { ...item, cta: canonicalCta } : item
    );
  }

  // main-cta が存在しない場合は summary の直後に挿入
  const result     = [...stepGroups];
  const summaryIdx = result.findIndex(i => i.type === 'summary');
  const insertAt   = summaryIdx >= 0 ? summaryIdx + 1 : 0;
  result.splice(insertAt, 0, { type: 'main-cta', cta: canonicalCta });
  return result;
}

/* ══════════════════════════════════════════════════════
   5. メインエントリーポイント
══════════════════════════════════════════════════════ */

/**
 * 出発地・目的地から交通コンテキストを構築する。
 * travelPlan.js → render.js へのデータパイプライン上の唯一の情報源。
 *
 * @param {string} departure — 出発都市名（'東京'など）
 * @param {object} city      — destinations.json エントリ
 * @returns {{
 *   transportType: 'flight'|'ferry'|'rail',
 *   distanceKm: number,
 *   score: number,
 *   valid: boolean,
 *   regionPath: string[]|null,
 *   via: string|null,
 *   stepGroups: Array,
 *   cta: object|null,
 *   mapUrl: string|null,
 * }}
 */
export function buildTransportContext(departure, city) {
  /* ① 交通手段タイプ確定 */
  const transportType = determineTransportType(departure, city);

  /* ② 距離計算 */
  const depCoords = DEPARTURE_COORDS[departure];
  const distanceKm = depCoords && city?.lat && city?.lng
    ? Math.round(calcDistanceKm(depCoords, city))
    : 0;

  /* ③ スコアリング（現実性チェック） */
  const score = scoreTransport(transportType, distanceKm);

  /* ④ バリデーション（禁止ルール） */
  const valid = validateRoute(transportType, city);

  /* ⑤ 地方経路（UI ヒント・経路説明用） */
  const fromRegion = DEPARTURE_REGION_MAP[departure] ?? null;
  const regionPath = fromRegion && city?.region
    ? findRegionPath(fromRegion, city.region)
    : null;

  /* ⑥ hubCity / via（経由地） */
  const via = city?.hubCity
    ?? city?.gatewayHub
    ?? null;

  /* ⑦ step-group 配列（既存エンジンに委譲） */
  const rawStepGroups = resolveTransportLinks(city, departure);

  /* ⑧ canonical CTA 生成・注入 */
  const cta       = resolveCtaByType(transportType, departure, city);
  const stepGroups = injectCanonicalCta(rawStepGroups, transportType, cta);

  /* ⑨ Google Maps URL（駅名ベース・緯度経度禁止） */
  const mapUrl = buildRouteMapUrl(departure, city);

  return {
    transportType,
    distanceKm,
    score,
    valid,
    regionPath,
    via,
    stepGroups,
    cta,
    mapUrl,
  };
}
