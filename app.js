import { buildShuffledPool } from './src/engine/selectionEngine.js';
import { resolveTransportLinks } from './src/features/dokoiko/transportRenderer.js';
import { buildHotelLinks } from './src/hotel/hotelLinkBuilder.js';
import { renderResult } from './src/features/dokoiko/render.js';
import { bindHandlers } from './src/ui/handlers.js';
import { DEPARTURE_CITY_INFO } from './src/config/constants.js';
import { loadDestinations } from './src/data/index.js';
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
  detectDeparture();

  try {
    state.destinations = await loadDestinations();
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

  const hotelLinks = buildHotelLinks(city);

  renderResult({ city, transportLinks, hotelLinks, stayType: state.stayType, departure: state.departure });

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

/* ── 出発地 自動検出（現在地 → 東京 → 大阪 フォールバック） ── */

/** 各出発地の代表座標 */
const DEPARTURE_COORDS = {
  '札幌':  [43.068, 141.351], '函館': [41.773, 140.729], '旭川': [43.770, 142.365],
  '仙台':  [38.260, 140.882], '盛岡': [39.703, 141.153],
  '東京':  [35.681, 139.767], '横浜': [35.444, 139.638], '千葉': [35.605, 140.123],
  '大宮':  [35.906, 139.624], '宇都宮': [36.555, 139.883],
  '長野':  [36.651, 138.181], '静岡': [34.977, 138.383], '名古屋': [35.170, 136.882],
  '金沢':  [36.561, 136.656], '富山': [36.695, 137.213],
  '大阪':  [34.702, 135.496], '京都': [35.011, 135.768], '神戸': [34.691, 135.195],
  '奈良':  [34.685, 135.805],
  '広島':  [34.396, 132.459], '岡山': [34.655, 133.919], '松江': [35.472, 133.051],
  '高松':  [34.340, 134.043], '松山': [33.839, 132.765], '高知': [33.559, 133.531],
  '徳島':  [34.065, 134.554],
  '福岡':  [33.590, 130.421], '熊本': [32.789, 130.741], '鹿児島': [31.596, 130.557],
  '長崎':  [32.745, 129.873], '宮崎': [31.911, 131.424],
};

function nearestDeparture(lat, lng) {
  let best = '東京', bestDist = Infinity;
  for (const [city, [clat, clng]] of Object.entries(DEPARTURE_COORDS)) {
    const d = Math.hypot(lat - clat, lng - clng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

function setDeparture(city) {
  const sel = document.getElementById('departure-select');
  if (!sel) return;
  if ([...sel.options].some(o => o.value === city)) {
    sel.value = city;
    state.departure = city;
  }
}

function detectDeparture() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const city = nearestDeparture(pos.coords.latitude, pos.coords.longitude);
      // ユーザーがまだ操作していない場合のみ上書き（デフォルト東京のまま）
      if (state.departure === '東京') setDeparture(city);
    },
    () => {
      // 拒否・エラー → 東京のまま（フォールバック済み）
    },
    { timeout: 5000, maximumAge: 60000 }
  );
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
