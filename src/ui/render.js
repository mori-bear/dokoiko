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
      ${hasDestHotel ? buildStayBlock() : ''}
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
  const spotListHtml  = buildSpotList(city.spots);

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-sub">${city.region}${categoryBadge}</p>
      </div>
      ${accessLine}
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      ${spotListHtml}
      <div class="city-appeal">${atmosphereHtml}</div>
    </div>
  `;
}

function buildAccessLine(city) {
  const { access } = city;
  if (!access) return '';

  if (access.railGateway) {
    const note = access.railNote ? `、${access.railNote}` : 'から市内へ';
    const text = access.railNote
      ? `${access.railGateway}${note}`
      : `${access.railGateway}から市内へ`;
    return `<p class="access-line">${text}</p>`;
  }

  if (access.airportGateway) {
    return `<p class="access-line">${access.airportGateway}からアクセス</p>`;
  }

  if (access.ferryGateway) {
    return `<p class="access-line">${access.ferryGateway}からフェリーで</p>`;
  }

  return '';
}

function buildSpotList(spots) {
  if (!Array.isArray(spots) || spots.length === 0) return '';
  const items = spots.map((s) => `<li>${s}</li>`).join('');
  return `
    <div class="spot-list">
      <p class="spot-title">代表スポット</p>
      <ul>${items}</ul>
    </div>
  `;
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
  if (type === 'jr-east')    return 'btn-jr-east';
  if (type === 'jr-west')    return 'btn-jr-west';
  if (type === 'jr-kyushu')  return 'btn-jr-kyushu';
  if (type === 'jr-ex')      return 'btn-jr-ex';
  if (type === 'skyscanner') return 'btn-skyscanner';
  if (type === 'rakuten')                        return 'btn-rakuten';
  if (type === 'jalan' || type === 'jalan-rental') return 'btn-jalan';
  if (type === 'google-maps' || type === 'rental') return 'btn-secondary';
  return 'btn-primary'; // bus, ferry, fallback
}

/* ── アフィリエイト宿泊ブロック（IDs は applyAffiliateLinks が書き換え） ── */

function buildStayBlock() {
  return `
    <div class="stay-block">
      <h3>この街に泊まる</h3>
      <div class="stay-buttons">
        <a id="jalanHotelBtn" target="_blank" rel="noopener noreferrer">じゃらん</a>
        <a id="rakutenHotelBtn" target="_blank" rel="noopener noreferrer">楽天トラベル</a>
      </div>
      <div class="rent-block">
        <a id="jalanRentBtn" target="_blank" rel="noopener noreferrer">レンタカーを見る</a>
      </div>
    </div>
  `;
}

function buildLinkItem(link) {
  return `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
       class="btn ${btnClass(link.type)}">
      ${link.label}
    </a>
  `;
}
