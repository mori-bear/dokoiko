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
  openLineShare,
  copyShareText,
  updatePageMeta,
} from './src/share.js';
import { captureShareCard, shareOrDownload } from './src/share-image.js';
import { initAnalytics, trackEvent, reportError } from './src/analytics.js';

async function init() {
  console.log('[INIT START]');
  initAnalytics();
  bindHandlers(go, retry);
  bindShareHandlers();
  bindTrackHandlers();
  bindExampleLinks();
  bindLocationButton();
  bindMapsCta();
  bindModalHandlers();

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

function matchesKeyword(dest, kw) {
  if (!kw) return true;
  const hay = [
    dest.name,
    dest.prefecture ?? '',
    dest.region ?? '',
    ...(dest.primary ?? []),
    ...(dest.secondary ?? []),
    ...(dest.tags ?? []),
    dest.description ?? '',
    ...(dest.spots ?? []),
  ].join(' ').toLowerCase();
  return hay.includes(kw.toLowerCase());
}

function buildPool() {
  const fromCityInfo = DEPARTURE_CITY_INFO[state.departure];
  const nearestHub   = fromCityInfo?.nearestHub ?? null;
  let pool = buildShuffledPool(state.destinations, state.stayType, state.theme, state.departure, nearestHub, state.excludeCar, state.situation);

  if (state.region) {
    pool = pool.filter(d => d.region === state.region);
  }
  if (state.keyword) {
    pool = pool.filter(d => matchesKeyword(d, state.keyword));
  }

  state.pool      = pool;
  state.poolIndex = 0;
  reorderPool();
}

/**
 * 表示順制御:
 *   1位: weight最大の目的地を先頭に（最も納得感の高い提案を最初に出す）
 *   2〜5位: destTypeが連続しないよう再配置（多様性の視覚的バランス）
 */
function reorderPool() {
  if (state.pool.length <= 1) return;

  // 1位: weight最大を先頭へ
  let maxIdx = 0;
  for (let i = 1; i < state.pool.length; i++) {
    if ((state.pool[i].weight ?? 1) > (state.pool[maxIdx].weight ?? 1)) maxIdx = i;
  }
  if (maxIdx !== 0) {
    const best = state.pool.splice(maxIdx, 1)[0];
    state.pool.unshift(best);
  }

  // 2〜5位: 直前と同一 destType なら後続から別 type を引き上げ
  for (let pos = 1; pos <= Math.min(4, state.pool.length - 1); pos++) {
    if (state.pool[pos].destType !== state.pool[pos - 1].destType) continue;
    // 後続から異なるtypeを探して交換
    const swapIdx = state.pool.slice(pos + 1).findIndex(d => d.destType !== state.pool[pos - 1].destType);
    if (swapIdx !== -1) {
      const actual = pos + 1 + swapIdx;
      [state.pool[pos], state.pool[actual]] = [state.pool[actual], state.pool[pos]];
    }
  }
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
  trackEvent('retry', { from: state.departure });
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

    state.lastTransportContext = plan.transportContext;

    // ── 行動ログ + エラー検知 ──
    const destId = city.id ?? 'unknown';
    trackEvent('page_view', { from: state.departure, destId });
    const tc = plan.transportContext;
    if (!tc?.bestRoute?.jrChainCta && !tc?.mapOnlyFallback
        && tc?.bestRoute?.transportType !== 'rail_private') {
      reportError('CTA_MISSING', { destId, from: state.departure });
    }
    if (!tc?.bestRoute?.segments?.length && !tc?.mapOnlyFallback) {
      reportError('ROUTE_EMPTY', { destId, from: state.departure });
    }
    if (!tc?.mapUrl && !plan.transportLinks?.some(l => l.type === 'map-cta')) {
      reportError('MAP_TARGET_MISSING', { destId, from: state.departure });
    }

    renderResult({
      city,
      transportLinks:  plan.transportLinks,
      hotelLinks:      plan.hotelLinks,
      stayCityName:    plan.stayCityName,
      stayType:        state.stayType,
      departure:       state.departure,
      transportContext: plan.transportContext,
    });

    // URLとページメタを更新
    encodeStateToUrl(state.departure, state.stayType, state.theme, state.excludeCar, city.id, state.situation);
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
  const { from, nights, theme, situation, excludeCar, dest } = urlParams;

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

  // シチュエーション
  if (situation) {
    state.situation = situation;
    document.querySelectorAll('[data-situation]').forEach(b => {
      b.classList.toggle('active', b.dataset.situation === situation);
    });
  }

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
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#share-img-btn');
    if (!btn) return;

    const city = state.pool[state.poolIndex];
    if (!city) return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '生成中…';
    try {
      trackEvent('share_click', { from: state.departure, destId: city.id });
      const canvas = await captureShareCard(city, state.departure, state.lastTransportContext);
      await shareWithImage(canvas, city, state.departure, state.lastTransportContext);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[share] 失敗:', err);
        btn.textContent = '生成失敗';
        setTimeout(() => { btn.textContent = original; }, 2000);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#share-line-btn')) return;
    const city = state.pool[state.poolIndex];
    if (!city) return;
    trackEvent('share_line_click', { from: state.departure, destId: city.id });
    openLineShare(city, state.departure);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#share-copy-btn')) return;
    const city = state.pool[state.poolIndex];
    if (!city) return;
    trackEvent('share_copy_click', { from: state.departure, destId: city.id });
    copyShareText(city, state.departure);
  });
}

