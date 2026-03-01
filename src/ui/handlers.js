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

  // 出発日時: date + time を組み合わせて state.datetime ("YYYY-MM-DDTHH:MM") を維持
  const [defaultDate, defaultTime] = state.datetime.split('T');

  const dateInput = document.getElementById('departure-date');
  const timeInput = document.getElementById('departure-time');

  if (dateInput) dateInput.value = defaultDate || '';
  if (timeInput) timeInput.value = defaultTime || '00:00';

  function syncDatetime() {
    const d = dateInput?.value || defaultDate;
    const t = timeInput?.value || defaultTime;
    if (d) state.datetime = `${d}T${t}`;
  }

  if (dateInput) dateInput.addEventListener('change', syncDatetime);
  if (timeInput) timeInput.addEventListener('change', syncDatetime);

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
        updateDistanceButtons(value, state);
        return;
      }

      if (group === 'people') {
        setActive('[data-group="people"]', selBtn);
        state.people = value;
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

/** 日帰り選択時は ★4・★5 を非表示にし、選択中なら解除 */
function updateDistanceButtons(stayType, state) {
  const isDaytrip = stayType === 'daytrip';
  document.querySelectorAll('[data-group="distance"]').forEach((btn) => {
    const dl = parseInt(btn.dataset.value, 10);
    if (isDaytrip && dl >= 4) {
      btn.classList.add('hidden');
      if (state.distance >= 4) {
        btn.classList.remove('active');
        state.distance = null;
      }
    } else {
      btn.classList.remove('hidden');
    }
  });
}
