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
  console.log('[INIT START]');
  initIntro();
  bindHandlers(go, retry);
  bindShareHandlers();
  bindExampleLinks();
  bindLocationButton();

  // 出発地の優先順位: URLパラメータ > localStorage > デフォルト（東京）
  const urlParams = decodeUrlParams();
  if (!urlParams.from) {
    const saved = localStorage.getItem('departure');
    if (saved) setDeparture(saved);
  }

  try {
    state.destinations = await loadDestinations();
    console.log('[INIT] destinations loaded:', state.destinations?.length, '件');
    if (urlParams.dest) {
      // URL に目的地指定あり → 完全復元して表示
      restoreFromUrl(urlParams);
    } else if (urlParams.from || urlParams.nights || urlParams.theme) {
      // フォーム状態のみ復元（destなし）→ その条件で自動提案
      restoreFromUrl(urlParams);
    }
    // else: 初回ロード — URLパラメータなし → 検索画面のみ表示（ユーザー操作待ち）
  } catch (err) {
    console.error('[init] データ読み込みエラー:', err);
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
    console.warn('[go] destinations が空です');
    return;
  }
  clearFormError();

  // ローディング演出：ボタンを一時的に「探しています…」に変更
  const goBtn = document.getElementById('go-btn');
  if (goBtn) { goBtn.textContent = '探しています…'; goBtn.disabled = true; }

  // requestAnimationFrame で描画反映後に処理（ローディング表示を確実に見せる）
  requestAnimationFrame(() => setTimeout(() => {
    buildPool();
    console.log('[go] pool:', state.pool.length, '件 / stayType:', state.stayType, '/ theme:', state.theme, '/ departure:', state.departure);
    if (state.pool.length === 0) {
      showFormError('条件に合う旅先が見つかりませんでした。条件を変えてお試しください。');
      if (goBtn) { goBtn.textContent = 'どこ行こ？'; goBtn.disabled = false; }
      return;
    }
    draw();
    if (goBtn) { goBtn.textContent = 'もう一度探す'; goBtn.disabled = false; }
  }, 180));
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
  console.log('[draw] city:', city?.name ?? 'undefined', '/ poolIndex:', state.poolIndex);
  if (!city) return;

  // result を先に表示しておく（エラー時もフォールバックが見える）
  const resultEl = document.getElementById('result');
  resultEl.hidden = false;

  try {
    const plan = buildTravelPlan(city, state.departure);

    renderResult({
      city,
      transportLinks:  plan.transportLinks,
      hotelLinks:      plan.hotelLinks,
      stayType:        state.stayType,
      departure:       state.departure,
      mapUrl:          plan.transportContext?.mapUrl          ?? null,
      mapOnlyFallback: plan.transportContext?.mapOnlyFallback ?? false,
      reason:          plan.transportContext?.reason          ?? '',
    });

    // URLとページメタを更新
    encodeStateToUrl(state.departure, state.stayType, state.theme, state.excludeCar, city.id);
    updatePageMeta(city, state.departure);

    const remaining = state.pool.length - state.poolIndex - 1;
    const retryBtn  = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.textContent = remaining > 0
        ? `別の旅先を見る（あと${remaining}件）`
        : 'もう一度探す';
    }
  } catch (err) {
    console.error('[draw] エラー:', err);
    const inner = document.getElementById('result-inner');
    if (inner) {
      inner.innerHTML = `<div class="result-card"><p style="padding:1.5rem;color:#666;">表示中にエラーが発生しました。もう一度お試しください。</p><p style="padding:0 1.5rem 1rem;font-size:12px;color:#999;">${err?.message ?? ''}</p></div>`;
    }
  }

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── ヒーローサンプルリンク（ページリロードなしで適用） ── */

function bindExampleLinks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('.hero-example-link');
    if (!link || !link.href) return;
    e.preventDefault();

    const params = new URLSearchParams(new URL(link.href, location.origin).search);
    const from   = params.get('from');
    const nights = params.get('nights');
    const theme  = params.get('theme') || null;

    if (from) setDeparture(from);
    if (nights) {
      state.stayType = nights;
      document.querySelectorAll('[data-stay]').forEach(b =>
        b.classList.toggle('active', b.dataset.stay === nights));
    }
    state.theme = theme;
    document.querySelectorAll('[data-theme]').forEach(b =>
      b.classList.toggle('active', (b.dataset.theme || null) === theme));

    go();
    document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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
    localStorage.setItem('departure', city);
  }
}

function bindLocationButton() {
  const btn = document.getElementById('location-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    btn.disabled    = true;
    btn.textContent = '取得中…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = nearestDeparture(pos.coords.latitude, pos.coords.longitude);
        setDeparture(city);
        btn.disabled    = false;
        btn.textContent = '📍 今いる場所から探す';
      },
      () => {
        btn.disabled    = false;
        btn.textContent = '📍 今いる場所から探す';
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  });
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

// 全 import（top-level await 含む）が完了し app.js が評価された証拠
window.__appInitStarted = true;
window.__appState = state;   // console診断用
console.log('[MODULE LOADED] app.js 評価完了');

init();
