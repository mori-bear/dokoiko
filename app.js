import { buildShuffledPool } from './src/engine/selectionEngine.js';
import { resolveTransportLinks, initTransportGraph } from './src/transport/transportRenderer.js';
import { buildHotelLinks } from './src/hotel/hotelLinkBuilder.js';
import { renderResult } from './src/ui/render.js';
import { bindHandlers } from './src/ui/handlers.js';
import { DEPARTURE_CITY_INFO } from './src/config/constants.js';
import { loadDestinations } from './src/data/index.js';
import { initMap, updateMapDeparture } from './src/ui/mapView.js';

const state = {
  destinations: [],
  departure:    '東京',
  stayType:     '1night',
  theme:        null,
  pool:         [],
  poolIndex:    0,
};

async function init() {
  initIntro();
  bindHandlers(state, go, retry);

  // 出発地変更時にマップを更新
  document.getElementById('departure-select')?.addEventListener('change', (e) => {
    updateMapDeparture(e.target.value);
  });

  try {
    const [destinations, graphRes] = await Promise.all([
      loadDestinations(),
      fetch('./src/data/transportGraph.json').then(r => r.json()).catch(() => null),
    ]);
    state.destinations = destinations;
    if (graphRes) initTransportGraph(graphRes);
    initMap(destinations, state.departure);
  } catch (err) {
    const btn = document.getElementById('go-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = err.message?.startsWith('[データ整合性エラー]')
        ? err.message
        : 'データ読み込み失敗';
    }
  }
}

function buildPool() {
  const fromCityInfo = DEPARTURE_CITY_INFO[state.departure];
  const nearestHub   = fromCityInfo?.nearestHub ?? null;
  state.pool      = buildShuffledPool(state.destinations, state.stayType, state.theme, state.departure, nearestHub);
  state.poolIndex = 0;
}

function go() {
  if (state.destinations.length === 0) {
    showFormError('データを読み込み中です。しばらくお待ちください。');
    return;
  }
  clearFormError();
  buildPool();
  draw();
}

function retry() {
  state.poolIndex++;
  if (state.poolIndex >= state.pool.length) {
    buildPool(); // reshuffle
  }
  draw();
  document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function draw() {
  const city = state.pool[state.poolIndex];
  if (!city) return;

  const transportLinks = resolveTransportLinks(city, state.departure);
  const hotelLinks     = buildHotelLinks(city);

  renderResult({ city, transportLinks, hotelLinks, stayType: state.stayType });

  const remaining = state.pool.length - state.poolIndex - 1;
  const retryBtn  = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.textContent = remaining > 0
      ? `引き直す（あと${remaining}件）`
      : 'もう一度最初から引く';
  }

  const resultEl = document.getElementById('result');
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── フォームエラー ── */

function showFormError(msg) {
  const el = document.getElementById('form-error');
  if (el) { el.textContent = msg; el.hidden = false; }
}

function clearFormError() {
  const el = document.getElementById('form-error');
  if (el) { el.hidden = true; el.textContent = ''; }
}

/* ── イントロ演出（毎回表示） ── */

function initIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  overlay.addEventListener('animationend', () => {
    overlay.remove();
  }, { once: true });
}

init();
