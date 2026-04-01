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
 * ステップを main / transfer / local に分類し、
 * 目的地地図 → ルート概要 → main（CTA付き）→ 乗換まとめ → 到着後 の順で描画。
 */
function buildStepsBlock(links, departure, destLabel, city = null) {
  const summaryLink = links.find(l => l.type === 'summary');
  const stepGroups  = links.filter(l => l.type === 'step-group');
  const rentalLinks = links.filter(l => l.type === 'rental');

  // ① 目的地地図
  const mapUrl  = buildDestMapUrl(city);
  const mapHtml = mapUrl
    ? `<div class="dest-map-row"><a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${destLabel || '目的地'}の場所を地図で見る</a></div>`
    : '';

  // ② ルート概要
  const transfers   = summaryLink?.transfers ?? Math.max(0, stepGroups.length - 1);
  const transferStr = transfers === 0 ? '直通' : `乗換${transfers}回`;
  const summaryHtml = (departure && destLabel)
    ? `<div class="route-summary">${departure} → ${destLabel}（${transferStr}）</div>`
    : '';

  // ③ ステップ分類
  const { main, transfer, local } = classifyStepGroups(stepGroups);

  // main が空（純在来線ルート）の場合は transfer を full card で表示
  const primarySteps   = main.length > 0 ? main : transfer;
  const secondarySteps = main.length > 0 ? transfer : [];

  // ④ main セクション（先頭を強調 isPrimary=true）
  const primaryHtml  = primarySteps.map((sg, i) => buildStepCard(sg, i === 0)).join('');
  // ⑤ 乗換セクション
  const transferHtml = buildTransferSection(secondarySteps, stepGroups);
  // ⑥ 到着後セクション（city を渡してヒント表示）
  const localHtml    = buildLocalSection(local, rentalLinks, city);

  return `
    <div class="card-section">
      ${mapHtml}
      ${summaryHtml}
      <div class="step-list">${primaryHtml}</div>
      ${transferHtml}
      ${localHtml}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/**
 * 1ステップ分のカードを描画する。
 * stepLabel（"① ✈ 高松空港 → 福岡空港（飛行機）"）をヘッダーに表示し、
 * type 別にオーバーライドした CTA ボタンと、car step の rentalLink を配置する。
 */
function buildStepCard(sg, isPrimary = false) {
  const ctaLabel  = buildStepCtaLabel(sg);
  const btnExtra  = isPrimary ? ' btn--primary' : '';
  const ctaHtml   = (sg.cta?.url && ctaLabel)
    ? `<a href="${sg.cta.url}" target="_blank" rel="noopener noreferrer"
           class="btn ${btnClass(sg.cta.type)}${btnExtra}">${ctaLabel}</a>`
    : '';

  const rentalHtml = sg.rentalLink?.url
    ? `<a href="${sg.rentalLink.url}" target="_blank" rel="noopener noreferrer"
           class="btn btn-rental">${sg.rentalLink.label}</a>`
    : '';

  const cautionHtml = sg.caution
    ? `<p class="step-card-caution">${sg.caution}</p>`
    : '';

  // stepLabel も表示要素も何もない場合のみスキップ
  if (!sg.stepLabel && !ctaHtml && !rentalHtml && !cautionHtml) return '';

  // CTA/rentalがある場合のみ link-list ブロックを表示
  const linksBlock = (ctaHtml || rentalHtml)
    ? `<div class="link-list">${ctaHtml}${rentalHtml}</div>`
    : '';

  const cardClass = `step-card${isPrimary ? ' step-card--primary' : ''}`;
  return `
    <div class="${cardClass}">
      <div class="step-card-header">${sg.stepLabel ?? ''}</div>
      ${linksBlock}
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
      return fromTo ? `Googleマップで確認（${fromTo}）` : 'Googleマップで確認';
    case 'skyscanner':
    case 'google-flights':
      return fromTo ? `飛行機で行く（${fromTo}）` : cta.label;
    case 'ferry':
      return fromTo ? `フェリーを予約する（${fromTo}）` : cta.label;
    case 'bus':
      return fromTo ? `バスで行く（${fromTo}）` : cta.label;
    case 'jr-east':
    case 'jr-west':
    case 'jr-kyushu':
    case 'jr-ex':
    case 'jr-window':
      if (stepMode === '新幹線') return fromTo ? `新幹線で行く（${fromTo}）` : '新幹線で行く';
      return null; // JR在来線・私鉄はCTAなし（ステップラベルのみ表示）
    default:
      return cta.label ?? '';
  }
}

/* ── 目的地地図URL ── */

function buildDestMapUrl(city) {
  if (!city) return null;
  if (city.lat && city.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${city.lat},${city.lng}`;
  }
  const name = city.displayName || city.name || '';
  return name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}` : null;
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
  // 島・フェリー目的地は ferry step で完結しているのでヒント不要
  if (city.isIsland || city.destType === 'island') return '';

  const needsCar = city.needsCar === true
    || city.destType === 'mountain'
    || city.destType === 'remote';
  const hasBus   = city.railNote === 'バス' || city.busGateway != null;

  if (needsCar) {
    return `<p class="local-hint local-hint--car">⚠ レンタカー推奨エリアです</p>`;
  }
  if (hasBus) {
    const station = (city.accessStation ?? '').replace(/駅$/, '') || '最寄り駅';
    return `<p class="local-hint">バスでアクセスできます（${station}から）</p>`;
  }
  if (city.accessStation?.endsWith('駅')) {
    const station = city.accessStation.replace(/駅$/, '');
    return `<p class="local-hint">${station}駅から徒歩・バスで移動</p>`;
  }
  return '';
}

/**
 * 到着後のローカル移動（Googleマップ・レンタカー）をまとめて表示する。
 * city を受け取ってローカル交通ヒントも表示する。
 */
function buildLocalSection(localSteps, rentalLinks = [], city = null) {
  const hint = buildLocalTransportHint(city);
  if (!localSteps.length && !rentalLinks.length && !hint) return '';

  const stepItems = localSteps.map(sg => {
    const label      = buildStepCtaLabel(sg) ?? 'Googleマップで確認';
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

  const content = stepItems + standaloneHtml;
  if (!content.trim() && !hint) return '';

  return `
    <div class="local-section">
      <div class="local-header">到着後の移動</div>
      ${hint}
      ${content}
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
