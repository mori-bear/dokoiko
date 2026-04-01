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

export function renderResult({ city, transportLinks, altTransportLinks, hotelLinks, stayType, departure }) {
  // 白画面防止 — レンダリングエラーを catch してフォールバック表示
  try {
    const showHotel = stayType !== 'daytrip';

    const el = document.getElementById('result-inner');
    el.innerHTML = `
      <div class="result-card">
        ${buildCityBlock(city)}
        ${buildTransportBlock(transportLinks, departure, city.displayName || city.name, city)}
        ${altTransportLinks ? buildAltRouteBlock(altTransportLinks, departure) : ''}
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
  /* step-group 方式（新方式）*/
  if (links.some(l => l.type === 'step-group')) {
    return buildTransportBlockStepwise(links, departure, destLabel, city);
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

  const headingHtml = departure
    ? `<p class="transport-heading">${departure}からの行き方</p>`
    : '';

  return `
    <div class="card-section">
      ${headingHtml}
      ${summaryHtml}
      <div class="link-list">${buttonsHtml}</div>
      ${cautionsHtml}
      ${stepHtml}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/* ── accessStation ガイドテキスト生成 ── */

function buildAccessStationHint(city) {
  if (!city?.accessStation) return '';
  const station = city.accessStation;
  let moveMethod = 'そこから移動';
  if (city.needsCar || city.destType === 'remote' || city.destType === 'mountain') {
    moveMethod = 'レンタカーで移動';
  } else if (station.endsWith('港')) {
    moveMethod = 'フェリーで移動';
  } else if (station.endsWith('空港')) {
    moveMethod = 'そこから移動';
  }
  return `<p class="access-station-hint">${station.replace(/駅$/, '')}まで予約 → ${moveMethod}</p>`;
}

/* ── 交通ブロック（step-group 新方式） ── */

function buildTransportBlockStepwise(links, departure, destLabel, city = null) {
  const summaryLink = links.find(l => l.type === 'summary');
  const mainCtaLink = links.find(l => l.type === 'main-cta');
  const stepGroups  = links.filter(l => l.type === 'step-group');

  // 概要: 出発地 → 目的地
  const summaryHtml = (departure && destLabel)
    ? `<div class="route-summary">${departure} → ${destLabel}</div>`
    : '';

  // ① 全体マップ（driving 固定・俯瞰）
  const departurePoint = summaryLink?.waypoints?.[0] ?? departure;
  // mapPoint優先（温泉郷など抽象地名は駅名・具体地点に置換）、なければ表示名
  const destTarget = city?.mapPoint ?? destLabel;
  const overallMapsHtml = (departurePoint && destTarget)
    ? `<a href="${
        'https://www.google.com/maps/dir/?api=1' +
        `&origin=${encodeURIComponent(departurePoint)}` +
        `&destination=${encodeURIComponent(destTarget)}` +
        `&travelmode=driving`
      }" target="_blank" rel="noopener noreferrer"
         class="btn btn-secondary btn--route-overall">
         どこに行くか地図で見る
       </a>`
    : '';

  // ② 予約CTA（JR / 航空券 / フェリー）
  const mainCtaHtml = mainCtaLink?.cta
    ? `<a href="${mainCtaLink.cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn ${btnClass(mainCtaLink.cta.type)} btn--route-main">
         ${mainCtaLink.cta.label}
       </a>`
    : '';

  // ③ ローカル移動セクション — JR/新幹線で完結するルートは非表示
  const JR_TYPES_RENDER = ['jr-east', 'jr-west', 'jr-ex', 'jr-kyushu', 'jr-window'];
  const mainCtaType = mainCtaLink?.cta?.type;
  const isJrComplete = JR_TYPES_RENDER.includes(mainCtaType);

  // standalone rental（needsCar 補完分 — car step に紐付かないもの）
  const standaloneRentals = links.filter(l => l.type === 'rental');

  const localBlockHtml = (() => {
    if (isJrComplete) return '';
    // google-maps CTA を持つ step-group がローカル移動候補
    const localSteps = stepGroups.filter(sg => sg.cta?.type === 'google-maps');
    if (localSteps.length === 0 && standaloneRentals.length === 0) return '';

    const stepHtml = localSteps.map(sg => buildLocalStep(sg)).join('');
    const standaloneRentalHtml = standaloneRentals.map(r =>
      `<a href="${r.url}" target="_blank" rel="noopener noreferrer"
          class="btn btn-rental">${r.label}</a>`
    ).join('');

    return `
      <div class="card-section">
        <p class="section-label">到着後の移動</p>
        ${stepHtml}
        ${standaloneRentalHtml ? `<div class="link-list">${standaloneRentalHtml}</div>` : ''}
      </div>
    `;
  })();

  // 表示順: 概要 → ① 全体マップ → ② 予約CTA | ③ ローカル移動（別セクション）
  return `
    <div class="card-section">
      ${summaryHtml}
      ${overallMapsHtml}
      ${mainCtaHtml}
    </div>
    ${localBlockHtml}
  `;
}

/* ── ローカル移動カード（到着後の移動セクション用） ── */

/**
 * 1件のローカル移動ステップを描画する。
 * stepLabel から "from → to（mode）" を抽出してルートラベルとして表示。
 * rentalLink があればレンタカーCTA（primary）、google-maps CTA は「行き方を確認する」（secondary）。
 */
function buildLocalStep(sg) {
  // stepLabel 例: "① 🚗 鹿児島中央駅 → 霧島（レンタカー）"
  // → ステップ番号とアイコンを除去、駅 suffix を削除してルートラベルに
  const raw = sg.stepLabel?.replace(/^[①-⑨\d\.]+\s+\S+\s+/u, '') ?? '';
  const routeLabel = raw.replace(/駅\s*→/, ' →');  // "鹿児島中央駅 →" → "鹿児島中央 →"

  const rentalHtml = sg.rentalLink?.url
    ? `<a href="${sg.rentalLink.url}" target="_blank" rel="noopener noreferrer"
           class="btn btn-rental">${sg.rentalLink.label}</a>`
    : '';

  const mapsHtml = sg.cta?.url
    ? `<a href="${sg.cta.url}" target="_blank" rel="noopener noreferrer"
           class="btn btn-secondary">行き方を確認する</a>`
    : '';

  if (!rentalHtml && !mapsHtml) return '';

  return `
    <div class="local-step">
      <div class="local-step-route">${routeLabel}</div>
      <div class="link-list">
        ${rentalHtml}
        ${mapsHtml}
      </div>
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

/* ── 代替ルート（直行レンタカー）ブロック ── */

function buildAltRouteBlock(altLinks, departure) {
  const mainCta    = altLinks.find(l => l.type === 'main-cta')?.cta;
  const rentalLink = altLinks.find(l => l.type === 'rental');
  if (!mainCta) return '';
  const rentalHtml = rentalLink ? buildLinkItem(rentalLink) : '';
  return `
    <div class="card-section card-section--alt-route">
      <p class="transport-heading">または：レンタカーで直行する</p>
      <div class="link-list">
        <a href="${mainCta.url}" target="_blank" rel="noopener noreferrer"
           class="btn btn-secondary btn--top">
          ${mainCta.label}
        </a>
        ${rentalHtml}
      </div>
    </div>
  `;
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
