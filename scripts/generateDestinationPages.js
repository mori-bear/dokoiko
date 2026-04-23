/**
 * generateDestinationPages.js — 目的地個別ページの一括生成
 *
 * 入力: src/data/destinations.json
 * 出力: destinations/{id}.html（全 destination 件数分）
 *
 * 各ページは SEO 向けの静的HTML。
 * スタイルは ../style.css（共通）。構造化データ (TouristDestination JSON-LD) を埋め込む。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DESTS_PATH = path.join(ROOT, 'src/data/destinations.json');
const OUT_DIR    = path.join(ROOT, 'destinations');

const SITE_ORIGIN = 'https://tabidokoiko.com';

/** HTML特殊文字をエスケープ（XSS対策） */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** 属性値専用エスケープ（escのスーパーセット） */
function attr(str) { return esc(str); }

/** JSON-LD 用のエスケープ（`</script>` 挿入を防ぐ） */
function jsonEsc(str) {
  return JSON.stringify(str).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

/** 所要時間を人間向け文字列へ */
function formatMinutes(m) {
  if (!m || m <= 0) return '';
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}時間${min}分`;
  if (h > 0)           return `${h}時間`;
  return `${min}分`;
}

/** 紹介文の先頭100文字（meta description 用・句読点で自然に切る） */
function descriptionSummary(desc) {
  if (!desc) return '';
  const s = String(desc);
  if (s.length <= 100) return s;
  const cut = s.slice(0, 100);
  const lastPunct = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'));
  return lastPunct > 60 ? cut.slice(0, lastPunct + 1) : cut + '…';
}

/** タイプバッジ定義（destinations.html と同じトーン） */
const TYPE_LABEL = {
  city: '街',
  sight: '名所',
  onsen: '温泉',
  island: '離島',
  mountain: '山',
  remote: '秘境',
  peninsula: '半島',
  coast: '海岸',
};

/** 目的地詳細ページを1件分のHTML文字列として返す */
function renderPage(dest, allDests) {
  const name = dest.displayName || dest.name;
  const prefecture = dest.prefecture || '';
  const typeLabel = TYPE_LABEL[dest.destType] || '';
  const tags = Array.isArray(dest.tags) ? dest.tags.slice(0, 5) : [];
  const spots = Array.isArray(dest.spots) ? dest.spots.slice(0, 3) : [];
  const descSummary = descriptionSummary(dest.description);

  const canonicalUrl = `${SITE_ORIGIN}/destinations/${dest.id}.html`;
  const ogImage = `${SITE_ORIGIN}/assets/ogp.png`;
  const title = `${name}への旅 | どこ行こ？`;

  /* ── 行き方セクション ── */
  const accessLines = [];
  if (dest.railGateway) accessLines.push(`最寄り駅: <strong>${esc(dest.railGateway)}</strong>`);
  const ferryPorts = Array.isArray(dest.gateways?.ferry) ? dest.gateways.ferry : [];
  if (ferryPorts.length) accessLines.push(`フェリー: <strong>${esc(ferryPorts[0])}</strong>から`);
  const airports = Array.isArray(dest.gateways?.airport) ? dest.gateways.airport : [];
  if (airports.length) accessLines.push(`最寄り空港: <strong>${esc(airports[0])}</strong>`);
  if (dest.requiresCar === true) {
    accessLines.push('<span class="access-note">※ 現地では車でのアクセスがおすすめです</span>');
  }
  const travelTimePairs = [];
  const tt = dest.travelTime ?? {};
  for (const [key, label] of [['tokyo', '東京'], ['osaka', '大阪'], ['fukuoka', '福岡']]) {
    if (tt[key] != null) travelTimePairs.push(`${label}から約${formatMinutes(tt[key])}`);
  }
  const travelTimeLine = travelTimePairs.length
    ? `<p class="dest-travel-time">${travelTimePairs.map(esc).join(' / ')}</p>`
    : '';

  /* ── 宿泊セクション ── */
  const stayAllowed = Array.isArray(dest.stayAllowed) ? dest.stayAllowed : [];
  const canStay = stayAllowed.includes('1night') || stayAllowed.includes('2night');
  const rakutenUrl = dest.hotelLinks?.rakuten;
  const jalanUrl   = dest.hotelLinks?.jalan;
  let stayHtml = '';
  if (canStay) {
    const stayCity = (dest.hubCity && dest.hubCity !== name)
      ? `<p class="stay-note">宿泊は<strong>${esc(dest.hubCity)}</strong>周辺が便利です</p>`
      : '';
    const btns = [
      rakutenUrl
        ? `<a class="btn btn-stay btn-rakuten" href="${attr(rakutenUrl)}" target="_blank" rel="nofollow sponsored noopener"><span class="btn-stay-main">楽天で宿を見る</span><small class="btn-stay-sub">ポイント貯まる</small></a>`
        : '',
      jalanUrl
        ? `<a class="btn btn-stay btn-jalan" href="${attr(jalanUrl)}" target="_blank" rel="nofollow sponsored noopener"><span class="btn-stay-main">じゃらんで宿を見る</span><small class="btn-stay-sub">温泉に強い</small></a>`
        : '',
    ].filter(Boolean).join('');
    stayHtml = `
      <section class="dest-section">
        <h2>泊まる</h2>
        ${stayCity}
        ${btns ? `<div class="stay-dual-grid">${btns}</div>` : ''}
      </section>`;
  } else if (stayAllowed.includes('daytrip')) {
    stayHtml = `
      <section class="dest-section">
        <h2>泊まる</h2>
        <p class="stay-note">日帰りがおすすめの旅先です</p>
      </section>`;
  }

  /* ── 近くの旅先セクション（同じ県 + gen_* 除外 + 自身除外） ── */
  const nearby = allDests
    .filter(d => d.type === 'destination'
              && !String(d.id).startsWith('gen_')
              && d.id !== dest.id
              && d.prefecture === dest.prefecture)
    .slice(0, 6);
  const nearbyHtml = nearby.length
    ? `
      <section class="dest-section">
        <h2>近くの旅先</h2>
        <ul class="nearby-list">
          ${nearby.map(d => `<li><a href="./${attr(d.id)}.html">${esc(d.displayName || d.name)}<span class="nearby-pref">${esc(d.prefecture || '')}</span></a></li>`).join('')}
        </ul>
      </section>`
    : '';

  /* ── 構造化データ (JSON-LD) ── */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name,
    description: dest.description ?? '',
    url: canonicalUrl,
    address: {
      '@type': 'PostalAddress',
      addressRegion: prefecture,
      addressCountry: 'JP',
    },
  };
  if (dest.lat && dest.lng) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: dest.lat,
      longitude: dest.lng,
    };
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(descSummary)}">
  <link rel="canonical" href="${attr(canonicalUrl)}">
  <meta property="og:type"        content="article">
  <meta property="og:site_name"   content="どこ行こ？">
  <meta property="og:title"       content="${attr(title)}">
  <meta property="og:description" content="${attr(descSummary)}">
  <meta property="og:url"         content="${attr(canonicalUrl)}">
  <meta property="og:image"       content="${attr(ogImage)}">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${attr(title)}">
  <meta name="twitter:description" content="${attr(descSummary)}">
  <meta name="twitter:image"      content="${attr(ogImage)}">
  <link rel="stylesheet" href="../style.css">
  <script type="application/ld+json">${jsonEsc(jsonLd)}</script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="logo" href="../index.html">どこ行こ？</a>
      <nav class="nav">
        <a href="../destinations.html">目的地一覧</a>
        <a href="../pages/about.html">このサイトについて</a>
      </nav>
    </div>
  </header>

  <main class="main">
    <div class="container dest-page">

      <section class="dest-hero-item">
        <div class="dest-badges">
          <span class="dest-prefecture-badge">${esc(prefecture)}</span>
          ${typeLabel ? `<span class="dest-type-badge-sm">${esc(typeLabel)}</span>` : ''}
        </div>
        <h1 class="dest-heading">${esc(name)}</h1>
        ${tags.length ? `<p class="dest-tags-line">🏷 ${esc(tags.join('・'))}</p>` : ''}
        ${dest.description ? `<p class="dest-description">${esc(dest.description)}</p>` : ''}
      </section>

      ${spots.length ? `
      <section class="dest-section">
        <h2>代表スポット</h2>
        <ul class="spots-list">
          ${spots.map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>
      </section>` : ''}

      <section class="dest-section">
        <h2>行き方</h2>
        ${accessLines.length ? `<ul class="access-list">${accessLines.map(l => `<li>${l}</li>`).join('')}</ul>` : '<p class="stay-note">現地情報をご確認ください。</p>'}
        ${travelTimeLine}
      </section>

      ${stayHtml}

      ${nearbyHtml}

      <section class="dest-finder">
        <p class="dest-finder-lead">行き先が決まっていない人はこちら</p>
        <a href="../index.html" class="dest-finder-link">どこ行こ？で旅先を探す →</a>
      </section>

    </div>
  </main>

  <footer class="site-footer">
    <p class="footer-policy">交通・宿泊情報は各社公式サイトでご確認ください。本サービスはアフィリエイト広告（楽天トラベル・じゃらん）を含みます。</p>
    <nav class="footer-nav">
      <a href="../pages/about.html">このサイトについて</a>
      <a href="../pages/privacy.html">プライバシーポリシー</a>
      <a href="../pages/disclaimer.html">免責事項</a>
    </nav>
    <p class="footer-copy">© 2026 どこ行こ？</p>
  </footer>
</body>
</html>
`;
}

/* ── メイン ── */

const dests = JSON.parse(fs.readFileSync(DESTS_PATH, 'utf8'));
// 個別ページは全 destination（gen_* も含む）で生成。
// 「近くの旅先」セクションの掲載対象だけは renderPage 内で gen_* を除外。
const targets = dests.filter(d => d.type === 'destination');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let generated = 0;
for (const d of targets) {
  const html = renderPage(d, dests);
  fs.writeFileSync(path.join(OUT_DIR, `${d.id}.html`), html);
  generated++;
}

console.log(`✓ 目的地ページ生成完了: ${generated}件 (${OUT_DIR})`);
