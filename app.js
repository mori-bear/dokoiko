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
  stayType:     null,      // 'daytrip' | '1night'
  datetime:     buildDefaultDatetime(),
  people:       '1',
  pool:         [],        // 条件に合う全destinationをシャッフルした配列
  poolIndex:    0,         // 現在表示中のインデックス
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
  if (state.distance === null) {
    showFormError('距離を選んでください。');
    return;
  }
  if (state.stayType === null) {
    showFormError('日帰り・宿泊を選んでください。');
    return;
  }
  clearFormError();

  // プールを再構築（新しい条件で引き直し）
  state.pool      = buildPool(state.destinations, state.departure, state.distance, state.stayType);
  state.poolIndex = 0;

  draw();
}

function retry() {
  if (state.poolIndex >= state.pool.length - 1) {
    // 最後まで見た → プールを再シャッフルして最初から
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

  const transportLinks = resolveTransportLinks(city, state.departure);
  const hotelLinks     = buildHotelLinks(city, state.datetime?.split('T')[0], state.stayType);

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
  if (poolIndex >= pool.length - 1) {
    btn.textContent = 'もう一度最初から引く';
  } else {
    btn.textContent = `引き直す（次は ${poolIndex + 2} / ${pool.length}）`;
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

function buildDefaultDatetime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

init();
