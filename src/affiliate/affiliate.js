// ===== AFFILIATE CONFIG =====
const RAKUTEN_RAFCID  = '511c83ed.aa0fc172.511c83ee.51331b19';
const VC_BASE         = 'https://ck.jp.ap.valuecommerce.com/servlet/referral';
const JALAN_SID       = '3764408';
const JALAN_PID_RENT  = '892559858';

// ===== 楽天トラベル URL（hotelHub キーワード検索） =====
function buildRakutenUrl(keyword) {
  return `https://travel.rakuten.co.jp/Search.do?f_keyword=${encodeURIComponent(keyword)}&rafcid=${RAKUTEN_RAFCID}`;
}

// ===== じゃらん宿泊 URL（hotelHub キーワード検索） =====
function getJalanHotelUrl(keyword) {
  return `https://www.jalan.net/search/?keyword=${encodeURIComponent(keyword)}`;
}

// ===== じゃらんレンタカー URL（ValueCommerce ラッパー付き） =====
export function getJalanRentUrl() {
  const target = 'https://www.jalan.net/rentacar/';
  return `${VC_BASE}?sid=${JALAN_SID}&pid=${JALAN_PID_RENT}&vc_url=${encodeURIComponent(target)}`;
}

// ===== DOM 適用 =====

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(hotelHub) {
  const jalanBtn   = document.getElementById('jalanHotelBtn');
  const rakutenBtn = document.getElementById('rakutenHotelBtn');

  if (jalanBtn)   jalanBtn.href   = getJalanHotelUrl(hotelHub);
  if (rakutenBtn) rakutenBtn.href = buildRakutenUrl(hotelHub);

  // ── レンタカー（needsCar=true のときのみ存在する） ──
  const rentBtn = document.getElementById('jalanRentBtn');
  if (rentBtn) rentBtn.href = getJalanRentUrl();
}
