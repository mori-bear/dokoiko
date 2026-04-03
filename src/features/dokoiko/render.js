/**
 * DOM描画モジュール
 *
 * カード表示順:
 *   result-card
 *     city-block（都市名/地域/タグ/スポット/説明文）
 *     card-section（交通リンク：概要 + 全体マップ + 予約CTA）
 *     card-section（到着後の移動：レンタカー + Googleマップ）← ローカル移動がある場合のみ
 *     alt-route-block（レンタカー直行代替案）
 *     stay-block（この街に泊まるなら — stayType !== daytrip のみ）
 */

import { DEPARTURE_CITY_INFO }                   from '../../config/constants.js';
import { AIRPORT_IATA, buildRentalLink }          from '../../transport/linkBuilder.js';

export function renderResult({ city, transportLinks, hotelLinks, stayType, departure }) {
  // 白画面防止 — レンダリングエラーを catch してフォールバック表示
  try {
    const showHotel = stayType !== 'daytrip';

    const el = document.getElementById('result-inner');
    el.innerHTML = `
      <div class="result-card">
        ${buildCityBlock(city)}
        ${buildTransportBlock(transportLinks, departure, city.displayName || city.name, city)}
        ${showHotel ? buildStayBlock(hotelLinks) : ''}
        ${buildShareBlock()}
      </div>
    `;
  } catch (err) {
    console.error('[renderResult] レンダリングエラー:', err);
    const el = document.getElementById('result-inner');
    if (el) {
      el.innerHTML = `<div class="result-card"><p style="padding:1rem;color:#666;">表示中にエラーが発生しました。もう一度お試しください。</p></div>`;
    }
  }
}

export function clearResult() {
  const el = document.getElementById('result-inner');
  if (el) el.innerHTML = '';
}

/* ── アクセス地点ラベル推定 ── */

function accessLabel(station) {
  if (!station) return '';
  if (station.endsWith('空港')) return '最寄空港';
  if (station.endsWith('港'))   return '最寄港';
  if (station.endsWith('バスターミナル') || station.endsWith('バス停')) return '最寄バスターミナル';
  return '最寄駅';
}

/* ── 都市ブロック ── */

