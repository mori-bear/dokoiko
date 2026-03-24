/**
 * イベントハンドラ
 *
 * state は src/state.js から直接 import して参照する（引数受け取り禁止）。
 * UI 操作のたびに console.log で state を記録する。
 */
import { state } from '../state.js';

export function bindHandlers(onGo, onRetry) {

  /* ── 旅の長さ（data-stay） ── */
  document.querySelectorAll('[data-stay]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el    = e.currentTarget;
      const value = el.dataset.stay;

      state.stayType = value;

      document.querySelectorAll('[data-stay]').forEach(b => b.classList.remove('active'));
      el.classList.add('active');

      console.log('[UI] stayType:', state.stayType);
    });
  });

  /* ── テーマ（data-theme） ── */
  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el    = e.currentTarget;
      const value = el.dataset.theme;

      // value='' は「こだわらない」= null
      state.theme = value || null;

      document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
      el.classList.add('active');

      console.log('[UI] theme:', state.theme);
    });
  });

  /* ── 出発地 ── */
  const departureSelect = document.getElementById('departure-select');
  if (departureSelect) {
    departureSelect.addEventListener('change', (e) => {
      state.departure = e.target.value;
      console.log('[UI] departure:', state.departure);
    });
  }

  /* ── GOボタン ── */
  document.getElementById('go-btn')?.addEventListener('click', () => {
    onGo();
  });

  /* ── リトライボタン（委任: DOM再描画後も有効） ── */
  document.addEventListener('click', (e) => {
    if (e.target.closest('#retry-btn')) {
      onRetry();
    }
  });

  /* ── Task7: 委任フォールバック（直接バインド失敗時の保険） ── */
  document.addEventListener('click', (e) => {
    const stayBtn = e.target.closest('[data-stay]');
    if (stayBtn && stayBtn.dataset.stay !== undefined) {
      // 直接バインドが動いていれば state は既に更新済み（二重更新だが同値なので無害）
      if (state.stayType !== stayBtn.dataset.stay) {
        state.stayType = stayBtn.dataset.stay;
        console.log('[UI fallback] stayType:', state.stayType);
      }
    }

    const themeBtn = e.target.closest('[data-theme]');
    if (themeBtn && 'theme' in themeBtn.dataset) {
      const val = themeBtn.dataset.theme || null;
      if (state.theme !== val) {
        state.theme = val;
        console.log('[UI fallback] theme:', state.theme);
      }
    }
  });
}
