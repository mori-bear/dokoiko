/**
 * share-image.js — シェア用カード画像生成
 *
 * html2canvas（CDNグローバル）を使用してDOMをPNG化する。
 * キャプチャ対象は都市名・出発地・サブコピーのみ（CTA除外）。
 */

/**
 * シェアカード要素を生成してcanvasに変換する。
 * @param {object} city      — 目的地オブジェクト
 * @param {string} departure — 出発地名
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureShareCard(city, departure) {
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas が読み込まれていません');
  }

  const name       = city.displayName || city.name;
  const prefecture = city.prefecture  || '';
  const tags       = (city.primary ?? city.tags ?? []).slice(0, 3).join('・');
  const spots      = (city.spots ?? []).slice(0, 3).join('・');
  const tagline    = city.description?.split('。')[0] ?? '';

  // ── オフスクリーンカード要素を生成 ──
  const card = document.createElement('div');

  Object.assign(card.style, {
    position:   'fixed',
    left:       '-9999px',
    top:        '0',
    width:      '560px',
    padding:    '56px 48px 48px',
    background: '#ffffff',
    fontFamily: '"Hiragino Kaku Gothic Pro", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
    boxSizing:  'border-box',
    lineHeight: '1',
    zIndex:     '-1',
  });

  card.innerHTML = `
    <div style="font-size:44px;font-weight:800;color:#1c1c1c;line-height:1.15;margin-bottom:12px;">${escHtml(name)}</div>
    ${tagline ? `<div style="font-size:15px;color:#555;line-height:1.7;margin-bottom:16px;">${escHtml(tagline)}</div>` : ''}
    <div style="font-size:13px;color:#999;margin-bottom:8px;">📍 ${escHtml(prefecture)}${tags ? `　🏷 ${escHtml(tags)}` : ''}</div>
    <div style="font-size:13px;color:#888;margin-bottom:20px;">🚃 ${escHtml(departure)} → ${escHtml(name)}</div>
    ${spots ? `<div style="font-size:13px;color:#666;line-height:1.6;">${escHtml(spots)}</div>` : ''}
    <div style="font-size:11px;color:#ccc;text-align:right;margin-top:32px;letter-spacing:0.08em;">tabidokoiko.com</div>
  `;

  document.body.appendChild(card);

  try {
    const canvas = await window.html2canvas(card, {
      scale:       2,             // 高解像度（1200px相当）
      backgroundColor: '#ffffff',
      useCORS:     false,
      logging:     false,
      width:       560,
      windowWidth: 560,
    });
    return canvas;
  } finally {
    document.body.removeChild(card);
  }
}

/**
 * canvas をWeb Share API（スマホ）またはダウンロード（PC）で共有する。
 * @param {HTMLCanvasElement} canvas
 * @param {object} city
 * @param {string} departure
 */
export function shareOrDownload(canvas, city, departure) {
  const name = city.displayName || city.name;

  canvas.toBlob((blob) => {
    if (!blob) return;

    const fileName = `${departure}-${name}.png`;
    const file     = new File([blob], fileName, { type: 'image/png' });

    // スマホ：Web Share API でファイル共有
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch((e) => {
        if (e.name !== 'AbortError') fallbackDownload(blob, fileName);
      });
      return;
    }

    // PC：ダウンロード
    fallbackDownload(blob, fileName);
  }, 'image/png');
}

function fallbackDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** XSS対策: HTML特殊文字をエスケープ */
function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