function buildCityBlock(city) {
  const descriptionHtml = city.description
    ? `<p class="appeal-line">${city.description}</p>`
    : '';

  // タグは最大3つ
  const themesHtml = Array.isArray(city.tags) && city.tags.length
    ? city.tags.slice(0, 3).map((t) => `<span class="theme-tag">${t}</span>`).join('')
    : '';

  const categoryBadge = buildCategoryBadge(city);
  const spotListHtml  = buildSpotList(city.landmarks ?? city.spots);

  const nearbyHtml    = buildNearbyList(city.nearby);
  const itineraryHtml = buildItineraryList(city.itinerary);

  // 乗換ガイド（私鉄など乗換が必要な場合）
  const transferHtml  = buildTransferNote(city);

  // 所在地（都道府県＋市区町村）
  const locationStr = city.prefecture && city.city && city.city !== city.name
    ? `${city.prefecture}${city.city}`
    : city.prefecture || '';

  // mountain/remote: 最寄り拠点（hub）を表示
  const isMountainRemote = city.destType === 'mountain' || city.destType === 'remote';
  const isIslandDest     = !!(city.isIsland || city.destType === 'island');
  const hubName     = city.gatewayHub || (city.hubStation ? city.hubStation.replace(/駅$/, '') : null);
  // TASK4: 島の場合は「駅」で終わる accessStation を非表示（港・空港のみ表示）
  const showAccess  = city.accessStation && !(isIslandDest && city.accessStation.endsWith('駅'));
  const accessHtml  = isMountainRemote
    ? (hubName ? `<p class="city-station city-station--hub">最寄り拠点：${hubName}<span class="hub-label">（車でアクセス）</span></p>` : '')
    : (showAccess ? `<p class="city-station">${accessLabel(city.accessStation)}：${city.accessStation}${city.operator ? `<span class="operator-badge${city.operatorType === 'private' ? ' operator-badge--private' : ''}">${city.operator}</span>` : ''}</p>` : '');

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.displayName || city.name}</h2>
        <p class="city-sub">${locationStr}${categoryBadge}</p>
        ${accessHtml}
      </div>
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      ${spotListHtml}
      <div class="city-appeal">${descriptionHtml}</div>
      ${transferHtml}
      ${nearbyHtml}
      ${itineraryHtml}
    </div>
  `;
}

/* ── 乗換ガイド（私鉄乗換が必要な場合にステップ形式で表示） ── */
function buildTransferNote(city) {
  if (!city.transferNote) return '';
  // "→" で分割してステップ表示
  const steps = city.transferNote.split(/\s*→\s*/).map(s => s.trim()).filter(Boolean);
  if (steps.length <= 1) {
    return `<div class="transfer-note"><span class="transfer-step">${city.transferNote}</span></div>`;
  }
  const stepsHtml = steps.map((s, i) =>
    `<span class="transfer-step">${s}</span>${i < steps.length - 1 ? '<span class="transfer-arrow">↓</span>' : ''}`
  ).join('');
  return `<div class="transfer-note">${stepsHtml}</div>`;
}

function buildNearbyList(nearby) {
  if (!Array.isArray(nearby) || nearby.length === 0) return '';
  const items = nearby.map(n => `<span class="nearby-tag">${n}</span>`).join('');
  return `<div class="nearby-row"><span class="nearby-label">この旅先の近く</span>${items}</div>`;
}

function buildItineraryList(itinerary) {
  if (!Array.isArray(itinerary) || itinerary.length === 0) return '';
  const items = itinerary.map((s, i) => `<span class="itin-step">${s}</span>${i < itinerary.length - 1 ? '<span class="itin-arrow">→</span>' : ''}`).join('');
  return `<div class="itinerary-row">${items}</div>`;
}

function buildSpotList(spots) {
  if (!Array.isArray(spots) || spots.length === 0) return '';
  const items = spots.slice(0, 3).map((s) => `<li>${s}</li>`).join('');
  return `
    <div class="spot-list">
      <p class="spot-title">代表スポット</p>
      <ul>${items}</ul>
    </div>
  `;
}

function buildCategoryBadge(city) {
  const isIsland   = city.isIsland || city.destType === 'island';
  const isOnsen    = city.destType === 'onsen';
  const isSight    = city.destType === 'sight';
  const isMountain = city.destType === 'mountain';
  const isRemote   = city.destType === 'remote';
  if (isIsland)   return `　<span class="type-badge type-island">島</span>`;
  if (isOnsen)    return `　<span class="type-badge type-onsen">温泉</span>`;
  if (isMountain) return `　<span class="type-badge type-mountain">高原・山岳</span>`;
  if (isRemote)   return `　<span class="type-badge type-remote">秘境</span>`;
  if (isSight)    return `　<span class="type-badge type-sight">自然</span>`;
  return '';
}

/* ── 交通ブロック ── */

function buildTransportBlock(links, departure, destLabel, city = null) {
  /* access.steps 方式（優先）: destinations.json の steps[] を直接使用 */
  if (city?.access?.steps) {
    return buildAccessBlock(city, departure);
  }

  /* step-group 方式: 統合シーケンシャル表示 */
  if (links.some(l => l.type === 'step-group')) {
    return buildStepsBlock(links, departure, destLabel, city);
  }

  /* フォールバック: 旧方式（note + action links） */
  const noteLink    = links.find(l => l.type === 'note');
  const cautionLinks = links.filter(l => l.type === 'note-caution');
  const actionLinks  = links.filter(l => l.type !== 'note' && l.type !== 'note-caution');

  let summaryHtml = '';
  if (departure && destLabel && noteLink) {
    const transfers = noteLink.transfers ?? 0;
    const transferStr = transfers === 0 ? '直通' : `乗換${transfers}回`;
    summaryHtml = `<div class="route-summary">${departure} → ${destLabel}（${transferStr}）</div>`;
  }

  let firstActionable = true;
  const buttonsHtml = actionLinks.map(link => {
    const html = buildLinkItem(link, firstActionable);
    if (firstActionable) firstActionable = false;
    return html;
  }).join('');

  const cautionsHtml = cautionLinks.map(l =>
    `<div class="transport-note transport-note--caution">${l.label}</div>`
  ).join('');

  const stepHtml = noteLink
    ? `<div class="transport-note transport-note--steps">${noteLink.label}</div>`
    : '';

  return `
    <div class="card-section">
      ${summaryHtml}
      <div class="link-list">${buttonsHtml}</div>
      ${cautionsHtml}
      ${stepHtml}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/* ── 統合ステップ表示（main → 乗換 → 到着後）── */

/**
 * Phase 6-9: ルート要約 → メインCTA → 番号付きフロー → 代替ルート の順で描画。
 */
