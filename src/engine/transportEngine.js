/**
 * transportEngine.js — 交通ロジック「唯一の真実」
 *
 * 設計原則（絶対ルール）:
 *   1. このファイルの出力のみが正しい交通情報
 *   2. render / steps / gateway は一切ロジックを持たない
 *   3. CTA は engine 内で1回だけ確定する（inject/上書き禁止）
 *   4. 不正なルートは validateRoute で排除し、fallback を適用する
 *
 * ── 交通手段選択の優先順位ルール ──────────────────────────────
 *
 * 距離ベース優先順位（出発地〜目的地 直線距離 km）:
 *   0–200 km   : rail 最適（在来線・新幹線）
 *   201–500 km : rail 優先（新幹線圏内）
 *   501–700 km : flight 推奨（直行便あり） / rail は長距離ペナルティ
 *   701 km–    : flight 強く推奨 / rail は低スコア
 *
 * インフラ依存ルール（距離より優先）:
 *   island + airportGateway + hasDirectFlight → flight（直行便あり離島）
 *   island（それ以外）→ ferry
 *   region === '沖縄' → flight（絶対ルール・rail 不可）
 *
 * validateRoute 禁止ルール:
 *   rail:   沖縄・離島・1000km超（新幹線最長区間を超える）
 *   flight: 空港情報なし・150km未満（近距離フライト非現実的）
 *   ferry:  離島でもフェリー港でもない
 *
 * fallback チェーン（valid=false or CTA 生成不可の場合）:
 *   primary type → [flight → rail → ferry] の順で代替を試みる
 *   すべて失敗 → mapOnlyFallback = true（Google Maps のみ表示）
 *
 * hubCity 強制経由:
 *   hubCity / gatewayHub が設定された目的地では Maps URL が hub を目的地とする
 *   remote / mountain / requiresCar 目的地では必ず via を使用する
 *
 * 処理フロー（buildTransportContext）:
 *   ① distanceKm 計算
 *   ② determineTransportType  — 交通手段タイプ確定
 *   ③ scoreTransport          — 現実性スコア（高いほど適切）
 *   ④ validateRoute           — 禁止ルール適用
 *   ⑤ resolveCtaByType        — CTA 確定（engine 唯一の発行元）
 *   ⑥ fallback 解決           — valid=false or CTA null → 代替タイプ試行
 *   ⑦ regionGraph BFS         — 地方経路・経由地
 *   ⑧ resolveTransportLinks   — step-group 生成（委譲）
 *   ⑨ buildCanonicalStepGroups — step 内 main-cta を engine CTA に一本化
 *   ⑩ buildRouteMapUrl        — Google Maps URL（hubCity 優先・駅名ベース）
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
const FLIGHT_DISTANCE_KM    = 500;   // これ以上かつ直行便あり → flight
const FLIGHT_MIN_DISTANCE   = 150;   // これ未満の flight は非現実的（近距離すぎる）
const RAIL_MAX_DISTANCE     = 1000;  // これ以上の rail は長距離すぎる（新幹線最長区間超）
const FLIGHT_ONLY_REGION    = '沖縄';

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
 * 距離ペナルティ（rail）:
 *   800km超: -90 / 600km超: -55 / 400km超: -30 / 200km超: -10
 *
 * 距離ペナルティ（flight）:
 *   150km未満: -80（非現実的） / 300km未満: -40（非効率）
 *
 * ferry: -20（時間がかかる）
 *
 * 現実性ボーナス:
 *   flight + hasDirectFlight: +10 / rail ≤200km: +10 / ferry + isIsland: +15
 *
 * @param {'flight'|'ferry'|'rail'} transportType
 * @param {number} distanceKm
 * @param {object|null} [city] — destinations.json エントリ（ボーナス判定用）
 * @returns {number} 0〜100
 */
