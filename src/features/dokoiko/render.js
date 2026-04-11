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

import { DEPARTURE_CITY_INFO }                   from '../../config/constants.js';
import { AIRPORT_IATA, buildRentalLink }          from '../../transport/linkBuilder.js';
import { buildNarrative }                         from '../../transport/routeNarrator.js';
import { buildRouteMapUrl }                       from '../../utils/map/buildRouteMapUrl.js';

export function renderResult({ city, transportLinks, hotelLinks, stayCityName = null, stayType, departure, transportContext = {} }) {
  try {
    const showHotel = stayType !== 'daytrip';
    const tc = transportContext;
    const destLabel = city.displayName || city.name;

    const el = document.getElementById('result-inner');
    el.innerHTML = `
      <div class="result-card">
        ${buildCityBlock(city)}
        ${buildRouteBlock(tc, departure, destLabel, city)}
        ${buildCtaBlock(tc, transportLinks, city, departure)}
        ${showHotel ? buildStaySection(hotelLinks, city, stayCityName, tc) : ''}
        <button class="retry-btn-inline" data-action="retry">別の旅を見る</button>
        <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
        <div class="card-brand-footer">どこ行こ？ — tabidokoiko.com</div>
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

/* ── タグ → カラークラスマッピング ── */
const TAG_COLOR_MAP = {
  '温泉':   'tag-onsen',
  '自然':   'tag-nature',
  '海':     'tag-sea',
  '山':     'tag-mountain',
  '街歩き': 'tag-city',
  '歴史':   'tag-history',
  'グルメ': 'tag-gourmet',
  '離島':   'tag-island',
  '寺社':   'tag-shrine',
  '城':     'tag-castle',
  '絶景':   'tag-scenic',
  '秘境':   'tag-remote',
  '高原':   'tag-mountain',
  '川':     'tag-nature',
  '湖':     'tag-nature',
  '渓谷':   'tag-nature',
};

/* ── 都市ブロック ── */

function buildCityBlock(city) {
  const categoryBadge = buildCategoryBadge(city);
  const displayTags = city.primary?.length
    ? [...(city.primary ?? []), ...(city.secondary ?? [])]
    : (city.tags ?? []);

  // 所在地
  const locationStr = city.prefecture || '';

  const nameDisplay = city.displayName || city.name;
  const tagline = buildTagline(city);
  const taglineHtml = tagline ? `<p class="city-tagline">${tagline}</p>` : '';

  // 説明文
  const descHtml = city.description
    ? `<p class="city-description">${city.description}</p>`
    : '';

  // スポット例（最大3つ）: spots優先、なければtags補完
  const spotsHtml = buildSpotsLine(city, displayTags);

  // stayPriority ヒント（宿CTAの直前に配置 — buildActionBlockで使用）
  // ここでは city-block 内に含めず、buildActionBlock 側で挿入する

  return `
    <div class="city-block">
      <div class="city-header">
        <h2 class="city-name">${nameDisplay}</h2>
        <p class="city-sub">${locationStr}${categoryBadge}</p>
      </div>
      ${taglineHtml}
      ${descHtml}
      ${spotsHtml}
    </div>
  `;
}

/**
 * スポット表示行。spots を短縮して行動が浮かぶ形にする。
 */
function buildSpotsLine(city, displayTags) {
  if (city.spots?.length) {
    const shortened = city.spots.slice(0, 3).map(shortenSpot);
    return `<p class="city-spots">${shortened.join('・')}</p>`;
  }
  const fallback = (displayTags ?? []).slice(0, 3);
  return fallback.length ? `<p class="city-spots">${fallback.join('・')}</p>` : '';
}

/** スポット名を短縮（正式名称 → 行動が浮かぶ短い語） */
function shortenSpot(name) {
  return name
    .replace(/^(.*?)（.*?）$/, '$1')              // 括弧内を除去
    .replace(/(温泉郷|温泉街|温泉地)$/, '温泉')    // 温泉系統一
    .replace(/(旧|新)?(紀州|東海道|中山道)街道/, '街道散歩')
    .replace(/国立公園$/, '')
    .replace(/世界遺産$/, '');
}

/* ── タグラインNG判定 ── */
const TAGLINE_NG = /の街$|の場所|が共存|歴史|自然|文化|魅力|空気|余韻|心の|時間を|旅情|特別な|保養地|観光地|聖地/;

/**
 * タグライン生成。
 *
 * 優先順位:
 *   1. spots からシーン生成（具体的な体験が浮かぶ）
 *   2. description を分解・再構成（動詞系に変換）
 *   3. tags fallback（シーン形式）
 *
 * 制約:
 *   - 15〜25文字
 *   - 抽象ワード禁止（TAGLINE_NG）
 *   - 「〜の街」「〜の場所」で終わらない
 *   - 必ず動詞 or シーンを含む
 */
function buildTagline(city) {
  const tags = city.primary ?? city.tags ?? [];
  const spots = city.spots ?? [];

  // Phase 1: spots からシーン生成
  const fromSpots = buildTaglineFromSpots(spots, tags, city);
  if (fromSpots) return fromSpots;

  // Phase 2: description から動詞句を抽出
  const fromDesc = buildTaglineFromDesc(city.description);
  if (fromDesc) return fromDesc;

  // Phase 3: tags からシーン生成
  return buildTaglineFromTags(tags);
}

/** spots + tags → シーン形式タグライン */
function buildTaglineFromSpots(spots, tags, city) {
  if (spots.length === 0) return null;

  // スポットを短縮（単語の切れ目で切る）
  const short = spots.slice(0, 2).map(trimSpotName);

  // spots 内容 + tags から動詞を決定
  const verb = pickVerb(spots, tags, city);
  const joined = short.join('や');

  const candidate = `${joined}${verb}`;
  if (candidate.length >= 10 && candidate.length <= 25) return candidate;

  // 短すぎ or 長すぎ: スポット数を調整
  if (candidate.length > 25 && short.length === 2) {
    // 1スポットだけに絞る
    const single = `${short[0]}${verb}`;
    if (single.length >= 10 && single.length <= 25) return single;
  }

  if (spots.length >= 3) {
    const s3 = spots.slice(0, 3).map(trimSpotName);
    const list = `${s3.join('・')}を巡れる`;
    if (list.length >= 10 && list.length <= 25) return list;
  }

  return null;
}

/** スポット名を短縮（単語として意味が通る長さで切る） */
function trimSpotName(name) {
  let s = name
    .replace(/^(.*?)（.*?）$/, '$1')
    .replace(/(温泉郷|温泉街|温泉地)$/, '温泉')
    .replace(/歴史の道$/, '')
    .replace(/自然文化園$/, '')
    .replace(/(自然|文化)(休養)?(林|園)$/, '')
    .replace(/自然動物(園|公園)$/, '動物園')
    .replace(/歴史(公園|館)$/, '')
    .replace(/(総合)?文化(ホール|センター|会館)$/, '');
  // 7文字超は助詞・の・記号の位置で切る
  if (s.length > 7) {
    const breakAt = s.slice(0, 8).search(/[のやと・]/);
    if (breakAt >= 3) s = s.slice(0, breakAt);
    else s = s.slice(0, 7);
  }
  return s;
}

/** spots内容 + tags/destType → 適切な動詞 */
function pickVerb(spots, tags, city) {
  const dt = city?.destType;
  const tagSet = new Set(tags);
  const spotsJoined = spots.join('');

  // spots の中身で判断（tagsより具体的）
  if (spotsJoined.match(/温泉/))              return 'に浸かれる';
  if (spotsJoined.match(/海[岸辺沿]|ビーチ/)) return 'と海を歩ける';

  // destType + tags
  if (dt === 'island' || tagSet.has('離島'))   return 'を巡れる';
  if (tagSet.has('海'))                        return 'と海を歩ける';
  if (tagSet.has('山') || tagSet.has('高原'))   return 'を歩ける';
  if (tagSet.has('寺社') || tagSet.has('城'))   return 'を歩いて回れる';
  if (tagSet.has('街歩き') || tagSet.has('街')) return 'を歩ける';
  if (tagSet.has('グルメ'))                    return 'を食べ歩ける';
  if (dt === 'onsen' || tagSet.has('温泉'))    return 'に浸かれる';
  return 'を巡れる';
}

/** description から動詞句を抽出 */
function buildTaglineFromDesc(desc) {
  if (!desc) return null;

  // 「〜できる」「〜楽しめる」「〜味わえる」「〜行ける」系の句を抽出
  const verbMatch = desc.match(/([\u3000-\u9FFFa-zA-Z0-9ー]{3,15}(?:できる|楽しめる|味わえる|歩ける|浸かれる|望める|眺められる|体感できる|体験できる|感じられる|堪能できる|巡れる|渡れる|行ける|過ごせる|見られる|出会える))/);
  if (verbMatch) {
    const v = verbMatch[1];
    if (v.length >= 10 && v.length <= 25 && !TAGLINE_NG.test(v)) return v;
  }

  return null;
}

/** tags → シーン形式（最終フォールバック） */
function buildTaglineFromTags(tags) {
  if (tags.length >= 2) {
    // 「温泉と海沿い散歩」「寺と海を歩ける」
    const t0 = tags[0];
    const t1 = tags[1];
    const scene = `${t0}と${t1}を楽しめる`;
    if (scene.length <= 25) return scene;
    return `${t0}を楽しめる`;
  }
  return tags[0] ? `${tags[0]}を楽しめる` : '';
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
  const isIsland    = city.isIsland || city.destType === 'island';
  const isOnsen     = city.destType === 'onsen';
  const isSight     = city.destType === 'sight';
  const isMountain  = city.destType === 'mountain';
  const isRemote    = city.destType === 'remote';
  const isPeninsula = city.destType === 'peninsula';
  if (isIsland)    return `　<span class="type-badge type-island">島</span>`;
  if (isPeninsula) return `　<span class="type-badge type-peninsula">半島</span>`;
  if (isOnsen)     return `　<span class="type-badge type-onsen">温泉</span>`;
  if (isMountain)  return `　<span class="type-badge type-mountain">高原・山岳</span>`;
  if (isRemote)    return `　<span class="type-badge type-remote">秘境</span>`;
  if (isSight)     return `　<span class="type-badge type-sight">自然</span>`;
  return '';
}

/* ══════════════════════════════════════════════════════
   行き方ブロック（bestRoute + alternatives）
══════════════════════════════════════════════════════ */

function buildRouteBlock(tc, departure, destLabel, city) {
  if (!tc?.bestRoute) return '';

  const best = tc.bestRoute;
  const dr   = best.displayRoute ?? { from: departure, to: destLabel };

  // ルート行: 東京 → 福岡
  const routeLine = `${dr.from} → ${dr.to}`;

  // 所要時間・乗換回数（stepGroupsから集計）
  const stepGroups = tc.stepGroups ?? [];
  const summary    = stepGroups.find(s => s.type === 'summary');
  const totalMin   = stepGroups
    .filter(s => s.type === 'step-group' && typeof s.duration === 'number')
    .reduce((sum, s) => sum + s.duration, 0);
  const transfers  = summary?.transfers ?? 0;

  // 時間がある場合のみ表示、乗換ありなら補足
  const metaLine = totalMin > 0
    ? `約${formatMinutes(totalMin)}${transfers > 0 ? '・乗換あり' : ''}`
    : '';

  return `
    <div class="route-block">
      <div class="best-route">
        <div class="best-route-line">${routeLine}</div>
        <div class="best-route-meta">${metaLine}</div>
      </div>
    </div>`;
}

/** 分 → "1時間30分" / "45分" 形式 */
function formatMinutes(min) {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function buildCtaBlock(tc, transportLinks, city, departure) {
  const seenUrls = new Set();
  const best = tc?.bestRoute;
  const chainCta = best?.jrChainCta;

  // ① 予約CTA + finalAccess（連続した行動として一体表示）
  const suppressBooking = best?.islandDisplayType === 'bus' || best?.islandDisplayType === 'car';
  let actionHtml = '';
  if (!tc?.mapOnlyFallback && !suppressBooking && chainCta) {
    const mainCta = transportLinks?.find(l => l.type === 'main-cta');
    if (mainCta?.cta?.url && !seenUrls.has(mainCta.cta.url)) {
      const label = buildChainCtaHtml(chainCta, mainCta.cta.type);
      seenUrls.add(mainCta.cta.url);
      const gatewayCity = resolveGatewayCity(best, city);
      // showFinalAccess: セグメント実態ベースで表示判定（JRのみなら非表示）
      const shouldShow = best?.showFinalAccess !== false && !chainCta.allJR;
      const accessText = shouldShow ? buildAccessText(best?.finalAccess, city, gatewayCity) : '';
      const accessHtml = accessText ? `
        <details class="final-access-details">
          <summary class="final-access-summary">${gatewayCity || '到着駅'}からの行き方</summary>
          <div class="final-access-body">${accessText}</div>
        </details>` : '';
      actionHtml = `
        <div class="cta-action">
          <a href="${mainCta.cta.url}" target="_blank" rel="noopener noreferrer"
             class="btn ${actionBtnClass(mainCta.cta.type)} btn--action">${label}</a>
          ${accessHtml}
        </div>`;
    }
  }

  // ② 地図CTA
  const mapUrl = tc?.mapUrl ?? buildTransitMapUrl(departure, city);
  let mapHtml = '';
  if (mapUrl) {
    seenUrls.add(mapUrl);
    mapHtml = `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer"
       class="btn btn--maps btn--action">地図で行き方を見る</a>`;
  }

  // ③ シェア（画像付き1ボタン）
  const shareHtml = `
    <div class="share-inline">
      <button class="btn-share btn-share--x" id="share-img-btn">Xでシェア</button>
    </div>`;

  // CTAなし時：地図で直接案内
  if (!actionHtml && mapHtml) {
    actionHtml = `
      <div class="cta-action">
        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer"
           class="btn btn--maps btn--action">そのまま行く（予約不要）</a>
      </div>`;
    mapHtml = '';
  }

  return `
    <div class="cta-block">
      ${actionHtml}
      ${mapHtml ? `<div class="cta-group">${mapHtml}</div>` : ''}
      ${shareHtml}
    </div>`;
}

/**
 * finalAccessからテキスト（HTMLタグなし）を返す。
 * CTA直下に「→ ...」として一体表示するため。
 * gatewayCityを優先し、ユーザーが知らない駅名を先頭に出さない。
 */
function buildAccessText(access, city, gatewayCity = null) {
  if (!access) return '';
  const fa = typeof access === 'string' ? { type: access } : access;
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  const destName = city?.displayName || city?.name || '';

  if (fa.type === 'train' && fa.line) {
    const company = extractRailwayCompany(fa.line);
    const to = clean(fa.to) || destName;
    const mid = typeof fa.midStation === 'object' ? fa.midStation?.name : fa.midStation;
    const trObj = typeof fa.transferStation === 'object' ? fa.transferStation : null;
    const trClean = trObj ? clean(trObj.name) : (typeof fa.transferStation === 'string' ? clean(fa.transferStation) : null);
    const midClean = mid ? clean(mid) : null;
    const isSame = trObj?.access === 'same';
    // A. midStation + transferStation（徒歩乗換）
    if (midClean && trClean && !isSame) {
      return `${midClean}で${company}に乗換 → ${to}へ行く`;
    }
    // B. 同一駅乗換 → シンプル
    if (isSame) {
      return `${company}で${to}へ行く`;
    }
    // C. transferStation
    if (trClean) {
      return `${trClean}で${company}に乗換 → ${to}へ行く`;
    }
    // D. シンプル
    return `${company}で${to}へ行く`;
  }
  if (fa.type === 'bus') {
    return `バスで${destName}へ行く`;
  }
  if (fa.type === 'car') {
    return `車で${destName}へ行く`;
  }
  return '';
}

/** 路線名から鉄道会社名を抽出する（例: 近鉄吉野線 → 近鉄） */
function extractRailwayCompany(line) {
  const COMPANIES = [
    '近鉄', '南海', '小田急', '東武', '西武', '京王', '京急', '京成',
    '京阪', '阪急', '阪神', '名鉄', '相鉄', '東急', '江ノ電', 'JR',
  ];
  for (const c of COMPANIES) {
    if (line.startsWith(c)) return c;
  }
  return line.replace(/(線|本線)$/, '');
}

/**
 * 予約到達点（gatewayCity）を解決する。
 * jrChainCta.to → representativeStation → hubCity の順で試行。
 */
function resolveGatewayCity(bestRoute, city) {
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  const cta = bestRoute?.jrChainCta;
  if (cta?.to) return clean(cta.to);
  if (city?.representativeStation) return clean(city.representativeStation);
  if (city?.hubCity) return city.hubCity;
  return null;
}

/* ── 旧 buildActionBlock（後方互換・非step-group用） ── */

/**
 * onsen → じゃらん優先、それ以外 → 楽天。
 */
function pickStayUrl(hotelLinks, city) {
  if (!hotelLinks) return null;
  const stayLinks = hotelLinks.links ?? [];
  const rakuten   = stayLinks.find(l => l.type === 'rakuten');
  const jalan     = stayLinks.find(l => l.type === 'jalan');

  const isOnsen = city?.destType === 'onsen'
    || (city?.primary ?? []).includes('温泉')
    || (city?.tags ?? []).includes('温泉');

  if (isOnsen && jalan) return jalan.url;
  if (rakuten)          return rakuten.url;
  if (jalan)            return jalan.url;
  return null;
}

/**
 * 予約CTAのCSSクラスを返す（engine が生成した cta.type に基づく）。
 * render 内の唯一のタイプ→クラス変換ポイント（分散禁止）。
 *
 * btn--jr     : JR系予約（青系・信頼感）
 * btn--booking: 航空券・フェリー・バス等
 */
function actionBtnClass(ctaType) {
  if (ctaType === 'jr-east')                           return 'btn--jr-east';   // えきねっと: 緑
  if (['skyscanner', 'google-flights'].includes(ctaType)) return 'btn--flight'; // 航空券: 青
  if (ctaType === 'ferry')                             return 'btn--ferry-cta'; // フェリー: オレンジ
  const JR_WEST = new Set(['jr-west', 'jr-kyushu', 'jr-ex', 'jr-window']);
  if (JR_WEST.has(ctaType))                           return 'btn--jr';        // e5489等: 青
  return 'btn--booking';
}

/**
 * ルート情報・CTA・宿・再検索を1ブロックに統合。
 * step-group 形式のルートでのみ使用する。
 *
 * @param {Array}   links           — step-group 配列
 * @param {object}  hotelLinks      — buildHotelLinks の出力
 * @param {string}  stayType        — 'daytrip' | 'overnight' etc.
 * @param {string}  departure       — 出発都市名
 * @param {string}  destLabel       — 表示用目的地名
 * @param {object}  city            — destinations.json エントリ
 * @param {boolean} showHotel       — 宿セクションを表示するか
 * @param {string|null} engineMapUrl — engine が生成した Google Maps URL（hubCity優先）
 * @param {boolean} mapOnlyFallback — CTA 生成不可・Maps のみ案内モード
 * @param {string}  reason          — CTA 直前の「納得感」テキスト（engine 生成）
 */
function buildActionBlock(links, hotelLinks, stayType, departure, destLabel, city, showHotel, engineMapUrl = null, mapOnlyFallback = false, reason = '', via = null, accessType = null, stayCityName = null) {
  const stepGroups = links.filter(l => l.type === 'step-group');

  // ルート概要行: "東京 → 壱岐"
  const routeLineHtml = (departure && destLabel)
    ? `<div class="route-line">${departure} → ${destLabel}</div>`
    : '';
  // ルート理由: "飛行機がいちばん現実的"
  const reasonHtml = reason
    ? `<div class="route-reason">${reason}</div>`
    : '';
  // 経由地: "博多経由"
  const viaLineHtml = via
    ? `<div class="via-line">${via}経由</div>`
    : '';

  // CTA グループ（最大2つ: 地図ルート=PRIMARY / 予約=SECONDARY）
  const mainCtaItem = links.find(l => l.type === 'main-cta');
  const ctaItems = [];
  const seenCtaUrls = new Set();

  // PRIMARY: engine が生成した Maps URL（hubCity 優先）を使用。
  // なければ render 側の buildTransitMapUrl にフォールバック。
  const primaryMapUrl = engineMapUrl ?? buildTransitMapUrl(departure, city);
  if (primaryMapUrl && !seenCtaUrls.has(primaryMapUrl)) {
    seenCtaUrls.add(primaryMapUrl);
    ctaItems.push(`<a href="${primaryMapUrl}" target="_blank" rel="noopener noreferrer"
       class="btn btn--transport btn--action">地図で行き方を見る</a>`);
  }

  // SECONDARY: 予約・チケット — mapOnlyFallback / accessType=bus 時は表示しない
  const skipBooking = accessType === 'bus';
  if (!mapOnlyFallback && !skipBooking && mainCtaItem?.cta?.url && !seenCtaUrls.has(mainCtaItem.cta.url)) {
    seenCtaUrls.add(mainCtaItem.cta.url);
    const bookingLabel = mainCtaItem.cta.label ?? buildMainCtaLabel(mainCtaItem.cta.type);
    ctaItems.push(`<a href="${mainCtaItem.cta.url}" target="_blank" rel="noopener noreferrer"
       class="btn ${actionBtnClass(mainCtaItem.cta.type)} btn--action">${bookingLabel}</a>`);
  }

  const ctaGroupHtml = ctaItems.length
    ? `<div class="cta-group">${ctaItems.join('')}</div>`
    : '';

  // レンタカー（車があると便利な場合のみ・最下部配置）
  let rentalHintHtml = '';
  if (!mapOnlyFallback && city?.requiresCar === true) {
    const destCity = city?.accessStation?.replace(/空港$|港$/, '') || city?.displayName || city?.name || null;
    const rentalLink = buildRentalLink(destCity);
    if (rentalLink?.url && !seenCtaUrls.has(rentalLink.url)) {
      rentalHintHtml = `<div class="rental-hint">
        <span class="rental-hint-label">車があると便利</span>
        <a href="${rentalLink.url}" target="_blank" rel="nofollow sponsored noopener"
           class="btn btn-rental btn--action-sm">レンタカーを探す</a>
      </div>`;
    }
  }

  // シェアボタン（Xのみ）
  const shareInlineHtml = `
    <div class="share-inline">
      <button class="btn-share btn-share--x" id="share-x-btn">Xでシェア</button>
    </div>`;

  // 宿セクション（daytrip = 完全非表示）
  const staySection = showHotel ? buildStaySection(hotelLinks, city, stayCityName) : '';

  // ルート詳細（折りたたみ）— alt-route は最適ルート1本に統一するため非表示
  const stepsHtml  = stepGroups.map(sg => buildStepCard(sg)).join('');
  const subCtaItem = links.find(l => l.type === 'sub-cta');
  const mapCtaItem = links.find(l => l.type === 'map-cta');
  const hint       = buildLocalTransportHint(city);
  const secondaryCta = subCtaItem ? buildSubCtaBlock(subCtaItem) : (mapCtaItem ? buildMapCtaBlock(mapCtaItem) : '');
  const localSec   = (hint || secondaryCta)
    ? `<div class="local-section"><div class="local-header">到着後の移動</div>${hint}${secondaryCta}</div>`
    : '';

  const detailsInner = [
    stepsHtml ? `<div class="step-list">${stepsHtml}</div>` : '',
    localSec,
  ].filter(Boolean).join('');

  const detailsBlock = detailsInner
    ? `<details class="step-details">
         <summary class="step-details-summary">ルート詳細を見る</summary>
         ${detailsInner}
       </details>`
    : '';

  return `
    <div class="action-block">
      ${routeLineHtml}
      ${reasonHtml}
      ${viaLineHtml}
      ${ctaGroupHtml}
      ${shareInlineHtml}
      ${staySection}
      ${detailsBlock}
      ${rentalHintHtml}
      <button class="retry-btn-inline" data-action="retry">別の旅を見る</button>
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/**
 * 宿ピッカー: 「宿を探す」ボタン押下で楽天/じゃらん選択UIを展開。
 * <details>/<summary> を使用してJS不要で実現。
 * ロゴは使用せず色のみブランド連想。
 */
function buildStayPicker(hotelLinks) {
  if (!hotelLinks) return '';

  const bestLinks = hotelLinks.links ?? [];

  const rakuten = bestLinks.find(l => l.type === 'rakuten');
  const jalan   = bestLinks.find(l => l.type === 'jalan');
  if (!rakuten && !jalan) return '';

  const optionsHtml = [
    rakuten ? `<a href="${rakuten.url}" target="_blank" rel="nofollow sponsored noopener"
                  class="btn btn--stay-rakuten">楽天で見る</a>` : '',
    jalan   ? `<a href="${jalan.url}"   target="_blank" rel="nofollow sponsored noopener"
                  class="btn btn--stay-jalan">じゃらんで見る</a>` : '',
  ].filter(Boolean).join('');

  return `
    <details class="stay-picker">
      <summary class="stay-picker-trigger">宿を探す</summary>
      <div class="stay-picker-options">${optionsHtml}</div>
    </details>
  `;
}

/**
 * stayPriority に基づく宿泊ヒントテキスト。
 * スポットの下・宿CTAの直前に表示。
 */
function buildStayHint(city) {
  const priority = city?.stayPriority;
  if (priority === 'high') {
    return `<p class="stay-hint">この街に泊まるのがいちばんいい</p>`;
  }
  if (priority === 'low' && city?.hubCity) {
    const hubName = city.hubCity;
    return `<p class="stay-hint">${hubName}に泊まって、ここを巡るのが現実的</p>`;
  }
  return '';
}

/**
 * 宿泊セクション: stayPriorityヒント + 宿CTA。
 * daytrip 時は呼び出し元（buildActionBlock）で showHotel=false により非表示。
 */
function buildStaySection(hotelLinks, city, stayCityName = null, tc = null) {
  if (!hotelLinks) return '';
  const stayLinks = hotelLinks.links ?? [];
  const rakuten   = stayLinks.find(l => l.type === 'rakuten');
  const jalan     = stayLinks.find(l => l.type === 'jalan');
  if (!rakuten && !jalan) return '';

  // 宿ラベルはリンク生成時の都市名を優先（gatewayCity ではなく宿の実体に合わせる）
  const stayLabel = hotelLinks.stayCityName || stayCityName || city?.displayName || city?.name || '';
  const stayHint = buildStayHint(city);

  const buttons = [
    rakuten ? `<a href="${rakuten.url}" target="_blank" rel="nofollow sponsored noopener"
                  class="btn btn--stay-rakuten btn--action">${stayLabel}で泊まる（楽天）</a>` : '',
    jalan   ? `<a href="${jalan.url}"   target="_blank" rel="nofollow sponsored noopener"
                  class="btn btn--stay-jalan btn--action">${stayLabel}で泊まる（じゃらん）</a>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="stay-section">
      ${stayHint}
      <div class="stay-buttons">${buttons}</div>
    </div>
  `;
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
    summaryHtml = `<div class="route-summary">${departure} → ${destLabel}</div>`;
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
 * Phase 6-9: ルート要約 → メインCTA → 番号付きフロー → 代替ルート の順で描画。
 */
function buildStepsBlock(links, departure, destLabel, city = null) {
  const stepGroups = links.filter(l => l.type === 'step-group');
  const altRoutes  = links.filter(l => l.type === 'alt-route');

  // ① ルート概要（出発地 → 目的地のみ）
  const summaryHtml = (departure && destLabel)
    ? `<div class="route-summary">${buildRouteSummary(departure, destLabel, city)}</div>`
    : '';

  // ② メインCTA（routes.json の main-cta を直接使用 — 推測・生成しない）
  const mainCtaItem = links.find(l => l.type === 'main-cta');
  const mainCtaHtml = mainCtaItem ? buildMainCtaBlock(mainCtaItem) : '';

  // ③ 番号付きフロー（Google Maps サブリンクのみ表示）
  const stepsHtml = stepGroups.map(sg => buildStepCard(sg)).join('');

  // ③' 目的地マップリンク（地図ボタン — 目的地1点）
  const destMapUrl = buildDestMapUrl(city);
  const destMapHtml = destMapUrl
    ? `<div class="dest-map-row">
         <a href="${destMapUrl}" target="_blank" rel="noopener noreferrer"
            class="btn btn-maps">地図で見る</a>
       </div>`
    : '';

  // ④ 代替ルート
  const altRoutesHtml = altRoutes.map(ar => buildAltRouteSection(ar)).join('');

  // ⑤ subCTA（routes.json の sub-cta を直接使用 — requiresCar のときレンタカー）
  const subCtaItem = links.find(l => l.type === 'sub-cta');
  const subCtaHtml = subCtaItem ? buildSubCtaBlock(subCtaItem) : '';

  // ⑥ mapCTA（routes.json の map-cta を直接使用 — finalPointまでのルート）
  const mapCtaItem = links.find(l => l.type === 'map-cta');
  const mapCtaHtml = mapCtaItem ? buildMapCtaBlock(mapCtaItem) : '';

  // ⑦ 到着後ヒント（railNote など）
  // CTA は最大2つ（main + secondary 1つ）。sub-cta を優先、なければ map-cta。
  const hint = buildLocalTransportHint(city);
  const secondaryCtaHtml = subCtaHtml || mapCtaHtml;
  const localSection = (hint || secondaryCtaHtml)
    ? `<div class="local-section">
         <div class="local-header">到着後の移動</div>
         ${hint}
         ${secondaryCtaHtml}
       </div>`
    : '';

  // ステップ詳細を折りたたみ表示（初期は閉じた状態）
  const stepsBlock = stepsHtml
    ? `<details class="step-details">
         <summary class="step-details-summary">ルート詳細を見る</summary>
         <div class="step-list">${stepsHtml}</div>
       </details>`
    : '';

  return `
    <div class="card-section">
      ${summaryHtml}
      ${mainCtaHtml}
      ${destMapHtml}
      ${stepsBlock}
      ${altRoutesHtml}
      ${localSection}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

/**
 * メインCTAブロック。
 * { type: 'main-cta', cta: { type, url, label? } } を受け取り `.main-cta-row` で表示。
 * CTA は route 単位で 1 つだけ（step-group からは導出しない）。
 */
function buildMainCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? buildMainCtaLabel(cta.type);
  return `
    <div class="main-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn ${btnClass(cta.type)} btn--route-main">${label}</a>
    </div>
  `;
}

/**
 * subCTA ブロック。
 * { type: 'sub-cta', cta: { type, url, label? } } を受け取り `.sub-cta-row` で表示。
 * 現在は rental（レンタカー）のみ対応。
 */
function buildSubCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? 'レンタカーを探す';
  return `
    <div class="sub-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn btn-rental">${label}</a>
    </div>
  `;
}

/**
 * mapCTA ブロック。
 * { type: 'map-cta', cta: { type: 'google-maps', url, label } } を受け取り `.map-cta-row` で表示。
 */
function buildMapCtaBlock(item) {
  const cta = item.cta;
  if (!cta?.url) return '';
  const label = cta.label ?? '地図で確認';
  return `
    <div class="map-cta-row">
      <a href="${cta.url}" target="_blank" rel="noopener noreferrer"
         class="btn btn-maps">${label}</a>
    </div>
  `;
}

/** CTA用のprovider/typeマッピング */
const CTA_PROVIDER = {
  'jr-east':        'えきねっと',
  'jr-west':        'e5489',
  'jr-kyushu':      '九州ネット予約',
  'jr-ex':          'EX',
  'skyscanner':     'Skyscanner',
  'google-flights': 'Google Flights',
  'ferry':          'フェリー予約',
};
const CTA_TYPE_HINT = {
  shinkansen: '新幹線',
  limited:    '特急',
  flight:     '飛行機',
  ferry:      'フェリー',
};

/**
 * JRチェーンCTAから2行HTMLを生成する。
 * 1行目: 米子まで予約する（動詞込みアクション）
 * 2行目: e5489で予約（予約手段）
 */
function buildChainCtaHtml(chainCta, providerType = null) {
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  const to   = clean(chainCta.to);
  const provider = CTA_PROVIDER[providerType] ?? null;
  const hint = CTA_TYPE_HINT[chainCta.type] ?? '';
  const suffix = hint ? `（${hint}）` : '';
  const line1 = `${to}まで予約する`;
  const line2 = provider ? `${provider}で予約${suffix}` : `予約する${suffix}`;
  return `<span class="cta-route">${line1}</span><br><span class="cta-provider">${line2}</span>`;
}

function buildMainCtaLabel(type) {
  const LABELS = {
    'skyscanner':    '航空券を比較する',
    'google-flights':'航空券を比較する',
    'jr-east':       'えきねっとで予約する',
    'jr-west':       'e5489で予約する',
    'jr-kyushu':     'JR九州ネット予約',
    'jr-ex':         'EXで予約する',
    'jr-window':     'みどりの窓口で購入',
    'ferry':         'フェリーを予約する',
    'bus':           'バスを予約する',
  };
  return LABELS[type] ?? 'チケットを予約する';
}


/**
 * Phase 7: 代替ルート（「他の行き方」）を折りたたみで表示。
 * alt-route: { type: 'alt-route', label: '鉄道で行く', stepGroups: [...] }
 */
function buildAltRouteSection(altRoute) {
  if (!altRoute?.stepGroups?.length) return '';
  const innerHtml = altRoute.stepGroups.map(sg => buildStepCard(sg, false)).join('');
  return `
    <details class="alt-route-section">
      <summary class="alt-route-summary">他の行き方：${altRoute.label ?? '代替ルート'}</summary>
      <div class="alt-route-inner step-list">${innerHtml}</div>
    </details>
  `;
}

/**
 * 1ステップ分のカードを描画する。
 * stepLabel（"① ✈ 高松空港 → 福岡空港（飛行機）"）をヘッダーに表示し、
 * type 別にオーバーライドした CTA ボタンと、car step の rentalLink を配置する。
 */
/**
 * 1ステップ分のカードを描画する。
 * CTAボタンはメインCTAブロックに集約するため、ステップカードには表示しない。
 * Googleマップサブリンク（ローカル移動用）のみ小テキストで表示する。
 */
function buildStepCard(sg) {
  // ステップは純粋な表示のみ — CTA は上部の primary/secondary に集約済み
  const cautionHtml = sg.caution
    ? `<p class="step-card-caution">${sg.caution}</p>`
    : '';

  if (!sg.stepLabel && !cautionHtml) return '';

  return `
    <div class="step-card">
      <div class="step-card-header">${sg.stepLabel ?? ''}</div>
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

  // buildRouteByPattern が明示的ラベルを設定している場合はそれを使用
  if (sg.ctaLabel) return sg.ctaLabel;

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
      return fromTo ? `${fromTo}の行き方を地図で見る` : '地図で行き方を見る';
    case 'skyscanner':
    case 'google-flights':
      return fromTo ? `航空券を予約する（${fromTo}）` : cta.label;
    case 'ferry':
      return fromTo ? `フェリーを予約する（${fromTo}）` : cta.label;
    case 'bus':
      return fromTo ? `バスで行く（${fromTo}）` : cta.label;
    case 'jr-east':
    case 'jr-west':
    case 'jr-kyushu':
    case 'jr-ex':
    case 'jr-window': {
      const providerLabel = {
        'jr-east':   'えきねっと',
        'jr-west':   'e5489',
        'jr-kyushu': 'JR九州ネット予約',
        'jr-ex':     'EX',
        'jr-window': 'みどりの窓口',
      }[cta.type] ?? '鉄道';
      return fromTo ? `${providerLabel}で予約する（${fromTo}）` : `${providerLabel}で予約する`;
    }
    default:
      return cta.label ?? '';
  }
}

/* ── ルート要約（Phase 5）── */

/**
 * ルート概要テキストを生成する。
 *   "高松 → 梼原" + 到着後アクセス補足（secondaryTransport ベース）
 */
function buildRouteSummary(departure, destLabel, city, routeSteps = null) {
  const headline = `${departure} → ${destLabel}`;

  /* ナレーション: routeSteps があれば生成 */
  const narrative = routeSteps?.length
    ? buildNarrative(routeSteps)
    : '';

  let localPreview = '';
  if (!narrative && city && !(city.isIsland || city.destType === 'island')) {
    const transport = city.secondaryTransport ?? null;
    const needsCar  = !!(city.requiresCar ?? city.needsCar) || city.destType === 'mountain' || city.destType === 'remote' || transport === 'car';
    const hasBus    = city.railNote === 'バス' || city.busGateway != null || transport === 'bus';
    if (needsCar)      localPreview = 'レンタカー必要';
    else if (hasBus)   localPreview = '駅からバス';
  }

  const detail = narrative || localPreview;
  return detail
    ? `<span class="route-headline">${headline}</span><span class="route-narrative">${detail}</span>`
    : headline;
}

/* ── 地図URL ── */

function buildDestMapUrl(city) {
  if (!city) return null;
  // 緯度経度ではなく地名で検索する（座標リンクは意図しない場所を示すことがある）
  const name = city.displayName || city.name || '';
  return name ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}` : null;
}

/**
 * Google Maps transit 経路リンク（出発駅 → 最寄り駅）
 * PRIMARY CTA として使用する。
 * buildRouteMapUrl ユーティリティに委譲（緯度経度禁止・駅名ベース統一）。
 */
function buildTransitMapUrl(departure, city) {
  return buildRouteMapUrl(departure, city);
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
      result.push({ _mergedRoute: true, routeLabel: `${from} → ${to}（${mode}）` });
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
  if (city.isIsland || city.destType === 'island') return '';

  const transport = city.secondaryTransport ?? null;
  const needsCar  = city.needsCar === true || city.destType === 'mountain'
    || city.destType === 'remote' || transport === 'car';
  const hasBus    = city.railNote === 'バス' || city.busGateway != null || transport === 'bus';

  if (needsCar) {
    return `<p class="local-hint local-hint--car">レンタカー推奨エリア</p>`;
  }
  if (hasBus) {
    const station   = (city.accessStation ?? '').replace(/駅$/, '') || '最寄り駅';
    const modeLabel = transport === 'bus' ? 'バス' : 'バス・タクシー';
    return `<p class="local-hint">${station}から${modeLabel}</p>`;
  }
  if (city.accessStation?.endsWith('駅')) {
    const station = city.accessStation.replace(/駅$/, '');
    return `<p class="local-hint">${station}駅から徒歩</p>`;
  }
  return '';
}

/**
 * 到着後のローカル移動（Googleマップ・レンタカー）をまとめて表示する。
 * city を受け取ってローカル交通ヒントも表示する。
 */
function buildLocalSection(localSteps, rentalLinks = [], city = null) {
  const hint = buildLocalTransportHint(city);

  // Google Maps フォールバック: local ステップに Maps がない場合も必ず1つ表示
  const hasGoogleMaps = localSteps.some(sg => sg.cta?.type === 'google-maps');
  const fallbackMapHtml = (!hasGoogleMaps && city)
    ? (() => {
        const mapUrl = buildDestMapUrl(city);
        const label  = city.displayName || city.name || '目的地';
        return mapUrl
          ? `<div class="link-list"><a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">${label}の行き方を地図で見る</a></div>`
          : '';
      })()
    : '';

  if (!localSteps.length && !rentalLinks.length && !hint && !fallbackMapHtml) return '';

  const stepItems = localSteps.map(sg => {
    const label      = buildStepCtaLabel(sg) ?? '地図で行き方を見る';
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

  const content = stepItems + standaloneHtml + fallbackMapHtml;
  if (!content.trim() && !hint) return '';

  return `
    <div class="local-section">
      <div class="local-header">到着後の移動</div>
      ${hint}
      ${content}
    </div>
  `;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * access.steps ベース レンダリング
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * rail provider 表示名 → 予約情報
 * access.steps の provider フィールドはすでに表示名（"e5489", "えきねっと" など）
 */
const RAIL_PROVIDER_BOOKING = {
  'e5489':       { btnType: 'jr-west',   url: 'https://www.e5489.net/' },
  'えきねっと':   { btnType: 'jr-east',   url: 'https://www.eki-net.com/' },
  'JR九州':      { btnType: 'jr-kyushu', url: 'https://www.jrkyushu-kippu.jp/' },
  'EX予約':      { btnType: 'jr-ex',     url: 'https://expy.jp/' },
  'みどりの窓口': { btnType: 'jr-window', url: 'https://www.jr-odekake.net/' },
};

const ACCESS_STEP_NUMS = ['①', '②', '③', '④', '⑤', '⑥'];

/**
 * access.steps[] + 出発地 → UI表示用データを生成する（純粋変換）。
 *
 *  mainCTA  : 最初の予約可能ステップ（rail / flight / ferry）の予約情報
 *  mapMain  : 全体ルート（出発 → 最終目的地）の Google Maps データ
 *  mapLocal : 最後の local ステップの Google Maps データ（なければ null）
 *  steps    : 出発地 from を埋めた steps 配列
 *
 * @param {Array}  steps     - city.access.steps
 * @param {string} departure - 出発都市名（'高松' など）
 * @param {object} city      - 目的地オブジェクト
 */
export function resolveAccessUI(steps, departure, city) {
  if (!steps?.length) return null;

  const depInfo    = DEPARTURE_CITY_INFO[departure] ?? {};
  const depStation = depInfo.rail     ?? `${departure}駅`;
  const depAirport = depInfo.airport  ?? null;
  const depIata    = depInfo.iata     ?? null;

  /* steps[0].from（null）を出発地の駅/空港で埋める */
  const filledSteps = steps.map((s, i) => {
    if (i > 0 || s.from != null) return s;
    const from = s.type === 'flight' ? (depAirport ?? depStation) : depStation;
    return { ...s, from };
  });

  /* mainCTA: 最初の長距離移動（rail または flight）
   *   from === to（出発地がハブ駅と一致）のケースはno-opなのでスキップ
   *   rail/flight がなければ ferry を mainCTA に昇格 */
  const _isNoOp = s => s.from?.replace(/駅$/, '') === s.to?.replace(/駅$/, '');
  const mainRailFlight = filledSteps.find(s =>
    ['rail', 'flight'].includes(s.type) && !_isNoOp(s)
  );
  const mainRawStep = mainRailFlight
    ?? filledSteps.find(s => s.type === 'ferry' && !_isNoOp(s));
  const mainCTA = mainRawStep ? _buildAccessMainCTA(mainRawStep, depIata) : null;

  /* subCTA: ferry のみ（mainCTA が rail/flight のときのみ表示） */
  const ferryRawStep = mainRailFlight
    ? filledSteps.find(s => s.type === 'ferry')
    : null;
  const subCTA = ferryRawStep ? _buildAccessMainCTA(ferryRawStep, depIata) : null;

  /* mapMain: 全体ルート（出発 → 到着先）
   * 優先順: mapPoint → ferryGateway → railGateway → steps[last].to */
  const lastStep = filledSteps[filledSteps.length - 1];
  const mapFrom  = filledSteps[0].from;
  const mapTo    = city?.mapPoint
    ?? city?.ferryGateway
    ?? city?.railGateway
    ?? lastStep.to;
  /* 飛行機起点の場合は driving。それ以外は transit */
  const mapMode  = filledSteps[0].type === 'flight' ? 'driving' : 'transit';
  const mapMain  = {
    from: mapFrom,
    to:   mapTo,
    url:  _accessMapsUrl(mapFrom, mapTo, mapMode),
  };

  /* mapLocal: 最後の local ステップ
   * requiresLocalMove=true の場合は local ステップがなくても出力する */
  const locals    = filledSteps.filter(s => s.type === 'local');
  const lastLocal = locals[locals.length - 1] ?? null;
  let mapLocal = null;
  if (lastLocal) {
    mapLocal = {
      from:   lastLocal.from,
      to:     lastLocal.to,
      method: lastLocal.method ?? null,
      url:    _accessMapsUrl(lastLocal.from, lastLocal.to, 'driving'),
    };
  } else if (city?.requiresLocalMove) {
    /* steps に local がなくても要ローカル移動 → 最終ステップ到着地 → 目的地 */
    const localFrom = lastStep.to;
    const localTo   = city.mapPoint ?? city.name;
    if (localFrom && localTo && localFrom !== localTo) {
      mapLocal = {
        from:   localFrom,
        to:     localTo,
        method: null,
        url:    _accessMapsUrl(localFrom, localTo, 'driving'),
      };
    }
  }

  return {
    mainCTA,
    ...(subCTA   ? { subCTA }   : {}),
    mapMain,
    ...(mapLocal ? { mapLocal } : {}),
    steps: filledSteps,
  };
}

/* ── 内部ヘルパー（access.steps 専用） ── */

function _accessMapsUrl(from, to, mode = 'transit') {
  if (!from || !to) return null;
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(from)}` +
    `&destination=${encodeURIComponent(to)}` +
    `&travelmode=${mode}`
  );
}

function _buildAccessMainCTA(step, depIata) {
  /* CTA ラベルは step.from / step.to をそのまま使用（city 単位への置換禁止） */
  const from = step.from ?? '';
  const to   = step.to   ?? '';

  if (step.type === 'rail') {
    const booking = RAIL_PROVIDER_BOOKING[step.provider];
    if (!booking) return null;
    return {
      type:     'rail',
      from,
      to,
      provider: step.provider,
      btnType:  booking.btnType,
      url:      booking.url,
      label:    `${step.provider}で予約する（${from} → ${to}まで）`,
    };
  }

  if (step.type === 'flight') {
    const toIata = AIRPORT_IATA[step.to];
    if (!toIata || !depIata) return null;
    return {
      type:     'flight',
      from,
      to,
      provider: '航空会社',
      btnType:  'skyscanner',
      url:      `https://www.skyscanner.jp/transport/flights/${depIata.toLowerCase()}/${toIata.toLowerCase()}/`,
      label:    `航空券を予約する（${from} → ${to}まで）`,
    };
  }

  if (step.type === 'ferry') {
    const url = step.bookingUrl ?? 'https://www.jalan.net/ship/';
    return {
      type:     'ferry',
      from,
      to,
      provider: step.operator ?? 'フェリー',
      btnType:  'ferry',
      url,
      label:    `フェリーを予約する（${from} → ${to}まで）`,
    };
  }

  return null;
}

