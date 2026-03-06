// ===== AFFILIATE CONFIG =====
const JALAN_SID      = "3764408";
const JALAN_RENT_PID = "892559858";
const JALAN_BASE     = "https://www.jalan.net";

// ===== じゃらん宿泊 URL =====
// city.jalanUrl があればそれを使用。なければキーワード検索 URL にフォールバック。
function getJalanHotelUrl(city) {
  if (city.jalanUrl) return city.jalanUrl;
  const name = city.hotelBase || city.name;
  return `https://www.jalan.net/search/?keyword=${encodeURIComponent(name)}`;
}

// ===== 楽天トラベル URL =====
// city.rakutenUrl があればそれを使用。なければキーワード検索 URL にフォールバック。
function buildRakutenUrl(city) {
  if (city.rakutenUrl) return city.rakutenUrl;
  const name = city.hotelBase || city.name;
  return `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(name)}`;
}

// ===== じゃらんレンタカー URL（自動生成を維持） =====
export function getJalanRentUrl(city) {
  const target = city.jalanPath
    ? JALAN_BASE + '/rentacar/search' + city.jalanPath
    : JALAN_BASE + '/rentacar/';
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_RENT_PID}&vc_url=${encodeURIComponent(target)}`;
}

// ===== DOM 適用 =====

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city, hubCity = null) {
  applyHotelSection(city, 'jalanHotelBtn', 'rakutenHotelBtn');
  if (hubCity) {
    applyHotelSection(hubCity, 'jalanHubHotelBtn', 'rakutenHubHotelBtn');
  }

  // ── レンタカー（needsCar=true のときのみ存在する） ──
  const rentBtn = document.getElementById('jalanRentBtn');
  if (rentBtn) {
    rentBtn.href = getJalanRentUrl(city);
  }
}

function applyHotelSection(city, jalanId, rakutenId) {
  const jalanUrl   = getJalanHotelUrl(city);
  const rakutenUrl = buildRakutenUrl(city);

  const jalanBtn = document.getElementById(jalanId);
  if (jalanBtn) jalanBtn.href = jalanUrl;

  const rakutenBtn = document.getElementById(rakutenId);
  if (rakutenBtn) rakutenBtn.href = rakutenUrl;
}
