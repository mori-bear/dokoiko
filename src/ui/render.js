/**
 * DOM描画モジュール
 *
 * 表示順:
 *   1. カウンター（あとN件）
 *   2. 都市ブロック（アクセス行 + 空気感3行）
 *   3. 交通ブロック
 *   4. 宿泊ブロック（stayType=1night 時のみ）
 */

export function renderResult({ city, transportLinks, hotelLinks, distanceLabel, poolIndex, poolTotal }) {
  const hasDestHotel = hotelLinks.destination.length > 0;
  const hasHubHotel  = hotelLinks.hub.length > 0;
  const isLast = !hasDestHotel && !hasHubHotel;

  const el = document.getElementById('result-inner');
  el.innerHTML = [
    buildCounterBlock(poolIndex, poolTotal),
    buildCityBlock(city, distanceLabel),
    buildTransportBlock(transportLinks, isLast),
    hasDestHotel ? buildHotelBlock(hotelLinks.destination, city.name,  !hasHubHotel) : '',
    hasHubHotel  ? buildHotelBlock(hotelLinks.hub,         'ハブ拠点', true) : '',
  ].join('');
}

export function clearResult() {
  const el = document.getElementById('result-inner');
  if (el) el.innerHTML = '';
}

/* ── カウンター ── */

function buildCounterBlock(index, total) {
  const remaining = total - index - 1;
  const remainingText = remaining > 0
    ? `あと${remaining}件あります`
    : 'すべて表示しました';
  return `
    <div class="result-counter">
      <span>${remainingText}</span>
      <span>${index + 1} / ${total}</span>
    </div>
  `;
}

/* ── 都市ブロック ── */

function buildCityBlock(city, _distanceLabel) {
  const accessSentence = buildAccessSentence(city);

  const atmosphereHtml = (city.atmosphere || [])
    .map((line) => `<p class="appeal-line">${line}</p>`)
    .join('');

  const themesHtml = Array.isArray(city.themes) && city.themes.length
    ? city.themes.map((t) => `<span class="theme-tag">${t}</span>`).join('')
    : '';

  const categoryBadge = buildCategoryBadge(city.category);

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${city.name}</h2>
        <p class="city-sub">${city.region}${categoryBadge}</p>
      </div>
      ${accessSentence}
      ${themesHtml ? `<div class="themes-row">${themesHtml}</div>` : ''}
      <div class="city-appeal">${atmosphereHtml}</div>
    </div>
  `;
}

/**
 * アクセス文（1文目固定）
 *
 * 代表入口（駅/空港/港）と二次交通を1文に統合して表示する。
 * 「直結」は使用禁止。動詞で終わる形式を保つ。
 *
 * 形式:
 *   rail + lastTransport  → 「○○駅から、△△」
 *   rail + null           → 「○○駅から直接アクセス」
 *   air  + lastTransport  → 「○○空港から、△△」
 *   air  + null           → 「○○空港に到着後すぐ市内へ」
 *   ferry                 → 「○○港からフェリー（△△）」
 */
function buildAccessSentence(city) {
  const { access } = city;
  if (!access) return '';

  if (access.rail?.gatewayStation) {
    const { gatewayStation, lastTransport } = access.rail;
    const journey = lastTransport
      ? `から、${lastTransport}`
      : 'から直接アクセス';
    return `<p class="access-sentence">${gatewayStation}${journey}</p>`;
  }

  if (access.air?.airportName) {
    const { airportName, lastTransport } = access.air;
    const journey = lastTransport
      ? `から、${lastTransport}`
      : 'に到着後すぐ市内へ';
    return `<p class="access-sentence">${airportName}${journey}</p>`;
  }

  if (access.ferry?.portName) {
    const { portName, lastTransport } = access.ferry;
    const dur = lastTransport ? `（${lastTransport}）` : '';
    return `<p class="access-sentence">${portName}からフェリー${dur}</p>`;
  }

  return '';
}

function buildCategoryBadge(category) {
  const labels = {
    onsen:  '温泉',
    island: '島',
    rural:  '自然',
    town:   '町',
  };
  const label = labels[category] || '';
  if (!label) return '';
  return `　<span class="type-badge type-${category}">${label}</span>`;
}

/* ── 交通ブロック ── */

function buildTransportBlock(links, isLast) {
  const lastClass = isLast ? ' result-block-last' : '';
  const linksHtml = links.map((link) => buildLinkItem(link)).join('');
  return `
    <div class="result-block${lastClass}">
      <div class="block-label">交通</div>
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildHotelBlock(links, areaLabel, isLast) {
  const lastClass = isLast ? ' result-block-last' : '';
  const label = areaLabel === 'ハブ拠点' ? '宿泊（近隣の拠点都市）' : '宿泊';
  const linksHtml = links.map((link) => buildLinkItem(link)).join('');
  return `
    <div class="result-block hotel-block${lastClass}">
      <div class="block-label">${label}</div>
      <div class="link-list">${linksHtml}</div>
    </div>
  `;
}

function buildLinkItem(link) {
  return `
    <a href="${link.url}" target="_blank" rel="noopener noreferrer"
       class="link-item link-${link.type}">
      ${link.label}
    </a>
  `;
}
