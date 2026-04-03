import { state }                  from './src/state.js';
import { buildShuffledPool }       from './src/engine/selectionEngine.js';
import { buildTravelPlan }         from './src/features/dokoiko/travelPlan.js';
import { renderResult }            from './src/features/dokoiko/render.js';
import { bindHandlers }            from './src/ui/handlers.js';
import { DEPARTURE_CITY_INFO }     from './src/config/constants.js';
import { loadDestinations }                                  from './src/data/index.js';
import { calculateTravelTimeMinutes, calculateDistanceStars } from './src/engine/distanceCalculator.js';
import {
  decodeUrlParams,
  encodeStateToUrl,
  openXShare,
  copyShareText,
  updatePageMeta,
} from './src/share.js';

async function init() {
  initIntro();
  bindHandlers(go, retry);
  bindShareHandlers();

  // URLパラメータがある場合は位置情報検出をスキップ（URLのfromを優先）
  const urlParams = decodeUrlParams();
  if (!urlParams.dest) detectDeparture();

  try {
    state.destinations = await loadDestinations();
    // URLから状態を復元して自動表示
    if (urlParams.dest) restoreFromUrl(urlParams);
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
  state.pool      = buildShuffledPool(state.destinations, state.stayType, state.theme, state.departure, nearestHub, state.excludeCar);
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

  const plan = buildTravelPlan(city, state.departure);

  renderResult({
    city,
    transportLinks: plan.transportLinks,
    hotelLinks:     plan.hotelLinks,
    stayType:       state.stayType,
    departure:      state.departure,
  });

  // URLとページメタを更新
  encodeStateToUrl(state.departure, state.stayType, state.theme, state.excludeCar, city.id);
  updatePageMeta(city, state.departure);

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

/* ── URLからの状態復元 ── */

function restoreFromUrl(urlParams) {
  const { from, nights, theme, excludeCar, dest } = urlParams;

  // 出発地
  if (from) setDeparture(from);

  // 旅の長さ
  if (nights) {
    state.stayType = nights;
    document.querySelectorAll('[data-stay]').forEach(b => {
      b.classList.toggle('active', b.dataset.stay === nights);
    });
  }

  // テーマ
  const resolvedTheme = theme || null;
  state.theme = resolvedTheme;
  document.querySelectorAll('[data-theme]').forEach(b => {
    b.classList.toggle('active', (b.dataset.theme || null) === resolvedTheme);
  });

  // レンタカー除外
  if (excludeCar) {
    state.excludeCar = true;
    document.querySelector('[data-exclude-car]')?.classList.add('active');
  }

  // プールを構築してdestを先頭に配置
  buildPool();

  // dest IDで目的地を検索（pool内 or 全destinations）
  const idxInPool = state.pool.findIndex(d => d.id === dest);
  if (idxInPool !== -1) {
    state.poolIndex = idxInPool;
  } else {
    // poolに入っていない場合（フィルタ外）でも表示できるよう全データから探す
    const found = state.destinations.find(d => d.id === dest);
    if (found) {
      // 見つかった目的地をpool先頭に差し込む
      const enriched = {
        ...found,
        travelTimeMinutes: calculateTravelTimeMinutes(state.departure, found),
        distanceStars:     calculateDistanceStars(state.departure, found),
      };
      state.pool.unshift(enriched);
      state.poolIndex = 0;
    }
  }

  clearFormError();
  draw();
}

/* ── シェアボタン ── */

function bindShareHandlers() {
  // イベント委任（DOM再描画後も有効）
  document.addEventListener('click', async (e) => {
    const xBtn   = e.target.closest('#share-x-btn');
    const copyBtn = e.target.closest('#share-copy-btn');

    if (xBtn) {
      const city = state.pool[state.poolIndex];
      if (city) openXShare(city, state.departure);
      return;
    }

    if (copyBtn) {
      try {
        const city = state.pool[state.poolIndex];
        if (city) await copyShareText(city, state.departure);
        showCopyFeedback(copyBtn);
      } catch {
        copyBtn.textContent = 'コピー失敗';
        setTimeout(() => { copyBtn.textContent = 'リンクをコピー'; }, 2000);
      }
    }
  });
}

function showCopyFeedback(btn) {
  const original = btn.textContent;
  btn.textContent = 'コピーしました';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 2000);
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

/* ── 出発地 自動検出（現在地 → 東京 フォールバック） ── */

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
    sel.value       = city;
    state.departure = city;
  }
}

function detectDeparture() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const city = nearestDeparture(pos.coords.latitude, pos.coords.longitude);
      if (state.departure === '東京') setDeparture(city);
    },
    () => { /* 拒否・エラー → 東京のまま */ },
    { timeout: 5000, maximumAge: 60000 },
  );
}

/* ── イントロ演出 ── */

/*
 * CSS animation（fill-mode: both）を使うと pointer-events が keyframe 経由で
 * 上書きされ Safari/iOS でクリック不能になるため、JS transition に切り替え。
 * pointer-events: none は CSS クラスのみで管理し、JS/animation は一切触らない。
 */
function initIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  // 1.5s 表示 → .intro-overlay--hiding で opacity:0 + visibility:hidden
  const fadeTimer = setTimeout(() => {
    overlay.classList.add('intro-overlay--hiding');
    // transition 終了後（0.6s）に DOM から削除
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    // フォールバック: transitionend が発火しない場合も 1s 後に強制削除
    setTimeout(() => { overlay.isConnected && overlay.remove(); }, 800);
  }, 1500);

  // ページ非表示タブなどで 1.5s が長すぎる場合の安全弁（4s で強制削除）
  setTimeout(() => { overlay.isConnected && overlay.remove(); clearTimeout(fadeTimer); }, 4000);
}

init();