function buildStepsBlock(links, departure, destLabel, city = null) {
  const stepGroups = links.filter(l => l.type === 'step-group');
  const altRoutes  = links.filter(l => l.type === 'alt-route');

  // ① ルート概要
  const summaryHtml = (departure && destLabel)
    ? `<div class="route-summary">${buildRouteSummary(departure, destLabel, city)}</div>`
    : '';

  // ② メインCTA（routes.json の main-cta を直接使用 — 推測・生成しない）
  const mainCtaItem = links.find(l => l.type === 'main-cta');
  const mainCtaHtml = mainCtaItem ? buildMainCtaBlock(mainCtaItem) : '';

  // ③ 番号付きフロー（Google Maps サブリンクのみ表示）
  const stepsHtml = stepGroups.map(sg => buildStepCard(sg)).join('');

  // ④ 代替ルート
  const altRoutesHtml = altRoutes.map(ar => buildAltRouteSection(ar)).join('');

  // ⑤ subCTA（routes.json の sub-cta を直接使用 — requiresCar のときレンタカー）
  const subCtaItem = links.find(l => l.type === 'sub-cta');
  const subCtaHtml = subCtaItem ? buildSubCtaBlock(subCtaItem) : '';

  // ⑥ mapCTA（routes.json の map-cta を直接使用 — finalPointまでのルート）
  const mapCtaItem = links.find(l => l.type === 'map-cta');
  const mapCtaHtml = mapCtaItem ? buildMapCtaBlock(mapCtaItem) : '';

  // ⑦ 到着後ヒント（railNote など）
  const hint = buildLocalTransportHint(city);
  const localSection = (hint || subCtaHtml || mapCtaHtml)
    ? `<div class="local-section">
         <div class="local-header">到着後の移動</div>
         ${hint}
         ${subCtaHtml}
         ${mapCtaHtml}
       </div>`
    : '';

  return `
    <div class="card-section">
      ${summaryHtml}
      ${mainCtaHtml}
      <div class="step-list">${stepsHtml}</div>
      ${altRoutesHtml}
      ${localSection}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/**
 * メインCTAブロック。
 * { type: 'main-cta', cta: { type, url, label? } } を受け取り `.main-cta-row` で表示。
 * CTA は route 単位で 1 つだけ（step-group からは導出しない）。
 */
function buildMainCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? buildMainCtaLabel(cta.type);
  return `
    <div class="main-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn ${btnClass(cta.type)} btn--route-main">${label}</a>
    </div>
  `;
}

/**
 * subCTA ブロック。
 * { type: 'sub-cta', cta: { type, url, label? } } を受け取り `.sub-cta-row` で表示。
 * 現在は rental（レンタカー）のみ対応。
 */
function buildSubCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? '🚗 レンタカーを探す';
  return `
    <div class="sub-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn btn-rental">${label}</a>
    </div>
  `;
}

/**
 * mapCTA ブロック。
 * { type: 'map-cta', cta: { type: 'google-maps', url, label } } を受け取り `.map-cta-row` で表示。
 */
function buildMapCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? '📍 地図で確認';
  return `
    <div class="map-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn btn-maps">${label}</a>
    </div>
  `;
}

function buildMainCtaLabel(type) {
  const LABELS = {
    'skyscanner':    '✈️ 航空券を比較する',
    'google-flights':'✈️ 航空券を比較する',
    'jr-east':       '🚄 えきねっとで予約する',
    'jr-west':       '🚄 e5489で予約する',
    'jr-kyushu':     '🚄 JR九州ネット予約',
    'jr-ex':         '🚄 EXで予約する',
    'jr-window':     '🚄 みどりの窓口で購入',
    'ferry':         '🚢 フェリーを予約する',
    'bus':           '🚌 バスを予約する',
  };
  return LABELS[type] ?? 'チケットを予約する';
}

/**
 * Phase 7: 代替ルート（「他の行き方」）を折りたたみで表示。
 * alt-route: { type: 'alt-route', label: '鉄道で行く', stepGroups: [...] }
 */
function buildAltRouteSection(altRoute) {
  if (!altRoute?.stepGroups?.length) return '';
  const innerHtml = altRoute.stepGroups.map(sg => buildStepCard(sg, false)).join('');
  return `
    <details class="alt-route-section">
      <summary class="alt-route-summary">他の行き方：${altRoute.label ?? '代替ルート'}</summary>
      <div class="alt-route-inner step-list">${innerHtml}</div>
    </details>
  `;
}

/**
 * 1ステップ分のカードを描画する。
 * stepLabel（"① ✈ 高松空港 → 福岡空港（飛行機）"）をヘッダーに表示し、
 * type 別にオーバーライドした CTA ボタンと、car step の rentalLink を配置する。
 */
/**
 * 1ステップ分のカードを描画する。
 * CTAボタンはメインCTAブロックに集約するため、ステップカードには表示しない。
 * Googleマップサブリンク（ローカル移動用）のみ小テキストで表示する。
 */
function buildStepCard(sg) {
  const ctaLabel     = buildStepCtaLabel(sg);
  const isGoogleMaps = sg.cta?.type === 'google-maps';
  // booking CTA はメインCTAブロックで表示済み → ステップ内には出さない
  // Google Maps のみ補助サブリンクとして表示
  const ctaHtml = (sg.cta?.url && ctaLabel && isGoogleMaps)
    ? `<a href="${sg.cta.url}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">${ctaLabel}</a>`
    : '';

  const cautionHtml = sg.caution
    ? `<p class="step-card-caution">${sg.caution}</p>`
    : '';

  // stepLabel も表示要素も何もない場合のみスキップ
  if (!sg.stepLabel && !ctaHtml && !cautionHtml) return '';

  return `
    <div class="step-card">
      <div class="step-card-header">${sg.stepLabel ?? ''}</div>
      ${ctaHtml}
      ${cautionHtml}
    </div>
  `;
}

/**
 * ステップの type に応じて CTA ボタンラベルを生成する。
 *   flight   → 「飛行機で行く（A → B）」
 *   train/JR → 「このルートで進む（A → B）」  ← 既存ラベルを維持
 *   ferry    → 「フェリーを予約する（A → B）」
 *   map      → 「Googleマップで確認（A → B）」
 *   car/rental → 既存ラベル（「○○でレンタカーを借りる」）
 */
function buildStepCtaLabel(sg) {
  const cta = sg.cta;
  if (!cta?.url) return null;

  // buildRouteByPattern が明示的ラベルを設定している場合はそれを使用
  if (sg.ctaLabel) return sg.ctaLabel;

  // stepLabel から "from → to" を抽出
  // アイコンが空文字のケースに対応: CJK文字起点で from を特定
  const fromTo = (() => {
    if (!sg.stepLabel) return '';
    const withoutMode = sg.stepLabel.replace(/（[^）]+）$/, '');
    const arrowIdx = withoutMode.indexOf('→');
    if (arrowIdx < 0) return '';
    const rawFrom = withoutMode.slice(0, arrowIdx);
    const from = (rawFrom.match(/([\u3040-\u9FFF].*)/)?.[1] ?? '').trim().replace(/駅$/, '');
    const to   = withoutMode.slice(arrowIdx + 1).trim();
    return `${from} → ${to}`;
  })();

  // stepLabel 末尾の（モード）を抽出
  const stepMode = sg.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';

  switch (cta.type) {
    case 'google-maps':
      return fromTo ? `${fromTo}の行き方を地図で見る` : '地図で行き方を見る';
    case 'skyscanner':
    case 'google-flights':
      return fromTo ? `航空券を予約する（${fromTo}）` : cta.label;
    case 'ferry':
      return fromTo ? `フェリーを予約する（${fromTo}）` : cta.label;
    case 'bus':
      return fromTo ? `バスで行く（${fromTo}）` : cta.label;
    case 'jr-east':
    case 'jr-west':
    case 'jr-kyushu':
    case 'jr-ex':
    case 'jr-window': {
      const providerLabel = {
        'jr-east':   'えきねっと',
        'jr-west':   'e5489',
        'jr-kyushu': 'JR九州ネット予約',
        'jr-ex':     'EX',
        'jr-window': 'みどりの窓口',
      }[cta.type] ?? '鉄道';
      return fromTo ? `${providerLabel}で予約する（${fromTo}）` : `${providerLabel}で予約する`;
    }
    default:
      return cta.label ?? '';
  }
}

/* ── ルート要約（Phase 5）── */

/**
 * ルート概要テキストを生成する。
 *   "高松 → 梼原" + 到着後アクセス補足（secondaryTransport ベース）
 */
function buildRouteSummary(departure, destLabel, city) {
  const headline = `${departure} → ${destLabel}`;

  let localPreview = '';
  if (city && !(city.isIsland || city.destType === 'island')) {
    const transport = city.secondaryTransport ?? null;
    const needsCar  = !!(city.requiresCar ?? city.needsCar) || city.destType === 'mountain' || city.destType === 'remote' || transport === 'car';
    const hasBus    = city.railNote === 'バス' || city.busGateway != null || transport === 'bus';
    if (needsCar)      localPreview = '　🚗 レンタカー必要';
    else if (hasBus)   localPreview = '　駅からバス';
  }

  return localPreview
    ? `<span class="route-headline">${headline}</span><span class="route-detail">${localPreview}</span>`
    : headline;
}

/* ── 地図URL ── */

function buildDestMapUrl(city) {
  if (!city) return null;
  if (city.lat && city.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${city.lat},${city.lng}`;
  }
  const name = city.displayName || city.name || '';
  return name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}` : null;
}

/**
 * 出発駅 → 観光地 or 最寄り駅 のルートマップURL（最上部に表示）
 * mapPoint あり（観光地・スポット型）→ 観光地まで案内
 * mapPoint なし → accessStation（最寄り駅）まで案内
 *
 * @param {string} departure — 出発都市名（例: '高松'）
 * @param {object} city     — 目的地エントリ
 */
function buildRouteMapUrl(departureStation, city) {
  if (!departureStation || !city) return null;
  const from = departureStation;
  const to   = city.mapPoint ?? city.accessStation ?? city.displayName ?? city.name;
  if (!to) return null;
  return `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}`;
}

/* ── ステップ分類（main / transfer / local）── */

/**
 * step-group 配列を3種に分類する。
 *   main     : 新幹線 / 飛行機 / フェリー / 高速バス（CTAが出る主要交通）
 *   transfer : JR在来線・私鉄（乗換まとめセクションで表示）
 *              / 次ステップが主要交通へつなぐ中継Googleマップ
 *   local    : 到着後の地図ナビ / レンタカー
 */
function classifyStepGroups(stepGroups) {
  const main = [], transfer = [], local = [];
  for (let i = 0; i < stepGroups.length; i++) {
    const sg       = stepGroups[i];
    const ctaType  = sg.cta?.type ?? '';
    const stepMode = sg.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';

    const isShinkansen = ['jr-east', 'jr-west', 'jr-kyushu', 'jr-ex', 'jr-window'].includes(ctaType) && stepMode === '新幹線';
    const isFlight     = ['skyscanner', 'google-flights'].includes(ctaType);
    const isFerry      = ctaType === 'ferry';
    const isBus        = ctaType === 'bus';
    const hasRental    = !!sg.rentalLink?.url;

    if (isShinkansen || isFlight || isFerry || isBus) { main.push(sg); continue; }
    if (hasRental) { local.push(sg); continue; }
    if (ctaType === 'google-maps') {
      // 次ステップが飛行機/フェリー/バスなら中継ナビ → transfer
      const nextType = stepGroups[i + 1]?.cta?.type ?? '';
      const isIntermediate = ['skyscanner', 'google-flights', 'ferry', 'bus'].includes(nextType);
      (isIntermediate ? transfer : local).push(sg);
      continue;
    }
    transfer.push(sg);
  }
  return { main, transfer, local };
}

/* ── 乗換セクション ── */

/** stepLabel から出発地を抽出（CJK起点で from を特定・駅 suffix 除去） */
function extractStepFrom(sg) {
  const withoutMode = sg.stepLabel?.replace(/（[^）]+）$/, '') ?? '';
  const arrowIdx    = withoutMode.indexOf('→');
  if (arrowIdx < 0) return '';
  const rawFrom = withoutMode.slice(0, arrowIdx);
  return (rawFrom.match(/([\u3040-\u9FFF].*)/)?.[1] ?? '').trim().replace(/駅$/, '');
}

/** stepLabel から目的地を抽出（駅 suffix 除去） */
function extractStepTo(sg) {
  const withoutMode = sg.stepLabel?.replace(/（[^）]+）$/, '') ?? '';
  const arrowIdx    = withoutMode.indexOf('→');
  if (arrowIdx < 0) return '';
  return withoutMode.slice(arrowIdx + 1).trim().replace(/駅$/, '');
}

/**
 * 連続する同一交通手段ステップをまとめる。
 * 例: 大阪→天王寺（JR）+ 天王寺→伊賀上野（JR）→ 大阪→伊賀上野（JR・乗換1回）
 * 返り値: 通常のstep-group または { _mergedRoute, routeLabel } のミックス配列
 */
function mergeConsecutiveTransfers(transferSteps) {
  const result = [];
  let i = 0;
  while (i < transferSteps.length) {
    const sg      = transferSteps[i];
    const mode    = sg.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';
    const ctaType = sg.cta?.type ?? '';

    // 同一 ctaType・mode の連続ステップを探す（ctaType 未設定は個別扱い）
    let j = i + 1;
    if (ctaType !== '') {
      while (j < transferSteps.length) {
        const next     = transferSteps[j];
        const nextMode = next.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';
        if (mode === nextMode && ctaType === (next.cta?.type ?? '')) j++;
        else break;
      }
    }

    if (j - i >= 2) {
      const first   = transferSteps[i];
      const last    = transferSteps[j - 1];
      const hops    = j - i - 1;
      const from    = extractStepFrom(first);
      const to      = extractStepTo(last);
      result.push({ _mergedRoute: true, routeLabel: `${from} → ${to}（${mode}・乗換${hops}回）` });
    } else {
      result.push(transferSteps[i]);
    }
    i = j;
  }
  return result;
}

/**
 * 乗換ステップを "○○で乗り換え（電車 → 新幹線）" 形式でまとめて表示する。
 * 連続する同一手段ステップは1行にまとめる。
 * CTA なし。
 */
function buildTransferSection(transferSteps, allStepGroups) {
  if (!transferSteps.length) return '';

  const merged = mergeConsecutiveTransfers(transferSteps);

  const items = merged.map(entry => {
    if (entry._mergedRoute) {
      return `<li class="transfer-item">・${entry.routeLabel}</li>`;
    }

    const sg          = entry;
    const currentMode = sg.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';
    const to          = extractStepTo(sg);

    const idx      = allStepGroups.indexOf(sg);
    const nextSg   = allStepGroups[idx + 1];
    const nextMode = nextSg?.stepLabel?.match(/（([^）]+)）$/)?.[1] ?? '';

    // "○○で乗り換え（電車 → 新幹線）" 形式
    const modeChange = (currentMode && nextMode && currentMode !== nextMode)
      ? `（${currentMode} → ${nextMode}）`
      : '';
    const label = to
      ? (nextMode
          ? `${to}で乗り換え${modeChange}`
          : `${to}で乗り換え`)
      : (sg.stepLabel ?? '');
    return `<li class="transfer-item">・${label}</li>`;
  }).join('');

  return `
    <div class="transfer-section">
      <div class="transfer-header">▼ 乗換</div>
      <ul class="transfer-list">${items}</ul>
    </div>
  `;
}

/* ── 到着後セクション ── */

/**
 * city フィールドからローカル交通のヒントを生成。
 * 既存フィールド（needsCar / destType / railNote / busGateway / accessStation）を活用。
 */
function buildLocalTransportHint(city) {
  if (!city) return '';
  if (city.isIsland || city.destType === 'island') return '';

  const transport = city.secondaryTransport ?? null;
  const needsCar  = city.needsCar === true || city.destType === 'mountain'
    || city.destType === 'remote' || transport === 'car';
  const hasBus    = city.railNote === 'バス' || city.busGateway != null || transport === 'bus';

  if (needsCar) {
    return `<p class="local-hint local-hint--car">レンタカー推奨エリア</p>`;
  }
  if (hasBus) {
    const station   = (city.accessStation ?? '').replace(/駅$/, '') || '最寄り駅';
    const modeLabel = transport === 'bus' ? 'バス' : 'バス・タクシー';
    return `<p class="local-hint">${station}から${modeLabel}</p>`;
  }
  if (city.accessStation?.endsWith('駅')) {
    const station = city.accessStation.replace(/駅$/, '');
    return `<p class="local-hint">${station}駅から徒歩</p>`;
  }
  return '';
}

/**
 * 到着後のローカル移動（Googleマップ・レンタカー）をまとめて表示する。
 * city を受け取ってローカル交通ヒントも表示する。
 */
function buildLocalSection(localSteps, rentalLinks = [], city = null) {
  const hint = buildLocalTransportHint(city);

  // Google Maps フォールバック: local ステップに Maps がない場合も必ず1つ表示
  const hasGoogleMaps = localSteps.some(sg => sg.cta?.type === 'google-maps');
  const fallbackMapHtml = (!hasGoogleMaps && city)
    ? (() => {
        const mapUrl = buildDestMapUrl(city);
        const label  = city.displayName || city.name || '目的地';
        return mapUrl
          ? `<div class="link-list"><a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">${label}の行き方を地図で見る</a></div>`
          : '';
      })()
    : '';

  if (!localSteps.length && !rentalLinks.length && !hint && !fallbackMapHtml) return '';

  const stepItems = localSteps.map(sg => {
    const label      = buildStepCtaLabel(sg) ?? '地図で行き方を見る';
    const ctaHtml    = sg.cta?.url
      ? `<a href="${sg.cta.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${label}</a>`
      : '';
    const rentalHtml = sg.rentalLink?.url
      ? `<a href="${sg.rentalLink.url}" target="_blank" rel="noopener noreferrer" class="btn btn-rental">${sg.rentalLink.label}</a>`
      : '';
    if (!ctaHtml && !rentalHtml) return '';
    return `<div class="link-list">${ctaHtml}${rentalHtml}</div>`;
  }).join('');

  const standaloneRental = rentalLinks.map(l =>
    l.url ? `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="btn btn-rental">${l.label}</a>` : ''
  ).join('');
  const standaloneHtml = standaloneRental
    ? `<div class="link-list">${standaloneRental}</div>`
    : '';

  const content = stepItems + standaloneHtml + fallbackMapHtml;
  if (!content.trim() && !hint) return '';

  return `
    <div class="local-section">
      <div class="local-header">到着後の移動</div>
      ${hint}
      ${content}
    </div>
  `;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * access.steps ベース レンダリング
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * rail provider 表示名 → 予約情報
 * access.steps の provider フィールドはすでに表示名（"e5489", "えきねっと" など）
 */