export function scoreTransport(transportType, distanceKm, city = null) {
  let score = 100;

  /* 距離ペナルティ（鉄道）— 段階的に加算 */
  if (transportType === 'rail') {
    if      (distanceKm > 800) score -= 90;
    else if (distanceKm > 600) score -= 55;
    else if (distanceKm > 400) score -= 30;
    else if (distanceKm > 200) score -= 10;
    /* ≤ 200km: ペナルティなし（鉄道の最適距離帯） */
  }

  /* 距離ペナルティ（飛行機）*/
  if (transportType === 'flight') {
    if      (distanceKm > 0 && distanceKm < FLIGHT_MIN_DISTANCE) score -= 80; // 近距離フライト: 非現実的
    else if (distanceKm > 0 && distanceKm < 300)                 score -= 40; // 近距離フライト: 非効率
  }

  /* 時間ペナルティ（フェリー）*/
  if (transportType === 'ferry') score -= 20;

  /* 現実性ボーナス */
  if (transportType === 'flight' && city?.hasDirectFlight === true) score += 10;
  if (transportType === 'rail'   && distanceKm > 0 && distanceKm <= 200) score += 10;
  if (transportType === 'ferry'  && city?.isIsland === true)              score += 15;

  return Math.max(0, Math.min(100, score));
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
      if (city?.region === FLIGHT_ONLY_REGION) return false;         // 沖縄: 絶対NG（物理的に不可）
      if (city?.isIsland === true)              return false;         // 離島: 鉄道でたどり着けない
      if (distanceKm > RAIL_MAX_DISTANCE)      return false;         // 1000km超: 新幹線最長区間超
      return true;

    case 'flight':
      // 空港情報が一切ない → flight CTA が生成できない
      if (!city?.airportGateway && !city?.flightHub && city?.hasDirectFlight !== true) return false;
      // 近距離フライト（150km未満）は非現実的: 空港送迎だけで目的地に着く距離
      if (distanceKm > 0 && distanceKm < FLIGHT_MIN_DISTANCE) return false;
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
 *   transportType    — 確定した交通手段（flight / ferry / rail）
 *   distanceKm       — 直線距離
 *   score            — 現実性スコア（0〜100）
 *   valid            — 禁止ルール通過フラグ（false = 推奨外）
 *   isFallback       — fallback 経由で type が変更された場合 true
 *   mapOnlyFallback  — CTA が一切生成できない場合 true（Maps のみ案内）
 *   regionPath       — 地方経路（['関東','中部','近畿','中国','九州']など）
 *   via              — 経由地（hubCity → gatewayHub の順）
 *   stepGroups       — engine CTA 確定済み step-group 配列
 *   cta              — 確定した CTA オブジェクト（stepGroups の main-cta と同一）
 *   mapUrl           — Google Maps URL（hubCity 優先・駅名ベース・緯度経度禁止）
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
  let transportType = determineTransportType(departure, city, distanceKm);

  /* ③ スコアリング（city ボーナス込み） */
  const score = scoreTransport(transportType, distanceKm, city);

  /* ④ バリデーション */
  let valid = validateRoute(transportType, city, distanceKm);

  /* ⑤ CTA 確定（engine が唯一の発行元） */
  let cta = resolveCtaByType(transportType, departure, city);

  /* ⑥ fallback 解決
   *    valid=false または CTA=null の場合、代替タイプを試みる。
   *    優先順: flight → rail → ferry（現在のタイプを除く）
   *    すべて失敗した場合 → mapOnlyFallback = true（Maps のみ案内）
   */
  let isFallback      = false;
  let mapOnlyFallback = false;

  if (!valid || !cta) {
    const FALLBACK_ORDER = ['flight', 'rail', 'ferry'];
    const candidates = FALLBACK_ORDER.filter(t => t !== transportType);
    let resolved = false;

    for (const altType of candidates) {
      if (!validateRoute(altType, city, distanceKm)) continue;
      const altCta = resolveCtaByType(altType, departure, city);
      if (altCta) {
        transportType = altType;
        valid         = true;
        cta           = altCta;
        isFallback    = true;
        resolved      = true;
        break;
      }
    }

    if (!resolved && !cta) {
      // 全タイプで CTA 生成不可 → Maps のみ案内
      mapOnlyFallback = true;
    }
  }

  /* ⑦ 地方経路 */
  const fromRegion = DEPARTURE_REGION_MAP[departure] ?? null;
  const regionPath = fromRegion && city?.region
    ? findRegionPath(fromRegion, city.region)
    : null;

  /* ⑧ 経由地（hubCity を優先）
   *    remote / mountain / requiresCar 目的地では via を必ず使用する
   *    hubCity: 明示的なハブ都市（例: 境港 → 米子）
   *    gatewayHub: BFS で自動検出されたゲートウェイ
   */
  const needsHub = city?.destType === 'remote'
    || city?.destType === 'mountain'
    || city?.requiresCar === true;
  const via = city?.hubCity
    ?? city?.gatewayHub
    ?? (needsHub ? null : null); // hub なし remote は Maps が目的地直行

  /* ⑨ step-group 生成（既存エンジンに委譲） */
  const rawStepGroups = resolveTransportLinks(city, departure);

  /* ⑩ CTA 一本化
   *    step 由来の main-cta は buildCanonicalStepGroups で除去・置換される
   */
  const stepGroups = buildCanonicalStepGroups(rawStepGroups, cta, transportType);

  /* ⑪ Google Maps URL
   *    hubCity がある場合は hub を目的地とする（例: 境港 → 米子）
   *    理由: Maps のルートを現実的なハブ都市までにする方が自然
   */
  const mapUrl = buildRouteMapUrl(departure, city, via ?? null);

  return {
    transportType,
    distanceKm,
    score,
    valid,
    isFallback,
    mapOnlyFallback,
    regionPath,
    via,
    stepGroups,
    cta,
    mapUrl,
  };
}
