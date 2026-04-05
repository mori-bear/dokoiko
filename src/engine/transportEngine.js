/**
 * transportEngine.js — 交通ロジック「唯一の真実」
 *
 * 設計原則（絶対ルール）:
 *   1. このファイルの出力のみが正しい交通情報
 *   2. render / steps / gateway は一切ロジックを持たない
 *   3. CTA は engine 内で1回だけ確定する（inject/上書き禁止）
 *   4. 不正なルートは validateRoute で排除する
 *
 * 処理フロー（buildTransportContext）:
 *   ① determineTransportType  — 交通手段タイプ確定
 *   ② distanceKm 計算
 *   ③ scoreTransport          — 現実性スコア（高いほど適切）
 *   ④ validateRoute           — 禁止ルール適用（false = NG）
 *   ⑤ regionGraph BFS         — 地方経路・経由地
 *   ⑥ resolveTransportLinks   — step-group 生成（委譲）
 *   ⑦ buildCanonicalStepGroups — step内 main-cta を engine CTA に一本化
 *   ⑧ buildRouteMapUrl        — Google Maps URL（hubCity 優先）
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
   ① 交通手段タイプ確定
══════════════════════════════════════════════════════ */

/**
 * 目的地・出発地から交通手段タイプを確定する。
 *
 * 判定優先順位:
 *   1. region === '沖縄'                       → flight
 *   2. isIsland + airportGateway + 直行便あり  → flight（石垣・宮古など）
 *   3. isIsland                               → ferry
 *   4. 距離 > 500km && 直行便あり             → flight
 *   5. regionGraph ヒント                     → flight / ferry
 *   6. それ以外                               → rail
 *
 * @param {string} departure — 出発都市名
 * @param {object} city      — destinations.json エントリ
 * @param {number} distKm    — 出発地〜目的地の直線距離（事前計算済み）
 * @returns {'flight'|'ferry'|'rail'}
 */
export function determineTransportType(departure, city, distKm = 0) {
  // 1. 沖縄地方 → 飛行機
  if (city?.region === FLIGHT_ONLY_REGION) return 'flight';

  // 2. 離島で直行便あり → 飛行機
  if ((city?.isIsland === true || city?.destType === 'island') &&
      city?.airportGateway && city?.hasDirectFlight === true) return 'flight';

  // 3. 離島 → フェリー
  if (city?.isIsland === true || city?.destType === 'island') return 'ferry';

  // 4. 距離 + 直行便 → 飛行機
  if (distKm > FLIGHT_DISTANCE_KM && city?.hasDirectFlight === true) return 'flight';

  // 5. regionGraph ヒント（陸路未接続の地方）
  const fromRegion = DEPARTURE_REGION_MAP[departure];
  if (fromRegion && city?.region) {
    const hint = getRegionTransportHint(fromRegion, city.region);
    if (hint.type === 'flight') return 'flight';
    if (hint.type === 'ferry')  return 'ferry';
  }

  return 'rail';
}

/* ══════════════════════════════════════════════════════
   ② スコアリング（強制的に最適手段が勝つ）
══════════════════════════════════════════════════════ */

/**
 * 交通手段タイプと距離から現実性スコアを返す（100 = 最適）。
 *
 * ペナルティ（意図的に極端な値）:
 *   - rail   + 500km超: -70（長距離鉄道は非現実的）
 *   - flight + 300km未満: -60（近距離フライトは非効率）
 *   - ferry             : -20（時間がかかる）
 *
 * 複数候補から最もスコアが高いものを選ぶ場合に使用する。
 *
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {number} distanceKm
 * @returns {number} 0〜100
 */
export function scoreTransport(transportType, distanceKm) {
  let score = 100;
  if (transportType === 'rail'   && distanceKm > 500) score -= 70;
  if (transportType === 'flight' && distanceKm < 300) score -= 60;
  if (transportType === 'ferry')                       score -= 20;
  return Math.max(0, score);
}

/* ══════════════════════════════════════════════════════
   ③ 禁止ルール（最終フィルター）
══════════════════════════════════════════════════════ */

/**
 * ルートが有効かどうかを検証する（false = NG）。
 *
 * 禁止ルール:
 *   - rail:   沖縄、離島、800km超（新幹線圏外）
 *   - flight: 空港情報が一切ない目的地
 *   - ferry:  離島でもフェリー港でもない目的地
 *
 * ⚠️ false は「推奨しない」の意味であり、フォールバック時は無視される場合がある。
 *    沖縄 + rail のみ絶対禁止（新幹線が物理的に存在しない）。
 *
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {object} city        — destinations.json エントリ
 * @param {number} distanceKm  — 直線距離
 * @returns {boolean}
 */
export function validateRoute(transportType, city, distanceKm = 0) {
  switch (transportType) {
    case 'rail':
      if (city?.region === FLIGHT_ONLY_REGION) return false;   // 沖縄: 絶対NG
      if (city?.isIsland === true)              return false;   // 離島: 鉄道でたどり着けない
      if (distanceKm > 800)                    return false;   // 800km超: 長距離すぎる
      return true;

    case 'flight':
      // 空港情報が一切ない → flight CTA が生成できない
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      return true;

    case 'ferry':
      // 離島でもフェリー港もない → ferry CTA が生成できない
      if (city?.isIsland !== true && !city?.ferryGateway) return false;
      return true;

    default:
      return true;
  }
}

