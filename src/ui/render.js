/**
 * DOM描画モジュール
 *
 * カード構造:
 *   result-card
 *     result-counter
 *     city-block
 *     card-section        （交通リンク、見出しなし）
 *     card-section--hotel （宿泊リンク、見出しなし）
 */

export function renderResult({ city, transportLinks, hotelLinks, distanceLabel, poolIndex, poolTotal }) {
  const hasDestHotel = hotelLinks.destination.length > 0;
  const hasHubHotel  = hotelLinks.hub.length > 0;

  const el = document.getElementById('result-inner');
  el.innerHTML = `
    <div class="result-card">
      ${buildCounterBlock(poolIndex, poolTotal)}
      ${buildCityBlock(city, distanceLabel)}
      ${buildTransportBlock(transportLinks)}
      ${hasDestHotel ? buildHotelBlock(hotelLinks.destination) : ''}
      ${hasHubHotel  ? buildHotelBlock(hotelLinks.hub) : ''}
    </div>
  `;
}

export function clearResult() {
  const el = document.getElementById('result-inner');
  if (el) el.innerHTML = '';
}

/* ── カウンター ── */

function buildCounterBlock(index, total) {
  return `
    <div class="result-counter">
      <span>${index + 1} / ${total}</span>
    </div>
  `;
}

/* ── 都市ブロック ── */

function buildCityBlock(city, _distanceLabel) {
  const accessLine = buildAccessLine(city);

  const atmosphereHtml = (city.atmosphere || [])
    .map((line) => `<p class="appeal-line">${line}</p>`)
    .join('');

  const themesHtml = Array.isArray(city.themes) && city.themes.length
    ? city.themes.map((t) => `<span class="theme-tag">${t}</span>`).join('')
    : '';

  const categoryBadge = buildCategoryBadge(city.type);

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-sub">${city.region}${categoryBadge}</p>
      </div>
      ${accessLine}
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      <div class="city-appeal">${atmosphereHtml}</div>
    </div>
  `;
}

function buildAccessLine(city) {
  const { access } = city;
  if (!access) return '';

  if (access.railGateway) {
    return `<p class="access-line">${access.railGateway}から街へ</p>`;
  }

  if (access.airportGateway) {
    return `<p class="access-line">${access.airportGateway}から市内へ</p>`;
  }

  if (access.ferryGateway) {
    return `<p class="access-line">${access.ferryGateway}からフェリー</p>`;
  }

  return '';
}

function buildCategoryBadge(type) {
  if (type !== 'island') return '';
  return `　<span class="type-badge type-island">島</span>`;
}

/* ── 交通ブロック ── */

function buildTransportBlock(links) {
  const linksHtml = links.map((link) => buildLinkItem(link)).join('');
  return `
    <div class="card-section">
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildHotelBlock(links) {
  const linksHtml = links.map((link) => buildLinkItem(link)).join('');
  return `
    <div class="card-section card-section--hotel">
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

function btnClass(type) {
  if (['rakuten'].includes(type))                              return 'btn-rakuten';
  if (['jalan', 'jalan-rental'].includes(type))               return 'btn-jalan';
  if (['google-maps', 'rental'].includes(type))               return 'btn-secondary';
  return 'btn-primary'; // jr-*, skyscanner, bus, ferry
}

function buildLinkItem(link) {
  return `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
       class="btn ${btnClass(link.type)}">
      ${link.label}
    </a>
  `;
}
