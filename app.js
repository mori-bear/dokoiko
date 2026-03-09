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
  currentCity:  null,
};

async function init() {
  initIntro();
  bindHandlers(state, go, retry);

  try {
    state.destinations = await loadDestinations();
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
  state.currentCity = buildPool(state.destinations, state.stayType, state.theme, state.departure, nearestHub);
  draw();
}

function retry() {
  go();
  document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function draw() {
  const city = state.currentCity;
  if (!city) return;

  const transportLinks = resolveTransportLinks(city, state.departure);
  const hotelLinks     = buildHotelLinks(city);

  renderResult({ city, transportLinks, hotelLinks });

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