/** 画像+テキストを同時にシェア（Web Share API → フォールバック: X intent + ダウンロード） */
async function shareWithImage(canvas, city, departure, tc) {
  const name = city.displayName || city.name;
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  const chainCta = tc?.bestRoute?.jrChainCta;
  let text;
  if (chainCta) {
    const to = clean(chainCta.to);
    text = `${departure}から${to}って意外と行ける\n${to}まで予約OK\nhttps://tabidokoiko.com`;
  } else {
    text = `${departure}から${name}って意外と行ける\nhttps://tabidokoiko.com`;
  }

  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `${departure}-${name}.png`, { type: 'image/png' });

  // Web Share API（スマホ: 画像+テキスト同時投稿）
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ text, files: [file] });
    return;
  }

  // PC フォールバック: X intent（テキストのみ）+ 画像ダウンロード
  shareOrDownload(canvas, city, departure);
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer,width=550,height=420',
  );
}

/* ── data-track クリック計測 ── */

function bindTrackHandlers() {
  document.addEventListener('click', (e) => {
    const tracked = e.target.closest('[data-track]');
    if (!tracked) return;
    const event = tracked.dataset.track;
    const city = state.pool[state.poolIndex];
    trackEvent(event, {
      from: state.departure,
      destId: city?.id ?? 'unknown',
      destName: city?.displayName ?? city?.name ?? 'unknown',
      destType: city?.destType ?? 'unknown',
      stayArea: state.lastTransportContext?.bestRoute?.jrChainCta?.to ?? city?.displayName ?? city?.name ?? '',
    });
  });
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
        btn.textContent = '今いる場所から探す';
      },
      () => {
        btn.disabled    = false;
        btn.textContent = '今いる場所から探す';
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

/* ── モーダル型フィルター（?modal=1 feature flag） ── */

function bindModalHandlers() {
  // feature flag: ?modal=1 のみ有効
  if (!new URLSearchParams(location.search).has('modal')) return;

  const filterControls = document.getElementById('filter-controls');
  const filterBtn      = document.getElementById('filter-btn');
  const modal          = document.getElementById('filter-modal');
  const overlay        = document.getElementById('modal-overlay');
  const closeBtn       = document.getElementById('modal-close');
  const submitBtn      = document.getElementById('modal-submit');
  if (!filterControls || !filterBtn || !modal) return;

  // body に modal-mode クラスを付与（CSS で !important 非表示を保証）
  document.body.classList.add('modal-mode');

  // モーダル内のアクティブ状態を state から初期反映
  function syncModalState() {
    document.querySelectorAll('#filter-modal [data-stay]').forEach(b =>
      b.classList.toggle('active', b.dataset.stay === state.stayType));
    document.querySelectorAll('#filter-modal [data-theme]').forEach(b =>
      b.classList.toggle('active', (b.dataset.theme || null) === state.theme));
    document.querySelectorAll('#filter-modal [data-region]').forEach(b =>
      b.classList.toggle('active', b.dataset.region === state.region));
    document.querySelectorAll('#filter-modal [data-situation]').forEach(b =>
      b.classList.toggle('active', b.dataset.situation === state.situation));
    const exCar = document.querySelector('#filter-modal [data-exclude-car]');
    if (exCar) exCar.classList.toggle('active', state.excludeCar);
    const kw = document.getElementById('modal-keyword-search');
    if (kw) kw.value = state.keyword;
  }

  // バッジ更新（アクティブフィルター数）
  function updateBadge() {
    const count = [
      state.theme,
      state.region,
      state.situation,
      state.keyword,
      state.excludeCar || null,
    ].filter(Boolean).length;
    filterBtn.innerHTML = count > 0
      ? `🔍 絞り込み<span class="badge">${count}</span>`
      : '🔍 絞り込み';
  }

  function openModal()  { syncModalState(); modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ''; updateBadge(); }

  filterBtn.addEventListener('click', openModal);
  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  submitBtn.addEventListener('click', () => { closeModal(); go(); });

  updateBadge();
  console.log('[modal] feature flag active');
}

/**
 * マップCTA（「この旅で行く」）クリック時に宿セクションへスムーズスクロール。
 * ユーザーが Maps を開いた直後、画面に戻ったときに宿リンクが目に入るようにする。
 */
function bindMapsCta() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#go-maps-btn')) return;
    const stayEl = document.getElementById('stay-section');
    if (!stayEl) return;
    // Maps はバックグラウンドタブで開くため、少し遅延してスクロール
    setTimeout(() => {
      stayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 視線を引くため一時的にハイライトクラスを付与
      stayEl.classList.add('stay-section--highlight');
      setTimeout(() => stayEl.classList.remove('stay-section--highlight'), 1200);
    }, 300);
  });
}

// 全 import（top-level await 含む）が完了し app.js が評価された証拠
window.__appInitStarted = true;
window.__appState = state;   // console診断用
console.log('[MODULE LOADED] app.js 評価完了');

init();
