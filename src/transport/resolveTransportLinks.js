/**
 * resolveTransportLinks.js — 交通ステップ → リンクオブジェクト変換
 * 純関数・DOM 非依存
 * ─────────────────────────────────────────────────────────
 * [dokoiiko / lifetrace 共通ロジック]
 * アルゴリズム部分はプロジェクト間で完全一致を維持する。
 * モジュール形式（export）のみ dokoiiko 版が追加される。
 * ─────────────────────────────────────────────────────────
 */

/**
 * Google Maps 経路 URL を生成する。
 * @param {string} origin
 * @param {string} destination
 * @param {'transit'|'driving'|'walking'} mode
 * @returns {string}
 */
export function googleMapsUrl(origin, destination, mode) {
  return 'https://www.google.com/maps/dir/?api=1'
    + '&origin='      + encodeURIComponent(origin)
    + '&destination=' + encodeURIComponent(destination)
    + '&travelmode='  + mode;
}

/**
 * 出発・到着から Google Maps（transit）リンクオブジェクトを生成する。
 * @param {string} from
 * @param {string} to
 * @param {string} [label]
 * @returns {{ type: 'google-maps', label: string, url: string }}
 */
export function buildGoogleMapsStep(from, to, label) {
  return {
    type:  'google-maps',
    label: label ?? `📍 ${from} → ${to}（Googleマップ）`,
    url:   googleMapsUrl(from, to, 'transit'),
  };
}

/**
 * ステップ配列から Google Maps リンク配列を生成する（シンプル変換）。
 * UI 固有の CTA 生成は各プロジェクトの renderer が担う。
 * @param {Array<{from?:string, to?:string, type:string}>} steps
 * @returns {Array<{ type: string, label: string, url: string }>}
 */
export function resolveTransportLinks(steps) {
  return steps
    .filter(s => s.from && s.to)
    .map(s => buildGoogleMapsStep(s.from, s.to));
}