const RAIL_PROVIDER_BOOKING = {
  'e5489':       { btnType: 'jr-west',   url: 'https://www.e5489.net/' },
  'えきねっと':   { btnType: 'jr-east',   url: 'https://www.eki-net.com/' },
  'JR九州':      { btnType: 'jr-kyushu', url: 'https://www.jrkyushu-kippu.jp/' },
  'EX予約':      { btnType: 'jr-ex',     url: 'https://expy.jp/' },
  'みどりの窓口': { btnType: 'jr-window', url: 'https://www.jr-odekake.net/' },
};

const ACCESS_STEP_NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * access.steps[] + 出発地 → UI表示用データを生成する（純粋変換）。
 *
 *  mainCTA  : 最初の予約可能ステップ（rail / flight / ferry）の予約情報
 *  mapMain  : 全体ルート（出発 → 最終目的地）の Google Maps データ
 *  mapLocal : 最後の local ステップの Google Maps データ（なければ null）
 *  steps    : 出発地 from を埋めた steps 配列
 *
 * @param {Array}  steps     - city.access.steps
 * @param {string} departure - 出発都市名（'高松' など）
 * @param {object} city      - 目的地オブジェクト
 */
export function resolveAccessUI(steps, departure, city) {
  if (!steps?.length) return null;

  const depInfo    = DEPARTURE_CITY_INFO[departure] ?? {};
  const depStation = depInfo.rail     ?? `${departure}駅`;
  const depAirport = depInfo.airport  ?? null;
  const depIata    = depInfo.iata     ?? null;

  /* steps[0].from（null）を出発地の駅/空港で埋める */
  const filledSteps = steps.map((s, i) => {
    if (i > 0 || s.from != null) return s;
    const from = s.type === 'flight' ? (depAirport ?? depStation) : depStation;
    return { ...s, from };
  });

  /* mainCTA: 最初の長距離移動（rail または flight）
   *   from === to（出発地がハブ駅と一致）のケースはno-opなのでスキップ
   *   rail/flight がなければ ferry を mainCTA に昇格 */
  const _isNoOp = s => s.from?.replace(/駅$/, '') === s.to?.replace(/駅$/, '');
  const mainRailFlight = filledSteps.find(s =>
    ['rail', 'flight'].includes(s.type) && !_isNoOp(s)
  );
  const mainRawStep = mainRailFlight
    ?? filledSteps.find(s => s.type === 'ferry' && !_isNoOp(s));
  const mainCTA = mainRawStep ? _buildAccessMainCTA(mainRawStep, depIata) : null;

  /* subCTA: ferry のみ（mainCTA が rail/flight のときのみ表示） */
  const ferryRawStep = mainRailFlight
    ? filledSteps.find(s => s.type === 'ferry')
    : null;
  const subCTA = ferryRawStep ? _buildAccessMainCTA(ferryRawStep, depIata) : null;

  /* mapMain: 全体ルート（出発 → 到着先）
   * 優先順: mapPoint → ferryGateway → railGateway → steps[last].to */
  const lastStep = filledSteps[filledSteps.length - 1];
  const mapFrom  = filledSteps[0].from;
  const mapTo    = city?.mapPoint
    ?? city?.ferryGateway
    ?? city?.railGateway
    ?? lastStep.to;
  /* 飛行機起点の場合は driving。それ以外は transit */
  const mapMode  = filledSteps[0].type === 'flight' ? 'driving' : 'transit';
  const mapMain  = {
    from: mapFrom,
    to:   mapTo,
    url:  _accessMapsUrl(mapFrom, mapTo, mapMode),
  };

  /* mapLocal: 最後の local ステップ
   * requiresLocalMove=true の場合は local ステップがなくても出力する */
  const locals    = filledSteps.filter(s => s.type === 'local');
  const lastLocal = locals[locals.length - 1] ?? null;
  let mapLocal = null;
  if (lastLocal) {
    mapLocal = {
      from:   lastLocal.from,
      to:     lastLocal.to,
      method: lastLocal.method ?? null,
      url:    _accessMapsUrl(lastLocal.from, lastLocal.to, 'driving'),
    };
  } else if (city?.requiresLocalMove) {
    /* steps に local がなくても要ローカル移動 → 最終ステップ到着地 → 目的地 */
    const localFrom = lastStep.to;
    const localTo   = city.mapPoint ?? city.name;
    if (localFrom && localTo && localFrom !== localTo) {
      mapLocal = {
        from:   localFrom,
        to:     localTo,
        method: null,
        url:    _accessMapsUrl(localFrom, localTo, 'driving'),
      };
    }
  }

  return {
    mainCTA,
    ...(subCTA   ? { subCTA }   : {}),
    mapMain,
    ...(mapLocal ? { mapLocal } : {}),
    steps: filledSteps,
  };
}

