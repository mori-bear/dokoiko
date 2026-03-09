/**
 * DOM描画モジュール
 *
 * カード表示順:
 *   result-card
 *     result-counter
 *     city-block（都市名/地域/タグ/スポット/説明文）
 *     card-section        （交通リンク）
 *     stay-block          （近くで泊まる — hotelHub）
 *     car-block           （レンタカー — needsCar=true のみ）
 *     share-block         （Xシェア）
 */

import { applyAffiliateLinks } from '../affiliate/affiliate.js';

export function renderResult({ city, transportLinks, hotelLinks }) {
  const { hotelHub } = hotelLinks;

  const el = document.getElementById('result-inner');
  el.innerHTML = `
    <div class="result-card">
      ${buildCityBlock(city)}
      ${buildTransportBlock(transportLinks)}
      ${buildStayBlock(hotelHub)}
      ${city.needsCar ? buildCarBlock() : ''}
      ${buildShareBlock(city)}
    </div>
  `;

  applyAffiliateLinks(hotelHub);
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
  const linksHtml = links.map((link) => buildLinkItem(link)).join('');
  return `
    <div class="card-section">
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildStayBlock(hotelHub) {
  return `
    <div class="stay-block">
      <p class="stay-label">近くで泊まる（${hotelHub}）</p>
      <div class="stay-buttons">
        <a id="jalanHotelBtn" target="_blank" rel="nofollow sponsored noopener">じゃらん</a>
        <a id="rakutenHotelBtn" target="_blank" rel="nofollow sponsored noopener">楽天トラベル</a>
      </div>
    </div>
  `;
}

/* ── レンタカーブロック（needsCar=true のみ） ── */

function buildCarBlock() {
  return `
    <div class="car-block">
      <a id="jalanRentBtn" target="_blank" rel="noopener noreferrer">レンタカーを探す</a>
    </div>
  `;
}

/* ── Xシェアブロック ── */

function buildShareBlock(city) {
  const text = `今日の旅先\n\n${city.name}\n\n#どこ行こ`;
  const url  = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  return `
    <div class="share-block">
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-share">
        この旅をシェア
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
  if (type === 'rakuten')    return 'btn-rakuten';
  if (type === 'jalan' || type === 'jalan-rental') return 'btn-jalan';
  if (type === 'ferry')      return 'btn-ferry';
  if (type === 'google-maps' || type === 'rental') return 'btn-secondary';
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
