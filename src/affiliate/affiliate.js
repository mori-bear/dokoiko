// ===== AFFILIATE CONFIG =====
const RAKUTEN_AFF     = 'https://hb.afl.rakuten.co.jp/hgc/511c83ed.aa0fc172.511c83ee.51331b19/';
const VC_BASE         = 'https://ck.jp.ap.valuecommerce.com/servlet/referral';
const JALAN_SID       = '3764408';
const JALAN_PID_HOTEL = '892559852';
const JALAN_PID_RENT  = '892559858';

// ===== 都道府県スラッグ → じゃらん6桁コード =====
const PREF_JALAN = {
  hokkaido:  '010000', aomori:    '020000', iwate:     '030000', miyagi:    '040000',
  akita:     '050000', yamagata:  '060000', fukushima: '070000',
  ibaraki:   '080000', tochigi:   '090000', gunma:     '100000',
  saitama:   '110000', chiba:     '120000', tokyo:     '130000', kanagawa:  '140000',
  niigata:   '150000', toyama:    '160000', ishikawa:  '170000', fukui:     '180000',
  yamanashi: '190000', nagano:    '200000', gifu:      '210000', shizuoka:  '220000',
  aichi:     '230000', mie:       '240000',
  shiga:     '250000', kyoto:     '260000', osaka:     '270000', hyogo:     '280000',
  nara:      '290000', wakayama:  '300000',
  tottori:   '310000', shimane:   '320000', okayama:   '330000', hiroshima: '340000',
  yamaguchi: '350000',
  tokushima: '360000', kagawa:    '370000', ehime:     '380000', kochi:     '390000',
  fukuoka:   '400000', saga:      '410000', nagasaki:  '420000', kumamoto:  '430000',
  oita:      '440000', miyazaki:  '450000', kagoshima: '460000', okinawa:   '470000',
};

// ===== 都道府県スラッグ取得 =====
// city.prefecture を使用（loader で展開済みの _N suffix も strip）
function getPrefSlug(city) {
  return city.prefecture ?? null;
}

// ===== 楽天トラベル URL（アフィリエイトラッパー付き） =====
// https://travel.rakuten.co.jp/yado/{prefecture}/
function buildRakutenUrl(city) {
  const pref = getPrefSlug(city);
  const target = pref
    ? `https://travel.rakuten.co.jp/yado/${pref}/`
    : `https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(city.name)}`;
  return `${RAKUTEN_AFF}?pc=${encodeURIComponent(target)}`;
}

// ===== じゃらん宿泊 URL（ValueCommerce ラッパー付き） =====
// https://www.jalan.net/{6桁コード}/
function getJalanHotelUrl(city) {
  const pref = getPrefSlug(city);
  const code = pref ? PREF_JALAN[pref] : null;
  const target = code
    ? `https://www.jalan.net/${code}/`
    : `https://www.jalan.net/keyword/?keyword=${encodeURIComponent(city.name)}`;
  return `${VC_BASE}?sid=${JALAN_SID}&pid=${JALAN_PID_HOTEL}&vc_url=${encodeURIComponent(target)}`;
}

// ===== じゃらんレンタカー URL（ValueCommerce ラッパー付き） =====
export function getJalanRentUrl() {
  const target = 'https://www.jalan.net/rentacar/';
  return `${VC_BASE}?sid=${JALAN_SID}&pid=${JALAN_PID_RENT}&vc_url=${encodeURIComponent(target)}`;
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
    rentBtn.href = getJalanRentUrl();
  }
}

function applyHotelSection(city, jalanId, rakutenId) {
  const jalanBtn = document.getElementById(jalanId);
  if (jalanBtn) jalanBtn.href = getJalanHotelUrl(city);

  const rakutenBtn = document.getElementById(rakutenId);
  if (rakutenBtn) rakutenBtn.href = buildRakutenUrl(city);
}
