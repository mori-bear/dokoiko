// ===== AFFILIATE CONFIG =====
const JALAN_SID       = "3764408";
const JALAN_HOTEL_PID = "892559852";
const JALAN_RENT_PID  = "892559858";

const RAKUTEN_AFF_ID = "5113ee4b.8662cfc5.5113ee4c.119de89a";
const RAKUTEN_BASE   = "https://travel.rakuten.co.jp";
const JALAN_BASE     = "https://www.jalan.net";

// ===== じゃらん URL =====

/**
 * じゃらん宿泊 URL — 例外上書き方式
 *
 *   優先順:
 *   1. city.jalanUrl が存在すれば完成リンクをそのまま使用（encode なし）
 *   2. city.jalanPath あり → /kenCd/LRG_lrgCd/ エリアページ（VC 自動生成）
 *   3. フォールバック → /search/?keyword= キーワード検索（VC 自動生成）
 */
export function getJalanHotelUrl(city) {
  // 例外 URL（明示指定・二重 encode なし）
  if (city.jalanUrl) return city.jalanUrl;

  // 自動生成（jalanPath または キーワード）
  const target = city.jalanPath
    ? JALAN_BASE + city.jalanPath
    : JALAN_BASE + '/search/?keyword=' + encodeURIComponent(city.name);

  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_HOTEL_PID}&vc_url=${encodeURIComponent(target)}`;
}

/**
 * じゃらんレンタカー URL
 *   jalanPath あり → /rentacar/search/kenCd/LRG_lrgCd/ エリア指定（VC 経由）
 *   jalanPath なし → /rentacar/ トップ（VC 経由）
 */
export function getJalanRentUrl(city) {
  const target = city.jalanPath
    ? JALAN_BASE + '/rentacar/search' + city.jalanPath
    : JALAN_BASE + '/rentacar/';

  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${JALAN_SID}&pid=${JALAN_RENT_PID}&vc_url=${encodeURIComponent(target)}`;
}

// ===== 楽天トラベル URL =====

/**
 * 楽天トラベル — 例外上書き方式
 *
 *   優先順:
 *   1. city.rakutenUrl が存在すれば完成リンクをそのまま使用（encode なし）
 *   2. city.rakutenPath あり → hb.afl /yado/ 固定 URL（自動生成）
 *   3. rakutenPath なし → null（ボタン非表示）
 */
function buildRakutenUrl(city) {
  // 例外 URL（明示指定・二重 encode なし）
  if (city.rakutenUrl) return city.rakutenUrl;

  // 自動生成
  if (!city.rakutenPath) return null;
  const targetUrl = RAKUTEN_BASE + city.rakutenPath;
  return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFF_ID}/?pc=${encodeURIComponent(targetUrl)}&link_type=text`;
}

// ===== DOM 適用 =====

/** renderResult からDOM構築直後に呼び出す */
export function applyAffiliateLinks(city, hubCity = null) {
  // ── 目的地宿 ──
  const jalanBtn = document.getElementById('jalanHotelBtn');
  if (jalanBtn) {
    const url = getJalanHotelUrl(city);
    // eslint-disable-next-line no-console
    console.log(`[affiliate] jalan(${city.name}):`, url);
    jalanBtn.href = url;
  }

  const rakutenBtn = document.getElementById('rakutenHotelBtn');
  if (rakutenBtn) {
    const url = buildRakutenUrl(city);
    // eslint-disable-next-line no-console
    console.log(`[affiliate] rakuten(${city.name}):`, url ?? '(hidden)');
    if (url) {
      rakutenBtn.href   = url;
      rakutenBtn.hidden = false;
    } else {
      rakutenBtn.hidden = true;
    }
  }

  // ── ハブ都市宿（hubHotel あり のみ） ──
  if (hubCity) {
    const jalanHubBtn = document.getElementById('jalanHubHotelBtn');
    if (jalanHubBtn) {
      const url = getJalanHotelUrl(hubCity);
      // eslint-disable-next-line no-console
      console.log(`[affiliate] jalan-hub(${hubCity.name}):`, url);
      jalanHubBtn.href = url;
    }

    const rakutenHubBtn = document.getElementById('rakutenHubHotelBtn');
    if (rakutenHubBtn) {
      const url = buildRakutenUrl(hubCity);
      // eslint-disable-next-line no-console
      console.log(`[affiliate] rakuten-hub(${hubCity.name}):`, url ?? '(hidden)');
      if (url) {
        rakutenHubBtn.href   = url;
        rakutenHubBtn.hidden = false;
      } else {
        rakutenHubBtn.hidden = true;
      }
    }
  }

  // ── レンタカー（needsCar=true のときのみ存在する） ──
  const rentBtn = document.getElementById('jalanRentBtn');
  if (rentBtn) {
    const url = getJalanRentUrl(city);
    // eslint-disable-next-line no-console
    console.log(`[affiliate] rent(${city.name}):`, url);
    rentBtn.href = url;
  }
}
