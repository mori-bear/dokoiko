import { selectDestination } from './src/engine/selectionEngine.js';
import { resolveTransportLinks } from './src/transport/transportRenderer.js';
import { buildHotelLinks } from './src/affiliate/hotel.js';
import { buildExperienceLinks } from './src/affiliate/experience.js';
import { renderResult, clearResult } from './src/ui/render.js';
import { bindHandlers } from './src/ui/handlers.js';
import { DISTANCE_LABELS, BUDGET_LABELS } from './src/config/constants.js';

const state = {
  destinations: [],
  departure: '東京',
  distanceLevel: null,
  budgetLevel: null,
};

async function init() {
  try {
    const res = await fetch('./src/data/destinations.json');
    if (!res.ok) throw new Error('データ読み込み失敗');
    state.destinations = await res.json();
  } catch {
    const btn = document.getElementById('go-btn');
    btn.disabled = true;
    btn.textContent = 'データ読み込み失敗';
    return;
  }

  bindHandlers(state, go, retry);
}

function go() {
  if (state.distanceLevel === null) {
    showFormError('距離を選んでください。');
    return;
  }
  if (state.budgetLevel === null) {
    showFormError('予算を選んでください。');
    return;
  }
  clearFormError();
  draw();
}

function retry() {
  draw();
  document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function draw() {
  const city = selectDestination(
    state.destinations,
    state.departure,
    state.distanceLevel,
    state.budgetLevel
  );

  const transportLinks = resolveTransportLinks(city, state.departure);
  const hotelLinks = buildHotelLinks(city, null);
  const experienceLinks = buildExperienceLinks(city);

  renderResult({
    city,
    transportLinks,
    hotelLinks,
    experienceLinks,
    distanceLabel: DISTANCE_LABELS[state.distanceLevel],
    budgetLabel: BUDGET_LABELS[state.budgetLevel],
  });

  const resultEl = document.getElementById('result');
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  if (el) { el.textContent = msg; el.hidden = false; }
}

function clearFormError() {
  const el = document.getElementById('form-error');
  if (el) { el.hidden = true; el.textContent = ''; }
}

init();
