import { buildPool } from './src/engine/selectionEngine.js';
import { resolveTransportLinks } from './src/transport/transportRenderer.js';
import { buildHotelLinks } from './src/affiliate/hotel.js';
import { renderResult } from './src/ui/render.js';
import { bindHandlers } from './src/ui/handlers.js';
import { DEPARTURE_CITY_INFO } from './src/config/constants.js';
import { loadDestinations } from './src/data/index.js';

const DEFAULT_GUESTS = 2;

const state = {
  destinations: [],
  departure:    '東京',
  stayType:     '1night',
  theme:        null,
  people:       DEFAULT_GUESTS,
  pool:         [],
  poolIndex:    0,
};

async function init() {
  initIntro();
  bindHandlers(state, go, retry);

  try {
    state.destinations = await loadDestinations();
    initTodaysCity();
  } catch (err) {
    const btn = document.getElementById('go-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = err.message.startsWith('[データ整合性エラー]')
        ? err.message
        : 'データ読み込み失敗';
    }
  }
}

function go() {
  if (state.destinations.length === 0) {
    showFormError('データを読み込み中です。しばらくお待ちください。');
    return;
  }
  clearFormError();

  const fromCityInfo = DEPARTURE_CITY_INFO[state.departure];
  const nearestHub   = fromCityInfo?.nearestHub ?? null;
  state.pool      = buildPool(state.destinations, state.stayType, state.theme, state.departure, nearestHub);
  state.poolIndex = 0;
  draw();
}

function retry() {
  if (state.poolIndex >= state.pool.length - 1) {
    const fromCityInfoR = DEPARTURE_CITY_INFO[state.departure];
    const nearestHubR   = fromCityInfoR?.nearestHub ?? null;
    state.pool      = buildPool(state.destinations, state.stayType, state.theme, state.departure, nearestHubR);
    state.poolIndex = 0;
  } else {
    state.poolIndex++;
  }
  draw();
  document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function draw() {
  const city = state.pool[state.poolIndex];
  if (!city) return;

  const transportLinks = resolveTransportLinks(city, state.departure);
  const hotelLinks     = buildHotelLinks(city);

  renderResult({
    city,
    transportLinks,
    hotelLinks,
    poolIndex: state.poolIndex,
    poolTotal: state.pool.length,
  });

  updateRetryBtn();

  const resultEl = document.getElementById('result');
  resultEl.hidden = false;
  if (state.poolIndex === 0) {
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateRetryBtn() {
  const btn     = document.getElementById('retry-btn');
  const countEl = document.getElementById('remaining-count');
  if (!btn) return;
  const { pool, poolIndex } = state;
  const remaining = pool.length - poolIndex - 1;
  if (remaining <= 0) {
    btn.textContent = 'もう一度最初から引く';
    if (countEl) countEl.textContent = '';
  } else {
    btn.textContent = 'もう一回引く';
    if (countEl) countEl.textContent = `あと${remaining}件あります`;
  }
}

/* ── 今日の旅先 ── */

function initTodaysCity() {
  const el = document.getElementById('todays-city');
  if (!el) return;

  const candidates = state.destinations.filter(d =>
    d.type !== 'spot' && d.stayAllowed && d.stayAllowed.length > 0
  );
  if (candidates.length === 0) return;

  const city = candidates[Math.floor(Math.random() * candidates.length)];
  const nameEl   = el.querySelector('.todays-city-name');
  const regionEl = el.querySelector('.todays-city-region');
  if (nameEl)   nameEl.textContent   = city.name;
  if (regionEl) regionEl.textContent = city.region;
  el.hidden = false;
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
