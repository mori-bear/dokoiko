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
export async function captureShareCard(city, departure, transportContext = null) {
  if (typeof window.html2canvas !== 'function') {
    throw new Error('html2canvas が読み込まれていません');
  }

  const name       = city.displayName || city.name;
  const prefecture = city.prefecture  || '';
  const tags       = (city.primary ?? city.tags ?? []).slice(0, 3).join('・');
  const tagline    = city.description?.split('。')[0] ?? '';

  // ルート1行（displayRoute ベース）
  const best       = transportContext?.bestRoute;
  const dr         = best?.displayRoute;
  const routeLine  = dr ? `🚃 ${dr.from} → ${dr.to}` : '';

  // CTA行（JRチェーンCTAから直接生成）
  const chainCta = best?.jrChainCta;
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  const PROVIDER = { shinkansen: '新幹線', limited: '特急', jr: 'JR', flight: '飛行機', ferry: 'フェリー' };
  const ctaLine = chainCta
    ? `👉 ${clean(chainCta.from)} → ${clean(chainCta.to)}を予約（${PROVIDER[chainCta.type] ?? ''}）`
    : '';

  // finalAccess行（gatewayCityベース）
  const fa = best?.finalAccess;
  const gw = chainCta ? clean(chainCta.to) : null;
  let accessLine = '';
  if (fa && typeof fa === 'object') {
    if (fa.type === 'train' && fa.line) {
      const shortLine = fa.line.replace(/(線|本線)$/, '');
      const from = gw || clean(fa.from) || '';
      const faTo = clean(fa.to) || city.displayName || city.name || '';
      accessLine = `${from}から${shortLine}で${faTo}へ`;
    } else if (fa.type === 'bus') {
      const from = gw || (fa.from ? clean(fa.from) : null);
      accessLine = from ? `${from}からバスでアクセス` : '';
    } else if (fa.type === 'car') {
      accessLine = 'レンタカーでアクセス';
    }
  }

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
    <div style="font-size:13px;color:#999;margin-bottom:20px;">📍 ${escHtml(prefecture)}${tags ? `｜${escHtml(tags)}` : ''}</div>
    ${routeLine ? `<div style="font-size:15px;color:#1c1c1c;font-weight:600;margin-bottom:8px;">${escHtml(routeLine)}</div>` : ''}
    ${ctaLine ? `<div style="font-size:16px;color:#e65100;font-weight:700;margin-bottom:6px;line-height:1.5;">${escHtml(ctaLine)}</div>` : ''}
    ${accessLine ? `<div style="font-size:12px;color:#888;line-height:1.5;">${escHtml(accessLine)}</div>` : ''}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">👇 行き方すぐ出る</div>
      <div style="font-size:13px;color:#1c1c1c;font-weight:600;letter-spacing:0.05em;">tabidokoiko.com</div>
    </div>
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
