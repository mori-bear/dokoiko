/**
 * イベントハンドラ
 *
 * state は src/state.js から直接 import して参照する（引数受け取り禁止）。
 * stayType / theme 変更時、結果表示中であれば onGo() を呼んで即時再描画する。
 */
import { state } from '../state.js';

function isResultVisible() {
  return !document.getElementById('result')?.hidden;
}

export function bindHandlers(onGo, onRetry) {

  /* ── 旅の長さ（data-stay） ── */
  document.querySelectorAll('[data-stay]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el    = e.currentTarget;
      const value = el.dataset.stay;

      state.stayType = value;

      document.querySelectorAll('[data-stay]').forEach(b => b.classList.remove('active'));
      el.classList.add('active');

      if (isResultVisible()) onGo();
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

      if (isResultVisible()) onGo();
    });
  });

  /* ── レンタカー除外（data-exclude-car） ── */
  const excludeCarBtn = document.querySelector('[data-exclude-car]');
  if (excludeCarBtn) {
    excludeCarBtn.addEventListener('click', () => {
      state.excludeCar = !state.excludeCar;
      excludeCarBtn.classList.toggle('active', state.excludeCar);
      if (isResultVisible()) onGo();
    });
  }

  /* ── 出発地 ── */
  const departureSelect = document.getElementById('departure-select');
  if (departureSelect) {
    departureSelect.addEventListener('change', (e) => {
      state.departure = e.target.value;
      if (isResultVisible()) onGo();
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
}
