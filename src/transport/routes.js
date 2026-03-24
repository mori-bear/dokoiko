/**
 * routes.js — 交通ステップ型定義・ユーティリティ
 * 純関数・DOM 非依存
 * ─────────────────────────────────────────────────────────
 * [dokoiiko / lifetrace 共通ロジック]
 * アルゴリズム部分はプロジェクト間で完全一致を維持する。
 * モジュール形式（export）のみ dokoiiko 版が追加される。
 * ─────────────────────────────────────────────────────────
 */

/** 交通ステップのタイプ定数 */
export const STEP_TYPE = {
  SHINKANSEN:  'shinkansen',
  RAIL:        'rail',
  FLIGHT:      'flight',
  FERRY:       'ferry',
  BUS:         'bus',
  CAR:         'car',
  LOCAL_MOVE:  'localMove',
  TRANSFER:    'transfer',
  GOOGLE_MAPS: 'google-maps',
};

/** 交通タイプの日本語ラベル */
export const STEP_TYPE_LABEL = {
  shinkansen: '新幹線',
  rail:       '電車',
  flight:     '飛行機',
  ferry:      'フェリー',
  bus:        'バス',
  car:        'レンタカー',
  localMove:  'ローカル移動',
  transfer:   '乗換',
  'google-maps': 'Googleマップ',
};

/** 交通タイプの絵文字 */
export const STEP_TYPE_EMOJI = {
  shinkansen: '🚄',
  rail:       '🚃',
  flight:     '✈',
  ferry:      '🚢',
  bus:        '🚌',
  car:        '🚗',
  localMove:  '📍',
  transfer:   '🚶',
};

/**
 * 交通タイプの日本語ラベルを返す。
 * @param {string} type
 * @returns {string}
 */
export function stepTypeLabel(type) {
  return STEP_TYPE_LABEL[type] ?? '';
}

/**
 * 交通タイプの絵文字を返す。
 * @param {string} type
 * @returns {string}
 */
export function stepTypeEmoji(type) {
  return STEP_TYPE_EMOJI[type] ?? '🚃';
}

/**
 * ステップオブジェクトを生成するファクトリ関数。
 * @param {string} from
 * @param {string} to
 * @param {string} type
 * @param {Object} [extra] - operator, label, ferryUrl など
 * @returns {Object}
 */
export function makeStep(from, to, type, extra = {}) {
  return { from, to, type, ...extra };
}
