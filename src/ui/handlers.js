/**
 * イベントハンドラ — event delegation 方式
 *
 * document 上の委任リスナー1本で全ボタンを処理する。
 * bindHandlers() 呼び出しタイミングや DOM 再描画に依存しない。
 *
 * state は src/state.js から直接 import して参照する（引数受け取り禁止）。
 */
import { state }       from '../state.js';
import { trackEvent } from '../analytics.js';

function isResultVisible() {
  return !document.getElementById('result')?.hidden;
}

/** アクティブクラスを切り替えるユーティリティ */
function setActive(selector, activeEl) {
  document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
  activeEl.classList.add('active');
}

export function bindHandlers(onGo, onRetry) {

  /* ── click 委任（ボタン類） ── */
  document.addEventListener('click', (e) => {

    /* 旅の長さ（data-stay） */
    const stayBtn = e.target.closest('[data-stay]');
    if (stayBtn) {
      console.log('[click] data-stay:', stayBtn.dataset.stay);
      state.stayType = stayBtn.dataset.stay;
      setActive('[data-stay]', stayBtn);
      trackEvent('filter_change', { filterType: 'stay', filterValue: state.stayType });
      if (isResultVisible()) onGo();
      return;
    }

    /* テーマ（data-theme） */
    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn) {
      const value = themeBtn.dataset.theme;
      console.log('[click] data-theme:', value || '(こだわらない)');
      state.theme = value || null;
      setActive('[data-theme]', themeBtn);
      trackEvent('filter_change', { filterType: 'theme', filterValue: state.theme ?? 'none' });
      if (isResultVisible()) onGo();
      return;
    }

    /* シチュエーション（data-situation） — 同じボタンを再クリックで解除 */
    const situBtn = e.target.closest('[data-situation]');
    if (situBtn) {
      const value = situBtn.dataset.situation;
      if (state.situation === value) {
        state.situation = null;
        situBtn.classList.remove('active');
      } else {
        state.situation = value;
        setActive('[data-situation]', situBtn);
      }
      console.log('[click] situation:', state.situation);
      trackEvent('filter_change', { filterType: 'situation', filterValue: state.situation ?? 'none' });
      if (isResultVisible()) onGo();
      return;
    }

    /* 地域（data-region） — 同じボタンを再クリックで解除 */
    const regionBtn = e.target.closest('[data-region]');
    if (regionBtn) {
      const value = regionBtn.dataset.region;
      if (state.region === value) {
        state.region = null;
        regionBtn.classList.remove('active');
      } else {
        state.region = value;
        setActive('[data-region]', regionBtn);
      }
      console.log('[click] region:', state.region);
      trackEvent('filter_change', { filterType: 'region', filterValue: state.region ?? 'none' });
      if (isResultVisible()) onGo();
      return;
    }

    /* レンタカー除外（data-exclude-car） */
    const exCarBtn = e.target.closest('[data-exclude-car]');
    if (exCarBtn) {
      state.excludeCar = !state.excludeCar;
      exCarBtn.classList.toggle('active', state.excludeCar);
      console.log('[click] excludeCar:', state.excludeCar);
      trackEvent('filter_change', { filterType: 'exclude_car', filterValue: state.excludeCar });
      if (isResultVisible()) onGo();
      return;
    }

    /* GOボタン */
    if (e.target.closest('#go-btn')) {
      console.log('[click] go-btn');
      onGo();
      return;
    }

    /* リトライボタン（ヘッダー外） */
    if (e.target.closest('#retry-btn')) {
      console.log('[click] retry-btn');
      onRetry();
      return;
    }

    /* 再検索ボタン（カード内インライン） */
    if (e.target.closest('[data-action="retry"]')) {
      console.log('[click] retry-inline');
      onRetry();
      return;
    }
  });

  /* ── キーワード検索（input）── */
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'keyword-search') return;
    state.keyword = e.target.value.trim();
    console.log('[input] keyword:', state.keyword);
    trackEvent('filter_change', { filterType: 'keyword', filterValue: state.keyword || 'empty' });
    if (isResultVisible()) onGo();
  });

  /* ── 出発地セレクト（change）── */
  document.addEventListener('change', (e) => {
    if (e.target.id === 'departure-select') {
      console.log('[change] departure:', e.target.value);
      state.departure = e.target.value;
      localStorage.setItem('departure', e.target.value);
      trackEvent('filter_change', { filterType: 'departure', filterValue: state.departure });
      if (isResultVisible()) onGo();
    }
  });

  /* ── セレクタ検証ログ ── */
  console.log('[bindHandlers] セレクタ検証:',
    'go-btn:', !!document.getElementById('go-btn'),
    'departure-select:', !!document.getElementById('departure-select'),
    'data-stay buttons:', document.querySelectorAll('[data-stay]').length,
    'data-theme buttons:', document.querySelectorAll('[data-theme]').length,
    'data-situation buttons:', document.querySelectorAll('[data-situation]').length,
  );
}
