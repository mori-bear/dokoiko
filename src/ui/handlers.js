/**
 * イベントハンドラ — イベント委任方式
 *
 * sel-btn / go-btn / retry-btn のクリックはすべて document 委任。
 * DOM再描画後も確実に動作する。
 */
export function bindHandlers(state, onGo, onRetry) {

  /* ── change系（委任不要） ── */

  document.getElementById('departure-select').addEventListener('change', (e) => {
    state.departure = e.target.value;
  });

  /* ── クリック委任（document 一本化） ── */

  document.addEventListener('click', (e) => {

    // sel-btn
    const selBtn = e.target.closest('.sel-btn[data-group]');
    if (selBtn) {
      const { group, value } = selBtn.dataset;

      if (group === 'distance') {
        if (selBtn.classList.contains('hidden')) return;
        setActive('[data-group="distance"]', selBtn);
        state.distance = parseInt(value, 10);
        return;
      }

      if (group === 'stay') {
        setActive('[data-group="stay"]', selBtn);
        state.stayType = value;
        return;
      }

      if (group === 'people') {
        setActive('[data-group="people"]', selBtn);
        state.people = parseInt(value, 10);
        return;
      }
    }

    // GOボタン
    if (e.target.closest('#go-btn')) {
      onGo();
      return;
    }

    // リトライボタン
    if (e.target.closest('#retry-btn')) {
      onRetry();
      return;
    }
  });
}

function setActive(selector, target) {
  document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
  target.classList.add('active');
}

