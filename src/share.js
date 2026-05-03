/**
 * share.js — URL状態管理 + シェア機能
 *
 * URLパラメータ仕様:
 *   from      出発地（例: 東京）
 *   nights    旅の長さ（例: 1night / daytrip / 2night / 3night+）
 *   theme     テーマ（例: 温泉 / 絶景 / 海 / 街歩き / グルメ）省略=こだわらない
 *   situation シチュエーション（solo / couple / friends）省略=こだわらない
 *   car       0 のときレンタカー除外（省略=false）
 *   dest      目的地ID（例: kinosaki-onsen）
 *
 * 例:
 *   https://tabidokoiko.com/?from=大阪&nights=1night&theme=温泉&dest=kinosaki-onsen
 *   https://tabidokoiko.com/?from=東京&nights=1night&situation=couple
 */

/** URLパラメータをオブジェクトにデコード */
export function decodeUrlParams() {
  const p = new URLSearchParams(location.search);
  const from       = p.get('from')      || null;
  const nights     = p.get('nights')    || null;
  const theme      = p.get('theme')     || null;
  const situation  = p.get('situation') || null;
  const car        = p.get('car');
  const dest       = p.get('dest')      || null;

  return {
    from,
    nights,
    theme,
    situation,
    excludeCar: car === '0',
    dest,
  };
}

/** URLにステートをエンコード（history.replaceState） */
export function encodeStateToUrl(departure, stayType, theme, excludeCar, destId, situation) {
  const p = new URLSearchParams();
  p.set('from',   departure);
  p.set('nights', stayType);
  if (theme)       p.set('theme', theme);
  if (situation)   p.set('situation', situation);
  if (excludeCar)  p.set('car', '0');
  if (destId)      p.set('dest', destId);

  const newUrl = location.pathname + '?' + p.toString();
  history.replaceState(null, '', newUrl);
}

/** シェア用テキスト生成（出発地ベース・口語調） */
export function buildShareText(city, departure) {
  const name = city.displayName || city.name;
  return `${departure}から${name}って意外と行ける\nhttps://tabidokoiko.com`;
}

/** Xシェアウィンドウを開く（出発地ベースコピー） */
export function openXShare(city, departure) {
  const url  = location.href;
  const name = city.displayName || city.name;
  const text = `${departure}から${name}って意外と行ける`;
  window.open(
    `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer,width=550,height=420',
  );
}

/** LINEシェアウィンドウを開く */
export function openLineShare(city, departure) {
  const url = location.href;
  const name = city.displayName || city.name;
  const text = `${departure}から${name}って意外と行ける`;
  window.open(
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer,width=550,height=420',
  );
}

/** URLをクリップボードにコピー（toast表示つき） */
export async function copyShareText(city, departure) {
  const url = location.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    showCopyToast();
  } catch (e) {
    console.error('[copyShareText] コピー失敗:', e);
  }
}

/** コピー完了 toast を2秒表示 */
function showCopyToast() {
  const existing = document.getElementById('copy-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'copy-toast';
  toast.textContent = 'リンクをコピーしました';
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
    'background:#1c1c1c', 'color:#fff', 'padding:10px 20px', 'border-radius:8px',
    'font-size:13px', 'font-weight:600', 'z-index:9999',
    'box-shadow:0 4px 12px rgba(0,0,0,.25)', 'pointer-events:none',
    'animation:toast-in .2s ease',
  ].join(';');
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

/** ページタイトル + descriptionを動的更新（タブ表示 + 一部SNS対応） */
export function updatePageMeta(city, departure) {
  const name = city.displayName || city.name;
  const title = `${name}の旅 | どこ行こ？`;
  const desc = city.description
    ? `${city.description}${name}への行き方・宿情報も掲載。出発地別に所要時間を確認できます。`
    : `${name}（${city.prefecture ?? ''}）への行き方・宿・観光スポット情報。`;

  document.title = title;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', desc);

  // OGP（既存タグがあれば更新、なければ追加）
  const setMeta = (property, content) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('og:title',       title);
  setMeta('og:description', desc);
  setMeta('og:url',         location.href);
  setMeta('og:image', 'https://tabidokoiko.com/assets/ogp.png');

  // canonical: dest={id} のみのクリーンURLを正規URLとして指定
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  const canonicalUrl = city?.id
    ? `https://tabidokoiko.com/?dest=${encodeURIComponent(city.id)}`
    : 'https://tabidokoiko.com/';
  canonical.setAttribute('href', canonicalUrl);

  // JSON-LD 構造化データ（TouristDestination）
  const existing = document.querySelector('script[type="application/ld+json"]');
  if (existing) existing.remove();
  const jsonLd = document.createElement('script');
  jsonLd.type = 'application/ld+json';
  jsonLd.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    'name': name,
    'description': desc,
    'url': canonicalUrl,
    ...(city.lat && city.lng ? { 'geo': { '@type': 'GeoCoordinates', 'latitude': city.lat, 'longitude': city.lng } } : {}),
  });
  document.head.appendChild(jsonLd);
}
