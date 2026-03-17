// ===== じゃらんレンタカー URL（ValueCommerce ラッパー付き） =====
export function getJalanRentUrl() {
  return (
    'https://ck.jp.ap.valuecommerce.com/servlet/referral' +
    '?sid=3764408' +
    '&pid=892559858' +
    '&vc_url=' +
    encodeURIComponent('https://www.jalan.net/rentacar/')
  );
}
