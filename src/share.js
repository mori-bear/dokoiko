/**
 * share.js — URL状態管理 + シェア機能
 *
 * URLパラメータ仕様:
 *   from      出発地（例: 東京）
 *   nights    旅の長さ（例: 1night / daytrip / 2night / 3night+）
 *   theme     テーマ（例: 温泉 / 絶景 / 海 / 街歩き / グルメ）省略=こだわらない
 *   car       0 のときレンタカー除外（省略=false）
 *   dest      目的地ID（例: kinosaki-onsen）
 *
 * 例:
 *   https://tabidokoiko.com/?from=大阪&nights=1night&theme=温泉&dest=kinosaki-onsen
 *   https://tabidokoiko.com/?from=東京&nights=2night&dest=kanazawa
 */

/** URLパラメータをオブジェクトにデコード */
export function decodeUrlParams() {
  const p = new URLSearchParams(location.search);
  const from       = p.get('from')   || null;
  const nights     = p.get('nights') || null;
  const theme      = p.get('theme')  || null;
  const car        = p.get('car');
  const dest       = p.get('dest')   || null;

  return {
    from,
    nights,
    theme,
    excludeCar: car === '0',
    dest,
  };
}

/** URLにステートをエンコード（history.replaceState） */
export function encodeStateToUrl(departure, stayType, theme, excludeCar, destId) {
  const p = new URLSearchParams();
  p.set('from',   departure);
  p.set('nights', stayType);
  if (theme)       p.set('theme', theme);
  if (excludeCar)  p.set('car', '0');
  if (destId)      p.set('dest', destId);

  const newUrl = location.pathname + '?' + p.toString();
  history.replaceState(null, '', newUrl);
}

/** シェア用テキスト生成 */
export function buildShareText(city, departure) {
  const name = city.displayName || city.name;
  const tags = Array.isArray(city.tags) && city.tags.length
    ? city.tags.slice(0, 3).join('・') + '旅'
    : '旅';
  const url = location.href;

  return `どこ行こ？で決めた\n\n${departure} → ${name}\n${tags}\n\n${url}`;
}

/** Xシェアウィンドウを開く */
export function openXShare(city, departure) {
  const text = buildShareText(city, departure);
  const encoded = encodeURIComponent(text);
  window.open(`https://x.com/intent/tweet?text=${encoded}`, '_blank', 'noopener,noreferrer');
}

/** シェアテキストをクリップボードにコピー */
export async function copyShareText(city, departure) {
  const text = buildShareText(city, departure);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    // フォールバック（古いブラウザ・非HTTPS）
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

/** ページタイトル + descriptionを動的更新（タブ表示 + 一部SNS対応） */
export function updatePageMeta(city, departure) {
  const name = city.displayName || city.name;
  const tags = Array.isArray(city.tags) ? city.tags.slice(0, 3).join('・') : '';
  const title = `${departure} → ${name} | どこ行こ？`;
  const desc  = `${departure}から${name}への旅プラン。${tags}`;

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
}
