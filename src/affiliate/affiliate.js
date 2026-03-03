// ===== AFFILIATE CONFIG =====
const JALAN_SID      = "3764408";
const JALAN_RENT_PID = "892559858";
const JALAN_BASE     = "https://www.jalan.net";

// ===== じゃらん宿泊 URL =====
// city.jalanUrl が存在する場合のみ返す。自動生成は行わない。
function getJalanHotelUrl(city) {
  return city.jalanUrl || null;
}

// ===== 楽天トラベル URL =====
// city.rakutenUrl が存在する場合のみ返す。自動生成は行わない。
function buildRakutenUrl(city) {
  return city.rakutenUrl || null;
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
  applyHotelSection(city, 'jalanHotelBtn', 'rakutenHotelBtn', 'hotel-pending');
  if (hubCity) {
    applyHotelSection(hubCity, 'jalanHubHotelBtn', 'rakutenHubHotelBtn', 'hub-hotel-pending');
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

function applyHotelSection(city, jalanId, rakutenId, pendingId) {
  const jalanUrl   = getJalanHotelUrl(city);
  const rakutenUrl = buildRakutenUrl(city);

  // eslint-disable-next-line no-console
  console.log(`[affiliate] jalan(${city.name}):`, jalanUrl ?? '(hidden)');
  // eslint-disable-next-line no-console
  console.log(`[affiliate] rakuten(${city.name}):`, rakutenUrl ?? '(hidden)');

  const jalanBtn = document.getElementById(jalanId);
  if (jalanBtn) {
    if (jalanUrl) {
      jalanBtn.href = jalanUrl;
    } else {
      jalanBtn.hidden = true;
    }
  }

  const rakutenBtn = document.getElementById(rakutenId);
  if (rakutenBtn) {
    if (rakutenUrl) {
      rakutenBtn.href = rakutenUrl;
    } else {
      rakutenBtn.hidden = true;
    }
  }

  // 宿リンクが1件もない場合は「準備中」メッセージを表示
  if (!jalanUrl && !rakutenUrl) {
    const pending = document.getElementById(pendingId);
    if (pending) pending.hidden = false;
  }
}
