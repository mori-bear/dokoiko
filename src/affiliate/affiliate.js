// ===== AFFILIATE CONFIG =====
const JALAN_SID       = "3764408";
const JALAN_HOTEL_PID = "892559852";
const JALAN_RENT_PID  = "892559858";

const RAKUTEN_AFF_ID = "5113ee4b.8662cfc5.5113ee4c.119de89a";
const RAKUTEN_BASE   = "https://travel.rakuten.co.jp";
const JALAN_BASE     = "https://www.jalan.net";

// ===== じゃらん URL =====

/**
 * じゃらん宿泊 URL
 *   jalanPath あり → /kenCd/LRG_lrgCd/ エリアページ（VC経由）
 *   jalanPath なし → /search/?keyword= フォールバック（VC経由）
 */
function buildJalanHotelTarget(city) {
  if (city.jalanPath) {
    return JALAN_BASE + city.jalanPath;
  }
  return JALAN_BASE + '/search/?keyword=' + encodeURIComponent(city.name);
}

export function getJalanHotelUrl(city) {
  const target = buildJalanHotelTarget(city);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_HOTEL_PID}&vc_url=${encodeURIComponent(target)}`;
}

/**
 * じゃらんレンタカー URL
 *   jalanPath あり → /rentacar/search/kenCd/LRG_lrgCd/ エリア指定（VC経由）
 *   jalanPath なし → /rentacar/ トップ（VC経由）
 */
function buildJalanRentTarget(city) {
  if (city.jalanPath) {
    return JALAN_BASE + '/rentacar/search' + city.jalanPath;
  }
  return JALAN_BASE + '/rentacar/';
}

export function getJalanRentUrl(city) {
  const target = buildJalanRentTarget(city);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_RENT_PID}&vc_url=${encodeURIComponent(target)}`;
}

// ===== 楽天トラベル URL =====

/**
 * 楽天トラベル — hb.afl 方式（/yado/ 固定URL）
 * rakutenPath が null の都市はボタンを非表示にする。
 */
function buildRakutenUrl(city) {
  if (!city.rakutenPath) return null;
  const targetUrl = RAKUTEN_BASE + city.rakutenPath;
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFF_ID}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

// ===== DOM適用 =====

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city) {
  // じゃらん（宿）
  const jalanBtn = document.getElementById('jalanHotelBtn');
  if (jalanBtn) jalanBtn.href = getJalanHotelUrl(city);

  // 楽天トラベル（/yado/ 固定URL — rakutenPath がなければ非表示）
  const rakutenBtn = document.getElementById('rakutenHotelBtn');
  if (rakutenBtn) {
    const url = buildRakutenUrl(city);
    if (url) {
      rakutenBtn.href   = url;
      rakutenBtn.hidden = false;
    } else {
      rakutenBtn.hidden = true;
    }
  }

  // レンタカー（needsCar=true のときのみ存在する）
  const rentBtn = document.getElementById('jalanRentBtn');
  if (rentBtn) rentBtn.href = getJalanRentUrl(city);
}
