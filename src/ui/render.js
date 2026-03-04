/**
 * DOM描画モジュール
 *
 * カード表示順:
 *   result-card
 *     result-counter
 *     city-block
 *     card-section        （交通リンク）
 *     stay-block          （この街に泊まる — hasHotel=true のみ）
 *     stay-block--hub     （ハブ都市宿 — hubHotel あり のみ）
 *     car-block           （レンタカー — hasHotel=true かつ needsCar=true のみ）
 */

import { applyAffiliateLinks } from '../affiliate/affiliate.js';

export function renderResult({ city, transportLinks, hotelLinks, distanceLabel, poolIndex, poolTotal, fromCity }) {
  const showHotel = hotelLinks.show;
  const showHub   = showHotel && !!hotelLinks.hub;

  const el = document.getElementById('result-inner');
  el.innerHTML = `
    <div class="result-card">
      ${buildCounterBlock(poolIndex, poolTotal)}
      ${buildCityBlock(city, distanceLabel, fromCity)}
      ${buildTransportBlock(transportLinks)}
      ${showHotel ? buildStayBlock() : ''}
      ${showHub ? buildHubStayBlock(hotelLinks.hub.name) : ''}
      ${showHotel && city.needsCar ? buildCarBlock() : ''}
    </div>
  `;

  if (showHotel) applyAffiliateLinks(city, hotelLinks.hub);
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

/** distanceStars → 所要時間ラベル */
const STAR_TIME_LABEL = {
  1: '約1時間以内',
  2: '約2時間',
  3: '約3〜4時間',
  4: '約5〜6時間',
  5: '6時間以上',
};

/**
 * 出発地情報を使ってアクセス行を自然文で生成する。
 * fromCity = DEPARTURE_CITY_INFO[departure] の値。
 */
function generateAccessText(fromCity, city) {
  const { access, distanceStars } = city;
  if (!access) return '';

  if (access.railGateway) {
    const timeLabel = STAR_TIME_LABEL[distanceStars] ?? '';
    const note = access.railNote ? `（${access.railNote}）` : '';
    const from = fromCity?.rail ?? access.railGateway;
    return `<p class="access-line">${from}から${timeLabel}${note}</p>`;
  }

  if (access.airportGateway) {
    const from = fromCity?.airport ?? '出発空港';
    return `<p class="access-line">${from}から${access.airportGateway}へ</p>`;
  }

  if (access.ferryGateway) {
    return `<p class="access-line">${access.ferryGateway}からフェリーで</p>`;
  }

  return '';
}

function buildCityBlock(city, _distanceLabel, fromCity) {
  const accessLine = generateAccessText(fromCity, city);

  // 「〜行かない？」系の呼びかけ文を除去
  const atmosphereHtml = (city.atmosphere || [])
    .filter(line => !line.endsWith('？'))
    .map((line) => `<p class="appeal-line">${line}</p>`)
    .join('');

  // タグは最大3つ
  const themesHtml = Array.isArray(city.themes) && city.themes.length
    ? city.themes.slice(0, 3).map((t) => `<span class="theme-tag">${t}</span>`).join('')
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

/* ── 宿泊ブロック（目的地） ── */

function buildStayBlock() {
  return `
    <div class="stay-block">
      <p class="stay-label">この街に泊まる</p>
      <div class="stay-buttons">
        <a id="jalanHotelBtn" target="_blank" rel="nofollow sponsored noopener">じゃらん</a>
        <a id="rakutenHotelBtn" target="_blank" rel="nofollow sponsored noopener">楽天トラベル</a>
      </div>
      <p id="hotel-pending" class="hotel-pending" hidden>このエリアは宿情報準備中</p>
    </div>
  `;
}

/* ── 宿泊ブロック（ハブ都市） ── */

function buildHubStayBlock(hubName) {
  return `
    <div class="stay-block stay-block--hub">
      <p class="stay-label">${hubName}から宿を探す</p>
      <div class="stay-buttons">
        <a id="jalanHubHotelBtn" target="_blank" rel="nofollow sponsored noopener">じゃらん</a>
        <a id="rakutenHubHotelBtn" target="_blank" rel="nofollow sponsored noopener">楽天トラベル</a>
      </div>
      <p id="hub-hotel-pending" class="hotel-pending" hidden>このエリアは宿情報準備中</p>
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

/* ── リンクアイテム ── */

function btnClass(type) {
  if (type === 'jr-east')    return 'btn-jr-east';
  if (type === 'jr-west')    return 'btn-jr-west';
  if (type === 'jr-kyushu')  return 'btn-jr-kyushu';
  if (type === 'jr-ex')      return 'btn-jr-ex';
  if (type === 'skyscanner') return 'btn-skyscanner';
  if (type === 'rakuten'  )                        return 'btn-rakuten';
  if (type === 'jalan' || type === 'jalan-rental') return 'btn-jalan';
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
