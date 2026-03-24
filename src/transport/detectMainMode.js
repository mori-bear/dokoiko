/**
 * detectMainMode.js — 交通モード判定・スコアリング
 * 純関数・DOM 非依存
 * ─────────────────────────────────────────────────────────
 * [dokoiiko / lifetrace 共通ロジック]
 * アルゴリズム部分はプロジェクト間で完全一致を維持する。
 * モジュール形式（export）のみ dokoiiko 版が追加される。
 * ─────────────────────────────────────────────────────────
 */

/**
 * エッジから交通モードを判定する。
 * @param {Object} edge - {type?, railwayKey?}
 * @returns {'shinkansen'|'flight'|'ferry'|'bus'|'rail'|'transfer'|'local'}
 */
export function detectMainMode(edge) {
  if (!edge) return 'local';
  if (edge.type === 'transfer')   return 'transfer';
  if (edge.type === 'shinkansen') return 'shinkansen';
  if (edge.type === 'flight')     return 'flight';
  if (edge.type === 'ferry')      return 'ferry';
  if (edge.type === 'bus')        return 'bus';
  if (edge.type === 'car')        return 'car';
  const key = (edge.railwayKey || '').toLowerCase();
  if (key.includes('shinkansen') || key.includes('\u65B0\u5E79\u7DDA')) return 'shinkansen';
  if (edge.type === 'rail') return 'rail';
  return 'local';
}

/**
 * 交通モードごとのスコアリング（0〜100）。
 * @param {string} mode - 'shinkansen'|'flight'|'car'|'local'|'bus'|'ferry'|'rail'|'transfer'
 * @param {number} distanceKm
 * @returns {number}
 */
export function scoreTransport(mode, distanceKm) {
  const BASE  = { shinkansen: 90, flight: 85, car: 70, local: 60, rail: 60, bus: 50, ferry: 40, transfer: 30 };
  const SPEED = { shinkansen: 250, flight: 800, car: 80, local: 60, rail: 60, bus: 50, ferry: 30, transfer: 5 };
  const base  = BASE[mode]  ?? 50;
  const speed = SPEED[mode] ?? 60;
  const timeHours   = distanceKm / speed;
  const timePenalty = Math.max(0, (timeHours - 3) * 5);
  return Math.max(0, Math.min(100, base - timePenalty));
}