/* ── 内部ヘルパー（access.steps 専用） ── */

function _accessMapsUrl(from, to, mode = 'transit') {
  if (!from || !to) return null;
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(from)}` +
    `&destination=${encodeURIComponent(to)}` +
    `&travelmode=${mode}`
  );
}

function _buildAccessMainCTA(step, depIata) {
  /* CTA ラベルは step.from / step.to をそのまま使用（city 単位への置換禁止） */
  const from = step.from ?? '';
  const to   = step.to   ?? '';

  if (step.type === 'rail') {
    const booking = RAIL_PROVIDER_BOOKING[step.provider];
    if (!booking) return null;
    return {
      type:     'rail',
      from,
      to,
      provider: step.provider,
      btnType:  booking.btnType,
      url:      booking.url,
      label:    `${step.provider}で予約する（${from} → ${to}まで）`,
    };
  }

  if (step.type === 'flight') {
    const toIata = AIRPORT_IATA[step.to];
    if (!toIata || !depIata) return null;
    return {
      type:     'flight',
      from,
      to,
      provider: '航空会社',
      btnType:  'skyscanner',
      url:      `https://www.skyscanner.jp/transport/flights/${depIata.toLowerCase()}/${toIata.toLowerCase()}/`,
      label:    `航空券を予約する（${from} → ${to}まで）`,
    };
  }

  if (step.type === 'ferry') {
    const url = step.bookingUrl ?? 'https://www.jalan.net/ship/';
    return {
      type:     'ferry',
      from,
      to,
      provider: step.operator ?? 'フェリー',
      btnType:  'ferry',
      url,
      label:    `フェリーを予約する（${from} → ${to}まで）`,
    };
  }

  return null;
}

