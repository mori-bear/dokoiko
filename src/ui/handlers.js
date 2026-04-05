/**
 * イベントハンドラ — event delegation 方式
 *
 * document 上の委任リスナー1本で全ボタンを処理する。
 * bindHandlers() 呼び出しタイミングや DOM 再描画に依存しない。
 *
 * state は src/state.js から直接 import して参照する（引数受け取り禁止）。
 */
import { state } from '../state.js';

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
      if (isResultVisible()) onGo();
      return;
    }

    /* レンタカー除外（data-exclude-car） */
    const exCarBtn = e.target.closest('[data-exclude-car]');
    if (exCarBtn) {
      state.excludeCar = !state.excludeCar;
      exCarBtn.classList.toggle('active', state.excludeCar);
      console.log('[click] excludeCar:', state.excludeCar);
      if (isResultVisible()) onGo();
      return;
    }

    /* GOボタン */
    if (e.target.closest('#go-btn')) {
      console.log('[click] go-btn');
      onGo();
      return;
    }

    /* リトライボタン */
    if (e.target.closest('#retry-btn')) {
      console.log('[click] retry-btn');
      onRetry();
      return;
    }
  });

  /* ── 出発地セレクト（change）── */
  document.addEventListener('change', (e) => {
    if (e.target.id === 'departure-select') {
      console.log('[change] departure:', e.target.value);
      state.departure = e.target.value;
      if (isResultVisible()) onGo();
    }
  });

  /* ── セレクタ検証ログ ── */
  console.log('[bindHandlers] セレクタ検証:',
    'go-btn:', !!document.getElementById('go-btn'),
    'departure-select:', !!document.getElementById('departure-select'),
    'data-stay buttons:', document.querySelectorAll('[data-stay]').length,
    'data-theme buttons:', document.querySelectorAll('[data-theme]').length,
  );
}
