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

export function renderResult({ city, transportLinks, hotelLinks, distanceLabel, poolIndex, poolTotal, fromCity, departure }) {
  const showHotel = hotelLinks.show;
  const showHub   = showHotel && !!hotelLinks.hub;

  const el = document.getElementById('result-inner');
  el.innerHTML = `
    <div class="result-card">
      ${buildCounterBlock(poolIndex, poolTotal)}
      ${buildCityBlock(city, distanceLabel, fromCity, departure)}
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
 * 出発地情報を使ってアクセス行を交通チェーン形式で生成する。
 * fromCity = DEPARTURE_CITY_INFO[departure] の値。
 *
 * チェーン表示:
 *   鉄道+バス: 出発駅 → ハブ駅 → バス → 目的地
 *   航空:     出発空港 → 到着空港 → 空港アクセス → 目的地
 *   フェリー: 出発駅 → フェリー港 → フェリー → 目的地
 */
function generateAccessText(fromCity, city, departure) {
  const { access } = city;
  if (!access) return '';

  const fromRail    = fromCity?.rail    ?? null;
  const fromAirport = fromCity?.airport ?? '出発空港';
  const destName    = city.mapDestination || city.name;

  // 鉄道ルート
  if (access.railGateway) {
    if (city.hubCity && city.accessFromHub) {
      // チェーン表示: 出発駅 → ハブ → バス/バス等 → 目的地
      const from = fromRail ?? access.railGateway;
      return `<p class="access-line">${from} → ${city.hubCity} → ${city.accessFromHub} → ${city.name}</p>`;
    }
    if (access.railNote) {
      // バス/フェリー付き: 出発駅 → ハブ駅（バスあり）
      const from = fromRail ?? access.railGateway;
      const mode = access.railNote.replace('あり', '').trim();
      return `<p class="access-line">${from} → ${access.railGateway}（${mode}）→ ${city.name}</p>`;
    }
    // 通常鉄道: 出発駅から目的地へ
    const from = fromRail ?? access.railGateway;
    return `<p class="access-line">${from}から${access.railGateway}へ</p>`;
  }

  // 航空ルート
  if (access.airportGateway) {
    if (city.airportAccess) {
      // チェーン: 出発空港 → 到着空港 → 空港アクセス → 都市名
      return `<p class="access-line">${fromAirport} → ${access.airportGateway} → ${city.airportAccess} → ${city.name}</p>`;
    }
    return `<p class="access-line">${fromAirport} → ${access.airportGateway} → ${city.name}</p>`;
  }

  // フェリールート
  if (access.ferryGateway) {
    const from = fromRail ?? '出発地';
    return `<p class="access-line">${from} → ${access.ferryGateway} → フェリー → ${city.name}</p>`;
  }

  return '';
}

/**
 * atmosphere 行をフィルタする。
 * - 「〜行かない？」等の呼びかけ文を除去
 * - ユーザーの出発駅と異なる駅を起点とする交通案内文（「XX駅から新幹線で」等）を除去
 *   ※ 目的地内移動（路面電車・バス等）は除去しない
 */
function filterAtmosphere(lines, userRail) {
  // 出発地交通パターン: 「XX駅/港から新幹線/特急/急行/電車/飛行機/高速バスでY」
  const DEPARTURE_TRANSPORT = /^([^\s、,（]+[駅港])から(新幹線|特急|急行|電車|飛行機|高速バス)/;

  return lines
    .filter(line => !line.endsWith('？'))
    .flatMap(line => {
      // 複合文（複数の。区切り）をバラして処理
      const sentences = line.replace(/。/g, '。\u0000').split('\u0000').filter(s => s.trim());
      const kept = sentences.filter(s => {
        const m = s.match(DEPARTURE_TRANSPORT);
        // 出発地交通パターンに一致 かつ ユーザー出発駅と異なる → 除去
        if (m && userRail && m[1] !== userRail) return false;
        return true;
      });
      if (kept.length === 0) return [];
      return [kept.join('')];
    });
}

function buildCityBlock(city, _distanceLabel, fromCity, departure) {
  const accessLine = generateAccessText(fromCity, city, departure);

  // atmosphere: 呼びかけ文除去 + 出発地依存の交通案内文を除去
  const atmosphereHtml = filterAtmosphere(city.atmosphere || [], fromCity?.rail)
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
  if (type === 'ferry') return 'btn-ferry';
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
