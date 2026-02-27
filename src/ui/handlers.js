/**
 * イベントハンドラ
 */
export function bindHandlers(state, onGo, onRetry) {
  // 出発地
  document.getElementById('departure-select').addEventListener('change', (e) => {
    state.departure = e.target.value;
  });

  // 距離ボタン
  document.querySelectorAll('[data-group="distance"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActive('[data-group="distance"]', btn);
      state.distanceLevel = parseInt(btn.dataset.value, 10);
    });
  });

  // 予算ボタン
  document.querySelectorAll('[data-group="budget"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setActive('[data-group="budget"]', btn);
      state.budgetLevel = parseInt(btn.dataset.value, 10);
    });
  });

  // GOボタン
  document.getElementById('go-btn').addEventListener('click', onGo);

  // リトライボタン
  document.getElementById('retry-btn').addEventListener('click', onRetry);
}

function setActive(selector, target) {
  document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
  target.classList.add('active');
}