/* ══════════════════════════════════════════════════════
   ④ CTA 完全一本化（engine 内で1回だけ確定）
══════════════════════════════════════════════════════ */

/**
 * step-group 配列の main-cta を engine の正とする CTA で一本化する。
 *
 * 処理:
 *   - canonicalCta がある場合: step 由来の main-cta を除去し、engine CTA を挿入
 *   - canonicalCta が null かつ rail: step 由来を維持（provider 精度が高い）
 *   - canonicalCta が null かつ flight/ferry: step 由来を除去（誤った JR CTA を防ぐ）
 *
 * @param {Array}       rawStepGroups  — resolveTransportLinks の生出力
 * @param {object|null} canonicalCta   — ctaResolver が返した CTA（null の場合あり）
 * @param {'flight'|'ferry'|'rail'} transportType
 * @returns {Array}
 */
function buildCanonicalStepGroups(rawStepGroups, canonicalCta, transportType) {
  if (canonicalCta) {
    // CTA 確定済み: step 由来を除去して engine CTA を挿入
    const stripped   = rawStepGroups.filter(item => item.type !== 'main-cta');
    const result     = [...stripped];
    const summaryIdx = result.findIndex(i => i.type === 'summary');
    const insertAt   = summaryIdx >= 0 ? summaryIdx + 1 : 0;
    result.splice(insertAt, 0, { type: 'main-cta', cta: canonicalCta });
    return result;
  }

  // CTA が null の場合
  if (transportType === 'rail') {
    // rail: step 由来の CTA を維持（_deriveMainCtaFromSteps が JR provider を正確に判定）
    // 例: railProvider=null の北海道目的地でも出発地の jrArea から正しい provider を導出できる
    return rawStepGroups;
  }

  // flight/ferry で CTA null: step 由来の誤った JR CTA を排除する
  return rawStepGroups.filter(item => item.type !== 'main-cta');
}

/* ══════════════════════════════════════════════════════
   ⑤ メインエントリーポイント
══════════════════════════════════════════════════════ */

/**
 * 出発地・目的地から交通コンテキストを構築する（唯一の真実）。
 *
 * 返り値:
 *   transportType — 確定した交通手段（flight / ferry / rail）
 *   distanceKm    — 直線距離
 *   score         — 現実性スコア（0〜100）
 *   valid         — 禁止ルール通過フラグ（false = 推奨外）
 *   regionPath    — 地方経路（['関東','中部','近畿','中国','九州']など）
 *   via           — 経由地（hubCity → gatewayHub の順）
 *   stepGroups    — engine CTA 確定済み step-group 配列
 *   cta           — 確定した CTA オブジェクト（stepGroups の main-cta と同一）
 *   mapUrl        — Google Maps URL（hubCity 優先・駅名ベース・緯度経度禁止）
 *
 * @param {string} departure — 出発都市名（'東京'など）
 * @param {object} city      — destinations.json エントリ
 * @returns {object}
 */
export function buildTransportContext(departure, city) {
  /* ① 距離計算（type 判定にも使う） */
  const depCoords  = DEPARTURE_COORDS[departure];
  const distanceKm = depCoords && city?.lat && city?.lng
    ? Math.round(calcDistanceKm(depCoords, city))
    : 0;

  /* ② 交通手段タイプ確定 */
  const transportType = determineTransportType(departure, city, distanceKm);

  /* ③ スコアリング */
  const score = scoreTransport(transportType, distanceKm);

  /* ④ バリデーション */
  const valid = validateRoute(transportType, city, distanceKm);

  /* ⑤ 地方経路 */
  const fromRegion = DEPARTURE_REGION_MAP[departure] ?? null;
  const regionPath = fromRegion && city?.region
    ? findRegionPath(fromRegion, city.region)
    : null;

  /* ⑥ 経由地（hubCity を優先）
   *    hubCity: 明示的なハブ都市（例: 境港 → 米子）
   *    gatewayHub: BFS で自動検出されたゲートウェイ
   */
  const via = city?.hubCity ?? city?.gatewayHub ?? null;

  /* ⑦ step-group 生成（既存エンジンに委譲） */
  const rawStepGroups = resolveTransportLinks(city, departure);

  /* ⑧ CTA 確定（engine が唯一の発行元）
   *    step 由来の main-cta は buildCanonicalStepGroups で除去・置換される
   */
  const cta        = resolveCtaByType(transportType, departure, city);
  const stepGroups = buildCanonicalStepGroups(rawStepGroups, cta, transportType);

  /* ⑨ Google Maps URL
   *    hubCity がある場合は hub を目的地とする（例: 境港 → 米子）
   *    理由: Maps のルートを現実的なハブ都市までにする方が自然
   */
  const mapUrl = buildRouteMapUrl(departure, city, via ?? null);

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
