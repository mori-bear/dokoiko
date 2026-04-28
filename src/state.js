/**
 * グローバル State（シングルトン）
 *
 * app.js / handlers.js / その他全ファイルはここから import して参照する。
 * state オブジェクトそのものを再代入しない（プロパティ更新のみ）。
 */
export const state = {
  destinations: [],
  departure:    '東京',
  stayType:     '1night',
  theme:        null,
  situation:    null,
  excludeCar:   false,
  pool:         [],
  poolIndex:    0,
  lastTransportContext: null,

  /**
   * CTA表示順パターン（ABテスト用）
   *   'A' — 地図 → 予約CTA → 宿（デフォルト）
   *   'B' — 予約CTA → 地図 → 宿
   */
  ctaOrder: 'A',
};
