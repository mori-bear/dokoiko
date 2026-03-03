// ===== AFFILIATE CONFIG =====
const JALAN_SID       = "3764408";
const JALAN_HOTEL_PID = "892559852";
const JALAN_RENT_PID  = "892559858";

const RAKUTEN_AFF_ID = "5113ee4b.8662cfc5.5113ee4c.119de89a";
const RAKUTEN_BASE   = "https://travel.rakuten.co.jp";

// ===== LINKS =====

export function getJalanHotelUrl(cityName) {
  const target = "https://www.jalan.net/search/?keyword=" + encodeURIComponent(cityName);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_HOTEL_PID}&vc_url=${encodeURIComponent(target)}`;
}

/**
 * 楽天トラベル — hb.afl 方式（/yado/ 固定URL）
 * city.rakutenPath が null の都市はボタンを非表示にする。
 */
function buildRakutenUrl(city) {
  if (!city.rakutenPath) return null;
  const targetUrl = RAKUTEN_BASE + city.rakutenPath;
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFF_ID}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

export function getJalanRentUrl() {
  const base = "https://www.jalan.net/rentacar/";
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_RENT_PID}&vc_url=${encodeURIComponent(base)}`;
}

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city) {
  // じゃらん（宿）
  const jalanBtn = document.getElementById("jalanHotelBtn");
  if (jalanBtn) jalanBtn.href = getJalanHotelUrl(city.name);

  // 楽天トラベル（/yado/ 固定URL — rakutenPath がなければ非表示）
  const rakutenBtn = document.getElementById("rakutenHotelBtn");
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
  const rentBtn = document.getElementById("jalanRentBtn");
  if (rentBtn) rentBtn.href = getJalanRentUrl();
}