/**
 * access.steps[] から card-section を組み立てて返す。
 */
function buildAccessBlock(city, departure) {
  const steps = city?.access?.steps;
  if (!steps?.length) return '';

  const uiData = resolveAccessUI(steps, departure, city);
  if (!uiData) return '';

  const { mainCTA, subCTA, mapMain } = uiData;
  const destLabel = city.displayName ?? city.name;

  /* ① mapMain — 全体ルートマップ（最上部） */
  const mapFromLabel = mapMain.from?.replace(/駅$/, '') ?? '';
  const mapMainHtml  = mapMain.url
    ? `<div class="route-map-row">
         <a href="${mapMain.url}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">${mapFromLabel} → ${mapMain.to}の行き方を地図で見る</a>
       </div>`
    : '';

  /* ② mainCTA — rail または flight の予約ボタン（1つのみ） */
  const mainCtaHtml = mainCTA?.url
    ? `<div class="main-cta-row">
         <a href="${mainCTA.url}" target="_blank" rel="noopener noreferrer"
            class="btn ${btnClass(mainCTA.btnType)} btn--route-main">${mainCTA.label}</a>
       </div>`
    : '';

  /* ③ steps — 説明のみ（ボタンなし） */
  const stepsHtml = uiData.steps
    .map((s, i) => _buildAccessStepCard(s, i))
    .join('');

  /* ④ subCTA — ferry のみ（steps の後） */
  const subCtaHtml = subCTA?.url
    ? `<div class="sub-cta-row">
         <a href="${subCTA.url}" target="_blank" rel="noopener noreferrer"
            class="btn ${btnClass(subCTA.btnType)}">${subCTA.label}</a>
       </div>`
    : '';

  return `
    <div class="card-section">
      ${mapMainHtml}
      <div class="route-summary">${buildRouteSummary(departure, destLabel, city)}</div>
      ${mainCtaHtml}
      <div class="step-list">${stepsHtml}</div>
      ${subCtaHtml}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

function _buildAccessStepCard(step, index) {
  const num      = ACCESS_STEP_NUMS[index] ?? `(${index + 1})`;
  const fromDisp = step.from?.replace(/駅$/, '') ?? '';
  const toDisp   = step.to?.replace(/駅$/, '') ?? '';
  const mode     = step.type === 'local'
    ? (step.method ?? '現地移動')
    : ({ rail: '鉄道', flight: '飛行機', ferry: 'フェリー' }[step.type] ?? step.type);

  const subNote = step.type === 'ferry' && step.operator
    ? `<p class="step-card-caution">${step.operator}</p>`
    : '';

  return `
    <div class="step-card">
      <div class="step-card-header">${num}  ${fromDisp} → ${toDisp}（${mode}）</div>
      ${subNote}
    </div>
  `;
}

function _buildAccessLocalSection(mapLocal, filledSteps, city) {
  if (!mapLocal) return '';

  const needsRental = mapLocal.method === 'レンタカー';
  const gatewayCity = needsRental ? (mapLocal.from?.replace(/駅$/, '') ?? null) : null;
  const rentalLink  = needsRental ? buildRentalLink(gatewayCity) : null;

  const fromDisp = mapLocal.from?.replace(/駅$/, '').replace(/港$/, '') ?? '';
  const toDisp   = mapLocal.to?.replace(/駅$/, '').replace(/港$/, '') ?? '';

  const mapBtnHtml = mapLocal.url
    ? `<a href="${mapLocal.url}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">地図で見る</a>`
    : '';
  const rentalHtml = rentalLink?.url
    ? `<a href="${rentalLink.url}" target="_blank" rel="noopener noreferrer" class="btn btn-rental">${rentalLink.label}</a>`
    : '';

  if (!mapBtnHtml && !rentalHtml) return '';

  return `
    <div class="local-section">
      <div class="local-header">最後の移動</div>
      <p class="local-route">${fromDisp} → ${toDisp}</p>
      <div class="link-list">${mapBtnHtml}${rentalHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildHotelSection(section) {
  const buttonsHtml = section.links.map(l =>
    `<a href="${l.url}" target="_blank" rel="nofollow sponsored noopener" class="stay-btn stay-btn--${l.type}">${l.label}</a>`
  ).join('');
  return `<p class="stay-label">${section.heading}</p><div class="stay-buttons">${buttonsHtml}</div>`;
}

function buildStayBlock(hotelLinks) {
  if (!hotelLinks?.links?.length) return '';
  // 表示順: 現地 → ハブ
  let hubHtml = '';
  if (hotelLinks.hubLinks?.links?.length) {
    hubHtml = buildHotelSection(hotelLinks.hubLinks);
  }
  return `
    <div class="stay-block">
      ${buildHotelSection(hotelLinks)}
      ${hubHtml}
    </div>`;
}

/* ── リンクアイテム ── */

function btnClass(type) {
  if (type === 'jr-east')        return 'btn-jr-east';
  if (type === 'jr-west')        return 'btn-jr-west';
  if (type === 'jr-kyushu')      return 'btn-jr-kyushu';
  if (type === 'jr-ex')          return 'btn-jr-ex';
  if (type === 'jr-window')      return 'btn-jr-window';
  if (type === 'skyscanner')     return 'btn-skyscanner';
  if (type === 'google-flights') return 'btn-google-flights';
  if (type === 'ferry')          return 'btn-ferry';
  if (type === 'bus')            return 'btn-bus';
  if (type === 'rental')         return 'btn-rental';
  if (type === 'google-maps')    return 'btn-secondary';
  return 'btn-primary';
}

function buildLinkItem(link, isPrimary = false) {
  const topClass = isPrimary ? ' btn--top' : '';
  return `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
       class="btn ${btnClass(link.type)}${topClass}">
      ${link.label}
    </a>
  `;
}

/* ── シェアブロック ── */

function buildShareBlock() {
  return `
    <div class="share-block">
      <button class="btn-share btn-share--x" id="share-x-btn">
        📤 Xでシェア
      </button>
      <button class="btn-copy" id="share-copy-btn">
        📋 URLをコピー
      </button>
    </div>
  `;
}
