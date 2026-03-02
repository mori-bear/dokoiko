import { buildPool } from './src/engine/selectionEngine.js';
import { resolveTransportLinks } from './src/transport/transportRenderer.js';
import { buildHotelLinks } from './src/affiliate/hotel.js';
import { renderResult } from './src/ui/render.js';
import { bindHandlers } from './src/ui/handlers.js';
import { DISTANCE_LABELS } from './src/config/constants.js';

const state = {
  destinations: [],
  departure:    '東京',
  distance:     null,
  stayType:     null,
  datetime:     buildDefaultDatetime(),
  people:       '1',
  pool:         [],
  poolIndex:    0,
};

async function init() {
  initIntro();
  bindHandlers(state, go, retry);

  try {
    const res = await fetch('./src/data/destinations.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.destinations = await res.json();
  } catch {
    const btn = document.getElementById('go-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'データ読み込み失敗';
    }
  }
}

function go() {
  if (state.distance === null) {
    showFormError('距離を選んでください。');
    return;
  }
  if (state.stayType === null) {
    showFormError('日帰り・宿泊を選んでください。');
    return;
  }
  if (state.destinations.length === 0) {
    showFormError('データを読み込み中です。しばらくお待ちください。');
    return;
  }
  clearFormError();

  state.pool      = buildPool(state.destinations, state.departure, state.distance, state.stayType);
  state.poolIndex = 0;
  draw();
}

function retry() {
  if (state.poolIndex >= state.pool.length - 1) {
    state.pool      = buildPool(state.destinations, state.departure, state.distance, state.stayType);
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

  const transportLinks = resolveTransportLinks(city, state.departure, state.datetime);
  const searchName     = resolveHotelSearchName(city, state.destinations);
  const hotelLinks     = buildHotelLinks(city, state.stayType, searchName);

  renderResult({
    city,
    transportLinks,
    hotelLinks,
    distanceLabel: DISTANCE_LABELS[state.distance],
    poolIndex:     state.poolIndex,
    poolTotal:     state.pool.length,
  });

  updateRetryBtn();

  const resultEl = document.getElementById('result');
  resultEl.hidden = false;
  if (state.poolIndex === 0) {
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateRetryBtn() {
  const btn = document.getElementById('retry-btn');
  if (!btn) return;
  const { pool, poolIndex } = state;
  const remaining = pool.length - poolIndex - 1;
  if (remaining <= 0) {
    btn.textContent = 'もう一度最初から引く';
  } else {
    btn.textContent = `引き直す（あと${remaining}件）`;
  }
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  if (el) { el.textContent = msg; el.hidden = false; }
}

function clearFormError() {
  const el = document.getElementById('form-error');
  if (el) { el.hidden = true; el.textContent = ''; }
}

function resolveHotelSearchName(city, destinations) {
  if (city.hotelBase) {
    const hub = destinations.find(d => d.id === city.hotelBase);
    if (hub) return hub.name;
  }
  return city.name;
}

function buildDefaultDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── イントロ演出 ── */

function initIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  // インラインスクリプトで既に非表示になっている場合はスキップ
  if (overlay.style.display === 'none') return;

  // アニメーション終了後にDOMから除去してlocalStorageに記録
  overlay.addEventListener('animationend', () => {
    overlay.remove();
    localStorage.setItem('dokoiko-intro-v1', '1');
  }, { once: true });
}

init();
