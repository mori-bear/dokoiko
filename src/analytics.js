/**
 * analytics.js — ユーザー行動ログ + GA4計測ブリッジ + エラー検知
 *
 * 構造化ログを収集し、セッション終了時にまとめて出力する。
 * gtag が利用可能な場合は GA4 にもイベントを送信する。
 *
 * ログ種別:
 *   event  — ユーザー行動（CTAクリック、シェア、リトライ）
 *   error  — 本番エラー（CTA欠損、ルート空、地図欠損）
 *   hint   — 改善ヒント（自動検出）
 *
 * GA4 イベントマッピング:
 *   page_view        → view_destination
 *   retry            → retry_destination
 *   cta_click        → cta_click
 *   map_click        → map_click
 *   rakuten_click    → hotel_link_click  (hotel_service: 'rakuten')
 *   jalan_click      → hotel_link_click  (hotel_service: 'jalan')
 *   car_click        → car_click
 *   yahoo_click      → transit_click
 *   share_click      → share             (method: 'image')
 *   share_line_click → share             (method: 'line')
 *   share_copy_click → share             (method: 'copy')
 *   filter_change    → filter_change
 */

const _log = [];
const _errors = [];
let _sessionStart = Date.now();
let _lastScrollY = 0;
let _maxScrollY = 0;

/* ── イベントログ ── */

/**
 * ユーザー行動を記録する。
 * @param {'cta_click'|'map_click'|'hotel_click'|'share_click'|'retry'|'page_view'} event
 * @param {object} data — { type, from, to, destId, ... }
 */
export function trackEvent(event, data = {}) {
  const entry = {
    event,
    ...data,
    timestamp: Date.now(),
  };
  _log.push(entry);

  // GA4 送信（gtag が読み込まれている場合のみ）
  if (typeof gtag === 'function') {
    gtag('event', _toGa4Name(event), _toGa4Params(event, data));
  }
}

/** trackEvent イベント名 → GA4 推奨イベント名 */
function _toGa4Name(event) {
  const MAP = {
    'page_view':        'view_destination',
    'retry':            'retry_destination',
    'cta_click':        'cta_click',
    'map_click':        'map_click',
    'rakuten_click':    'hotel_link_click',
    'jalan_click':      'hotel_link_click',
    'car_click':        'car_click',
    'yahoo_click':      'transit_click',
    'share_click':      'share',
    'share_line_click': 'share',
    'share_copy_click': 'share',
    'filter_change':    'filter_change',
  };
  return MAP[event] ?? event;
}

/** GA4 カスタムパラメータを組み立てる */
function _toGa4Params(event, data) {
  const p = {};
  if (data.from)    p.departure   = data.from;
  if (data.destId)  p.destination = data.destId;
  if (data.destName) p.destination_name = data.destName;
  if (data.stayArea) p.stay_area  = data.stayArea;

  // ホテルリンク種別
  if (event === 'rakuten_click') p.hotel_service = 'rakuten';
  if (event === 'jalan_click')   p.hotel_service = 'jalan';

  // シェア手段
  if (event === 'share_click')      p.method = 'image';
  if (event === 'share_line_click') p.method = 'line';
  if (event === 'share_copy_click') p.method = 'copy';

  // フィルター変更
  if (data.filterType)  p.filter_type  = data.filterType;
  if (data.filterValue !== undefined) p.filter_value = String(data.filterValue);

  return p;
}

/* ── エラー検知 ── */

/**
 * 本番エラーを記録する。
 * @param {'CTA_MISSING'|'ROUTE_EMPTY'|'MAP_TARGET_MISSING'|'TRANSPORT_UNKNOWN'|'HOTEL_LINK_MISSING'} code
 * @param {object} data — { destId, from, ... }
 */
export function reportError(code, data = {}) {
  const entry = {
    code,
    ...data,
    timestamp: Date.now(),
  };
  _errors.push(entry);
  console.error(`[dokoiko:${code}]`, data);
}

/* ── スクロール追跡（離脱位置） ── */

export function initScrollTracking() {
  if (typeof window === 'undefined') return;
  window.addEventListener('scroll', () => {
    _lastScrollY = window.scrollY;
    if (_lastScrollY > _maxScrollY) _maxScrollY = _lastScrollY;
  }, { passive: true });
}

/* ── セッションサマリ ── */

/**
 * セッション中のログをまとめて出力する。
 * ページ離脱時（beforeunload）に呼ぶ。
 */
export function flushSession() {
  if (!_log.length && !_errors.length) return;

  const duration = Math.round((Date.now() - _sessionStart) / 1000);
  const ctaClicks   = _log.filter(e => e.event === 'cta_click').length;
  const mapClicks   = _log.filter(e => e.event === 'map_click').length;
  const hotelClicks = _log.filter(e => e.event === 'hotel_click').length;
  const shareClicks = _log.filter(e => e.event === 'share_click').length;
  const retries     = _log.filter(e => e.event === 'retry').length;
  const pageViews   = _log.filter(e => e.event === 'page_view').length;

  const summary = {
    session: {
      duration,
      maxScrollY: _maxScrollY,
      pageViews,
      retries,
    },
    clicks: { cta: ctaClicks, map: mapClicks, hotel: hotelClicks, share: shareClicks },
    errors: _errors.length,
    errorDetails: _errors,
  };

  console.log('[dokoiko:session]', JSON.stringify(summary));

  // 改善ヒント自動検出
  const hints = detectHints(summary);
  if (hints.length) {
    console.log('[dokoiko:hints]', hints);
  }
}

/* ── 改善ヒント自動検出 ── */

function detectHints(summary) {
  const hints = [];
  const { clicks, session } = summary;

  // CTA押されていない（地図ばかり）
  if (session.pageViews >= 2 && clicks.cta === 0 && clicks.map > 0) {
    hints.push({ type: 'cta_weak', msg: 'CTA未クリック・地図のみ使用 → CTA文言または位置の見直し' });
  }

  // シェアされない
  if (session.pageViews >= 3 && clicks.share === 0) {
    hints.push({ type: 'share_weak', msg: 'シェア未使用 → テキストまたはボタン位置の見直し' });
  }

  // 高リトライ率
  if (session.retries >= 5) {
    hints.push({ type: 'high_retry', msg: `リトライ${session.retries}回 → 提案精度または表示内容の見直し` });
  }

  // スクロール浅い（CTA到達前に離脱の可能性）
  if (session.maxScrollY > 0 && session.maxScrollY < 300 && session.pageViews >= 1) {
    hints.push({ type: 'shallow_scroll', msg: 'スクロール浅い → ファーストビューの情報不足の可能性' });
  }

  return hints;
}

/* ── beforeunload 自動登録 ── */

export function initAnalytics() {
  _sessionStart = Date.now();
  initScrollTracking();
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushSession);
  }
}
