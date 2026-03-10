/**
 * DOM描画モジュール
 *
 * カード表示順:
 *   result-card
 *     city-block（都市名/地域/タグ/スポット/説明文）
 *     card-section        （交通リンク）
 *     stay-block          （この街に泊まるなら — stayType !== daytrip のみ）
 *     share-block         （X / LINE シェア + コピー）
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
      ${buildShareBlock(city)}
    </div>
  `;
}

export function clearResult() {
  const el = document.getElementById('result-inner');
  if (el) el.innerHTML = '';
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

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-sub">${city.region}${categoryBadge}</p>
      </div>
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      ${spotListHtml}
      <div class="city-appeal">${descriptionHtml}</div>
    </div>
  `;
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
  if (!city.isIsland) return '';
  return `　<span class="type-badge type-island">島</span>`;
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

/* ── SNSシェア＋コピーブロック ── */

function buildShareBlock(city) {
  const xText  = encodeURIComponent(`今日の旅先は${city.name} #どこ行こ`);
  const siteUrl = encodeURIComponent('https://tabidokoiko.com');
  const xUrl   = `https://twitter.com/intent/tweet?text=${xText}&url=${siteUrl}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${siteUrl}`;

  return `
    <div class="share-block">
      <a href="${xUrl}" target="_blank" rel="noopener noreferrer" class="btn-share btn-share--x">
        Xでシェア
      </a>
      <a href="${lineUrl}" target="_blank" rel="noopener noreferrer" class="btn-share btn-share--line">
        LINEでシェア
      </a>
    </div>
  `;
}

/* ── リンクアイテム ── */

function btnClass(type) {
  if (type === 'jr-east')    return 'btn-jr-east';
  if (type === 'jr-west')    return 'btn-jr-west';
  if (type === 'jr-kyushu')  return 'btn-jr-kyushu';
  if (type === 'jr-ex')      return 'btn-jr-ex';
  if (type === 'skyscanner') return 'btn-skyscanner';
  if (type === 'ferry')      return 'btn-ferry';
  if (type === 'rental')     return 'btn-rental';
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
