/**
 * providerResolver.js — JR 予約プロバイダ判定・IC 乗車判定
 * 純関数・DOM 非依存
 * ─────────────────────────────────────────────────────────
 * [dokoiiko / lifetrace 共通ロジック]
 * アルゴリズム部分はプロジェクト間で完全一致を維持する。
 * モジュール形式（export）のみ dokoiiko 版が追加される。
 * ─────────────────────────────────────────────────────────
 */

/* ── JR 会社名 → 予約システム ID ── */
const OPERATOR_PROVIDER = {
  'JR\u6771\u65E5\u672C': 'ekinet',
  'JR\u5317\u6D77\u9053': 'ekinet',
  'JR\u6771\u6D77':       'e5489',
  'JR\u897F\u65E5\u672C': 'e5489',
  'JR\u56DB\u56FD':       'e5489',
  'JR\u4E5D\u5DDE':       'jrkyushu',
};

/**
 * オペレータ名から予約プロバイダを解決する。
 * @param {string} operator
 * @returns {'ekinet'|'e5489'|'jrkyushu'}
 */
export function operatorToProvider(operator) {
  return OPERATOR_PROVIDER[operator] || 'e5489';
}

/* ── 新幹線路線名 → 予約システム ── */
const SHINKANSEN_LINE_PROVIDER = {
  '\u6771\u6D77\u9053\u65B0\u5E79\u7DDA': 'ex',
  '\u5C71\u967D\u65B0\u5E79\u7DDA':       'ex',
};

/**
 * 新幹線ステップの予約プロバイダを判定する。
 * 東海道・山陽 → スマートEX、JR東日本系 → えきねっと、その他 → operatorToProvider
 * @param {{ label?:string, operator?:string }} step
 * @returns {'ex'|'ekinet'|'e5489'|'jrkyushu'}
 */
export function detectShinkansenProvider(step) {
  const label = step.label ?? '';
  if (SHINKANSEN_LINE_PROVIDER[label]) return SHINKANSEN_LINE_PROVIDER[label];
  if (label.includes('\u6771\u6D77\u9053') || label.includes('\u5C71\u967D')) return 'ex';
  return operatorToProvider(step.operator ?? '');
}

/**
 * IC 乗車可能な在来線かどうか判定する（特急・急行・ライナー系は予約必要）。
 * @param {{ label?:string }} step
 * @returns {boolean}
 */
export function isIcRail(step) {
  const label = step.label ?? '';
  return !label.match(/\u7279\u6025|\u6025\u884C|\u30A8\u30AF\u30B9\u30D7\u30EC\u30B9|\u30E9\u30A4\u30CA\u30FC/);
}