/**
 * access.steps[] から card-section を組み立てて返す。
 */
function buildAccessBlock(city, departure) {
  const steps = city?.access?.steps;
  if (!steps?.length) return '';

  const uiData = resolveAccessUI(steps, departure, city);
  if (!uiData) return '';

  const { mainCTA, subCTA, mapMain } = uiData;
  const destLabel = city.displayName ?? city.name;

  /* ① mapMain — 全体ルートマップ（最上部） */
  const mapFromLabel = mapMain.from?.replace(/駅$/, '') ?? '';
  const mapMainHtml  = mapMain.url
    ? `<div class="route-map-row">
         <a href="${mapMain.url}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">${mapFromLabel} → ${mapMain.to}の行き方を地図で見る</a>
       </div>`
    : '';

  /* ② mainCTA — rail または flight の予約ボタン（1つのみ） */
  const mainCtaHtml = mainCTA?.url
    ? `<div class="main-cta-row">
         <a href="${mainCTA.url}" target="_blank" rel="noopener noreferrer"
            class="btn ${btnClass(mainCTA.btnType)} btn--route-main">${mainCTA.label}</a>
       </div>`
    : '';

  /* ③ steps — 説明のみ（ボタンなし） */
  const stepsHtml = uiData.steps
    .map((s, i) => _buildAccessStepCard(s, i))
    .join('');

  /* ④ subCTA — ferry のみ（steps の後） */
  const subCtaHtml = subCTA?.url
    ? `<div class="sub-cta-row">
         <a href="${subCTA.url}" target="_blank" rel="noopener noreferrer"
            class="btn ${btnClass(subCTA.btnType)}">${subCTA.label}</a>
       </div>`
    : '';

  return `
    <div class="card-section">
      ${mapMainHtml}
      <div class="route-summary">${buildRouteSummary(departure, destLabel, city, uiData.steps)}</div>
      ${mainCtaHtml}
      <div class="step-list">${stepsHtml}</div>
      ${subCtaHtml}
      <p class="transport-disclaimer">※実際の時刻・料金は各サービスでご確認ください</p>
    </div>
  `;
}

