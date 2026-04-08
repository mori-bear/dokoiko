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

  // ルート1行（出発地 → 目的地駅）
  const best       = transportContext?.bestRoute;
  const repStation = city.representativeStation || city.displayName || city.name;
  const ROUTE_ICON = { flight: '✈️', shinkansen: '🚄', ferry: '⛴', limited: '🚃', jr: '🚃' };
  const routeIcon  = best?.jrChainCta ? (ROUTE_ICON[best.jrChainCta.type] ?? '🚃') : '🚃';
  const routeLine  = departure ? `${routeIcon} ${departure} → ${repStation}` : '';

  // CTA行（JRチェーンCTAから直接生成）
  const chainCta = best?.jrChainCta;
  const clean = (n) => String(n ?? '').replace(/駅$|空港$|港$/, '');
  // transportContext経由でproviderを取得
  const ctaProvider = transportContext?.cta?.type ?? transportContext?.stepGroups?.find(s => s.type === 'main-cta')?.cta?.type ?? null;
  const PROV_MAP = { 'jr-east':'えきねっと', 'jr-west':'e5489', 'jr-kyushu':'九州ネット予約', 'jr-ex':'EX', 'skyscanner':'Skyscanner' };
  const provName = PROV_MAP[ctaProvider] ?? null;
  const TYPE_HINT = { shinkansen:'新幹線', limited:'特急', flight:'飛行機', ferry:'フェリー' };
  const typeHint = chainCta ? (TYPE_HINT[chainCta.type] ?? '') : '';
  const typeSuffix = typeHint ? `（${typeHint}）` : '';
  const ctaLine = chainCta
    ? `👉 ${clean(chainCta.from)} → ${clean(chainCta.to)}を${provName ? provName+'で' : ''}予約する${typeSuffix}`
    : '';

  // finalAccess行（gatewayCityベース）
  const fa = best?.finalAccess;
  const gw = chainCta ? clean(chainCta.to) : null;
  let accessLine = '';
  if (fa && typeof fa === 'object') {
    if (fa.type === 'train' && fa.line) {
      const company = extractCompany(fa.line);
      const from = gw || clean(fa.from) || '';
      const faTo = clean(fa.to) || city.displayName || city.name || '';
      const mid = typeof fa.midStation === 'object' ? fa.midStation?.name : fa.midStation;
      const transfer = typeof fa.transferStation === 'object' ? fa.transferStation?.name : fa.transferStation;
      const midClean = mid ? clean(mid) : null;
      const trClean = transfer ? clean(transfer) : null;
      if (midClean && trClean) {
        accessLine = `${from}から${midClean}へ → ${trClean}で${company}に乗換 → ${faTo}へ`;
      } else if (trClean && trClean !== from) {
        accessLine = `${from}から${trClean}で${company}に乗換 → ${faTo}へ`;
      } else {
        accessLine = `${from}から${company}で${faTo}へ`;
      }
    } else if (fa.type === 'bus') {
      const from = gw || (fa.from ? clean(fa.from) : null);
      const dest = city.displayName || city.name || '';
      accessLine = from ? `${from}からバスで${dest}へ` : '';
    } else if (fa.type === 'car') {
      const carFrom = gw || '';
      const dest = city.displayName || city.name || '';
      accessLine = carFrom ? `${carFrom}から車で${dest}へ` : '';
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
    ${routeLine ? `<div style="font-size:15px;color:#1c1c1c;font-weight:600;margin-bottom:16px;">${escHtml(routeLine)}</div>` : ''}
    ${ctaLine || accessLine ? `<div style="margin-bottom:0;">
      ${ctaLine ? `<div style="font-size:16px;color:#e65100;font-weight:700;line-height:1.5;">${escHtml(ctaLine)}</div>` : ''}
      ${accessLine ? `<div style="font-size:12px;color:#666;line-height:1.5;margin-top:4px;">→ ${escHtml(accessLine)}</div>` : ''}
    </div>` : ''}
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

/** 路線名から鉄道会社名を抽出する */
function extractCompany(line) {
  const COMPANIES = ['近鉄','南海','小田急','東武','西武','京王','京急','京成','京阪','阪急','阪神','名鉄','相鉄','東急','江ノ電','JR'];
  for (const c of COMPANIES) { if (line.startsWith(c)) return c; }
  return line.replace(/(線|本線)$/, '');
}

/** XSS対策: HTML特殊文字をエスケープ */
function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
