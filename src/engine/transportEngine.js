/**
 * transportEngine.js — 交通ロジックの統合エンジン
 *
 * 責務:
 *   1. 交通手段タイプの確定（rail / flight / ferry）
 *   2. 地方経路の計算（regionGraph BFS）
 *   3. step-group 配列の生成（resolveTransportLinks に委譲）
 *   4. CTA の確定（ctaResolver に委譲）
 *   5. Google Maps URL の生成（buildRouteMapUrl に委譲）
 *
 * render.js は buildTransportContext() を呼ぶだけでよい。
 * ロジックの変更はすべてこのファイル以下で完結する。
 *
 * 判定優先順位:
 *   1. railProvider === null → 飛行機（沖縄など鉄道なし）
 *   2. isIsland === true → フェリー
 *   3. region === '沖縄' → 飛行機（railProvider チェックの補完）
 *   4. 直線距離 > 500km && hasDirectFlight → 飛行機
 *   5. それ以外 → 鉄道
 */

import { DEPARTURE_CITY_INFO, DEPARTURE_COORDS } from '../config/constants.js';
import { calcDistanceKm }                         from '../utils/geo.js';
import { CITY_AIRPORT }                           from '../utilities/airportMap.js';
import { resolveTransportLinks }                  from '../transport/resolveTransportLinks.js';
import { resolveCtaByType }                       from './ctaResolver.js';
import { buildRouteMapUrl }                       from '../utils/map/buildRouteMapUrl.js';
import {
  findRegionPath,
  getRegionTransportHint,
  DEPARTURE_REGION_MAP,
} from './regionGraph.js';

/* ── 飛行機距離閾値 ── */
const FLIGHT_DISTANCE_KM = 500;

/* ── 沖縄地方コード（railProvider が未設定でも確実に flight 判定） ── */
const FLIGHT_ONLY_REGION = '沖縄';

/**
 * 目的地・出発地から交通手段タイプを確定する。
 *
 * destinations.json の railProvider フィールドを正とし、
 * 距離・island フラグ・地方を補助判定に使う。
 *
 * @param {string} departure — 出発都市名
 * @param {object} city      — destinations.json エントリ
 * @returns {'flight'|'ferry'|'rail'}
 */
export function determineTransportType(departure, city) {
  // 1. 沖縄地方 → 飛行機
  // （railProvider: null は北海道など未設定の地域にも存在するため region で補完）
  if (city?.region === FLIGHT_ONLY_REGION) return 'flight';

  // 2. 離島で直行便あり → 飛行機（石垣・宮古など）
  if ((city?.isIsland === true || city?.destType === 'island') && city?.airportGateway && city?.hasDirectFlight === true) return 'flight';

  // 3. 離島 → フェリー
  if (city?.isIsland === true || city?.destType === 'island') return 'ferry';

  // 4. 距離 + 直行便 → 飛行機
  const depCoords = DEPARTURE_COORDS[departure];
  const distKm    = depCoords && city?.lat && city?.lng
    ? calcDistanceKm(depCoords, city)
    : 0;
  if (distKm > FLIGHT_DISTANCE_KM && city?.hasDirectFlight === true) return 'flight';

  // 5. regionGraph のヒントも参照（地方隣接グラフで到達不能な場合）
  const fromRegion = DEPARTURE_REGION_MAP[departure];
  if (fromRegion && city?.region) {
    const hint = getRegionTransportHint(fromRegion, city.region);
    if (hint.type === 'flight') return 'flight';
    if (hint.type === 'ferry')  return 'ferry';
  }

  return 'rail';
}

/**
 * 交通コンテキストを構築する。
 * render.js への渡し口として設計。既存の resolveTransportLinks の
 * 出力（step-group 配列）はそのまま引き継ぐ。
 *
 * @param {string} departure — 出発都市名
 * @param {object} city      — destinations.json エントリ
 * @returns {{
 *   transportType: 'flight'|'ferry'|'rail',
 *   regionPath: string[]|null,
 *   stepGroups: Array,
 *   cta: object|null,
 *   mapUrl: string|null,
 * }}
 */
export function buildTransportContext(departure, city) {
  /* ① 交通手段タイプ確定 */
  const transportType = determineTransportType(departure, city);

  /* ② 地方経路（UI ヒント用）*/
  const fromRegion  = DEPARTURE_REGION_MAP[departure] ?? null;
  const regionPath  = fromRegion && city?.region
    ? findRegionPath(fromRegion, city.region)
    : null;

  /* ③ step-group 配列（既存エンジンに委譲）*/
  const stepGroups = resolveTransportLinks(city, departure);

  /* ④ CTA 確定 */
  const cta = resolveCtaByType(transportType, departure, city);

  /* ⑤ Google Maps URL */
  const mapUrl = buildRouteMapUrl(departure, city);

  return {
    transportType,
    regionPath,
    stepGroups,
    cta,
    mapUrl,
  };
}
