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

      if (group === 'stay') {
        setActive('[data-group="stay"]', selBtn);
        state.stayType = value;
        return;
      }

      if (group === 'theme') {
        setActive('[data-group="theme"]', selBtn);
        // value='' は「こだわらない」= テーマなし
        state.theme = value || null;
        return;
      }

      if (group === 'situation') {
        setActive('[data-group="situation"]', selBtn);
        state.situation = value;
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

    // attr-tab（宿の一人旅/カップル/友達タブ切り替え）
    const attrTab = e.target.closest('.attr-tab[data-attr]');
    if (attrTab) {
      const stayBlock = attrTab.closest('.stay-block');
      stayBlock.querySelectorAll('.attr-tab').forEach(t => t.classList.remove('active'));
      attrTab.classList.add('active');
      stayBlock.querySelectorAll('.attr-panel').forEach(p => {
        p.hidden = p.dataset.panel !== attrTab.dataset.attr;
      });
      return;
    }

  });
}

function setActive(selector, target) {
  document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
  target.classList.add('active');
}
