/**
 * DOM描画モジュール
 *
 * カード表示順:
 *   result-card
 *     city-block（都市名/地域/タグ/スポット/説明文）
 *     card-section        （交通リンク）
 *     stay-block          （この街に泊まるなら — stayType !== daytrip のみ）
 *     （share-block は削除済み）
 */

export function renderResult({ city, transportLinks, hotelLinks, stayType }) {
  const hub       = city.hotelHub ?? city.name;
  const showHotel = stayType !== 'daytrip';

  const el = document.getElementById('result-inner');
  el.innerHTML = `
    <div class="result-card">
      ${buildCityBlock(city)}
      ${buildTransportBlock(transportLinks)}
      ${showHotel ? buildStayBlock(hub, hotelLinks) : ''}
    </div>
  `;
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

  const nearbyHtml   = buildNearbyList(city.nearby);
  const itineraryHtml = buildItineraryList(city.itinerary);

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-sub">${city.prefecture}${city.city || city.name}${categoryBadge}</p>
        ${city.accessStation ? `<p class="city-station">${accessLabel(city.accessStation)}：${city.accessStation}</p>` : ''}
      </div>
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      ${spotListHtml}
      <div class="city-appeal">${descriptionHtml}</div>
      ${nearbyHtml}
      ${itineraryHtml}
    </div>
  `;
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
  const isIsland = city.isIsland || city.destType === 'island';
  const isOnsen  = city.destType === 'onsen';
  const isSight  = city.destType === 'sight';
  if (isIsland) return `　<span class="type-badge type-island">島</span>`;
  if (isOnsen)  return `　<span class="type-badge type-onsen">温泉</span>`;
  if (isSight)  return `　<span class="type-badge type-sight">自然</span>`;
  return '';
}

/* ── 交通ブロック ── */

function buildTransportBlock(links) {
  const linksHtml = links.map((link) =>
    link.type === 'note'
      ? `<div class="transport-note">${link.label}</div>`
      : buildLinkItem(link)
  ).join('');
  return `
    <div class="card-section">
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildStayBlock(hub, links) {
  const buttonsHtml = links.map(link => `
    <a href="${link.url}" target="_blank" rel="nofollow sponsored noopener"
       class="stay-btn stay-btn--${link.type}">${link.label}</a>
  `).join('');
  return `
    <div class="stay-block">
      <p class="stay-label">この街に泊まるなら</p>
      <div class="stay-buttons">${buttonsHtml}</div>
    </div>
  `;
}

/* ── リンクアイテム ── */

function btnClass(type) {
  if (type === 'jr-east')     return 'btn-jr-east';
  if (type === 'jr-west')     return 'btn-jr-west';
  if (type === 'jr-kyushu')   return 'btn-jr-kyushu';
  if (type === 'jr-ex')       return 'btn-jr-ex';
  if (type === 'skyscanner')     return 'btn-skyscanner';
  if (type === 'google-flights') return 'btn-google-flights';
  if (type === 'ferry')          return 'btn-ferry';
  if (type === 'rental')      return 'btn-rental';
  if (type === 'google-maps') return 'btn-secondary';
  return 'btn-primary';
}

function buildLinkItem(link) {
  return `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
       class="btn ${btnClass(link.type)}">
      ${link.label}
    </a>
  `;
}