function _buildAccessStepCard(step, index) {
  const num      = ACCESS_STEP_NUMS[index] ?? `(${index + 1})`;
  const fromDisp = step.from?.replace(/駅$/, '') ?? '';
  const toDisp   = step.to?.replace(/駅$/, '') ?? '';
  const mode     = step.type === 'local'
    ? (step.method ?? '現地移動')
    : ({ rail: '鉄道', flight: '飛行機', ferry: 'フェリー' }[step.type] ?? step.type);

  const subNote = step.type === 'ferry' && step.operator
    ? `<p class="step-card-caution">${step.operator}</p>`
    : '';

  return `
    <div class="step-card">
      <div class="step-card-header">${num}  ${fromDisp} → ${toDisp}（${mode}）</div>
      ${subNote}
    </div>
  `;
}

function _buildAccessLocalSection(mapLocal, filledSteps, city) {
  if (!mapLocal) return '';

  const needsRental = mapLocal.method === 'レンタカー';
  const gatewayCity = needsRental ? (mapLocal.from?.replace(/駅$/, '') ?? null) : null;
  const rentalLink  = needsRental ? buildRentalLink(gatewayCity) : null;

  const fromDisp = mapLocal.from?.replace(/駅$/, '').replace(/港$/, '') ?? '';
  const toDisp   = mapLocal.to?.replace(/駅$/, '').replace(/港$/, '') ?? '';

  const mapBtnHtml = mapLocal.url
    ? `<a href="${mapLocal.url}" target="_blank" rel="noopener noreferrer" class="btn btn-maps">地図で見る</a>`
    : '';
  const rentalHtml = rentalLink?.url
    ? `<a href="${rentalLink.url}" target="_blank" rel="noopener noreferrer" class="btn btn-rental">${rentalLink.label}</a>`
    : '';

  if (!mapBtnHtml && !rentalHtml) return '';

  return `
    <div class="local-section">
      <div class="local-header">最後の移動</div>
      <p class="local-route">${fromDisp} → ${toDisp}</p>
      <div class="link-list">${mapBtnHtml}${rentalHtml}</div>
    </div>
  `;
}

/* ── 宿泊ブロック ── */

function buildStayBlock(hotelLinks, city, stayType, stayCityName = null) {
  if (!hotelLinks?.bestUrl) return '';

  const travelMins = city?.travelTimeMinutes ?? 0;
  const isDaytrip  = stayType === 'daytrip';
  const stayLabel = stayCityName || hotelLinks.stayCityName || city?.displayName || city?.name || '';

  // 日帰りで遠い場合: 滞在提案メモ（時間表示なし）
  const longDaytripNote = isDaytrip && travelMins >= 150
    ? `<p class="stay-note">日帰りだと少し遠め。ゆっくりするなら1泊もおすすめ。</p>`
    : '';

  const stayHint = buildStayHint(city);

  return `
    <div class="stay-block">
      ${longDaytripNote}
      ${stayHint}
      <div class="stay-buttons">
        <a href="${hotelLinks.bestUrl}" target="_blank" rel="nofollow sponsored noopener"
           class="stay-btn stay-btn--${hotelLinks.bestType}">${stayLabel}に泊まる</a>
      </div>
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

