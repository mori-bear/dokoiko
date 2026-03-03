// ===== AFFILIATE CONFIG =====
const JALAN_SID      = "3764408";
const JALAN_HOTEL_PID = "892559852";
const JALAN_RENT_PID  = "892559858";
const RAKUTEN_AFF_ID  = "511c83ed.aa0fc172.511c83ee.51331b19";

// ===== LINKS =====

export function getJalanHotelUrl(cityName) {
  const target = "https://www.jalan.net/search/?keyword=" + encodeURIComponent(cityName);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_HOTEL_PID}&vc_url=${encodeURIComponent(target)}`;
}

export function getRakutenHotelUrl(cityName) {
  return `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(cityName)}&rafcid=${RAKUTEN_AFF_ID}`;
}

export function getJalanRentUrl() {
  const base = "https://www.jalan.net/rentacar/";
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_RENT_PID}&vc_url=${encodeURIComponent(base)}`;
}

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city) {
  document.getElementById("jalanHotelBtn").href   = getJalanHotelUrl(city.name);
  document.getElementById("rakutenHotelBtn").href = getRakutenHotelUrl(city.name);
  // レンタカーボタンは needsCar=true のときのみ存在する
  const rentBtn = document.getElementById("jalanRentBtn");
  if (rentBtn) rentBtn.href = getJalanRentUrl();
}
